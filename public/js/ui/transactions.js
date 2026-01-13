import * as utils from "../utils.js";

/**
 * 取引タブのUI要素をまとめたオブジェクトを取得する関数。
 * @returns {object} UI要素を含むオブジェクト。
 */
const getElements = () => ({
	list: utils.dom.get("transactions-list"),
	noTransactionsMessage: utils.dom.get("no-transactions-message"),
	typeFilter: utils.dom.get("type-filter"),
	categoryFilter: utils.dom.get("category-filter"),
	paymentMethodFilter: utils.dom.get("payment-method-filter"),
	searchInput: utils.dom.get("search-input"),
	resetFiltersButton: utils.dom.get("reset-filters-button"),
	monthFilter: utils.dom.get("month-filter"),
	addTransactionButton: utils.dom.get("add-transaction-button"),
});

/**
 * 現在のフィルター条件を保持するオブジェクト。
 * @type {object}
 */
let currentFilters = {
	type: "all",
	category: "all",
	paymentMethod: "all",
	searchTerm: "",
};

// --- Module Dependencies ---
import { renderTransactionList } from "../../src/entries/transactionList.jsx";

let onUpdateCallback = () => {};
let getLuts = () => ({});
let onTransactionClickCallback = () => {};

/**
 * 取引モジュールを初期化する。
 * @param {object} params - 初期化パラメータ。
 * @param {function} params.onUpdate - フィルター等が変更された時に実行されるコールバック関数。
 * @param {function} params.onAddClick - 取引追加ボタンがクリックされた時に実行されるコールバック関数。
 * @param {function} params.onTransactionClick - 取引行がクリックされた時に実行されるコールバック関数。
 * @param {function} params.getLuts - 口座やカテゴリ情報を参照するための関数。
 */
export function init({
	onUpdate,
	onAddClick,
	onTransactionClick,
	getLuts: getLutsFunc,
}) {
	onUpdateCallback = onUpdate;
	getLuts = getLutsFunc;
	onTransactionClickCallback = onTransactionClick;

	const {
		typeFilter,
		categoryFilter,
		paymentMethodFilter,
		searchInput,
		resetFiltersButton,
		monthFilter,
		addTransactionButton,
		list,
	} = getElements();

	utils.dom.on(typeFilter, "change", (e) => {
		const selectedType = e.target.value;
		categoryFilter.disabled = !(
			selectedType === "income" || selectedType === "expense"
		);
		updateCategoryFilterOptions(selectedType);
		handleFilterChange("type", selectedType);
	});

	utils.dom.on(categoryFilter, "change", (e) =>
		handleFilterChange("category", e.target.value)
	);
	utils.dom.on(paymentMethodFilter, "change", (e) =>
		handleFilterChange("paymentMethod", e.target.value)
	);

	const debouncedSearch = utils.debounce((value) => {
		handleFilterChange("searchTerm", value);
	}, 300);

	utils.dom.on(searchInput, "input", (e) => debouncedSearch(e.target.value));
	utils.dom.on(resetFiltersButton, "click", resetFilters);

	utils.dom.on(searchInput, "keydown", (e) => {
		if (e.key === "Escape") {
			e.target.value = "";
			handleFilterChange("searchTerm", "");
		}
	});

	utils.dom.on(monthFilter, "change", (e) =>
		onUpdateCallback({ currentMonthFilter: e.target.value })
	);
	utils.dom.on(addTransactionButton, "click", onAddClick);
	// Click event handled by React

	populateFilterDropdowns();
	categoryFilter.disabled = true;
}

/**
 * 月フィルターの選択肢を更新する。
 * @param {string} optionsHtml - optionタグのHTML文字列。
 * @param {string} currentValue - 現在選択されている値。
 */
export function updateMonthSelector(optionsHtml, currentValue) {
	const { monthFilter } = getElements();
	if (monthFilter) {
		utils.dom.setHtml(monthFilter, optionsHtml);
		if (
			currentValue &&
			Array.from(monthFilter.options).some((o) => o.value === currentValue)
		) {
			monthFilter.value = currentValue;
		} else {
			monthFilter.value = "all-time";
		}
	}
}

/**
 * select要素のoptionタグを生成するヘルパー関数。
 * 項目をソートしてからHTML文字列に変換する。
 * @private
 * @param {Array<object>} items - optionに変換する項目の配列。
 * @returns {string} 生成されたHTML文字列。
 */
const createOptions = (items) => {
	const sortedItems = [...items].sort((a, b) => {
		if (a.type !== b.type) {
			return a.type === "asset" ? -1 : 1;
		}
		const orderA = a.order ?? Infinity;
		const orderB = b.order ?? Infinity;
		if (orderA !== orderB) {
			return orderA - orderB;
		}
		return a.name.localeCompare(b.name);
	});

	return sortedItems
		.map((item) => `<option value="${item.id}">${item.name}</option>`)
		.join("");
};

/**
 * 取引種別フィルターの選択に応じて、カテゴリフィルターの選択肢を更新する。
 * 収入・支出が選択された場合は対応するカテゴリのみを表示し、それ以外は全カテゴリを表示する。
 * @private
 * @param {string} [type="all"] - 選択された取引種別。
 * @returns {void}
 */
function updateCategoryFilterOptions(type = "all") {
	const { categoryFilter } = getElements();
	const appLuts = getLuts();
	const allCategories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted
	);
	let options = [];

	if (type === "income" || type === "expense") {
		options = allCategories.filter((c) => c.type === type);
	} else {
		options = allCategories;
	}

	utils.dom.setHtml(
		categoryFilter,
		[
			'<option value="all">すべてのカテゴリ</option>',
			createOptions(
				options.sort(
					(a, b) =>
						(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
				)
			),
		].join("")
	);
}

/**
 * フィルター条件が変更されたときに状態を更新し、再描画コールバックを実行する。
 * @private
 * @param {string} type - 変更されたフィルターの種類。
 * @param {string} value - 新しいフィルターの値。
 * @returns {void}
 */
function handleFilterChange(type, value) {
	currentFilters[type] = value;
	onUpdateCallback({});
}

/**
 * すべてのフィルターを初期状態にリセットする。
 * UI要素の値も初期値に戻す。
 * @returns {void}
 */
function resetFilters() {
	const { typeFilter, paymentMethodFilter, searchInput, categoryFilter } =
		getElements();
	currentFilters = {
		type: "all",
		category: "all",
		paymentMethod: "all",
		searchTerm: "",
	};
	typeFilter.value = "all";
	paymentMethodFilter.value = "all";
	searchInput.value = "";

	updateCategoryFilterOptions("all");
	categoryFilter.value = "all";
	categoryFilter.disabled = true;

	onUpdateCallback({});
}

// createAmountElement removed (React handled)
// createTransactionElement removed (React handled)

/**
 * フィルタリングされた取引リストを日付ごとにグループ化して描画する。
 * Reactコンポーネントを使用して描画を行う。
 *
 * @param {Array<object>} transactions - 描画する取引データの配列。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @returns {void}
 */
export function render(transactions, isMasked) {
	const { noTransactionsMessage } = getElements();
	utils.dom.toggle(noTransactionsMessage, transactions.length === 0);

	// Reactコンポーネントに委譲
	// コンテナIDは 'transactions-list' (getElementsで取得しているID)
	renderTransactionList("transactions-list", {
		transactions,
		luts: getLuts(),
		isMasked,
		onTransactionClick: onTransactionClickCallback,
	});
}

/**
 * 旧・取引リスト描画関数 (React化により廃止)
 * @private
 */
/*
function renderLegacy(transactions, isMasked) {
    // ...
}
*/
function renderLegacy(transactions, isMasked) {
	const { noTransactionsMessage, list } = getElements();
	// ... existing code ...
}

/**
 * 現在のフィルター条件に基づいて取引リストをフィルタリングする。
 * 種別、カテゴリ、支払方法、検索語で絞り込みを行う。
 * @param {Array<object>} transactions - フィルタリング対象の取引データ配列。
 * @returns {Array<object>} フィルタリング後の取引データ配列。
 */
export function applyFilters(transactions) {
	let filtered = [...transactions];
	const appLuts = getLuts();
	if (currentFilters.type !== "all") {
		filtered = filtered.filter((t) => t.type === currentFilters.type);
	}
	if (currentFilters.category !== "all") {
		filtered = filtered.filter((t) => t.categoryId === currentFilters.category);
	}
	if (currentFilters.paymentMethod !== "all") {
		filtered = filtered.filter(
			(t) =>
				t.accountId === currentFilters.paymentMethod ||
				t.fromAccountId === currentFilters.paymentMethod ||
				t.toAccountId === currentFilters.paymentMethod
		);
	}
	if (currentFilters.searchTerm.trim() !== "") {
		const term = currentFilters.searchTerm.trim().toLowerCase();
		filtered = filtered.filter((t) => {
			const categoryName = appLuts.categories.get(t.categoryId)?.name || "";
			const accountName = appLuts.accounts.get(t.accountId)?.name || "";
			const fromName = appLuts.accounts.get(t.fromAccountId)?.name || "";
			const toName = appLuts.accounts.get(t.toAccountId)?.name || "";

			return (
				(t.description && t.description.toLowerCase().includes(term)) ||
				(t.memo && t.memo.toLowerCase().includes(term)) ||
				categoryName.toLowerCase().includes(term) ||
				accountName.toLowerCase().includes(term) ||
				fromName.toLowerCase().includes(term) ||
				toName.toLowerCase().includes(term)
			);
		});
	}
	return filtered;
}

/**
 * フィルター用のドロップダウン（支払方法、カテゴリ）の選択肢を生成する。
 * 削除されていない口座のみを選択肢として表示する。
 * @returns {void}
 */
export function populateFilterDropdowns() {
	const { typeFilter, paymentMethodFilter } = getElements();
	const appLuts = getLuts();
	const allAccounts = [...appLuts.accounts.values()].filter(
		(a) => !a.isDeleted
	);

	utils.dom.setHtml(
		typeFilter,
		[
			'<option value="all">すべての取引</option>',
			'<option value="income">収入</option>',
			'<option value="expense">支出</option>',
			'<option value="transfer">振替</option>',
		].join("")
	);
	utils.dom.setHtml(
		paymentMethodFilter,
		[
			'<option value="all">すべての支払方法</option>',
			createOptions(allAccounts),
		].join("")
	);

	updateCategoryFilterOptions("all");
}
