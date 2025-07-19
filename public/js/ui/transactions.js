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

function updateCategoryFilter(type = "all") {
	let options = [];
	if (type === "income") {
		options = appConfig.incomeCategories;
	} else if (type === "expense") {
		options = appConfig.expenseCategories;
	} else {
		options = [
			...new Set([
				...appConfig.incomeCategories,
				...appConfig.expenseCategories,
			]),
		].sort();
	}
	elements.categoryFilter.innerHTML = [
		'<option value="all">すべてのカテゴリ</option>',
		...options.map((c) => `<option value="${c}">${c}</option>`),
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
	updateCategoryFilter("all"); // カテゴリもリセット
	elements.paymentMethodFilter.value = "all";
	elements.searchInput.value = "";
	elements.categoryFilter.disabled = true;
	onFilterChangeCallback();
}

function populateFilterDropdowns() {
	const allAccounts = [...appLuts.accounts.values()].filter(
		(a) => !a.isDeleted
	);
	const allCategories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted && !c.isSystemCategory
	);

	const createOptions = (items) =>
		items
			.map((item) => `<option value="${item.id}">${item.name}</option>`)
			.join("");

	elements.typeFilter.innerHTML = [
		'<option value="all">すべての取引</option>',
		'<option value="income">収入</option>',
		'<option value="expense">支出</option>',
		'<option value="transfer">振替</option>',
	].join("");

	elements.categoryFilter.innerHTML = [
		'<option value="all">すべてのカテゴリ</option>',
		createOptions(allCategories.sort((a, b) => a.name.localeCompare(b.name))),
	].join("");

	elements.paymentMethodFilter.innerHTML = [
		'<option value="all">すべての支払方法</option>',
		createOptions(allAccounts.sort((a, b) => a.name.localeCompare(b.name))),
	].join("");
}

function createTransactionElement(t, isMasked) {
	const div = document.createElement("div");
	div.className =
		"bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4 cursor-pointer hover:shadow-md transition hover-lift";
	div.dataset.id = t.id;

	let icon, primaryText, secondaryText;

	// IDから名前をルックアップ
	const category = appLuts.categories.get(t.categoryId);
	const account = appLuts.accounts.get(t.accountId);
	const fromAccount = appLuts.accounts.get(t.fromAccountId);
	const toAccount = appLuts.accounts.get(t.toAccountId);

	if (category && category.name === "初期残高設定") {
		icon = `<div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0"><i class="fas fa-flag text-yellow-500"></i></div>`;
		primaryText = `${account?.name || toAccount?.name} の初期残高設定`;
		secondaryText = t.description || "開始残高";
	} else if (t.type === "transfer") {
		icon = `<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><i class="fas fa-exchange-alt text-blue-500"></i></div>`;
		primaryText = t.description || "振替";
		secondaryText = `${fromAccount?.name} → ${toAccount?.name}`;
	} else {
		icon =
			t.type === "income"
				? `<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"><i class="fas fa-arrow-up text-green-500"></i></div>`
				: `<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><i class="fas fa-arrow-down text-red-500"></i></div>`;
		primaryText = t.description || category?.name || "カテゴリなし";
		secondaryText = t.description
			? `${category?.name} / ${account?.name}`
			: account?.name || "口座なし";
	}

	const amountHtml =
		t.type === "expense"
			? `<p class="font-semibold text-red-600 text-lg whitespace-nowrap">- ${utils.formatCurrency(
					t.amount,
					isMasked
			  )}</p>`
			: t.type === "income"
			? `<p class="font-semibold text-green-600 text-lg whitespace-nowrap">+ ${utils.formatCurrency(
					t.amount,
					isMasked
			  )}</p>`
			: `<p class="font-semibold text-gray-700 text-lg whitespace-nowrap">${utils.formatCurrency(
					t.amount,
					isMasked
			  )}</p>`;
	div.innerHTML = `<div class="flex-grow min-w-0 flex items-center space-x-4">${icon}<div class="min-w-0"><p class="font-medium truncate">${primaryText}</p><p class="text-sm text-gray-500 truncate">${secondaryText}</p></div></div>${amountHtml}`;
	return div;
}

export function init(onFilterChange, luts) {
	onFilterChangeCallback = onFilterChange;
	appLuts = luts;

	elements.typeFilter.addEventListener("change", (e) => {
		const selectedType = e.target.value;

		if (selectedType === "income" || selectedType === "expense") {
			// 「収入」または「支出」が選ばれたら、カテゴリを有効化
			elements.categoryFilter.disabled = false;
		} else {
			// 「すべて」や「振替」が選ばれたら、カテゴリを無効化
			elements.categoryFilter.disabled = true;
		}

		updateCategoryFilter(selectedType);
		currentFilters.category = "all";
		handleFilterChange("type", selectedType);
	});

	elements.categoryFilter.addEventListener("change", (e) => {
		handleFilterChange("category", e.target.value);
	});
	elements.paymentMethodFilter.addEventListener("change", (e) => {
		handleFilterChange("paymentMethod", e.target.value);
	});
	elements.searchInput.addEventListener("input", (e) => {
		handleFilterChange("searchTerm", e.target.value);
	});
	elements.resetFiltersButton.addEventListener("click", resetFilters);

	populateFilterDropdowns();

	elements.categoryFilter.disabled = true;
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
			// IDから名前をルックアップして検索対象に加える
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
