import { deleteApp } from "firebase/app";
import { Suspense, lazy, useEffect } from "react";
import { config as defaultConfig } from "./config.js";
import { AppProvider, useApp } from "./contexts/AppContext.jsx";
import { app } from "./firebase.js";
import * as notificationHelper from "./services/notification.js";
import * as store from "./services/store.js";

import { MainContentSkeleton } from "./components/MainContentSkeleton.jsx";
import NotificationBanner from "./components/NotificationBanner.jsx";
import TransactionModal from "./components/TransactionModal.jsx";
import Header from "./components/layout/Header.jsx";
import Portal from "./components/ui/Portal.jsx";

const MainContent = lazy(() => import("./components/MainContent.jsx"));
const AuthScreen = lazy(() => import("./components/AuthScreen.jsx"));
const SettingsModal = lazy(
	() => import("./components/settings/SettingsModal.jsx"),
);
const ScanModal = lazy(() => import("./components/ScanModal.jsx"));
const GuideModal = lazy(() => import("./components/GuideModal.jsx"));
const TermsModal = lazy(() => import("./components/TermsModal.jsx"));

// ローディング中のプレースホルダー（チラつき防止）
const LoadingFallback = () => (
	<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
		<div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
	</div>
);

/**
 * アプリケーションのUIロジックを管理する内部コンポーネント。
 * 認証状態に応じた画面遷移、キーボードショートカット、モーダル管理を行う。
 * @returns {JSX.Element} アプリケーションのメインUI構造。
 */
const AppInner = () => {
	const { actions, ...state } = useApp();

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
					actions.openTransactionModal();
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [state.user, actions]);

	/**
	 * スキャンされた取引データを保存する。
	 * 保存成功時にはデータをリフレッシュし、完了メッセージを表示する。
	 * @async
	 * @param {Object|Object[]} transactions - 保存対象の取引データ（単一または配列）。
	 * @returns {Promise<void>}
	 */
	const handleSaveScan = async (transactions) => {
		try {
			const txns = Array.isArray(transactions) ? transactions : [transactions];
			await Promise.all(txns.map((tx) => store.saveTransaction(tx)));
			if (actions.refreshData) {
				await actions.refreshData();
			}
			notificationHelper.success(`${txns.length}件の取引を保存しました。`);
		} catch (e) {
			console.error(e);
			notificationHelper.error("保存できませんでした");
			throw e;
		}
	};

	return (
		<>
			<NotificationBanner />

			{state.user ? (
				<div
					id="app-container"
					className="max-w-4xl mx-auto px-4 md:px-6 pb-4 md:pb-6 animate-fade-in"
				>
					<Header
						loading={state.loading}
						lastUpdated={state.lastUpdated}
						actions={actions}
						onRefresh={actions.refreshSettings}
						accountBalances={state.accountBalances}
						transactions={state.transactions}
						isMasked={state.isAmountMasked}
						onToggleMask={actions.onMaskChange}
					/>
					{state.loading ? (
						<MainContentSkeleton />
					) : (
						<Suspense fallback={<MainContentSkeleton />}>
							<MainContent state={state} actions={actions} />
						</Suspense>
					)}
				</div>
			) : state.loading ? null : (
				<Suspense fallback={null}>
					<AuthScreen onLogin={actions.login} />
				</Suspense>
			)}

			<Portal>
				<TransactionModal
					isOpen={state.transactionModalState.isOpen}
					onClose={actions.closeTransactionModal}
					transaction={state.transactionModalState.transaction}
					prefillData={state.transactionModalState.prefillData}
					onSave={actions.saveTransaction}
					onDelete={actions.deleteTransaction}
					onScan={(file) => {
						actions.closeTransactionModal();
						actions.setScanInitialFile(file);
						actions.setIsScanOpen(true);
					}}
					luts={state.luts}
				/>
			</Portal>

			{state.isGuideOpen && (
				<Portal>
					<Suspense fallback={<LoadingFallback />}>
						<GuideModal
							isOpen={state.isGuideOpen}
							onClose={async () => {
								actions.setIsGuideOpen(false);
								if (
									state.config.guide?.lastSeenVersion !==
									defaultConfig.guideVersion
								) {
									await actions.updateConfig({
										"guide.lastSeenVersion": defaultConfig.guideVersion,
									});
								}
							}}
							onRequestNotification={notificationHelper.requestPermission}
						/>
					</Suspense>
				</Portal>
			)}

			{state.isTermsOpen && (
				<Portal>
					<Suspense fallback={<LoadingFallback />}>
						<TermsModal
							isOpen={state.isTermsOpen}
							onClose={() => actions.setIsTermsOpen(false)}
							mode={state.termsMode}
							onAgree={async () => {
								try {
									await actions.updateConfig({
										"terms.agreedVersion": defaultConfig.termsVersion,
									});
									window.location.reload();
								} catch (e) {
									console.error("Terms agreement failed", e);
									notificationHelper.error("規約への同意処理に失敗しました。");
								}
							}}
							onDisagree={() => actions.logout()}
						/>
					</Suspense>
				</Portal>
			)}

			{state.isSettingsOpen && (
				<Portal>
					<Suspense fallback={<LoadingFallback />}>
						<SettingsModal
							isOpen={state.isSettingsOpen}
							onClose={() => actions.setIsSettingsOpen(false)}
							getState={() => state}
							refreshApp={actions.refreshSettings}
							requestNotification={notificationHelper.requestPermission}
							disableNotification={notificationHelper.disableNotification}
							openGuide={() => actions.setIsGuideOpen(true)}
							openTerms={() => actions.setIsTermsOpen(true)}
							canClose={!state.isGuideOpen && !state.isTermsOpen}
							onLogout={actions.logout}
						/>
					</Suspense>
				</Portal>
			)}

			{state.isScanOpen && (
				<Portal>
					<Suspense
						fallback={
							<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
								<div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
							</div>
						}
					>
						<ScanModal
							isOpen={state.isScanOpen}
							onClose={() => actions.setIsScanOpen(false)}
							scanSettings={state.config?.scanSettings || {}}
							luts={state.luts}
							onSave={handleSaveScan}
							initialImageFile={state.scanInitialFile}
						/>
					</Suspense>
				</Portal>
			)}
		</>
	);
};

/**
 * アプリケーションのルートコンポーネント。
 * AppProviderでグローバルな状態を提供し、AppInnerを描画する。
 * @returns {JSX.Element} ルートコンポーネント。
 */
const App = () => (
	<AppProvider>
		<AppInner />
	</AppProvider>
);

export default App;
