import { useEffect, useState } from "react";
import {
	Area,
	Bar,
	CartesianGrid,
	ComposedChart,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { THEME_COLORS, formatCurrency, formatLargeCurrency } from "../utils.js";
import NoDataState from "./ui/NoDataState";

const FONT_FAMILY = '"Inter", "BIZ UDPGothic", sans-serif';

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
		return (
			<div
				className="bg-white/95 backdrop-blur-sm border border-neutral-200 p-3 rounded-lg shadow-lg text-sm"
				style={{ fontFamily: FONT_FAMILY }}
			>
				<p className="font-bold text-neutral-700 mb-2">
					{typeof label === "string" ? `${label.replace("-", "年")}月` : label}
				</p>
				<div className="space-y-1">
					{payload.map((entry, index) => (
						<div key={index} className="flex items-center gap-2">
							<div
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: entry.color }}
							/>
							<span className="text-neutral-500 w-16 text-xs">
								{entry.name}
							</span>
							<span className="font-bold tabular-nums text-neutral-700">
								{formatCurrency(entry.value, isMasked)}
							</span>
						</div>
					))}
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
	const [chartMode, setChartMode] = useState("asset"); // 'asset' | 'balance'

	// モバイル判定
	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// コンテンツ部分のレンダラー
	const renderContent = () => {
		// データが無い場合
		if (!historicalData || historicalData.length <= 1) {
			return (
				<NoDataState message="取引データがありません" className="w-full h-80" />
			);
		}

		// データがある場合
		return (
			<div className="w-full h-80 md:h-96 relative min-w-0">
				<ResponsiveContainer width="100%" height="100%" minWidth={0}>
					<ComposedChart
						data={historicalData}
						margin={{
							top: 10,
							right: 10,
							bottom: 0,
							left: 0,
						}}
					>
						<defs>
							<linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
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
								fontFamily: FONT_FAMILY,
								fontWeight: 500,
							}}
							tickFormatter={(value) => {
								if (
									isMobile &&
									typeof value === "string" &&
									value.length >= 7
								) {
									// "2024-01" -> "24/01"
									return value.substring(2).replace("-", "/");
								}
								return value;
							}}
							axisLine={false}
							tickLine={false}
							dy={10}
							padding={{ left: 30, right: 30 }}
						/>

						<YAxis
							orientation="left"
							tick={{
								fill: "#9ca3af",
								fontSize: isMobile ? 10 : 11,
								fontFamily: FONT_FAMILY,
								fontWeight: 500,
							}}
							tickFormatter={(value) => formatLargeCurrency(value, isMasked)}
							axisLine={false}
							tickLine={false}
							width={isMobile ? 36 : 45}
						/>

						<Tooltip
							content={<CustomTooltip isMasked={isMasked} />}
							cursor={{ fill: "transparent" }}
							wrapperStyle={{ outline: "none" }}
						/>

						<Legend
							verticalAlign="bottom"
							height={36}
							iconType="circle"
							iconSize={8}
							wrapperStyle={{
								fontSize: isMobile ? "11px" : "12px",
								paddingTop: "10px",
								fontFamily: FONT_FAMILY,
							}}
						/>

						{chartMode === "balance" && (
							<>
								<Bar
									dataKey="income"
									name="収入"
									fill={THEME_COLORS.success}
									barSize={isMobile ? 12 : 24}
									radius={[4, 4, 0, 0]}
									fillOpacity={0.9}
									animationDuration={500}
								/>
								<Bar
									dataKey="expense"
									name="支出"
									fill={THEME_COLORS.danger}
									barSize={isMobile ? 12 : 24}
									radius={[4, 4, 0, 0]}
									fillOpacity={0.9}
									animationDuration={500}
								/>
							</>
						)}

						{chartMode === "asset" && (
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
								animationDuration={500}
							/>
						)}
					</ComposedChart>
				</ResponsiveContainer>
			</div>
		);
	};

	return (
		<div className="fade-in">
			{/* ヘッダーエリア：タイトルとサイズアップしたトグルスイッチ */}
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3">
					資産推移
				</h2>
				<div className="bg-neutral-100 p-1 rounded-lg inline-flex items-center">
					<button
						onClick={() => setChartMode("asset")}
						className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all duration-200 ${
							chartMode === "asset"
								? "bg-white text-neutral-800 shadow-sm"
								: "text-neutral-500 hover:text-neutral-700"
						}`}
						style={{ fontFamily: FONT_FAMILY }}
					>
						総資産
					</button>
					<button
						onClick={() => setChartMode("balance")}
						className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all duration-200 ${
							chartMode === "balance"
								? "bg-white text-neutral-800 shadow-sm"
								: "text-neutral-500 hover:text-neutral-700"
						}`}
						style={{ fontFamily: FONT_FAMILY }}
					>
						収支
					</button>
				</div>
			</div>

			{/* カードエリア */}
			<div className="bg-white p-4 md:p-6 rounded-xl shadow-sm">
				{renderContent()}
			</div>
		</div>
	);
}
