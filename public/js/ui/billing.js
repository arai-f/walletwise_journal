import { toDate } from "https://esm.sh/date-fns-tz@2.0.1";
import {
	addDays,
	addMonths,
	lastDayOfMonth,
	setDate,
	subMonths,
} from "https://esm.sh/date-fns@2.30.0";
import * as utils from "../utils.js";

/**
 * 請求タブのUI要素をまとめたオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	list: utils.dom.get("billing-list"),
};

/**
 * 「振替を記録する」ボタンがクリックされたときに呼び出されるコールバック関数。
 * @type {function}
 */
let onRecordPaymentClickCallback = () => {};

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
 */
export function init(onRecordPaymentClick) {
	onRecordPaymentClickCallback = onRecordPaymentClick;

	utils.dom.on(elements.list, "click", (e) => {
		if (e.target.classList.contains("record-payment-btn")) {
			onRecordPaymentClickCallback(e.target.dataset);
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
 * 取引日が締め日を過ぎている場合は翌月の締め日を返す。
 * @private
 * @param {Date} txDate - 取引日。
 * @param {number} closingDay - カードの締め日（1-31）。
 * @returns {Date} 計算された締め日のDateオブジェクト。
 */
function getClosingDateForTransaction(txDate, closingDay) {
	let targetDate = toDate(txDate, { timeZone: "Asia/Tokyo" });

	if (targetDate.getDate() > closingDay) {
		targetDate = addMonths(targetDate, 1);
	}

	return setDateSafe(targetDate, closingDay);
}

/**
 * 締め日に基づいて、支払日を計算する。
 * 支払い月のオフセット（翌月払い、翌々月払いなど）を考慮して日付を決定する。
 * @private
 * @param {Date} closingDate - 締め日。
 * @param {object} rule - クレジットカードの支払いルール。
 * @returns {Date} 計算された支払日のDateオブジェクト。
 */
function getPaymentDate(closingDate, rule) {
	// 締め月から Nヶ月後 を計算 (addMonthsは年末年始も自動計算)
	const targetDate = addMonths(closingDate, rule.paymentMonthOffset);

	return setDateSafe(targetDate, rule.paymentDay);
}

/**
 * 締め日に基づいて、請求期間の文字列を生成する。
 * ユーザーに分かりやすい形式（例: "10月1日 〜 10月31日"）で期間を表示する。
 * @private
 * @param {Date} closingDate - 締め日。
 * @param {object} rule - クレジットカードの支払いルール。
 * @returns {string} フォーマットされた請求期間の文字列。
 */
function getBillingPeriod(closingDate, rule) {
	const fmtOpts = { year: "numeric", month: "long", day: "numeric" };
	const end = closingDate.toLocaleDateString("ja-JP", fmtOpts);

	let startDate;
	if (rule.closingDay >= 31) {
		startDate = new Date(closingDate);
		startDate.setDate(1);
	} else {
		const prevClosingDate = subMonths(closingDate, 1);
		startDate = addDays(prevClosingDate, 1);
	}

	const start = startDate.toLocaleDateString("ja-JP", fmtOpts);
	return `${start} 〜 ${end}`;
}

/**
 * 未払いの請求情報を表示するカードUIを生成する。
 * 請求額、期間、支払日を表示し、振替記録ボタンを配置する。
 * @private
 * @param {string} cardId - 口座ID。
 * @param {string} cardName - 口座名。
 * @param {object} rule - クレジットカードの支払いルール。
 * @param {Date} closingDate - 締め日。
 * @param {number} amount - 請求額。
 * @param {string} icon - 口座のアイコンクラス。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @returns {HTMLElement} 生成されたカードのDOM要素。
 */
function createBillingCard(
	cardId,
	cardName,
	rule,
	closingDate,
	amount,
	icon,
	isMasked
) {
	const cardDiv = document.createElement("div");
	cardDiv.className =
		"bg-white p-4 rounded-lg shadow-sm border flex flex-col md:flex-row items-start md:items-center gap-4";
	const paymentDate = getPaymentDate(closingDate, rule);
	const billingPeriod = getBillingPeriod(closingDate, rule);
	const paymentDateStr = utils.toYYYYMMDD(paymentDate);
	const iconClass = icon || "fas fa-credit-card";

	utils.dom.setHtml(
		cardDiv,
		`
        <div class="flex-grow">
            <div class="flex items-center gap-3 mb-2">
                <i class="${iconClass} text-xl text-neutral-400 w-6 text-center"></i>
                <h3 class="font-bold text-lg text-neutral-800">${cardName}</h3>
            </div>
            <p class="text-sm text-neutral-600">請求期間: ${billingPeriod}</p>
            <p class="text-sm text-neutral-600">支払予定日: ${paymentDate.toLocaleDateString(
							"ja-JP"
						)}</p>
        </div>
        <div class="text-left md:text-right w-full md:w-auto">
            <p class="text-sm text-neutral-600">請求額</p>
            <p class="font-bold text-2xl text-danger mb-3">${utils.formatCurrency(
							amount,
							isMasked
						)}</p>
            <button class="record-payment-btn w-full md:w-auto bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-dark transition shadow-md">
                <i class="fas fa-money-bill-wave mr-2"></i>振替を記録する
            </button>
        </div>
		`
	);

	const button = cardDiv.querySelector(".record-payment-btn");
	button.dataset.toAccountId = cardId;
	button.dataset.cardName = cardName;
	button.dataset.amount = amount;
	button.dataset.paymentDate = paymentDateStr;
	button.dataset.defaultAccountId = rule.defaultPaymentAccountId;
	button.dataset.closingDate = closingDate.toLocaleDateString("ja-JP", {
		month: "long",
		day: "numeric",
	});
	button.dataset.closingDateStr = utils.toYYYYMMDD(closingDate);
	return cardDiv;
}

/**
 * 全取引データとカードルールから、未払いの請求を計算してリストアップする。
 * 締め日ごとに取引を集計し、既に支払い済みのサイクルを除外する。
 * @param {Array<object>} allTransactions - 全期間の取引データ。
 * @param {object} creditCardRules - 全クレジットカードの支払いルール。
 * @returns {Array<object>} 未払い請求オブジェクトの配列。
 */
export function calculateBills(allTransactions, creditCardRules) {
	const unpaidBills = [];
	const liabilityAccounts = [...appLuts.accounts.values()].filter(
		(acc) => acc.type === "liability" && !acc.isDeleted
	);

	for (const card of liabilityAccounts) {
		const rule = creditCardRules[card.id];
		if (!rule) continue;

		const expenses = allTransactions.filter(
			(t) => t.accountId === card.id && t.type === "expense"
		);
		if (expenses.length === 0) continue;

		const billsByCycle = {}; // { "YYYY-MM-DD": { amount: 123, ... } }

		for (const t of expenses) {
			// 1. 各取引が属する締め日を計算する
			const closingDate = getClosingDateForTransaction(t.date, rule.closingDay);
			const closingDateStr = utils.toYYYYMMDD(closingDate);

			// 2. 支払い済みとして記録されたサイクルより前の取引は無視する
			if (rule.lastPaidCycle && closingDateStr <= rule.lastPaidCycle) {
				continue;
			}

			// 3. 締め日ごとに取引を集計する
			if (!billsByCycle[closingDateStr]) {
				billsByCycle[closingDateStr] = {
					cardId: card.id,
					cardName: card.name,
					rule: rule,
					closingDate: closingDate,
					amount: 0,
					icon: card.icon || "fas fa-credit-card",
					order: card.order || 0,
				};
			}
			billsByCycle[closingDateStr].amount += t.amount;
		}

		// 集計した結果を未払い請求リストに追加する
		unpaidBills.push(...Object.values(billsByCycle));
	}

	return unpaidBills.sort(
		(a, b) => a.order - b.order || a.closingDate - b.closingDate
	);
}

/**
 * 未払いの請求リストを画面に描画する。
 * 計算された請求情報を元にカード要素を生成し、リストに追加する。
 * @param {Array<object>} allTransactions - 全期間の取引データ。
 * @param {object} creditCardRules - 全クレジットカードの支払いルール。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 */
export function render(allTransactions, creditCardRules, isMasked, luts) {
	appLuts = luts;
	const unpaidBills = calculateBills(allTransactions, creditCardRules);

	utils.dom.setHtml(elements.list, "");
	if (unpaidBills.length === 0) {
		utils.dom.setHtml(
			elements.list,
			`<p class="text-center text-neutral-400 py-4">未払いの請求はありません。</p>`
		);
		return;
	}
	unpaidBills.forEach((bill) => {
		elements.list.appendChild(
			createBillingCard(
				bill.cardId,
				bill.cardName,
				bill.rule,
				bill.closingDate,
				bill.amount,
				bill.icon,
				isMasked
			)
		);
	});
}
