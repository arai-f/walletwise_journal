import * as utils from "../utils.js";

const elements = {
	grid: document.getElementById("balances-grid"),
};

let historyChart = null;
let onCardClickCallback = () => {};
let appLuts = {};

export function init(onCardClick, luts) {
	onCardClickCallback = onCardClick;
	appLuts = luts;
	elements.grid.addEventListener("click", (e) => {
		const targetCard = e.target.closest(".balance-card");
		if (targetCard) {
			// クリックされたカードの `accountId` をコールバックに渡す
			onCardClickCallback(targetCard.dataset.accountId, targetCard);
		}
	});
}

export function render(accountBalances, isMasked) {
	const accounts = [...appLuts.accounts.values()]
		.filter((a) => !a.isDeleted && a.type === "asset")
		.sort(
			(a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
		);

	elements.grid.innerHTML = accounts
		.map((account) => {
			const balance = accountBalances[account.id] || 0;
			const iconClass = account.icon || "fa-solid fa-wallet";
			return `
            <div class="balance-card bg-white p-3 rounded-lg shadow-sm cursor-pointer hover-lift" data-account-id="${
							account.id
						}">
                <div class="flex items-center text-sm font-medium text-gray-500 pointer-events-none">
                    <i class="${iconClass} w-4 mr-2"></i>
                    <h4>${account.name}</h4>
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
	accountId,
	targetCard,
	periodTransactions,
	currentBalances,
	isMasked
) {
	const accountName = appLuts.accounts.get(accountId)?.name || "不明な口座";

	// 既存のハイライトがあれば一旦すべて解除
	document.querySelectorAll(".balance-card-active").forEach((card) => {
		card.classList.remove("balance-card-active");
	});

	const existingContainer = document.getElementById(
		"balance-history-container"
	);
	if (existingContainer) {
		existingContainer.remove();
		if (historyChart) historyChart.destroy();
		// チャートを閉じるだけの場合は、ハイライトを付けずに終了
		if (existingContainer.dataset.parentAccount === accountName) return;
	}

	// 新しくクリックされたカードにハイライトを適用
	targetCard.classList.add("balance-card-active");

	const historyData = calculateHistory(
		accountId,
		periodTransactions,
		currentBalances
	);

	let container;

	if (historyData) {
		// データがある場合：チャートコンテナを作成
		container = document.createElement("div");
		container.id = "balance-history-container";
		container.dataset.parentAccount = accountName;
		container.className =
			"col-span-2 sm:col-span-3 md:col-span-4 bg-white p-4 rounded-lg shadow-sm mt-2 h-64";
		container.innerHTML = `<canvas id="balance-history-chart-canvas"></canvas>`;
	} else {
		// データがない場合：プレースホルダーコンテナを作成
		container = document.createElement("div");
		container.id = "balance-history-container";
		container.dataset.parentAccount = accountName;
		container.className =
			"col-span-2 sm:col-span-3 md:col-span-4 bg-white p-4 rounded-lg shadow-sm mt-2 h-64 flex items-center justify-center";
		container.innerHTML = `<p class="text-gray-500">表示できる十分な取引データがありません</p>`;
	}

	const parentGrid = targetCard.closest(".grid");
	parentGrid.appendChild(container);

	// もしチャートコンテナを作成した場合のみ、グラフを描画
	if (historyData) {
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
}

function calculateHistory(accountId, allPeriodTransactions, currentBalances) {
	const relevantTxns = allPeriodTransactions
		.filter(
			(t) =>
				t.accountId === accountId ||
				t.fromAccountId === accountId ||
				t.toAccountId === accountId
		)
		.sort((a, b) => a.date.getTime() - b.date.getTime()); // 日付の昇順（古い順）でソート

	// 取引が1件以下の場合、履歴チャートを表示しない
	if (relevantTxns.length <= 1) return null;

	const dailyBalances = {};
	let runningBalance = 0;

	// --- 開始残高の計算 ---
	let startingBalance = currentBalances[accountId] || 0;
	const reversedTxns = [...relevantTxns].reverse();
	for (const t of reversedTxns) {
		if (t.type === "transfer") {
			if (t.fromAccountId === accountId) startingBalance += t.amount;
			if (t.toAccountId === accountId) startingBalance -= t.amount;
		} else if (t.accountId === accountId) {
			const sign = t.type === "income" ? -1 : 1;
			startingBalance += t.amount * sign;
		}
	}
	runningBalance = startingBalance;

	// --- 描画用データの作成 ---
	relevantTxns.forEach((t) => {
		if (t.type === "transfer") {
			if (t.fromAccountId === accountId) runningBalance -= t.amount;
			if (t.toAccountId === accountId) runningBalance += t.amount;
		} else if (t.accountId === accountId) {
			const sign = t.type === "income" ? 1 : -1;
			runningBalance += t.amount * sign;
		}
		dailyBalances[t.date.toISOString().split("T")[0]] = runningBalance;
	});

	if (relevantTxns.length === 0 && currentBalances[accountId] !== undefined) {
		dailyBalances[new Date().toISOString().split("T")[0]] =
			currentBalances[accountId];
	}

	if (Object.keys(dailyBalances).length === 0) return null;

	return Object.entries(dailyBalances)
		.map(([date, balance]) => ({ x: new Date(date), y: balance }))
		.sort((a, b) => a.x.getTime() - b.x.getTime());
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
					stepped: true,
					borderWidth: 2,
					pointRadius: 0,
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
