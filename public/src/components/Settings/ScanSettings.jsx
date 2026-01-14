import { useEffect, useState } from "react";
import Button from "../ui/Button";
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
			console.error(e);
			alert("保存に失敗しました");
		}
	};

	/**
	 * 新しい除外キーワードを追加する。
	 */
	const handleAddKeyword = async () => {
		const word = newKeyword.trim();
		if (!word) return alert("キーワードを入力してください");
		if ((scanSettings.excludeKeywords || []).includes(word))
			return alert("既に登録されています");

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
		if (!word) return alert("キーワードを入力してください");
		if (!newRuleCategory) return alert("カテゴリを選択してください");

		const rules = scanSettings.categoryRules || [];
		// 重複チェック
		const existing = rules.find((r) => r.keyword === word);
		if (existing && (!editingRuleKeyword || editingRuleKeyword !== word)) {
			return alert("このキーワードのルールは既に存在します");
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

	const incomeCategories = categories.filter((c) => c.type === "income");
	const expenseCategories = categories.filter((c) => c.type === "expense");

	return (
		<div className="p-4 space-y-8">
			{/* 除外キーワード設定セクション */}
			<section>
				<div className="flex justify-between items-center mb-4">
					<h3 className="font-bold text-neutral-800 border-l-4 border-primary pl-3">
						スキャン除外キーワード
					</h3>
					<Button
						variant="ghost"
						onClick={() => setShowAddKeyword(true)}
						className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
					>
						<i className="fas fa-plus"></i> 追加
					</Button>
				</div>

				{showAddKeyword && (
					<div className="flex items-center gap-2 p-2 rounded-md bg-neutral-100 mb-4 animate-fade-in">
						<Input
							type="text"
							className="grow"
							placeholder="除外するキーワード"
							value={newKeyword}
							onChange={(e) => setNewKeyword(e.target.value)}
						/>
						<Button
							onClick={handleAddKeyword}
							variant="ghost"
							className="text-green-600 hover:bg-green-50"
						>
							<i className="fas fa-check"></i>
						</Button>
						<Button
							onClick={() => setShowAddKeyword(false)}
							variant="ghost"
							className="text-red-600 hover:bg-red-50"
						>
							<i className="fas fa-times"></i>
						</Button>
					</div>
				)}

				<div className="space-y-2">
					{(scanSettings.excludeKeywords || []).map((word) => (
						<div
							key={word}
							className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-200"
						>
							<span className="font-medium text-neutral-900">{word}</span>
							<Button
								onClick={() => handleDeleteKeyword(word)}
								variant="ghost"
								className="text-red-600 hover:bg-white"
							>
								<i className="fas fa-trash-alt"></i>
							</Button>
						</div>
					))}
					{(scanSettings.excludeKeywords || []).length === 0 &&
						!showAddKeyword && (
							<p className="text-sm text-neutral-400 text-center py-2">
								設定なし
							</p>
						)}
				</div>
			</section>

			{/* 自動分類ルールセクション */}
			<section>
				<div className="flex justify-between items-center mb-4">
					<h3 className="font-bold text-neutral-800 border-l-4 border-primary pl-3">
						自動分類ルール
					</h3>
					<Button
						variant="ghost"
						onClick={handleAddRuleStart}
						className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
					>
						<i className="fas fa-plus"></i> 追加
					</Button>
				</div>

				{showAddRule && (
					<div className="bg-indigo-50 p-4 rounded-md border border-indigo-200 mb-4 text-sm animate-fade-in space-y-3">
						<h4 className="font-bold text-neutral-900 mb-1">
							{editingRuleKeyword ? "ルールを編集" : "新しいルールを追加"}
						</h4>
						<div className="grid grid-cols-12 items-center gap-2">
							<label className="col-span-4 font-semibold text-neutral-800">
								キーワード
							</label>
							<div className="col-span-8">
								<Input
									type="text"
									placeholder="例: スーパー, コンビニ"
									value={newRuleKeyword}
									onChange={(e) => setNewRuleKeyword(e.target.value)}
								/>
							</div>
						</div>
						<div className="grid grid-cols-12 items-center gap-2">
							<label className="col-span-4 font-semibold text-neutral-800">
								分類先
							</label>
							<div className="col-span-8">
								<Select
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
						<div className="flex justify-end gap-2 pt-2">
							<Button
								onClick={() => setShowAddRule(false)}
								variant="secondary"
								className="px-3 py-1.5 text-xs h-auto"
							>
								キャンセル
							</Button>
							<Button
								onClick={handleSaveRule}
								variant="primary"
								className="px-3 py-1.5 text-xs h-auto"
							>
								保存
							</Button>
						</div>
					</div>
				)}

				<div className="space-y-2">
					{(scanSettings.categoryRules || []).map((rule) => {
						const cat = categories.find((c) => c.id === rule.categoryId);
						return (
							<div
								key={rule.keyword}
								className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-200"
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
									<Button
										onClick={() => handleEditRule(rule)}
										variant="ghost"
										className="text-indigo-600 hover:bg-white"
									>
										<i className="fas fa-pen"></i>
									</Button>
									<Button
										onClick={() => handleDeleteRule(rule.keyword)}
										variant="ghost"
										className="text-red-600 hover:bg-white"
									>
										<i className="fas fa-trash-alt"></i>
									</Button>
								</div>
							</div>
						);
					})}
					{(scanSettings.categoryRules || []).length === 0 && !showAddRule && (
						<p className="text-sm text-neutral-400 text-center py-2">
							設定なし
						</p>
					)}
				</div>
			</section>
		</div>
	);
}
