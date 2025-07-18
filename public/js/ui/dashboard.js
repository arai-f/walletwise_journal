import * as utils from "../utils.js";

const elements = {
	totalAssets: document.getElementById("dashboard-total-assets"),
	income: document.getElementById("dashboard-income"),
	expense: document.getElementById("dashboard-expense"),
	balance: document.getElementById("dashboard-balance"),
};

let appConfig = {};

export function render(
	displayTransactions,
	accountBalances,
	isMasked,
	selectedMonth,
	config
) {
	let incomeLabel, expenseLabel, balanceLabel;
	appConfig = config;

	if (selectedMonth === "all-time") {
		const period = document
			.getElementById("display-period-selector")
			.options[
				document.getElementById("display-period-selector").selectedIndex
			].text.trim();
		incomeLabel = `収入 (${period})`;
		expenseLabel = `支出 (${period})`;
		balanceLabel = `収支 (${period})`;
	} else {
		const [year, month] = selectedMonth.split("-");
		// 「年」を省略し、よりシンプルに
		incomeLabel = `${Number(month)}月の収入`;
		expenseLabel = `${Number(month)}月の支出`;
		balanceLabel = `${Number(month)}月の収支`;
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

	const totalAssets = appConfig.assets.reduce(
		(sum, acc) => sum + (accountBalances[acc] || 0),
		0
	);
	const totalLiabilities = appConfig.liabilities.reduce(
		(sum, acc) => sum + (accountBalances[acc] || 0),
		0
	);
	const netWorth = totalAssets + totalLiabilities;

	elements.totalAssets.innerHTML = `
        <div>
            <h3 class="text-base font-medium text-gray-500">純資産 (資産 - 負債)</h3>
            <p class="text-4xl font-bold text-blue-600 mt-1">${utils.formatCurrency(
							netWorth,
							isMasked
						)}</p>
        </div>
        <div class="mt-2 text-right">
            <span class="text-s text-gray-500">総資産: ${utils.formatCurrency(
							totalAssets,
							isMasked
						)}</span>
        </div>`;
	elements.income.innerHTML = `
        <h3 class="text-xs text-gray-500">${incomeLabel}</h3>
        <p class="text-2xl font-semibold text-green-600">${utils.formatCurrency(
					summary.income,
					isMasked
				)}</p>
    `;
	elements.expense.innerHTML = `
        <h3 class="text-xs text-gray-500">${expenseLabel}</h3>
        <p class="text-2xl font-semibold text-red-600">${utils.formatCurrency(
					summary.expense,
					isMasked
				)}</p>
    `;
	elements.balance.innerHTML = `
        <h3 class="text-xs text-gray-500">${balanceLabel}</h3>
        <p class="text-2xl font-semibold ${
					balance >= 0 ? "text-gray-700" : "text-red-600"
				}">${utils.formatCurrency(balance, isMasked)}</p>
    `;
}
