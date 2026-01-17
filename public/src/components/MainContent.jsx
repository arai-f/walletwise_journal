import { useMemo } from "react";
import * as utils from "../utils.js";
import AccountBalances from "./AccountBalances.jsx";
import Advisor from "./Advisor.jsx";
import AnalysisReport from "./AnalysisReport.jsx";
import BillingList from "./BillingList.jsx";
import DashboardSummary from "./DashboardSummary.jsx";
import HistoryChart from "./HistoryChart.jsx";
import TransactionsSection from "./TransactionsSection.jsx";
import { MainContentSkeleton } from "./skeletons/MainContentSkeleton.jsx";

/**
 * アプリケーションのメインコンテンツを表示するコンポーネントである。
 * 資産一覧、推移グラフ、分析レポート、請求リスト、取引履歴などを管理・表示する。
 * @param {Object} props - プロパティ。
 * @param {Object} props.state - アプリケーションの全体ステート。
 * @param {Object} props.actions - アクション関数群。
 * @return {JSX.Element} メインコンテンツコンポーネント。
 */
export default function MainContent({ state, actions }) {
	const {
		config,
		transactions,
		luts,
		accountBalances,
		monthlyStats,
		isAmountMasked,
		currentMonthFilter,
		analysisMonth,
		loading,
	} = state;

	if (loading) {
		return <MainContentSkeleton />;
	}

	const {
		displayHistoricalData,
		visibleTransactions,
		analysisTargetTransactions,
		hasEnoughHistoryData,
		isDataInsufficient,
		availableMonths,
	} = useMemo(() => {
		const displayMonths = config.displayPeriod || 3;
		const displayStartDate = utils.getStartOfMonthAgo(displayMonths);

		const visible = transactions.filter((t) => t.date >= displayStartDate);

		const analysisTarget = ((transactions, filter) => {
			if (filter === "all-time") return transactions;
			const [year, month] = filter.split("-").map(Number);
			return transactions.filter((t) => {
				const yyyymm = utils.toYYYYMM(t.date);
				const [tYear, tMonth] = yyyymm.split("-").map(Number);
				return tYear === year && tMonth === month;
			});
		})(visible, analysisMonth || "all-time");

		let currentNetWorth = Object.values(accountBalances || {}).reduce(
			(sum, val) => sum + val,
			0
		);
		const historicalData = [];
		const stats = [...(monthlyStats || [])];
		const currentMonth = utils.toYYYYMM(new Date());

		if (!stats.some((s) => s.month === currentMonth)) {
			const currentMonthData = {
				month: currentMonth,
				income: 0,
				expense: 0,
				netChange: 0,
			};
			const insertIndex = stats.findIndex((s) => s.month < currentMonth);
			if (insertIndex === -1) stats.push(currentMonthData);
			else stats.splice(insertIndex, 0, currentMonthData);
		}

		for (const stat of stats) {
			historicalData.push({
				month: stat.month,
				netWorth: currentNetWorth,
				income: stat.income || 0,
				expense: stat.expense || 0,
				isFuture: stat.month > currentMonth,
			});
			currentNetWorth -= stat.netChange || 0;
		}

		const reversedData = historicalData.reverse();
		const startMonthStr = utils.toYYYYMM(displayStartDate);
		let filteredHistory = reversedData.filter((d) => d.month >= startMonthStr);

		while (filteredHistory.length > 0) {
			const lastRecord = filteredHistory[filteredHistory.length - 1];
			if (
				lastRecord.isFuture &&
				lastRecord.income === 0 &&
				lastRecord.expense === 0
			) {
				filteredHistory.pop();
			} else {
				break;
			}
		}

		const hasEnough =
			filteredHistory &&
			filteredHistory.length > 0 &&
			filteredHistory.some(
				(d) => d.netWorth !== 0 || d.income !== 0 || d.expense !== 0
			);

		const getBillingNeededMonths = () => {
			const rules = config.creditCardRules || {};
			let maxOffset = 0;
			for (const rule of Object.values(rules)) {
				const offset = (rule.paymentMonthOffset || 0) + 2;
				if (offset > maxOffset) maxOffset = offset;
			}
			return Math.max(maxOffset, 3);
		};
		const neededMonths = getBillingNeededMonths();
		const dataInsufficient = neededMonths > displayMonths;

		const getAvailable = (txs) => {
			if (utils.getAvailableMonths) return utils.getAvailableMonths(txs);
			const s = new Set(txs.map((t) => utils.toYYYYMM(t.date)));
			return Array.from(s).sort().reverse();
		};

		return {
			displayHistoricalData: filteredHistory,
			visibleTransactions: visible,
			analysisTargetTransactions: analysisTarget,
			hasEnoughHistoryData: hasEnough,
			isDataInsufficient: dataInsufficient,
			availableMonths: getAvailable(transactions),
		};
	}, [config, transactions, accountBalances, monthlyStats, analysisMonth]);

	const displayPeriod = config.displayPeriod || 3;
	const periodLabel =
		displayPeriod === 12 ? "過去1年" : `過去${displayPeriod}ヶ月`;

	return (
		<main computed-period={periodLabel}>
			<section id="home-section" className="mb-8">
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3 mb-4">
					資産一覧
				</h2>

				<div className="mb-6">
					<DashboardSummary
						accountBalances={accountBalances}
						isMasked={isAmountMasked}
						onMaskChange={actions.onMaskChange}
						luts={luts}
					/>
				</div>

				<div id="ai-advisor-card-container">
					<Advisor
						config={config}
						transactions={transactions}
						categories={luts.categories}
					/>
				</div>

				<div
					id="balances-grid"
					className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
				>
					<AccountBalances
						accountBalances={accountBalances}
						isMasked={isAmountMasked}
						transactions={transactions}
						accountsMap={luts.accounts}
					/>
				</div>
			</section>

			<section id="assets-history-section" className="mb-8 scroll-mt-20">
				<HistoryChart
					historicalData={displayHistoricalData}
					isMasked={isAmountMasked}
				/>
			</section>

			<section id="analysis-section" className="mb-8 scroll-mt-20">
				<AnalysisReport
					transactions={analysisTargetTransactions}
					luts={luts}
					targetMonth={analysisMonth || "all-time"}
					availableMonths={availableMonths}
					onMonthFilterChange={actions.onAnalysisMonthFilterChange}
					isMasked={isAmountMasked}
					historicalData={displayHistoricalData}
					initialMonth={analysisMonth}
					periodLabel={periodLabel}
				/>
			</section>

			<section id="billing-section" className="mb-6">
				<h2 className="text-lg md:text-xl font-bold mb-4 text-neutral-900 border-l-4 border-primary pl-3">
					次回のカード支払い予定
				</h2>
				<div className="space-y-4">
					<BillingList
						transactions={transactions}
						creditCardRules={config.creditCardRules || {}}
						isMasked={isAmountMasked}
						luts={luts}
						isDataInsufficient={isDataInsufficient}
						onRecordPayment={actions.onRecordPayment}
						onOpenSettings={actions.onOpenSettings}
						accountBalances={accountBalances}
						displayPeriod={config.displayPeriod}
						onPeriodChange={() =>
							actions.onPeriodChange(
								Math.max((config.displayPeriod || 3) + 3, 6)
							)
						}
					/>
				</div>
			</section>

			<section id="transactions-section">
				<TransactionsSection
					transactions={visibleTransactions}
					currentMonthFilter={currentMonthFilter}
					onMonthChange={actions.onMonthChange}
					onAddClick={actions.onAddClick}
					onTransactionClick={actions.onTransactionClick}
					onScanClick={actions.onScanClick}
					onRecordPayment={actions.onRecordPayment}
					luts={luts}
					isMasked={isAmountMasked}
				/>
			</section>
		</main>
	);
}
