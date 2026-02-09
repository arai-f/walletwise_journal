import { useCallback, useEffect, useState } from "react";
import * as notification from "../services/notification.js";
import * as utils from "../utils.js";

/**
 * トランザクションフォームのロジックを管理するカスタムフック。
 * 状態管理、バリデーション、送信処理、種別切り替え時のカテゴリ記憶などを担当する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているか。
 * @param {object} [props.transaction] - 編集対象の取引データ。
 * @param {object} [props.prefillData] - 新規作成時の初期値。
 * @param {Function} props.onSave - 保存時のコールバック。
 * @param {Function} props.onDelete - 削除時のコールバック。
 * @param {object} props.luts - ルックアップテーブル（カテゴリ、アカウント）。
 * @returns {object} フォーム状態とハンドラ。
 */
export function useTransactionForm({
	isOpen,
	transaction,
	prefillData,
	onSave,
	onDelete,
	luts,
}) {
	const [formData, setFormData] = useState({
		type: "expense",
		date: utils.getLocalToday(),
		amount: "",
		categoryId: "",
		accountId: "",
		fromAccountId: "",
		toAccountId: "",
		description: "",
		memo: "",
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [mode, setMode] = useState("create");
	const [lastCategories, setLastCategories] = useState({
		expense: "",
		income: "",
	});

	// ヘルパー関数
	const getSortedAccounts = useCallback(() => {
		if (!luts || !luts.accounts) return [];
		return utils.sortItems(
			[...luts.accounts.values()].filter((a) => !a.isDeleted),
		);
	}, [luts]);

	const getSortedCategories = useCallback(
		(type) => {
			if (!luts || !luts.categories) return [];
			return utils.sortItems(
				[...luts.categories.values()].filter(
					(c) => !c.isDeleted && c.type === type,
				),
			);
		},
		[luts],
	);

	const getDefaultCategory = useCallback(
		(type) => {
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
				setLastCategories((prev) => ({
					...prev,
					expense: getDefaultCategory("expense"),
					income: getDefaultCategory("income"),
				}));
			}

			if (transaction) {
				setMode("edit");
				setFormData({
					type: transaction.type,
					date: transaction.date
						? utils.toYYYYMMDD(new Date(transaction.date))
						: utils.getLocalToday(),
					amount: transaction.amount || "",
					categoryId: transaction.categoryId || "",
					accountId: transaction.accountId || "",
					fromAccountId: transaction.fromAccountId || "",
					toAccountId: transaction.toAccountId || "",
					description: transaction.description || "",
					memo: transaction.memo || "",
					id: transaction.id,
				});
			} else if (prefillData) {
				setMode("prefill");
				setFormData({
					type: prefillData.type || "expense",
					date: prefillData.date
						? utils.toYYYYMMDD(new Date(prefillData.date))
						: utils.getLocalToday(),
					amount: prefillData.amount || "",
					categoryId:
						prefillData.categoryId ||
						getDefaultCategory(prefillData.type || "expense"),
					accountId:
						prefillData.accountId ||
						(accounts.length > 0 ? accounts[0].id : ""),
					fromAccountId:
						prefillData.fromAccountId ||
						(accounts.length > 0 ? accounts[0].id : ""),
					toAccountId:
						prefillData.toAccountId ||
						(accounts.length > 1
							? accounts[1].id
							: accounts.length > 0
								? accounts[0].id
								: ""),
					description: prefillData.description || "",
					memo: prefillData.memo || "",
					id: "",
				});
			} else {
				setMode("create");
				setFormData({
					type: "expense",
					date: utils.getLocalToday(),
					amount: "",
					categoryId: getDefaultCategory("expense"),
					accountId: defaultAccount,
					fromAccountId: defaultAccount,
					toAccountId: accounts.length > 1 ? accounts[1].id : defaultAccount,
					description: "",
					memo: "",
				});
			}
		}
	}, [isOpen, transaction, prefillData, getSortedAccounts, getDefaultCategory]);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleAmountChange = (e) => {
		const val = e.target.value;
		const sanitized = utils.sanitizeNumberInput(val);
		setFormData((prev) => ({ ...prev, amount: sanitized }));
	};

	const handleTypeChange = (newType) => {
		setFormData((prev) => {
			if (prev.type === "expense" || prev.type === "income") {
				setLastCategories((lasts) => ({
					...lasts,
					[prev.type]: prev.categoryId,
				}));
			}

			let nextCategoryId = "";
			if (newType === "expense" || newType === "income") {
				nextCategoryId = lastCategories[newType] || getDefaultCategory(newType);
			}

			return {
				...prev,
				type: newType,
				categoryId: nextCategoryId,
			};
		});
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (isSubmitting) return;

		if (!formData.date || !formData.amount) {
			notification.warn("日付と金額は必須です");
			return;
		}

		const amountNum = Number(formData.amount);
		if (isNaN(amountNum) || amountNum <= 0) {
			notification.warn("金額は0より大きい数値を入力してください");
			return;
		}

		setIsSubmitting(true);
		try {
			await onSave({ ...formData });
		} catch (err) {
			console.error("[useTransactionForm] Save failed:", err);
			notification.error("保存に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = () => {
		if (formData.id && onDelete) {
			onDelete(formData.id);
		}
	};

	const handleCopy = () => {
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
		isSubmitting,
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
