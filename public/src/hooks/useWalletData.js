import { useEffect } from "react";
import { config as defaultConfig } from "../config.js";
import { useAuthData } from "./useAuthData.js";
import { useTransactions } from "./useTransactions.js";
import { useUIState } from "./useUIState.js";

/**
 * アプリケーション全体のウォレットデータ（ユーザー、設定、取引、残高など）を管理するカスタムフック。
 * `useAuthData`, `useTransactions`, `useUIState` を統合し、コンポーネントに提供するインターフェースとして機能する。
 * @returns {object} ステートとアクションを含むオブジェクト
 * @property {object} state - アプリケーションの現在の状態（user, luts, config, transactions, etc...）。
 * @property {object} actions - データを操作するための関数群（login, logout, refresh, saveTransaction, etc...）。
 */
export function useWalletData() {
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

	return {
		state: {
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
		},
		actions: {
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
		},
	};
}
