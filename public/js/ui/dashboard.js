import { config } from "../config.js";

const elements = {
	container: document.getElementById("dashboard"),
};

const formatCurrency = (amount, isMasked) => {
	if (isMasked) return "¥ *****";
	return `¥${amount.toLocaleString()}`;
};

export function render(
	displayTransactions,
	accountBalances,
	isMasked,
	selectedMonth
) {
	let incomeLabel, expenseLabel, balanceLabel;
	if (selectedMonth === "all-time") {
		const period = document.getElementById("display-period-selector").options[
			document.getElementById("display-period-selector").selectedIndex
		].text;
		incomeLabel = `期間内収入 (${period.trim()})`;
		expenseLabel = `期間内支出 (${period.trim()})`;
		balanceLabel = `期間内収支 (${period.trim()})`;
	} else {
		const [year, month] = selectedMonth.split("-");
		incomeLabel = `${year}年${month}月の収入`;
		expenseLabel = `${year}年${month}月の支出`;
		balanceLabel = `${year}年${month}月の収支`;
	}

	const summary = displayTransactions
		.filter((t) => t.category !== "初期残高設定")
		.reduce(
			(acc, t) => {
				if (t.type === "income") acc.income += t.amount;
				if (t.type === "expense") acc.expense += t.amount;
				return acc;
			},
			{ income: 0, expense: 0 }
		);
	const balance = summary.income - summary.expense;

	const totalAssets = config.assets.reduce(
		(sum, acc) => sum + (accountBalances[acc] || 0),
		0
	);

	elements.container.innerHTML = `
        <div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="text-sm text-gray-500">${incomeLabel}</h3><p class="text-2xl font-semibold text-green-600">${formatCurrency(
		summary.income,
		isMasked
	)}</p></div>
        <div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="text-sm text-gray-500">${expenseLabel}</h3><p class="text-2xl font-semibold text-red-600">${formatCurrency(
		summary.expense,
		isMasked
	)}</p></div>
        <div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="text-sm text-gray-500">${balanceLabel}</h3><p class="text-2xl font-semibold ${
		balance >= 0 ? "text-gray-700" : "text-red-600"
	}">${formatCurrency(balance, isMasked)}</p></div>
        <div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="text-sm text-gray-500">総資産 (現金+口座)</h3><p id="summary-assets" class="text-2xl font-semibold text-blue-600">${formatCurrency(
					totalAssets,
					isMasked
				)}</p></div>
    `;
}
