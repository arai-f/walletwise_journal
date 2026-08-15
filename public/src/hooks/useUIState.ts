import { useState } from "react";
import type { Transaction } from "../types/hooks.js";

/**
 * `useUIState` が返す setter 関数の共通シグネチャ。
 * setter 側は引数／戻り値の型を緩め、既存の呼び出し側
 * （例: `AppContext.tsx` の `AppActions` で `(...args: unknown[]) => unknown` と
 * 受ける前提）との互換性を保つ。
 */
type Setter<T> = (...args: unknown[]) => T;

/**
 * `useUIState` が保持する取引編集モーダルの状態形。
 * 編集時に完全な取引データを保持するため、`transaction` は `Transaction` 型とする。
 * `AppContext` 側との互換のため、`prefillData` は緩めた型で保持する。
 */
export interface TransactionModalState {
	isOpen: boolean;
	transaction: Transaction | null;
	prefillData: Record<string, unknown> | null;
}

/**
 * `useUIState` が返すオブジェクトの型。
 */
export type UseUIStateReturn = {
	isAmountMasked: boolean;
	setIsAmountMasked: Setter<void>;
	pendingBillPayment: Record<string, unknown> | null;
	setPendingBillPayment: Setter<void>;
	analysisMonth: string;
	setAnalysisMonth: Setter<void>;
	currentMonthFilter: string;
	setCurrentMonthFilter: Setter<void>;
	isSettingsOpen: boolean;
	setIsSettingsOpen: Setter<void>;
	isGuideOpen: boolean;
	setIsGuideOpen: Setter<void>;
	isTermsOpen: boolean;
	setIsTermsOpen: Setter<void>;
	isScanOpen: boolean;
	setIsScanOpen: Setter<void>;
	scanInitialFile: File | null;
	setScanInitialFile: Setter<void>;
	termsMode: string;
	setTermsMode: Setter<void>;
	transactionModalState: TransactionModalState;
	setTransactionModalState: Setter<void>;
	openTransactionModal: Setter<void>;
	closeTransactionModal: Setter<void>;
};

/**
 * アプリケーションのUI状態（モーダル、フィルタ、表示設定など）を管理するフック。
 * グローバルなUIの状態遷移を一元管理する。
 * @returns {UseUIStateReturn} UI状態と操作関数を含むオブジェクト。
 */
export function useUIState(): UseUIStateReturn {
	const [isAmountMasked, setIsAmountMasked] = useState<boolean>(false);
	const [pendingBillPayment, setPendingBillPayment] = useState<
		Record<string, unknown> | null
	>(null);
	const [analysisMonth, setAnalysisMonth] = useState<string>("all-time");
	const [currentMonthFilter, setCurrentMonthFilter] =
		useState<string>("all-time");
	const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
	const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
	const [isTermsOpen, setIsTermsOpen] = useState<boolean>(false);
	const [isScanOpen, setIsScanOpen] = useState<boolean>(false);
	const [scanInitialFile, setScanInitialFile] = useState<File | null>(null);
	const [termsMode, setTermsMode] = useState<string>("viewer");

	const [transactionModalState, setTransactionModalState] =
		useState<TransactionModalState>({
			isOpen: false,
			transaction: null,
			prefillData: null,
		});

	/**
	 * 取引編集モーダルを開く。
	 * @param {Transaction | null} [transaction=null] - 編集対象の取引データ。nullの場合は新規作成。
	 * @param {Record<string, unknown> | null} [prefillData=null] - 新規作成時の初期値。
	 */
	const openTransactionModal = (
		transaction: Transaction | null = null,
		prefillData: Record<string, unknown> | null = null,
	): void => {
		setTransactionModalState({
			isOpen: true,
			transaction,
			prefillData,
		});
	};

	/**
	 * 取引編集モーダルを閉じる。
	 */
	const closeTransactionModal = (): void => {
		setTransactionModalState({
			isOpen: false,
			transaction: null,
			prefillData: null,
		});
	};

	return {
		isAmountMasked,
		setIsAmountMasked: setIsAmountMasked as Setter<void>,
		pendingBillPayment,
		setPendingBillPayment: setPendingBillPayment as Setter<void>,
		analysisMonth,
		setAnalysisMonth: setAnalysisMonth as Setter<void>,
		currentMonthFilter,
		setCurrentMonthFilter: setCurrentMonthFilter as Setter<void>,
		isSettingsOpen,
		setIsSettingsOpen: setIsSettingsOpen as Setter<void>,
		isGuideOpen,
		setIsGuideOpen: setIsGuideOpen as Setter<void>,
		isTermsOpen,
		setIsTermsOpen: setIsTermsOpen as Setter<void>,
		isScanOpen,
		setIsScanOpen: setIsScanOpen as Setter<void>,
		scanInitialFile,
		setScanInitialFile: setScanInitialFile as Setter<void>,
		termsMode,
		setTermsMode: setTermsMode as Setter<void>,
		transactionModalState,
		setTransactionModalState:
			setTransactionModalState as Setter<void>,
		openTransactionModal: openTransactionModal as Setter<void>,
		closeTransactionModal: closeTransactionModal as Setter<void>,
	};
}
