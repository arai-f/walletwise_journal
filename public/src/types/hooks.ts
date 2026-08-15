/**
 * カスタムフック群（`public/src/hooks/*`）で利用する共通型定義。
 * 既存の挙動を変えないよう、`any` / `unknown` を避けつつ実装内容に即した最小表現を用いる。
 */

import type { Account, CategoryInfo } from "../components/index.js";
import type { AppConfig } from "../types/settings.js";

/**
 * 取引の種別。Firestore上のドキュメントとUI上のフォーム双方で利用される。
 */
export type TransactionType = "income" | "expense" | "transfer";

/**
 * 取引データ本体（最小表現）。
 * Firestoreから取得した値をJS側で扱う際の共通形。
 * 旧実装と互換性を持たせるため、`date` は `string` を中心にゆるく受ける。
 */
export interface Transaction {
	/** FirestoreドキュメントID。 */
	id: string;
	/** 取引種別。 */
	type: TransactionType;
	/** 取引日。string / Date / Firestore Timestamp など呼び出し側の都合に合わせる。 */
	date: string | Date | { toDate: () => Date };
	/** 金額。 */
	amount: number | string;
	/** 取引内容。 */
	description?: string;
	/** メモ。 */
	memo?: string;
	/** 紐づくカテゴリID。 */
	categoryId?: string;
	/** 振替元／支払元口座ID。 */
	fromAccountId?: string;
	/** 振替先口座ID。 */
	toAccountId?: string;
	/** メタデータ（クレジットカード請求支払い紐付け等）。 */
	metadata?: TransactionMetadata;
	/** 旧コンポーネントの `TransactionData`（インデックスシグネチャなし）と互換にする。 */
	[key: string]: unknown;
}

/**
 * UI 側へ返す取引データの正規化済み形。
 * `date` を `string`（`yyyy-MM-dd` 等）に統一することで、既存の
 * コンポーネント側の `TransactionData` 型と互換性を取る。
 * 呼び出し側が必須フィールドとして扱う `description` は常に string として返す。
 */
export interface TransactionOutput {
	id: string;
	type: TransactionType;
	date: string;
	amount: number;
	description: string;
	memo?: string;
	categoryId: string;
	fromAccountId: string;
	toAccountId?: string;
	metadata?: TransactionMetadata;
}

/**
 * 取引に紐付くメタデータ。
 */
export interface TransactionMetadata {
	/** 紐付け対象のクレジットカードID。 */
	paymentTargetCardId?: string;
	/** 対象締め日。 */
	paymentTargetClosingDate?: string;
}

/**
 * マスタデータのルックアップテーブル。
 * 口座マップとカテゴリマップを保持する。
 * 旧コンポーネント側が口座マップ値の `type` を `string` で持っているため、緩めに受ける。
 */
export interface Luts {
	accounts: Map<
		string,
		| Account
		| { id: string; name: string; type: string; isDeleted?: boolean }
	>;
	categories: Map<string, CategoryInfo>;
}

/**
 * カテゴリIDから名称を取得するヘルパー関数の型。
 */
export type GetCategoryName = (id: string | undefined | null) => string;

/**
 * 口座残高マップ。
 */
export type AccountBalances = Record<string, number>;

/**
 * 取引保存時の入力データ。
 * 編集時は `id` を含み、新規作成時は `id` を含まない（または一時ID）。
 */
export interface TransactionInput {
	/** 既存取引のID。 */
	id?: string;
	/** 取引種別。 */
	type: TransactionType;
	/** 取引日（文字列 or Date）。 */
	date: string | Date;
	/** 金額（文字列または数値）。 */
	amount: number | string;
	/** 取引内容。 */
	description?: string;
	/** メモ。 */
	memo?: string;
	/** カテゴリID。 */
	categoryId?: string;
	/** 振替元／支払元口座ID。 */
	fromAccountId?: string;
	/** 振替先口座ID。 */
	toAccountId?: string;
}

/**
 * 取引保存後にFirestoreから返されるID。
 */
export type TransactionSaveResult = string;

/**
 * AIアドバイザー用の基本統計データ。
 */
export interface AdvisorBaseStats {
	/** 対象期間（"yyyy-MM-dd 〜 yyyy-MM-dd" 形式）。 */
	period: string;
	/** 総収入。 */
	totalIncome: number;
	/** 総支出。 */
	totalExpense: number;
	/** 収支バランス。 */
	balance: number;
	/** 月次推移（複数行文字列）。 */
	monthlyTrends: string;
	/** 取引件数。 */
	count: number;
}

/**
 * AIアドバイザーAPIレスポンス。
 */
export interface AdvisorApiResponse {
	/** 回答本文。 */
	adviceText?: string;
	/** 警告レベル。 */
	alertLevel?: "safe" | "warning" | "danger";
	/** 分析ポイント。 */
	analysisPoints?: unknown[];
}

/**
 * AIアドバイザーAPI呼び出しペイロード。
 */
export interface AdvisorPayload {
	/** 会話開始フラグ。 */
	isStart: boolean;
	/** ベース統計。 */
	baseStats: AdvisorBaseStats;
	/** ユーザー入力（開始時以外）。 */
	text?: string;
	/** 直近の会話履歴。 */
	history?: Array<{ role: string; text: string }>;
	/** 抽出済み関連データ。 */
	relevantData?: Record<string, unknown>;
}

/**
 * アドバイザー会話内の分析ポイント。
 * 旧コンポーネントが `point.type === "warning"` 等の形で参照するため、
 * 最低限のキーを持つオブジェクト型として定義する。
 */
export interface AdvisorAnalysisPoint {
	type?: string;
	title?: string;
	content?: string;
}

/**
 * アドバイザー会話内のメッセージ。
 */
export interface AdvisorMessage {
	role: "user" | "model";
	text: string;
	alertLevel?: "safe" | "warning" | "danger";
	analysisPoints?: AdvisorAnalysisPoint[];
}

/**
 * アドバイザー呼び出し結果（関連データ）。
 */
export interface RelevantDataResult {
	list: string;
	description: string;
	count?: number;
	isPartial?: boolean;
	stats?: {
		totalExpense?: number;
		totalIncome?: number;
		totalTransfer?: number;
		topCategories?: string;
	};
}

/**
 * クレジットカード請求支払いの保留情報。
 */
export interface PendingBillPayment {
	/** 紐付け対象のクレジットカードID。 */
	paymentTargetCardId: string;
	/** 対象締め日文字列。 */
	paymentTargetClosingDate: string;
}

/**
 * `useScanReceipt` で編集する取引の行データ。
 * `useScanReceipt` 内で生成される一時的な取引オブジェクト。
 */
export interface ScanTransactionRow {
	/** 一意な行ID。 */
	id: string;
	/** 取引日（文字列）。 */
	date: string;
	/** 金額（文字列、編集中は空文字の可能性あり）。 */
	amount: string;
	/** 取引種別。 */
	type: TransactionType;
	/** カテゴリID。 */
	categoryId: string;
	/** 取引内容。 */
	description: string;
	/** メモ。 */
	memo: string;
}

/**
 * `useTransactionForm` 内部で利用するフォームデータ。
 */
export interface TransactionFormData {
	id?: string | null;
	type: TransactionType;
	date: string;
	amount: string | number;
	categoryId: string;
	fromAccountId: string;
	toAccountId: string;
	description: string;
	memo: string;
}

/**
 * 取引フォームのモード。
 */
export type TransactionFormMode = "create" | "edit" | "prefill" | "copy";

/**
 * 種別ごとに直近で選んでいたカテゴリを覚えておくためのマップ。
 */
export interface LastCategories {
	expense: string;
	income: string;
}

/**
 * 取引編集モーダルの状態。
 */
export interface TransactionModalState {
	/** モーダル開閉状態。 */
	isOpen: boolean;
	/** 編集対象取引（新規作成時はnull）。 */
	transaction: Transaction | null;
	/** 新規作成時の初期値（呼び出し側の緩い型）。 */
	prefillData: Record<string, unknown> | null;
}

/**
 * `useImageViewer` で利用するビュー状態。
 */
export interface ImageViewerState {
	scale: number;
	x: number;
	y: number;
	dragging: boolean;
	startX: number;
	startY: number;
}

/**
 * `useDashboardData` の月次推移レコード。
 */
export interface DashboardHistoryEntry {
	/** 'yyyy-MM' 形式の月。 */
	month: string;
	/** 該当月の純資産。 */
	netWorth: number;
	/** 該当月の収入合計。 */
	income: number;
	/** 該当月の支出合計。 */
	expense: number;
	/** 未来月かどうか。 */
	isFuture: boolean;
}

/**
 * `useDashboardData` の日次推移レコード。
 */
export interface DashboardDailyEntry {
	/** 'yyyy-MM-dd' 形式の日付。 */
	date: string;
	/** 該当日の資産残高。 */
	value: number;
}

/**
 * `useDashboardData` の戻り値。
 * 旧コンポーネントの `TransactionData` 互換のため、`Transaction` ではなく
 * `date: string, amount: number` に正規化した `TransactionOutput` を返す。
 */
export interface DashboardData {
	displayHistoricalData: DashboardHistoryEntry[];
	dailyTotalHistory: DashboardDailyEntry[];
	getAccountHistory: (targetAccountId?: string | null) => DashboardDailyEntry[];
	visibleTransactions: TransactionOutput[];
	analysisTargetTransactions: TransactionOutput[];
	isDataInsufficient: boolean;
	availableMonths: string[];
}

/**
 * `useUIState` の戻り値。
 */
export interface UIState {
	isAmountMasked: boolean;
	setIsAmountMasked: (v: boolean) => void;
	pendingBillPayment: PendingBillPayment | null;
	setPendingBillPayment: (v: PendingBillPayment | null) => void;
	analysisMonth: string;
	setAnalysisMonth: (v: string) => void;
	currentMonthFilter: string;
	setCurrentMonthFilter: (v: string) => void;
	isSettingsOpen: boolean;
	setIsSettingsOpen: (v: boolean) => void;
	isGuideOpen: boolean;
	setIsGuideOpen: (v: boolean) => void;
	isTermsOpen: boolean;
	setIsTermsOpen: (v: boolean) => void;
	isScanOpen: boolean;
	setIsScanOpen: (v: boolean) => void;
	scanInitialFile: File | null;
	setScanInitialFile: (v: File | null) => void;
	termsMode: string;
	setTermsMode: (v: string) => void;
	transactionModalState: TransactionModalState;
	setTransactionModalState: (v: TransactionModalState) => void;
	openTransactionModal: (
		transaction?: Transaction | null,
		prefillData?: TransactionFormData | null,
	) => void;
	closeTransactionModal: () => void;
}

/**
 * `useAuthData` の戻り値。
 */
export interface AuthData {
	user: unknown;
	luts: Luts;
	config: AppConfig;
	accountBalances: AccountBalances;
	loading: boolean;
	login: () => Promise<void>;
	logout: () => Promise<void>;
	updateConfig: (newConfig: AppConfig | Record<string, unknown>) => Promise<void>;
	refreshSettings: () => Promise<void>;
}

/**
 * `useScanReceipt` の戻り値。
 */
export interface ScanReceiptState {
	step: string;
	setStep: (v: string) => void;
	isAnalyzing: boolean;
	setIsAnalyzing: (v: boolean) => void;
	isSaving: boolean;
	isAnalyzingRef: React.MutableRefObject<boolean>;
	transactions: ScanTransactionRow[];
	setTransactions: (
		v:
			| ScanTransactionRow[]
			| ((prev: ScanTransactionRow[]) => ScanTransactionRow[]),
	) => void;
	globalAccountId: string;
	setGlobalAccountId: (v: string) => void;
	expandedRowId: string | null;
	setExpandedRowId: (v: string | null) => void;
	getSortedAccounts: () => Account[];
	getSortedCategories: (type: "income" | "expense") => CategoryInfo[];
	handleAnalysisStart: (file: File) => Promise<void>;
	handleAddRow: () => void;
	handleTransactionChange: (
		id: string,
		field: keyof ScanTransactionRow,
		value: string,
	) => void;
	handleDeleteRow: (id: string) => void;
	handleSaveTransactions: () => Promise<void>;
}

/**
 * `useTransactionForm` の戻り値。
 */
export interface TransactionFormState {
	formData: TransactionFormData;
	setFormData: (
		v: TransactionFormData | ((prev: TransactionFormData) => TransactionFormData),
	) => void;
	mode: TransactionFormMode;
	isSaving: boolean;
	handleChange: (e: { target: { name: string; value: string } }) => void;
	handleAmountChange: (e: { target: { value: string } }) => void;
	handleTypeChange: (newType: TransactionType) => void;
	handleSubmit: (e: { preventDefault: () => void }) => Promise<void>;
	handleDelete: () => void;
	handleCopy: () => void;
	getSortedAccounts: () => Account[];
	getSortedCategories: (type: "income" | "expense") => CategoryInfo[];
}

/**
 * `useTransactions` の戻り値。
 * `AppContext.tsx` の `AppActions` との互換性のため、関数シグネチャは緩める。
 */
export interface TransactionsState {
	transactions: TransactionOutput[];
	lastUpdated: Date | null;
	loading: boolean;
	refreshData: LooseFn;
	saveTransaction: LooseFn;
	deleteTransaction: LooseFn;
}

/**
 * `AppContext` 等の緩いアクションシグネチャと互換性のある関数型。
 */
export type LooseFn = (...args: unknown[]) => unknown;

/**
 * `useTransactions` の入力パラメータ。
 */
export interface UseTransactionsParams {
	user: unknown;
	config: AppConfig;
	uiState: UIState;
}

/**
 * `useAskAdvisor` の戻り値。
 */
export interface AdvisorState {
	isOpen: boolean;
	setIsOpen: (v: boolean) => void;
	messages: AdvisorMessage[];
	input: string;
	setInput: (v: string) => void;
	isLoading: boolean;
	chatLogRef: React.MutableRefObject<HTMLDivElement | null>;
	handleUserSubmit: (forcedText?: string | null) => Promise<void>;
}