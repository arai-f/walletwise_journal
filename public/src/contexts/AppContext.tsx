import {
	createContext,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useContext,
	useEffect,
} from "react";
import { config as defaultConfig } from "../config.js";
import { useAuthData } from "../hooks/useAuthData";
import { useTransactions } from "../hooks/useTransactions";
import { useUIState } from "../hooks/useUIState";
import type { Transaction } from "../types/hooks.js";

/**
 * 取引記録の最小形状。`AppContext` で扱う `transactions` 配列の要素型。
 * `AppProvider` 内部では表示に絞った最小限のフィールドしか使わないため、
 * 必要に応じて `unknown` で受ける方針とする。
 */
interface TransactionLike {
	/** FirestoreドキュメントID。 */
	id: string;
	/** 種別。 */
	type?: string;
}

/**
 * `AppContext` から返されるアクション集合。
 * 実際のキー集合は元実装の `{ ...baseActions, ...uiActions }` をそのまま反映する。
 */
interface AppActions {
	/** ログイン処理。 */
	login?: (...args: unknown[]) => unknown;
	/** ログアウト処理。 */
	logout?: (...args: unknown[]) => unknown;
	/** 取引データ再取得。 */
	refreshData?: (...args: unknown[]) => unknown;
	/** 設定再読込（第1引数で取引データも更新するか指定）。 */
	refreshSettings?: (shouldReloadData?: boolean) => Promise<void>;
	/** 保留中の請求支払い情報をセットする。 */
	setPendingBillPayment?: (...args: unknown[]) => unknown;
	/** 分析対象月をセットする。 */
	setAnalysisMonth?: (...args: unknown[]) => unknown;
	/** 表示対象月をセットする。 */
	setCurrentMonthFilter?: (...args: unknown[]) => unknown;
	/** 金額マスク状態をセットする。 */
	setIsAmountMasked?: (...args: unknown[]) => unknown;
	/** 設定モーダル開閉。 */
	setIsSettingsOpen?: Dispatch<SetStateAction<boolean>>;
	/** ガイドモーダル開閉。 */
	setIsGuideOpen?: Dispatch<SetStateAction<boolean>>;
	/** 利用規約モーダル開閉。 */
	setIsTermsOpen?: Dispatch<SetStateAction<boolean>>;
	/** 利用規約モード切替。 */
	setTermsMode?: (...args: unknown[]) => unknown;
	/** スキャンモーダル開閉。 */
	setIsScanOpen?: Dispatch<SetStateAction<boolean>>;
	/** スキャン時の初期ファイル。 */
	setScanInitialFile?: (...args: unknown[]) => unknown;
	/** 設定の更新。 */
	updateConfig?: (...args: unknown[]) => unknown;
	/** 取引追加モーダルを開く。 */
	openTransactionModal?: (...args: unknown[]) => unknown;
	/** 取引追加モーダルを閉じる。 */
	closeTransactionModal?: (...args: unknown[]) => unknown;
	/** 取引を保存する。 */
	saveTransaction?: (...args: unknown[]) => unknown;
	/** 取引を削除する。 */
	deleteTransaction?: (...args: unknown[]) => unknown;
	/** Header 用: ログアウト（onLogout）。 */
	onLogout?: () => void;
	/** Header 用: 表示期間の変更。 */
	onPeriodChange?: (months: number) => Promise<void>;
	/** BottomNavigation 用: セクション遷移。 */
	onMonthChange?: (month: string) => void;
	/** Analysis 用: 分析対象月の変更。 */
	onAnalysisMonthFilterChange?: (month: string) => void;
	/** Header 用: 金額マスク切替。 */
	onMaskChange?: (masked: boolean) => void;
	/** BillingList 用: 支払い記録の実行。 */
	onRecordPayment?: (data: Record<string, unknown>) => void;
	/** TransactionList 用: 行クリック。 */
	onTransactionClick?: (id: string) => void;
	/** Header 用: 設定モーダルを開く。 */
	onOpenSettings?: () => void;
	/** SettingsMenu 用: ガイドモーダルを開く。 */
	onOpenGuide?: () => void;
	/** SettingsMenu 用: 利用規約モーダルを開く。 */
	onOpenTerms?: () => void;
	/** BottomNavigation 用: スキャンを開始。 */
	onScanClick?: () => void;
	/** BottomNavigation 用: 取引追加モーダルを開く。 */
	onAddClick?: () => void;
}

/**
 * `AppContext` から返されるステート部分。
 * 各フィールドは元実装と同期している。
 */
interface AppStateValue {
	user: unknown;
	luts: unknown;
	config: Record<string, unknown>;
	accountBalances: Record<string, number>;
	transactions: TransactionLike[];
	isAmountMasked: boolean;
	isGuideOpen: boolean;
	isTermsOpen: boolean;
	termsMode: string;
	isScanOpen: boolean;
	scanInitialFile: File | null;
	pendingBillPayment: Record<string, unknown> | null;
	analysisMonth: string;
	currentMonthFilter: string;
	isSettingsOpen: boolean;
	loading: boolean;
	lastUpdated: Date | null;
	appVersion: string;
	transactionModalState: {
		isOpen: boolean;
		transaction: Transaction | null;
		prefillData: Record<string, unknown> | null;
	};
}

/**
 * コンテキストから取得できる値の完全な型。
 */
interface AppContextValue extends AppStateValue {
	actions: AppActions;
}

/**
 * アプリケーション全体で共有するコンテキスト。
 * 初期値は `null` だが、`useApp` フック内では必ず `AppProvider` から提供されるため、
 * 非 null の型として取り出せる。
 */
const AppContext = createContext<AppContextValue | null>(null);

/**
 * `AppProvider` のコンポーネントプロパティ。
 */
interface AppProviderProps {
	/** コンテキストを利用する子要素。 */
	children: ReactNode;
}

/**
 * アプリケーション全体の状態とアクションを提供するコンテキストプロバイダー。
 * 分割されたフック（useAuthData, useTransactions, useUIState）を統合して提供する。
 * @param props - コンポーネントプロパティ。
 * @returns コンテキストプロバイダーでラップされた子要素。
 */
export const AppProvider = ({ children }: AppProviderProps) => {
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

	const uiActions = {
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
	};

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

/**
 * コンテキスト値を取得するフック。
 * `AppProvider` の外で利用された場合はエラーを投げる。
 * @returns アプリケーション全体の状態とアクション。
 */
export const useApp = (): AppContextValue => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useApp must be used within an AppProvider");
	}
	return context;
};
