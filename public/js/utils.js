import { formatInTimeZone, toDate } from "https://esm.sh/date-fns-tz@2.0.1";

const TIMEZONE = "Asia/Tokyo";

/**
 * 金額マスク表示用のラベル。
 * @type {string}
 */
export const MASKED_LABEL = "¥ *****";

/**
 * アプリのテーマカラー定義。
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

/**
 * HTMLエスケープを行う。
 * @param {string} str - エスケープ対象の文字列。
 * @returns {string} エスケープ後の文字列。
 */
export function escapeHtml(str) {
	if (!str) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Dateオブジェクトを日本時間基準の 'yyyy-MM-dd' 形式の文字列に変換する。
 * @param {Date} date - 変換するDateオブジェクト。
 * @returns {string} 'yyyy-MM-dd' 形式の文字列。
 */
export function toYYYYMMDD(date) {
	return formatInTimeZone(date, "Asia/Tokyo", "yyyy-MM-dd");
}

/**
 * 指定された日付を日本時間基準のDateオブジェクトに変換する。
 * @returns {Date} 日本時間基準のDateオブジェクト。
 */
export function getToday() {
	return toYYYYMMDD(toDate(new Date(), { timeZone: TIMEZONE }));
}

/**
 * 数値を日本円の通貨形式の文字列にフォーマットする。
 * @param {number} amount - 金額。
 * @param {boolean} [isMasked=false] - 金額をマスクするかどうか。
 * @returns {string} フォーマットされた通貨文字列（例: "¥1,234" または "¥ *****"）。
 */
export const formatCurrency = (amount, isMasked = false) => {
	if (isMasked) return MASKED_LABEL;
	if (amount < 0) {
		return `-¥${Math.abs(amount).toLocaleString()}`;
	}
	return `¥${amount.toLocaleString()}`;
};

/**
 * グラフ軸向けに数値を短縮フォーマットする（例: 10,000 -> 1万）。
 * @param {number} value - 数値。
 * @param {boolean} [isMasked=false] - マスクするかどうか。
 * @returns {string} フォーマットされた文字列。
 */
export const formatLargeCurrency = (value, isMasked = false) => {
	if (isMasked) return "¥***";
	if (value === 0) return "0";

	// Intl.NumberFormatを使って "1万" などの短縮表記を標準機能で行う
	return new Intl.NumberFormat("ja-JP", {
		notation: "compact",
		compactDisplay: "short",
	}).format(value);
};

/**
 * 文字列からハッシュ化されたHEXカラーコードを生成する。
 * @param {string} str - 入力文字列。
 * @returns {string} HEXカラーコード（例: "#a3f12b"）。
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

/**
 * アイテムの配列を特定のルールでソートする。
 * ソート順序:
 *   1. 種類 (type) - "asset" が最優先
 *   2. ユーザー設定順 (order) - 小さい順
 *   3. 名前順 (name) - アルファベット順
 * @param {Array} items - ソート対象のアイテム配列。
 * @returns {Array} ソートされた新しいアイテム配列。
 */
export function sortItems(items) {
	return [...items].sort((a, b) => {
		// 1. 種類でソート (assetが先)
		if (a.type !== b.type) {
			// assetがあれば優先、それ以外は後
			if (a.type === "asset") return -1;
			if (b.type === "asset") return 1;
		}
		// 2. ユーザー設定順 (order)
		const orderA = a.order ?? Infinity;
		const orderB = b.order ?? Infinity;
		if (orderA !== orderB) {
			return orderA - orderB;
		}
		// 3. 名前順
		return a.name.localeCompare(b.name);
	});
}

/**
 * select要素にオプションを生成して設定する。
 * @param {HTMLSelectElement} selectEl - 対象のselect要素。
 * @param {Array} items - オプションの元となるアイテム配列。各アイテムは{id, name}を持つ。
 * @param {string|null} [defaultLabel=null] - 先頭に追加するデフォルトオプションのラベル。nullの場合は追加しない。
 */
export function populateSelect(selectEl, items, defaultLabel = null) {
	const sorted = sortItems(items);
	let html = defaultLabel ? `<option value="all">${defaultLabel}</option>` : "";
	html += sorted
		.map((item) => `<option value="${item.id}">${item.name}</option>`)
		.join("");
	selectEl.innerHTML = html;
}

/**
 * 数値入力から数値以外の文字を除去する。
 * @param {string} value - 入力された文字列。
 * @returns {string} 数値と小数点のみを含む文字列。
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
 * ボタンをローディング状態にして非同期処理を実行し、連打を防止するラッパー関数。
 * @param {HTMLElement} button - 対象のボタン要素。
 * @param {Function} asyncFunction - 実行する非同期関数。
 */
export async function withLoading(button, asyncFunction) {
	if (button.disabled) return; // 処理中なら何もしない

	const originalHtml = button.innerHTML;
	// ボタン幅が変わってガタつくのを防ぐため、幅を固定する
	const originalWidth = button.style.width;
	button.style.width = `${button.offsetWidth}px`;

	try {
		button.disabled = true;
		// スピナーを表示（Tailwindのクラスを利用）
		button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
		button.classList.add("opacity-50", "cursor-not-allowed");

		await asyncFunction();
	} catch (error) {
		// エラーは呼び出し元で処理させるが、ここではボタンの復帰を保証する
		throw error;
	} finally {
		button.disabled = false;
		button.innerHTML = originalHtml;
		button.style.width = originalWidth;
		button.classList.remove("opacity-50", "cursor-not-allowed");
	}
}
