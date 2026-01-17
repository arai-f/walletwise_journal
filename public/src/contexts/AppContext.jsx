import { createContext, useContext, useMemo } from "react";
import { useWalletData } from "../hooks/useWalletData.js";

const AppContext = createContext(null);

/**
 * アプリケーション全体の状態とアクションを提供するコンテキストプロバイダーである。
 * useWalletDataフックを使用してウォレットデータの状態管理とアクションを提供する。
 * @param {Object} props - プロパティ。
 * @param {React.ReactNode} props.children - コンテキストを利用する子要素。
 * @returns {JSX.Element} コンテキストプロバイダーでラップされた子要素。
 */
export const AppProvider = ({ children }) => {
	const { state, actions: hookActions } = useWalletData();

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
			onScanClick: () => {
				hookActions.setScanInitialFile(null);
				hookActions.setIsScanOpen(true);
			},
			onAddClick: () => hookActions.openTransactionModal(),
		}),
		[hookActions, state.config, state.transactions]
	);

	const combinedActions = { ...hookActions, ...uiActions };
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
