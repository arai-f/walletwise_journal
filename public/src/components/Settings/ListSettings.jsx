import { useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";
import * as utils from "../../utils.js";
import IconPicker from "./IconPicker";

const PROTECTED_DEFAULTS = ["その他収入", "その他支出"];

/**
 * リスト形式の設定（資産口座、カテゴリなど）を管理するコンポーネント。
 * 項目の追加、編集、削除、並び替え（ドラッグ&ドロップ）機能を提供する。
 * 資産口座の場合は「残高調整」機能も併せて表示する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {string} props.type - 設定対象の種類 ('asset', 'liability', 'income', 'expense')。
 * @param {string} props.title - 画面タイトル。
 * @param {object} props.store - ストア操作オブジェクト。
 * @param {Function} props.getState - ステート取得関数。
 * @param {Function} props.refreshApp - アプリ再描画関数。
 * @return {JSX.Element} リスト設定コンポーネント。
 */
export default function ListSettings({
	type,
	title,
	store,
	getState,
	refreshApp,
}) {
	const [items, setItems] = useState([]);
	const [newItemName, setNewItemName] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [iconPickerOpen, setIconPickerOpen] = useState(false);
	const [targetIconItem, setTargetIconItem] = useState(null);

	const listRef = useRef(null);
	const sortableRef = useRef(null);
	const [balances, setBalances] = useState({});

	// 初期ロード。
	useEffect(() => {
		loadItems();
	}, [type, getState]);

	// SortableJSを使用したドラッグ&ドロップ並び替えの初期化。
	useEffect(() => {
		if (listRef.current) {
			sortableRef.current = new Sortable(listRef.current, {
				animation: 150,
				handle: ".handle",
				ghostClass: "sortable-ghost", // ドラッグ中のプレースホルダースタイル
				chosenClass: "sortable-chosen", // 選択されたアイテムのスタイル
				dragClass: "sortable-drag", // ドラッグ中のアイテムのスタイル
				onUpdate: () => {
					handleSort();
				},
			});
		}
		return () => {
			if (sortableRef.current) sortableRef.current.destroy();
		};
	}, [items]);

	// Sortable用のスタイルを動的に注入する副作用。
	useEffect(() => {
		if (!document.getElementById("sortable-styles")) {
			const style = document.createElement("style");
			style.id = "sortable-styles";
			style.innerHTML = `
                .sortable-ghost { opacity: 0.4; background: #e5e5e5; }
                .sortable-drag { background: white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); transform: scale(1.02); }
            `;
			document.head.appendChild(style);
		}
	}, []);

	const loadItems = () => {
		const { luts, accountBalances } = getState(); // accountBalances needed for constraints
		let fetchedItems = [];
		if (type === "asset" || type === "liability") {
			fetchedItems = [...luts.accounts.values()].filter(
				(a) => a.type === type && !a.isDeleted
			);
		} else {
			fetchedItems = [...luts.categories.values()].filter(
				(c) => c.type === type && !c.isDeleted
			);
		}
		setItems(utils.sortItems(fetchedItems));
		setBalances(accountBalances || {});
	};

	const handleSort = async () => {
		if (!listRef.current) return;
		const orderedIds = [...listRef.current.children].map(
			(child) => child.dataset.id
		);
		try {
			if (type === "asset" || type === "liability") {
				await store.updateAccountOrder(orderedIds);
			} else {
				await store.updateCategoryOrder(orderedIds);
			}
			await refreshApp();
		} catch (error) {
			console.error(error);
			alert("順序の更新に失敗しました。");
		}
	};

	const handleAddItem = async () => {
		const name = newItemName.trim();
		if (!name) return alert("項目名を入力してください。");

		const { luts } = getState();
		const allNames = [
			...[...luts.accounts.values()].map((a) => a.name.toLowerCase()),
			...[...luts.categories.values()].map((c) => c.name.toLowerCase()),
		];
		if (allNames.includes(name.toLowerCase())) {
			return alert(`「${name}」という名前は既に使用されています。`);
		}

		try {
			let currentCount =
				type === "asset" || type === "liability"
					? luts.accounts.size
					: luts.categories.size;

			await store.addItem({ type, name, order: currentCount });
			setNewItemName("");
			setIsAdding(false);
			await refreshApp();
			loadItems();
		} catch (e) {
			alert(`追加中にエラーが発生しました: ${e.message}`);
		}
	};

	const openIconPicker = (item) => {
		setTargetIconItem(item);
		setIconPickerOpen(true);
	};

	const handleIconSelect = async (icon) => {
		if (!targetIconItem) return;
		try {
			await store.updateItem(targetIconItem.id, "account", { icon: icon });
			await refreshApp();
			loadItems();
			setIconPickerOpen(false);
		} catch (error) {
			console.error(error);
			alert("アイコンの変更に失敗しました。");
		}
	};

	return (
		<div className="p-4">
			<div className="flex justify-between items-center mb-4">
				<h3 className="font-bold text-neutral-800 border-l-4 border-primary pl-3">
					{title}
				</h3>
				<button
					onClick={() => setIsAdding(true)}
					className="text-primary hover:text-primary-dark font-medium text-sm flex items-center gap-1"
				>
					<i className="fas fa-plus"></i> 追加
				</button>
			</div>

			{isAdding && (
				<div className="mb-4 flex items-center gap-2 p-2 rounded-md bg-neutral-100 animate-fade-in">
					<input
						type="text"
						value={newItemName}
						onChange={(e) => setNewItemName(e.target.value)}
						className="grow border-neutral-300 rounded-lg px-2 h-9 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
						placeholder={`新しい${title}名`}
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Enter") handleAddItem();
							if (e.key === "Escape") setIsAdding(false);
						}}
					/>
					<button
						onClick={handleAddItem}
						className="text-success hover:text-success-dark p-1"
					>
						<i className="fas fa-check"></i>
					</button>
					<button
						onClick={() => setIsAdding(false)}
						className="text-danger hover:text-danger-dark p-1"
					>
						<i className="fas fa-times"></i>
					</button>
				</div>
			)}

			<div ref={listRef} className="space-y-2 mb-8">
				{items.map((item) => (
					<ListItem
						key={item.id}
						item={item}
						type={type}
						store={store}
						getState={getState}
						refreshApp={refreshApp}
						reloadList={loadItems}
						balances={balances}
						onEditIcon={() => openIconPicker(item)}
					/>
				))}
			</div>

			{/* 資産口座用の残高調整セクション */}
			{type === "asset" && (
				<div className="mt-8 pt-6 border-t border-neutral-200">
					<h3 className="font-bold text-neutral-800 mb-4 border-l-4 border-primary pl-3">
						残高調整
					</h3>
					<div className="space-y-3">
						{items.map((account) => (
							<BalanceAdjustItem
								key={account.id}
								account={account}
								currentBalance={balances[account.id] || 0}
								store={store}
								refreshApp={refreshApp}
								utils={utils}
							/>
						))}
					</div>
				</div>
			)}

			<IconPicker
				isOpen={iconPickerOpen}
				onClose={() => setIconPickerOpen(false)}
				onSelect={handleIconSelect}
			/>
		</div>
	);
}

/**
 * リスト内の各アイテムを表示・編集するコンポーネント。
 * 名前のインライン編集、アイコン変更、削除機能を提供する。
 * 削除時はアイテムの種類（口座/カテゴリ）に応じた制約チェックを行う。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.item - 表示・編集対象のアイテムオブジェクト。
 * @param {string} props.type - アイテムの種類 ('asset', 'liability', 'income', 'expense')。
 * @param {object} props.store - ストア操作オブジェクト。
 * @param {Function} props.getState - ステート取得関数。
 * @param {Function} props.refreshApp - アプリ再描画関数。
 * @param {Function} props.reloadList - リスト再読み込み関数。
 * @param {object} props.balances - 口座IDをキー、残高を値とするオブジェクト（削除制約チェック用）。
 * @param {Function} props.onEditIcon - アイコン編集ボタン押下時のコールバック関数。
 * @return {JSX.Element} リストアイテムコンポーネント。
 */
function ListItem({
	item,
	type,
	store,
	getState,
	refreshApp,
	reloadList,
	balances,
	onEditIcon,
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(item.name);

	// 削除・編集可否の制約チェック
	let isDeletable = true;
	let isEditable = true;
	let tooltip = "";

	if (type === "asset" || type === "liability") {
		const balance = balances[item.id] || 0;
		if (balance !== 0) {
			isDeletable = false;
			tooltip = `残高がゼロではありません (${utils.formatCurrency(balance)})。`;
		}
	} else {
		if (PROTECTED_DEFAULTS.includes(item.name)) {
			isDeletable = false;
			isEditable = false;
			tooltip = "このカテゴリは削除できません。";
		}
	}

	const itemType =
		type === "asset" || type === "liability" ? "account" : "category";

	const handleSave = async () => {
		const newName = editName.trim();
		if (newName === item.name) {
			setIsEditing(false);
			return;
		}

		const { luts } = getState();
		const allNames = [
			...[...luts.accounts.values()].map((a) => a.name.toLowerCase()),
			...[...luts.categories.values()].map((c) => c.name.toLowerCase()),
		];
		if (allNames.includes(newName.toLowerCase())) {
			return alert(`「${newName}」という名前は既に使用されています。`);
		}

		try {
			await store.updateItem(item.id, itemType, { name: newName });
			await refreshApp();
			reloadList();
			setIsEditing(false);
		} catch (e) {
			console.error(e);
			alert("更新失敗");
		}
	};

	const handleDelete = async () => {
		if (type === "asset" || type === "liability") {
			if (
				!confirm(
					`口座「${item.name}」を本当に削除しますか？\n（取引履歴は消えません）`
				)
			)
				return;
			await store.deleteItem(item.id, "account");
		} else {
			const targetName =
				type === "income" ? PROTECTED_DEFAULTS[0] : PROTECTED_DEFAULTS[1];
			if (
				!confirm(
					`カテゴリ「${item.name}」を削除しますか？\nこのカテゴリの既存の取引はすべて「${targetName}」に振り替えられます。`
				)
			)
				return;

			const { luts } = getState();
			const toCategory = [...luts.categories.values()].find(
				(c) => c.name === targetName
			);
			if (!toCategory)
				return alert(`振替先のカテゴリ「${targetName}」が見つかりません。`);

			await store.remapTransactions(item.id, toCategory.id);
			await store.deleteItem(item.id, "category");
		}
		await refreshApp();
		reloadList();
	};

	return (
		<div
			className="flex items-center justify-between p-3 rounded-md bg-white shadow-sm transition hover:shadow-md mb-2 group"
			data-id={item.id}
		>
			<div className="flex items-center grow min-w-0">
				<div className="handle cursor-move p-2 mr-2 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-100 transition">
					<i className="fas fa-grip-vertical"></i>
				</div>

				{itemType === "account" && (
					<button
						onClick={onEditIcon}
						className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-100 hover:bg-neutral-200 transition text-neutral-600 mr-2 shrink-0"
					>
						<i className={item.icon || "fa-solid fa-question"}></i>
					</button>
				)}

				<div className="grow min-w-0 mr-2">
					{isEditing ? (
						<div className="flex items-center gap-1">
							<input
								type="text"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="w-full border border-neutral-300 rounded px-2 h-7 text-sm"
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSave();
									if (e.key === "Escape") {
										setEditName(item.name);
										setIsEditing(false);
									}
								}}
								autoFocus
							/>
							<button onClick={handleSave} className="text-success p-1">
								<i className="fas fa-check"></i>
							</button>
						</div>
					) : (
						<span className="block truncate font-medium text-neutral-900 text-base">
							{item.name}
						</span>
					)}
				</div>
			</div>

			<div className="flex items-center gap-1 shrink-0">
				{isEditable && !isEditing && (
					<button
						onClick={() => setIsEditing(true)}
						className="text-primary hover:text-primary-dark p-2 rounded-lg hover:bg-neutral-100 transition"
						title="名前を編集"
					>
						<i className="fas fa-pen"></i>
					</button>
				)}
				{isDeletable ? (
					<button
						onClick={handleDelete}
						className="text-danger hover:text-danger-dark p-2 rounded-lg hover:bg-neutral-100 transition"
						title="削除"
					>
						<i className="fas fa-trash-alt"></i>
					</button>
				) : (
					<div className="p-2 text-neutral-400 cursor-help" title={tooltip}>
						<i className="fas fa-lock"></i>
					</div>
				)}
			</div>
		</div>
	);
}

/**
 * 資産口座の残高調整を行うアイテムコンポーネント。
 * 現在の実残高を入力することで、システムとの差分を自動計算し、
 * 調整用のトランザクション（使途不明金など）を作成する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.account - 調整対象の口座オブジェクト。
 * @param {number} props.currentBalance - 現在のシステム上の残高。
 * @param {object} props.store - ストア操作オブジェクト。
 * @param {Function} props.refreshApp - アプリ再描画関数。
 * @param {object} props.utils - ユーティリティ関数群。
 * @return {JSX.Element} 残高調整アイテムコンポーネント。
 */
function BalanceAdjustItem({
	account,
	currentBalance,
	store,
	refreshApp,
	utils,
}) {
	const [inputVal, setInputVal] = useState("");

	const handleAdjust = async () => {
		const actualBalance = parseFloat(inputVal);
		if (isNaN(actualBalance)) return alert("数値を入力してください。");

		const difference = actualBalance - currentBalance;
		if (difference === 0) return alert("残高に差がないため、調整は不要です。");

		if (
			confirm(
				`「${
					account.name
				}」の残高を ¥${difference.toLocaleString()} 調整しますか？`
			)
		) {
			const transaction = {
				type: difference > 0 ? "income" : "expense",
				date: utils.toYYYYMMDD(new Date()),
				amount: Math.abs(difference),
				categoryId:
					utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID ||
					"system_balance_adjustment",
				accountId: account.id,
				description: "残高のズレを実績値に調整",
				memo: `調整前の残高: ¥${currentBalance.toLocaleString()}`,
			};
			await store.saveTransaction(transaction);
			await refreshApp(true);
			setInputVal("");
		}
	};

	return (
		<div className="flex flex-col md:grid md:grid-cols-5 md:items-center gap-2 md:gap-4 p-3 rounded-md bg-neutral-50">
			<span className="font-medium text-neutral-900 md:col-span-2">
				{account.name}
			</span>
			<div className="flex items-center gap-2 w-full md:col-span-3">
				<input
					type="number"
					className="w-full border-neutral-300 rounded-lg px-2 h-9 text-sm text-right text-neutral-900 focus:ring-2 focus:ring-primary focus:border-primary"
					placeholder={`現在の残高: ¥${currentBalance.toLocaleString()}`}
					value={inputVal}
					onChange={(e) => setInputVal(e.target.value)}
				/>
				<button
					onClick={handleAdjust}
					className="bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary-dark shrink-0 text-sm font-bold"
				>
					調整
				</button>
			</div>
		</div>
	);
}
