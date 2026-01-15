import { useEffect, useRef, useState } from "react";
import * as utils from "../utils.js";
import { THEME_COLORS } from "../utils.js";

/**
 * 資産推移チャートコンポーネント。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Array<object>} props.historicalData - 月次履歴データの配列。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @returns {JSX.Element} チャートコンポーネント。
 */
export default function HistoryChart({ historicalData, isMasked }) {
	const canvasRef = useRef(null);
	const chartInstanceRef = useRef(null);
	const chartConstructorRef = useRef(null);
	const [isChartReady, setIsChartReady] = useState(false);

	/**
	 * Chart.jsを動的インポートして初期化する副作用。
	 * コンポーネントマウント時に一度だけ実行される。
	 */
	useEffect(() => {
		let active = true;

		const initChart = async () => {
			// Chart.jsのロード
			if (!active) return;
			const { Chart, registerables } = await import("chart.js");
			await import("chartjs-adapter-date-fns");
			Chart.register(...registerables);
			chartConstructorRef.current = Chart;
			setIsChartReady(true);
		};

		initChart();

		return () => {
			active = false;
		};
	}, []);

	/**
	 * データ更新やチャート準備完了に応じてグラフを描画する副作用。
	 * 反応型デザイン（モバイル/デスクトップ）に対応した設定を行う。
	 */
	useEffect(() => {
		if (
			!isChartReady ||
			!canvasRef.current ||
			!historicalData ||
			historicalData.length === 0
		)
			return;

		const ctx = canvasRef.current.getContext("2d");
		const isMobile = window.innerWidth < 768;

		// データ準備
		const labels = historicalData.map((d) => d.month);
		const netWorthData = historicalData.map((d) => d.netWorth);
		const incomeData = historicalData.map((d) => d.income);
		const expenseData = historicalData.map((d) => d.expense);

		// 既存チャートの破棄
		if (chartInstanceRef.current) {
			chartInstanceRef.current.destroy();
		}

		const Chart = chartConstructorRef.current;
		if (!Chart) return;

		// チャート作成
		chartInstanceRef.current = new Chart(ctx, {
			type: "bar",
			data: {
				labels: labels,
				datasets: [
					{
						type: "line",
						label: "純資産",
						data: netWorthData,
						borderColor: THEME_COLORS.primary,
						backgroundColor: THEME_COLORS.primaryRing,
						yAxisID: "yNetWorth",
						tension: 0.3,
						pointRadius: isMobile ? 2 : 3,
						pointBackgroundColor: "#fff",
						pointBorderColor: THEME_COLORS.primary,
						pointBorderWidth: 2,
						fill: true,
						order: 0,
						segment: {
							borderDash: (ctx) => {
								const index = ctx.p1DataIndex;
								return historicalData[index]?.isFuture ? [6, 6] : undefined;
							},
							borderColor: (ctx) =>
								historicalData[ctx.p1DataIndex]?.isFuture
									? "rgba(79, 70, 229, 0.5)"
									: undefined,
						},
					},
					{
						label: "収入",
						data: incomeData,
						backgroundColor: "#16a34a",
						yAxisID: "yIncomeExpense",
						barPercentage: 0.7,
						order: 1,
					},
					{
						label: "支出",
						data: expenseData,
						backgroundColor: "#dc2626",
						yAxisID: "yIncomeExpense",
						barPercentage: 0.7,
						order: 1,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: "index", intersect: false },
				scales: {
					yNetWorth: {
						type: "linear",
						position: "left",
						title: {
							display: !isMobile,
							text: "資産",
							color: "#4b5563",
							font: { size: 10, weight: "bold" },
						},
						grid: { display: false },
						ticks: {
							color: THEME_COLORS.primary,
							font: {
								weight: "bold",
								size: isMobile ? 11 : 12,
							},
							callback: (value) => utils.formatLargeCurrency(value, isMasked),
						},
					},
					yIncomeExpense: {
						type: "linear",
						position: "right",
						title: {
							display: !isMobile,
							text: "収支",
							color: "#4b5563",
							font: { size: 10, weight: "bold" },
						},
						grid: { borderDash: [4, 4], color: "#e5e7eb" },
						ticks: {
							color: "#6b7280",
							font: { size: isMobile ? 10 : 11 },
							callback: (value) => utils.formatLargeCurrency(value, isMasked),
						},
					},
					x: {
						grid: { display: false },
						ticks: {
							color: "#374151",
							font: { size: isMobile ? 11 : 12 },
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: isMobile ? 6 : 12,
						},
					},
				},
				plugins: {
					legend: {
						display: true,
						position: "bottom",
						align: "center",
						labels: {
							usePointStyle: true,
							boxWidth: 10,
							padding: 15,
							font: { size: isMobile ? 11 : 12 },
						},
						onClick: function (e, legendItem, legend) {
							const index = legendItem.datasetIndex;
							const ci = legend.chart;
							if (ci.isDatasetVisible(index)) {
								ci.hide(index);
								legendItem.hidden = true;
							} else {
								ci.show(index);
								legendItem.hidden = false;
							}
							const isNetWorthVisible = ci.data.datasets.some(
								(ds, i) => ci.isDatasetVisible(i) && ds.yAxisID === "yNetWorth"
							);
							const isIncomeExpenseVisible = ci.data.datasets.some(
								(ds, i) =>
									ci.isDatasetVisible(i) && ds.yAxisID === "yIncomeExpense"
							);
							ci.options.scales.yNetWorth.display = isNetWorthVisible;
							ci.options.scales.yIncomeExpense.display = isIncomeExpenseVisible;
							ci.update();
						},
					},
					tooltip: {
						backgroundColor: "rgba(255, 255, 255, 0.95)",
						titleColor: "#111827",
						bodyColor: "#374151",
						borderColor: "#e5e7eb",
						borderWidth: 1,
						callbacks: {
							label: (c) => utils.formatCurrency(c.raw, isMasked),
						},
					},
				},
			},
		});

		// クリーンアップ
		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.destroy();
				chartInstanceRef.current = null;
			}
		};
	}, [isChartReady, historicalData, isMasked]); // 依存配列にデータを含めることで更新時に再描画

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
				minWidth: "600px",
				minHeight: "350px",
			}}
		>
			<canvas ref={canvasRef} />
		</div>
	);
}
