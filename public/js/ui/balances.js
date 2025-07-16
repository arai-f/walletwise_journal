import { config } from "../config.js";

const elements = {
	grid: document.getElementById("balances-grid"),
};

let historyChart = null;
let onCardClickCallback = () => {};

const formatCurrency = (amount, isMasked) => {
	if (isMasked) return "¥ *****";
	return `¥${amount.toLocaleString()}`;
};

export function init(onCardClick) {
	onCardClickCallback = onCardClick;
	elements.grid.addEventListener("click", (e) => {
		const targetCard = e.target.closest(".balance-card");
		if (targetCard) {
			onCardClickCallback(targetCard.dataset.accountName, targetCard);
		}
	});
}

export function render(accountBalances, isMasked) {
	elements.grid.innerHTML = config.assets
		.map((account) => {
			const balance = accountBalances[account] || 0;
			return `
            <div class="balance-card bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition hover-lift" data-account-name="${account}">
                <h4 class="text-sm font-medium text-gray-500 pointer-events-none">${account}</h4>
                <p class="text-xl font-semibold ${
									balance >= 0 ? "text-green-600" : "text-red-600"
								} pointer-events-none">${formatCurrency(balance, isMasked)}</p>
            </div>
        `;
		})
		.join("");
}

export function toggleHistoryChart(
	accountName,
	targetCard,
	periodTransactions,
	currentBalances, // ★ 現在の残高を受け取る
	isMasked
) {
	const existingContainer = document.getElementById(
		"balance-history-container"
	);
	if (existingContainer) {
		existingContainer.remove();
		if (historyChart) historyChart.destroy();
		if (existingContainer.dataset.parentAccount === accountName) return;
	}

	const historyData = calculateHistory(
		accountName,
		periodTransactions,
		currentBalances
	);

	if (historyData.length < 1) {
		alert("グラフを描画するための十分な取引データがありません。");
		return;
	}

	const container = document.createElement("div");
	container.id = "balance-history-container";
	container.dataset.parentAccount = accountName;
	container.className =
		"col-span-2 sm:col-span-3 md:col-span-4 bg-white p-4 rounded-lg shadow-sm mt-2 h-64";
	container.innerHTML = `<canvas id="balance-history-chart-canvas"></canvas>`;

	const parentGrid = targetCard.closest(".grid");
	parentGrid.appendChild(container);

	const ctx = document
		.getElementById("balance-history-chart-canvas")
		.getContext("2d");
	historyChart = drawHistoryChart(
		ctx,
		historyData,
		`${accountName} の残高推移`,
		isMasked
	);
}

function calculateHistory(accountName, periodTransactions, currentBalances) {
	const relevantTxns = periodTransactions
		.filter(
			(t) =>
				t.paymentMethod === accountName ||
				t.fromAccount === accountName ||
				t.toAccount === accountName
		)
		.sort((a, b) => b.date.getTime() - a.date.getTime()); // 日付の降順（新しい順）でソート

	let runningBalance = currentBalances[accountName] || 0;
	const dailyBalances = {};

	// まず、今日の最終残高として現在の残高を記録する
	dailyBalances[new Date().toISOString().split("T")[0]] = runningBalance;

	// 新しい取引から古い取引へ遡る
	for (const t of relevantTxns) {
		const dateStr = t.date.toISOString().split("T")[0];

		// まだその日の残高を記録していなければ、現在のrunningBalanceがその日の最終残高となる
		if (!dailyBalances[dateStr]) {
			dailyBalances[dateStr] = runningBalance;
		}

		// この取引が起こる前の状態に戻すため、残高を逆算する
		if (t.type === "income" && t.paymentMethod === accountName) {
			runningBalance -= t.amount; // 収入だったので、引く
		} else if (t.type === "expense" && t.paymentMethod === accountName) {
			runningBalance += t.amount; // 支出だったので、足す
		} else if (t.type === "transfer") {
			if (t.fromAccount === accountName) runningBalance += t.amount; // 振替元だったので、足す
			if (t.toAccount === accountName) runningBalance -= t.amount; // 振替先だったので、引く
		}
	}

	// 最後に、チャートで表示するために日付の昇順に戻す
	const history = Object.entries(dailyBalances)
		.map(([date, balance]) => ({ x: new Date(date), y: balance }))
		.sort((a, b) => a.x.getTime() - b.x.getTime());

	return history;
}

function drawHistoryChart(ctx, data, title, isMasked) {
	return new Chart(ctx, {
		type: "line",
		data: {
			datasets: [
				{
					label: title,
					data: data,
					borderColor: "#4F46E5",
					backgroundColor: "rgba(79, 70, 229, 0.1)",
					fill: true,
					tension: 0,
					borderWidth: 2,
					pointRadius: 2,
					pointHoverRadius: 5,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: (c) => {
							if (isMasked) return "残高: ¥*****";
							return `残高: ${new Intl.NumberFormat("ja-JP", {
								style: "currency",
								currency: "JPY",
							}).format(c.raw.y)}`;
						},
					},
				},
			},
			scales: {
				x: {
					type: "time",
					time: {
						unit: "day",
						tooltipFormat: "yyyy/MM/dd",
						displayFormats: { day: "MM/dd" },
					},
				},
				y: {
					ticks: {
						callback: (value) => {
							if (isMasked) return "¥*****";
							return new Intl.NumberFormat("ja-JP", {
								notation: "compact",
								compactDisplay: "short",
							}).format(value);
						},
					},
				},
			},
		},
	});
}
