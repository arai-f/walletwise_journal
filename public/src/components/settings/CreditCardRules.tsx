import {
	faArrowRight,
	faCheck,
	faCreditCard,
	faPen,
	faPlus,
	faTimes,
	faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { deleteField } from "firebase/firestore";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useApp } from "../../contexts/AppContext";
import * as notification from "../../services/notification.js";
import * as store from "../../services/store.js";
import type { Account, CreditCardRule } from "../../types/settings";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { ICON_MAP } from "./IconPicker";

/**
 * クレジットカードルールのフォーム入力データ。
 * 一時的に `string` で保持するフィールド（HTMLの `value` 属性と合わせる）と、
 * 確定後の `number` を区別しやすいようにまとめている。
 */
interface RuleFormData {
	/** 対象カードのID。 */
	cardId: string;
	/** 締め日（文字列。`parseInt` で数値化される）。 */
	closingDay: number | string;
	/** 支払月のオフセット（文字列。`parseInt` で数値化される）。 */
	paymentMonthOffset: number | string;
	/** 支払日（文字列。`parseInt` で数値化される）。 */
	paymentDay: number | string;
	/** 支払元口座のID。 */
	paymentAccountId: string;
}

/**
 * `RuleForm` のコンポーネントプロパティ。
 * `mode === "add"` のときは `availableCards` を、`mode === "edit"` のときは
 * `editingCardName` を必須とする。
 */
interface RuleFormProps {
	/** 'add' = 新規追加、'edit' = 既存編集。 */
	mode: "add" | "edit";
	/** 入力中のフォームデータ。 */
	formData: RuleFormData;
	/** フォームデータ更新のセッター。 */
	onFormChange: Dispatch<SetStateAction<RuleFormData>>;
	/** 保存ボタン押下時に呼ばれる非同期ハンドラ。 */
	onSave: () => Promise<void> | void;
	/** キャンセル時に呼ばれるハンドラ。 */
	onCancel: () => void;
	/** 追加対象として選択可能なカード一覧（負債口座）。追加モードでのみ必須。 */
	availableCards?: Account[];
	/** 編集中のカード名。編集モードでのみ必須。 */
	editingCardName?: string;
	/** 支払元口座として選択可能な資産口座一覧。 */
	assetAccounts: Account[];
}

/**
 * ルール追加・編集フォームの共通コンポーネント。
 * @param props - コンポーネントプロパティ。
 * @returns ルールフォーム。
 */
function RuleForm({
	mode,
	formData,
	onFormChange,
	onSave,
	onCancel,
	availableCards,
	editingCardName,
	assetAccounts,
}: RuleFormProps) {
	const isAdding = mode === "add";

	return (
		<div className="border-y border-neutral-100 bg-neutral-50 animate-fade-in">
			<div className="p-5">
				<div className="flex justify-between items-center mb-3">
					<h4 className="font-bold text-neutral-900 text-sm">
						{isAdding ? "新しいルールを追加" : "ルールを編集"}
					</h4>
					<div className="flex items-center gap-2">
						<button
							onClick={onSave}
							className="text-emerald-600 hover:text-emerald-700 p-1"
							title="保存"
						>
							<FontAwesomeIcon icon={faCheck} />
						</button>
						<button
							onClick={onCancel}
							className="text-red-500 hover:text-red-600 p-1"
							title="キャンセル"
						>
							<FontAwesomeIcon icon={faTimes} />
						</button>
					</div>
				</div>

				<div className="space-y-4">
					<div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
						<div className="flex items-center justify-between p-3 border-b border-neutral-100">
							<label className="text-sm font-medium text-neutral-700 w-20 shrink-0">
								対象カード
							</label>
							<div className="grow pl-4">
								{isAdding ? (
									<Select
										value={formData.cardId}
										onChange={(e) =>
											onFormChange({ ...formData, cardId: e.target.value })
										}
									>
										<option value="">選択してください</option>
										{(availableCards || []).filter(Boolean).map((a) => (
											<option key={a.id} value={a.id}>
												{a.name}
											</option>
										))}
									</Select>
								) : (
									<span className="font-medium text-neutral-800">
										{editingCardName}
									</span>
								)}
							</div>
						</div>

						<div className="flex items-center justify-between p-3 border-b border-neutral-100">
							<label className="text-sm font-medium text-neutral-700 w-20 shrink-0">
								締め日
							</label>
							<div className="flex items-center justify-end gap-2 grow pl-4">
								<span className="text-sm text-neutral-500 whitespace-nowrap">
									毎月
								</span>
								<Input
									type="number"
									className="w-16"
									inputClassName="text-right"
									value={formData.closingDay}
									onChange={(e) =>
										onFormChange({
											...formData,
											closingDay: e.target.value,
										})
									}
									min="1"
									max="31"
								/>
								<span className="text-sm text-neutral-500 whitespace-nowrap">
									日
								</span>
							</div>
						</div>

						<div className="flex items-center justify-between p-3 border-b border-neutral-100">
							<label className="text-sm font-medium text-neutral-700 w-20 shrink-0">
								支払日
							</label>
							<div className="flex items-center justify-end gap-2 grow pl-4 flex-wrap">
								<Select
									className="w-26"
									value={formData.paymentMonthOffset}
									onChange={(e) =>
										onFormChange({
											...formData,
											paymentMonthOffset: e.target.value,
										})
									}
								>
									<option value="1">翌月</option>
									<option value="2">翌々月</option>
									<option value="3">3ヶ月後</option>
								</Select>
								<Input
									type="number"
									className="w-16"
									inputClassName="text-right"
									value={formData.paymentDay}
									onChange={(e) =>
										onFormChange({
											...formData,
											paymentDay: e.target.value,
										})
									}
									min="1"
									max="31"
								/>
								<span className="text-sm text-neutral-500 whitespace-nowrap">
									日
								</span>
							</div>
						</div>

						<div className="flex items-center justify-between p-3">
							<label className="text-sm font-medium text-neutral-700 w-20 shrink-0">
								支払元口座
							</label>
							<div className="grow pl-4">
								<Select
									value={formData.paymentAccountId}
									onChange={(e) =>
										onFormChange({
											...formData,
											paymentAccountId: e.target.value,
										})
									}
								>
									<option value="">選択してください</option>
									{assetAccounts.map((a) => (
										<option key={a.id} value={a.id}>
											{a.name}
										</option>
									))}
								</Select>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
interface CreditCardRulesProps {
	getState?: unknown;
	refreshApp?: unknown;
}

export default function CreditCardRules({}: CreditCardRulesProps) {
	const { config, luts, actions } = useApp();
	const [rules, setRules] = useState<Record<string, CreditCardRule>>(() => {
		return config?.creditCardRules || {};
	});
	const [accounts, setAccounts] = useState<Account[]>(() => {
		return [...luts.accounts.values()].filter(
			(a) => !a.isDeleted,
		) as unknown as Account[];
	});
	// 'new' = 新規追加モード、それ以外は編集中のカードID。
	const [editingCardId, setEditingCardId] = useState<string | null>(null);

	const [formData, setFormData] = useState<RuleFormData>({
		cardId: "",
		closingDay: 15,
		paymentMonthOffset: 1,
		paymentDay: 10,
		paymentAccountId: "",
	});

	useEffect(() => {
		setRules(config?.creditCardRules || {});
		setAccounts(
			[...luts.accounts.values()].filter(
				(a) => !a.isDeleted,
			) as unknown as Account[],
		);
	}, [config, luts]);

	const loadData = () => {
		setRules(config?.creditCardRules || {});
		setAccounts(
			[...luts.accounts.values()].filter(
				(a) => !a.isDeleted,
			) as unknown as Account[],
		);
	};

	/**
	 * 既存ルールの編集を開始する。
	 * @param cardId - 編集対象のカードID。
	 */
	const handleEdit = (cardId: string) => {
		const rule = rules[cardId];
		setFormData({
			cardId,
			closingDay: rule.closingDay,
			paymentMonthOffset: rule.paymentMonthOffset || 1,
			paymentDay: rule.paymentDay,
			paymentAccountId: rule.defaultPaymentAccountId,
		});
		setEditingCardId(cardId);
	};

	/**
	 * 新規ルール追加モードを開始する。
	 */
	const handleAddNew = () => {
		setFormData({
			cardId: "",
			closingDay: 15,
			paymentMonthOffset: 1,
			paymentDay: 10,
			paymentAccountId: "",
		});
		setEditingCardId("new");
	};

	/**
	 * フォームの内容を検証し、設定を保存する。
	 * @returns 保存処理の完了を示すPromise。
	 */
	const handleSave = async () => {
		const {
			cardId,
			closingDay,
			paymentDay,
			paymentMonthOffset,
			paymentAccountId,
		} = formData;

		if (!cardId) {
			notification.warn("カードを選択してください");
			return;
		}
		if (!paymentAccountId) {
			notification.warn("支払元口座を選択してください");
			return;
		}

		const cDay = parseInt(String(closingDay));
		const pDay = parseInt(String(paymentDay));

		if (isNaN(cDay) || cDay < 1 || cDay > 31) {
			notification.warn("締め日を正しく入力してください");
			return;
		}
		if (isNaN(pDay) || pDay < 1 || pDay > 31) {
			notification.warn("支払日を正しく入力してください");
			return;
		}

		const ruleData = {
			closingDay: cDay,
			paymentDay: pDay,
			paymentMonthOffset: parseInt(String(paymentMonthOffset)),
			defaultPaymentAccountId: paymentAccountId,
		};

		try {
			await store.updateConfig(
				{ creditCardRules: { [cardId]: ruleData } },
				true,
			);
			await actions.refreshSettings(true);
			loadData();
			setEditingCardId(null);
		} catch (e) {
			console.error("[CreditCardRules] Save failed:", e);
			notification.error("保存に失敗しました");
		}
	};

	/**
	 * ルールを削除する。
	 * @param cardId - 削除対象のカードID。
	 * @returns 削除処理の完了を示すPromise。
	 */
	const handleDelete = async (cardId: string) => {
		if (!confirm("このルールを削除しますか？")) return;
		try {
			const fieldPath = `creditCardRules.${cardId}`;
			await store.updateConfig({ [fieldPath]: deleteField() });
			await actions.refreshSettings(true);
			loadData();
		} catch (e) {
			console.error("[CreditCardRules] Delete failed:", e);
			notification.error("削除に失敗しました");
		}
	};

	const liabilityAccounts = accounts.filter((a) => a.type === "liability");
	const assetAccounts = accounts.filter((a) => a.type === "asset");

	// ルールを追加できるカード（まだ設定されていない負債口座）
	const availableCards = liabilityAccounts.filter((a) => !rules[a.id]);

	const configuredCards = liabilityAccounts.filter((a) => rules[a.id]);

	/**
	 * アイコン文字列から対応するアイコン定義を取得する。
	 * @param iconStr - アイコンクラス名。
	 * @returns 対応するアイコン定義。見つからない場合は `faCreditCard`。
	 */
	const getIcon = (iconStr?: string) => {
		if (!iconStr) return faCreditCard;
		const matchedIcon = ICON_MAP.find((item) => item.value === iconStr);
		return matchedIcon ? matchedIcon.icon : faCreditCard;
	};

	return (
		<div className="pb-8">
			<div className="flex justify-end items-end px-5 py-2">
				<button
					onClick={handleAddNew}
					disabled={editingCardId !== null || availableCards.length === 0}
					className={`text-indigo-600 font-bold text-sm flex items-center gap-1 py-1 px-3 hover:bg-indigo-50 rounded transition ${
						editingCardId !== null || availableCards.length === 0
							? "opacity-50 cursor-not-allowed" // 編集/追加中、または追加できるカードがない場合は無効
							: "hover:text-indigo-700"
					}`}
				>
					<FontAwesomeIcon icon={faPlus} /> 追加
				</button>
			</div>

			{editingCardId === "new" && (
				<RuleForm
					mode="add"
					formData={formData}
					onFormChange={setFormData}
					onSave={handleSave}
					onCancel={() => setEditingCardId(null)}
					availableCards={availableCards}
					assetAccounts={assetAccounts}
				/>
			)}

			{/* ルール一覧 */}
			<div className="bg-white border-t border-b border-neutral-100">
				{configuredCards.map((card) => {
					const rule = rules[card.id];
					const paymentAccount = accounts.find(
						(a) => a.id === rule.defaultPaymentAccountId,
					);
					const monthMap = { 1: "翌月", 2: "翌々月", 3: "3ヶ月後" };

					if (editingCardId === card.id) {
						// 編集中はフォームを表示
						return (
							<RuleForm
								key={card.id}
								mode="edit"
								formData={formData}
								onFormChange={setFormData}
								onSave={handleSave}
								onCancel={() => setEditingCardId(null)}
								editingCardName={card.name}
								assetAccounts={assetAccounts}
							/>
						);
					}

					return (
						<div
							key={card.id}
							className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-3 px-5 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition group"
						>
							<div className="w-full">
								<div className="flex items-center gap-3 mb-1 ">
									<div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-500">
										<FontAwesomeIcon icon={getIcon(card.icon)} />
									</div>
									<span className="font-bold text-neutral-900">
										{card.name}
									</span>
								</div>
								<div className="text-xs text-neutral-500 flex flex-wrap gap-2 items-center pl-11">
									<span>毎月{rule.closingDay}日締め</span>
									<FontAwesomeIcon
										icon={faArrowRight}
										className="text-neutral-300 text-[10px]"
									/>
									<span>
										{monthMap[rule.paymentMonthOffset] || "翌月"}{" "}
										{rule.paymentDay}日払い
									</span>
									<span className="text-neutral-400">
										(引落: {paymentAccount?.name || "???"})
									</span>
								</div>
							</div>
							<div className="flex items-center gap-1 self-end sm:self-center shrink-0">
								<button
									onClick={() => handleEdit(card.id)}
									className="text-indigo-600 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 transition"
									title="編集"
								>
									<FontAwesomeIcon icon={faPen} className="text-sm" />
								</button>
								<button
									onClick={() => handleDelete(card.id)}
									className="text-red-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition"
									title="削除"
								>
									<FontAwesomeIcon icon={faTrashAlt} className="text-sm" />
								</button>
							</div>
						</div>
					);
				})}
				{configuredCards.length === 0 && editingCardId !== "new" && (
					<p className="text-center text-neutral-400 text-sm py-8">
						設定済みのカードはありません
					</p>
				)}
			</div>
		</div>
	);
}
