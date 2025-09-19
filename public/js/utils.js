import { formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";

export function toYYYYMMDD(date) {
	// 日本時間（Asia/Tokyo）のタイムゾーンでフォーマットする
	return formatInTimeZone(date, "Asia/Tokyo", "yyyy-MM-dd");
}

export const formatCurrency = (amount, isMasked = false) => {
	if (isMasked) return "¥ *****";

	if (amount < 0) {
		return `-¥${Math.abs(amount).toLocaleString()}`;
	}
	return `¥${amount.toLocaleString()}`;
};
