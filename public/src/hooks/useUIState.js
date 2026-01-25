import { useCallback, useState } from "react";

/**
 * アプリケーションのUI状態（モーダル、フィルタ、表示設定など）を管理するフック。
 * グローバルなUIの状態遷移を一元管理する。
 * @returns {object} UI状態と操作関数を含むオブジェクト。
 */
export function useUIState() {
	const [isAmountMasked, setIsAmountMasked] = useState(false);
	const [pendingBillPayment, setPendingBillPayment] = useState(null);
	const [analysisMonth, setAnalysisMonth] = useState("all-time");
	const [currentMonthFilter, setCurrentMonthFilter] = useState("all-time");
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isGuideOpen, setIsGuideOpen] = useState(false);
	const [isTermsOpen, setIsTermsOpen] = useState(false);
	const [isScanOpen, setIsScanOpen] = useState(false);
	const [scanInitialFile, setScanInitialFile] = useState(null);
	const [termsMode, setTermsMode] = useState("viewer");

	const [transactionModalState, setTransactionModalState] = useState({
		isOpen: false,
		transaction: null,
		prefillData: null,
	});

	/**
	 * 取引編集モーダルを開く。
	 * @param {object|null} [transaction=null] - 編集対象の取引データ。nullの場合は新規作成。
	 * @param {object|null} [prefillData=null] - 新規作成時の初期値。
	 */
	const openTransactionModal = useCallback(
		(transaction = null, prefillData = null) => {
			setTransactionModalState({
				isOpen: true,
				transaction,
				prefillData,
			});
		},
		[],
	);

	/**
	 * 取引編集モーダルを閉じる。
	 */
	const closeTransactionModal = useCallback(() => {
		setTransactionModalState({
			isOpen: false,
			transaction: null,
			prefillData: null,
		});
	}, []);

	return {
		isAmountMasked,
		setIsAmountMasked,
		pendingBillPayment,
		setPendingBillPayment,
		analysisMonth,
		setAnalysisMonth,
		currentMonthFilter,
		setCurrentMonthFilter,
		isSettingsOpen,
		setIsSettingsOpen,
		isGuideOpen,
		setIsGuideOpen,
		isTermsOpen,
		setIsTermsOpen,
		isScanOpen,
		setIsScanOpen,
		scanInitialFile,
		setScanInitialFile,
		termsMode,
		setTermsMode,
		transactionModalState,
		setTransactionModalState,
		openTransactionModal,
		closeTransactionModal,
	};
}
