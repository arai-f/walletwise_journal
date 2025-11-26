import * as utils from "../utils.js";

/**
 * 取引タブのUI要素をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	list: document.getElementById("transactions-list"),
	noTransactionsMessage: document.getElementById("no-transactions-message"),
	typeFilter: document.getElementById("type-filter"),
	categoryFilter: document.getElementById("category-filter"),
	paymentMethodFilter: document.getElementById("payment-method-filter"),
	searchInput: document.getElementById("search-input"),
	resetFiltersButton: document.getElementById("reset-filters-button"),
};

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
let onFilterChangeCallback = () => {};
let appLuts = {};

/**
 * 取引モジュールを初期化する。
 * @param {function} onFilterChange - フィルターが変更されたときに呼び出されるコールバック関数。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 */
export function init(onFilterChange, luts) {
	onFilterChangeCallback = onFilterChange;
	appLuts = luts;

	elements.typeFilter.addEventListener("change", (e) => {
		const selectedType = e.target.value;
		// 取引種別に応じてカテゴリフィルターを有効/無効化する
		elements.categoryFilter.disabled = !(
			selectedType === "income" || selectedType === "expense"
		);
		// カテゴリの選択肢を動的に更新する
		updateCategoryFilterOptions(selectedType);
		handleFilterChange("type", selectedType);
	});

	// 各フィルターの変更イベント
	elements.categoryFilter.addEventListener("change", (e) =>
		handleFilterChange("category", e.target.value)
	);
	elements.paymentMethodFilter.addEventListener("change", (e) =>
		handleFilterChange("paymentMethod", e.target.value)
	);
	elements.searchInput.addEventListener("input", (e) =>
		handleFilterChange("searchTerm", e.target.value)
	);
	elements.resetFiltersButton.addEventListener("click", resetFilters);

	// 検索ボックスでEscapeキーを押すと検索語をクリアする
	elements.searchInput.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			e.target.value = "";
			handleFilterChange("searchTerm", "");
		}
	});

	populateFilterDropdowns();
	elements.categoryFilter.disabled = true; // 初期状態では無効
}

/**
 * select要素のoptionを生成するヘルパー関数。
 * @private
 * @param {Array<object>} items - optionに変換する項目の配列。
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
 * @private
 * @param {string} [type="all"] - 選択された取引種別。
 */
function updateCategoryFilterOptions(type = "all") {
	const allCategories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted
	);
	let options = [];

	if (type === "income" || type === "expense") {
		options = allCategories.filter((c) => c.type === type);
	} else {
		options = allCategories;
	}

	elements.categoryFilter.innerHTML = [
		'<option value="all">すべてのカテゴリ</option>',
		createOptions(
			options.sort(
				(a, b) =>
					(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
			)
		),
	].join("");
}

/**
 * フィルター条件が変更されたときにstateを更新し、再描画をトリガーする。
 * @private
 * @param {string} type - 変更されたフィルターの種類。
 * @param {string} value - 新しいフィルターの値。
 */
function handleFilterChange(type, value) {
	currentFilters[type] = value;
	onFilterChangeCallback();
}

/**
 * すべてのフィルターを初期状態にリセットする。
 */
function resetFilters() {
	currentFilters = {
		type: "all",
		category: "all",
		paymentMethod: "all",
		searchTerm: "",
	};
	elements.typeFilter.value = "all";
	elements.paymentMethodFilter.value = "all";
	elements.searchInput.value = "";

	// カテゴリフィルターをリセットし、無効化状態に戻す
	updateCategoryFilterOptions("all");
	elements.categoryFilter.value = "all";
	elements.categoryFilter.disabled = true;

	onFilterChangeCallback();
}

/**
 * 取引の金額要素を生成する。
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
	if (t.categoryId === "SYSTEM_BALANCE_ADJUSTMENT") {
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
 * @param {Array<object>} transactions - 描画する取引データの配列。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 */
export function render(transactions, isMasked) {
	elements.noTransactionsMessage.classList.toggle(
		"hidden",
		transactions.length > 0
	);
	elements.list.innerHTML = "";

	// 取引を日付文字列でグループ化する
	const grouped = transactions.reduce((acc, t) => {
		const dateStr = new Date(t.date).toLocaleDateString("ja-JP", {
			year: "numeric",
			month: "long",
			day: "numeric",
			weekday: "short",
		});
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
		elements.list.appendChild(dateHeader);
		dailyTransactions.forEach((t) =>
			elements.list.appendChild(createTransactionElement(t, isMasked))
		);
	}
}

/**
 * 現在のフィルター条件に基づいて取引リストをフィルタリングする。
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
 */
export function populateFilterDropdowns() {
	const allAccounts = [...appLuts.accounts.values()].filter(
		(a) => !a.isDeleted
	);

	elements.typeFilter.innerHTML = [
		'<option value="all">すべての取引</option>',
		'<option value="income">収入</option>',
		'<option value="expense">支出</option>',
		'<option value="transfer">振替</option>',
	].join("");
	elements.paymentMethodFilter.innerHTML = [
		'<option value="all">すべての支払方法</option>',
		createOptions(allAccounts),
	].join("");

	// 初期状態では全カテゴリを表示
	updateCategoryFilterOptions("all");
}
