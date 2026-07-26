import { useCallback, useEffect, useState } from "react";
import * as notification from "../services/notification.js";
import * as store from "../services/store.js";
import type {
	LooseFn,
	Transaction,
	TransactionInput,
	TransactionOutput,
	TransactionsState,
} from "../types/hooks.js";
import * as utils from "../utils.js";
import type { UseUIStateReturn } from "./useUIState.js";

/**
 * `useTransactions` の引数オブジェクト。
 */
export interface UseTransactionsParams {
	user: unknown;
	config: Record<string, unknown>;
	uiState: UseUIStateReturn;
}

/**
 * 取引データの取得、保存、削除を管理するフック。
 * 楽観的更新（Optimistic UI）により、Firestoreへの書き込み待ち時間を感じさせないUXを提供する。
 * @param {UseTransactionsParams} params - フック設定。
 * @returns {TransactionsState} 取引データと操作関数を含むオブジェクト。
 */
export function useTransactions({
	user,
	config,
	uiState,
}: UseTransactionsParams): TransactionsState {
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [loading, setLoading] = useState<boolean>(false);

	const { pendingBillPayment, setPendingBillPayment, closeTransactionModal } =
		uiState;

	/**
	 * 設定された表示期間に基づいて、Firestoreから取引履歴を取得する。
	 * @async
	 */
	const loadData = useCallback(async (): Promise<void> => {
		if (!user) {
			setTransactions([]);
			return;
		}
		try {
			setLoading(true);
			const period =
				(config.displayPeriod as number | undefined) || 3;
			const txs = (await store.fetchTransactionsForPeriod(
				period,
			)) as Transaction[];
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
	}, [user, config.displayPeriod, config, loadData]);

	/**
	 * 取引データを保存（新規作成または更新）する。
	 * 楽観的更新を行い、バックグラウンドでFirestoreへの保存を実行する。
	 * クレジットカード請求に関連する整合性チェックも行う。
	 * @async
	 * @param {TransactionInput} data - 保存する取引データ。
	 */
	const saveTransaction = async (data: TransactionInput): Promise<void> => {
		const transactionDate = new Date(data.date as string | number | Date);
		if (isNaN(transactionDate.getTime())) {
			notification.error("無効な日付です。");
			return;
		}
		const startDate = new Date();
		startDate.setMonth(
			startDate.getMonth() - ((config.displayPeriod as number) || 3),
		);
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

		const saveData: TransactionInput & {
			id?: string;
			metadata?: Record<string, unknown>;
		} = {
			type: type,
			date: data.date,
			amount: amountNum,
			description: data.description || "",
			memo: data.memo || "",
			categoryId: data.categoryId || "",
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
					const isAmountChanged =
						originalTransaction.amount !== amountNum;
					const isToAccountChanged =
						originalTransaction.toAccountId !== data.toAccountId;
					const originalDate = new Date(
						originalTransaction.date as string | number | Date,
					);
					const isDateChanged =
						utils.toYYYYMMDD(originalDate) !==
						(data.date as string);

					// 金額や日付が変わると、請求データの「支払い済み」状態と矛盾が生じる可能性があるため警告する。
					if (
						isAmountChanged ||
						isToAccountChanged ||
						isDateChanged
					) {
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
					paymentTargetCardId:
						pendingBillPayment.paymentTargetCardId,
					paymentTargetClosingDate:
						pendingBillPayment.paymentTargetClosingDate,
				};
			}

			// 楽観的更新: サーバーレスポンスを待たずにUIを更新する。
			const optimisticId = transactionId || `temp-${Date.now()}`;
			const optimisticTx: Transaction = {
				...(saveData as Transaction),
				id: optimisticId,
				date: new Date(saveData.date as string | number | Date),
			};

			setTransactions((prev) => {
				const next = transactionId
					? prev.map((t) =>
							t.id === transactionId
								? { ...t, ...optimisticTx }
								: t,
						)
					: [optimisticTx, ...prev];
				return next.sort((a, b) => {
					const da = new Date(a.date as string | number | Date).getTime();
					const db = new Date(b.date as string | number | Date).getTime();
					return db - da;
				});
			});
			closeTransactionModal();

			// Firestoreへ保存。
			const savedId = (await store.saveTransaction(saveData)) as unknown as string;

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
			const message = err instanceof Error ? err.message : String(err);
			notification.error(`保存に失敗しました: ${message}`);
			// エラー時は状態をロールバックし、最新データを再取得する。
			setTransactions(previousTransactions);
			await loadData();
		}
	};

	/**
	 * 指定された取引を削除する。
	 * 削除確認を行い、楽観的更新でリストから即座に除外した後、Firestoreから削除する。
	 * @async
	 * @param {string} transactionId - 削除対象の取引ID。
	 */
	const deleteTransaction = async (
		transactionId: string,
	): Promise<void> => {
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
			setTransactions((prev) =>
				prev.filter((t) => t.id !== transactionId),
			);
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
	};

	/**
	 * UI コンポーネントが期待する形（`date` が `string`）に正規化する。
	 * 内部 state の `Date` 等は実装側で扱い、戻り値では呼び出し側の都合に合わせる。
	 */
	const toOutput = (t: Transaction): TransactionOutput => ({
		id: t.id ?? "",
		type: t.type,
		date: (() => {
				if (typeof t.date === "string") return t.date;
				if (t.date instanceof Date) return utils.toYYYYMMDD(t.date);
				if (
					t.date &&
					typeof (t.date as { toDate?: unknown }).toDate === "function"
				) {
					return utils.toYYYYMMDD(
						(t.date as { toDate: () => Date }).toDate(),
					);
				}
				return utils.toYYYYMMDD(new Date());
			})(),
		amount: typeof t.amount === "string" ? Number(t.amount) : t.amount,
		description: t.description ?? "",
		memo: t.memo,
		categoryId: t.categoryId ?? "",
		fromAccountId: t.fromAccountId ?? "",
		toAccountId: t.toAccountId,
		metadata: t.metadata,
	});

	return {
		transactions: transactions.map(toOutput),
		lastUpdated,
		loading,
		refreshData: loadData as unknown as LooseFn,
		saveTransaction: saveTransaction as unknown as LooseFn,
		deleteTransaction: deleteTransaction as unknown as LooseFn,
	};
}
