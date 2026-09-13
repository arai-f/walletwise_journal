import { useCallback, useMemo, useState } from "react";
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
		setActiveModal((prev) => {
			const currentIsOpen = prev?.type === "settings";
			const next = typeof open === "function" ? open(currentIsOpen) : open;
			return next ? { type: "settings" } : null;
		});
	}, []);

	const setIsGuideOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
		setActiveModal((prev) => {
			const currentIsOpen = prev?.type === "guide";
			const next = typeof open === "function" ? open(currentIsOpen) : open;
			return next ? { type: "guide" } : null;
		});
	}, []);

	const setIsTermsOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
		setActiveModal((prev) => {
			const currentIsOpen = prev?.type === "terms";
			const next = typeof open === "function" ? open(currentIsOpen) : open;
			return next ? { type: "terms", mode: "viewer" } : null;
		});
	}, []);

	const setTermsMode = useCallback((mode: "viewer" | "agreement") => {
		setActiveModal((prev) => (prev?.type === "terms" ? { ...prev, mode } : { type: "terms", mode }));
	}, []);

	const setIsScanOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
		setActiveModal((prev) => {
			const currentIsOpen = prev?.type === "scan";
			const next = typeof open === "function" ? open(currentIsOpen) : open;
			return next ? { type: "scan" } : null;
		});
	}, []);

	const setScanInitialFile = useCallback((file: File | null) => {
		setActiveModal((prev) => (prev?.type === "scan" ? { ...prev, file } : { type: "scan", file }));
	}, []);

	const setTransactionModalState = useCallback((state: TransactionModalState) => {
		if (state.isOpen) {
			setActiveModal({ type: "transaction", transaction: state.transaction, prefillData: state.prefillData });
		} else {
			setActiveModal(null);
		}
	}, []);

	const isSettingsOpen = activeModal?.type === "settings";
	const isGuideOpen = activeModal?.type === "guide";
	const isTermsOpen = activeModal?.type === "terms";
	const isScanOpen = activeModal?.type === "scan";
	const scanInitialFile = activeModal?.type === "scan" ? activeModal.file || null : null;
	const termsMode = activeModal?.type === "terms" && activeModal.mode ? activeModal.mode : "viewer";

	const transactionModalState: TransactionModalState = useMemo(
		() => ({
			isOpen: activeModal?.type === "transaction",
			transaction: activeModal?.type === "transaction" ? activeModal.transaction || null : null,
			prefillData: activeModal?.type === "transaction" ? activeModal.prefillData || null : null,
		}),
		[activeModal],
	);

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
		setTransactionModalState: setTransactionModalState as Setter<void>,
		openTransactionModal: openTransactionModal as Setter<void>,
		closeTransactionModal: closeModal as Setter<void>,
	};
}
