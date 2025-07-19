export function toYYYYMMDD(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export const formatCurrency = (amount, isMasked, type = "none") => {
	if (isMasked) return "¥ *****";

	const formattedAmount = `¥${Math.abs(amount).toLocaleString()}`;

	if (type === "expense") {
		return `<p class="font-semibold text-red-600 text-lg whitespace-nowrap">- ${formattedAmount}</p>`;
	} else if (type === "income") {
		return `<p class="font-semibold text-green-600 text-lg whitespace-nowrap">+ ${formattedAmount}</p>`;
	} else {
		if (amount < 0) {
			return `-¥${Math.abs(amount).toLocaleString()}`;
		}
		return `¥${amount.toLocaleString()}`;
	}
};
