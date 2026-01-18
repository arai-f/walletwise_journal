import { useMemo } from "react";
import * as utils from "../utils.js";

/**
 * ダッシュボード表示用のデータを計算・整形するカスタムフック。
 * 資産推移、表示用トランザクション、分析対象データなどを生成する。
 * @param {Object} params - パラメータオブジェクト。
 * @param {Object} params.config - アプリケーション設定。
 * @param {Array} params.transactions - 全トランザクションリスト。
 * @param {Object} params.accountBalances - 口座残高マップ。
 * @param {Array} params.monthlyStats - 月次統計データ。
 * @param {string} params.analysisMonth - 分析対象月フィルタ。
 * @returns {Object} ダッシュボード表示用データ。
 */
export function useDashboardData({
	config,
	transactions,
	accountBalances,
	monthlyStats,
	analysisMonth,
}) {
	return useMemo(() => {
		const displayMonths = config?.displayPeriod || 3;
		const displayStartDate = utils.getStartOfMonthAgo(displayMonths);

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
		const stats = [...(monthlyStats || [])];
		const currentMonth = utils.toYYYYMM(new Date());

		if (!stats.some((s) => s.month === currentMonth)) {
			const currentMonthData = {
				month: currentMonth,
				income: 0,
				expense: 0,
				netChange: 0,
			};
			const insertIndex = stats.findIndex((s) => s.month < currentMonth);
			if (insertIndex === -1) stats.push(currentMonthData);
			else stats.splice(insertIndex, 0, currentMonthData);
		}

		for (const stat of stats) {
			historicalData.push({
				month: stat.month,
				netWorth: currentNetWorth,
				income: stat.income || 0,
				expense: stat.expense || 0,
				isFuture: stat.month > currentMonth,
			});
			currentNetWorth -= stat.netChange || 0;
		}

		const reversedData = historicalData.reverse();
		const startMonthStr = utils.toYYYYMM(displayStartDate);
		let filteredHistory = reversedData.filter((d) => d.month >= startMonthStr);

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
	}, [config, transactions, accountBalances, monthlyStats, analysisMonth]);
}
