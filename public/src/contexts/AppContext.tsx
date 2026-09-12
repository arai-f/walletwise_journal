import type { User } from "firebase/auth";
import {
    createContext,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { config as defaultConfig } from "../config";
import { useAuthData } from "../hooks/useAuthData";
import { useTransactions } from "../hooks/useTransactions";
import { useUIState } from "../hooks/useUIState";
import type {
    AccountBalances,
    Luts,
    Transaction,
    TransactionInput,
    TransactionModalState,
    TransactionOutput,
} from "../types/hooks";
import type { AppConfig } from "../types/settings";

/**
 * `AppContext` から返されるアクション集合。
 * すべてのハンドラは安定した参照を持ち、子コンポーネントの不要な再レンダリングを防ぐ。
 */
export interface AppActions {
	/** ログイン処理。 */
	login: () => Promise<void>;
	/** ログアウト処理。 */
	logout: () => Promise<void>;
	/** 取引データ再取得。 */
	refreshData: () => Promise<void>;
	/** 設定再読込（第1引数で取引データも更新するか指定）。 */
	refreshSettings: (shouldReloadData?: boolean) => Promise<void>;
	/** 保留中の請求支払い情報をセットする。 */
	setPendingBillPayment: (payment: Record<string, unknown> | null) => void;
	/** 分析対象月をセットする。 */
	setAnalysisMonth: (month: string) => void;
	/** 表示対象月をセットする。 */
	setCurrentMonthFilter: (month: string) => void;
	/** 金額マスク状態をセットする。 */
	setIsAmountMasked: Dispatch<SetStateAction<boolean>>;
	/** 設定モーダル開閉。 */
	setIsSettingsOpen: Dispatch<SetStateAction<boolean>>;
	/** ガイドモーダル開閉。 */
	setIsGuideOpen: Dispatch<SetStateAction<boolean>>;
	/** 利用規約モーダル開閉。 */
	setIsTermsOpen: Dispatch<SetStateAction<boolean>>;
	/** 利用規約モード切替。 */
	setTermsMode: (mode: "agreement" | "viewer") => void;
	/** スキャンモーダル開閉。 */
	setIsScanOpen: Dispatch<SetStateAction<boolean>>;
	/** スキャン時の初期ファイル。 */
	setScanInitialFile: (file: File | null) => void;
	/** 設定の更新。 */
	updateConfig: (newConfig: Partial<AppConfig>) => Promise<void>;
	/** 取引追加・編集モーダルを開く。 */
	openTransactionModal: (
		transaction?: Transaction | null,
		prefillData?: Record<string, unknown> | null,
	) => void;
	/** 取引追加・編集モーダルを閉じる。 */
	closeTransactionModal: () => void;
	/** 取引を保存する。 */
	saveTransaction: (txData: TransactionInput) => Promise<void>;
	/** 取引を削除する。 */
	deleteTransaction: (id: string) => Promise<void>;
	/** Header 用: ログアウト。 */
	onLogout: () => void;
	/** Header 用: 表示期間の変更。 */
	onPeriodChange: (months: number) => Promise<void>;
	/** BottomNavigation 用: セクション遷移。 */
	onMonthChange: (month: string) => void;
	/** Analysis 用: 分析対象月の変更。 */
	onAnalysisMonthFilterChange: (month: string) => void;
	/** Header 用: 金額マスク切替。 */
	onMaskChange: (masked: boolean) => void;
	/** BillingList 用: 支払い記録の実行。 */
	onRecordPayment: (data: Record<string, unknown>) => void;
	/** TransactionList 用: 行クリック。 */
	onTransactionClick: (id: string) => void;
	/** Header 用: 設定モーダルを開く。 */
	onOpenSettings: () => void;
	/** SettingsMenu 用: ガイドモーダルを開く。 */
	onOpenGuide: () => void;
	/** SettingsMenu 用: 利用規約モーダルを開く。 */
	onOpenTerms: () => void;
	/** BottomNavigation 用: スキャンを開始。 */
	onScanClick: () => void;
	/** BottomNavigation 用: 取引追加モーダルを開く。 */
	onAddClick: () => void;
	[key: string]: unknown;
}

/**
 * `AppContext` から返されるステート部分。
 */
export interface AppStateValue {
	user: User | null;
	luts: Luts;
	config: AppConfig;
	accountBalances: AccountBalances;
	transactions: TransactionOutput[];
	isAmountMasked: boolean;
	isGuideOpen: boolean;
	isTermsOpen: boolean;
	termsMode: "agreement" | "viewer";
	isScanOpen: boolean;
	scanInitialFile: File | null;
	pendingBillPayment: Record<string, unknown> | null;
	analysisMonth: string;
	currentMonthFilter: string;
	isSettingsOpen: boolean;
	loading: boolean;
	isInitialLoading: boolean;
	isRefreshing: boolean;
	lastUpdated: Date | null;
	appVersion: string;
	transactionModalState: TransactionModalState;
}

/**
 * コンテキストから取得できる値の完全な型。
 */
export interface AppContextValue extends AppStateValue {
	actions: AppActions;
}

/**
 * アプリケーション全体で共有するコンテキスト。
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
 * アクション関数の参照は常に安定化され、不要な再レンダリングを抑止する。
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

	const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

	// 最新のフック状態を ref に退避し、actions の関数参照を恒久的に安定化
	const latestRef = useRef({
		authData,
		uiState,
		transactionData,
	});
	latestRef.current = { authData, uiState, transactionData };

	// 安定したアクション群（マウント時に 1 回のみ生成）
	const actions = useMemo<AppActions>(
		() => ({
			login: async () => {
				await (latestRef.current.authData.login as () => Promise<void>)();
			},
			logout: async () => {
				await (latestRef.current.authData.logout as () => Promise<void>)();
			},
			refreshData: async () => {
				setIsRefreshing(true);
				try {
					await (latestRef.current.transactionData.refreshData as () => Promise<void>)();
				} finally {
					setIsRefreshing(false);
				}
			},
			refreshSettings: async (shouldReloadData: boolean = true) => {
				setIsRefreshing(true);
				try {
					if (shouldReloadData) {
						await Promise.all([
							(latestRef.current.authData.refreshSettings as () => Promise<void>)(),
							(latestRef.current.transactionData.refreshData as () => Promise<void>)(),
						]);
					} else {
						await (latestRef.current.authData.refreshSettings as () => Promise<void>)();
					}
				} catch (err) {
					console.error("[AppContext] Refresh failed:", err);
				} finally {
					setIsRefreshing(false);
				}
			},
			setPendingBillPayment: (payment) => {
				latestRef.current.uiState.setPendingBillPayment(payment);
			},
			setAnalysisMonth: (month) => {
				latestRef.current.uiState.setAnalysisMonth(month);
			},
			setCurrentMonthFilter: (month) => {
				latestRef.current.uiState.setCurrentMonthFilter(month);
			},
			setIsAmountMasked: (val) => {
				latestRef.current.uiState.setIsAmountMasked(val);
			},
			setIsSettingsOpen: (val) => {
				latestRef.current.uiState.setIsSettingsOpen(val);
			},
			setIsGuideOpen: (val) => {
				latestRef.current.uiState.setIsGuideOpen(val);
			},
			setIsTermsOpen: (val) => {
				latestRef.current.uiState.setIsTermsOpen(val);
			},
			setTermsMode: (mode) => {
				latestRef.current.uiState.setTermsMode(mode);
			},
			setIsScanOpen: (val) => {
				latestRef.current.uiState.setIsScanOpen(val);
			},
			setScanInitialFile: (file) => {
				latestRef.current.uiState.setScanInitialFile(file);
			},
			updateConfig: async (newConfig) => {
				await (latestRef.current.authData.updateConfig as (cfg: Partial<AppConfig>) => Promise<void>)(
					newConfig,
				);
			},
			openTransactionModal: (tx = null, prefill = null) => {
				latestRef.current.uiState.openTransactionModal(tx, prefill);
			},
			closeTransactionModal: () => {
				latestRef.current.uiState.closeTransactionModal();
			},
			saveTransaction: async (txData) => {
				await (latestRef.current.transactionData.saveTransaction as (
					data: TransactionInput,
				) => Promise<void>)(txData);
			},
			deleteTransaction: async (id) => {
				await (latestRef.current.transactionData.deleteTransaction as (
					txId: string,
				) => Promise<void>)(id);
			},
			onLogout: () => {
				void (latestRef.current.authData.logout as () => Promise<void>)();
			},
			onMonthChange: (month) => {
				latestRef.current.uiState.setCurrentMonthFilter(month);
			},
			onAnalysisMonthFilterChange: (month) => {
				latestRef.current.uiState.setAnalysisMonth(month);
			},
			onMaskChange: (masked) => {
				latestRef.current.uiState.setIsAmountMasked(masked);
			},
			onPeriodChange: async (months: number) => {
				const currentConfig = latestRef.current.authData.config;
				const newConfig: Partial<AppConfig> = {
					...currentConfig,
					general: {
						...(currentConfig.general || {}),
						displayPeriod: months,
					},
				};
				await (latestRef.current.authData.updateConfig as (
					cfg: Partial<AppConfig>,
				) => Promise<void>)(newConfig);
			},
			onRecordPayment: (data: Record<string, unknown>) => {
				latestRef.current.uiState.setPendingBillPayment({
					paymentTargetCardId: data.toAccountId,
					paymentTargetClosingDate: data.closingDateStr,
				});
				latestRef.current.uiState.openTransactionModal(null, {
					type: "transfer",
					date: data.paymentDate,
					amount: data.amount,
					fromAccountId: data.defaultAccountId,
					toAccountId: data.toAccountId,
					description: `${data.cardName} (${data.formattedClosingDate}締分) 支払い`,
				});
			},
			onTransactionClick: (transactionId: string) => {
				const tx = latestRef.current.transactionData.transactions.find(
					(t) => t.id === transactionId,
				);
				if (tx) {
					latestRef.current.uiState.openTransactionModal(tx as Transaction);
				}
			},
			onOpenSettings: () => {
				latestRef.current.uiState.setTermsMode("viewer");
				latestRef.current.uiState.setIsSettingsOpen(true);
			},
			onOpenGuide: () => {
				latestRef.current.uiState.setIsGuideOpen(true);
			},
			onOpenTerms: () => {
				latestRef.current.uiState.setTermsMode("viewer");
				latestRef.current.uiState.setIsTermsOpen(true);
			},
			onScanClick: () => {
				latestRef.current.uiState.setScanInitialFile(null);
				latestRef.current.uiState.setIsScanOpen(true);
			},
			onAddClick: () => {
				latestRef.current.uiState.openTransactionModal();
			},
		}),
		[],
	);

	const isInitialLoading = Boolean(
		authData.loading ||
			(authData.user &&
				!transactionData.lastUpdated &&
				transactionData.loading),
	);

	const value = useMemo<AppContextValue>(
		() => ({
			user: authData.user,
			luts: authData.luts,
			config: authData.config,
			accountBalances: authData.accountBalances,
			transactions: transactionData.transactions,
			isAmountMasked: uiState.isAmountMasked,
			isGuideOpen: uiState.isGuideOpen,
			isTermsOpen: uiState.isTermsOpen,
			termsMode: (uiState.termsMode as "agreement" | "viewer") || "viewer",
			isScanOpen: uiState.isScanOpen,
			scanInitialFile: uiState.scanInitialFile,
			pendingBillPayment: uiState.pendingBillPayment,
			analysisMonth: uiState.analysisMonth,
			currentMonthFilter: uiState.currentMonthFilter,
			isSettingsOpen: uiState.isSettingsOpen,
			loading: authData.loading || transactionData.loading || isRefreshing,
			isInitialLoading,
			isRefreshing,
			lastUpdated: transactionData.lastUpdated,
			appVersion: defaultConfig.appVersion,
			transactionModalState: uiState.transactionModalState,
			actions,
		}),
		[
			authData.user,
			authData.luts,
			authData.config,
			authData.accountBalances,
			authData.loading,
			transactionData.transactions,
			transactionData.loading,
			transactionData.lastUpdated,
			uiState.isAmountMasked,
			uiState.isGuideOpen,
			uiState.isTermsOpen,
			uiState.termsMode,
			uiState.isScanOpen,
			uiState.scanInitialFile,
			uiState.pendingBillPayment,
			uiState.analysisMonth,
			uiState.currentMonthFilter,
			uiState.isSettingsOpen,
			uiState.transactionModalState,
			isRefreshing,
			isInitialLoading,
			actions,
		],
	);

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

