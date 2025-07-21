const elements = {
	selector: document.getElementById("analysis-type-selector"),
	canvas: document.getElementById("analysis-chart"),
	canvasContainer: document.getElementById("analysis-chart").parentElement,
	placeholder: document.getElementById("analysis-chart-placeholder"),
};

let chartInstance = null;
let onTypeChangeCallback = () => {};
let appLuts = {};

export function init(onTypeChange, luts) {
	onTypeChangeCallback = onTypeChange;
	appLuts = luts;
	elements.selector.addEventListener("change", onTypeChangeCallback);
}

export function render(transactions, isMasked) {
	const analysisType = elements.selector.value;
	let summary = {};
	let labelText = "";

	// システムカテゴリを除外した取引リストを作成
	const targetTransactions = transactions.filter((t) => {
		return t.categoryId !== "SYSTEM_BALANCE_ADJUSTMENT";
	});

	if (
		analysisType === "expense-category" ||
		analysisType === "income-category"
	) {
		const type = analysisType === "expense-category" ? "expense" : "income";
		labelText = type === "expense" ? "支出額" : "収入額";
		summary = targetTransactions
			.filter((t) => t.type === type)
			.reduce((acc, t) => {
				const categoryId = t.categoryId;
				acc[categoryId] = (acc[categoryId] || 0) + t.amount;
				return acc;
			}, {});
	} else {
		// payment-method
		labelText = "支出額";
		summary = targetTransactions
			.filter((t) => t.type === "expense")
			.reduce((acc, t) => {
				const accountId = t.accountId;
				acc[accountId] = (acc[accountId] || 0) + t.amount;
				return acc;
			}, {});
	}

	const sortedSummary = Object.entries(summary).sort(([, a], [, b]) => b - a);

	// IDから名前に変換してチャートに渡す
	const labels = sortedSummary.map(([id, amount]) => {
		if (analysisType.includes("category")) {
			return appLuts.categories.get(id)?.name || "カテゴリ不明";
		} else {
			return appLuts.accounts.get(id)?.name || "口座不明";
		}
	});
	const data = sortedSummary.map(([id, amount]) => amount);
	drawChart(labels, data, labelText, isMasked);
}

function drawChart(labels, data, labelText, isMasked) {
	if (chartInstance) {
		chartInstance.destroy();
	}

	// データがない場合はチャートを非表示にし、プレースホルダーを表示
	const hasData = data && data.length > 0;
	elements.canvas.style.display = hasData ? "block" : "none";
	elements.placeholder.style.display = hasData ? "none" : "block";

	if (!hasData) return;

	const newHeight = Math.max(300, labels.length * 35 + 50);
	elements.canvasContainer.style.height = `${newHeight}px`;

	if (elements.canvas) {
		const ctx = elements.canvas.getContext("2d");
		chartInstance = new Chart(ctx, {
			type: "bar",
			data: {
				labels: labels,
				datasets: [
					{
						label: labelText,
						data: data,
						backgroundColor: labelText === "収入額" ? "#16A34A" : "#4F46E5", // Green for income
						borderColor: labelText === "収入額" ? "#15803D" : "#4338CA",
						borderWidth: 1,
					},
				],
			},
			options: {
				indexAxis: "y",
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (c) => {
								if (isMasked) return " ¥*****";
								return ` ${new Intl.NumberFormat("ja-JP", {
									style: "currency",
									currency: "JPY",
								}).format(c.raw)}`;
							},
						},
					},
				},
				scales: {
					x: {
						beginAtZero: true,
						ticks: {
							callback: (value) => {
								if (isMasked) return "¥*****";
								return new Intl.NumberFormat("ja-JP", {
									notation: "compact",
								}).format(value);
							},
						},
					},
				},
			},
		});
	}
}
