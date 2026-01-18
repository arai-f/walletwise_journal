import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import * as utils from "../utils.js";
import ReportModal from "./ReportModal";
import NoDataState from "./ui/NoDataState";
import Select from "./ui/Select";

/**
 * 月次収支レポートを表示するコンポーネント。
 * 収入と支出のタブ切り替え、カテゴリ別の円グラフおよびランキングリストを提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Array} props.transactions - 集計対象のトランザクションリスト。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {string} [props.initialMonth] - 初期表示する月（"YYYY-MM" 形式）または "all-time"。
 * @param {Array<string>} [props.availableMonths=[]] - 選択可能な月のリスト。
 * @param {string} [props.periodLabel="全期間"] - 全期間選択肢の表示ラベル。
 * @param {object} props.luts - 検索テーブル（カテゴリ名など）。
 * @param {Function} [props.onMonthFilterChange] - 月フィルタ変更時のコールバック関数。
 * @return {JSX.Element} 月次収支レポートコンポーネント。
 */
export default function AnalysisReport({
	transactions,
	isMasked,
	initialMonth,
	availableMonths = [],
	periodLabel = "全期間",
	luts,
	onMonthFilterChange,
}) {
	const [selectedMonth, setSelectedMonth] = useState(
		initialMonth || "all-time",
	);
	const [activeTab, setActiveTab] = useState("expense");
	const [isReportModalOpen, setIsReportModalOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	useEffect(() => {
		if (initialMonth) {
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

	// 集計処理
	const stats = useMemo(() => {
		const summary = utils.summarizeTransactions(transactions, luts);

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
	}, [transactions, luts]);

	const format = (val) => utils.formatCurrency(val, isMasked);

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
			<div className="flex justify-between items-center mb-3">
				<div className="flex items-center gap-2 md:gap-4">
					<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3 whitespace-nowrap">
						収支レポート
					</h2>
					<button
						onClick={() => setIsReportModalOpen(true)}
						className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-2 md:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
						aria-label="年間推移レポートを開く"
					>
						<i className="fa-solid fa-chart-column"></i>
						<span className="md:hidden">年間</span>
						<span className="hidden md:inline">年間推移</span>
					</button>
				</div>
				<Select
					value={selectedMonth}
					onChange={handleMonthChange}
					className="w-36 md:w-40"
					aria-label="収支レポートの表示月"
				>
					<option value="all-time">{periodLabel}</option>
					{availableMonths.map((m) => (
						<option key={m} value={m}>
							{m.replace("-", "年")}月
						</option>
					))}
				</Select>
			</div>

			{/* メインカード */}
			<div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100">
				<div className="flex flex-col-reverse md:flex-row gap-8 md:gap-12 items-center">
					{/* 左: 筆算形式サマリー */}
					<div className="w-full md:w-5/12 flex flex-col gap-1">
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
								<span className="text-lg text-rose-500 mr-1 font-bold">-</span>
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

					{/* 右: ドーナツチャート */}
					<div className="w-full md:w-7/12 h-72 md:h-80 relative flex justify-center items-center min-w-0">
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
													activeTab === "income" ? stats.income : stats.expense,
												)}
									</div>
									{activeItem && (
										<div className="text-sm text-neutral-400 font-medium mt-0.5">
											{activeItem.percent}%
										</div>
									)}
								</div>

								<ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
															setActiveIndex(activeIndex === index ? -1 : index)
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

			{/* 年間レポートモーダル */}
			<ReportModal
				isOpen={isReportModalOpen}
				onClose={() => setIsReportModalOpen(false)}
				luts={luts}
			/>
		</div>
	);
}
