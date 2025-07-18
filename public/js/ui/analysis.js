const elements = {
	selector: document.getElementById("analysis-type-selector"),
	canvas: document.getElementById("analysis-chart"),
	canvasContainer: document.getElementById("analysis-chart").parentElement,
};

let chartInstance = null;
let onTypeChangeCallback = () => {};
let appConfig = {};

export function init(onTypeChange, config) {
	onTypeChangeCallback = onTypeChange;
	appConfig = config;
	elements.selector.addEventListener("change", onTypeChangeCallback);
}

export function render(transactions, isMasked) {
	const analysisType = elements.selector.value;
	let summary = {};
	let targetTransactions = [];
	let labelText = "";

	targetTransactions = transactions.filter(
		(t) => !appConfig.systemCategories.includes(t.category)
	);

	if (analysisType === "expense-category") {
		targetTransactions = transactions.filter((t) => t.type === "expense");
		summary = targetTransactions.reduce((acc, t) => {
			const key = t.category || "未分類";
			acc[key] = (acc[key] || 0) + t.amount;
			return acc;
		}, {});
		labelText = "支出額";
	} else if (analysisType === "income-category") {
		targetTransactions = transactions.filter((t) => t.type === "income");
		summary = targetTransactions.reduce((acc, t) => {
			const key = t.category || "未分類";
			acc[key] = (acc[key] || 0) + t.amount;
			return acc;
		}, {});
		labelText = "収入額";
	} else {
		// paymentMethod
		targetTransactions = transactions.filter((t) => t.type === "expense");
		summary = targetTransactions.reduce((acc, t) => {
			const key = t.paymentMethod || "不明";
			acc[key] = (acc[key] || 0) + t.amount;
			return acc;
		}, {});
		labelText = "支出額";
	}

	const sortedSummary = Object.entries(summary).sort(([, a], [, b]) => b - a);
	const labels = sortedSummary.map((item) => item[0]);
	const data = sortedSummary.map((item) => item[1]);
	drawChart(labels, data, labelText, isMasked);
}

function drawChart(labels, data, labelText, isMasked) {
	if (chartInstance) {
		chartInstance.destroy();
	}

	// Adjust canvas height dynamically
	const newHeight = Math.max(300, labels.length * 35 + 50); // Min height 300px
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
