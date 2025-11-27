import * as utils from "../utils.js";

/**
 * 収支レポートタブのUI要素をまとめたオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	summaryContainer: document.getElementById("analysis-math-summary"),
	detailsContainer: document.getElementById("analysis-details-container"),
	periodLabel: document.getElementById("analysis-period-label"),
	historyCanvas: document.getElementById("history-chart"),
	historyPlaceholder: document.getElementById("history-chart-placeholder"),
	monthFilter: document.getElementById("analysis-month-filter"),
};

/**
 * 純資産推移グラフのChart.jsインスタンスを保持する。
 * グラフの再描画時に既存のインスタンスを破棄するために使用する。
 * @type {Chart|null}
 */
let historyChartInstance = null;
/**
 * アプリケーションのルックアップテーブル（口座、カテゴリ情報）。
 * IDから名前や色などの情報を参照するために使用する。
 * @type {object}
 */
let appLuts = {};

/**
 * 現在アクティブなタブ（'expense'または'income'）を保持する。
 * ユーザーが選択している表示モードを追跡する。
 * @type {string}
 */
let activeTab = "expense";
/**
 * 計算済みの統計データをキャッシュする。
 * タブ切り替え時などに再計算を避けるために使用する。
 * @type {object|null}
 */
let cachedStats = null;
/**
 * 金額マスク状態をキャッシュする。
 * タブ切り替え時に現在のマスク設定を維持するために使用する。
 * @type {boolean}
 */
let cachedIsMasked = false;

/**
 * 収支レポートモジュールを初期化する。
 * 必要なルックアップテーブルを受け取り、内部状態として保持する。
 * @param {object} params - 初期化パラメータ
 * @param {function} params.onMonthFilterChange - 月フィルターが変更された際のコールバック。
 * @param {object} params.luts - 口座やカテゴリのルックアップテーブル。
 */
export function init({ onMonthFilterChange, luts }) {
	appLuts = luts;

	if (onMonthFilterChange) {
		elements.monthFilter.addEventListener("change", onMonthFilterChange);
	}
}

/**
 * 月フィルターの選択肢を更新する。
 * @param {string} optionsHtml - optionタグのHTML文字列。
 * @param {string} currentValue - 現在選択されている値。
 */
export function updateMonthSelector(optionsHtml, currentValue) {
	if (elements.monthFilter) {
		elements.monthFilter.innerHTML = optionsHtml;
		if (
			currentValue &&
			Array.from(elements.monthFilter.options).some(
				(o) => o.value === currentValue
			)
		) {
			elements.monthFilter.value = currentValue;
		} else {
			elements.monthFilter.value = "all-time";
		}
	}
}

/**
 * 収支レポートタブ全体を描画する。
 * 期間ラベルの更新、統計計算、サマリー、カテゴリ別カード、履歴グラフの描画を順次行う。
 * @param {Array<object>} transactions - 表示対象期間の取引データ。
 * @param {Array<object>} historicalData - 全期間の月次履歴データ。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @param {string} selectedMonth - 選択されている期間フィルターの値。
 */
export function render(transactions, historicalData, isMasked, selectedMonth) {
	updatePeriodLabel(selectedMonth);

	const stats = calculateStats(transactions);

	cachedStats = stats;
	cachedIsMasked = isMasked;

	// 1. 筆算形式のサマリーを描画する
	renderMathSummary(stats, isMasked);

	// 2. カテゴリ別の内訳カードを描画する
	renderCategoryCards(stats, isMasked);

	// 3. 純資産推移グラフを描画する
	if (historicalData) {
		renderHistoryChart(historicalData, isMasked);
	}
}

/**
 * 期間ラベル（例: "(2023年10月)"）を更新する。
 * ユーザーが現在どの期間のデータを見ているかを明示する。
 * @private
 * @param {string} selectedMonth - 選択されている期間フィルターの値。
 */
function updatePeriodLabel(selectedMonth) {
	if (!elements.periodLabel) return;
	let labelText = "";
	if (selectedMonth === "all-time") {
		const periodSelect = document.getElementById("display-period-selector");
		labelText = periodSelect
			? periodSelect.options[periodSelect.selectedIndex].text
			: "全期間";
	} else {
		const [year, month] = selectedMonth.split("-");
		labelText = `${year}年${Number(month)}月`;
	}
	elements.periodLabel.textContent = `(${labelText})`;
}

/**
 * 取引データから収支の統計情報を計算する。
 * 収入・支出の合計、およびカテゴリごとの内訳を集計する。
 * @private
 * @param {Array<object>} transactions - 計算対象の取引データ。
 * @returns {object} 収入、支出、収支差、およびカテゴリ別の詳細を含むオブジェクト。
 */
function calculateStats(transactions) {
	let incomeTotal = 0;
	let expenseTotal = 0;
	const incomeCats = {};
	const expenseCats = {};

	transactions.forEach((t) => {
		// 残高調整用の取引は集計から除外する
		if (t.categoryId === "SYSTEM_BALANCE_ADJUSTMENT") return;

		if (t.type === "income") {
			incomeTotal += t.amount;
			incomeCats[t.categoryId] = (incomeCats[t.categoryId] || 0) + t.amount;
		} else if (t.type === "expense") {
			expenseTotal += t.amount;
			expenseCats[t.categoryId] = (expenseCats[t.categoryId] || 0) + t.amount;
		}
	});

	const processCats = (catsObj) => {
		return Object.entries(catsObj)
			.map(([id, amount]) => {
				const cat = appLuts.categories.get(id);
				return {
					id,
					amount,
					name: cat ? cat.name : "不明",
					color: cat ? utils.stringToColor(cat.name) : "#9CA3AF",
				};
			})
			.sort((a, b) => b.amount - a.amount);
	};

	return {
		income: incomeTotal,
		expense: expenseTotal,
		balance: incomeTotal - expenseTotal,
		incomeDetails: processCats(incomeCats),
		expenseDetails: processCats(expenseCats),
	};
}

/**
 * 表示するタブ（収入または支出）を切り替える。
 * 選択されたタブに応じて、サマリーとカテゴリカードを再描画する。
 * @private
 * @param {'income' | 'expense'} type - 切り替え先のタブ種別。
 */
function switchTab(type) {
	if (activeTab === type) return;
	activeTab = type;
	if (cachedStats) {
		renderMathSummary(cachedStats, cachedIsMasked);
		renderCategoryCards(cachedStats, cachedIsMasked);
	}
}

/**
 * 筆算形式の収支サマリーを描画する。
 * 収入、支出、収支差を視覚的に分かりやすく表示し、タブ切り替えのトリガーとしても機能させる。
 * @private
 * @param {object} stats - 計算済みの統計データ。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 */
function renderMathSummary(stats, isMasked) {
	if (!elements.summaryContainer) return;

	const format = (val) => utils.formatCurrency(val, isMasked);
	const balanceColor = stats.balance >= 0 ? "text-primary" : "text-danger";
	const balanceSign = stats.balance > 0 ? "+" : "";

	// アクティブ/非アクティブタブのスタイルを定義
	const activeClass =
		"bg-white shadow-sm ring-1 ring-neutral-200 transform scale-[1.01] transition-all duration-200";
	const inactiveClass =
		"opacity-60 hover:opacity-100 transition-opacity duration-200 cursor-pointer";

	const incomeClass =
		activeTab === "income"
			? `${activeClass} border-l-4 border-success`
			: inactiveClass;

	const expenseClass =
		activeTab === "expense"
			? `${activeClass} border-l-4 border-danger`
			: inactiveClass;

	elements.summaryContainer.innerHTML = `
        <div class="bg-neutral-50 p-3 rounded-lg border border-neutral-200 select-none">
            <div id="summary-income-row" class="flex justify-between items-center p-2 rounded mb-1 ${incomeClass}">
                <span class="font-bold flex items-center text-success text-sm">
                    <i class="fas fa-plus-circle mr-2"></i>収入
                    ${
											activeTab === "income"
												? '<span class="ml-2 text-[10px] bg-success-light text-success-dark px-1.5 py-0.5 rounded-full">表示中</span>'
												: ""
										}
                </span>
                <span class="text-lg font-bold text-neutral-800 tracking-tight">${format(
									stats.income
								)}</span>
            </div>

            <div id="summary-expense-row" class="flex justify-between items-center p-2 rounded mb-3 ${expenseClass}">
                <span class="font-bold flex items-center text-danger text-sm">
                    <i class="fas fa-minus-circle mr-2"></i>支出
                    ${
											activeTab === "expense"
												? '<span class="ml-2 text-[10px] bg-danger-light text-danger-dark px-1.5 py-0.5 rounded-full">表示中</span>'
												: ""
										}
                </span>
                <span class="text-lg font-bold text-neutral-800 tracking-tight">${format(
									stats.expense
								)}</span>
            </div>
            
            <div class="border-b-2 border-neutral-300 mx-2 mb-2"></div>
            
            <div class="flex justify-between items-center px-2 pt-1 ${balanceColor}">
                <span class="font-bold text-neutral-600 text-sm">収支差</span>
                <span class="text-xl sm:text-2xl font-extrabold tracking-tight">
                    ${balanceSign}${format(stats.balance)}
                </span>
            </div>
        </div>
    `;

	document
		.getElementById("summary-income-row")
		.addEventListener("click", () => switchTab("income"));
	document
		.getElementById("summary-expense-row")
		.addEventListener("click", () => switchTab("expense"));
}

/**
 * カテゴリ別の内訳をカード形式で描画する。
 * 金額の大きい順にソートし、構成比とともに表示する。
 * @private
 * @param {object} stats - 計算済みの統計データ。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 */
function renderCategoryCards(stats, isMasked) {
	if (!elements.detailsContainer) return;

	let html = "";
	const format = (val) => utils.formatCurrency(val, isMasked);

	// 1枚のカードを生成する内部関数
	const createCard = (item, type, rank) => {
		const total = type === "income" ? stats.income : stats.expense;
		const pct = total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0;
		const typeLabel = type === "income" ? "収入" : "支出";
		const isIncome = type === "income";
		const badgeColor = isIncome
			? "bg-success-light text-success border border-success-light"
			: "bg-danger-light text-danger border border-danger-light";

		return `
            <div class="flex-shrink-0 w-32 bg-white border border-neutral-200 rounded-lg p-3 shadow-sm flex flex-col justify-between relative overflow-hidden snap-start hover:shadow-md transition-shadow">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor}">#${rank}</span>
                    <span class="text-xs font-bold text-neutral-600">${pct}%</span>
                </div>
                
                <div>
                    <div class="text-xs text-neutral-600 font-medium truncate mb-0.5" title="${
											item.name
										}">${item.name}</div>
                    <div class="text-sm font-bold text-neutral-900 truncate tracking-tight">${format(
											item.amount
										)}</div>
                </div>
                
                <div class="absolute left-0 top-0 bottom-0 w-1" style="background-color: ${
									item.color
								}"></div>
            </div>
        `;
	};

	// アクティブなタブに応じて表示するデータを決定
	const targetDetails =
		activeTab === "income" ? stats.incomeDetails : stats.expenseDetails;
	const targetType = activeTab;

	targetDetails.slice(0, 10).forEach((item, i) => {
		html += createCard(item, targetType, i + 1);
	});

	// データがない場合のプレースホルダー
	if (html === "") {
		const message = activeTab === "income" ? "収入なし" : "支出なし";
		html = `
            <div class="w-full flex flex-col items-center justify-center py-4 text-neutral-400 border-2 border-dashed border-neutral-200 rounded-lg">
                <p class="text-xs">${message}</p>
            </div>`;
	}

	elements.detailsContainer.innerHTML = html;
}

/**
 * Chart.jsを使用して純資産と収支の複合グラフを描画する。
 * 資産の推移（折れ線）と収支（棒グラフ）を重ねて表示し、長期的なトレンドを可視化する。
 * @private
 * @param {Array<object>} historicalData - 月次の履歴データ。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 */
function renderHistoryChart(historicalData, isMasked) {
	if (historyChartInstance) historyChartInstance.destroy();
	if (!elements.historyCanvas) return;

	const hasEnoughData = historicalData && historicalData.length > 0;
	elements.historyCanvas.style.display = hasEnoughData ? "block" : "none";
	elements.historyPlaceholder.style.display = hasEnoughData ? "none" : "block";

	if (!hasEnoughData) return;

	const labels = historicalData.map((d) => d.month);
	const netWorthData = historicalData.map((d) => d.netWorth);
	const incomeData = historicalData.map((d) => d.income);
	const expenseData = historicalData.map((d) => d.expense);
	const ctx = elements.historyCanvas.getContext("2d");

	// レスポンシブ対応のため、画面幅に応じて設定を切り替える
	const isMobile = window.innerWidth < 768;

	historyChartInstance = new Chart(ctx, {
		type: "bar",
		data: {
			labels: labels,
			datasets: [
				{
					type: "line",
					label: "純資産",
					data: netWorthData,
					borderColor: utils.THEME_COLORS.primary,
					backgroundColor: utils.THEME_COLORS.primaryRing,
					yAxisID: "yNetWorth",
					tension: 0.3,
					pointRadius: isMobile ? 2 : 3,
					pointBackgroundColor: "#fff",
					pointBorderColor: utils.THEME_COLORS.primary,
					pointBorderWidth: 2,
					fill: true,
					order: 0,
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
						// Y軸（左）: 資産
						display: !isMobile,
						text: "資産",
						color: "#4b5563",
						font: { size: 10, weight: "bold" },
					},
					grid: { display: false },
					ticks: {
						color: utils.THEME_COLORS.primary,
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
						// Y軸（右）: 収支
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

						const isNetWorthVisible = ci.data.datasets.some((ds, i) => {
							return ci.isDatasetVisible(i) && ds.yAxisID === "yNetWorth";
						});

						const isIncomeExpenseVisible = ci.data.datasets.some((ds, i) => {
							return ci.isDatasetVisible(i) && ds.yAxisID === "yIncomeExpense";
						});

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
}
