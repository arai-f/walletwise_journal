import * as utils from "../utils.js";

const elements = {
	list: document.getElementById("transactions-list"),
	noTransactionsMessage: document.getElementById("no-transactions-message"),
	typeFilter: document.getElementById("type-filter"),
	categoryFilter: document.getElementById("category-filter"),
	paymentMethodFilter: document.getElementById("payment-method-filter"),
	searchInput: document.getElementById("search-input"),
	resetFiltersButton: document.getElementById("reset-filters-button"),
};

let currentFilters = {
	type: "all",
	category: "all",
	paymentMethod: "all",
	searchTerm: "",
};
let onFilterChangeCallback = () => {};
let appLuts = {};

export function init(onFilterChange, luts) {
	onFilterChangeCallback = onFilterChange;
	appLuts = luts;

	elements.typeFilter.addEventListener("change", (e) => {
		const selectedType = e.target.value;
		// 選択に応じてカテゴリフィルターを有効/無効化
		elements.categoryFilter.disabled = !(
			selectedType === "income" || selectedType === "expense"
		);
		// カテゴリの選択肢を更新
		updateCategoryFilterOptions(selectedType);
		// フィルターを適用
		handleFilterChange("type", selectedType);
	});

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

	// 検索ボックスでEscキーを押したときの処理
	elements.searchInput.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			e.target.value = "";
			handleFilterChange("searchTerm", "");
		}
	});

	populateFilterDropdowns();
	elements.categoryFilter.disabled = true; // 初期状態では無効
}

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

function handleFilterChange(type, value) {
	currentFilters[type] = value;
	onFilterChangeCallback();
}

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

	// カテゴリフィルターをリセットして無効化
	updateCategoryFilterOptions("all");
	elements.categoryFilter.value = "all";
	elements.categoryFilter.disabled = true;

	onFilterChangeCallback();
}

function populateFilterDropdowns() {
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

function createTransactionElement(t, isMasked) {
	const div = document.createElement("div");
	div.className =
		"bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4 cursor-pointer hover:shadow-md transition hover-lift";
	div.dataset.id = t.id;

	let icon, primaryText, secondaryText;

	const category = appLuts.categories.get(t.categoryId);
	const account = appLuts.accounts.get(t.accountId);
	const fromAccount = appLuts.accounts.get(t.fromAccountId);
	const toAccount = appLuts.accounts.get(t.toAccountId);

	if (t.categoryId === "SYSTEM_BALANCE_ADJUSTMENT") {
		icon = `<div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><i class="fas fa-scale-balanced text-indigo-500"></i></div>`;
		primaryText = "残高調整";
		secondaryText = account?.name || "不明な口座";
	} else if (t.type === "transfer") {
		icon = `<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><i class="fas fa-exchange-alt text-blue-500"></i></div>`;
		primaryText = t.description || "振替";
		secondaryText = `${fromAccount?.name || "不明"} → ${
			toAccount?.name || "不明"
		}`;
	} else {
		const accountName = account?.name || "不明";
		const categoryName = category?.name || "カテゴリなし";
		const iconClass =
			category?.type === "income"
				? "fa-arrow-up text-green-500"
				: "fa-arrow-down text-red-500";
		const iconBg = category?.type === "income" ? "bg-green-100" : "bg-red-100";

		icon = `<div class="w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0"><i class="fas ${iconClass}"></i></div>`;
		primaryText = t.description || categoryName;
		secondaryText = t.description
			? `${categoryName} / ${accountName}`
			: accountName;
	}

	const amountHtml = utils.formatCurrency(t.amount, isMasked, t.type); // typeに応じて+/-を付与するヘルパーを想定
	div.innerHTML = `<div class="flex-grow min-w-0 flex items-center space-x-4">${icon}<div class="min-w-0"><p class="font-medium truncate">${primaryText}</p><p class="text-sm text-gray-500 truncate">${secondaryText}</p></div></div>${amountHtml}`;
	return div;
}

export function render(transactions, isMasked) {
	elements.noTransactionsMessage.classList.toggle(
		"hidden",
		transactions.length > 0
	);
	elements.list.innerHTML = "";
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

	for (const [dateStr, dailyTransactions] of Object.entries(grouped)) {
		const dateHeader = document.createElement("h3");
		dateHeader.className =
			"text-lg font-semibold text-gray-600 mt-4 mb-2 sticky top-0 bg-gray-50 py-2";
		dateHeader.textContent = dateStr;
		elements.list.appendChild(dateHeader);
		dailyTransactions.forEach((t) =>
			elements.list.appendChild(createTransactionElement(t, isMasked))
		);
	}
}

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
