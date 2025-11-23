import { formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";

/**
 * Dateオブジェクトを日本時間基準の 'yyyy-MM-dd' 形式の文字列に変換する。
 * @param {Date} date - 変換するDateオブジェクト。
 * @returns {string} 'yyyy-MM-dd' 形式の文字列。
 */
export function toYYYYMMDD(date) {
	return formatInTimeZone(date, "Asia/Tokyo", "yyyy-MM-dd");
}

/**
 * 数値を日本円の通貨形式の文字列にフォーマットする。
 * @param {number} amount - 金額。
 * @param {boolean} [isMasked=false] - 金額をマスクするかどうか。
 * @returns {string} フォーマットされた通貨文字列（例: "¥1,234" または "¥ *****"）。
 */
export const formatCurrency = (amount, isMasked = false) => {
	if (isMasked) return "¥ *****";

	if (amount < 0) {
		return `-¥${Math.abs(amount).toLocaleString()}`;
	}
	return `¥${amount.toLocaleString()}`;
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
