import { startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { ja } from "date-fns/locale";

/* ==========================================================================
   Constants
   ========================================================================== */

/**
 * 日本時間のタイムゾーン識別子。
 * @type {string}
 */
const TIMEZONE = "Asia/Tokyo";

/**
 * 金額マスク表示用のラベル。
 * @type {string}
 */
export const MASKED_LABEL = "¥ *****";

/**
 * システムによる残高調整用カテゴリID。
 * @type {string}
 */
export const SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID =
	"SYSTEM_BALANCE_ADJUSTMENT";

/**
 * アプリのテーマカラー定義。
 * Chart.jsなどのJS側で描画するUIコンポーネントの色を一元管理する。
 * @type {object}
 */
export const THEME_COLORS = {
	primary: "#4f46e5",
	primaryLight: "#eef2ff",
	primaryRing: "rgba(79, 70, 229, 0.2)",
	success: "#16a34a",
	successLight: "#dcfce7",
	danger: "#dc2626",
	dangerLight: "#fee2e2",
	neutral: {
		text: "#374151",
		subtext: "#6b7280",
		border: "#e5e7eb",
		grid: "#e5e7eb",
		bg: "#f9fafb",
	},
};

/* ==========================================================================
   Internal State
   ========================================================================== */

// スクロール制御用
let scrollPosition = 0;
let scrollLockCount = 0;

// 通貨フォーマッター（再利用のためキャッシュ）
const currencyFormatter = new Intl.NumberFormat("ja-JP", {
	style: "currency",
	currency: "JPY",
});

const compactCurrencyFormatter = new Intl.NumberFormat("ja-JP", {
	notation: "compact",
});

/* ==========================================================================
   Date Utilities
   ========================================================================== */

/**
 * Dateオブジェクトを日本時間基準の 'yyyy-MM' 形式の文字列に変換する。
 * @param {Date} date
 * @returns {string}
 */
export function toYYYYMM(date) {
	return formatInTimeZone(date, TIMEZONE, "yyyy-MM");
}

/**
 * Dateオブジェクトを日本時間基準の 'yyyy-MM-dd' 形式の文字列に変換する。
 * @param {Date} date
 * @returns {string}
 */
export function toYYYYMMDD(date) {
	return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
}

/**
 * Dateオブジェクトを日本時間基準の 'yyyy/MM/dd HH:mm' 形式の文字列に変換する。
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
	return formatInTimeZone(date, TIMEZONE, "yyyy/MM/dd HH:mm");
}

/**
 * Dateオブジェクトを 'yyyy年M月d日(曜日)' 形式の文字列に変換する。
 * 日本時間基準でフォーマットする。
 * @param {Date} date
 * @returns {string}
 */
export function formatDateWithWeekday(date) {
	return formatInTimeZone(date, TIMEZONE, "yyyy年M月d日(EEE)", {
		locale: ja,
	});
}

/**
 * 現在の日付をローカルタイム基準の 'yyyy-MM-dd' 形式の文字列で取得する。
 * input[type="date"] の初期値などに使用する。
 * @returns {string}
 */
export function getLocalToday() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * 指定された月数前の月の開始日時（日本時間）をUTCに変換して取得する。
 * @param {number} months - 戻る月数。
 * @returns {Date} UTCのDateオブジェクト。
 */
export function getStartOfMonthAgo(months) {
	const nowInTokyo = toZonedTime(new Date(), TIMEZONE);
	const startDate = startOfMonth(subMonths(nowInTokyo, months));
	return fromZonedTime(startDate, TIMEZONE);
}

/**
 * 指定された年の開始日時（日本時間）をUTCに変換して取得する。
 * @param {number} year
 * @returns {Date}
 */
export function getStartOfYear(year) {
	const startDate = new Date(year, 0, 1);
	return fromZonedTime(startDate, TIMEZONE);
}

/**
 * 指定された日付の「月」（1~12）を、アプリ設定のタイムゾーン（日本時間）基準で取得する。
 * @param {Date} date
 * @returns {number} 1〜12の月。
 */
export function getTransactionMonth(date) {
	const zonedDate = toZonedTime(date, TIMEZONE);
	return zonedDate.getMonth() + 1;
}

/**
 * 指定された年の終了日時（日本時間）をUTCに変換して取得する。
 * @param {number} year
 * @returns {Date}
 */
export function getEndOfYear(year) {
	const endDate = new Date(year, 11, 31, 23, 59, 59);
	return fromZonedTime(endDate, TIMEZONE);
}

/**
 * 日付オブジェクトを日本時間として解釈し、UTCのDateオブジェクト（Timestamp保存用）に変換する。
 * @param {Date} date
 * @returns {Date}
 */
export function toUtcDate(date) {
	return fromZonedTime(date, TIMEZONE);
}

/* ==========================================================================
   Formatting Utilities
   ========================================================================== */

/**
 * 数値を日本円形式にフォーマットする。
 * @param {number} amount - 金額。
 * @param {boolean} [isMasked=false] - マスク表示するかどうか。
 * @returns {string} 例: "¥1,000" または "¥ *****"
 */
export function formatCurrency(amount, isMasked = false) {
	if (isMasked) return MASKED_LABEL;
	const formatted = currencyFormatter.format(amount);
	return formatted.replace("￥", "¥").replace("\\", "¥");
}

/**
 * 数値をグラフ等のために短縮フォーマットする（例: 1万）。
 * @param {number} value - 数値。
 * @param {boolean} [isMasked=false] - マスク表示するかどうか。
 * @returns {string} 例: "1.5万"
 */
export function formatLargeCurrency(value, isMasked = false) {
	if (isMasked) return "¥***";
	if (value === 0) return "0";
	const formatted = compactCurrencyFormatter.format(value);
	return formatted.replace("￥", "¥").replace("\\", "¥");
}

/**
 * 文字列から一意のHEXカラーコードを生成する。
 * @param {string} str - 入力文字列。
 * @returns {string} HEXカラーコード。
 */
export function stringToColor(str) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	let color = "#";
	for (let i = 0; i < 3; i++) {
		const value = (hash >> (i * 8)) & 0xff;
		color += ("00" + value.toString(16)).slice(-2);
	}
	return color;
}

/* ==========================================================================
   DOM Utilities
   ========================================================================== */

/**
 * iOS Safari等でのスクロールロックを制御する。
 * モーダル表示時などに背景がスクロールしないように固定する。
 * @param {boolean} isLocked - ロックするかどうか。
 */
export function toggleBodyScrollLock(isLocked) {
	const body = document.body;
	if (isLocked) {
		if (scrollLockCount === 0) {
			scrollPosition = window.scrollY;
			body.style.position = "fixed";
			body.style.top = `-${scrollPosition}px`;
			body.style.width = "100%";
			body.classList.add("modal-open");
		}
		scrollLockCount++;
	} else {
		scrollLockCount--;
		if (scrollLockCount <= 0) {
			scrollLockCount = 0;
			body.style.position = "";
			body.style.top = "";
			body.style.width = "";
			body.classList.remove("modal-open");
			window.scrollTo({
				top: scrollPosition,
				behavior: "instant",
			});
		}
	}
}

/* ==========================================================================
   Data & Logic Utilities
   ========================================================================== */

/**
 * アイテム配列をソートする（種類 > 順序 > 名前）。
 * @param {Array} items
 * @returns {Array} ソート済み配列。
 */
export function sortItems(items) {
	return [...items].sort((a, b) => {
		// 1. 種類 (asset優先)
		if (a.type !== b.type) {
			if (a.type === "asset") return -1;
			if (b.type === "asset") return 1;
		}
		// 2. 順序
		const orderA = a.order ?? Infinity;
		const orderB = b.order ?? Infinity;
		if (orderA !== orderB) {
			return orderA - orderB;
		}
		// 3. 名前
		return a.name.localeCompare(b.name);
	});
}

/**
 * 入力文字列から数値以外を除去する。
 * @param {string} value
 * @returns {string}
 */
export function sanitizeNumberInput(value) {
	let sanitized = value.replace(/[^0-9.]/g, "");
	const parts = sanitized.split(".");
	if (parts.length > 2) {
		sanitized = parts[0] + "." + parts.slice(1).join("");
	}
	return sanitized;
}

/**
 * 取引データから収支サマリーを計算する。
 * @param {Array<object>} transactions
 * @param {object} luts - Reference lookup tables.
 * @returns {object} { income, expense, balance, incomeDetails, expenseDetails }
 */
export function summarizeTransactions(transactions, luts) {
	let incomeTotal = 0;
	let expenseTotal = 0;
	const incomeCats = {};
	const expenseCats = {};

	transactions.forEach((t) => {
		// システム自動調整用カテゴリは集計から除外
		if (t.categoryId === SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) return;

		if (t.type === "income") {
			incomeTotal += t.amount;
			incomeCats[t.categoryId] = (incomeCats[t.categoryId] || 0) + t.amount;
		} else if (t.type === "expense") {
			expenseTotal += t.amount;
			expenseCats[t.categoryId] = (expenseCats[t.categoryId] || 0) + t.amount;
		}
	});

	const processCats = (catsObj) => {
		if (!luts.categories) return [];
		return Object.entries(catsObj)
			.map(([id, amount]) => {
				const cat = luts.categories.get(id);
				return {
					id,
					amount,
					name: cat ? cat.name : "不明",
					color: cat ? stringToColor(cat.name) : "#9CA3AF",
				};
			})
			.sort((a, b) => b.amount - a.amount);
	};

	return {
		income: incomeTotal,
		expense: expenseTotal,
		balance: incomeTotal - expenseTotal,
		incomeDetails: processCats(incomeCats),
		expenseDetails: processCats(expenseCats),
	};
}

/**
 * 全取引データから、データが存在する年月を抽出して降順リストで返す。
 * @param {Array<object>} transactions
 * @returns {Array<string>} ["YYYY-MM", ...]
 */
export function getAvailableMonths(transactions) {
	if (!transactions || !Array.isArray(transactions)) return [];
	const s = new Set();
	transactions.forEach((t) => {
		if (!t.date) return;
		let d = t.date;
		let m = "";

		if (typeof d === "string" && d.length >= 7) {
			m = d.substring(0, 7);
		} else {
			let dateObj = d;
			if (d && typeof d.toDate === "function") dateObj = d.toDate();
			if (!(dateObj instanceof Date)) dateObj = new Date(dateObj);

			if (!isNaN(dateObj.getTime())) {
				m = formatInTimeZone(dateObj, TIMEZONE, "yyyy-MM");
			}
		}

		if (m && /^\d{4}-\d{2}$/.test(m)) s.add(m);
	});

	return Array.from(s).sort().reverse();
}
