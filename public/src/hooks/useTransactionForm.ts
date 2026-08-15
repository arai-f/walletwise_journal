import { useCallback, useEffect, useState } from "react";
import type { Account, CategoryInfo } from "../components/index.js";
import * as notification from "../services/notification.js";
import type {
	LastCategories,
	Luts,
	Transaction,
	TransactionFormData,
	TransactionFormMode,
	TransactionType
} from "../types/hooks.js";
import * as utils from "../utils.js";

/**
 * `useTransactionForm` の引数オブジェクト。
 * 旧コンポーネントの `TransactionData`（`id?: string` など）と互換のため、
 * 緩めに受け取る。
 */
export interface UseTransactionFormParams {
	/** モーダルが開いているか。 */
	isOpen: boolean;
	/** 編集対象の取引データ。呼び出し側 `TransactionData` 互換のため `unknown` で受ける。 */
	transaction?: unknown;
	/** 新規作成時の初期値。 */
	prefillData?: Record<string, unknown> | null;
	/** 保存時のコールバック。引数は呼び出し側の `TransactionData` 互換に変換して渡す。 */
	onSave: (data: {
		id?: string;
		date: string;
		amount: number;
		description: string;
		categoryId: string;
		fromAccountId: string;
		toAccountId?: string;
		type: TransactionType;
		memo?: string;
	}) => Promise<void> | void;
	/** 削除時のコールバック。 */
	onDelete: (id: string) => Promise<void> | void;
	/** ルックアップテーブル（カテゴリ、アカウント）。 */
	luts:
		| Luts
		| {
				categories?: Map<string, CategoryInfo>;
				accounts?: Map<
					string,
					{ id: string; name: string; type: string; isDeleted?: boolean }
				>;
		  };
}

/**
 * `useTransactionForm` の戻り値。
 */
export interface UseTransactionFormReturn {
	formData: TransactionFormData;
	setFormData: (
		v:
			| TransactionFormData
			| ((prev: TransactionFormData) => TransactionFormData),
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
	getSortedCategories: (
		type: "income" | "expense" | "transfer",
	) => CategoryInfo[];
}

/**
 * トランザクションフォームのロジックを管理するカスタムフック。
 * 状態管理、バリデーション、送信処理、種別切り替え時のカテゴリ記憶などを担当する。
 * @param {UseTransactionFormParams} params - コンポーネントに渡すプロパティ。
 * @returns {UseTransactionFormReturn} フォーム状態とハンドラ。
 */
export function useTransactionForm({
	isOpen,
	transaction,
	prefillData,
	onSave,
	onDelete,
	luts,
}: UseTransactionFormParams): UseTransactionFormReturn {
	const [formData, setFormData] = useState<TransactionFormData>({
		type: "expense",
		date: utils.getLocalToday(),
		amount: "",
		categoryId: "",
		fromAccountId: "",
		toAccountId: "",
		description: "",
		memo: "",
	});
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [mode, setMode] = useState<TransactionFormMode>("create");
	const [lastCategories, setLastCategories] = useState<LastCategories>({
		expense: "",
		income: "",
	});

	// ヘルパー関数
	const getSortedAccounts = useCallback((): Account[] => {
		if (!luts || !luts.accounts) return [];
		return utils.sortItems(
			[...luts.accounts.values()].filter((a) => !a.isDeleted),
		) as Account[];
	}, [luts]);

	const getSortedCategories = useCallback(
		(type: "income" | "expense" | "transfer"): CategoryInfo[] => {
			if (!luts || !luts.categories) return [];
			return utils.sortItems(
				[...luts.categories.values()].filter(
					(c) => !c.isDeleted && c.type === type,
				),
			) as CategoryInfo[];
		},
		[luts],
	);

	const getDefaultCategory = useCallback(
		(type: "income" | "expense" | "transfer"): string => {
			const cats = getSortedCategories(type);
			return cats.length > 0 ? cats[0].id : "";
		},
		[getSortedCategories],
	);

	// 初期化ロジック
	useEffect(() => {
		if (isOpen) {
			const accounts = getSortedAccounts();
			const defaultAccount = accounts.length > 0 ? accounts[0].id : "";

			// カテゴリ初期値の準備（lastCategoriesの初期化用）
			if (!lastCategories.expense) {
				setLastCategories({
					expense: getDefaultCategory("expense"),
					income: getDefaultCategory("income"),
				});
			}

			if (transaction) {
				setMode("edit");
				const tx = transaction as Partial<Transaction>;
				setFormData({
					type: ((tx.type as TransactionType) || "expense") as TransactionType,
					date: tx.date
						? utils.toYYYYMMDD(
								new Date(tx.date as string | number | Date),
							)
						: utils.getLocalToday(),
					amount: tx.amount ?? "",
					categoryId: tx.categoryId ?? "",
					fromAccountId: tx.fromAccountId ?? "",
					toAccountId: tx.toAccountId ?? "",
					description: tx.description ?? "",
					memo: tx.memo ?? "",
					id: tx.id,
				});
			} else if (prefillData) {
				setMode("prefill");
				const prefillType =
					((prefillData.type as TransactionType) || "expense");
				setFormData({
					type: prefillType,
					date: prefillData.date
						? utils.toYYYYMMDD(
								new Date(prefillData.date as string | number | Date),
							)
						: utils.getLocalToday(),
					amount: (prefillData.amount as string) || "",
					categoryId:
						(prefillData.categoryId as string) ||
						(prefillType === "transfer"
							? ""
							: getDefaultCategory(prefillType)),
					fromAccountId:
						(prefillData.fromAccountId as string) ||
						(prefillData.accountId as string) ||
						(accounts.length > 0 ? accounts[0].id : ""),
					toAccountId:
						(prefillData.toAccountId as string) ||
						(accounts.length > 1
							? accounts[1].id
							: accounts.length > 0
								? accounts[0].id
								: ""),
					description: (prefillData.description as string) || "",
					memo: (prefillData.memo as string) || "",
					id: "",
				});
			} else {
				setMode("create");
				setFormData({
					type: "expense",
					date: utils.getLocalToday(),
					amount: "",
					categoryId: getDefaultCategory("expense"),
					fromAccountId: defaultAccount,
					toAccountId: accounts.length > 1 ? accounts[1].id : defaultAccount,
					description: "",
					memo: "",
				});
			}
		}
	}, [
		isOpen,
		transaction,
		prefillData,
		getSortedAccounts,
		getDefaultCategory,
		lastCategories.expense,
	]);

	const handleChange = (e: { target: { name: string; value: string } }): void => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleAmountChange = (e: { target: { value: string } }): void => {
		const val = e.target.value;
		const sanitized = utils.sanitizeNumberInput(val);
		setFormData((prev) => ({ ...prev, amount: sanitized }));
	};

	const handleTypeChange = (newType: TransactionType): void => {
		setFormData((prev) => {
			if (prev.type === "expense" || prev.type === "income") {
				setLastCategories((lasts) => ({
					...lasts,
					[prev.type]: prev.categoryId,
				}));
			}

			let nextCategoryId = "";
			if (newType === "expense" || newType === "income") {
				nextCategoryId =
					lastCategories[newType] || getDefaultCategory(newType);
			}

			return {
				...prev,
				type: newType,
				categoryId: nextCategoryId,
			};
		});
	};

	const handleSubmit = async (e: {
		preventDefault: () => void;
	}): Promise<void> => {
		e.preventDefault();
		if (isSaving) return;

		if (!formData.date || !formData.amount) {
			notification.warn("日付と金額は必須です");
			return;
		}

		const amountNum = Number(formData.amount);
		if (isNaN(amountNum) || amountNum <= 0) {
			notification.warn("金額は0より大きい数値を入力してください");
			return;
		}

		setIsSaving(true);
		try {
			const saveData = {
				...formData,
				id: formData.id ?? undefined,
				amount:
					typeof formData.amount === "string"
						? Number(formData.amount)
						: formData.amount,
			};
			await onSave(saveData);
		} catch (err) {
			console.error("[useTransactionForm] Save failed:", err);
			notification.error("保存に失敗しました");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = (): void => {
		if (formData.id && onDelete) {
			onDelete(formData.id);
		}
	};

	const handleCopy = (): void => {
		setMode("copy");
		setFormData((prev) => ({
			...prev,
			id: null,
			date: utils.toYYYYMMDD(new Date()),
		}));
		notification.info("元の取引をコピーしました");
	};

	return {
		formData,
		setFormData,
		mode,
		isSaving,
		handleChange,
		handleAmountChange,
		handleTypeChange,
		handleSubmit,
		handleDelete,
		handleCopy,
		getSortedAccounts,
		getSortedCategories,
	};
}
