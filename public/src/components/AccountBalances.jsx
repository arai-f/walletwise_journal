import { useEffect, useRef, useState } from "react";
import * as utils from "../utils.js";

/**
 * 口座残高一覧表示コンポーネント。
 * 各口座のカードをグリッド表示し、クリック時にその口座の残高推移グラフを展開表示する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.accountBalances - 口座IDをキーとした現在残高のマップ。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {Array} props.transactions - グラフ計算用の全トランザクション履歴。
 * @param {Map} props.accountsMap - 口座情報のマップ。
 * @return {JSX.Element} 口座残高一覧コンポーネント。
 */
export default function AccountBalances({
	accountBalances,
	isMasked,
	transactions,
	accountsMap = new Map(),
}) {
	const [activeAccountId, setActiveAccountId] = useState(null);
	const chartContainerRef = useRef(null);
	const chartInstanceRef = useRef(null);

	const accounts = utils.sortItems(
		[...(accountsMap?.values?.() || [])].filter(
			(a) => !a.isDeleted && a.type === "asset"
		)
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
	 * @returns {Array<{x: Date, y: number}> | null} グラフ描画用データ配列、またはデータ不足時はnull
	 */
	const calculateHistory = (accountId) => {
		const periodTransactions = transactions; // Assuming all available transactions are passed
		const currentBalances = accountBalances;

		const relevantTxns = periodTransactions
			.filter(
				(t) =>
					t.accountId === accountId ||
					t.fromAccountId === accountId ||
					t.toAccountId === accountId
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

	/**
	 * アクティブな口座が変更されたときにグラフを描画（または再描画）する副作用。
	 * Chart.jsを動的にインポートして使用する。
	 */
	useEffect(() => {
		let isCancelled = false;

		const renderChart = async () => {
			if (!activeAccountId || !chartContainerRef.current) return;

			if (chartInstanceRef.current) {
				chartInstanceRef.current.destroy();
				chartInstanceRef.current = null;
			}

			const historyData = calculateHistory(activeAccountId);
			if (!historyData) return;

			const { Chart, registerables } = await import("chart.js");
			await import("chartjs-adapter-date-fns");
			Chart.register(...registerables);

			if (isCancelled) return;

			const ctx = chartContainerRef.current.getContext("2d");
			const accountName = accountsMap.get(activeAccountId)?.name || "";

			chartInstanceRef.current = new Chart(ctx, {
				type: "line",
				data: {
					datasets: [
						{
							label: `${accountName} の残高推移`,
							data: historyData,
							borderColor: "#4F46E5",
							backgroundColor: "rgba(79, 70, 229, 0.1)",
							fill: true,
							tension: 0,
							stepped: true,
							borderWidth: 2,
							pointRadius: 0,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (c) =>
									`残高: ${utils.formatCurrency(c.raw.y, isMasked)}`,
							},
						},
					},
					scales: {
						x: {
							type: "time",
							time: {
								unit: "day",
								tooltipFormat: "yyyy/MM/dd",
								displayFormats: { day: "MM/dd" },
								round: "day",
							},
						},
						y: {
							ticks: {
								callback: (value) => utils.formatLargeCurrency(value, isMasked),
							},
						},
					},
				},
			});
		};

		renderChart();

		return () => {
			isCancelled = true;
			if (chartInstanceRef.current) {
				chartInstanceRef.current.destroy();
			}
		};
	}, [activeAccountId, transactions, accountBalances, isMasked, accountsMap]);

	const activeHistoryData = activeAccountId
		? calculateHistory(activeAccountId)
		: null;

	return (
		<>
			{/* Grid Items */}
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

			{/* History Chart Container (appended to grid, spanning full width) */}
			{activeAccountId && (
				<div
					className="col-span-2 sm:col-span-3 md:col-span-4 bg-white p-4 rounded-lg shadow-sm mt-2 h-64 flex items-center justify-center fade-in-up"
					data-parent-account-id={activeAccountId}
				>
					{activeHistoryData ? (
						<canvas
							ref={chartContainerRef}
							id="balance-history-chart-canvas"
						></canvas>
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
