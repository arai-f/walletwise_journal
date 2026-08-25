import { deleteApp } from "firebase/app";
import { Suspense, lazy, useEffect } from "react";
import logoImg from "../favicon/favicon-96x96.png";
import MainContent from "./components/MainContent";
import NotificationBanner from "./components/NotificationBanner.jsx";
import TransactionModal from "./components/TransactionModal.jsx";
import Header from "./components/layout/Header";
import Portal from "./components/ui/Portal";
import { config as defaultConfig } from "./config.js";
import { AppProvider, useApp } from "./contexts/AppContext";
import { app } from "./firebase.js";
import * as notificationHelper from "./services/notification.js";
import * as store from "./services/store.js";

const AuthScreen = lazy(() => import("./components/AuthScreen"));
const SettingsModal = lazy(() => import("./components/settings/SettingsModal"));
const ScanModal = lazy(() => import("./components/ScanModal"));
const GuideModal = lazy(() => import("./components/GuideModal"));
const TermsModal = lazy(() => import("./components/TermsModal"));

// 初回ローディング中のフルスクリーン表示（ブランドロゴ＋スピナー）
const FullScreenLoader = () => (
	<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-50 animate-fade-in">
		<div className="flex flex-col items-center gap-4">
			<img
				src={logoImg}
				alt="WalletWise Logo"
				className="w-16 h-16 animate-pulse"
				width="64"
				height="64"
			/>
			<div className="flex flex-col items-center leading-tight">
				<span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-linear-to-r from-primary to-violet-600">
					WalletWise
				</span>
				<span className="text-[10px] font-bold text-neutral-400 tracking-widest uppercase mt-0.5">
					Journal
				</span>
			</div>
			<div className="w-8 h-8 mt-2 border-3 border-neutral-200 border-t-primary rounded-full animate-spin"></div>
		</div>
	</div>
);

// モーダル等でのローディング中のプレースホルダー（チラつき防止）
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
	 * 各取引を逐次保存し、一部の失敗があっても処理を継続する。
	 * 保存結果に応じて成功・エラーの通知を表示する。
	 * @async
	 * @param {Object|Object[]} transactions - 保存対象の取引データ（単一または配列）。
	 * @returns {Promise<void>}
	 */
	const handleSaveScan = async (transactions) => {
		const txns = Array.isArray(transactions) ? transactions : [transactions];
		let successCount = 0;
		const errors = [];
		for (let i = 0; i < txns.length; i++) {
			try {
				await store.saveTransaction(txns[i]);
				successCount++;
			} catch (e) {
				console.error(`[Scan Save] Failed at index ${i}:`, e);
				errors.push({ index: i, error: e });
			}
		}
		if (actions.refreshData && successCount > 0) {
			await actions.refreshData();
		}
		if (successCount === txns.length) {
			notificationHelper.success(`${successCount}件の取引を保存しました。`);
		} else if (successCount > 0) {
			notificationHelper.warn(
				`${successCount}件保存しました。${errors.length}件の保存に失敗しました。`,
			);
		} else {
			notificationHelper.error("保存できませんでした");
		}
		if (errors.length > 0) {
			throw errors[0].error;
		}
	};

	return (
		<>
			<NotificationBanner />

			{state.isInitialLoading ? (
				<FullScreenLoader />
			) : state.user ? (
				<div
					id="app-container"
					className="max-w-4xl mx-auto px-4 md:px-6 pb-4 md:pb-6 animate-fade-in"
				>
					<Header
						loading={state.loading}
						isRefreshing={state.isRefreshing}
						lastUpdated={state.lastUpdated}
						actions={actions}
						onRefresh={actions.refreshSettings}
						accountBalances={state.accountBalances}
						transactions={state.transactions}
						isMasked={state.isAmountMasked}
						onToggleMask={actions.onMaskChange}
					/>
					<MainContent state={state} actions={actions} />
				</div>
			) : (
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
