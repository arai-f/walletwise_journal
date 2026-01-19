import { useMemo } from "react";
import * as utils from "../utils.js";

/**
 * ダッシュボード表示用のデータを計算・整形するカスタムフック。
 * 資産推移、表示用トランザクション、分析対象データなどを生成する。
 * @param {Object} params - パラメータオブジェクト。
 * @param {Object} params.config - アプリケーション設定。
 * @param {Array} params.transactions - 全トランザクションリスト。
 * @param {Object} params.accountBalances - 口座残高マップ。
 * @param {string} params.analysisMonth - 分析対象月フィルタ。
 * @returns {Object} ダッシュボード表示用データを含むオブジェクト。
 * @property {Array} displayHistoricalData - 資産推移グラフ用の履歴データ。
 * @property {Array} visibleTransactions - 表示期間内の全トランザクション。
 * @property {Array} analysisTargetTransactions - 分析レポート用の対象トランザクション。
 * @property {boolean} isDataInsufficient - クレジットカード請求計算に必要なデータ期間が不足しているかどうかのフラグ。
 * @property {Array<string>} availableMonths - 利用可能な月のリスト。
 */
export function useDashboardData({
	config,
	transactions,
	accountBalances,
	analysisMonth,
}) {
	return useMemo(() => {
		const displayMonths = config?.displayPeriod || 3;
		const displayStartDate = utils.getStartOfMonthAgo(displayMonths);

		// 表示期間内のトランザクションを抽出する。
		const visible = transactions.filter((t) => t.date >= displayStartDate);

		const analysisTarget = ((transactions, filter) => {
			if (filter === "all-time") return transactions;
			const [year, month] = filter.split("-").map(Number);
			return transactions.filter((t) => {
				const yyyymm = utils.toYYYYMM(t.date);
				const [tYear, tMonth] = yyyymm.split("-").map(Number);
				return tYear === year && tMonth === month;
			});
		})(visible, analysisMonth || "all-time");

		let currentNetWorth = Object.values(accountBalances || {}).reduce(
			(sum, val) => sum + val,
			0,
		);
		const historicalData = [];
		const currentMonth = utils.toYYYYMM(new Date());

		// クライアントサイドで月次集計を行う。
		const statsMap = new Map();
		for (const t of transactions) {
			const m = utils.toYYYYMM(t.date);
			if (!statsMap.has(m)) statsMap.set(m, { income: 0, expense: 0 });
			const s = statsMap.get(m);
			if (t.type === "income") s.income += t.amount;
			else if (t.type === "expense") s.expense += t.amount;
		}

		// 表示期間内の月リストを生成する（現在から過去へ）。
		const monthsSet = new Set(statsMap.keys());
		let d = new Date(displayStartDate);
		const now = new Date();
		while (d <= now) {
			monthsSet.add(utils.toYYYYMM(d));
			d.setMonth(d.getMonth() + 1);
		}
		const sortedMonths = Array.from(monthsSet).sort().reverse();

		// 現在の残高から過去に遡って、各月の終了時点での資産額を計算する。
		for (const month of sortedMonths) {
			const stat = statsMap.get(month) || { income: 0, expense: 0 };
			const netChange = stat.income - stat.expense;
			historicalData.push({
				month,
				netWorth: currentNetWorth,
				income: stat.income,
				expense: stat.expense,
				isFuture: month > currentMonth,
			});
			currentNetWorth -= netChange;
		}

		const reversedData = historicalData.reverse();
		const startMonthStr = utils.toYYYYMM(displayStartDate);
		let filteredHistory = reversedData.filter((d) => d.month >= startMonthStr);

		// 未来の月でデータがない（収支ゼロ）場合は、グラフ表示から除外する。
		while (filteredHistory.length > 0) {
			const lastRecord = filteredHistory[filteredHistory.length - 1];
			if (
				lastRecord.isFuture &&
				lastRecord.income === 0 &&
				lastRecord.expense === 0
			) {
				filteredHistory.pop();
			} else {
				break;
			}
		}

		// クレジットカードの請求計算に必要な期間を算出し、データ不足を判定する。
		const getBillingNeededMonths = () => {
			const rules = config?.creditCardRules || {};
			let maxOffset = 0;
			for (const rule of Object.values(rules)) {
				const offset = (rule.paymentMonthOffset || 0) + 2;
				if (offset > maxOffset) maxOffset = offset;
			}
			return Math.max(maxOffset, 3);
		};
		const neededMonths = getBillingNeededMonths();
		const dataInsufficient = neededMonths > displayMonths;

		const getAvailable = (txs) => {
			if (utils.getAvailableMonths) return utils.getAvailableMonths(txs);
			const s = new Set(txs.map((t) => utils.toYYYYMM(t.date)));
			return Array.from(s).sort().reverse();
		};

		return {
			displayHistoricalData: filteredHistory,
			visibleTransactions: visible,
			analysisTargetTransactions: analysisTarget,
			isDataInsufficient: dataInsufficient,
			availableMonths: getAvailable(transactions),
		};
	}, [config, transactions, accountBalances, analysisMonth]);
}
