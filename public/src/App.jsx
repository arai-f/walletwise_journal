import { deleteApp } from "firebase/app";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AppProvider } from "./contexts/AppContext.jsx";
import { app } from "./firebase.js";
import { useWalletData } from "./hooks/useWalletData.js";
import * as utils from "./utils.js";

import AccountBalances from "./components/AccountBalances.jsx";
import Advisor from "./components/Advisor.jsx";
import AnalysisReport from "./components/AnalysisReport.jsx";
import BillingList from "./components/BillingList.jsx";
import DashboardSummary from "./components/DashboardSummary.jsx";
import HistoryChart from "./components/HistoryChart.jsx";
import SideMenu from "./components/SideMenu.jsx";
import TransactionModal from "./components/TransactionModal.jsx";
import TransactionsSection from "./components/TransactionsSection.jsx";

const Portal = ({ children, targetId }) => {
	const target = utils.dom.get(targetId);
	return target ? createPortal(children, target) : null;
};

/**
 * 指定された要素の表示/非表示を切り替えるカスタムフック。
 * `useLayoutEffect` を使用して、描画前に `display` プロパティを更新する。
 * @param {string} id - 対象のDOM要素ID。
 * @param {boolean} isVisible - 表示するかどうかのフラグ。
 */
const useDomVisibility = (id, isVisible) => {
	useLayoutEffect(() => {
		if (isVisible) utils.dom.show(id);
		else utils.dom.hide(id);
	}, [id, isVisible]);
};

/**
 * アプリケーションのメインコンテンツコンポーネント。
 * 認証後のレイアウト、ダッシュボード、グラフ、設定画面などを構成する。
 * @param {object} props - コンポーネントプロパティ。
 * @param {object} props.state - アプリケーションの現在の状態オブジェクト。
 * @param {object} props.actions - アプリケーションのアクション（ステート更新関数など）。
 * @returns {JSX.Element} メインコンテンツのJSX要素。
 */
const AppContent = ({ state, actions }) => {
	const {
		config,
		transactions,
		luts,
		accountBalances,
		monthlyStats,
		isAmountMasked,
		currentMonthFilter,
		analysisMonth,
		isSettingsOpen,
		// Injected props
		user,
		appVersion,
		lastUpdated,
		transactionModalState,
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

	// DOM Side Effects (Visibility Toggling)
	useDomVisibility("history-chart-scroll-container", hasEnoughHistoryData);
	useDomVisibility("history-chart-placeholder", !hasEnoughHistoryData);

	const formattedLastUpdated = useMemo(() => {
		if (!lastUpdated) return "";
		if (typeof lastUpdated === "string") return lastUpdated;
		return lastUpdated.toLocaleTimeString("ja-JP", {
			hour: "2-digit",
			minute: "2-digit",
		});
	}, [lastUpdated]);

	return (
		<>
			<Portal targetId="dashboard-total-assets">
				<DashboardSummary
					accountBalances={accountBalances}
					isMasked={isAmountMasked}
					luts={luts}
				/>
			</Portal>

			<Portal targetId="transactions-section">
				<TransactionsSection
					transactions={transactions}
					luts={luts}
					currentMonthFilter={currentMonthFilter}
					periodLabel={periodLabel}
					isMasked={isAmountMasked}
					onMonthChange={actions.onMonthChange}
					onTransactionClick={actions.onTransactionClick}
					onAddClick={actions.onAddClick}
					onScanClick={actions.onScanClick}
				/>
			</Portal>

			<Portal targetId="analysis-report-root">
				<AnalysisReport
					transactions={analysisTargetTransactions}
					historicalData={displayHistoricalData}
					isMasked={isAmountMasked}
					initialMonth={analysisMonth}
					periodLabel={periodLabel}
					availableMonths={availableMonths}
					luts={luts}
					onMonthFilterChange={actions.onAnalysisMonthFilterChange}
				/>
			</Portal>

			{hasEnoughHistoryData && (
				<Portal targetId="history-chart-container">
					<HistoryChart
						historicalData={displayHistoricalData}
						isMasked={isAmountMasked}
					/>
				</Portal>
			)}

			<Portal targetId="balances-grid">
				<AccountBalances
					accountBalances={accountBalances} // renderUI passed 'accountBalances'
					isMasked={isAmountMasked}
					transactions={transactions}
					accountsMap={luts.accounts} // renderUI passed 'accountsMap' as 'luts.accounts'
					// NOTE: AccountBalances component definition props: accounts, balances, isMasked.
					// renderAccountBalances passed: accounts, balances, isMasked.
					// renderUI passed: accountBalances, isMasked, transactions, accountsMap.
					// We need to match what AccountBalances.jsx expects.
					// Checking AccountBalances.jsx... it likely expects 'accounts' and 'balances'.
					accounts={luts.accounts}
					balances={accountBalances}
				/>
			</Portal>

			<Portal targetId="billing-list">
				<BillingList
					transactions={transactions}
					creditCardRules={config.creditCardRules || {}}
					isMasked={isAmountMasked}
					luts={luts}
					isDataInsufficient={isDataInsufficient}
					onRecordPayment={actions.onRecordPayment}
					onOpenSettings={actions.onOpenSettings}
				/>
			</Portal>

			<Portal targetId="ai-advisor-card-container">
				<Advisor
					config={config}
					transactions={transactions}
					categories={luts.categories}
				/>
			</Portal>

			<Portal targetId="side-menu-container">
				<SideMenu
					isVisible={true}
					user={user}
					isMasked={isAmountMasked}
					appVersion={appVersion}
					lastUpdated={formattedLastUpdated}
					onMaskChange={actions.onMaskChange}
					onLogout={actions.onLogout}
					onOpenSettings={actions.onOpenSettings}
					onOpenGuide={actions.onOpenGuide}
					onOpenTerms={actions.onOpenTerms}
					onOpenReport={actions.onOpenReport}
				/>
			</Portal>

			<Portal targetId="transaction-modal-root">
				<TransactionModal
					isOpen={transactionModalState.isOpen}
					onClose={actions.closeTransactionModal}
					transaction={transactionModalState.transaction}
					prefillData={transactionModalState.prefillData}
					onSave={actions.saveTransaction}
					onDelete={actions.deleteTransaction}
					luts={luts}
				/>
			</Portal>
		</>
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

	// Toggle Screens based on Auth
	useEffect(() => {
		if (state.user) {
			utils.dom.hide("auth-screen");
			utils.dom.show("main-content");
			utils.dom.show("refresh-data-button");
			utils.dom.show("last-updated-time");

			if (state.loading) {
				utils.dom.setText("last-updated-time", "データ取得中...");
			} else if (state.lastUpdated) {
				const timeString = state.lastUpdated.toLocaleTimeString("ja-JP", {
					hour: "2-digit",
					minute: "2-digit",
				});
				utils.dom.setText("last-updated-time", `最終取得: ${timeString}`);
			}
		} else {
			utils.dom.show("auth-screen");
			if (!state.loading) {
				utils.dom.show("login-container");
				utils.dom.hide("loading-indicator");
			} else {
				// Loading auth state
				utils.dom.hide("login-container");
				utils.dom.show("loading-indicator");
			}
			utils.dom.hide("main-content");
			utils.dom.hide("refresh-data-button");
			utils.dom.hide("last-updated-time");
		}
	}, [state.user, state.loading, state.lastUpdated]);

	// Attach Login Listener to DOM button
	useEffect(() => {
		const loginBtn = utils.dom.get("login-button");
		if (loginBtn) loginBtn.onclick = combinedActions.login;
		return () => {
			if (loginBtn) loginBtn.onclick = null;
		};
	}, [combinedActions.login]);

	// Attach Refresh Listener to DOM button
	useEffect(() => {
		const refreshBtn = utils.dom.get("refresh-data-button");
		if (refreshBtn) refreshBtn.onclick = combinedActions.refreshSettings;
		return () => {
			if (refreshBtn) refreshBtn.onclick = null;
		};
	}, [combinedActions.refreshSettings]);

	return (
		<AppProvider value={{ ...state, actions: combinedActions }}>
			{state.user && <AppContent state={state} actions={combinedActions} />}
		</AppProvider>
	);
};

export default App;
