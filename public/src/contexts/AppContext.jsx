import { createContext, useContext, useEffect, useMemo } from "react";
import { config as defaultConfig } from "../config.js";
import { useAuthData } from "../hooks/useAuthData.js";
import { useTransactions } from "../hooks/useTransactions.js";
import { useUIState } from "../hooks/useUIState.js";

const AppContext = createContext(null);

/**
 * アプリケーション全体の状態とアクションを提供するコンテキストプロバイダー。
 * 分割されたフック（useAuthData, useTransactions, useUIState）を統合して提供する。
 * @param {Object} props - コンポーネントプロパティ。
 * @param {React.ReactNode} props.children - コンテキストを利用する子要素。
 * @returns {JSX.Element} コンテキストプロバイダーでラップされた子要素。
 */
export const AppProvider = ({ children }) => {
	const authData = useAuthData();
	const uiState = useUIState();
	const transactionData = useTransactions({
		user: authData.user,
		config: authData.config,
		uiState,
	});

	const { user, config, loading: authLoading } = authData;
	const {
		termsMode,
		setTermsMode,
		setIsTermsOpen,
		setIsGuideOpen,
		setIsScanOpen,
		setIsSettingsOpen,
		setTransactionModalState,
	} = uiState;

	// ログアウト時の状態リセット
	useEffect(() => {
		if (!user) {
			setIsSettingsOpen(false);
			setIsGuideOpen(false);
			setIsTermsOpen(false);
			setIsScanOpen(false);
			setTermsMode("viewer");
			setTransactionModalState({
				isOpen: false,
				transaction: null,
				prefillData: null,
			});
		}
	}, [
		user,
		setIsSettingsOpen,
		setIsGuideOpen,
		setIsTermsOpen,
		setIsScanOpen,
		setTermsMode,
		setTransactionModalState,
	]);

	// 利用規約のバージョンチェック
	useEffect(() => {
		if (authLoading) return;
		if (
			user &&
			config &&
			config.terms?.agreedVersion !== defaultConfig.termsVersion
		) {
			setTermsMode("agreement");
			setIsTermsOpen(true);
		} else if (
			termsMode === "agreement" &&
			config.terms?.agreedVersion === defaultConfig.termsVersion
		) {
			setIsTermsOpen(false);
			setTermsMode("viewer");
		}
	}, [user, config, termsMode, authLoading, setTermsMode, setIsTermsOpen]);

	// ガイドのバージョンチェック
	useEffect(() => {
		if (authLoading) return;
		if (
			user &&
			config &&
			defaultConfig.guideVersion &&
			config.guide?.lastSeenVersion !== defaultConfig.guideVersion
		) {
			setIsGuideOpen(true);
		}
	}, [user, config, authLoading, setIsGuideOpen]);

	// 基本アクションの構築
	const baseActions = {
		login: authData.login,
		logout: authData.logout,
		refreshData: transactionData.refreshData,
		refreshSettings: async (shouldReloadData = false) => {
			await authData.refreshSettings();
			if (shouldReloadData) await transactionData.refreshData();
		},
		setPendingBillPayment: uiState.setPendingBillPayment,
		setAnalysisMonth: uiState.setAnalysisMonth,
		setCurrentMonthFilter: uiState.setCurrentMonthFilter,
		setIsAmountMasked: uiState.setIsAmountMasked,
		setIsSettingsOpen: uiState.setIsSettingsOpen,
		setIsGuideOpen: uiState.setIsGuideOpen,
		setIsTermsOpen: uiState.setIsTermsOpen,
		setTermsMode: uiState.setTermsMode,
		setIsScanOpen: uiState.setIsScanOpen,
		setScanInitialFile: uiState.setScanInitialFile,
		updateConfig: authData.updateConfig,
		openTransactionModal: uiState.openTransactionModal,
		closeTransactionModal: uiState.closeTransactionModal,
		saveTransaction: transactionData.saveTransaction,
		deleteTransaction: transactionData.deleteTransaction,
	};

	const uiActions = useMemo(
		() => ({
			onLogout: baseActions.logout,
			onMonthChange: baseActions.setCurrentMonthFilter,
			onAnalysisMonthFilterChange: baseActions.setAnalysisMonth,
			onMaskChange: baseActions.setIsAmountMasked,
			onPeriodChange: async (months) => {
				const newConfig = { ...authData.config, displayPeriod: months };
				await baseActions.updateConfig(newConfig);
			},
			onRecordPayment: (data) => {
				baseActions.setPendingBillPayment({
					paymentTargetCardId: data.toAccountId,
					paymentTargetClosingDate: data.closingDateStr,
				});
				baseActions.openTransactionModal(null, {
					type: "transfer",
					date: data.paymentDate,
					amount: data.amount,
					fromAccountId: data.defaultAccountId,
					toAccountId: data.toAccountId,
					description: `${data.cardName} (${data.formattedClosingDate}締分) 支払い`,
				});
			},
			onTransactionClick: (transactionId) => {
				const transaction = transactionData.transactions.find(
					(t) => t.id === transactionId,
				);
				if (transaction) {
					baseActions.openTransactionModal(transaction);
				}
			},
			onOpenSettings: () => {
				baseActions.setTermsMode("viewer");
				baseActions.setIsSettingsOpen(true);
			},
			onOpenGuide: () => baseActions.setIsGuideOpen(true),
			onOpenTerms: () => {
				baseActions.setTermsMode("viewer");
				baseActions.setIsTermsOpen(true);
			},
			onScanClick: () => {
				baseActions.setScanInitialFile(null);
				baseActions.setIsScanOpen(true);
			},
			onAddClick: () => baseActions.openTransactionModal(),
		}),
		[baseActions, authData.config, transactionData.transactions],
	);

	const combinedActions = { ...baseActions, ...uiActions };

	const state = {
		user: authData.user,
		luts: authData.luts,
		config: authData.config,
		accountBalances: authData.accountBalances,
		transactions: transactionData.transactions,
		isAmountMasked: uiState.isAmountMasked,
		isGuideOpen: uiState.isGuideOpen,
		isTermsOpen: uiState.isTermsOpen,
		termsMode: uiState.termsMode,
		isScanOpen: uiState.isScanOpen,
		scanInitialFile: uiState.scanInitialFile,
		pendingBillPayment: uiState.pendingBillPayment,
		analysisMonth: uiState.analysisMonth,
		currentMonthFilter: uiState.currentMonthFilter,
		isSettingsOpen: uiState.isSettingsOpen,
		loading: authData.loading || transactionData.loading,
		lastUpdated: transactionData.lastUpdated,
		appVersion: defaultConfig.appVersion,
		transactionModalState: uiState.transactionModalState,
	};

	const value = { ...state, actions: combinedActions };

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useApp must be used within an AppProvider");
	}
	return context;
};
