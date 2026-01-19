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
 * @returns {JSX.Element|null} ツールチップ要素。
 */
const CustomTooltip = ({ active, payload, label, isMasked }) => {
	if (active && payload && payload.length) {
		// データから本来のデータオブジェクトを取得
		const data = payload[0].payload;
		const netChange = (data.income || 0) - (data.expense || 0);
		const isPositive = netChange >= 0;

		return (
			<div className="bg-white/95 backdrop-blur-sm border border-neutral-200 p-3 rounded-lg shadow-lg text-sm">
				<p className="font-bold text-neutral-700 mb-2">
					{typeof label === "string" ? `${label.replace("-", "年")}月` : label}
				</p>
				<div className="space-y-2">
					{/* 総資産 */}
					<div className="flex items-center justify-between gap-4">
						<span className="text-neutral-500 text-xs">総資産</span>
						<span className="font-bold tabular-nums text-neutral-700 text-base">
							{formatCurrency(data.netWorth, isMasked)}
						</span>
					</div>
					{/* その月の収支差（グラフには出さないが補足情報として表示） */}
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
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @returns {JSX.Element} チャートコンポーネント。
 */
export default function HistoryChart({ historicalData, isMasked }) {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// 資産額に変動がない月をフィルタリングする（最初と最後は残す）。
	const displayData = useMemo(() => {
		if (!historicalData || historicalData.length === 0) return [];
		if (historicalData.length === 1) return historicalData;

		return historicalData.filter((item, index) => {
			// 最初と最後は必ず表示する。
			if (index === 0 || index === historicalData.length - 1) return true;
			// 前月と比較して変動があれば表示する。
			const prev = historicalData[index - 1];
			return item.netWorth !== prev.netWorth;
		});
	}, [historicalData]);

	// データが無い場合。
	if (!historicalData || historicalData.length <= 1) {
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

	return (
		<div className="fade-in">
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3">
					資産推移
				</h2>
			</div>

			<div className="bg-white p-4 md:p-6 rounded-xl shadow-sm">
				<div className="w-full h-80 md:h-96 relative min-w-0">
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
											stopColor={THEME_COLORS.primary}
											stopOpacity={0.3}
										/>
										<stop
											offset="95%"
											stopColor={THEME_COLORS.primary}
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>

								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									stroke="#f3f4f6"
								/>

								<XAxis
									dataKey="month"
									tick={{
										fill: "#6b7280",
										fontSize: isMobile ? 10 : 11,
										fontWeight: 500,
									}}
									tickFormatter={(value) => {
										if (
											isMobile &&
											typeof value === "string" &&
											value.length >= 7
										) {
											return value.substring(2).replace("-", "/");
										}
										return value;
									}}
									axisLine={false}
									tickLine={false}
									dy={10}
									padding={{ left: 20, right: 20 }}
								/>

								<YAxis
									orientation="left"
									tick={{
										fill: "#9ca3af",
										fontSize: isMobile ? 10 : 11,
										fontWeight: 500,
									}}
									tickFormatter={(value) =>
										formatLargeCurrency(value, isMasked)
									}
									axisLine={false}
									tickLine={false}
									width={isMobile ? 36 : 45}
								/>

								<Tooltip
									content={<CustomTooltip isMasked={isMasked} />}
									cursor={{
										stroke: "#6b7280",
										strokeWidth: 1,
										strokeDasharray: "4 4",
									}}
									wrapperStyle={{ outline: "none" }}
								/>

								<Area
									type="monotone"
									dataKey="netWorth"
									name="総資産"
									stroke={THEME_COLORS.primary}
									strokeWidth={3}
									fillOpacity={1}
									fill="url(#colorNetWorth)"
									dot={{
										r: 4,
										strokeWidth: 2,
										fill: "#fff",
										stroke: THEME_COLORS.primary,
									}}
									activeDot={{ r: 6, strokeWidth: 0 }}
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
