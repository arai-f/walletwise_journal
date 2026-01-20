import { useMemo, useState } from "react";
import * as utils from "../utils.js";
import HistoryChart from "./HistoryChart.jsx";

/**
 * Interactive Asset Cockpit コンポーネント。
 * 純資産、または選択された口座の残高と、その推移チャートを表示する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.accountBalances - 口座ごとの現在残高マップ。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {object} props.luts - 口座情報などを含むルックアップテーブル。
 * @param {Array} props.dailyData - 日次推移データ（Total）。
 * @param {Function} props.calculateAccountHistory - 口座別推移計算関数。
 * @returns {JSX.Element} ダッシュボード資産サマリーコンポーネント。
 */
export default function DashboardSummary({
	accountBalances,
	isMasked,
	onMaskChange,
	luts,
	dailyData,
	calculateAccountHistory,
}) {
	const [selectedAccountId, setSelectedAccountId] = useState(null);
	const safeAccounts = luts?.accounts ? luts.accounts : new Map();
	// 資産と負債の合計を計算する。
	const { totalAssets, totalLiabilities } = Array.from(
		safeAccounts.values(),
	).reduce(
		(acc, account) => {
			if (account.isDeleted) return acc;

			const currentBalance = accountBalances[account.id] || 0;
			if (account.type === "asset") {
				acc.totalAssets += currentBalance;
			} else if (account.type === "liability") {
				acc.totalLiabilities += currentBalance;
			}
			return acc;
		},
		{ totalAssets: 0, totalLiabilities: 0 },
	);

	// 表示データの決定
	const isTotal = !selectedAccountId;
	const selectedAccount = selectedAccountId
		? safeAccounts.get(selectedAccountId)
		: null;

	const displayValue = isTotal
		? totalAssets + totalLiabilities
		: accountBalances[selectedAccountId] || 0;

	const displayLabel = isTotal
		? "純資産 (資産 - 負債)"
		: `${selectedAccount?.name || "口座"} 残高`;

	// チャートデータの準備
	const chartData = useMemo(() => {
		if (isTotal) return dailyData;
		if (calculateAccountHistory) {
			return calculateAccountHistory(selectedAccountId);
		}
		return [];
	}, [isTotal, selectedAccountId, dailyData, calculateAccountHistory]);

	const format = (val) => utils.formatCurrency(val, isMasked);

	return (
		<div className="flex flex-col gap-4 fade-in">
			<div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-500">
				{/* 上部: 青背景のサマリーエリア */}
				<div className="bg-linear-to-r from-primary to-violet-600 p-5 md:p-6 text-white relative">
					{/* 背景装飾 */}
					<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>

					<div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
						<div className="flex flex-col">
							<div className="flex items-center gap-2 mb-1 md:mb-2">
								<h3 className="text-white/90 text-sm font-bold tracking-wide">
									{displayLabel}
								</h3>
								{onMaskChange && (
									<button
										onClick={() => onMaskChange(!isMasked)}
										className="text-white/70 hover:text-white transition-colors p-1 -mt-1 rounded-full hover:bg-white/10"
										aria-label={isMasked ? "金額を表示する" : "金額を隠す"}
									>
										<i
											className={`fa-solid ${
												isMasked ? "fa-eye-slash" : "fa-eye"
											} text-sm`}
										></i>
									</button>
								)}
							</div>
							<p
								key={displayValue}
								className="text-3xl md:text-4xl font-bold tracking-tight flash-update-white"
							>
								{format(displayValue)}
							</p>
						</div>

						{isTotal && (
							<div className="grid grid-cols-2 gap-4 md:flex md:gap-6 text-sm border-t border-white/10 md:border-t-0 md:border-l md:border-white/20 pt-4 md:pt-0 md:pl-6">
								<div>
									<span className="block text-white/70 text-xs mb-0.5">
										総資産
									</span>
									<span className="block font-bold text-lg">
										{format(totalAssets)}
									</span>
								</div>
								<div>
									<span className="block text-white/70 text-xs mb-0.5">
										総負債
									</span>
									<span className="block font-bold text-lg">
										{format(totalLiabilities)}
									</span>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 下部: 白背景のチャートエリア */}
				<div className="p-4 md:p-6 bg-white">
					<HistoryChart
						data={chartData}
						isMasked={isMasked}
						variant="overview"
					/>
				</div>
			</div>

			{/* 口座リスト (Grid) */}
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
				{utils
					.sortItems(
						Array.from(safeAccounts.values()).filter(
							(a) => !a.isDeleted && a.type === "asset",
						),
					)
					.map((account) => {
						const balance = accountBalances[account.id] || 0;
						const balanceColorClass =
							balance >= 0 ? "text-success" : "text-danger";
						const isActive = selectedAccountId === account.id;

						return (
							<div
								key={account.id}
								className={`relative bg-white p-3 rounded-xl shadow-sm border border-neutral-100 cursor-pointer transition-all duration-200 group overflow-hidden ${
									isActive
										? "ring-2 ring-indigo-500 ring-offset-1"
										: "hover:shadow-md hover:border-neutral-200 hover:-translate-y-0.5"
								}`}
								onClick={() =>
									setSelectedAccountId(isActive ? null : account.id)
								}
							>
								{/* 背景アイコン装飾 */}
								<i
									className={`${account.icon || "fa-solid fa-wallet"} absolute -right-2 -bottom-4 text-5xl text-neutral-100 opacity-0 group-hover:opacity-100 transition-all duration-500 transform rotate-12 pointer-events-none`}
								></i>

								<div className="relative z-10 flex flex-col h-full justify-between gap-0.5">
									<div className="flex items-center justify-between mb-0.5">
										<span className="text-xs font-bold text-neutral-500 truncate pr-2 leading-tight">
											{account.name}
										</span>
										<div
											className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-indigo-600 text-white" : "bg-neutral-50 text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"}`}
										>
											<i
												className={`${account.icon || "fa-solid fa-wallet"} text-[10px]`}
											></i>
										</div>
									</div>
									<p
										className={`text-lg font-bold tracking-tight text-right truncate ${balanceColorClass}`}
									>
										{format(balance)}
									</p>
								</div>
							</div>
						);
					})}
			</div>
		</div>
	);
}
