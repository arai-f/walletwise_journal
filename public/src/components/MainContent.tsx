import {
	lazy,
	Suspense,
	useCallback,
	useDeferredValue,
	useMemo,
	useState,
} from "react";
import { useActiveSection } from "../hooks/useActiveSection";
import { useDashboardData } from "../hooks/useDashboardData";
import Advisor from "./Advisor";
import BillingList from "./BillingList";
import DashboardSummary from "./DashboardSummary";
import BottomNavigation from "./layout/BottomNavigation";
import TransactionsSection from "./TransactionsSection";

const AnalysisReport = lazy(() => import("./AnalysisReport"));

/**
 * アプリケーションのメインコンテンツを表示するコンポーネントである。
 * 資産一覧、推移グラフ、分析レポート、請求リスト、取引履歴などを管理・表示する。
 * @param {Object} props - プロパティ。
 * @param {Object} props.state - アプリケーションの全体ステート。
 * @param {Object} props.actions - アクション関数群。
 * @returns {JSX.Element} メインコンテンツコンポーネント。
 */
export default function MainContent({ state, actions }) {
	const {
		config = {},
		transactions = [],
		luts = {},
		accountBalances = {},
		isAmountMasked,
		currentMonthFilter,
		analysisMonth,
		loading,
	} = state || {};

	const { activeSection, scrollToSection: handleBottomNav } = useActiveSection({
		dependency: loading,
	});
	const [sourceFilter, setSourceFilter] = useState("all");
	const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
	const [searchTerm, setSearchTerm] = useState("");
	const deferredSearchTerm = useDeferredValue(searchTerm);

	const {
		displayHistoricalData,
		visibleTransactions,
		dailyTotalHistory,
		getAccountHistory,
		analysisTargetTransactions,
		isDataInsufficient,
		availableMonths,
	} = useDashboardData({
		config,
		transactions,
		accountBalances,
		analysisMonth,
	});

	const displayPeriod = config?.displayPeriod || 3;
	const periodLabel =
		displayPeriod === 12 ? "過去1年" : `過去${displayPeriod}ヶ月`;

	const handleFilterReset = useCallback(() => {
		setSourceFilter("all");
		setPaymentMethodFilter("all");
		setSearchTerm("");
	}, []);

	const filterHandlers = useMemo(
		() => ({
			source: setSourceFilter,
			paymentMethod: setPaymentMethodFilter,
			search: setSearchTerm,
		}),
		[],
	);

	return (
		<main computed-period={periodLabel} className="pb-24 md:pb-8">
			<section id="home-section" className="mb-8">
				<div className="mb-6">
					<DashboardSummary
						accountBalances={accountBalances}
						isMasked={isAmountMasked}
						onMaskChange={actions.onMaskChange}
						luts={luts}
						dailyData={dailyTotalHistory}
						calculateAccountHistory={getAccountHistory}
					/>
				</div>

				<div id="ai-advisor-card-container">
					<Advisor
						config={config}
						transactions={transactions}
						categories={luts.categories}
					/>
				</div>
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
					periodLabel={periodLabel}
					currentMonthFilter={currentMonthFilter}
					onMonthChange={actions.onMonthChange}
					onAddClick={actions.onAddClick}
					onTransactionClick={actions.onTransactionClick}
					onRecordPayment={actions.onRecordPayment}
					luts={luts}
					filters={{
						sourceFilter,
						paymentMethodFilter,
						searchTerm,
						deferredSearchTerm,
					}}
					onFilterChange={filterHandlers}
					onFilterReset={handleFilterReset}
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
