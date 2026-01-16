import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { config as defaultConfig } from "../config.js";
import { auth } from "../firebase.js";
import * as notification from "../services/notification.js";
import * as store from "../services/store.js";
import * as utils from "../utils.js";

/**
 * アプリケーション全体のウォレットデータ（ユーザー、設定、取引、残高など）を管理するカスタムフック。
 * Firestoreとの同期、ローカルステートの管理、およびデータ操作のアクションを提供する。
 * @returns {object} ステートとアクションを含むオブジェクト。
 * @property {object} state - アプリケーションの現在の状態（user, luts, config, transactions, etc...）。
 * @property {object} actions - データを操作するための関数群（login, logout, refresh, saveTransaction, etc...）。
 */
export function useWalletData() {
	const [user, setUser] = useState(null);
	const [luts, setLuts] = useState({
		accounts: new Map(),
		categories: new Map(),
	});
	const [config, setConfig] = useState({});
	const [accountBalances, setAccountBalances] = useState({});
	const [transactions, setTransactions] = useState([]);
	const [monthlyStats, setMonthlyStats] = useState([]);
	const [isAmountMasked, setIsAmountMasked] = useState(false);
	const [pendingBillPayment, setPendingBillPayment] = useState(null);
	const [analysisMonth, setAnalysisMonth] = useState("all-time");
	const [currentMonthFilter, setCurrentMonthFilter] = useState("all-time");
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isGuideOpen, setIsGuideOpen] = useState(false);
	const [isTermsOpen, setIsTermsOpen] = useState(false);
	const [isReportOpen, setIsReportOpen] = useState(false);
	const [isScanOpen, setIsScanOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [lastUpdated, setLastUpdated] = useState(null);

	const [termsMode, setTermsMode] = useState("viewer");
	const [transactionModalState, setTransactionModalState] = useState({
		isOpen: false,
		transaction: null,
		prefillData: null,
	});

	/**
	 * ユーザーの基本設定（口座、カテゴリ、個人設定）をFirestoreから読み込む。
	 * アプリケーションの初期化時や設定変更時に呼び出される。
	 * @async
	 */
	const loadLutsAndConfig = useCallback(async () => {
		if (!auth.currentUser) return;
		try {
			const {
				accounts,
				categories,
				config: userConfig,
			} = await store.fetchAllUserData();

			const accountsMap = new Map();
			if (accounts) {
				for (const id in accounts) {
					accountsMap.set(id, { id, ...accounts[id] });
				}
			}

			const categoriesMap = new Map();
			if (categories) {
				for (const id in categories) {
					categoriesMap.set(id, { id, ...categories[id] });
				}
			}

			setLuts({
				categories: categoriesMap,
				accounts: accountsMap,
			});
			setConfig(userConfig || {});
		} catch (error) {
			console.error("[UseWalletData] Failed to load LUTs and Config:", error);
		}
	}, []);

	/**
	 * 指定された表示期間に基づいて、Firestoreから取引履歴を取得する。
	 * 口座残高はリアルタイムリスナー（subscribeAccountBalances）で管理されるため、ここでは取得しない。
	 * `config.displayPeriod` の変更を検知して自動的に再取得を行う。
	 * @async
	 */
	const loadData = useCallback(async () => {
		if (!auth.currentUser) return;
		try {
			const period = config.displayPeriod || 3;
			// バランス取得（store.fetchAccountBalances）は削除し、Race Conditionを防ぐ
			const txs = await store.fetchTransactionsForPeriod(period);

			setTransactions(txs);
			setLastUpdated(new Date());
		} catch (error) {
			console.error("[UseWalletData] Failed to load data:", error);
		}
	}, [config.displayPeriod]);

	useEffect(() => {
		const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
			setUser(currentUser);
			if (currentUser) {
				setLoading(true);
				await loadLutsAndConfig();
			} else {
				// Cleanup
				setTransactions([]);
				setAccountBalances({});
				setMonthlyStats([]);
				setLuts({ accounts: new Map(), categories: new Map() });
				setConfig({});
				setLoading(false);
				setIsSettingsOpen(false);
				setIsGuideOpen(false);
				setIsTermsOpen(false);
				setIsReportOpen(false);
				setIsScanOpen(false);
				setTermsMode("viewer");
				setTransactionModalState({
					isOpen: false,
					transaction: null,
					prefillData: null,
				});
			}
		});
		return () => unsubscribeAuth();
	}, [loadLutsAndConfig]);

	useEffect(() => {
		// config.displayPeriod が変更された時、または初期ロード時のみ実行
		if (user && Object.keys(config).length > 0) {
			loadData().finally(() => setLoading(false));
		}
	}, [user, config.displayPeriod, loadData]);

	useEffect(() => {
		if (loading) return;

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
	}, [user, config, termsMode, loading]);

	useEffect(() => {
		if (loading) return;

		if (
			user &&
			config &&
			defaultConfig.guideVersion &&
			config.guide?.lastSeenVersion !== defaultConfig.guideVersion
		) {
			setIsGuideOpen(true);
		}
	}, [user, config, loading]);

	useEffect(() => {
		if (!user) return;

		const unsubBalances = store.subscribeAccountBalances((newBalances) => {
			setAccountBalances(newBalances);
		});

		const unsubStats = store.subscribeUserStats((stats) => {
			setMonthlyStats(stats || []);
		});

		return () => {
			if (unsubBalances) unsubBalances(); // call internal unsubscribe
			if (unsubStats) unsubStats(); // call internal unsubscribe

			// 明示的なグローバルクリーンアップも呼んでおく
			store.unsubscribeAccountBalances();
			store.unsubscribeUserStats();
		};
	}, [user]);

	const openTransactionModal = useCallback(
		(transaction = null, prefillData = null) => {
			setTransactionModalState({
				isOpen: true,
				transaction,
				prefillData,
			});
		},
		[]
	);

	const closeTransactionModal = useCallback(() => {
		setTransactionModalState({
			isOpen: false,
			transaction: null,
			prefillData: null,
		});
	}, []);

	/**
	 * 取引データを保存（新規作成または更新）するラッパー関数。
	 * 表示期間外のチェック、整合性チェック、保留中の請求払いメタデータの付与などを行う。
	 * 処理完了後にデータを再ロードし、モーダルを閉じる。
	 * @async
	 * @param {object} data - フォームから送信された取引データ。
	 */
	const saveTransactionWrapper = useCallback(
		async (data) => {
			const transactionDate = new Date(data.date);
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - (config.displayPeriod || 3));
			startDate.setDate(1);
			startDate.setHours(0, 0, 0, 0);

			if (transactionDate < startDate) {
				const isConfirmed = confirm(
					"この取引は現在の表示範囲外の日付です。\n\n保存後、この取引を見るには設定から表示期間を長くする必要があります。\nこのまま保存しますか？"
				);
				if (!isConfirmed) return;
			}

			const transactionId = data.id;
			const type = data.type;
			const amountNum = Number(data.amount);

			const saveData = {
				id: transactionId,
				type: type,
				date: data.date,
				amount: amountNum,
				description: data.description,
				memo: data.memo,
				categoryId: data.categoryId,
				accountId: data.accountId,
				fromAccountId: data.fromAccountId,
				toAccountId: data.toAccountId,
			};

			if (transactionId) {
				const originalTransaction = transactions.find(
					(t) => t.id === transactionId
				);
				if (originalTransaction) {
					if (originalTransaction.metadata) {
						saveData.metadata = { ...originalTransaction.metadata };
					}

					if (
						type === "transfer" &&
						originalTransaction.type === "transfer" &&
						originalTransaction.metadata?.paymentTargetCardId
					) {
						const isAmountChanged = originalTransaction.amount !== amountNum;
						const isToAccountChanged =
							originalTransaction.toAccountId !== data.toAccountId;
						const isDateChanged =
							utils.toYYYYMMDD(originalTransaction.date) !== data.date;

						if (isAmountChanged || isToAccountChanged || isDateChanged) {
							const confirmMsg =
								"この振替はクレジットカードの請求支払いとして記録されています。\n" +
								"金額、日付、または振替先を変更すると、請求の「支払い済み」状態が解除される可能性があります。\n\n" +
								"変更を保存しますか？";
							if (!confirm(confirmMsg)) return;
						}
					}
				}
			}

			try {
				if (saveData.type === "transfer" && pendingBillPayment) {
					saveData.metadata = {
						paymentTargetCardId: pendingBillPayment.paymentTargetCardId,
						paymentTargetClosingDate:
							pendingBillPayment.paymentTargetClosingDate,
					};
					setPendingBillPayment(null);
				}

				await store.saveTransaction(saveData);
				closeTransactionModal();
				await loadData();
			} catch (err) {
				console.error("[UseWalletData] Save Error:", err);
				notification.error("保存に失敗しました: " + err.message);
			}
		},
		[config, transactions, pendingBillPayment, loadData, closeTransactionModal]
	);

	/**
	 * 指定された取引を削除するラッパー関数。
	 * 削除確認のダイアログを表示し、承諾された場合にFirestoreから削除する。
	 * 処理完了後にデータを再ロードし、モーダルを閉じる。
	 * @async
	 * @param {string} transactionId - 削除対象の取引ID。
	 */
	const deleteTransactionWrapper = useCallback(
		async (transactionId) => {
			if (!transactionId) return;
			if (!confirm("この取引を本当に削除しますか？")) return;

			try {
				const transactionToDelete = transactions.find(
					(t) => t.id === transactionId
				);
				if (transactionToDelete) {
					await store.deleteTransaction(transactionToDelete);
					closeTransactionModal();
					await loadData();
				}
			} catch (err) {
				console.error("[UseWalletData] Delete Error:", err);
				notification.error("削除に失敗しました");
			}
		},
		[transactions, loadData, closeTransactionModal]
	);

	/**
	 * 認証やデータ操作、設定変更などのアクションを定義するオブジェクト。
	 */
	const actions = {
		/**
		 * Google認証を使用してログインする。
		 * 失敗した場合はエラーをコンソールに出力し、再スローする。
		 * @async
		 */
		login: async () => {
			const provider = new GoogleAuthProvider();
			try {
				await signInWithPopup(auth, provider);
			} catch (error) {
				console.error("[UseWalletData] Login failed:", error);
				throw error;
			}
		},
		/**
		 * ログアウトする。
		 * @async
		 */
		logout: async () => {
			await signOut(auth);
		},
		refreshData: loadData,
		/**
		 * 設定とルックアップテーブルを再読み込みする。
		 * @async
		 * @param {boolean} [shouldReloadData=false] - データも再読み込みするかどうか。
		 */
		refreshSettings: async (shouldReloadData = false) => {
			await loadLutsAndConfig();
			if (shouldReloadData) await loadData();
		},
		setPendingBillPayment,
		setAnalysisMonth,
		setCurrentMonthFilter,
		setIsAmountMasked,
		setIsSettingsOpen,
		setIsGuideOpen,
		setIsTermsOpen,
		setTermsMode,
		setIsReportOpen,
		setIsScanOpen,
		/**
		 * 設定を更新し、Firestoreに保存する。
		 * @async
		 * @param {Object} newConfig - 更新する設定内容を含むオブジェクト。
		 */
		updateConfig: async (newConfig) => {
			// setConfig((prev) => ({ ...prev, ...newConfig })); // ドット記法更新に対応できないため削除
			await store.updateConfig(newConfig);
			await loadLutsAndConfig(); // 正規データを再取得
		},
		openTransactionModal,
		closeTransactionModal,
		saveTransaction: saveTransactionWrapper,
		deleteTransaction: deleteTransactionWrapper,
	};

	return {
		state: {
			user,
			luts,
			config,
			accountBalances,
			transactions,
			monthlyStats,
			isAmountMasked,
			isGuideOpen,
			isTermsOpen,
			termsMode,
			isReportOpen,
			isScanOpen,
			pendingBillPayment,
			analysisMonth,
			currentMonthFilter,
			isSettingsOpen,
			loading,
			lastUpdated,
			appVersion: defaultConfig.appVersion,
			transactionModalState,
		},
		actions,
	};
}
