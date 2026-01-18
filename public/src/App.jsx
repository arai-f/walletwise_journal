import { deleteApp } from "firebase/app";
import { deleteToken, getToken } from "firebase/messaging";
import { Suspense, lazy, useEffect } from "react";
import { config as defaultConfig } from "./config.js";
import { AppProvider, useApp } from "./contexts/AppContext.jsx";
import { app, messaging, vapidKey } from "./firebase.js";
import * as notificationHelper from "./services/notification.js";
import * as store from "./services/store.js";

import AuthScreen from "./components/AuthScreen.jsx";
import GuideModal from "./components/GuideModal.jsx";
import MainContent from "./components/MainContent.jsx";
import NotificationBanner from "./components/NotificationBanner.jsx";
import TermsModal from "./components/TermsModal.jsx";
import TransactionModal from "./components/TransactionModal.jsx";
import Header from "./components/layout/Header.jsx";
import Portal from "./components/ui/Portal.jsx";

const SettingsModal = lazy(
	() => import("./components/settings/SettingsModal.jsx"),
);
const ScanModal = lazy(() => import("./components/ScanModal.jsx"));

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
		} else if (permission === "denied") {
			notificationHelper.warn(
				"通知がブロックされています。ブラウザの設定から通知を許可してください。",
			);
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
 * アプリケーションのUIロジックを管理する内部コンポーネント。
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
	 * @param {Object|Object[]} transactions - 保存対象の取引データ（単一または配列）。
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
					/>
					<MainContent state={state} actions={actions} />
				</div>
			) : (
				<AuthScreen
					isLoading={state.loading}
					isUpdating={false}
					onLogin={actions.login}
				/>
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
						onRequestNotification={handleNotificationRequest}
					/>
				</Portal>
			)}

			{state.isTermsOpen && (
				<Portal>
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
				</Portal>
			)}

			{state.isSettingsOpen && (
				<Portal>
					<Suspense
						fallback={
							<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
								<div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
							</div>
						}
					>
						<SettingsModal
							isOpen={state.isSettingsOpen}
							onClose={() => actions.setIsSettingsOpen(false)}
							getState={() => state}
							refreshApp={actions.refreshSettings}
							requestNotification={handleNotificationRequest}
							disableNotification={handleNotificationDisable}
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
 */
const App = () => (
	<AppProvider>
		<AppInner />
	</AppProvider>
);

export default App;
