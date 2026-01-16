import { deleteApp } from "firebase/app";
import { deleteToken, getToken } from "firebase/messaging";
import { Suspense, lazy, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { config as defaultConfig } from "./config.js";
import { AppProvider } from "./contexts/AppContext.jsx";
import { app, messaging, vapidKey } from "./firebase.js";
import { useWalletData } from "./hooks/useWalletData.js";
import * as notificationHelper from "./services/notification.js";
import * as store from "./services/store.js";
import * as utils from "./utils.js";

import AccountBalances from "./components/AccountBalances.jsx";
import Advisor from "./components/Advisor.jsx";
import AnalysisReport from "./components/AnalysisReport.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import BillingList from "./components/BillingList.jsx";
import DashboardSummary from "./components/DashboardSummary.jsx";
import GuideModal from "./components/GuideModal.jsx";
import HistoryChart from "./components/HistoryChart.jsx";
import NotificationBanner from "./components/NotificationBanner.jsx";
import ReportModal from "./components/ReportModal.jsx";
import TermsModal from "./components/TermsModal.jsx";
import TransactionModal from "./components/TransactionModal.jsx";
import TransactionsSection from "./components/TransactionsSection.jsx";
import Header from "./components/layout/Header.jsx";
import { MainContentSkeleton } from "./components/skeletons/MainContentSkeleton.jsx";

const SettingsModal = lazy(() =>
	import("./components/settings/SettingsModal.jsx")
);
const ScanModal = lazy(() => import("./components/ScanModal.jsx"));

/**
 * React Portalへのレンダリングを行うラッパーコンポーネントである。
 * targetIdが指定されている場合はそのDOM要素へ、指定がない場合はbodyへレンダリングする。
 * @param {Object} props - プロパティ。
 * @param {React.ReactNode} props.children - レンダリングする子要素。
 * @param {string} [props.targetId] - ポータル先のDOM ID。
 * @returns {React.ReactPortal|null} ポータル、またはターゲットが見つからない場合はnull。
 */
const Portal = ({ children, targetId }) => {
	const target = targetId ? utils.dom.get(targetId) : document.body;
	return target ? createPortal(children, target) : null;
};

/**
 * ブラウザの通知権限をリクエストし、FCMトークンを取得・保存する。
 * 成功時はユーザー設定を更新し、失敗時はエラー通知を表示する。
 * @returns {Promise<boolean>} 成功した場合はtrue、失敗またはキャンセルの場合はfalseを返す。
 */
const handleNotificationRequest = async () => {
	if (!messaging) {
		notificationHelper.error("通知機能はサポートされていません。");
		return false;
	}
	try {
		const permission = await Notification.requestPermission();
		if (permission === "granted") {
			const registration = await navigator.serviceWorker.getRegistration("/");
			const token = await getToken(messaging, {
				vapidKey: vapidKey,
				serviceWorkerRegistration: registration,
			});
			if (token) {
				await store.saveFcmToken(token);
				notificationHelper.success("通知を有効にしました。");
				return true;
			}
		} else {
			notificationHelper.warn("通知の権限が得られませんでした。");
		}
	} catch (err) {
		console.error("[App] Token retrieval failed:", err);
		notificationHelper.error("通知設定に失敗しました。");
	}
	return false;
};

/**
 * FCMトークンを削除し、このデバイスでの通知を無効化する。
 */
const handleNotificationDisable = async () => {
	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		if (!registration) return;

		const token = await getToken(messaging, {
			vapidKey: vapidKey,
			serviceWorkerRegistration: registration,
		}).catch(() => null);

		if (token) {
			await store.deleteFcmToken(token);
			await deleteToken(messaging);
		}
		notificationHelper.info("この端末の通知設定をオフにしました。");
	} catch (error) {
		console.error("[App] Notification disable failed:", error);
		notificationHelper.error("通知設定の解除に失敗しました。");
	}
};

/**
 * アプリケーションのメインコンテンツを表示するコンポーネントである。
 * 資産一覧、推移グラフ、分析レポート、請求リスト、取引履歴などを管理・表示する。
 * @param {Object} props - プロパティ。
 * @param {Object} props.state - アプリケーションの全体ステート。
 * @param {Object} props.actions - アクション関数群。
 * @return {JSX.Element} メインコンテンツコンポーネント。
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
		user,
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
};

/**
 * アプリケーションのルートコンポーネントである。
 * 状態管理フックの呼び出し、グローバルコンテキストの提供、および主要なモーダル管理を行う。

 * @return {JSX.Element} アプリケーションのルートコンポーネント。
 */
const App = () => {
	const { state, actions: hookActions } = useWalletData();

	useEffect(() => {
		const unloadCallback = () => {
			deleteApp(app).catch((err) => console.debug("App delete error", err));
		};
		window.addEventListener("beforeunload", unloadCallback);
		return () => {
			window.removeEventListener("beforeunload", unloadCallback);
		};
	}, []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "n") {
				if (state.user) {
					e.preventDefault();
					hookActions.openTransactionModal();
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [state.user, hookActions]);

	/**
	 * スキャンされた取引データを保存する。
	 * 保存成功時にはデータをリフレッシュし、完了メッセージを表示する。
	 * @param {Object|Object[]} transactions - 保存対象の取引データ（単一または配列）。
	 */
	const handleSaveScan = async (transactions) => {
		try {
			const txns = Array.isArray(transactions) ? transactions : [transactions];
			await Promise.all(txns.map((tx) => store.saveTransaction(tx)));
			if (hookActions.refreshData) {
				await hookActions.refreshData();
			}
			notificationHelper.success(`${txns.length}件の取引を保存しました。`);
		} catch (e) {
			console.error(e);
			notificationHelper.error("保存できませんでした");
			throw e;
		}
	};

	const uiActions = useMemo(
		() => ({
			onLogout: hookActions.logout,
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
				hookActions.openTransactionModal(null, {
					type: "transfer",
					date: data.paymentDate,
					amount: data.amount,
					fromAccountId: data.defaultAccountId,
					toAccountId: data.toAccountId,
					description: `${data.cardName} (${data.formattedClosingDate}締分) 支払い`,
				});
			},
			onTransactionClick: (transactionId) => {
				const transaction = state.transactions.find(
					(t) => t.id === transactionId
				);
				if (transaction) {
					hookActions.openTransactionModal(transaction);
				}
			},
			onOpenSettings: () => {
				hookActions.setTermsMode("viewer");
				hookActions.setIsSettingsOpen(true);
			},
			onOpenGuide: () => hookActions.setIsGuideOpen(true),
			onOpenTerms: () => {
				hookActions.setTermsMode("viewer");
				hookActions.setIsTermsOpen(true);
			},
			onOpenReport: () => hookActions.setIsReportOpen(true),
			onScanClick: () => hookActions.setIsScanOpen(true),
			onAddClick: () => hookActions.openTransactionModal(),
		}),
		[hookActions, state.config, state.transactions]
	);

	const combinedActions = { ...hookActions, ...uiActions };

	return (
		<AppProvider value={{ ...state, actions: combinedActions }}>
			<NotificationBanner />

			{state.user ? (
				<div
					id="app-container"
					className="max-w-4xl mx-auto px-4 md:px-6 pb-4 md:pb-6 animate-fade-in"
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
					isUpdating={false}
					onLogin={combinedActions.login}
				/>
			)}

			<Portal>
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

			{state.isGuideOpen && (
				<Portal>
					<GuideModal
						isOpen={state.isGuideOpen}
						onClose={async () => {
							hookActions.setIsGuideOpen(false);
							if (
								state.config.guide?.lastSeenVersion !==
								defaultConfig.guideVersion
							) {
								await hookActions.updateConfig({
									"guide.lastSeenVersion": defaultConfig.guideVersion,
								});
							}
						}}
						userConfig={state.config}
						onRequestNotification={handleNotificationRequest}
					/>
				</Portal>
			)}

			{state.isTermsOpen && (
				<Portal>
					<TermsModal
						isOpen={state.isTermsOpen}
						onClose={() => hookActions.setIsTermsOpen(false)}
						mode={state.termsMode}
						onAgree={async () => {
							try {
								await hookActions.updateConfig({
									"terms.agreedVersion": defaultConfig.termsVersion,
								});
								window.location.reload();
							} catch (e) {
								console.error("Terms agreement failed", e);
								notificationHelper.error("規約への同意処理に失敗しました。");
							}
						}}
						onDisagree={() => combinedActions.logout()}
					/>
				</Portal>
			)}

			{state.isReportOpen && (
				<Portal>
					<ReportModal
						isOpen={state.isReportOpen}
						onClose={() => hookActions.setIsReportOpen(false)}
						luts={state.luts}
					/>
				</Portal>
			)}

			{state.isSettingsOpen && (
				<Portal>
					<Suspense fallback={null}>
						<SettingsModal
							isOpen={state.isSettingsOpen}
							onClose={() => hookActions.setIsSettingsOpen(false)}
							store={store}
							getState={() => state}
							refreshApp={hookActions.refreshSettings}
							requestNotification={handleNotificationRequest}
							disableNotification={handleNotificationDisable}
							openGuide={() => hookActions.setIsGuideOpen(true)}
							openTerms={() => hookActions.setIsTermsOpen(true)}
							canClose={!state.isGuideOpen && !state.isTermsOpen}
						/>
					</Suspense>
				</Portal>
			)}

			{state.isScanOpen && (
				<Portal>
					<Suspense fallback={null}>
						<ScanModal
							isOpen={state.isScanOpen}
							onClose={() => hookActions.setIsScanOpen(false)}
							scanSettings={state.config?.scanSettings || {}}
							luts={state.luts}
							onSave={handleSaveScan}
						/>
					</Suspense>
				</Portal>
			)}
		</AppProvider>
	);
};

export default App;
