export function toYYYYMMDD(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export const formatCurrency = (amount, isMasked = false) => {
	if (isMasked) return "¥ *****";

	if (amount < 0) {
		return `-¥${Math.abs(amount).toLocaleString()}`;
	}
	return `¥${amount.toLocaleString()}`;
};
