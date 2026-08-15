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
 * `Transaction.date` を文字列（`yyyy-MM-dd`）に正規化するヘルパー。
 */
const toDateString = (d: Transaction["date"]): string => {
	if (typeof d === "string") return d;
	if (d instanceof Date) return utils.toYYYYMMDD(d);
	if (d && typeof (d as { toDate?: unknown }).toDate === "function") {
		return utils.toYYYYMMDD(
			(d as { toDate: () => Date }).toDate(),
		);
	}
	return utils.toYYYYMMDD(new Date());
};

/**
 * UI 表示用に `Transaction` を正規化する。
 */
const toOutput = (t: Transaction): TransactionOutput => ({
	id: t.id ?? "",
	type: t.type,
	date: toDateString(t.date),
	amount: typeof t.amount === "string" ? Number(t.amount) : t.amount,
	description: t.description ?? "",
	memo: t.memo,
	categoryId: t.categoryId ?? "",
	fromAccountId: t.fromAccountId ?? "",
	toAccountId: t.toAccountId,
	metadata: t.metadata,
});

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
	const displayStartDate = utils.getStartOfMonthAgo(displayMonths);

	// 表示期間内のトランザクションを抽出する。
	const visible: Transaction[] = transactions.filter((t) => {
		if (!t?.date) return false;
		const d = new Date(t.date as string | number | Date);
		return (
			!isNaN(d.getTime()) &&
			d >= displayStartDate
		);
	});

	const analysisTarget: Transaction[] = ((
		_targetTransactions: Transaction[],
		filter: string,
	) => {
		if (filter === "all-time") return transactions;
		const [year, month] = filter.split("-").map(Number);
		return transactions.filter((t) => {
			const yyyymm = utils.toYYYYMM(
				new Date(t.date as string | number | Date),
			);
			const [tYear, tMonth] = yyyymm.split("-").map(Number);
			return tYear === year && tMonth === month;
		});
	})(visible, analysisMonth || "all-time");

	let currentNetWorth: number = Object.values(
		accountBalances || {},
	).reduce(
		(sum: number, val: unknown) => sum + (val as number),
		0,
	);
	const historicalData: DashboardHistoryEntry[] = [];
	const currentMonth = utils.toYYYYMM(new Date());

	// クライアントサイドで月次集計を行う。
	const statsMap = new Map<
		string,
		{ income: number; expense: number }
	>();
	for (const t of transactions) {
		if (!t?.date) continue;
		const m = utils.toYYYYMM(new Date(t.date as string | number | Date));
		if (!statsMap.has(m)) statsMap.set(m, { income: 0, expense: 0 });
		const s = statsMap.get(m);
		if (!s) continue;
		if (t.type === "income") s.income += Number(t.amount);
		else if (t.type === "expense") s.expense += Number(t.amount);
	}

	// 表示期間内の月リストを生成する（現在から過去へ）。
	const monthsSet = new Set<string>(statsMap.keys());
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
	let filteredHistory: DashboardHistoryEntry[] = reversedData.filter(
		(e) => e.month >= startMonthStr,
	);

	// 未来の月でデータがない（収支ゼロ）場合は、グラフ表示から除外する。
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

	// --- 日次推移データの計算 (Interactive Asset Cockpit用) ---
	const calculateDailyHistory = (
		targetAccountId: string | null = null,
	): DashboardDailyEntry[] => {
		const dailyData: DashboardDailyEntry[] = [];
		// 表示開始日から今日までの日付リストを生成
		const dates: string[] = [];
		let dIter = new Date(displayStartDate);
		const today = new Date();
		while (dIter <= today) {
			dates.push(utils.toYYYYMMDD(dIter));
			dIter.setDate(dIter.getDate() + 1);
		}

		// 現在の残高を取得
		let currentBalance = 0;
		if (targetAccountId) {
			currentBalance = accountBalances?.[targetAccountId] || 0;
		} else {
			// 全資産 (純資産)
			currentBalance = Object.values(accountBalances || {}).reduce(
				(sum: number, val: unknown) => sum + (val as number),
				0,
			);
		}

		// 逆順で計算するために日付を反転
		const sortedDates = [...dates].reverse();
		let runningBalance = currentBalance;

		// トランザクションを日付でマップ化 (高速化のため)
		const txMap = new Map<string, Transaction[]>();
		transactions.forEach((t) => {
			if (!t?.date) return;
			const dateStr = utils.toYYYYMMDD(
				new Date(t.date as string | number | Date),
			);
			if (!txMap.has(dateStr)) txMap.set(dateStr, []);
			txMap.get(dateStr)?.push(t);
		});

		for (const dateStr of sortedDates) {
			dailyData.push({ date: dateStr, value: runningBalance });

			const daysTxns = txMap.get(dateStr) || [];
			for (const t of daysTxns) {
				// 過去に戻るため、収支を逆算する
				// 対象口座が指定されている場合は、その口座に関連する取引のみ計算
				// 指定なし(Total)の場合は、振替は無視し、収入/支出のみ計算
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
		return dailyData.reverse();
	};

	// クレジットカードの請求計算に必要な期間を算出し、データ不足を判定する。
	const getBillingNeededMonths = (): number => {
		const rules = (config?.creditCardRules as
			| Record<string, { paymentMonthOffset?: number }>
			| undefined) || {};
		let maxOffset = 0;
		for (const rule of Object.values(rules)) {
			const offset = (rule?.paymentMonthOffset || 0) + 2;
			if (offset > maxOffset) maxOffset = offset;
		}
		return Math.max(maxOffset, 3);
	};
	const neededMonths = getBillingNeededMonths();
	const dataInsufficient = neededMonths > displayMonths;

	const getAvailable = (txs: Transaction[]): string[] => {
		const s = new Set(
			txs.map((t) =>
				utils.toYYYYMM(new Date(t.date as string | number | Date)),
			),
		);
		return Array.from(s).sort().reverse();
	};

	return {
		displayHistoricalData: filteredHistory,
		dailyTotalHistory: calculateDailyHistory(null),
		getAccountHistory: calculateDailyHistory,
		visibleTransactions: visible.map(toOutput),
		analysisTargetTransactions: analysisTarget.map(toOutput),
		isDataInsufficient: dataInsufficient,
		availableMonths: getAvailable(transactions),
	};
}
