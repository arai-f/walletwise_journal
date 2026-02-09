import {
	faCheckCircle,
	faCreditCard,
	faExclamationTriangle,
	faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	addDays,
	addMonths,
	lastDayOfMonth,
	setDate,
	subMonths,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import * as utils from "../utils.js";
import NoDataState from "./ui/NoDataState";

/**
 * 指定した月の日付を安全に設定するヘルパー関数。
 * 月末日を超えてしまう場合（例: 2月30日）は、その月の最終日に補正する。
 * @param {Date} date - 操作対象の日付オブジェクト。
 * @param {number} day - 設定したい日（1-31）。
 * @returns {Date} 日付設定後の新しいDateオブジェクト。
 */
const setDateSafe = (date, day) => {
	const lastDay = lastDayOfMonth(date).getDate();
	return setDate(date, Math.min(day, lastDay));
};

/**
 * 取引日と締め日から、その取引が属する請求サイクルの締め日を計算する。
 * 例: 締め日が25日の場合、10/20の取引の締め日は10/25。10/26の取引の締め日は11/25。
 * @param {Date} txDate - 取引日。
 * @param {number} closingDay - クレジットカードの締め日。
 * @returns {Date} 計算された締め日（Asia/Tokyo タイムゾーン考慮済み）。
 */
function getClosingDateForTransaction(txDate, closingDay) {
	const txDateStr = utils.toYYYYMMDD(txDate);
	const [y, m, d] = txDateStr.split("-").map(Number);
	let targetDate = new Date(y, m - 1, d);

	if (targetDate.getDate() > closingDay) {
		targetDate = addMonths(targetDate, 1);
	}

	targetDate = setDateSafe(targetDate, closingDay);
	return fromZonedTime(targetDate, "Asia/Tokyo");
}

/**
 * 締め日と支払ルールに基づいて確定の支払日（引き落とし日）を計算する。
 * @param {Date} closingDate - 締め日。
 * @param {object} rule - クレジットカード設定ルール。
 * @param {number} rule.paymentMonthOffset - 支払月オフセット（翌月なら1、翌々月なら2）。
 * @param {number} rule.paymentDay - 支払日。
 * @returns {Date} 計算された支払日。
 */
export function getPaymentDate(closingDate, rule) {
	let targetDate = toZonedTime(closingDate, "Asia/Tokyo");
	targetDate = addMonths(targetDate, rule.paymentMonthOffset);
	targetDate = setDateSafe(targetDate, rule.paymentDay);
	return fromZonedTime(targetDate, "Asia/Tokyo");
}

/**
 * 請求期間の表示用文字列（YYYY年M月D日 〜 YYYY年M月D日）を生成する。
 * @param {Date} closingDate - 締め日。
 * @param {object} rule - クレジットカード設定ルール。
 * @param {number} rule.closingDay - 締め日。
 * @returns {string} フォーマットされた請求期間文字列。
 */
function getBillingPeriod(closingDate, rule) {
	const endLocal = toZonedTime(closingDate, "Asia/Tokyo");
	let startLocal;

	if (rule.closingDay >= 31) {
		startLocal = new Date(endLocal);
		startLocal.setDate(1);
	} else {
		const prevClosingDate = subMonths(endLocal, 1);
		startLocal = addDays(prevClosingDate, 1);
	}

	const startTimestamp = fromZonedTime(startLocal, "Asia/Tokyo");
	const endTimestamp = fromZonedTime(endLocal, "Asia/Tokyo");

	const fmt = "yyyy年M月d日";
	const startStr = formatInTimeZone(startTimestamp, "Asia/Tokyo", fmt);
	const endStr = formatInTimeZone(endTimestamp, "Asia/Tokyo", fmt);

	return `${startStr} 〜 ${endStr}`;
}

/**
 * 全ての取引履歴とカード設定に基づいて、全ての請求データを計算する。
 * 支払い済みかどうかの判定は行わず、発生した全ての請求をリストアップする。
 * @param {Array} allTransactions - 全取引リスト。
 * @param {object} creditCardRules - クレジットカード設定ルールのマップ。
 * @param {Map} accountsMap - 口座情報のマップ。
 * @returns {Array} 請求オブジェクトのリスト（日付順・表示順でソート済み）。
 */
function calculateAllBills(allTransactions, creditCardRules, accountsMap) {
	const allBills = [];
	const liabilityAccounts = [...accountsMap.values()].filter(
		(acc) => acc.type === "liability" && !acc.isDeleted,
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

		const billsByCycle = {};

		for (const t of expenses) {
			const closingDate = getClosingDateForTransaction(t.date, rule.closingDay);
			const closingDateStr = utils.toYYYYMMDD(closingDate);

			if (!billsByCycle[closingDateStr]) {
				billsByCycle[closingDateStr] = {
					cardId: card.id,
					cardName: card.name,
					rule: rule,
					closingDate: closingDate,
					closingDateStr: closingDateStr,
					amount: 0,
					icon: card.icon,
					order: card.order || 0,
				};
			}
			billsByCycle[closingDateStr].amount += t.amount;
		}
		allBills.push(...Object.values(billsByCycle));
	}

	return allBills.sort(
		(a, b) => a.order - b.order || a.closingDate - b.closingDate,
	);
}

/**
 * クレジットカード請求一覧表示コンポーネント。
 * 未払いの請求を検出し、カードごとにまとめて表示する。
 * 支払いを記録するための機能も提供する。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {Array} props.transactions - 取引履歴リスト。
 * @param {object} props.creditCardRules - カード設定ルール。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {object} props.luts - 検索テーブル（口座情報など）。
 * @param {boolean} props.isDataInsufficient - データ期間不足警告フラグ。
 * @param {Function} props.onRecordPayment - 支払い記録実行時のコールバック。
 * @param {Function} props.onOpenSettings - 設定画面オープン時のコールバック。
 * @returns {JSX.Element} 請求一覧コンポーネント。
 */
export default function BillingList({
	transactions,
	creditCardRules,
	isMasked,
	luts,
	isDataInsufficient,
	onRecordPayment,
	onOpenSettings,
}) {
	// 請求データの計算。
	const allBills = calculateAllBills(
		transactions,
		creditCardRules,
		luts.accounts,
	);

	// 支払い済み金額の計算。
	const paidAmounts = new Map();
	transactions.forEach((tx) => {
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

	// 未払い/残額のある請求のみをフィルタリングする。
	const unpaidBills = allBills.filter((bill) => {
		const key = `${bill.cardId}_${bill.closingDateStr}`;
		const paidAmount = paidAmounts.get(key) || 0;
		bill.paidAmount = paidAmount;
		bill.remainingAmount = bill.amount - paidAmount;
		return bill.remainingAmount > 0;
	});

	const handleRecordPayment = (bill) => {
		const paymentDate = getPaymentDate(bill.closingDate, bill.rule);
		const closingDateStr = utils.toYYYYMMDD(bill.closingDate);
		const paymentDateStr = utils.toYYYYMMDD(paymentDate);

		onRecordPayment({
			toAccountId: bill.cardId,
			cardName: bill.cardName,
			amount: bill.remainingAmount,
			paymentDate: paymentDate,
			paymentDateStr: paymentDateStr,
			defaultAccountId: bill.rule.defaultPaymentAccountId,
			closingDate: bill.closingDate,
			closingDateStr: closingDateStr,
			formattedClosingDate: formatInTimeZone(
				bill.closingDate,
				"Asia/Tokyo",
				"M月d日",
			),
		});
	};

	// アイコン文字列をオブジェクトに変換するヘルパー
	const getIcon = (iconStr) => {
		if (!iconStr) return faCreditCard;
		if (iconStr.includes("wallet")) return faWallet;
		return faCreditCard;
	};

	return (
		<div className="space-y-4">
			{isDataInsufficient && (
				<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 flex justify-between items-center fade-in">
					<div className="flex items-center">
						<FontAwesomeIcon
							icon={faExclamationTriangle}
							className="text-yellow-500 mr-3"
						/>
						<div>
							<p className="text-sm text-yellow-700 font-bold">
								表示期間が短いため、一部の請求が表示されていない可能性があります。
							</p>
							<p className="text-xs text-yellow-600">
								正確な請求管理を行うには、設定から表示期間を長くしてください。
							</p>
						</div>
					</div>
					<button
						onClick={onOpenSettings}
						className="text-sm bg-white border border-yellow-400 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-100 transition"
					>
						設定を変更
					</button>
				</div>
			)}

			{unpaidBills.length === 0 ? (
				<NoDataState
					message="未払いの請求はありません"
					icon={faCheckCircle}
					className="py-8 fade-in"
				/>
			) : (
				unpaidBills.map((bill) => {
					const paymentDate = getPaymentDate(bill.closingDate, bill.rule);
					const billingPeriod = getBillingPeriod(bill.closingDate, bill.rule);
					const paymentDateDisplay = formatInTimeZone(
						paymentDate,
						"Asia/Tokyo",
						"yyyy年M月d日",
					);

					// 一意なキーを生成する。
					const key = `${bill.cardId}-${bill.closingDateStr}`;

					return (
						<div
							key={key}
							className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 fade-in-up"
						>
							<div className="grow">
								<div className="flex items-center gap-3 mb-2">
									<FontAwesomeIcon
										icon={getIcon(bill.icon)}
										className="text-xl text-neutral-400 w-6 text-center"
									/>
									<h3 className="font-bold text-lg text-neutral-800">
										{bill.cardName}
									</h3>
								</div>
								<p className="text-sm text-neutral-600">
									請求期間: {billingPeriod}
								</p>
								<p className="text-sm text-neutral-600">
									支払予定日: {paymentDateDisplay}
								</p>
							</div>

							<div className="w-full md:w-auto flex flex-col items-end">
								<div className="text-right">
									{bill.paidAmount > 0 ? (
										<>
											<p className="text-xs text-neutral-500">
												請求総額: {utils.formatCurrency(bill.amount, isMasked)}
											</p>
											<p className="text-xs text-success">
												支払済:{" "}
												{utils.formatCurrency(bill.paidAmount, isMasked)}
											</p>
											<p className="text-sm text-neutral-600 mt-1">
												残り支払額
											</p>
										</>
									) : (
										<p className="text-sm text-neutral-600">請求額</p>
									)}
									<p className="font-bold text-2xl text-danger mb-3">
										{utils.formatCurrency(bill.remainingAmount, isMasked)}
									</p>
								</div>
								<button
									onClick={() => handleRecordPayment(bill)}
									className="w-full md:w-auto bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-dark transition shadow-md"
								>
									<FontAwesomeIcon icon={faCreditCard} className="mr-2" />
									振替を記録する
								</button>
							</div>
						</div>
					);
				})
			)}
		</div>
	);
}
