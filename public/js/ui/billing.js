import {
	addDays,
	addMonths,
	lastDayOfMonth,
	setDate,
	subMonths,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import * as utils from "../utils.js";

/**
 * 請求タブのUI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
	list: utils.dom.get("billing-list"),
});

/**
 * 「振替を記録する」ボタンがクリックされたときに呼び出されるコールバック関数。
 * @type {function}
 */
let onRecordPaymentClickCallback = () => {};

/**
 * 「設定を変更」ボタンがクリックされたときに呼び出されるコールバック関数。
 * @type {function}
 */
let onSettingsClickCallback = () => {};

/**
 * アプリケーションのルックアップテーブルへの参照。
 * 口座やカテゴリなどの情報を取得するために使用される。
 * @type {object}
 */
let appLuts = {};

/**
 * 請求モジュールを初期化する。
 * イベントリスナーを設定し、外部から渡されたコールバックを保存する。
 * @param {function} onRecordPaymentClick - 「振替を記録する」ボタンがクリックされたときに呼び出されるコールバック関数。
 * @param {function} onSettingsClick - 「設定を変更」ボタンがクリックされたときに呼び出されるコールバック関数。
 * @returns {void}
 */
export function init(onRecordPaymentClick, onSettingsClick) {
	onRecordPaymentClickCallback = onRecordPaymentClick;
	onSettingsClickCallback = onSettingsClick;

	const { list } = getElements();
	utils.dom.on(list, "click", (e) => {
		if (e.target.classList.contains("record-payment-btn")) {
			onRecordPaymentClickCallback(e.target.dataset);
		}
		if (e.target.closest(".billing-settings-btn")) {
			if (onSettingsClickCallback) onSettingsClickCallback();
		}
	});
}

/**
 * 指定された日付オブジェクトの日を、安全に設定するヘルパー関数。
 * 月末日を超えないように調整し、不正な日付（例: 2月30日）になるのを防ぐ。
 * @param {Date} date - 元の日付オブジェクト
 * @param {number} day - 設定したい日（1-31）
 * @returns {Date} 補正された日付オブジェクト
 */
const setDateSafe = (date, day) => {
	const lastDay = lastDayOfMonth(date).getDate();
	return setDate(date, Math.min(day, lastDay));
};

/**
 * 取引日に基づいて、その取引が属するクレジットカードの締め日を計算する。
 * タイムゾーン（Asia/Tokyo）を考慮して計算を行う。
 * @private
 * @param {Date} txDate - 取引日 (Dateオブジェクト)。
 * @param {number} closingDay - カードの締め日（1-31）。
 * @returns {Date} 計算された締め日のDateオブジェクト（UTC Timestamp）。
 */
function getClosingDateForTransaction(txDate, closingDay) {
	// DateオブジェクトをJSTの文字列に変換してから解析する
	// これにより、UTCのタイムスタンプを日本時間の日付として正しく扱う
	const txDateStr = utils.toYYYYMMDD(txDate);
	const [y, m, d] = txDateStr.split("-").map(Number);
	let targetDate = new Date(y, m - 1, d);

	if (targetDate.getDate() > closingDay) {
		targetDate = addMonths(targetDate, 1);
	}

	targetDate = setDateSafe(targetDate, closingDay);

	// 計算結果（ローカル時間としてのTokyo時間）を、実際のTimestamp（UTC）に変換する
	return fromZonedTime(targetDate, "Asia/Tokyo");
}

/**
 * 締め日に基づいて、支払日を計算する。
 * @private
 * @param {Date} closingDate - 締め日（UTC Timestamp）。
 * @param {object} rule - クレジットカードの支払いルール。
 * @returns {Date} 計算された支払日のDateオブジェクト（UTC Timestamp）。
 */
export function getPaymentDate(closingDate, rule) {
	// TimestampをTokyo時間のローカル表現に変換
	let targetDate = toZonedTime(closingDate, "Asia/Tokyo");

	targetDate = addMonths(targetDate, rule.paymentMonthOffset);
	targetDate = setDateSafe(targetDate, rule.paymentDay);

	// Timestampに戻す
	return fromZonedTime(targetDate, "Asia/Tokyo");
}

/**
 * 締め日に基づいて、請求期間の文字列を生成する。
 * @private
 * @param {Date} closingDate - 締め日（UTC Timestamp）。
 * @param {object} rule - クレジットカードの支払いルール。
 * @returns {string} フォーマットされた請求期間の文字列。
 */
function getBillingPeriod(closingDate, rule) {
	// TimestampをTokyo時間のローカル表現に変換
	const endLocal = toZonedTime(closingDate, "Asia/Tokyo");
	let startLocal;

	if (rule.closingDay >= 31) {
		startLocal = new Date(endLocal);
		startLocal.setDate(1);
	} else {
		const prevClosingDate = subMonths(endLocal, 1);
		startLocal = addDays(prevClosingDate, 1);
	}

	// フォーマット用にTimestampに戻す
	const startTimestamp = fromZonedTime(startLocal, "Asia/Tokyo");
	const endTimestamp = fromZonedTime(endLocal, "Asia/Tokyo");

	const fmt = "yyyy年M月d日";
	const startStr = formatInTimeZone(startTimestamp, "Asia/Tokyo", fmt);
	const endStr = formatInTimeZone(endTimestamp, "Asia/Tokyo", fmt);

	return `${startStr} 〜 ${endStr}`;
}

/**
 * 未払いの請求情報を表示するカードUIを生成する。
 * 請求額、期間、支払日を表示し、振替記録ボタンを配置する。
 * @private
 * @param {object} bill - 請求オブジェクト。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @returns {HTMLElement} 生成されたカードのDOM要素。
 */
function createBillingCard(bill, isMasked) {
	const {
		cardId,
		cardName,
		rule,
		closingDate,
		amount,
		icon,
		paidAmount,
		remainingAmount,
	} = bill;

	const cardDiv = document.createElement("div");
	cardDiv.className =
		"bg-white p-4 rounded-lg shadow-sm border flex flex-col md:flex-row items-start md:items-center gap-4";
	const paymentDate = getPaymentDate(closingDate, rule);
	const billingPeriod = getBillingPeriod(closingDate, rule);
	const paymentDateStr = utils.toYYYYMMDD(paymentDate);
	const paymentDateDisplay = formatInTimeZone(
		paymentDate,
		"Asia/Tokyo",
		"yyyy年M月d日"
	);
	const iconClass = icon || "fas fa-credit-card";

	// 金額表示部分のHTML生成
	let amountHtml = "";
	if (paidAmount > 0) {
		// 一部支払い済みの場合
		amountHtml = `
            <div class="text-right">
                <p class="text-xs text-neutral-500">請求総額: ${utils.formatCurrency(
									amount,
									isMasked
								)}</p>
                <p class="text-xs text-success">支払済: ${utils.formatCurrency(
									paidAmount,
									isMasked
								)}</p>
                <p class="text-sm text-neutral-600 mt-1">残り支払額</p>
                <p class="font-bold text-2xl text-danger mb-3">${utils.formatCurrency(
									remainingAmount,
									isMasked
								)}</p>
            </div>
        `;
	} else {
		// 未払いの場合
		amountHtml = `
            <div class="text-right">
                <p class="text-sm text-neutral-600">請求額</p>
                <p class="font-bold text-2xl text-danger mb-3">${utils.formatCurrency(
									amount,
									isMasked
								)}</p>
            </div>
        `;
	}

	utils.dom.setHtml(
		cardDiv,
		`
        <div class="flex-grow">
            <div class="flex items-center gap-3 mb-2">
                <i class="${iconClass} text-xl text-neutral-400 w-6 text-center"></i>
                <h3 class="font-bold text-lg text-neutral-800">${cardName}</h3>
            </div>
            <p class="text-sm text-neutral-600">請求期間: ${billingPeriod}</p>
            <p class="text-sm text-neutral-600">支払予定日: ${paymentDateDisplay}</p>
        </div>
        <div class="w-full md:w-auto flex flex-col items-end">
            ${amountHtml}
            <button class="record-payment-btn w-full md:w-auto bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-dark transition shadow-md">
                <i class="fas fa-money-bill-wave mr-2"></i>振替を記録する
            </button>
        </div>
		`
	);

	const button = cardDiv.querySelector(".record-payment-btn");
	button.dataset.toAccountId = cardId;
	button.dataset.cardName = cardName;
	// 振替記録ボタンには残りの金額をセットする
	button.dataset.amount = remainingAmount;
	button.dataset.paymentDate = paymentDateStr;
	button.dataset.defaultAccountId = rule.defaultPaymentAccountId;
	button.dataset.closingDate = formatInTimeZone(
		closingDate,
		"Asia/Tokyo",
		"M月d日"
	);
	button.dataset.closingDateStr = utils.toYYYYMMDD(closingDate);
	return cardDiv;
}

/**
 * 全取引データとカードルールから、全ての請求（支払い済み含む）を計算してリストアップする。
 * フィルタリングを行わず、純粋な集計結果を返す。
 * @param {Array<object>} allTransactions - 全期間の取引データ。
 * @param {object} creditCardRules - 全クレジットカードの支払いルール。
 * @returns {Array<object>} 全請求オブジェクトの配列。
 */
export function calculateAllBills(allTransactions, creditCardRules) {
	const allBills = [];
	const liabilityAccounts = [...appLuts.accounts.values()].filter(
		(acc) => acc.type === "liability" && !acc.isDeleted
	);
	const liabilityAccountIds = new Set(liabilityAccounts.map((acc) => acc.id));
	const expensesByAccount = new Map();

	for (const t of allTransactions) {
		let targetAccountId = null;
		if (t.type === "expense" && liabilityAccountIds.has(t.accountId)) {
			targetAccountId = t.accountId;
		} else if (
			t.type === "transfer" &&
			liabilityAccountIds.has(t.fromAccountId)
		) {
			targetAccountId = t.fromAccountId;
		}

		if (targetAccountId) {
			if (!expensesByAccount.has(targetAccountId)) {
				expensesByAccount.set(targetAccountId, []);
			}
			expensesByAccount.get(targetAccountId).push(t);
		}
	}

	for (const card of liabilityAccounts) {
		const rule = creditCardRules[card.id];
		if (!rule) continue;

		const expenses = expensesByAccount.get(card.id) || [];
		if (expenses.length === 0) continue;

		const billsByCycle = {}; // { "YYYY-MM-DD": { amount: 123, ... } }

		for (const t of expenses) {
			// 1. 各取引が属する締め日を計算する
			const closingDate = getClosingDateForTransaction(t.date, rule.closingDay);
			const closingDateStr = utils.toYYYYMMDD(closingDate);

			// 2. 締め日ごとに取引を集計する
			if (!billsByCycle[closingDateStr]) {
				billsByCycle[closingDateStr] = {
					cardId: card.id,
					cardName: card.name,
					rule: rule,
					closingDate: closingDate,
					closingDateStr: closingDateStr,
					amount: 0,
					icon: card.icon || "fas fa-credit-card",
					order: card.order || 0,
				};
			}
			billsByCycle[closingDateStr].amount += t.amount;
		}

		// 集計した結果を追加する
		allBills.push(...Object.values(billsByCycle));
	}

	return allBills.sort(
		(a, b) => a.order - b.order || a.closingDate - b.closingDate
	);
}

/**
 * 全取引データとカードルールから、未払いの請求を計算してリストアップする。
 * 締め日ごとに取引を集計し、既に支払い済みのサイクルを除外する。
 * @param {Array<object>} allTransactions - 全期間の取引データ。
 * @param {object} creditCardRules - 全クレジットカードの支払いルール。
 * @returns {Array<object>} 未払い請求オブジェクトの配列。
 */
export function calculateBills(allTransactions, creditCardRules) {
	const allBills = calculateAllBills(allTransactions, creditCardRules);

	// 支払い済みの金額を集計する
	// キー形式: "{cardId}_{closingDateStr}" -> amount
	const paidAmounts = new Map();
	allTransactions.forEach((tx) => {
		if (
			tx.type === "transfer" &&
			tx.metadata &&
			tx.metadata.paymentTargetCardId &&
			tx.metadata.paymentTargetClosingDate
		) {
			const key = `${tx.metadata.paymentTargetCardId}_${tx.metadata.paymentTargetClosingDate}`;
			const current = paidAmounts.get(key) || 0;
			paidAmounts.set(key, current + tx.amount);
		}
	});

	return allBills.filter((bill) => {
		const key = `${bill.cardId}_${bill.closingDateStr}`;
		const paidAmount = paidAmounts.get(key) || 0;

		// 描画用に計算結果をオブジェクトに追加
		bill.paidAmount = paidAmount;
		bill.remainingAmount = bill.amount - paidAmount;

		// 残高が残っている場合のみ表示 (1円以上の誤差は許容しない)
		return bill.remainingAmount > 0;
	});
}

/**
 * 未払いの請求リストを画面に描画する。
 * 計算された請求情報を元にカード要素を生成し、リストに追加する。
 * @param {Array<object>} allTransactions - 全期間の取引データ。
 * @param {object} creditCardRules - 全クレジットカードの支払いルール。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 * @param {boolean} isDataInsufficient - データが不足している可能性があるかどうかのフラグ。
 * @returns {void}
 */
export function render(
	allTransactions,
	creditCardRules,
	isMasked,
	luts,
	isDataInsufficient = false
) {
	appLuts = luts;
	const unpaidBills = calculateBills(allTransactions, creditCardRules);

	const { list } = getElements();
	utils.dom.setHtml(list, "");

	if (isDataInsufficient) {
		const warningDiv = document.createElement("div");
		warningDiv.className =
			"bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 flex justify-between items-center";
		warningDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle text-yellow-500 mr-3"></i>
                <div>
                    <p class="text-sm text-yellow-700 font-bold">表示期間が短いため、一部の請求が表示されていない可能性があります。</p>
                    <p class="text-xs text-yellow-600">正確な請求管理を行うには、設定から表示期間を長くしてください。</p>
                </div>
            </div>
            <button class="billing-settings-btn text-sm bg-white border border-yellow-400 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-100 transition">
                設定を変更
            </button>
        `;
		list.appendChild(warningDiv);
	}

	if (unpaidBills.length === 0) {
		const emptyMsg = document.createElement("p");
		emptyMsg.className = "text-center text-neutral-400 py-4";
		emptyMsg.textContent = "未払いの請求はありません。";
		list.appendChild(emptyMsg);
		return;
	}
	unpaidBills.forEach((bill) => {
		list.appendChild(createBillingCard(bill, isMasked));
	});
}
