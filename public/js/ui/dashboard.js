import * as utils from "../utils.js";

/**
 * ダッシュボードタブのUI要素をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	totalAssets: document.getElementById("dashboard-total-assets"),
	income: document.getElementById("dashboard-income"),
	expense: document.getElementById("dashboard-expense"),
	balance: document.getElementById("dashboard-balance"),
	historyChartCanvas: document.getElementById("history-chart"),
	historyChartPlaceholder: document.getElementById("history-chart-placeholder"),
};

/**
 * 純資産推移グラフのChart.jsインスタンスを保持する。
 * @type {Chart|null}
 */
let historyChart = null;

/**
 * ダッシュボードのサマリー情報（純資産、収支）と純資産推移グラフを描画する。
 * @param {Array<object>} displayTransactions - 表示対象期間の取引データ。
 * @param {Array<object>} historicalData - 月次の履歴データ（純資産、収入、支出）。
 * @param {object} accountBalances - 全口座の現在残高。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @param {string} selectedMonth - 選択されている月フィルターの値（"all-time" または "YYYY-MM"）。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 */
export function render(
	displayTransactions,
	historicalData,
	accountBalances,
	isMasked,
	selectedMonth,
	luts
) {
	let incomeLabel, expenseLabel, balanceLabel;

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
		incomeLabel = `${Number(month)}月の収入`;
		expenseLabel = `${Number(month)}月の支出`;
		balanceLabel = `${Number(month)}月の収支`;
	}

	// 表示期間の収支を計算する
	const summary = displayTransactions
		.filter((t) => {
			return t.categoryId !== "SYSTEM_BALANCE_ADJUSTMENT";
		})
		.reduce(
			(acc, t) => {
				if (t.type === "income") acc.income += t.amount;
				if (t.type === "expense") acc.expense += t.amount;
				return acc;
			},
			{ income: 0, expense: 0 }
		);
	const balance = summary.income - summary.expense;

	// 純資産と総資産を計算する
	let totalAssets = 0;
	let totalLiabilities = 0;
	for (const account of luts.accounts.values()) {
		const currentBalance = accountBalances[account.id] || 0;
		if (account.type === "asset") {
			totalAssets += currentBalance;
		} else if (account.type === "liability") {
			totalLiabilities += currentBalance; // 負債はマイナス値なのでそのまま加算
		}
	}
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

	drawHistoryChart(historicalData, isMasked);
}

function drawHistoryChart(historicalData, isMasked) {
	if (historyChart) historyChart.destroy(); // 既存のチャートがあれば破棄
	if (!elements.historyChartCanvas) return;

	// データがない場合はチャートを非表示にし、プレースホルダーを表示
	const hasEnoughData = historicalData && historicalData.length > 1;
	elements.historyChartCanvas.style.display = hasEnoughData ? "block" : "none";
	elements.historyChartPlaceholder.style.display = hasEnoughData
		? "none"
		: "block";

	if (!hasEnoughData) {
		// データがなければ凡例もクリアする
		const legendContainer = document.getElementById("history-chart-legend");
		if (legendContainer) legendContainer.innerHTML = "";
		return;
	}

	const labels = historicalData.map((d) => d.month);
	const netWorthData = historicalData.map((d) => d.netWorth);
	const incomeData = historicalData.map((d) => d.income);
	const expenseData = historicalData.map((d) => d.expense);
	const ctx = elements.historyChartCanvas.getContext("2d");

	historyChart = new Chart(ctx, {
		type: "bar",
		data: {
			labels: labels,
			datasets: [
				{
					type: "line",
					label: "純資産",
					data: netWorthData,
					borderColor: "#4f46e5",
					backgroundColor: "rgba(79, 70, 229, 0.1)",
					yAxisID: "yNetWorth",
					tension: 0.1,
					fill: true,
				},
				{
					label: "総収入",
					data: incomeData,
					backgroundColor: "#16a34a",
					yAxisID: "yIncomeExpense",
				},
				{
					label: "総支出",
					data: expenseData,
					backgroundColor: "#ef4444",
					yAxisID: "yIncomeExpense",
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				yNetWorth: {
					type: "linear",
					position: "left",
					ticks: {
						callback: (value) =>
							isMasked
								? "¥*****"
								: new Intl.NumberFormat("ja-JP", {
										notation: "compact",
								  }).format(value),
					},
				},
				yIncomeExpense: {
					type: "linear",
					position: "right",
					grid: { drawOnChartArea: false },
					ticks: {
						callback: (value) =>
							isMasked
								? "¥*****"
								: new Intl.NumberFormat("ja-JP", {
										notation: "compact",
								  }).format(value),
					},
				},
			},
			plugins: {
				legend: {
					display: true,
					position: "bottom",
				},
				tooltip: {
					callbacks: {
						label: (c) =>
							isMasked
								? " ¥*****"
								: ` ${c.dataset.label}: ${c.raw.toLocaleString()}円`,
					},
				},
			},
		},
	});
}
