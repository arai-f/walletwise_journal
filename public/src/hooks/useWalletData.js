import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { config as defaultConfig } from "../config.js";
import { auth } from "../firebase.js";
import * as store from "../services/store.js";
import * as utils from "../utils.js";

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
	const [pendingBillPayment, setPendingBillPayment] = useState(null); // Used for bill payment flow
	const [analysisMonth, setAnalysisMonth] = useState("all-time");
	const [currentMonthFilter, setCurrentMonthFilter] = useState("all-time");
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [lastUpdated, setLastUpdated] = useState(null);

	// Transaction Modal State
	const [transactionModalState, setTransactionModalState] = useState({
		isOpen: false,
		transaction: null,
		prefillData: null,
	});

	// Initial Data Loading Logic (extracted from main.jsx loadLutsAndConfig)
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
			console.error("Failed to load LUTs and Config:", error);
		}
	}, []);

	// Transaction Data Loading Logic (extracted from main.jsx loadData)
	const loadData = useCallback(async () => {
		if (!auth.currentUser) return;
		try {
			const period = config.displayPeriod || 3;
			const [txs, balances] = await Promise.all([
				store.fetchTransactionsForPeriod(period),
				store.fetchAccountBalances(),
			]);

			setTransactions(txs);
			setAccountBalances(balances); // Initial fetch, subscription handles updates

			setLastUpdated(new Date());
		} catch (error) {
			console.error("Failed to load data:", error);
		}
	}, [config.displayPeriod]);

	// Initialization Effect
	useEffect(() => {
		const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
			setUser(currentUser);
			if (currentUser) {
				setLoading(true);
				await loadLutsAndConfig();
				// loadData will be triggered by config change or we call it explicitly here
				// Note: loadData depends on config, so we might need to wait for config to be set.
				// However, config state update is async.
				// We can chaining:
				// But easier is to just reload everything.

				// Let's call loadData separately or inside loadLutsAndConfig promise chain if strictly needed sequentially.
				// For now, assume sequential await in this effect is fine.
				// But loadData uses `config` from state which might be stale in this closure?
				// Actually `loadData` function uses `config` from closure which is stale?
				// Yes, `loadData` depends on `config`.
				// So we should probably just set a "ready to load data" flag or effect.
			} else {
				// Cleanup
				setTransactions([]);
				setAccountBalances({});
				setMonthlyStats([]);
				setLuts({ accounts: new Map(), categories: new Map() });
				setConfig({});
				setLoading(false);
			}
		});
		return () => unsubscribeAuth();
	}, [loadLutsAndConfig]);

	// Effect to load data when user/config is ready
	useEffect(() => {
		if (user && Object.keys(config).length > 0) {
			loadData().finally(() => setLoading(false));
		}
	}, [user, config, loadData]);

	// Subscriptions
	useEffect(() => {
		if (!user) return;

		const unsubBalances = store.subscribeAccountBalances((newBalances) => {
			setAccountBalances(newBalances);
		});

		const unsubStats = store.subscribeUserStats((stats) => {
			setMonthlyStats(stats || []);
		});

		return () => {
			if (unsubBalances) unsubBalances();
			if (unsubStats) unsubStats();
		};
	}, [user]);

	// Modal Actions
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

	const saveTransactionWrapper = useCallback(
		async (data) => {
			// Logic ported from main.jsx handleFormSubmit

			// 1. Check Date Range
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

			// 2. Metadata integrity checks for existing transaction
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
				// Account/Category mappings
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

					// Credit Card Payment Integrity Check
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
				// 3. Pending Bill Payment Metadata injection
				if (saveData.type === "transfer" && pendingBillPayment) {
					saveData.metadata = {
						paymentTargetCardId: pendingBillPayment.paymentTargetCardId,
						paymentTargetClosingDate:
							pendingBillPayment.paymentTargetClosingDate,
					};
					setPendingBillPayment(null);
				}

				// 4. Save to Firestore
				await store.saveTransaction(saveData);

				// 5. Cleanup and Reload
				closeTransactionModal();
				await loadData();
			} catch (err) {
				console.error("Save Error:", err);
				alert("保存に失敗しました: " + err.message);
			}
		},
		[config, transactions, pendingBillPayment, loadData, closeTransactionModal]
	);

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
				console.error("Delete Error:", err);
				alert("削除に失敗しました");
			}
		},
		[transactions, loadData, closeTransactionModal]
	);

	const actions = {
		login: async () => {
			const provider = new GoogleAuthProvider();
			try {
				await signInWithPopup(auth, provider);
			} catch (error) {
				console.error("Login failed:", error);
				throw error;
			}
		},
		logout: async () => {
			await signOut(auth);
		},
		refreshData: loadData,
		refreshSettings: async (shouldReloadData = false) => {
			await loadLutsAndConfig();
			if (shouldReloadData) await loadData();
		},
		setPendingBillPayment,
		setAnalysisMonth,
		setCurrentMonthFilter,
		setIsAmountMasked,
		setIsSettingsOpen,
		// Helper to update config and reload
		updateConfig: async (newConfig) => {
			setConfig((prev) => ({ ...prev, ...newConfig }));
			// Note: saving to store should probably happen here or in caller
			await store.saveConfig(newConfig);
			// loadData will be triggered by effect if config object changes references substantially or we explicitly call it
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
