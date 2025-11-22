/**
 * 分析タブのUI要素をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	selector: document.getElementById("analysis-type-selector"),
	canvas: document.getElementById("analysis-chart"),
	canvasContainer: document.getElementById("analysis-chart").parentElement,
	placeholder: document.getElementById("analysis-chart-placeholder"),
};

let chartInstance = null;
let onTypeChangeCallback = () => {};
let appLuts = {};

/**
 * 分析モジュールを初期化する。
 * @param {function} onTypeChange - 分析種別セレクタが変更されたときに呼び出されるコールバック関数。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 */
export function init(onTypeChange, luts) {
	onTypeChangeCallback = onTypeChange;
	appLuts = luts;
	elements.selector.addEventListener("change", onTypeChangeCallback);
}

/**
 * 取引データを集計し、分析チャートを描画する。
 * @param {Array<object>} transactions - 表示対象期間の取引データ配列。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 */
export function render(transactions, isMasked) {
	const analysisType = elements.selector.value;
	let summary = {};
	let labelText = "";

	// システムカテゴリ（残高調整など）を除外した取引リストを作成する
	const targetTransactions = transactions.filter((t) => {
		return t.categoryId !== "SYSTEM_BALANCE_ADJUSTMENT";
	});

	if (
		analysisType === "expense-category" ||
		analysisType === "income-category"
	) {
		// カテゴリ別集計
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
		// 支払方法別集計
		labelText = "支出額";
		summary = targetTransactions
			.filter((t) => t.type === "expense")
			.reduce((acc, t) => {
				const accountId = t.accountId;
				acc[accountId] = (acc[accountId] || 0) + t.amount;
				return acc;
			}, {});
	}

	// 金額の降順でソートする
	const sortedSummary = Object.entries(summary).sort(([, a], [, b]) => b - a);

	// IDを名前に変換してチャート描画用のデータを作成する
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

/**
 * Chart.jsを使用して棒グラフを描画する。
 * @private
 * @param {Array<string>} labels - グラフのラベル（カテゴリ名や口座名）。
 * @param {Array<number>} data - グラフのデータ（金額）。
 * @param {string} labelText - データセットのラベル。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 */
function drawChart(labels, data, labelText, isMasked) {
	if (chartInstance) {
		chartInstance.destroy();
	}

	// データがない場合はチャートを非表示にし、プレースホルダーを表示する
	const hasData = data && data.length > 0;
	elements.canvas.style.display = hasData ? "block" : "none";
	elements.placeholder.style.display = hasData ? "none" : "block";

	if (!hasData) return;

	const newHeight = Math.max(300, labels.length * 35 + 50);
	// ラベル数に応じてコンテナの高さを動的に変更する
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
						backgroundColor: labelText === "収入額" ? "#16A34A" : "#4F46E5",
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
