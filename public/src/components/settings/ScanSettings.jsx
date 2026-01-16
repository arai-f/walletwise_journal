import { useEffect, useRef, useState } from "react";
import * as notification from "../../services/notification.js";
import * as utils from "../../utils";
import Input from "../ui/Input";
import Select from "../ui/Select";

/**
 * レシートスキャン設定（除外キーワード、自動分類ルール）を行うコンポーネント。
 * OCR読み取り結果に対するフィルタリングや、キーワードに基づくカテゴリ自動割り当てのルールを管理する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.store - ストア操作オブジェクト。
 * @param {Function} props.getState - ステート取得関数。
 * @param {Function} props.refreshApp - アプリ再ロード関数。
 * @return {JSX.Element} スキャン設定コンポーネント。
 */
export default function ScanSettings({ store, getState, refreshApp }) {
	const [scanSettings, setScanSettings] = useState({
		excludeKeywords: [],
		categoryRules: [],
	});
	const [categories, setCategories] = useState([]);

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
			config.scanSettings || { excludeKeywords: [], categoryRules: [] }
		);
		setCategories(
			[...state.luts.categories.values()].filter((c) => !c.isDeleted)
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
			(w) => w !== word
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
					: r
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
			(r) => r.keyword !== word
		);
		await saveSettings({ ...scanSettings, categoryRules: newRules });
	};

	const incomeCategories = utils.sortItems(
		categories.filter((c) => c.type === "income")
	);
	const expenseCategories = utils.sortItems(
		categories.filter((c) => c.type === "expense")
	);

	return (
		<div className="p-4 space-y-6">
			{/* 除外キーワード設定セクション */}
			<section className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
				<div className="flex justify-between items-center mb-4">
					<h3 className="font-bold text-neutral-800 border-l-4 border-primary pl-3">
						スキャン除外キーワード
					</h3>
					<button
						onClick={() => setShowAddKeyword(true)}
						className="text-primary hover:text-primary-dark font-medium text-sm flex items-center gap-1"
					>
						<i className="fas fa-plus"></i> 追加
					</button>
				</div>

				{showAddKeyword && (
					<div className="flex items-center gap-2 p-2 rounded-md bg-neutral-100 mb-4 animate-fade-in border border-neutral-200">
						<Input
							type="text"
							className="grow bg-white"
							placeholder="除外するキーワード"
							value={newKeyword}
							onChange={(e) => setNewKeyword(e.target.value)}
							onCompositionStart={handleCompositionStart}
							onCompositionEnd={handleCompositionEnd}
							onKeyDown={(e) => handleKeyDownSafe(e, handleAddKeyword)}
						/>
						<button
							onClick={handleAddKeyword}
							className="text-success hover:text-success-dark p-1"
						>
							<i className="fas fa-check"></i>
						</button>
						<button
							onClick={() => setShowAddKeyword(false)}
							className="text-danger hover:text-danger-dark p-1"
						>
							<i className="fas fa-times"></i>
						</button>
					</div>
				)}

				<div className="space-y-2">
					{(scanSettings.excludeKeywords || []).map((word) => (
						<div
							key={word}
							className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-200 mb-2 transition hover:bg-neutral-100"
						>
							<span className="font-medium text-neutral-900">{word}</span>
							<button
								onClick={() => handleDeleteKeyword(word)}
								className="text-danger hover:text-danger-dark p-2 rounded-lg hover:bg-neutral-200 transition"
								title="削除"
							>
								<i className="fas fa-trash-alt"></i>
							</button>
						</div>
					))}
					{(scanSettings.excludeKeywords || []).length === 0 &&
						!showAddKeyword && (
							<p className="text-sm text-neutral-400 text-center py-4">
								設定なし
							</p>
						)}
				</div>
			</section>

			{/* 自動分類ルールセクション */}
			<section className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
				<div className="flex justify-between items-center mb-4">
					<h3 className="font-bold text-neutral-800 border-l-4 border-primary pl-3">
						自動分類ルール
					</h3>
					<button
						onClick={handleAddRuleStart}
						className="text-primary hover:text-primary-dark font-medium text-sm flex items-center gap-1"
					>
						<i className="fas fa-plus"></i> 追加
					</button>
				</div>

				{showAddRule && (
					<div className="bg-primary-light p-4 rounded-md border border-primary-ring mb-4 text-sm animate-fade-in space-y-4">
						<h4 className="font-bold text-neutral-900 mb-1">
							{editingRuleKeyword ? "ルールを編集" : "新しいルールを追加"}
						</h4>
						<div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
							<label className="font-semibold text-neutral-800 md:w-24 md:shrink-0">
								キーワード
							</label>
							<div className="grow">
								<Input
									type="text"
									className="w-full bg-white"
									placeholder="例: スーパー, コンビニ"
									value={newRuleKeyword}
									onChange={(e) => setNewRuleKeyword(e.target.value)}
									onCompositionStart={handleCompositionStart}
									onCompositionEnd={handleCompositionEnd}
									onKeyDown={(e) => handleKeyDownSafe(e, handleSaveRule)}
								/>
							</div>
						</div>
						<div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
							<label className="font-semibold text-neutral-800 md:w-24 md:shrink-0">
								分類先
							</label>
							<div className="grow">
								<Select
									className="w-full bg-white text-neutral-800"
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
						<div className="flex justify-end gap-2 pt-2 border-t border-primary-ring/30">
							<button
								onClick={() => setShowAddRule(false)}
								className="px-3 py-1.5 text-xs text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-50 shadow-sm"
							>
								キャンセル
							</button>
							<button
								onClick={handleSaveRule}
								className="px-3 py-1.5 text-xs text-white bg-primary rounded hover:bg-primary-dark shadow-sm"
							>
								保存
							</button>
						</div>
					</div>
				)}

				<div className="space-y-2">
					{(scanSettings.categoryRules || []).map((rule) => {
						const cat = categories.find((c) => c.id === rule.categoryId);
						return (
							<div
								key={rule.keyword}
								className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-200 mb-2 transition hover:bg-neutral-100"
							>
								<div className="flex items-center gap-3 overflow-hidden">
									<span className="font-medium text-neutral-900">
										"{rule.keyword}"
									</span>
									<i className="fas fa-arrow-right text-neutral-400 text-xs"></i>
									<span className="text-sm text-neutral-600 truncate">
										{cat ? cat.name : "不明なカテゴリ"}
									</span>
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<button
										onClick={() => handleEditRule(rule)}
										className="text-primary hover:text-primary-dark p-2 rounded-lg hover:bg-neutral-200 transition"
										title="編集"
									>
										<i className="fas fa-pen"></i>
									</button>
									<button
										onClick={() => handleDeleteRule(rule.keyword)}
										className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-neutral-200 transition"
										title="削除"
									>
										<i className="fas fa-trash-alt"></i>
									</button>
								</div>
							</div>
						);
					})}
					{(scanSettings.categoryRules || []).length === 0 && !showAddRule && (
						<p className="text-sm text-neutral-400 text-center py-4">
							設定なし
						</p>
					)}
				</div>
			</section>
		</div>
	);
}
