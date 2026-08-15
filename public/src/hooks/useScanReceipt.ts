import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Account, CategoryInfo } from "../components/index.js";
import * as notification from "../services/notification.js";
import { scanReceipt } from "../services/scanService.js";
import type { Luts, ScanTransactionRow } from "../types/hooks.js";
import type { ScanSettingsConfig } from "../types/settings.js";
import * as utils from "../utils.js";

/**
 * スキャン結果の取引データ型（呼び出し側 `ScanModal.tsx` の
 * `ScannedTransaction` 互換）。
 */
export interface ScannedTransaction {
	id: string;
	date: string;
	amount: number;
	description: string;
	categoryId: string;
	type: "income" | "expense";
}

/**
 * `useScanReceipt` の引数オブジェクト。
 * 旧コンポーネントが緩い形の `luts` / `scanSettings` を渡してくるため、
 * 受け取る側を緩めにしておく。
 */
export interface UseScanReceiptParams {
	/** モーダルが開いているかどうか。 */
	isOpen: boolean;
	/** ルックアップテーブル。 */
	luts:
		| Luts
		| {
				categories?: Map<string, CategoryInfo>;
				accounts?: Map<
					string,
					{ id: string; name: string; type: string; isDeleted?: boolean }
				>;
		  };
	/** スキャン設定。 */
	scanSettings?: ScanSettingsConfig | Record<string, unknown>;
	/** 保存時のコールバック。 */
	onSave: (data: ScannedTransaction[]) => Promise<void> | void;
	/** 閉じる時のコールバック。 */
	onClose: () => void;
}

/**
 * レシートスキャンと取引データ管理のロジックを提供するカスタムフック。
 * 画像解析、取引データの編集・削除、保存処理を担う。
 * @param {UseScanReceiptParams} params - フックの初期設定。
 * @returns {object} スキャン状態と操作関数。
 */
export function useScanReceipt({
	isOpen,
	luts,
	scanSettings,
	onSave,
	onClose,
}: UseScanReceiptParams) {
	const [step, setStep] = useState<string>("analyzing");
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [transactions, setTransactions] = useState<ScanTransactionRow[]>([]);
	const [globalAccountId, setGlobalAccountId] = useState<string>("");
	const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

	const isAnalyzingRef = useRef<boolean>(false);
	const onCloseRef = useRef<(() => void) | null>(onClose);

	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	// --- ヘルパー関数 ---

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
			setIsSaving(false);
			isAnalyzingRef.current = false;
			setGlobalAccountId("");
			setExpandedRowId(null);
		}
	}, [isOpen]);

	// --- アクション ---

	const handleAnalysisStart = useCallback(
		async (file: File): Promise<void> => {
			if (!file) return;
			setStep("analyzing");
			setIsAnalyzing(true);
			isAnalyzingRef.current = true;

			try {
				const newTransactions = (await scanReceipt(
					file,
					scanSettings || {},
					luts || {},
				)) as ScanTransactionRow[];

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
					const message =
						err instanceof Error
							? err.message
							: "スキャンに失敗しました。もう一度お試しください。";
					notification.error(message);
					onCloseRef.current?.();
				}
			} finally {
				setIsAnalyzing(false);
				isAnalyzingRef.current = false;
			}
		},
		[scanSettings, luts],
	);

	const handleAddRow = (): void => {
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

	const handleTransactionChange = (
		id: string,
		field: keyof ScanTransactionRow,
		value: string,
	): void => {
		setTransactions((prev) =>
			prev.map((t) => {
				if (t.id !== id) return t;
				const updates: Partial<ScanTransactionRow> = { [field]: value };
				if (field === "type") {
					const cats = getSortedCategories(
						value as "income" | "expense" | "transfer",
					);
					updates.categoryId = cats.length > 0 ? cats[0].id : "";
				}
				return { ...t, ...updates };
			}),
		);
	};

	const handleDeleteRow = (id: string): void => {
		setTransactions((prev) => prev.filter((t) => t.id !== id));
	};

	const handleSaveTransactions = async (): Promise<void> => {
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

		if (isSaving) return;

		const dataToSave: ScanTransactionRow[] = transactions.map((t) => {
			const accounts = getSortedAccounts();
			const toAccountId =
				t.type === "transfer"
					? accounts.length > 1
						? accounts[1].id
						: accounts.length > 0
							? accounts[0].id
							: ""
					: "";
			return {
				date: t.date,
				type: t.type,
				amount: t.amount,
				categoryId: t.categoryId,
				description: t.description,
				memo: t.memo,
				fromAccountId: globalAccountId,
				toAccountId,
				id: t.id,
			};
		});

		// 呼び出し側（ScanModal）は amount: number, type: "income"|"expense" の
		// ScannedTransaction を受け取る前提のため、ここで正規化して渡す。
		const savePayload: ScannedTransaction[] = dataToSave
			.filter((t) => t.type === "income" || t.type === "expense")
			.map((t) => ({
				id: t.id,
				date: t.date,
				amount: Number(t.amount),
				description: t.description,
				categoryId: t.categoryId,
				type: t.type as "income" | "expense",
			}));

		setIsSaving(true);
		try {
			await onSave(savePayload);
			onClose();
		} catch (err) {
			console.error("[useScanReceipt] Save failed:", err);
			notification.error("保存中にエラーが発生しました");
		} finally {
			setIsSaving(false);
		}
	};

	return {
		step,
		setStep,
		isAnalyzing,
		setIsAnalyzing,
		isSaving,
		isAnalyzingRef: isAnalyzingRef as MutableRefObject<boolean>,
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
