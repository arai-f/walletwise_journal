/**
 * AIアドバイザー機能に関するサービス群。
 * ユーザーの質問意図を解析して関連取引を抽出するローカル処理と、
 * Cloud Functions 経由で Gemini 等の LLM を呼び出す処理を担う。
 */
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "../firebase.js";
import type {
	AdvisorAnalysisPoint,
	AdvisorSuggestion,
	GetCategoryName,
	ProactiveForecast,
	ProactiveInsights,
} from "../types/hooks.js";
import * as utils from "../utils.js";

/**
 * `getRelevantTransactions` に渡す取引データの最小型。
 * Firestore から取得して JS 側で扱う際の共通形（`hooks.ts` の `Transaction`）
 * と互換にするため、`date` は `string | Date | Firestore Timestamp` を許容する。
 */
export type TransactionLike = {
	id?: string;
	type: "income" | "expense" | "transfer" | string;
	date: string | Date | { toDate: () => Date };
	amount: number | string;
	description?: string;
	memo?: string;
	categoryId?: string;
	[key: string]: unknown;
};

/**
 * `getRelevantTransactions` に渡すカテゴリデータの最小型。
 */
export type CategoryLike = {
	id?: string;
	name: string;
	type?: string;
	isDeleted?: boolean;
};

/**
 * `getRelevantTransactions` が返す集計統計情報。
 */
export interface RelevantTransactionsStats {
	/** 抽出データの支出合計。 */
	totalExpense: number;
	/** 抽出データの収入合計。 */
	totalIncome: number;
	/** 抽出データの振替合計。 */
	totalTransfer: number;
	/** 上位カテゴリの集計結果（カンマ区切り文字列）。 */
	topCategories: string;
}

/**
 * `getRelevantTransactions` の戻り値型。
 */
export interface RelevantTransactionsResult {
	/** 抽出された取引データの整形済みリスト文字列。 */
	list: string;
	/** 抽出条件を説明するラベル文字列。 */
	description: string;
	/** 抽出された取引件数。 */
	count: number;
	/** 最大件数を超えて切り捨てられたかどうか。 */
	isPartial: boolean;
	/** 抽出データの集計統計。 */
	stats: RelevantTransactionsStats;
}

/**
 * 日付データを安全に Date オブジェクトに変換するヘルパー。
 * Date インスタンス、Firestore Timestamp、文字列のいずれにも対応する。
 * 無効な日付の場合は null を返す。
 * @param dateVal - 変換対象の日付値。
 * @returns 変換後の Date オブジェクト。無効な場合は null。
 */
const parseDate = (dateVal: unknown): Date | null => {
	if (!dateVal) return null;
	const date =
		dateVal instanceof Date
			? dateVal
			: dateVal && typeof (dateVal as { toDate?: unknown }).toDate === "function"
				? (dateVal as { toDate: () => Date }).toDate()
				: new Date(dateVal as string | number | Date);
	return isNaN(date.getTime()) ? null : date;
};

/**
 * ユーザーの質問意図（日付、カテゴリ、種類、順序）を解析し、
 * 最も関連性の高い取引データを抽出する。
 * @param queryText - ユーザーの質問テキスト。
 * @param transactions - 全取引データ。
 * @param categories - カテゴリデータ（Map またはプレーンオブジェクト）。
 * @param getCategoryName - カテゴリ ID から名前を取得する関数。
 * @returns 抽出されたデータリストと説明、集計統計を含むオブジェクト。
 */
export function getRelevantTransactions(
	queryText: string,
	transactions: TransactionLike[] | null | undefined,
	categories:
		| Map<string, CategoryLike>
		| Record<string, CategoryLike>
		| null
		| undefined,
	getCategoryName: GetCategoryName,
): RelevantTransactionsResult {
	if (!transactions)
		return {
			list: "",
			description: "データなし",
			count: 0,
			isPartial: false,
			stats: {
				totalExpense: 0,
				totalIncome: 0,
				totalTransfer: 0,
				topCategories: "",
			},
		};

	let filtered: TransactionLike[] = [...transactions];
	const conditions: string[] = [];
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	// A. 日付解析 (相対・絶対)
	let dateFilterApplied = false;

	// "今月"
	if (queryText.includes("今月")) {
		filtered = filtered.filter((t) => {
			const d = parseDate(t.date);
			return (
				d &&
				d.getFullYear() === currentYear &&
				d.getMonth() + 1 === currentMonth
			);
		});
		conditions.push("今月");
		dateFilterApplied = true;
	}
	// "先月"
	else if (queryText.includes("先月")) {
		let targetYear = currentYear;
		let targetMonth = currentMonth - 1;
		if (targetMonth === 0) {
			targetMonth = 12;
			targetYear -= 1;
		}
		filtered = filtered.filter((t) => {
			const d = parseDate(t.date);
			return (
				d && d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth
			);
		});
		conditions.push("先月");
		dateFilterApplied = true;
	}
	// "今年"
	else if (queryText.includes("今年")) {
		filtered = filtered.filter((t) => {
			const d = parseDate(t.date);
			return d && d.getFullYear() === currentYear;
		});
		conditions.push("今年");
		dateFilterApplied = true;
	}
	// "去年" / "昨年"
	else if (queryText.includes("去年") || queryText.includes("昨年")) {
		filtered = filtered.filter((t) => {
			const d = parseDate(t.date);
			return d && d.getFullYear() === currentYear - 1;
		});
		conditions.push("去年");
		dateFilterApplied = true;
	}

	// 指定がない場合の "X月" (今年と仮定) / "20XX年" を処理する。
	if (!dateFilterApplied) {
		const yearMatch = queryText.match(/(\d{4})年/);
		const monthMatch = queryText.match(/(\d{1,2})月/);

		if (yearMatch) {
			const y = parseInt(yearMatch[1], 10);
			filtered = filtered.filter((t) => {
				const d = parseDate(t.date);
				return d && d.getFullYear() === y;
			});
			conditions.push(`${y}年`);
		}

		if (monthMatch) {
			const m = parseInt(monthMatch[1], 10);
			filtered = filtered.filter((t) => {
				const d = parseDate(t.date);
				return d && d.getMonth() + 1 === m;
			});
			conditions.push(`${m}月`);
		}
	}

	// B. 収支タイプ解析
	if (queryText.includes("収入")) {
		filtered = filtered.filter((t) => t.type === "income");
		conditions.push("収入のみ");
	} else if (queryText.includes("支出") || queryText.includes("出費")) {
		filtered = filtered.filter((t) => t.type === "expense");
		conditions.push("支出のみ");
	}

	// C. カテゴリ解析
	const cats: CategoryLike[] =
		categories instanceof Map
			? Array.from(categories.values())
			: categories
				? Object.values(categories)
				: [];
	const hitCat = cats.find((c) => queryText.includes(c.name));

	if (hitCat) {
		// ID検索 (簡易的に名前から再検索)。
		let targetCatId: string | null = null;
		if (categories instanceof Map) {
			for (const [id, c] of categories.entries()) {
				if (c.name === hitCat.name) {
					targetCatId = id;
					break;
				}
			}
		} else {
			for (const [id, c] of Object.entries(categories ?? {})) {
				if (c.name === hitCat.name) {
					targetCatId = id;
					break;
				}
			}
		}

		if (targetCatId) {
			filtered = filtered.filter((t) => t.categoryId === targetCatId);
			conditions.push(`カテゴリ「${hitCat.name}」`);
		}
	}

	// --- D. ソートと制限 ---
	// "高い", "最大", "一番" などがあれば金額順 (降順)
	const isHighAmountQuery =
		queryText.includes("高い") ||
		queryText.includes("高額") ||
		queryText.includes("最大") ||
		queryText.includes("一番");

	if (isHighAmountQuery) {
		filtered.sort((a, b) => Number(b.amount) - Number(a.amount));
		conditions.push("金額が高い順");
	} else {
		// デフォルトは日付順 (新しい順)
		filtered.sort((a, b) => {
			const da = parseDate(a.date);
			const db = parseDate(b.date);
			if (!da && !db) return 0;
			if (!da) return 1;
			if (!db) return -1;
			return db.getTime() - da.getTime();
		});
		if (conditions.length === 0) conditions.push("直近の取引");
	}

	// 抽出データの簡易集計を行う。
	const totalExpense = filtered
		.filter((t) => t.type === "expense")
		.reduce((sum, t) => sum + Number(t.amount), 0);
	const totalIncome = filtered
		.filter((t) => t.type === "income")
		.reduce((sum, t) => sum + Number(t.amount), 0);
	const totalTransfer = filtered
		.filter((t) => t.type === "transfer")
		.reduce((sum, t) => sum + Number(t.amount), 0);

	const categoryTotals: Record<string, number> = {};
	filtered
		.filter((t) => t.type === "expense")
		.forEach((t) => {
			const catName = getCategoryName(t.categoryId);
			categoryTotals[catName] =
				(categoryTotals[catName] || 0) + Number(t.amount);
		});
	const topCategories = Object.entries(categoryTotals)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([name, amount]) => `${name}: ¥${Math.round(amount)}`)
		.join(", ");

	// リスト生成 (最大70件)
	const sliced = filtered.slice(0, 70);
	const listStr = sliced
		.map((t) => {
			const amount = Number(t.amount);
			const catName = getCategoryName(t.categoryId);
			const d = parseDate(t.date);
			const dateShort = d
				? utils.toYYYYMMDD(d).substring(5).replace("-", "/")
				: "";
			const desc = t.description || t.memo || "";
			let typeMark = "(支)";
			if (t.type === "income") typeMark = "(収)";
			else if (t.type === "transfer") typeMark = "(振替)";

			return `${dateShort} ${typeMark} ${catName} ${desc} ¥${amount}`;
		})
		.join("\n");

	return {
		list: listStr,
		description: conditions.join(" かつ "),
		count: filtered.length,
		isPartial: filtered.length > 70,
		stats: {
			totalExpense,
			totalIncome,
			totalTransfer,
			topCategories,
		},
	};
}

/**
 * AIアドバイザー API が返すデータ型（最低限の構造）。
 * 旧呼び出し側との互換性のため、緩めに `Record<string, unknown>` を許容する。
 */
export type AdvisorResponseData = {
	adviceText?: string;
	alertLevel?: string;
	analysisPoints?: unknown;
	[key: string]: unknown;
};

/**
 * `callAdvisorApi` の戻り値型。
 * 元の `.js` 実装と同じく、レスポンスデータをそのまま返す。
 */
export type AdvisorApiResult = AdvisorResponseData | string | null | undefined;

/**
 * AIアドバイザーの API を呼び出して回答を取得する。
 * エラーハンドリングを一元化し、コンポーネントが扱いやすいエラーメッセージに変換する。
 * @param payload - 送信するデータペイロード。
 * @returns 解析済みレスポンスデータ。
 * @throws {Error} 通信エラーや安全フィルターによるブロック時にエラーを投げる。
 */
export async function callAdvisorApi(
	payload: Record<string, unknown>,
): Promise<AdvisorApiResult> {
	try {
		const askAdvisorFn = httpsCallable(functions, "askAdvisor");
		const result: HttpsCallableResult<unknown> = await askAdvisorFn(payload);

		// JSON応答を解析（テキスト形式の場合は自動で処理）
		const data = result.data;

		// レスポンスがすでにオブジェクトであれば返す
		if (typeof data === "object" && data !== null) {
			const obj = data as AdvisorResponseData;
			// もし期待したプロパティが無ければ、オブジェクト全体を文字列化してエラーを見えるようにする
			if (!obj.adviceText) {
				obj.adviceText = JSON.stringify(obj);
			}
			return obj;
		}

		// テキストの場合はJSON解析を試みる
		if (typeof data === "string") {
			try {
				const jsonData = JSON.parse(data) as AdvisorResponseData;
				return jsonData;
			} catch {
				// JSON解析失敗時は従来の形式で返す（後方互換性）
				return { adviceText: data.trim(), alertLevel: "safe" };
			}
		}

		return result.data as AdvisorApiResult;
	} catch (error) {
		console.error("[Advisor] API Error:", error);
		const err = error as { code?: string; message?: string };
		if (err.code === "functions/resource-exhausted") {
			throw new Error(err.message ?? "Quota exceeded");
		} else if (
			err.message &&
			(err.message === "SafetyBlock" || err.message.includes("SAFETY"))
		) {
			throw new Error(
				"申し訳ありませんが、その内容にはお答えできません。（安全フィルターによりブロックされました）",
			);
		}
		throw new Error("通信に失敗しました。もう一度お試しください。");
	}
}

/**
 * クライアント側で事前集計したプロアクティブ分析用ダイジェスト。
 */
export interface ProactiveDigestResult {
	/** キャッシュ判定用のシグネチャ文字列（日付＋件数＋収支合計＋最新日）。 */
	signature: string;
	/** 月末着地予測および先月比較の定量データ。 */
	forecast: ProactiveForecast;
	/** AIプロンプトに渡す構造化テキストブロック。 */
	promptSummary: string;
	/** 今月の上位支出カテゴリ配列。 */
	topCategories: Array<{ name: string; amount: number; prevAmount: number; diff: number }>;
	/** 先月比で増加が大きいカテゴリ配列。 */
	increasedCategories: Array<{ name: string; amount: number; prevAmount: number; diff: number }>;
	/** 先月比で減少（節約）できたカテゴリ配列。 */
	decreasedCategories: Array<{ name: string; amount: number; prevAmount: number; diff: number }>;
	/** 頻出する支出内容・店舗（2回以上）。 */
	frequentExpenses: Array<{ label: string; count: number; totalAmount: number; categoryName: string }>;
	/** 今月（または対象月）の最大支出取引。 */
	largestExpense: { description: string; amount: number; date: string; categoryName: string } | null;
}

/**
 * 全取引データからプロアクティブ・インサイト生成に必要な定量比較・月末予測・頻出傾向を算出する。
 * @param transactions - 全取引データ。
 * @param getCategoryName - カテゴリIDから名称を取得する関数。
 * @returns プロアクティブ集計結果。取引が空の場合は null。
 */
export function buildProactiveDigest(
	transactions: TransactionLike[] | null | undefined,
	getCategoryName: GetCategoryName,
): ProactiveDigestResult | null {
	if (!transactions || transactions.length === 0) return null;

	const now = new Date();
	const todayStr = utils.toYYYYMMDD(now);

	// 全取引の日付正規化と最新取引日の特定
	let latestTxDate: Date | null = null;
	let totalAllExpense = 0;
	let totalAllIncome = 0;

	const parsedTxs: Array<{
		tx: TransactionLike;
		date: Date;
		amount: number;
		year: number;
		month: number;
		day: number;
	}> = [];

	for (const tx of transactions) {
		const d = parseDate(tx.date);
		if (!d) continue;
		const amount = Number(tx.amount) || 0;
		if (tx.type === "expense") totalAllExpense += amount;
		else if (tx.type === "income") totalAllIncome += amount;

		if (!latestTxDate || d > latestTxDate) {
			latestTxDate = d;
		}
		parsedTxs.push({
			tx,
			date: d,
			amount,
			year: d.getFullYear(),
			month: d.getMonth() + 1,
			day: d.getDate(),
		});
	}

	if (parsedTxs.length === 0 || !latestTxDate) return null;

	// 今月の取引が1件以上あれば現在の年月を基準にし、月初等で今月分が0件の場合は最新取引のある月を基準にする
	const currentRealYear = now.getFullYear();
	const currentRealMonth = now.getMonth() + 1;
	const hasCurrentRealMonthTx = parsedTxs.some(
		(p) => p.year === currentRealYear && p.month === currentRealMonth,
	);

	const targetYear = hasCurrentRealMonthTx
		? currentRealYear
		: latestTxDate.getFullYear();
	const targetMonth = hasCurrentRealMonthTx
		? currentRealMonth
		: latestTxDate.getMonth() + 1;

	const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
	const elapsedDays = hasCurrentRealMonthTx
		? Math.max(1, now.getDate())
		: daysInTargetMonth;

	let prevYear = targetYear;
	let prevMonth = targetMonth - 1;
	if (prevMonth === 0) {
		prevMonth = 12;
		prevYear -= 1;
	}

	let twoMonthsAgoYear = prevYear;
	let twoMonthsAgoMonth = prevMonth - 1;
	if (twoMonthsAgoMonth === 0) {
		twoMonthsAgoMonth = 12;
		twoMonthsAgoYear -= 1;
	}

	// 固定費と判定するカテゴリ・摘要キーワード
	const FIXED_COST_KEYWORDS = [
		"住居",
		"家賃",
		"住宅",
		"管理費",
		"共益費",
		"ローン",
		"地代",
		"駐車場",
		"光熱",
		"水道",
		"電気",
		"ガス",
		"通信",
		"スマホ",
		"携帯",
		"インターネット",
		"Wi-Fi",
		"回線",
		"保険",
		"サブスク",
		"月額",
		"年会費",
		"税金",
		"年金",
		"健康保険",
		"住民税",
		"保育",
		"学費",
		"授業料",
		"習い事",
		"奨学金",
		"NHK",
		"定額",
	];

	const matchesFixedKeyword = (catName: string, desc: string): boolean => {
		const target = `${catName} ${desc}`;
		return FIXED_COST_KEYWORDS.some((kw) => target.includes(kw));
	};

	// 過去月（先月・先々月）で毎月ほぼ同額（±20%以内・1,000円以上）発生している定期支出ラベルを自動検出
	const prevLabelTotals: Record<string, { amount: number; count: number }> = {};
	const twoMonthsAgoLabelTotals: Record<
		string,
		{ amount: number; count: number }
	> = {};
	const monthlyIncomesByYM: Record<string, number> = {};

	for (const item of parsedTxs) {
		const { tx, amount, year, month } = item;
		const ym = `${year}-${String(month).padStart(2, "0")}`;
		if (tx.type === "income") {
			if (year !== targetYear || month !== targetMonth) {
				monthlyIncomesByYM[ym] = (monthlyIncomesByYM[ym] || 0) + amount;
			}
			continue;
		}
		if (tx.type !== "expense") continue;
		const catName = getCategoryName(tx.categoryId);
		const rawDesc = String(tx.description || tx.memo || catName).trim();
		const labelKey = `${catName}::${rawDesc.split(/[\s　(（]/)[0] || catName}`;

		if (year === prevYear && month === prevMonth) {
			if (!prevLabelTotals[labelKey]) {
				prevLabelTotals[labelKey] = { amount: 0, count: 0 };
			}
			prevLabelTotals[labelKey].amount += amount;
			prevLabelTotals[labelKey].count += 1;
		} else if (year === twoMonthsAgoYear && month === twoMonthsAgoMonth) {
			if (!twoMonthsAgoLabelTotals[labelKey]) {
				twoMonthsAgoLabelTotals[labelKey] = { amount: 0, count: 0 };
			}
			twoMonthsAgoLabelTotals[labelKey].amount += amount;
			twoMonthsAgoLabelTotals[labelKey].count += 1;
		}
	}

	const recurringLabelKeys = new Set<string>();
	for (const [key, prevStat] of Object.entries(prevLabelTotals)) {
		const olderStat = twoMonthsAgoLabelTotals[key];
		if (
			olderStat &&
			prevStat.count <= 2 &&
			olderStat.count <= 2 &&
			prevStat.amount >= 1000
		) {
			const ratio = prevStat.amount / olderStat.amount;
			if (ratio >= 0.8 && ratio <= 1.2) {
				recurringLabelKeys.add(key);
			}
		}
	}

	let currentMonthExpense = 0;
	let currentMonthIncome = 0;
	let lastMonthExpense = 0;
	let lastMonthIncome = 0;
	let lastMonthSameDayExpense = 0;

	let recordedFixedExpense = 0;
	let currentVariableExpense = 0;
	let lastMonthVariableExpense = 0;
	let lastMonthSameDayVariableExpense = 0;

	const currentFixedByCat: Record<string, number> = {};
	const prevFixedByCat: Record<string, number> = {};

	const currentCatTotals: Record<string, number> = {};
	const prevCatTotals: Record<string, number> = {};
	const merchantStats: Record<
		string,
		{ count: number; totalAmount: number; categoryName: string }
	> = {};
	let largestExpense: {
		description: string;
		amount: number;
		date: string;
		categoryName: string;
	} | null = null;

	for (const item of parsedTxs) {
		const { tx, date, amount, year, month, day } = item;
		const catName = getCategoryName(tx.categoryId);
		const rawDesc = String(tx.description || tx.memo || catName).trim();
		const normalizedLabel = rawDesc.split(/[\s　(（]/)[0] || catName;
		const labelKey = `${catName}::${normalizedLabel}`;
		const isFixed =
			matchesFixedKeyword(catName, rawDesc) || recurringLabelKeys.has(labelKey);

		if (year === targetYear && month === targetMonth) {
			if (tx.type === "expense") {
				currentMonthExpense += amount;
				currentCatTotals[catName] = (currentCatTotals[catName] || 0) + amount;

				if (isFixed) {
					recordedFixedExpense += amount;
					currentFixedByCat[catName] =
						(currentFixedByCat[catName] || 0) + amount;
				} else {
					currentVariableExpense += amount;
				}

				if (!merchantStats[normalizedLabel]) {
					merchantStats[normalizedLabel] = {
						count: 0,
						totalAmount: 0,
						categoryName: catName,
					};
				}
				merchantStats[normalizedLabel].count += 1;
				merchantStats[normalizedLabel].totalAmount += amount;

				if (!largestExpense || amount > largestExpense.amount) {
					largestExpense = {
						description: rawDesc,
						amount,
						date: utils.toYYYYMMDD(date),
						categoryName: catName,
					};
				}
			} else if (tx.type === "income") {
				currentMonthIncome += amount;
			}
		} else if (year === prevYear && month === prevMonth) {
			if (tx.type === "expense") {
				lastMonthExpense += amount;
				prevCatTotals[catName] = (prevCatTotals[catName] || 0) + amount;
				if (isFixed) {
					prevFixedByCat[catName] = (prevFixedByCat[catName] || 0) + amount;
				} else {
					lastMonthVariableExpense += amount;
					if (day <= elapsedDays) {
						lastMonthSameDayVariableExpense += amount;
					}
				}
				if (day <= elapsedDays) {
					lastMonthSameDayExpense += amount;
				}
			} else if (tx.type === "income") {
				lastMonthIncome += amount;
			}
		}
	}

	// 当月まだ記録されていない固定費（家賃・光熱費・通信費など）の推計
	let unrecordedFixedExpense = 0;
	const unrecordedFixedCategories = new Set<string>();
	const unrecordedFixedDetailsList: string[] = [];

	if (hasCurrentRealMonthTx) {
		for (const [catName, prevFixedAmt] of Object.entries(prevFixedByCat)) {
			const currFixedAmt = currentFixedByCat[catName] || 0;
			// 先月実績の5割未満しか計上されていない固定費カテゴリは、今月分の引き落とし・支払いが未到来とみなす
			if (currFixedAmt < prevFixedAmt * 0.5) {
				const pendingAmt = Math.round(prevFixedAmt - currFixedAmt);
				if (pendingAmt > 0) {
					unrecordedFixedExpense += pendingAmt;
					unrecordedFixedCategories.add(catName);
					unrecordedFixedDetailsList.push(`${catName} 約¥${pendingAmt}`);
				}
			}
		}
	}

	// 定期収入（給与など）が当月まだ未計上の場合を考慮した見込み月収の推計
	const pastIncomeValues = Object.values(monthlyIncomesByYM).filter(
		(v) => v > 0,
	);
	const historicalAvgIncome =
		pastIncomeValues.length > 0
			? pastIncomeValues.reduce((a, b) => a + b, 0) / pastIncomeValues.length
			: 0;
	const baselineExpectedIncome =
		lastMonthIncome > 0 ? lastMonthIncome : historicalAvgIncome;
	const expectedMonthlyIncome = Math.round(
		hasCurrentRealMonthTx &&
			baselineExpectedIncome > 0 &&
			currentMonthIncome < baselineExpectedIncome * 0.7
			? baselineExpectedIncome
			: Math.max(currentMonthIncome, baselineExpectedIncome),
	);
	const unrecordedExpectedIncome = Math.max(
		0,
		expectedMonthlyIncome - Math.round(currentMonthIncome),
	);

	// 固定費と変動費を分離した月末着地予測の計算
	// 固定費（計上済み＋未計上見込み）は1回分として加算し、変動費のみを経過日数と先月実績で按分予測する
	const effectiveElapsedDays = hasCurrentRealMonthTx
		? Math.max(elapsedDays, 5)
		: daysInTargetMonth;
	const rawProjectedVariable = hasCurrentRealMonthTx
		? (currentVariableExpense / effectiveElapsedDays) * daysInTargetMonth
		: currentVariableExpense;
	// 月初〜中盤は先月変動費トレンドとブレンドして一時的な買い物のブレを抑える
	const variableWeight = hasCurrentRealMonthTx
		? Math.min(1, elapsedDays / 15)
		: 1;
	const baselineProjectedVariable =
		lastMonthVariableExpense > 0
			? Math.max(
					currentVariableExpense,
					lastMonthVariableExpense +
						(currentVariableExpense - lastMonthSameDayVariableExpense),
				)
			: rawProjectedVariable;
	const projectedVariableExpense = Math.round(
		rawProjectedVariable * variableWeight +
			baselineProjectedVariable * (1 - variableWeight),
	);

	const projectedMonthEndExpense = hasCurrentRealMonthTx
		? Math.max(
				Math.round(currentMonthExpense + unrecordedFixedExpense),
				Math.round(
					recordedFixedExpense +
						unrecordedFixedExpense +
						projectedVariableExpense,
				),
			)
		: Math.round(currentMonthExpense);

	const projectedDiffFromLastMonth =
		lastMonthExpense > 0 ? projectedMonthEndExpense - lastMonthExpense : 0;
	// 固定費の支払日ズレ（例: 家賃が1日か27日か）に左右されないよう、同日比は変動費ベースを優先する
	const effectiveLastMonthSameDay =
		lastMonthSameDayVariableExpense > 0
			? lastMonthSameDayVariableExpense
			: lastMonthSameDayExpense;
	const effectiveCurrentSameDay =
		lastMonthSameDayVariableExpense > 0
			? currentVariableExpense
			: currentMonthExpense;
	const sameDayDiffFromLastMonth =
		effectiveLastMonthSameDay > 0
			? effectiveCurrentSameDay - effectiveLastMonthSameDay
			: 0;
	const projectedNetBalance = expectedMonthlyIncome - projectedMonthEndExpense;

	// カテゴリ別比較（未計上の固定費カテゴリを「先月比で大幅減少（節約成功）」と誤認しないよう除外）
	const allCatNames = new Set([
		...Object.keys(currentCatTotals),
		...Object.keys(prevCatTotals),
	]);
	const categoryComparisons = Array.from(allCatNames).map((name) => {
		const amount = Math.round(currentCatTotals[name] || 0);
		const prevAmount = Math.round(prevCatTotals[name] || 0);
		return {
			name,
			amount,
			prevAmount,
			diff: amount - prevAmount,
		};
	});

	const topCategories = [...categoryComparisons]
		.filter((c) => c.amount > 0)
		.sort((a, b) => b.amount - a.amount)
		.slice(0, 5);

	const increasedCategories = [...categoryComparisons]
		.filter((c) => c.diff > 0 && c.amount > 0)
		.sort((a, b) => b.diff - a.diff)
		.slice(0, 3);

	const decreasedCategories = [...categoryComparisons]
		.filter(
			(c) =>
				c.diff < 0 &&
				c.prevAmount > 0 &&
				!unrecordedFixedCategories.has(c.name),
		)
		.sort((a, b) => a.diff - b.diff)
		.slice(0, 3);

	const frequentExpenses = Object.entries(merchantStats)
		.filter(([, stat]) => stat.count >= 2)
		.map(([label, stat]) => ({
			label,
			count: stat.count,
			totalAmount: Math.round(stat.totalAmount),
			categoryName: stat.categoryName,
		}))
		.sort((a, b) => b.totalAmount - a.totalAmount || b.count - a.count)
		.slice(0, 4);

	const forecast: ProactiveForecast = {
		currentMonthExpense: Math.round(currentMonthExpense),
		currentMonthIncome: Math.round(currentMonthIncome),
		lastMonthExpense: Math.round(lastMonthExpense),
		projectedMonthEndExpense,
		projectedDiffFromLastMonth: Math.round(projectedDiffFromLastMonth),
		lastMonthSameDayExpense: Math.round(effectiveLastMonthSameDay),
		sameDayDiffFromLastMonth: Math.round(sameDayDiffFromLastMonth),
		monthLabel: `${targetMonth}月`,
		expectedMonthlyIncome,
		unrecordedFixedExpense,
		projectedNetBalance,
	};

	const topCatText =
		topCategories
			.map(
				(c) =>
					`${c.name}: ¥${c.amount} (先月¥${c.prevAmount}, 差額${c.diff >= 0 ? "+" : ""}¥${c.diff})`,
			)
			.join(" / ") || "データなし";

	const freqText =
		frequentExpenses
			.map((f) => `${f.label}(${f.categoryName}): ${f.count}回・計¥${f.totalAmount}`)
			.join(" / ") || "特になし";

	const largestText = largestExpense
		? `${largestExpense.date} ${largestExpense.description} (${largestExpense.categoryName}) ¥${Math.round(largestExpense.amount)}`
		: "なし";

	const unrecordedFixedText =
		unrecordedFixedDetailsList.length > 0
			? `計¥${unrecordedFixedExpense} (${unrecordedFixedDetailsList.join(", ")})`
			: "なし（計上済み）";

	const promptSummary = [
		`対象月: ${targetYear}年${targetMonth}月 (${elapsedDays}日経過 / 全${daysInTargetMonth}日)`,
		`今月の実績収支(現時点): 収入 ¥${forecast.currentMonthIncome} / 支出 ¥${forecast.currentMonthExpense} (うち計上済み固定費 ¥${Math.round(recordedFixedExpense)}, 変動費 ¥${Math.round(currentVariableExpense)})`,
		`未計上の固定費・定期収入見込み(過去実績からの推計): 見込み月収合計 ¥${expectedMonthlyIncome} (うち未計上収入見込み ¥${unrecordedExpectedIncome}) / 未計上固定費見込み ${unrecordedFixedText}`,
		`【重要】固定費・見込み収入考慮後の月末着地見通し: 予測総支出 ¥${forecast.projectedMonthEndExpense} vs 見込み月収 ¥${expectedMonthlyIncome} → 月末予想収支差 ${projectedNetBalance >= 0 ? "+" : ""}¥${projectedNetBalance}`,
		`先月(${prevMonth}月)実績: 収入 ¥${Math.round(lastMonthIncome)} / 支出 ¥${forecast.lastMonthExpense} (うち先月${elapsedDays}日時点の変動費: ¥${forecast.lastMonthSameDayExpense})`,
		`変動費の先月同日比: ${forecast.sameDayDiffFromLastMonth >= 0 ? "+" : ""}¥${forecast.sameDayDiffFromLastMonth}`,
		`今月の主なカテゴリ別支出と先月比較: ${topCatText}`,
		`今月の頻出支出(2回以上): ${freqText}`,
		`今月の最大出費: ${largestText}`,
	].join("\n");

	const latestDateStr = utils.toYYYYMMDD(latestTxDate);
	const signature = `${todayStr}_${transactions.length}_${Math.round(totalAllExpense)}_${Math.round(totalAllIncome)}_${latestDateStr}`;

	return {
		signature,
		forecast,
		promptSummary,
		topCategories,
		increasedCategories,
		decreasedCategories,
		frequentExpenses,
		largestExpense,
	};
}

/**
 * API上限到達時やオフライン時、またはレスポンス補完用に、
 * ローカルの定量集計からプロアクティブ・インサイトを構築する。
 * @param digest - `buildProactiveDigest` の集計結果。
 * @returns ローカル生成された `ProactiveInsights`。
 */
export function buildFallbackInsights(
	digest: ProactiveDigestResult,
): ProactiveInsights {
	const {
		forecast,
		topCategories,
		increasedCategories,
		decreasedCategories,
		frequentExpenses,
		largestExpense,
	} = digest;

	const expectedIncome =
		forecast.expectedMonthlyIncome ?? forecast.currentMonthIncome;
	const isOverPace =
		(forecast.lastMonthSameDayExpense > 0 &&
			forecast.sameDayDiffFromLastMonth >
				forecast.lastMonthSameDayExpense * 0.15) ||
		(expectedIncome > 0 &&
			forecast.projectedMonthEndExpense > expectedIncome * 0.9);
	const isDeficit =
		(expectedIncome > 0 &&
			forecast.projectedMonthEndExpense > expectedIncome) ||
		(expectedIncome === 0 &&
			forecast.lastMonthExpense > 0 &&
			forecast.projectedMonthEndExpense > forecast.lastMonthExpense * 1.25);

	const alertLevel: ProactiveInsights["alertLevel"] = isDeficit
		? "danger"
		: isOverPace
			? "warning"
			: "safe";

	const topCat = topCategories[0];
	const incCat = increasedCategories[0];
	const decCat = decreasedCategories[0];
	const topFreq = frequentExpenses[0];

	// 総評テキスト（1行ヘッドライン）
	let summaryText = `${forecast.monthLabel}支出 **¥${forecast.currentMonthExpense.toLocaleString()}**`;
	if (forecast.lastMonthSameDayExpense > 0) {
		const diffAbs = Math.abs(forecast.sameDayDiffFromLastMonth).toLocaleString();
		summaryText =
			forecast.sameDayDiffFromLastMonth <= 0
				? `先月同期比 **-¥${diffAbs}** と順調なペース`
				: `先月同期比 **+¥${diffAbs}** とやや早いペース`;
	}

	const forecastComment = "";

	const analysisPoints: AdvisorAnalysisPoint[] = [];

	// カード1: 先月比・ペース分析（見出しのみ表示）
	if (decCat && (!incCat || Math.abs(decCat.diff) >= incCat.diff)) {
		analysisPoints.push({
			type: "positive",
			title: `${decCat.name}が先月比 -¥${Math.abs(decCat.diff).toLocaleString()} と好調`,
			content: "",
			followUpPrompt: `今月の${decCat.name}と先月との比較・内訳を詳しく教えて`,
		});
	} else if (incCat) {
		analysisPoints.push({
			type: "warning",
			title: `${incCat.name}が先月比 +¥${incCat.diff.toLocaleString()} 増加`,
			content: "",
			followUpPrompt: `今月の${incCat.name}が増えている原因と内訳を教えて`,
		});
	} else if (topCat) {
		analysisPoints.push({
			type: "trend",
			title: `最多支出：${topCat.name} ¥${topCat.amount.toLocaleString()}`,
			content: "",
			followUpPrompt: `今月の${topCat.name}の詳しい内訳を教えて`,
		});
	}

	// カード2: 具体的なおすすめアクション・節約提案（見出しのみ表示）
	if (topFreq) {
		const saveEst = Math.max(1000, Math.round((topFreq.totalAmount * 0.25) / 500) * 500);
		analysisPoints.push({
			type: "recommendation",
			title: `${topFreq.label}月${topFreq.count}回 → 見直しで¥${saveEst.toLocaleString()}節約`,
			content: "",
			followUpPrompt: `今月の${topFreq.categoryName}（${topFreq.label}など）の具体的な節約プランを教えて`,
		});
	} else if (topCat) {
		analysisPoints.push({
			type: "recommendation",
			title: `${topCat.name}1割見直しで月¥${Math.round(topCat.amount * 0.1).toLocaleString()}節約`,
			content: "",
			followUpPrompt: `今月の${topCat.name}から無理なく節約できる具体的なポイントを教えて`,
		});
	}

	// カード3: 注目・異常値ハイライト（見出しのみ表示）
	if (largestExpense) {
		analysisPoints.push({
			type: "highlight",
			title: `最大出費：${largestExpense.description} ¥${Math.round(largestExpense.amount).toLocaleString()}`,
			content: "",
			followUpPrompt: `今月の高額な支出トップ5と、それぞれの内訳を教えて`,
		});
	}

	const suggestedQuestions: AdvisorSuggestion[] = [
		...(topCat
			? [
					{
						label: `📊 ${topCat.name}の内訳を深掘り`,
						text: `今月の${topCat.name}の具体的な内訳と節約ポイントを教えて`,
					},
				]
			: []),
		{
			label: "📈 先月との違いを詳しく",
			text: "先月と比べて今月の支出はどう変化しているか詳しく教えて",
		},
		{
			label: "💡 今すぐできる節約提案",
			text: "直近の取引から、来月に向けて一番効果が出やすい節約アクションを教えて",
		},
		{
			label: "🏆 高額な出費をチェック",
			text: "今月一番高かった買い物トップ5を教えて",
		},
	].slice(0, 4);

	return {
		summaryText,
		alertLevel,
		forecastComment,
		forecast,
		analysisPoints: analysisPoints.slice(0, 3),
		suggestedQuestions,
		updatedAt: Date.now(),
		isFallback: true,
	};
}
