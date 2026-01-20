import { useEffect, useMemo, useState } from "react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { THEME_COLORS, formatCurrency, formatLargeCurrency } from "../utils.js";
import NoDataState from "./ui/NoDataState";

/**
 * チャートのツールチップを表示するコンポーネント。
 * @param {object} props - プロパティ。
 * @param {boolean} props.active - ツールチップがアクティブかどうか。
 * @param {Array<object>} props.payload - チャートデータ。
 * @param {string} props.label - ラベル。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {string} props.variant - 表示バリアント ('default' | 'cockpit' | 'overview')。
 * @returns {JSX.Element|null} ツールチップ要素。
 */
const CustomTooltip = ({ active, payload, label, isMasked, variant }) => {
	if (active && payload && payload.length) {
		// データから本来のデータオブジェクトを取得
		const data = payload[0].payload;
		const netChange =
			data.income !== undefined ? (data.income || 0) - (data.expense || 0) : 0;
		const isPositive = netChange >= 0;

		let labelStr = label;
		if (typeof label === "string") {
			if (/^\d{4}-\d{2}$/.test(label)) {
				labelStr = `${label.replace("-", "年")}月`;
			} else {
				const d = new Date(label);
				if (!isNaN(d.getTime())) {
					labelStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
				}
			}
		}

		return (
			<div className="bg-white/95 backdrop-blur-sm border border-neutral-200 p-3 rounded-lg shadow-lg text-sm">
				<p className="font-bold text-neutral-700 mb-2">{labelStr}</p>
				<div className="space-y-2">
					{/* 総資産 */}
					<div className="flex items-center justify-between gap-4">
						<span className="text-neutral-500 text-xs">
							{variant === "cockpit" ? "残高" : "総資産"}
						</span>
						<span
							className={`font-bold tabular-nums text-base ${variant === "cockpit" ? "text-indigo-600" : "text-neutral-700"}`}
						>
							{formatCurrency(
								data.value !== undefined ? data.value : data.netWorth,
								isMasked,
							)}
						</span>
					</div>
					{/* その月の収支差（グラフには出さないが補足情報として表示） */}
					{data.income !== undefined && (
						<div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-1">
							<span className="text-neutral-400 text-xs">月間収支</span>
							<span
								className={`font-bold tabular-nums text-sm ${
									isPositive ? "text-emerald-600" : "text-rose-600"
								}`}
							>
								{isPositive ? "+" : ""}
								{formatCurrency(netChange, isMasked)}
							</span>
						</div>
					)}
				</div>
			</div>
		);
	}
	return null;
};

/**
 * 資産推移および収支チャートを表示するコンポーネント。
 * 画面サイズに応じてレイアウトを調整し、総資産と収支の表示モードを切り替える機能を持つ。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Array<object>} props.historicalData - 月次履歴データの配列。
 * @param {Array<object>} props.data - 日次または月次データ配列 (historicalDataの代替)。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {string} props.variant - 表示バリアント ('default' | 'cockpit' | 'overview')。
 * @returns {JSX.Element} チャートコンポーネント。
 */
export default function HistoryChart({
	historicalData,
	data,
	isMasked,
	variant = "default",
}) {
	const [isMobile, setIsMobile] = useState(false);
	const chartData = data || historicalData;

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// 資産額に変動がない月をフィルタリングする（最初と最後は残す）。
	const displayData = useMemo(() => {
		if (!chartData || chartData.length === 0) return [];
		// 日次データの場合はフィルタリングしない（なめらかな線にするため）
		if (data) return data;

		if (chartData.length === 1) return chartData;

		return chartData.filter((item, index) => {
			// 最初と最後は必ず表示する。
			if (index === 0 || index === chartData.length - 1) return true;
			// 前月と比較して変動があれば表示する。
			const prev = chartData[index - 1];
			return item.netWorth !== prev.netWorth;
		});
	}, [chartData, data]);

	// データが無い場合。
	if (!chartData || chartData.length <= 1) {
		if (variant === "cockpit" || variant === "overview") return null;
		return (
			<div className="fade-in mb-8">
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3 mb-4">
					資産推移
				</h2>
				<div className="bg-white p-4 md:p-6 rounded-xl shadow-sm">
					<NoDataState
						message="データが蓄積されると推移が表示されます"
						className="w-full h-80"
					/>
				</div>
			</div>
		);
	}

	const isCockpit = variant === "cockpit";
	const isOverview = variant === "overview";
	const strokeColor = isCockpit ? "#ffffff" : THEME_COLORS.primary;
	const gridColor = isCockpit ? "rgba(255,255,255,0.1)" : "#f3f4f6";
	const textColor = isCockpit ? "rgba(255,255,255,0.6)" : "#6b7280";

	return (
		<div className={`fade-in ${isCockpit || isOverview ? "h-full" : ""}`}>
			{!isCockpit && !isOverview && (
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3">
						資産推移
					</h2>
				</div>
			)}

			<div
				className={
					isCockpit
						? "w-full h-48 md:h-64 relative min-w-0" // Cockpit (Blue bg)
						: isOverview
							? "w-full h-64 md:h-72 relative min-w-0" // Overview (White bg, embedded)
							: "bg-white p-4 md:p-6 rounded-xl shadow-sm"
				}
			>
				<div
					className={
						isCockpit || isOverview
							? "w-full h-full"
							: "w-full h-80 md:h-96 relative min-w-0"
					}
				>
					<div style={{ width: "100%", height: "100%" }}>
						<ResponsiveContainer width="100%" height="100%" minWidth={0}>
							<ComposedChart
								data={displayData}
								margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
							>
								<defs>
									<linearGradient
										id="colorNetWorth"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor={strokeColor}
											stopOpacity={0.3}
										/>
										<stop
											offset="95%"
											stopColor={strokeColor}
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>

								<CartesianGrid
									strokeDasharray={isCockpit ? "4 4" : "3 3"}
									vertical={false}
									stroke={gridColor}
								/>

								<XAxis
									dataKey={data ? "date" : "month"}
									tick={{
										fill: textColor,
										fontSize: isMobile ? 10 : 11,
										fontWeight: 500,
									}}
									tickFormatter={(value) => {
										// 日次データの場合
										if (data && typeof value === "string") {
											const date = new Date(value);
											// 1日と15日だけ表示、あるいは間引く
											if (isMobile) {
												return `${date.getMonth() + 1}/${date.getDate()}`;
											}
											return `${date.getMonth() + 1}/${date.getDate()}`;
										}
										// 月次データの場合
										if (
											isMobile &&
											typeof value === "string" &&
											value.length >= 7
										) {
											return value.substring(5).replace("-", "/");
										}
										return value;
									}}
									axisLine={false}
									tickLine={false}
									dy={10}
									minTickGap={30}
									padding={{ left: 10, right: 10 }}
								/>

								<YAxis
									orientation="left"
									tick={{
										fill: textColor,
										fontSize: isMobile ? 10 : 11,
										fontWeight: 500,
									}}
									tickFormatter={(value) =>
										isCockpit && isMobile
											? "" // モバイルのCockpitではY軸ラベルを省略してすっきりさせる
											: formatLargeCurrency(value, isMasked)
									}
									axisLine={false}
									tickLine={false}
									width={isMobile ? 36 : 45}
								/>

								<Tooltip
									content={
										<CustomTooltip isMasked={isMasked} variant={variant} />
									}
									cursor={{
										stroke: textColor,
										strokeWidth: 1,
										strokeDasharray: "4 4",
									}}
									wrapperStyle={{ outline: "none" }}
								/>

								<Area
									type="monotone"
									dataKey={data ? "value" : "netWorth"}
									name={isCockpit ? "残高" : "総資産"}
									stroke={strokeColor}
									strokeWidth={isCockpit ? 2 : 3}
									fillOpacity={1}
									fill="url(#colorNetWorth)"
									dot={{
										r: 0,
										strokeWidth: 0,
									}}
									activeDot={{
										r: 6,
										strokeWidth: 2,
										stroke: "#fff",
										fill: strokeColor,
									}}
									animationDuration={800}
								/>
							</ComposedChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>
		</div>
	);
}
