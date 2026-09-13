import { Suspense, lazy, useEffect, type FC } from "react";
import logoImg from "../favicon/favicon-96x96.png";
import MainContent from "./components/MainContent";
import NotificationBanner from "./components/NotificationBanner";
import Header from "./components/layout/Header";
import { config as defaultConfig } from "./config";
import { AppProvider, useApp } from "./contexts/AppContext";
import * as notificationHelper from "./services/notification";
import * as store from "./services/store";

const AuthScreen = lazy(() => import("./components/AuthScreen"));
const TransactionModal = lazy(() => import("./components/TransactionModal"));
const SettingsModal = lazy(() => import("./components/settings/SettingsModal"));
const ScanModal = lazy(() => import("./components/ScanModal"));
const GuideModal = lazy(() => import("./components/GuideModal"));
const TermsModal = lazy(() => import("./components/TermsModal"));

// 初回ローディング中のフルスクリーン表示（ブランドロゴ＋スピナー）
const FullScreenLoader: FC = () => (
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
const LoadingFallback: FC = () => (
	<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
		<div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
	</div>
);

/**
 * アプリケーションのUIロジックを管理する内部コンポーネント。
 * 認証状態に応じた画面遷移、キーボードショートカット、モーダル管理を行う。
 */
const AppInner: FC = () => {
	const { actions, ...state } = useApp();

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "n") {
				if (state.user) {
					e.preventDefault();
					actions.openTransactionModal?.();
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
	 */
	const handleSaveScan = async (transactions: any | any[]): Promise<void> => {
		const txns = Array.isArray(transactions) ? transactions : [transactions];
		let successCount = 0;
		const errors: Array<{ index: number; error: unknown }> = [];
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
						transactions={state.transactions as any}
						isMasked={state.isAmountMasked}
					/>
					<MainContent state={state} actions={actions} />
				</div>
			) : (
				<Suspense fallback={null}>
					<AuthScreen onLogin={actions.login} />
				</Suspense>
			)}

			<Suspense fallback={<LoadingFallback />}>
				{state.activeModal?.type === "transaction" && (
					<TransactionModal
						isOpen={true}
						onClose={actions.closeTransactionModal}
						transaction={state.activeModal.transaction as any}
						prefillData={(state.activeModal.prefillData as any) || undefined}
						onSave={actions.saveTransaction}
						onDelete={actions.deleteTransaction}
						onScan={(file: File) => {
							actions.closeTransactionModal();
							actions.openModal({ type: "scan", file });
						}}
						luts={state.luts as any}
					/>
				)}

				{state.activeModal?.type === "guide" && (
					<GuideModal
						isOpen={true}
						onClose={async () => {
							actions.closeModal();
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
				)}

				{state.activeModal?.type === "terms" && (
					<TermsModal
						isOpen={true}
						onClose={actions.closeModal}
						mode={state.activeModal.mode || "viewer"}
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
				)}

				{state.activeModal?.type === "settings" && (
					<SettingsModal
						isOpen={true}
						onClose={actions.closeModal}
						requestNotification={notificationHelper.requestPermission}
						disableNotification={notificationHelper.disableNotification}
						openGuide={() => actions.openModal({ type: "guide" })}
						openTerms={() =>
							actions.openModal({ type: "terms", mode: "viewer" })
						}
						onLogout={actions.logout}
					/>
				)}

				{state.activeModal?.type === "scan" && (
					<ScanModal
						isOpen={true}
						onClose={actions.closeModal}
						scanSettings={state.config?.scanSettings || {}}
						luts={state.luts as any}
						onSave={handleSaveScan}
						initialImageFile={state.activeModal.file || undefined}
					/>
				)}
			</Suspense>
		</>
	);
};

/**
 * アプリケーションのルートコンポーネント。
 * AppProviderでグローバルな状態を提供し、AppInnerを描画する。
 */
const App: FC = () => (
	<AppProvider>
		<AppInner />
	</AppProvider>
);

export default App;
