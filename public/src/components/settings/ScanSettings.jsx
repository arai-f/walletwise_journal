import { useEffect, useRef, useState } from "react";
import * as notification from "../../services/notification.js";
import * as store from "../../services/store.js";
import * as utils from "../../utils";
import Input from "../ui/Input";
import Select from "../ui/Select";

/**
 * レシートスキャン設定（除外キーワード、自動分類ルール）を行うコンポーネント。
 * OCR読み取り結果に対するフィルタリングや、キーワードに基づくカテゴリ自動割り当てのルールを管理する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Function} props.getState - ステート取得関数。
 * @param {Function} props.refreshApp - アプリ再ロード関数。
 * @return {JSX.Element} スキャン設定コンポーネント。
 */
export default function ScanSettings({ getState, refreshApp }) {
	const [scanSettings, setScanSettings] = useState(() => {
		const config = getState().config || {};
		return config.scanSettings || { excludeKeywords: [], categoryRules: [] };
	});
	const [categories, setCategories] = useState(() => {
		return [...getState().luts.categories.values()].filter((c) => !c.isDeleted);
	});

	// キーワード追加フォーム状態
	const [showAddKeyword, setShowAddKeyword] = useState(false);
	const [newKeyword, setNewKeyword] = useState("");
	const isComposing = useRef(false);

	// ルール追加/編集フォーム状態
	const [showAddRule, setShowAddRule] = useState(false);
	const [newRuleKeyword, setNewRuleKeyword] = useState("");
	const [newRuleCategory, setNewRuleCategory] = useState("");
	const [editingRuleKeyword, setEditingRuleKeyword] = useState(null); // 編集中のルールの元のキーワード

	useEffect(() => {
		loadData();
	}, [getState]);

	const loadData = () => {
		const state = getState();
		const config = state.config || {};
		setScanSettings(
			config.scanSettings || { excludeKeywords: [], categoryRules: [] },
		);
		setCategories(
			[...state.luts.categories.values()].filter((c) => !c.isDeleted),
		);
	};

	/**
	 * 設定を保存し、アプリ全体に反映させる共通処理。
	 */
	const saveSettings = async (newSettings) => {
		try {
			await store.updateConfig({ scanSettings: newSettings });
			await refreshApp();
			setScanSettings(newSettings);
		} catch (e) {
			console.error("[ScanSettings] Save failed:", e);
			notification.error("保存に失敗しました");
		}
	};

	/**
	 * 新しい除外キーワードを追加する。
	 */
	const handleAddKeyword = async () => {
		const word = newKeyword.trim();
		if (!word) {
			notification.warn("キーワードを入力してください");
			return;
		}
		if ((scanSettings.excludeKeywords || []).includes(word)) {
			notification.warn("既に登録されています");
			return;
		}

		const newKeywords = [...(scanSettings.excludeKeywords || []), word];
		await saveSettings({ ...scanSettings, excludeKeywords: newKeywords });
		setNewKeyword("");
		setShowAddKeyword(false);
	};

	/**
	 * 除外キーワードを削除する。
	 */
	const handleDeleteKeyword = async (word) => {
		if (!confirm(`「${word}」を削除しますか？`)) return;
		const newKeywords = (scanSettings.excludeKeywords || []).filter(
			(w) => w !== word,
		);
		await saveSettings({ ...scanSettings, excludeKeywords: newKeywords });
	};

	/**
	 * IME入力開始ハンドラ
	 */
	const handleCompositionStart = () => {
		isComposing.current = true;
	};

	/**
	 * IME入力終了ハンドラ
	 */
	const handleCompositionEnd = () => {
		// 直後のKeyDownイベントまでtrueを維持するため、イベントループを1つ遅らせる
		setTimeout(() => {
			isComposing.current = false;
		}, 0);
	};

	/**
	 * 安全なKeyDownハンドラ（IME確定エンターを無視）
	 */
	const handleKeyDownSafe = (e, callback) => {
		// 229 is the keycode for IME processing
		if (
			isComposing.current ||
			e.nativeEvent.isComposing ||
			e.key !== "Enter" ||
			e.keyCode === 229
		)
			return;
		e.preventDefault();
		callback();
	};

	/**
	 * 既存のルール編集を開始する。
	 */
	const handleEditRule = (rule) => {
		setNewRuleKeyword(rule.keyword);
		setNewRuleCategory(rule.categoryId);
		setEditingRuleKeyword(rule.keyword);
		setShowAddRule(true);
	};

	/**
	 * 新規ルール追加を開始する。
	 */
	const handleAddRuleStart = () => {
		setNewRuleKeyword("");
		setNewRuleCategory("");
		setEditingRuleKeyword(null);
		setShowAddRule(true);
	};

	/**
	 * ルール（新規または編集）を保存する。
	 */
	const handleSaveRule = async () => {
		const word = newRuleKeyword.trim();
		if (!word) {
			notification.warn("キーワードを入力してください");
			return;
		}
		if (!newRuleCategory) {
			notification.warn("カテゴリを選択してください");
			return;
		}

		const rules = scanSettings.categoryRules || [];
		// 重複チェック
		const existing = rules.find((r) => r.keyword === word);
		if (existing && (!editingRuleKeyword || editingRuleKeyword !== word)) {
			notification.warn("このキーワードのルールは既に存在します");
			return;
		}

		let newRules;
		if (editingRuleKeyword) {
			// 既存ルール更新
			newRules = rules.map((r) =>
				r.keyword === editingRuleKeyword
					? { keyword: word, categoryId: newRuleCategory }
					: r,
			);
		} else {
			// 新規追加
			newRules = [...rules, { keyword: word, categoryId: newRuleCategory }];
		}

		await saveSettings({ ...scanSettings, categoryRules: newRules });
		setShowAddRule(false);
	};

	/**
	 * ルールを削除する。
	 */
	const handleDeleteRule = async (word) => {
		if (!confirm(`キーワード「${word}」のルールを削除しますか？`)) return;
		const newRules = (scanSettings.categoryRules || []).filter(
			(r) => r.keyword !== word,
		);
		await saveSettings({ ...scanSettings, categoryRules: newRules });
	};

	const incomeCategories = utils.sortItems(
		categories.filter((c) => c.type === "income"),
	);
	const expenseCategories = utils.sortItems(
		categories.filter((c) => c.type === "expense"),
	);

	return (
		<div className="pb-8">
			{/* 除外キーワード設定セクション */}
			<div className="mb-10">
				<div className="flex justify-between items-center px-5 py-2">
					<h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
						除外キーワード
					</h3>
					<button
						onClick={() => setShowAddKeyword(true)}
						className="text-indigo-600 font-bold text-sm flex items-center gap-1 py-1 px-3 hover:bg-indigo-50 rounded transition"
					>
						<i className="fas fa-plus"></i> 追加
					</button>
				</div>

				{showAddKeyword && (
					<div className="flex items-center gap-2 px-5 py-3 border-y border-neutral-100 bg-neutral-50 animate-fade-in mb-0">
						<Input
							type="text"
							className="grow bg-white border-neutral-200"
							placeholder="除外するキーワード"
							value={newKeyword}
							onChange={(e) => setNewKeyword(e.target.value)}
							onCompositionStart={handleCompositionStart}
							onCompositionEnd={handleCompositionEnd}
							onKeyDown={(e) => handleKeyDownSafe(e, handleAddKeyword)}
							autoFocus
						/>
						<button
							onClick={handleAddKeyword}
							className="text-emerald-600 hover:text-emerald-700 p-1"
						>
							<i className="fas fa-check"></i>
						</button>
						<button
							onClick={() => setShowAddKeyword(false)}
							className="text-red-500 hover:text-red-600 p-1"
						>
							<i className="fas fa-times"></i>
						</button>
					</div>
				)}

				<div className="border-t border-b border-neutral-100 bg-white">
					{(scanSettings.excludeKeywords || []).map((word) => (
						<div
							key={word}
							className="flex items-center justify-between py-3 px-5 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition"
						>
							<span className="font-medium text-neutral-900">{word}</span>
							<button
								onClick={() => handleDeleteKeyword(word)}
								className="text-red-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition"
								title="削除"
							>
								<i className="fas fa-trash-alt text-sm"></i>
							</button>
						</div>
					))}
					{(scanSettings.excludeKeywords || []).length === 0 &&
						!showAddKeyword && (
							<p className="text-sm text-neutral-400 text-center py-6">
								設定なし
							</p>
						)}
				</div>
			</div>

			{/* 自動分類ルールセクション */}
			<div>
				<div className="flex justify-between items-center px-5 py-2">
					<h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
						自動分類ルール
					</h3>
					<button
						onClick={handleAddRuleStart}
						className="text-indigo-600 font-bold text-sm flex items-center gap-1 py-1 px-3 hover:bg-indigo-50 rounded transition"
					>
						<i className="fas fa-plus"></i> 追加
					</button>
				</div>

				{showAddRule && (
					<div className="bg-neutral-50 border-y border-neutral-200 py-4 px-5 animate-fade-in space-y-3">
						<h4 className="font-bold text-neutral-900 mb-2 text-sm">
							{editingRuleKeyword ? "ルールを編集" : "新しいルールを追加"}
						</h4>
						<div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
							<div className="flex flex-col sm:flex-row sm:items-center p-3 border-b border-neutral-100 gap-1 sm:gap-4">
								<label className="text-sm font-medium text-neutral-700 w-24 shrink-0">
									キーワード
								</label>
								<div className="grow w-full">
									<Input
										type="text"
										className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm"
										placeholder="例: スーパー, コンビニ"
										value={newRuleKeyword}
										onChange={(e) => setNewRuleKeyword(e.target.value)}
										onCompositionStart={handleCompositionStart}
										onCompositionEnd={handleCompositionEnd}
										onKeyDown={(e) => handleKeyDownSafe(e, handleSaveRule)}
									/>
								</div>
							</div>
							<div className="flex flex-col sm:flex-row sm:items-center p-3 gap-1 sm:gap-4">
								<label className="text-sm font-medium text-neutral-700 w-24 shrink-0">
									分類先
								</label>
								<div className="grow w-full">
									<Select
										className="w-full bg-transparent text-neutral-800 border-none p-0 focus:ring-0 text-sm h-auto"
										selectClassName="border-none w-full !py-1 !px-0 bg-transparent focus:ring-0"
										value={newRuleCategory}
										onChange={(e) => setNewRuleCategory(e.target.value)}
									>
										<option value="">カテゴリを選択</option>
										<optgroup label="支出">
											{expenseCategories.map((c) => (
												<option key={c.id} value={c.id}>
													{c.name}
												</option>
											))}
										</optgroup>
										<optgroup label="収入">
											{incomeCategories.map((c) => (
												<option key={c.id} value={c.id}>
													{c.name}
												</option>
											))}
										</optgroup>
									</Select>
								</div>
							</div>
						</div>
						<div className="flex justify-end gap-3 mt-2">
							<button
								onClick={() => setShowAddRule(false)}
								className="px-4 py-1.5 text-xs text-neutral-600 font-medium hover:text-neutral-800 transition"
							>
								キャンセル
							</button>
							<button
								onClick={handleSaveRule}
								className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition"
							>
								保存
							</button>
						</div>
					</div>
				)}

				<div className="border-t border-b border-neutral-100 bg-white">
					{(scanSettings.categoryRules || []).map((rule) => {
						const cat = categories.find((c) => c.id === rule.categoryId);
						return (
							<div
								key={rule.keyword}
								className="flex items-center justify-between py-3 px-5 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition"
							>
								<div className="flex items-center gap-3 overflow-hidden">
									<span className="font-medium text-neutral-900">
										"{rule.keyword}"
									</span>
									<i className="fas fa-arrow-right text-neutral-300 text-xs"></i>
									<span className="text-sm text-neutral-600 truncate">
										{cat ? cat.name : "不明なカテゴリ"}
									</span>
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<button
										onClick={() => handleEditRule(rule)}
										className="text-indigo-600 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 transition"
										title="編集"
									>
										<i className="fas fa-pen text-sm"></i>
									</button>
									<button
										onClick={() => handleDeleteRule(rule.keyword)}
										className="text-red-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition"
										title="削除"
									>
										<i className="fas fa-trash-alt text-sm"></i>
									</button>
								</div>
							</div>
						);
					})}
					{(scanSettings.categoryRules || []).length === 0 && !showAddRule && (
						<p className="text-sm text-neutral-400 text-center py-6">
							設定なし
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
