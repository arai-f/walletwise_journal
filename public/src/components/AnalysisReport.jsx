import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import * as notification from "../services/notification.js";
import * as store from "../services/store.js";
import * as utils from "../utils.js";
import NoDataState from "./ui/NoDataState";
import Select from "./ui/Select";

/**
 * 収支レポートを表示するコンポーネント。
 * 収入と支出のタブ切り替え、カテゴリ別の円グラフおよびランキングリストを提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Array} props.transactions - 集計対象のトランザクションリスト。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {string} [props.initialMonth] - 初期表示する月（"YYYY-MM" 形式）または "all-time"。
 * @param {Array<string>} [props.availableMonths=[]] - 選択可能な月のリスト。
 * @param {object} props.luts - 検索テーブル（カテゴリ名など）。
 * @param {Function} [props.onMonthFilterChange] - 月フィルタ変更時のコールバック関数。
 * @return {JSX.Element} 収支レポートコンポーネント。
 */
export default function AnalysisReport({
	transactions,
	isMasked,
	initialMonth,
	availableMonths = [],
	luts,
	onMonthFilterChange,
}) {
	const [viewMode, setViewMode] = useState("monthly"); // 'monthly' | 'yearly'
	const [selectedMonth, setSelectedMonth] = useState(
		initialMonth && initialMonth !== "all-time"
			? initialMonth
			: availableMonths.length > 0
				? availableMonths[0]
				: utils.toYYYYMM(new Date()),
	);
	const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
	const [yearData, setYearData] = useState([]);
	const [yearlyDataCache, setYearlyDataCache] = useState({});
	const [isLoading, setIsLoading] = useState(false);

	const [activeTab, setActiveTab] = useState("expense");
	const [activeIndex, setActiveIndex] = useState(-1);
	const [isMobile, setIsMobile] = useState(false);

	const yearOptions = useMemo(() => {
		const current = new Date().getFullYear();
		return Array.from({ length: 5 }, (_, i) => current - i);
	}, []);

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	useEffect(() => {
		if (initialMonth && initialMonth !== "all-time") {
			setSelectedMonth(initialMonth);
		}
	}, [initialMonth]);

	const handleTabChange = (type) => {
		if (activeTab !== type) {
			setActiveTab(type);
			setActiveIndex(-1);
		}
	};

	const handleMonthChange = (e) => {
		const val = e.target.value;
		setSelectedMonth(val);
		if (onMonthFilterChange) onMonthFilterChange(val);
	};

	const handleYearChange = (e) => {
		setSelectedYear(Number(e.target.value));
	};

	// 年次データの取得
	useEffect(() => {
		if (viewMode === "yearly") {
			if (yearlyDataCache[selectedYear]) {
				setYearData(yearlyDataCache[selectedYear]);
				return;
			}

			const loadYearData = async () => {
				setIsLoading(true);
				try {
					const data = await store.fetchTransactionsByYear(selectedYear);
					setYearData(data);
					setYearlyDataCache((prev) => ({ ...prev, [selectedYear]: data }));
				} catch (error) {
					console.error("Failed to load year data", error);
					notification.error("データの読み込みに失敗しました");
				} finally {
					setIsLoading(false);
				}
			};
			loadYearData();
		}
	}, [viewMode, selectedYear, yearlyDataCache]);

	// 表示対象のトランザクション
	const currentTransactions = viewMode === "monthly" ? transactions : yearData;

	// 集計処理
	const stats = useMemo(() => {
		const summary = utils.summarizeTransactions(currentTransactions, luts);

		// Recharts用にデータを加工し、パーセンテージを計算
		const processForChart = (details, total) => {
			if (total === 0) return [];
			return details.map((item) => ({
				...item,
				value: item.amount, // Rechartsは value プロパティを見る
				percent: ((item.amount / total) * 100).toFixed(1),
			}));
		};

		return {
			...summary,
			incomeChartData: processForChart(summary.incomeDetails, summary.income),
			expenseChartData: processForChart(
				summary.expenseDetails,
				summary.expense,
			),
		};
	}, [currentTransactions, luts]);

	const format = (val) => utils.formatCurrency(val, isMasked);

	// CSVエクスポート
	const handleExport = () => {
		if (currentTransactions.length === 0) {
			notification.warn("データがありません");
			return;
		}

		const headers = ["日付", "種別", "カテゴリ", "金額", "内容", "口座"];
		const rows = currentTransactions.map((t) => {
			const category = luts.categories.get(t.categoryId)?.name || "";
			const account = luts.accounts.get(t.accountId)?.name || "";
			const typeLabel =
				t.type === "income" ? "収入" : t.type === "expense" ? "支出" : "振替";

			return [
				utils.formatDate(t.date),
				typeLabel,
				category,
				t.amount,
				t.description,
				account,
			]
				.map((f) => `"${f}"`)
				.join(",");
		});

		const csvContent = [headers.join(","), ...rows].join("\n");
		const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
			type: "text/csv;charset=utf-8;",
		});
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `walletwise_report_${
			viewMode === "yearly" ? selectedYear : selectedMonth
		}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	};

	// 現在のアクティブタブに基づくデータ
	const currentData =
		activeTab === "income" ? stats.incomeChartData : stats.expenseChartData;
	const currentThemeColor =
		activeTab === "income"
			? utils.THEME_COLORS.success
			: utils.THEME_COLORS.danger;
	const emptyMessage =
		activeTab === "income"
			? "収入データがありません"
			: "支出データがありません";

	const activeItem = currentData[activeIndex];

	return (
		<div className="fade-in">
			{/* ヘッダーエリア */}
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3 whitespace-nowrap">
					収支レポート
				</h2>
				{/* モード切替 */}
				<div className="bg-neutral-100 p-1 rounded-lg inline-flex items-center">
					<button
						onClick={() => setViewMode("monthly")}
						className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all duration-200 ${
							viewMode === "monthly"
								? "bg-white text-neutral-800 shadow-sm"
								: "text-neutral-500 hover:text-neutral-700"
						}`}
					>
						月次
					</button>
					<button
						onClick={() => setViewMode("yearly")}
						className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all duration-200 ${
							viewMode === "yearly"
								? "bg-white text-neutral-800 shadow-sm"
								: "text-neutral-500 hover:text-neutral-700"
						}`}
					>
						年次
					</button>
				</div>
			</div>

			{/* メインカード */}
			<div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 min-h-75">
				{isLoading ? (
					<div className="h-full flex flex-col items-center justify-center py-20 text-neutral-400">
						<i className="fas fa-spinner fa-spin text-3xl mb-3"></i>
						<p className="text-sm">データを読み込み中...</p>
					</div>
				) : (
					<div className="flex flex-col-reverse md:flex-row gap-8 md:gap-12 items-center md:items-start">
						{/* 左: 筆算形式サマリー */}
						<div className="w-full md:w-5/12 flex flex-col gap-1 self-center">
							{/* 収入 */}
							<button
								onClick={() => handleTabChange("income")}
								className={`w-full flex justify-between items-end p-3 rounded-lg transition-all duration-200 group ${
									activeTab === "income"
										? "bg-emerald-50 ring-1 ring-emerald-200 shadow-xs"
										: "hover:bg-neutral-50"
								}`}
							>
								<span className="text-sm font-bold text-neutral-500 group-hover:text-emerald-600 transition-colors mb-1">
									収入
								</span>
								<span className="text-xl font-bold text-emerald-600 tabular-nums tracking-tight">
									<span className="text-lg text-emerald-500 mr-1 font-bold">
										+
									</span>
									{format(stats.income)}
								</span>
							</button>

							{/* 支出 */}
							<button
								onClick={() => handleTabChange("expense")}
								className={`w-full flex justify-between items-end p-3 rounded-lg transition-all duration-200 group ${
									activeTab === "expense"
										? "bg-rose-50 ring-1 ring-rose-200 shadow-xs"
										: "hover:bg-neutral-50"
								}`}
							>
								<span className="text-sm font-bold text-neutral-500 group-hover:text-rose-600 transition-colors mb-1">
									支出
								</span>
								<span className="text-xl font-bold text-rose-600 tabular-nums tracking-tight">
									<span className="text-lg text-rose-500 mr-1 font-bold">
										-
									</span>
									{format(stats.expense)}
								</span>
							</button>

							{/* 筆算の線 */}
							<div className="border-b-2 border-neutral-300 mx-3 my-1"></div>

							{/* 収支差 */}
							<div className="w-full flex justify-between items-end p-3 pt-1">
								<span className="text-sm font-bold text-neutral-700 mb-1">
									収支差
								</span>
								<span
									className={`text-2xl font-extrabold tabular-nums tracking-tight ${
										stats.balance >= 0 ? "text-indigo-600" : "text-rose-600"
									}`}
								>
									{stats.balance > 0 && (
										<span className="text-xl text-indigo-500 mr-1 font-bold">
											+
										</span>
									)}
									{format(stats.balance)}
								</span>
							</div>
						</div>

						{/* 右: ドーナツチャートとコントロール */}
						<div className="w-full md:w-7/12 flex flex-col">
							{/* コントロール (右寄せ) */}
							<div className="flex justify-end items-center gap-2 mb-2">
								{viewMode === "monthly" ? (
									<Select
										value={selectedMonth}
										onChange={handleMonthChange}
										className="w-36 md:w-40 text-sm"
										aria-label="収支レポートの表示月"
									>
										{availableMonths.map((m) => (
											<option key={m} value={m}>
												{m.replace("-", "年")}月
											</option>
										))}
									</Select>
								) : (
									<Select
										value={selectedYear}
										onChange={handleYearChange}
										className="w-36 md:w-40 text-sm"
										aria-label="収支レポートの表示年"
									>
										{yearOptions.map((y) => (
											<option key={y} value={y}>
												{y}年
											</option>
										))}
									</Select>
								)}
								{viewMode === "yearly" && (
									<button
										onClick={handleExport}
										disabled={isLoading || currentTransactions.length === 0}
										className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
										title="CSV出力"
									>
										<i className="fas fa-file-csv"></i>
									</button>
								)}
							</div>

							<div className="w-full h-72 md:h-80 relative flex justify-center items-center min-w-0">
								{currentData.length > 0 ? (
									<>
										{/* 中央情報表示 */}
										<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
											<div className="text-sm text-neutral-500 font-medium mb-0.5">
												{activeItem
													? activeItem.name
													: activeTab === "income"
														? "収入内訳"
														: "支出内訳"}
											</div>
											<div
												className={`text-2xl md:text-3xl font-bold tracking-tight tabular-nums ${
													activeTab === "income"
														? "text-emerald-600"
														: "text-rose-600"
												}`}
											>
												{activeItem
													? format(activeItem.value)
													: format(
															activeTab === "income"
																? stats.income
																: stats.expense,
														)}
											</div>
											{activeItem && (
												<div className="text-sm text-neutral-400 font-medium mt-0.5">
													{activeItem.percent}%
												</div>
											)}
										</div>

										<ResponsiveContainer
											width="100%"
											height="100%"
											minWidth={0}
										>
											<PieChart>
												<Pie
													data={currentData}
													dataKey="value"
													nameKey="name"
													cx="50%"
													cy="50%"
													innerRadius="60%"
													outerRadius="80%"
													paddingAngle={2}
													startAngle={90}
													endAngle={-270}
													stroke="none"
													animationDuration={800}
													onMouseEnter={
														!isMobile
															? (_, index) => setActiveIndex(index)
															: undefined
													}
													onMouseLeave={
														!isMobile ? () => setActiveIndex(-1) : undefined
													}
													onClick={
														isMobile
															? (_, index) =>
																	setActiveIndex(
																		activeIndex === index ? -1 : index,
																	)
															: undefined
													}
												>
													{currentData.map((entry, index) => (
														<Cell
															key={`cell-${index}`}
															fill={entry.color}
															className="transition-all duration-300 ease-out cursor-pointer"
															style={{
																opacity:
																	activeIndex === -1 || activeIndex === index
																		? 1
																		: 0.3,
																stroke: activeIndex === index ? "#fff" : "none",
																strokeWidth: activeIndex === index ? 2 : 0,
																filter:
																	activeIndex === index
																		? "drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))"
																		: "none",
															}}
														/>
													))}
												</Pie>
											</PieChart>
										</ResponsiveContainer>
									</>
								) : (
									<NoDataState
										message={emptyMessage}
										icon="fa-solid fa-chart-pie"
									/>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
