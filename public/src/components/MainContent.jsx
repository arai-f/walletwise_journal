import { lazy, Suspense, useEffect, useState } from "react";
import { useDashboardData } from "../hooks/useDashboardData.js";
import AccountBalances from "./AccountBalances.jsx";
import Advisor from "./Advisor.jsx";
import BillingList from "./BillingList.jsx";
import DashboardSummary from "./DashboardSummary.jsx";
import TransactionsSection from "./TransactionsSection.jsx";
import BottomNavigation from "./layout/BottomNavigation.jsx";
import { MainContentSkeleton } from "./skeletons/MainContentSkeleton.jsx";

const HistoryChart = lazy(() => import("./HistoryChart.jsx"));
const AnalysisReport = lazy(() => import("./AnalysisReport.jsx"));

// ローディング中のプレースホルダー（チラつき防止）
const ChartSkeleton = () => (
	<div className="w-full h-80 bg-neutral-50 rounded-xl animate-pulse flex items-center justify-center text-neutral-300">
		<i className="fas fa-chart-area text-4xl"></i>
	</div>
);

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
		config = {},
		transactions = [],
		luts = {},
		accountBalances = {},
		monthlyStats = [],
		isAmountMasked,
		currentMonthFilter,
		analysisMonth,
		loading,
	} = state || {};

	const [activeSection, setActiveSection] = useState("home-section");

	// スクロールスパイ (BottomNavigation用)
	useEffect(() => {
		if (loading) return;

		const sections = document.querySelectorAll("main > section[id]");
		if (sections.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActiveSection(entry.target.id);
					}
				});
			},
			{
				// ヘッダー付近(上部)を判定ラインとする
				rootMargin: "-100px 0px -70% 0px",
				threshold: 0,
			},
		);

		sections.forEach((section) => observer.observe(section));

		return () => observer.disconnect();
	}, [loading]);

	const {
		displayHistoricalData,
		visibleTransactions,
		analysisTargetTransactions,
		isDataInsufficient,
		availableMonths,
	} = useDashboardData({
		config,
		transactions,
		accountBalances,
		monthlyStats,
		analysisMonth,
	});

	const displayPeriod = config?.displayPeriod || 3;
	const periodLabel =
		displayPeriod === 12 ? "過去1年" : `過去${displayPeriod}ヶ月`;

	const handleBottomNav = (sectionId) => {
		if (sectionId === "home-section") {
			window.scrollTo({ top: 0, behavior: "smooth" });
			return;
		}
		const element = document.getElementById(sectionId);
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
	};

	if (loading) {
		return <MainContentSkeleton />;
	}

	return (
		<main computed-period={periodLabel} className="pb-24 md:pb-8">
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
				<Suspense fallback={<ChartSkeleton />}>
					<HistoryChart
						historicalData={displayHistoricalData}
						isMasked={isAmountMasked}
					/>
				</Suspense>
			</section>

			<section id="analysis-section" className="mb-8 scroll-mt-20">
				<Suspense
					fallback={
						<div className="bg-white p-6 rounded-xl shadow-sm h-96 animate-pulse" />
					}
				>
					<AnalysisReport
						transactions={analysisTargetTransactions}
						luts={luts}
						targetMonth={analysisMonth || "all-time"}
						availableMonths={availableMonths}
						onMonthFilterChange={actions.onAnalysisMonthFilterChange}
						isMasked={isAmountMasked}
						historicalData={displayHistoricalData}
						initialMonth={analysisMonth}
					/>
				</Suspense>
			</section>

			<section id="billing-section" className="mb-6 scroll-mt-20">
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
								Math.max((config.displayPeriod || 3) + 3, 6),
							)
						}
					/>
				</div>
			</section>

			<section id="transactions-section" className="scroll-mt-20">
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

			<BottomNavigation
				activeSection={activeSection}
				onNavigate={handleBottomNav}
				onOpenAdd={actions.onAddClick}
				onOpenSettings={actions.onOpenSettings}
			/>
		</main>
	);
}
