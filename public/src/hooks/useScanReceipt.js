import { useEffect, useRef, useState } from "react";
import { scanReceipt } from "../services/geminiScanner.js";
import * as notification from "../services/notification.js";
import * as utils from "../utils.js";

/**
 * レシートスキャンと取引データ管理のロジックを提供するカスタムフック。
 * 画像解析、取引データの編集・削除、保存処理を担う。
 * @param {object} props - フックの初期設定。
 * @param {boolean} props.isOpen - モーダルが開いているかどうか。
 * @param {object} props.luts - ルックアップテーブル。
 * @param {object} props.scanSettings - スキャン設定。
 * @param {Function} props.onSave - 保存時のコールバック。
 * @param {Function} props.onClose - 閉じる時のコールバック。
 * @returns {object} スキャン状態と操作関数。
 */
export function useScanReceipt({
	isOpen,
	luts,
	scanSettings,
	onSave,
	onClose,
}) {
	const [step, setStep] = useState("analyzing");
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [transactions, setTransactions] = useState([]);
	const [globalAccountId, setGlobalAccountId] = useState("");
	const [expandedRowId, setExpandedRowId] = useState(null);

	const isAnalyzingRef = useRef(false);

	// --- ヘルパー関数 ---

	const getSortedAccounts = () => {
		if (!luts || !luts.accounts) return [];
		return utils.sortItems(
			[...luts.accounts.values()].filter((a) => !a.isDeleted),
		);
	};

	const getSortedCategories = (type) => {
		if (!luts || !luts.categories) return [];
		return utils.sortItems(
			[...luts.categories.values()].filter(
				(c) => !c.isDeleted && c.type === type,
			),
		);
	};

	const findBestCategoryMatch = (aiCategoryText, type) => {
		if (!aiCategoryText) return "";
		const categories = getSortedCategories(type);
		const text = aiCategoryText.toLowerCase().trim();
		let match = categories.find((c) => c.name.toLowerCase() === text);
		if (match) return match.id;
		match = categories.find(
			(c) =>
				c.name.toLowerCase().includes(text) ||
				text.includes(c.name.toLowerCase()),
		);
		if (match) return match.id;
		return categories.length > 0 ? categories[0].id : "";
	};

	// --- Effects ---

	// モーダルが開いたときにデフォルト口座を設定
	useEffect(() => {
		if (isOpen && !globalAccountId) {
			const accounts = getSortedAccounts();
			if (accounts.length > 0) setGlobalAccountId(accounts[0].id);
		}
	}, [isOpen, luts, globalAccountId, getSortedAccounts]);

	// モーダルが閉じたときに状態をリセット
	useEffect(() => {
		if (!isOpen) {
			setIsAnalyzing(false);
			isAnalyzingRef.current = false;
			setGlobalAccountId("");
			setExpandedRowId(null);
		}
	}, [isOpen]);

	// --- アクション ---

	const handleAnalysisStart = async (file) => {
		if (!file) return;
		setStep("analyzing");
		setIsAnalyzing(true);
		isAnalyzingRef.current = true;

		try {
			const result = await scanReceipt(file, scanSettings || {}, luts || {});
			const rawItems = !result ? [] : Array.isArray(result) ? result : [result];
			const today = utils.toYYYYMMDD(new Date());

			const newTransactions = rawItems.map((item, index) => {
				const type = item.type || "expense";
				let catId = "";
				if (item.category) {
					catId = findBestCategoryMatch(item.category, type);
				} else {
					const cats = getSortedCategories(type);
					if (cats.length > 0) catId = cats[0].id;
				}
				return {
					id: `temp-${Date.now()}-${index}`,
					date: item.date || today,
					amount: item.amount ? String(item.amount) : "",
					type: type,
					categoryId: catId,
					description: item.description || "",
					memo: "",
				};
			});

			if (newTransactions.length === 0) {
				notification.info(
					"明細が見つかりませんでした。手動で入力してください。",
				);
			}
			setTransactions(newTransactions);

			if (newTransactions.length > 0) {
				setExpandedRowId(newTransactions[0].id);
			}

			if (isAnalyzingRef.current) setStep("confirm");
		} catch (err) {
			console.error("[useScanReceipt] Scan error", err);
			if (isAnalyzingRef.current) {
				notification.error("スキャンに失敗しました。もう一度お試しください。");
				onClose();
			}
		} finally {
			setIsAnalyzing(false);
			isAnalyzingRef.current = false;
		}
	};

	const handleAddRow = () => {
		const newId = `manual-${Date.now()}`;
		setTransactions((prev) => [
			...prev,
			{
				id: newId,
				date: utils.toYYYYMMDD(new Date()),
				amount: "",
				type: "expense",
				categoryId: getSortedCategories("expense")?.[0]?.id || "",
				description: "",
				memo: "",
			},
		]);
		setExpandedRowId(newId);
	};

	const handleTransactionChange = (id, field, value) => {
		setTransactions((prev) =>
			prev.map((t) => {
				if (t.id !== id) return t;
				const updates = { [field]: value };
				if (field === "type") {
					const cats = getSortedCategories(value);
					updates.categoryId = cats.length > 0 ? cats[0].id : "";
				}
				return { ...t, ...updates };
			}),
		);
	};

	const handleDeleteRow = (id) => {
		setTransactions((prev) => prev.filter((t) => t.id !== id));
	};

	const handleSaveTransactions = async () => {
		if (transactions.length === 0) {
			notification.error("保存する取引がありません。行を追加してください。");
			return;
		}
		for (let i = 0; i < transactions.length; i++) {
			const t = transactions[i];
			if (!t.date) {
				notification.error(`${i + 1}行目: 日付は必須です`);
				return;
			}
			if (!t.amount || Number(t.amount) === 0) {
				notification.error(`${i + 1}行目: 金額を入力してください`);
				return;
			}
		}
		if (!globalAccountId) {
			notification.error("支払元口座を選択してください");
			return;
		}

		const dataToSave = transactions.map((t) => ({
			date: new Date(t.date),
			type: t.type,
			amount: Number(t.amount),
			accountId: globalAccountId,
			categoryId: t.categoryId,
			description: t.description,
			memo: t.memo,
			fromAccountId:
				t.type === "transfer" || t.type === "expense" ? globalAccountId : "",
			toAccountId:
				t.type === "transfer" ? "" : t.type === "income" ? globalAccountId : "",
		}));

		try {
			await onSave(dataToSave);
			onClose();
		} catch (err) {
			console.error("[useScanReceipt] Save failed:", err);
			notification.error("保存中にエラーが発生しました");
		}
	};

	return {
		step,
		setStep,
		isAnalyzing,
		setIsAnalyzing,
		isAnalyzingRef,
		transactions,
		setTransactions,
		globalAccountId,
		setGlobalAccountId,
		expandedRowId,
		setExpandedRowId,
		getSortedAccounts,
		getSortedCategories,
		handleAnalysisStart,
		handleAddRow,
		handleTransactionChange,
		handleDeleteRow,
		handleSaveTransactions,
	};
}
