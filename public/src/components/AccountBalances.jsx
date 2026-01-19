import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import * as utils from "../utils.js";

const CustomTooltip = ({ active, payload, label, isMasked }) => {
	if (active && payload && payload.length) {
		return (
			<div className="bg-white/95 backdrop-blur-sm border border-neutral-200 p-3 rounded-lg shadow-lg text-sm">
				<p className="font-bold text-neutral-700 mb-1">
					{utils.toYYYYMMDD(label).replace(/-/g, "/")}
				</p>
				<div className="flex items-center gap-2">
					<span className="text-neutral-500 text-xs">残高</span>
					<span className="font-bold tabular-nums text-indigo-600">
						{utils.formatCurrency(payload[0].value, isMasked)}
					</span>
				</div>
			</div>
		);
	}
	return null;
};

/**
 * 口座残高一覧表示コンポーネント。
 * 各口座のカードをグリッド表示し、クリック時にその口座の残高推移グラフを展開表示する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.accountBalances - 口座IDをキーとした現在残高のマップ。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {Array} props.transactions - グラフ計算用の全トランザクション履歴。
 * @param {Map} props.accountsMap - 口座情報のマップ。
 * @returns {JSX.Element} 口座残高一覧コンポーネント。
 */
export default function AccountBalances({
	accountBalances,
	isMasked,
	transactions,
	accountsMap = new Map(),
}) {
	const [activeAccountId, setActiveAccountId] = useState(null);

	const accounts = utils.sortItems(
		[...(accountsMap?.values?.() || [])].filter(
			(a) => !a.isDeleted && a.type === "asset",
		),
	);

	const handleCardClick = (accountId) => {
		if (activeAccountId === accountId) {
			setActiveAccountId(null);
		} else {
			setActiveAccountId(accountId);
		}
	};

	/**
	 * 特定の口座の残高履歴データを計算する。
	 * 現在の残高から過去の取引を遡って日次の残高を算出する。
	 *
	 * @param {string} accountId - 対象の口座ID
	 * @returns {Array<{x: Date, y: number}>|null} グラフ描画用データ配列、またはデータ不足時はnull
	 */
	const calculateHistory = (accountId) => {
		const periodTransactions = transactions;
		const currentBalances = accountBalances;

		const relevantTxns = periodTransactions
			.filter(
				(t) =>
					t.accountId === accountId ||
					t.fromAccountId === accountId ||
					t.toAccountId === accountId,
			)
			.sort((a, b) => a.date.getTime() - b.date.getTime());

		if (relevantTxns.length <= 1) return null;

		const dailyBalances = {};
		let runningBalance = 0;

		let startingBalance = currentBalances[accountId] || 0;
		const reversedTxns = [...relevantTxns].reverse();
		for (const t of reversedTxns) {
			if (t.type === "transfer") {
				if (t.fromAccountId === accountId) startingBalance += t.amount;
				if (t.toAccountId === accountId) startingBalance -= t.amount;
			} else if (t.accountId === accountId) {
				const sign = t.type === "income" ? -1 : 1;
				startingBalance += t.amount * sign;
			}
		}
		runningBalance = startingBalance;

		relevantTxns.forEach((t) => {
			if (t.type === "transfer") {
				if (t.fromAccountId === accountId) runningBalance -= t.amount;
				if (t.toAccountId === accountId) runningBalance += t.amount;
			} else if (t.accountId === accountId) {
				const sign = t.type === "income" ? 1 : -1;
				runningBalance += t.amount * sign;
			}
			dailyBalances[t.date.toISOString().split("T")[0]] = runningBalance;
		});

		if (relevantTxns.length === 0 && currentBalances[accountId] !== undefined) {
			dailyBalances[new Date().toISOString().split("T")[0]] =
				currentBalances[accountId];
		}

		if (Object.keys(dailyBalances).length === 0) return null;

		return Object.entries(dailyBalances)
			.map(([date, balance]) => ({ x: new Date(date), y: balance }))
			.sort((a, b) => a.x.getTime() - b.x.getTime());
	};

	const activeHistoryData = activeAccountId
		? calculateHistory(activeAccountId)
		: null;

	return (
		<>
			{/* グリッドアイテム */}
			{accounts.map((account) => {
				const balance = accountBalances[account.id] || 0;
				const balanceColorClass = balance >= 0 ? "text-success" : "text-danger";
				const isActive = activeAccountId === account.id;

				return (
					<div
						key={account.id}
						className={`balance-card bg-white p-3 rounded-lg shadow-sm cursor-pointer hover-lift transition-all duration-200 ${
							isActive ? "ring-2 ring-indigo-500" : ""
						}`}
						onClick={() => handleCardClick(account.id)}
						data-account-id={account.id}
					>
						<div className="flex items-center text-sm font-medium text-neutral-600 pointer-events-none">
							<i
								className={`${account.icon || "fa-solid fa-wallet"} w-4 mr-2`}
							></i>
							<h4>{account.name}</h4>
						</div>
						<p
							className={`text-xl font-semibold text-right ${balanceColorClass} pointer-events-none`}
						>
							{utils.formatCurrency(balance, isMasked)}
						</p>
					</div>
				);
			})}

			{/* 履歴チャートコンテナ（グリッドに追加され、全幅に広がる） */}
			{activeAccountId && (
				<div
					className="col-span-2 sm:col-span-3 md:col-span-4 bg-white p-4 rounded-lg shadow-sm mt-2 h-64 flex items-center justify-center fade-in-up"
					data-parent-account-id={activeAccountId}
				>
					{activeHistoryData ? (
						<div className="w-full h-full min-w-0">
							<ResponsiveContainer width="100%" height="100%" minWidth={0}>
								<AreaChart
									data={activeHistoryData}
									margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
								>
									<defs>
										<linearGradient
											id="colorBalance"
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1} />
											<stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
										</linearGradient>
									</defs>
									<CartesianGrid
										strokeDasharray="3 3"
										vertical={false}
										stroke="#f3f4f6"
									/>
									<XAxis
										dataKey="x"
										tickFormatter={(date) =>
											date instanceof Date
												? `${date.getMonth() + 1}/${date.getDate()}`
												: date
										}
										tick={{
											fontSize: 11,
											fill: "#6b7280",
										}}
										axisLine={false}
										tickLine={false}
										minTickGap={30}
									/>
									<YAxis
										tickFormatter={(value) =>
											utils.formatLargeCurrency(value, isMasked)
										}
										tick={{
											fontSize: 11,
											fill: "#9ca3af",
										}}
										axisLine={false}
										tickLine={false}
										width={45}
									/>
									<Tooltip
										content={<CustomTooltip isMasked={isMasked} />}
										cursor={{
											stroke: "#4F46E5",
											strokeWidth: 1,
											strokeDasharray: "3 3",
										}}
									/>
									<Area
										type="stepAfter"
										dataKey="y"
										stroke="#4F46E5"
										fill="url(#colorBalance)"
										strokeWidth={2}
										activeDot={{ r: 4, strokeWidth: 0, fill: "#4F46E5" }}
										animationDuration={500}
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					) : (
						<p className="text-neutral-600">
							表示できる十分な取引データがありません
						</p>
					)}
				</div>
			)}
		</>
	);
}
