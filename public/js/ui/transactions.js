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

/**
 * 内部フィルターが変更されたときに実行されるコールバック関数。
 * @type {function}
 */
let onFilterChangeCallback = () => {};

/**
 * アプリケーションのルックアップテーブル（口座、カテゴリ情報）。
 * @type {object}
 */
let appLuts = {};

/**
 * 取引モジュールを初期化する。
 * イベントリスナーを設定し、フィルターの初期状態を構築する。
 * @param {object} params - 初期化パラメータ。
 * @param {function} params.onFilterChange - 内部フィルターが変更された時に実行されるコールバック関数。
 * @param {function} params.onMonthFilterChange - 月フィルターが変更された時に実行されるコールバック関数。
 * @param {function} params.onAddClick - 取引追加ボタンがクリックされた時に実行されるコールバック関数。
 * @param {function} params.onTransactionClick - 取引行がクリックされた時に実行されるコールバック関数。
 * @param {object} params.luts - 口座やカテゴリ情報を参照するためのルックアップテーブル。
 * @returns {void}
 */
export function init({
	onFilterChange,
	onMonthFilterChange,
	onAddClick,
	onTransactionClick,
	luts,
}) {
	onFilterChangeCallback = onFilterChange;
	appLuts = luts;

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
		// 取引種別に応じてカテゴリフィルターを有効化または無効化する
		categoryFilter.disabled = !(
			selectedType === "income" || selectedType === "expense"
		);
		// カテゴリの選択肢を動的に更新する
		updateCategoryFilterOptions(selectedType);
		handleFilterChange("type", selectedType);
	});

	// 各フィルターの変更イベントを設定する
	utils.dom.on(categoryFilter, "change", (e) =>
		handleFilterChange("category", e.target.value)
	);
	utils.dom.on(paymentMethodFilter, "change", (e) =>
		handleFilterChange("paymentMethod", e.target.value)
	);

	// 検索入力のデバウンス処理（300ms待機）
	const debouncedSearch = utils.debounce((value) => {
		handleFilterChange("searchTerm", value);
	}, 300);

	utils.dom.on(searchInput, "input", (e) => debouncedSearch(e.target.value));
	utils.dom.on(resetFiltersButton, "click", resetFilters);

	// 検索ボックスでEscapeキーを押すと検索語をクリアする
	utils.dom.on(searchInput, "keydown", (e) => {
		if (e.key === "Escape") {
			e.target.value = "";
			handleFilterChange("searchTerm", "");
		}
	});

	// 月フィルター
	if (onMonthFilterChange) {
		utils.dom.on(monthFilter, "change", onMonthFilterChange);
	}

	// 取引追加ボタン
	if (onAddClick) {
		utils.dom.on(addTransactionButton, "click", onAddClick);
	}

	// 取引リストクリック
	if (onTransactionClick) {
		utils.dom.on(list, "click", (e) => {
			const targetRow = e.target.closest("div[data-id]");
			if (targetRow) {
				onTransactionClick(targetRow.dataset.id);
			}
		});
	}

	populateFilterDropdowns();
	categoryFilter.disabled = true; // 初期状態では無効にする
}

/**
 * 月フィルターの選択肢を更新する。
 * @param {string} optionsHtml - optionタグのHTML文字列。
 * @param {string} currentValue - 現在選択されている値。
 * @returns {void}
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
	onFilterChangeCallback();
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

	// カテゴリフィルターをリセットし、無効化状態に戻す
	updateCategoryFilterOptions("all");
	categoryFilter.value = "all";
	categoryFilter.disabled = true;

	onFilterChangeCallback();
}

/**
 * 取引の金額要素を生成する。
 * マスク表示が有効な場合は金額を隠す。
 * @private
 * @param {number} amount - 金額。
 * @param {string} type - 取引種別。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @returns {string} 金額部分のHTML文字列。
 */
function createAmountElement(amount, type, isMasked) {
	const formattedText = utils.formatCurrency(Math.abs(amount), isMasked);

	if (isMasked) {
		return `<p class="font-semibold text-neutral-900 text-lg whitespace-nowrap">${formattedText}</p>`;
	}

	let className = "text-neutral-900";
	let sign = "";
	if (type === "expense") {
		className = "text-danger";
		sign = "- ";
	} else if (type === "income") {
		className = "text-success";
		sign = "+ ";
	}

	return `<p class="font-semibold ${className} text-lg whitespace-nowrap">${sign}${formattedText}</p>`;
}

/**
 * 1件の取引データを表示するDOM要素を生成する。
 * 取引種別に応じてアイコンやテキストを動的に設定する。
 * @private
 * @param {object} t - 取引オブジェクト。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @returns {HTMLElement} 生成された取引要素。
 */
function createTransactionElement(t, isMasked) {
	const div = document.createElement("div");
	div.className =
		"bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4 cursor-pointer hover-lift";
	div.dataset.id = t.id;

	let icon, primaryText, secondaryText;

	const category = appLuts.categories.get(t.categoryId);
	const account = appLuts.accounts.get(t.accountId);
	const fromAccount = appLuts.accounts.get(t.fromAccountId);
	const toAccount = appLuts.accounts.get(t.toAccountId);

	// 取引種別に応じてアイコンや表示テキストを決定する
	if (t.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) {
		icon = `<div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0"><i class="fas fa-scale-balanced text-primary"></i></div>`;
		primaryText = "残高調整";
		secondaryText = account?.name || "不明な口座";
	} else if (t.type === "transfer") {
		icon = `<div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0"><i class="fas fa-exchange-alt text-primary"></i></div>`;
		primaryText = t.description || "振替";
		secondaryText = `${fromAccount?.name || "不明"} → ${
			toAccount?.name || "不明"
		}`;
	} else {
		const accountName = account?.name || "不明";
		const categoryName = category?.name || "カテゴリなし";
		const iconClass =
			category?.type === "income"
				? "fa-arrow-up text-success"
				: "fa-arrow-down text-danger";
		const iconBg =
			category?.type === "income" ? "bg-success-light" : "bg-danger-light";

		icon = `<div class="w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0"><i class="fas ${iconClass}"></i></div>`;
		primaryText = utils.escapeHtml(t.description || categoryName);
		secondaryText = utils.escapeHtml(
			t.description ? `${categoryName} / ${accountName}` : accountName
		);
	}

	const amountHtml = createAmountElement(t.amount, t.type, isMasked);
	div.innerHTML = `
        <div class="flex-grow min-w-0 flex items-center space-x-4">
            ${icon}
            <div class="min-w-0">
                <p class="font-medium text-neutral-900 truncate">${primaryText}</p>
                <p class="text-sm text-neutral-600 truncate">${secondaryText}</p>
            </div>
        </div>
        ${amountHtml}
    `;
	return div;
}

/**
 * フィルタリングされた取引リストを日付ごとにグループ化して描画する。
 * 日付ヘッダーを挿入し、その下に取引リストを表示する。
 * @param {Array<object>} transactions - 描画する取引データの配列。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @returns {void}
 */
export function render(transactions, isMasked) {
	const { noTransactionsMessage, list } = getElements();
	utils.dom.toggle(noTransactionsMessage, transactions.length === 0);
	utils.dom.setHtml(list, "");

	// 取引を日付文字列でグループ化する
	const grouped = transactions.reduce((acc, t) => {
		const dateStr = utils.formatDateWithWeekday(t.date);
		if (!acc[dateStr]) acc[dateStr] = [];
		acc[dateStr].push(t);
		return acc;
	}, {});
	const sortedDates = Object.keys(grouped).sort(
		(a, b) => new Date(b) - new Date(a)
	);

	for (const dateStr of sortedDates) {
		const dailyTransactions = grouped[dateStr];
		const dateHeader = document.createElement("h3");
		dateHeader.className =
			"text-lg font-semibold text-neutral-600 mt-4 mb-2 sticky top-0 bg-neutral-50 py-2";
		dateHeader.textContent = dateStr;
		list.appendChild(dateHeader);
		dailyTransactions.forEach((t) =>
			list.appendChild(createTransactionElement(t, isMasked))
		);
	}
}

/**
 * 現在のフィルター条件に基づいて取引リストをフィルタリングする。
 * 種別、カテゴリ、支払方法、検索語で絞り込みを行う。
 * @param {Array<object>} transactions - フィルタリング対象の取引データ配列。
 * @returns {Array<object>} フィルタリング後の取引データ配列。
 */
export function applyFilters(transactions) {
	let filtered = [...transactions];
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

	// 初期状態では全カテゴリを表示
	updateCategoryFilterOptions("all");
}
