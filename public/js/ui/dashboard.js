import { config } from "../config.js";

const elements = {
	container: document.getElementById("dashboard"),
};

const formatCurrency = (amount, isMasked) => {
	if (isMasked) return "¥ *****";
	return `¥${amount.toLocaleString()}`;
};

export function render(monthlyTransactions, allTransactions, isMasked) {
	// 1. 月の収支を計算
	const summary = monthlyTransactions
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

	// 2. 総資産を計算
	const balances = {};
	[...config.assets, ...config.liabilities].forEach(
		(acc) => (balances[acc] = 0)
	);
	allTransactions.forEach((t) => {
		if (t.type === "income") {
			if (balances[t.paymentMethod] !== undefined)
				balances[t.paymentMethod] += t.amount;
		} else if (t.type === "expense") {
			if (balances[t.paymentMethod] !== undefined)
				balances[t.paymentMethod] -= t.amount;
		} else if (t.type === "transfer") {
			if (balances[t.fromAccount] !== undefined)
				balances[t.fromAccount] -= t.amount;
			if (balances[t.toAccount] !== undefined)
				balances[t.toAccount] += t.amount;
		}
	});
	const totalAssets = config.assets.reduce(
		(sum, acc) => sum + (balances[acc] || 0),
		0
	);

	// 3. HTMLを生成して表示
	elements.container.innerHTML = `
        <div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="text-sm text-gray-500">今月の収入</h3><p class="text-2xl font-semibold text-green-600">${formatCurrency(
					summary.income,
					isMasked
				)}</p></div>
        <div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="text-sm text-gray-500">今月の支出</h3><p class="text-2xl font-semibold text-red-600">${formatCurrency(
					summary.expense,
					isMasked
				)}</p></div>
        <div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="text-sm text-gray-500">今月の収支</h3><p class="text-2xl font-semibold ${
					balance >= 0 ? "text-gray-700" : "text-red-600"
				}">${formatCurrency(balance, isMasked)}</p></div>
        <div class="bg-white p-4 rounded-xl shadow-sm"><h3 class="text-sm text-gray-500">総資産 (現金+口座)</h3><p id="summary-assets" class="text-2xl font-semibold text-blue-600">${formatCurrency(
					totalAssets,
					isMasked
				)}</p></div>
    `;
}
