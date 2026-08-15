import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";
import * as utils from "../utils.js";

/**
 * 日付データを安全にDateオブジェクトに変換するヘルパー。
 * Dateインスタンス、Firestore Timestamp、文字列のいずれにも対応する。
 * 無効な日付の場合は null を返す。
 */
const parseDate = (dateVal) => {
	if (!dateVal) return null;
	const date =
		dateVal instanceof Date
			? dateVal
			: dateVal?.toDate
				? dateVal.toDate()
				: new Date(dateVal);
	return isNaN(date.getTime()) ? null : date;
};

/**
 * ユーザーの質問意図（日付、カテゴリ、種類、順序）を解析し、
 * 最も関連性の高い取引データを抽出する。
 * @param {string} queryText - ユーザーの質問テキスト。
 * @param {Array} transactions - 全取引データ。
 * @param {Map|object} categories - カテゴリデータ。
 * @param {Function} getCategoryName - カテゴリIDから名前を取得する関数。
 * @returns {object} 抽出されたデータリストと説明。
 */
export function getRelevantTransactions(
	queryText,
	transactions,
	categories,
	getCategoryName,
) {
	if (!transactions) return { list: "", description: "データなし" };

	let filtered = [...transactions];
	const conditions = [];
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
	const cats =
		categories instanceof Map
			? Array.from(categories.values())
			: categories
				? Object.values(categories)
				: [];
	const hitCat = cats.find((c) => queryText.includes(c.name));

	if (hitCat) {
		// ID検索 (簡易的に名前から再検索)。
		let targetCatId = null;
		if (categories instanceof Map) {
			for (const [id, c] of categories.entries()) {
				if (c.name === hitCat.name) {
					targetCatId = id;
					break;
				}
			}
		} else {
			for (const [id, c] of Object.entries(categories)) {
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
		filtered.sort((a, b) => b.amount - a.amount);
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

	const categoryTotals = {};
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
 * AIアドバイザーのAPIを呼び出して回答を取得する。
 * エラーハンドリングを一元化し、コンポーネントが扱いやすいエラーメッセージに変換する。
 * @async
 * @param {object} payload - 送信するデータペイロード。
 * @returns {Promise<string>} 生成された回答テキスト。
 */
export async function callAdvisorApi(payload) {
	try {
		const askAdvisorFn = httpsCallable(functions, "askAdvisor");
		const result = await askAdvisorFn(payload);

		// JSON応答を解析（テキスト形式の場合は自動で処理）
		const data = result.data;

		// レスポンスがすでにオブジェクトであれば返す
		if (typeof data === "object" && data !== null) {
			// もし期待したプロパティが無ければ、オブジェクト全体を文字列化してエラーを見えるようにする
			if (!data.adviceText) {
				data.adviceText = JSON.stringify(data);
			}
			return data;
		}

		// テキストの場合はJSON解析を試みる
		if (typeof data === "string") {
			try {
				const jsonData = JSON.parse(data);
				return jsonData;
			} catch {
				// JSON解析失敗時は従来の形式で返す（後方互換性）
				return { adviceText: data.trim(), alertLevel: "safe" };
			}
		}

		return result.data;
	} catch (error) {
		console.error("[Advisor] API Error:", error);
		if (error.code === "functions/resource-exhausted") {
			throw new Error(error.message);
		} else if (
			error.message &&
			(error.message === "SafetyBlock" || error.message.includes("SAFETY"))
		) {
			throw new Error(
				"申し訳ありませんが、その内容にはお答えできません。（安全フィルターによりブロックされました）",
			);
		}
		throw new Error("通信に失敗しました。もう一度お試しください。");
	}
}
