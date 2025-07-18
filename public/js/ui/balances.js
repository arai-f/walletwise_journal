import { config } from "../config.js";
import * as store from "../store.js";
import * as utils from "../utils.js";

const elements = {
	grid: document.getElementById("balances-grid"),
};

let historyChart = null;
let onCardClickCallback = () => {};

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
			const iconClass =
				config.accountIcons[account] || config.accountIcons.default;
			return `
            <div class="balance-card bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition" data-account-name="${account}">
                <div class="flex items-center text-sm font-medium text-gray-500 pointer-events-none">
                    <i class="${iconClass} w-4 mr-2"></i>
                    <h4>${account}</h4>
                </div>
                <p class="text-xl font-semibold text-right ${
									balance >= 0 ? "text-green-600" : "text-red-600"
								} pointer-events-none">${utils.formatCurrency(
				balance,
				isMasked
			)}</p>
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
	// 新しいカードがクリックされた場合、既存のカードのアクティブ状態を解除
	const activeCard = document.querySelector(".balance-card-active");
	if (activeCard && activeCard !== targetCard) {
		activeCard.classList.remove("balance-card-active");
	}
	// 新しいカードをアクティブ状態にする
	targetCard.classList.add("balance-card-active");

	const existingContainer = document.getElementById(
		"balance-history-container"
	);
	if (existingContainer) {
		targetCard.classList.remove("balance-card-active");
		existingContainer.remove();
		if (historyChart) historyChart.destroy();
		if (existingContainer.dataset.parentAccount === accountName) return;
	}

	const historyData = calculateHistory(
		accountName,
		periodTransactions,
		currentBalances
	);

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

function calculateHistory(accountName, allPeriodTransactions, currentBalances) {
	const relevantTxns = allPeriodTransactions
		.filter(
			(t) =>
				t.paymentMethod === accountName ||
				t.fromAccount === accountName ||
				t.toAccount === accountName
		)
		.sort((a, b) => a.date.getTime() - b.date.getTime()); // 日付の昇順（古い順）でソート

	const dailyBalances = {};
	let runningBalance = 0;

	// --- 開始残高の計算 ---
	if (store.isLocalDevelopment) {
		// ローカル開発モード: 最初から残高を積み上げる
		runningBalance = 0;
	} else {
		// Firebaseモード: 現在の残高から逆算して、期間開始時点の残高を求める
		let startingBalance = currentBalances[accountName] || 0;
		const reversedTxns = [...relevantTxns].reverse();
		for (const t of reversedTxns) {
			if (t.type === "income" && t.paymentMethod === accountName) {
				startingBalance -= t.amount;
			} else if (t.type === "expense" && t.paymentMethod === accountName) {
				startingBalance += t.amount;
			} else if (t.type === "transfer") {
				if (t.fromAccount === accountName) startingBalance += t.amount;
				if (t.toAccount === accountName) startingBalance -= t.amount;
			}
		}
		runningBalance = startingBalance;
	}

	// --- 描画用データの作成 ---
	relevantTxns.forEach((t) => {
		if (t.type === "income" && t.paymentMethod === accountName) {
			runningBalance += t.amount;
		} else if (t.type === "expense" && t.paymentMethod === accountName) {
			runningBalance -= t.amount;
		} else if (t.type === "transfer") {
			if (t.fromAccount === accountName) runningBalance -= t.amount;
			if (t.toAccount === accountName) runningBalance += t.amount;
		}
		// 同じ日の取引は、最後の取引後の残高で上書きされる
		dailyBalances[t.date.toISOString().split("T")[0]] = runningBalance;
	});

	// もし期間内に取引がなければ、現在の残高を今日の日付でプロットする
	if (relevantTxns.length === 0 && currentBalances[accountName] !== undefined) {
		dailyBalances[new Date().toISOString().split("T")[0]] =
			currentBalances[accountName];
	}

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
						round: "day",
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
