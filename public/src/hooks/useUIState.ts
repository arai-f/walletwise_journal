import { useCallback, useState } from "react";
import type {
	Transaction,
	TransactionModalState,
} from "../types/hooks.js";

/**
 * 現在アクティブなモーダルの判別共用体型。
 */
export type ActiveModal =
	| { type: "transaction"; transaction?: Transaction | null; prefillData?: Record<string, unknown> | null }
	| { type: "scan"; file?: File | null }
	| { type: "settings" }
	| { type: "guide" }
	| { type: "terms"; mode?: "viewer" | "agreement" }
	| null;

type Setter<T> = (...args: unknown[]) => T;

export type UseUIStateReturn = {
	activeModal: ActiveModal;
	setActiveModal: (modal: ActiveModal) => void;
	openModal: (modal: NonNullable<ActiveModal>) => void;
	closeModal: () => void;
	isAmountMasked: boolean;
	setIsAmountMasked: Setter<void>;
	pendingBillPayment: Record<string, unknown> | null;
	setPendingBillPayment: Setter<void>;
	analysisMonth: string;
	setAnalysisMonth: Setter<void>;
	currentMonthFilter: string;
	setCurrentMonthFilter: Setter<void>;
	// 互換性アクセサ
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
	termsMode: "viewer" | "agreement";
	setTermsMode: Setter<void>;
	transactionModalState: TransactionModalState;
	setTransactionModalState: Setter<void>;
	openTransactionModal: Setter<void>;
	closeTransactionModal: Setter<void>;
};

/**
 * アプリケーションのUI状態（モーダル、フィルタ、表示設定など）を一元管理するフック。
 */
export function useUIState(): UseUIStateReturn {
	const [activeModal, setActiveModal] = useState<ActiveModal>(null);
	const [isAmountMasked, setIsAmountMasked] = useState<boolean>(false);
	const [pendingBillPayment, setPendingBillPayment] = useState<Record<string, unknown> | null>(null);
	const [analysisMonth, setAnalysisMonth] = useState<string>("all-time");
	const [currentMonthFilter, setCurrentMonthFilter] = useState<string>("all-time");

	const openModal = useCallback((modal: NonNullable<ActiveModal>) => {
		setActiveModal(modal);
	}, []);

	const closeModal = useCallback(() => {
		setActiveModal(null);
	}, []);

	// 既存コードとの互換ヘルパー
	const openTransactionModal = useCallback(
		(transaction: Transaction | null = null, prefillData: Record<string, unknown> | null = null) => {
			setActiveModal({ type: "transaction", transaction, prefillData });
		},
		[],
	);

	const setIsSettingsOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
		const next = typeof open === "function" ? open(activeModal?.type === "settings") : open;
		setActiveModal(next ? { type: "settings" } : null);
	}, [activeModal]);

	const setIsGuideOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
		const next = typeof open === "function" ? open(activeModal?.type === "guide") : open;
		setActiveModal(next ? { type: "guide" } : null);
	}, [activeModal]);

	const setIsTermsOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
		const next = typeof open === "function" ? open(activeModal?.type === "terms") : open;
		setActiveModal(next ? { type: "terms", mode: "viewer" } : null);
	}, [activeModal]);

	const setTermsMode = useCallback((mode: "viewer" | "agreement") => {
		setActiveModal((prev) => (prev?.type === "terms" ? { ...prev, mode } : { type: "terms", mode }));
	}, []);

	const setIsScanOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
		const next = typeof open === "function" ? open(activeModal?.type === "scan") : open;
		setActiveModal(next ? { type: "scan" } : null);
	}, [activeModal]);

	const setScanInitialFile = useCallback((file: File | null) => {
		setActiveModal({ type: "scan", file });
	}, []);

	const isSettingsOpen = activeModal?.type === "settings";
	const isGuideOpen = activeModal?.type === "guide";
	const isTermsOpen = activeModal?.type === "terms";
	const isScanOpen = activeModal?.type === "scan";
	const scanInitialFile = activeModal?.type === "scan" ? activeModal.file || null : null;
	const termsMode = activeModal?.type === "terms" && activeModal.mode ? activeModal.mode : "viewer";

	const transactionModalState: TransactionModalState = {
		isOpen: activeModal?.type === "transaction",
		transaction: activeModal?.type === "transaction" ? activeModal.transaction || null : null,
		prefillData: activeModal?.type === "transaction" ? activeModal.prefillData || null : null,
	};

	return {
		activeModal,
		setActiveModal,
		openModal,
		closeModal,
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
		setTransactionModalState: ((state: TransactionModalState) => {
			if (state.isOpen) {
				setActiveModal({ type: "transaction", transaction: state.transaction, prefillData: state.prefillData });
			} else {
				setActiveModal(null);
			}
		}) as Setter<void>,
		openTransactionModal: openTransactionModal as Setter<void>,
		closeTransactionModal: closeModal as Setter<void>,
	};
}
