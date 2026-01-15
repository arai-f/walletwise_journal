import { deleteApp } from "firebase/app";
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AppProvider } from "./contexts/AppContext.jsx";
import { app } from "./firebase.js";
import { useWalletData } from "./hooks/useWalletData.js";
import * as utils from "./utils.js";

import AccountBalances from "./components/AccountBalances.jsx";
import Advisor from "./components/Advisor.jsx";
import AnalysisReport from "./components/AnalysisReport.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import BillingList from "./components/BillingList.jsx";
import DashboardSummary from "./components/DashboardSummary.jsx";
import HistoryChart from "./components/HistoryChart.jsx";
import Header from "./components/layout/Header.jsx";
import TransactionModal from "./components/TransactionModal.jsx";
import TransactionsSection from "./components/TransactionsSection.jsx";

const Portal = ({ children, targetId }) => {
	const target = utils.dom.get(targetId);
	return target ? createPortal(children, target) : null;
};

// Removed useDomVisibility hook as it is no longer needed

/**
 * アプリケーションのメインコンテンツコンポーネント。
 * 認証後のレイアウト、ダッシュボード、グラフ、設定画面などを構成する。
 * @param {object} props - コンポーネントプロパティ。
 * @param {object} props.state - アプリケーションの現在の状態オブジェクト。
 * @param {object} props.actions - アプリケーションのアクション（ステート更新関数など）。
 * @returns {JSX.Element} メインコンテンツのJSX要素。
 */
const MainContent = ({ state, actions }) => {
	const {
		config,
		transactions,
		luts,
		accountBalances,
		monthlyStats,
		isAmountMasked,
		currentMonthFilter,
		analysisMonth,
		// Injected props
		user,
	} = state;

	// UI Logic & Derived State
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

		// Historical Data Calculation
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

		// 未来の月で、かつ収支がない場合は表示から除外する（末尾からチェック）
		// これにより、未来の取引を削除した場合にグラフが不必要に伸びるのを防ぐ
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

		// Billing Logic
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

		// Analysis Dropdown Months
		const getAvailable = (txs) => {
			// utils.getAvailableMonths があれば使うが、ない場合は簡易実装
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
		<main>
			<section id="home-section" className="mb-8">
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3 mb-4">
					資産一覧
				</h2>

				<div className="mb-6">
					<DashboardSummary
						accountBalances={accountBalances}
						isMasked={isAmountMasked}
						luts={luts}
					/>
				</div>

				<div id="ai-advisor-card-container">
					<Advisor
						monthlyStats={monthlyStats}
						today={new Date()}
						currentMonthFilter={currentMonthFilter}
						onMonthChange={actions.onMonthChange}
						transactions={transactions}
						luts={luts}
						user={user}
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
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3 mb-4">
					資産推移
				</h2>
				<div className="bg-white p-4 md:p-6 rounded-xl shadow-sm">
					{hasEnoughHistoryData ? (
						<div className="scroll-hint-wrapper w-full">
							<div
								className="overflow-x-auto md:overflow-x-visible no-scrollbar flex"
								id="history-chart-scroll-container"
							>
								<div id="history-chart-container" className="w-full">
									<HistoryChart
										historicalData={displayHistoricalData}
										isMasked={isAmountMasked}
									/>
								</div>
							</div>
						</div>
					) : (
						<p className="text-neutral-500 text-center py-10">
							取引データがありません
						</p>
					)}
				</div>
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
					onTransactionClick={actions.onTransactionClick}
					isMasked={isAmountMasked}
					luts={luts}
					displayPeriod={displayPeriod}
					periodLabel={periodLabel}
					onPeriodChange={actions.onPeriodChange}
					onAddClick={actions.onAddClick}
					onScanClick={actions.onScanClick}
				/>
			</section>
		</main>
	);
};

/**
 * アプリケーションのルートコンポーネント。
 * フックによるデータ管理、外部アクションのブリッジ、認証状態に基づく画面遷移を処理する。
 * @param {object} props - コンポーネントプロパティ。
 * @param {object} props.externalActions - `main.jsx` から注入される外部アクション（モーダル操作など）。
 * @param {Function} props.onMount - マウント時にフックアクションを親に渡すためのコールバック。
 * @returns {JSX.Element} アプリケーション全体のJSX要素。
 */
const App = ({ externalActions, onMount }) => {
	const { state, actions: hookActions } = useWalletData();

	// Fix: Clean up Firebase app on unload to prevent persistent connection errors
	useEffect(() => {
		const unloadCallback = () => {
			deleteApp(app).catch((err) =>
				console.debug("[App] Firebase delete on unload:", err)
			);
		};
		window.addEventListener("beforeunload", unloadCallback);
		return () => {
			window.removeEventListener("beforeunload", unloadCallback);
		};
	}, []);

	// Bridge: Update shared state in main.jsx and register callbacks
	useEffect(() => {
		if (externalActions && externalActions.updateSharedState) {
			externalActions.updateSharedState(state);
		}
	}, [state, externalActions]);

	useEffect(() => {
		if (onMount) {
			onMount(hookActions);
		}
	}, [onMount, hookActions]);

	// Map Hook Actions to UI Event Handlers
	const uiActions = useMemo(
		() => ({
			onMonthChange: hookActions.setCurrentMonthFilter,
			onAnalysisMonthFilterChange: hookActions.setAnalysisMonth,
			onMaskChange: hookActions.setIsAmountMasked,
			onPeriodChange: async (months) => {
				const newConfig = { ...state.config, displayPeriod: months };
				await hookActions.updateConfig(newConfig);
			},
			onRecordPayment: (data) => {
				hookActions.setPendingBillPayment({
					paymentTargetCardId: data.toAccountId,
					paymentTargetClosingDate: data.closingDateStr,
				});
				if (externalActions && externalActions.openTransactionModal) {
					externalActions.openTransactionModal(null, {
						type: "transfer",
						date: data.paymentDate,
						amount: data.amount,
						fromAccountId: data.defaultAccountId,
						toAccountId: data.toAccountId,
						description: `${data.cardName} (${data.formattedClosingDate}締分) 支払い`,
					});
				}
			},
			onTransactionClick: (transactionId) => {
				const transaction = state.transactions.find(
					(t) => t.id === transactionId
				);
				if (transaction && externalActions.openTransactionModal) {
					externalActions.openTransactionModal(transaction);
				}
			},
		}),
		[hookActions, externalActions, state.config, state.transactions]
	);

	// Merge hook actions with external actions (modal openers) and UI mappings
	const combinedActions = { ...hookActions, ...externalActions, ...uiActions };

	// Toggle Screens based on Auth (Now handled by React Conditional Rendering)
	// Side effects for DOM visibility removed.

	return (
		<AppProvider value={{ ...state, actions: combinedActions }}>
			{state.user ? (
				<div
					id="app-container"
					className="max-w-4xl mx-auto px-4 md:px-6 pb-4 md:pb-6"
				>
					<Header
						user={state.user}
						loading={state.loading}
						lastUpdated={state.lastUpdated}
						isAmountMasked={state.isAmountMasked}
						actions={combinedActions}
						appVersion={state.appVersion}
						onRefresh={combinedActions.refreshSettings}
					/>
					<MainContent state={state} actions={combinedActions} />
				</div>
			) : (
				<AuthScreen
					isLoading={state.loading}
					isUpdating={false /* TODO: Wiring up update state if needed */}
					onLogin={combinedActions.login}
				/>
			)}

			<Portal targetId="transaction-modal-root">
				<TransactionModal
					isOpen={state.transactionModalState.isOpen}
					onClose={combinedActions.closeTransactionModal}
					transaction={state.transactionModalState.transaction}
					prefillData={state.transactionModalState.prefillData}
					onSave={combinedActions.saveTransaction}
					onDelete={combinedActions.deleteTransaction}
					luts={state.luts}
				/>
			</Portal>
		</AppProvider>
	);
};

export default App;
