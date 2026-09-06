import { useMemo } from "react";
import type {
    AccountBalances,
    DashboardDailyEntry,
    DashboardData,
    DashboardHistoryEntry,
    Transaction,
    TransactionOutput,
} from "../types/hooks.js";
import type { AppConfig } from "../types/settings.js";
import * as utils from "../utils.js";

/**
 * `useDashboardData` の引数オブジェクト。
 */
export interface UseDashboardDataParams {
	/** アプリケーション設定。 */
	config?: AppConfig | Record<string, unknown>;
	/** 全トランザクションリスト。 */
	transactions: Transaction[];
	/** 口座残高マップ。 */
	accountBalances?: AccountBalances;
	/** 分析対象月フィルタ。 */
	analysisMonth?: string;
}

/**
 * UI 表示用に `Transaction` を正規化するヘルパー。
 */
const toOutput = (t: Transaction): TransactionOutput => {
	// すでに正規化済み（dateが文字列）の場合はそのまま利用
	if (typeof t.date === "string" && typeof t.amount === "number") {
		return t as unknown as TransactionOutput;
	}
	let dateStr = "";
	if (typeof t.date === "string") {
		dateStr = t.date;
	} else if (t.date instanceof Date) {
		dateStr = utils.toYYYYMMDD(t.date);
	} else if (t.date && typeof (t.date as { toDate?: unknown }).toDate === "function") {
		dateStr = utils.toYYYYMMDD((t.date as { toDate: () => Date }).toDate());
	} else {
		dateStr = utils.toYYYYMMDD(new Date());
	}
	return {
		id: t.id ?? "",
		type: t.type,
		date: dateStr,
		amount: typeof t.amount === "string" ? Number(t.amount) : t.amount,
		description: t.description ?? "",
		memo: t.memo,
		categoryId: t.categoryId ?? "",
		fromAccountId: t.fromAccountId ?? "",
		toAccountId: t.toAccountId,
		metadata: t.metadata,
	};
};

/**
 * ダッシュボード表示用のデータを計算・整形するカスタムフック。
 * 資産推移、表示用トランザクション、分析対象データなどを生成する。
 * @param {UseDashboardDataParams} params - パラメータオブジェクト。
 * @returns {DashboardData} ダッシュボード表示用データを含むオブジェクト。
 */
export function useDashboardData({
	config,
	transactions,
	accountBalances,
	analysisMonth,
}: UseDashboardDataParams): DashboardData {
	const displayMonths =
		(config?.displayPeriod as number | undefined) || 3;

	return useMemo(() => {
		const displayStartDate = utils.getStartOfMonthAgo(displayMonths);
		const startMonthStr = utils.toYYYYMM(displayStartDate);
		const currentMonth = utils.toYYYYMM(new Date());

		// 表示期間内のトランザクションを抽出
		const visible: Transaction[] = [];
		const txMap = new Map<string, Transaction[]>();
		const statsMap = new Map<string, { income: number; expense: number }>();

		for (let i = 0; i < transactions.length; i++) {
			const t = transactions[i];
			if (!t?.date) continue;
			const d = new Date(t.date as string | number | Date);
			if (isNaN(d.getTime())) continue;

			if (d >= displayStartDate) {
				visible.push(t);
			}

			// 日次集計用マップ
			const dateStr = utils.toYYYYMMDD(d);
			let dayList = txMap.get(dateStr);
			if (!dayList) {
				dayList = [];
				txMap.set(dateStr, dayList);
			}
			dayList.push(t);

			// 月次集計
			const m = utils.toYYYYMM(d);
			let s = statsMap.get(m);
			if (!s) {
				s = { income: 0, expense: 0 };
				statsMap.set(m, s);
			}
			if (t.type === "income") s.income += Number(t.amount);
			else if (t.type === "expense") s.expense += Number(t.amount);
		}

		// 分析対象トランザクションの抽出
		const filter = analysisMonth || "all-time";
		let analysisTarget: Transaction[];
		if (filter === "all-time") {
			analysisTarget = transactions;
		} else {
			const [year, month] = filter.split("-").map(Number);
			analysisTarget = transactions.filter((t) => {
				const yyyymm = utils.toYYYYMM(new Date(t.date as string | number | Date));
				const [tYear, tMonth] = yyyymm.split("-").map(Number);
				return tYear === year && tMonth === month;
			});
		}

		// 月次資産推移の計算
		let currentNetWorth = Object.values(accountBalances || {}).reduce(
			(sum: number, val: unknown) => sum + (val as number),
			0,
		);

		const monthsSet = new Set<string>(statsMap.keys());
		let d = new Date(displayStartDate);
		const now = new Date();
		while (d <= now) {
			monthsSet.add(utils.toYYYYMM(d));
			d.setMonth(d.getMonth() + 1);
		}
		const sortedMonths = Array.from(monthsSet).sort().reverse();

		const historicalData: DashboardHistoryEntry[] = [];
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
		const filteredHistory: DashboardHistoryEntry[] = reversedData.filter(
			(e) => e.month >= startMonthStr,
		);

		while (filteredHistory.length > 0) {
			const lastRecord = filteredHistory[filteredHistory.length - 1];
			if (
				lastRecord &&
				lastRecord.isFuture &&
				lastRecord.income === 0 &&
				lastRecord.expense === 0
			) {
				filteredHistory.pop();
			} else {
				break;
			}
		}

		// 日次推移の計算関数
		const calculateDailyHistory = (
			targetAccountId: string | null = null,
		): DashboardDailyEntry[] => {
			const today = new Date();
			const days =
				Math.floor(
					(today.getTime() - displayStartDate.getTime()) / 86_400_000,
				) + 1;
			const dailyData: DashboardDailyEntry[] = new Array(days);

			const dates: string[] = new Array<string>(days);
			const startMs = displayStartDate.getTime();
			for (let i = 0; i < days; i++) {
				dates[i] = utils.toYYYYMMDD(new Date(startMs + i * 86_400_000));
			}

			let currentBalance = 0;
			if (targetAccountId) {
				currentBalance = accountBalances?.[targetAccountId] || 0;
			} else {
				currentBalance = Object.values(accountBalances || {}).reduce(
					(sum: number, val: unknown) => sum + (val as number),
					0,
				);
			}

			let runningBalance = currentBalance;
			for (let i = days - 1; i >= 0; i--) {
				const dateStr = dates[i];
				dailyData[i] = { date: dateStr, value: runningBalance };

				const daysTxns = txMap.get(dateStr) || [];
				for (const t of daysTxns) {
					if (targetAccountId) {
						if (t.type === "transfer") {
							if (t.fromAccountId === targetAccountId) {
								runningBalance += Number(t.amount);
							} else if (t.toAccountId === targetAccountId) {
								runningBalance -= Number(t.amount);
							}
						} else if (t.fromAccountId === targetAccountId) {
							if (t.type === "income") {
								runningBalance -= Number(t.amount);
							} else if (t.type === "expense") {
								runningBalance += Number(t.amount);
							}
						}
					} else {
						if (t.type === "income") {
							runningBalance -= Number(t.amount);
						} else if (t.type === "expense") {
							runningBalance += Number(t.amount);
						}
					}
				}
			}
			return dailyData;
		};

		// クレジットカード請求期間判定
		const rules = (config?.creditCardRules as
			| Record<string, { paymentMonthOffset?: number }>
			| undefined) || {};
		let maxOffset = 0;
		for (const rule of Object.values(rules)) {
			const offset = (rule?.paymentMonthOffset || 0) + 2;
			if (offset > maxOffset) maxOffset = offset;
		}
		const neededMonths = Math.max(maxOffset, 3);
		const dataInsufficient = neededMonths > displayMonths;

		const monthsAvailable = Array.from(
			new Set(
				transactions
					.filter((t) => t?.date)
					.map((t) => utils.toYYYYMM(new Date(t.date as string | number | Date))),
			),
		).sort().reverse();

		return {
			displayHistoricalData: filteredHistory,
			dailyTotalHistory: calculateDailyHistory(null),
			getAccountHistory: calculateDailyHistory,
			visibleTransactions: visible.map(toOutput),
			analysisTargetTransactions: analysisTarget.map(toOutput),
			isDataInsufficient: dataInsufficient,
			availableMonths: monthsAvailable,
		};
	}, [config, transactions, accountBalances, analysisMonth, displayMonths]);
}
