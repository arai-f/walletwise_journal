import { useCallback, useEffect, useState } from "react";
import * as notification from "../services/notification.js";
import * as store from "../services/store.js";
import * as utils from "../utils.js";

/**
 * 取引データの取得、保存、削除を管理するフック。
 * 楽観的更新（Optimistic UI）により、Firestoreへの書き込み待ち時間を感じさせないUXを提供する。
 * @param {object} params
 * @param {object} params.user - 現在のユーザー。
 * @param {object} params.config - ユーザー設定（表示期間など）。
 * @param {object} params.uiState - UI状態（保留中の請求払い、モーダル閉じる関数など）。
 * @returns {object} 取引データと操作関数を含むオブジェクト。
 */
export function useTransactions({ user, config, uiState }) {
	const [transactions, setTransactions] = useState([]);
	const [lastUpdated, setLastUpdated] = useState(null);
	const [loading, setLoading] = useState(false);

	const { pendingBillPayment, setPendingBillPayment, closeTransactionModal } =
		uiState;

	/**
	 * 設定された表示期間に基づいて、Firestoreから取引履歴を取得する。
	 * @async
	 */
	const loadData = useCallback(async () => {
		if (!user) {
			setTransactions([]);
			return;
		}
		try {
			setLoading(true);
			const period = config.displayPeriod || 3;
			const txs = await store.fetchTransactionsForPeriod(period);
			setTransactions(txs);
			setLastUpdated(new Date());
		} catch (error) {
			console.error("[useTransactions] Failed to load data:", error);
		} finally {
			setLoading(false);
		}
	}, [user, config.displayPeriod]);

	// config.displayPeriod が変更された時、またはユーザー変更時にデータをロードする。
	useEffect(() => {
		if (user && Object.keys(config).length > 0) {
			loadData();
		}
	}, [user, config.displayPeriod, loadData]);

	/**
	 * 取引データを保存（新規作成または更新）する。
	 * 楽観的更新を行い、バックグラウンドでFirestoreへの保存を実行する。
	 * クレジットカード請求に関連する整合性チェックも行う。
	 * @async
	 * @param {object} data - 保存する取引データ。
	 */
	const saveTransaction = useCallback(
		async (data) => {
			const transactionDate = new Date(data.date);
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - (config.displayPeriod || 3));
			startDate.setDate(1);
			startDate.setHours(0, 0, 0, 0);

			// 表示期間外のデータ保存に対する警告。保存後にリストから消えてしまう混乱を防ぐため。
			if (transactionDate < startDate) {
				const isConfirmed = confirm(
					"この取引は現在の表示範囲外の日付です。\n\n保存後、この取引を見るには設定から表示期間を長くする必要があります。\nこのまま保存しますか？",
				);
				if (!isConfirmed) return;
			}

			const transactionId = data.id;
			const type = data.type;
			const amountNum = Number(data.amount);

			const saveData = {
				type: type,
				date: data.date,
				amount: amountNum,
				description: data.description || "",
				memo: data.memo || "",
				categoryId: data.categoryId || "",
				accountId: data.accountId || "",
				fromAccountId: data.fromAccountId || "",
				toAccountId: data.toAccountId || "",
			};

			if (transactionId) {
				saveData.id = transactionId;
				const originalTransaction = transactions.find(
					(t) => t.id === transactionId,
				);
				if (originalTransaction) {
					if (originalTransaction.metadata) {
						saveData.metadata = { ...originalTransaction.metadata };
					}

					// クレジットカード請求支払い（振替）の整合性チェック。
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

						// 金額や日付が変わると、請求データの「支払い済み」状態と矛盾が生じる可能性があるため警告する。
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

			const previousTransactions = transactions;

			try {
				// 請求支払いからの遷移の場合、メタデータを付与して紐付けを行う。
				if (saveData.type === "transfer" && pendingBillPayment) {
					saveData.metadata = {
						paymentTargetCardId: pendingBillPayment.paymentTargetCardId,
						paymentTargetClosingDate:
							pendingBillPayment.paymentTargetClosingDate,
					};
				}

				// 楽観的更新: サーバーレスポンスを待たずにUIを更新する。
				const optimisticId = transactionId || `temp-${Date.now()}`;
				const optimisticTx = {
					...saveData,
					id: optimisticId,
					date: new Date(saveData.date),
				};

				setTransactions((prev) => {
					const next = transactionId
						? prev.map((t) =>
								t.id === transactionId ? { ...t, ...optimisticTx } : t,
							)
						: [optimisticTx, ...prev];
					return next.sort((a, b) => b.date - a.date);
				});
				closeTransactionModal();

				// Firestoreへ保存。
				const savedId = await store.saveTransaction(saveData);

				// 新規作成時は一時IDを正規のIDに置き換える。
				if (!transactionId) {
					setTransactions((prev) =>
						prev.map((t) =>
							t.id === optimisticId ? { ...t, id: savedId } : t,
						),
					);
				}

				if (saveData.type === "transfer" && pendingBillPayment) {
					setPendingBillPayment(null);
				}

				notification.success("保存しました");
			} catch (err) {
				console.error("[useTransactions] Save Error:", err);
				notification.error(`保存に失敗しました: ${err.message}`);
				// エラー時は状態をロールバックし、最新データを再取得する。
				setTransactions(previousTransactions);
				await loadData();
			}
		},
		[
			config,
			transactions,
			pendingBillPayment,
			loadData,
			closeTransactionModal,
			setPendingBillPayment,
		],
	);

	/**
	 * 指定された取引を削除する。
	 * 削除確認を行い、楽観的更新でリストから即座に除外した後、Firestoreから削除する。
	 * @async
	 * @param {string} transactionId - 削除対象の取引ID。
	 */
	const deleteTransaction = useCallback(
		async (transactionId) => {
			if (!transactionId) return;

			const transactionToDelete = transactions.find(
				(t) => t.id === transactionId,
			);

			if (transactionToDelete) {
				if (
					// クレジットカード請求支払い（振替）の削除時の警告。
					transactionToDelete.type === "transfer" &&
					transactionToDelete.metadata?.paymentTargetCardId
				) {
					const confirmMsg =
						"この振替はクレジットカードの請求支払いとして記録・連携されています。\n" +
						"削除すると、請求の「支払い済み」状態が解除される可能性があります。\n\n" +
						"本当に削除しますか？";
					if (!confirm(confirmMsg)) return;
				} else {
					// 通常の削除確認。
					if (!confirm("この取引を本当に削除しますか？")) return;
				}

				const previousTransactions = transactions;
				// 楽観的更新: UIから即座に削除。
				setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
				closeTransactionModal();

				try {
					await store.deleteTransaction(transactionToDelete);
					notification.success("削除しました");
				} catch (err) {
					console.error("[useTransactions] Delete Error:", err);
					notification.error("削除に失敗しました");
					// エラー時は状態をロールバック。
					setTransactions(previousTransactions);
					await loadData();
				}
			}
		},
		[transactions, loadData, closeTransactionModal],
	);

	return {
		transactions,
		lastUpdated,
		loading,
		refreshData: loadData,
		saveTransaction,
		deleteTransaction,
	};
}
