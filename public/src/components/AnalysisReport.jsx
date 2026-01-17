import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import * as utils from "../utils.js";
import ReportModal from "./ReportModal";
import NoDataState from "./ui/NoDataState";
import Select from "./ui/Select";

const FONT_FAMILY = '"Inter", "BIZ UDPGothic", sans-serif';

/**
 * 円グラフ用のカスタムツールチップコンポーネント。
 * @param {object} props - プロパティ。
 * @param {boolean} props.active - ツールチップがアクティブかどうか。
 * @param {Array<object>} props.payload - チャートデータ。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @returns {JSX.Element|null} ツールチップ要素。
 */
const CustomTooltip = ({ active, payload, isMasked }) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<div
				className="bg-white/95 backdrop-blur-sm border border-neutral-200 p-3 rounded-lg shadow-lg text-sm"
				style={{ fontFamily: FONT_FAMILY }}
			>
				<div className="flex items-center gap-2 mb-1">
					<div
						className="w-2.5 h-2.5 rounded-full"
						style={{ backgroundColor: data.color }}
					/>
					<span className="font-bold text-neutral-700">{data.name}</span>
				</div>
				<div className="flex items-baseline gap-2">
					<span className="text-neutral-500 text-xs">金額:</span>
					<span className="font-bold tabular-nums text-neutral-800">
						{utils.formatCurrency(data.amount, isMasked)}
					</span>
				</div>
				<div className="flex items-baseline gap-2">
					<span className="text-neutral-500 text-xs">構成比:</span>
					<span className="font-bold tabular-nums text-neutral-800">
						{data.percent}%
					</span>
				</div>
			</div>
		);
	}
	return null;
};

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
		initialMonth || "all-time"
	);
	const [activeTab, setActiveTab] = useState("expense");
	const [isReportModalOpen, setIsReportModalOpen] = useState(false);

	useEffect(() => {
		if (initialMonth) {
			setSelectedMonth(initialMonth);
		}
	}, [initialMonth]);

	const handleTabChange = (type) => {
		if (activeTab !== type) setActiveTab(type);
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
				summary.expense
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
					className="w-32 md:w-40"
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
			<div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-100">
				{/* 1. 数値サマリー (タブ切り替え機能付き) */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
					{/* 収入ボタン */}
					<button
						onClick={() => handleTabChange("income")}
						className={`relative p-2 rounded-lg border text-left transition-all duration-200 group ${
							activeTab === "income"
								? "bg-emerald-50 border-emerald-500 shadow-sm"
								: "bg-white border-neutral-200 hover:border-emerald-200 hover:bg-neutral-50"
						}`}
					>
						<div className="text-[10px] md:text-xs text-neutral-500 mb-0.5 group-hover:text-emerald-600 transition-colors">
							収入
						</div>
						<div className="text-lg md:text-xl font-bold text-emerald-600 tabular-nums tracking-tight truncate">
							{format(stats.income)}
						</div>
					</button>

					{/* 支出ボタン */}
					<button
						onClick={() => handleTabChange("expense")}
						className={`relative p-2 rounded-lg border text-left transition-all duration-200 group ${
							activeTab === "expense"
								? "bg-rose-50 border-rose-500 shadow-sm"
								: "bg-white border-neutral-200 hover:border-rose-200 hover:bg-neutral-50"
						}`}
					>
						<div className="text-[10px] md:text-xs text-neutral-500 mb-0.5 group-hover:text-rose-600 transition-colors">
							支出
						</div>
						<div className="text-lg md:text-xl font-bold text-rose-600 tabular-nums tracking-tight truncate">
							{format(stats.expense)}
						</div>
					</button>

					{/* 収支差 (クリック不可) */}
					<div className="p-2 rounded-lg border border-neutral-100 bg-neutral-50 flex flex-col justify-center">
						<div className="text-[10px] md:text-xs text-neutral-500 mb-0.5">
							収支差
						</div>
						<div
							className={`text-lg md:text-xl font-bold tabular-nums tracking-tight truncate ${stats.balance >= 0 ? "text-indigo-600" : "text-rose-600"}`}
						>
							{stats.balance > 0 ? "+" : ""}
							{format(stats.balance)}
						</div>
					</div>
				</div>

				<div className="border-t border-neutral-100 my-4"></div>

				{/* 2. 詳細エリア (グラフ + リスト) */}
				{currentData.length > 0 ? (
					<div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-start">
						{/* 左: ドーナツチャート */}
						<div className="w-full md:w-5/12 h-48 md:h-56 relative flex justify-center items-center min-w-0">
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
									>
										{currentData.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.color} />
										))}
									</Pie>
									<Tooltip content={<CustomTooltip isMasked={isMasked} />} />
								</PieChart>
							</ResponsiveContainer>
						</div>

						{/* 右: ランキングリスト */}
						<div className="w-full md:w-7/12 space-y-2">
							<h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
								カテゴリ別内訳
							</h4>
							{currentData.slice(0, 5).map((item, i) => (
								<div key={item.id} className="group relative">
									{/* 背景のバー (プログレスバー風) */}
									<div
										className="absolute inset-0 rounded-md opacity-10 transition-all duration-300 group-hover:opacity-20"
										style={{
											backgroundColor: item.color,
											width: `${item.percent}%`,
										}}
									></div>

									<div className="relative flex items-center justify-between p-1.5 rounded-md hover:bg-neutral-50 transition-colors">
										<div className="flex items-center gap-3 overflow-hidden">
											<div
												className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
												style={{ backgroundColor: item.color }}
											></div>
											<span className="text-sm font-medium text-neutral-700 truncate">
												{item.name}
											</span>
										</div>
										<div className="flex items-center gap-3 shrink-0">
											<span className="text-sm font-bold text-neutral-800 tabular-nums">
												{format(item.amount)}
											</span>
											<span className="text-xs font-medium text-neutral-500 w-10 text-right tabular-nums">
												{item.percent}%
											</span>
										</div>
									</div>
								</div>
							))}

							{/* その他がある場合 */}
							{currentData.length > 5 && (
								<div className="text-center pt-2">
									<span className="text-xs text-neutral-400">
										他 {currentData.length - 5} 件のカテゴリ
									</span>
								</div>
							)}
						</div>
					</div>
				) : (
					<NoDataState message={emptyMessage} icon="fa-solid fa-chart-pie" />
				)}
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
