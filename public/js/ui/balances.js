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

export function render(allTransactions, isMasked) {
	const balances = {};
	const allAccounts = [...config.assets, ...config.liabilities];
	allAccounts.forEach((acc) => (balances[acc] = 0));

	allTransactions.forEach((t) => {
		if (t.type === "income") {
			if (balances[t.paymentMethod] !== undefined)
				balances[t.paymentMethod] += t.amount;
		} else if (t.type === "expense") {
			if (balances[t.paymentMethod] !== undefined)
				balances[t.paymentMethod] -= t.amount;
		} else if (t.type === "transfer") {
			if (t.fromAccount !== undefined) balances[t.fromAccount] -= t.amount;
			if (t.toAccount !== undefined) balances[t.toAccount] += t.amount;
		}
	});

	elements.grid.innerHTML = config.assets
		.map((account) => {
			const balance = balances[account] || 0;
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
	allTransactions,
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

	const historyData = calculateHistory(accountName, allTransactions);
	if (historyData.length < 2) {
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

function calculateHistory(accountName, allTransactions) {
	const relevant = allTransactions
		.filter(
			(t) =>
				t.paymentMethod === accountName ||
				t.fromAccount === accountName ||
				t.toAccount === accountName
		)
		.sort((a, b) => a.date.getTime() - b.date.getTime());

	if (relevant.length === 0) return [];

	let runningBalance = 0;
	const dailyBalances = {}; // 日付ごとの残高を保持するオブジェクト

	relevant.forEach((t) => {
		const dateStr = t.date.toISOString().split("T")[0]; // YYYY-MM-DD形式の文字列
		let amountChange = 0;

		if (t.category === "初期残高設定") {
			// 初期残高設定は加算・減算ではなく、その時点の残高とする
			runningBalance = t.type === "income" ? t.amount : -t.amount;
		} else {
			if (t.type === "income" && t.paymentMethod === accountName)
				amountChange = t.amount;
			else if (t.type === "expense" && t.paymentMethod === accountName)
				amountChange = -t.amount;
			else if (t.type === "transfer") {
				if (t.fromAccount === accountName) amountChange = -t.amount;
				if (t.toAccount === accountName) amountChange = t.amount;
			}
			runningBalance += amountChange;
		}
		// 同じ日の残高を常に最新の値で上書きする
		dailyBalances[dateStr] = runningBalance;
	});

	// オブジェクトをチャート用の配列形式に変換
	const history = Object.entries(dailyBalances).map(([date, balance]) => ({
		x: new Date(date),
		y: balance,
	}));

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
