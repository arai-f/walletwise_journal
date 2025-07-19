const elements = {
	modal: document.getElementById("settings-modal"),
	// ヘッダー
	header: document.getElementById("settings-header"),
	title: document.getElementById("settings-title"),
	backButton: document.getElementById("settings-back-button"),
	closeButton: document.getElementById("close-settings-modal-button"),
	// コンテンツ
	menu: document.getElementById("settings-menu"),
	panes: document.querySelectorAll(".settings-tab-pane"),
	// 一般設定
	displayPeriodSelector: document.getElementById("display-period-selector"),
	saveGeneralSettingsButton: document.getElementById(
		"save-general-settings-button"
	),
	// 口座
	assetsList: document.getElementById("assets-list"),
	liabilitiesList: document.getElementById("liabilities-list"),
	addAssetButton: document.getElementById("add-asset-button"),
	addLiabilityButton: document.getElementById("add-liability-button"),
	// カテゴリ
	incomeCategoriesList: document.getElementById("income-categories-list"),
	expenseCategoriesList: document.getElementById("expense-categories-list"),
	newIncomeCategoryInput: document.getElementById("new-income-category-input"),
	newExpenseCategoryInput: document.getElementById(
		"new-expense-category-input"
	),
	addIncomeCategoryButton: document.getElementById(
		"add-income-category-button"
	),
	addExpenseCategoryButton: document.getElementById(
		"add-expense-category-button"
	),
	// 残高調整
	balanceAdjustmentList: document.getElementById("balance-adjustment-list"),
	// アイコンピッカー
	iconPickerModal: document.getElementById("icon-picker-modal"),
	iconPickerGrid: document.getElementById("icon-picker-grid"),
};

const PROTECTED_DEFAULTS = ["受取・その他入金", "その他支出"];
const availableIcons = [
	"fa-solid fa-wallet",
	"fa-solid fa-building-columns",
	"fa-solid fa-credit-card",
	"fa-solid fa-money-bill-wave",
	"fa-solid fa-plane",
	"fa-solid fa-train",
	"fa-solid fa-bus",
	"fa-solid fa-car",
	"fa-solid fa-gas-pump",
	"fa-solid fa-store",
	"fa-solid fa-receipt",
	"fa-solid fa-chart-line",
	"fa-solid fa-piggy-bank",
	"fa-solid fa-gift",
	"fa-solid fa-graduation-cap",
	"fa-solid fa-heart",
	"fa-brands fa-paypal",
	"fa-brands fa-cc-visa",
	"fa-brands fa-cc-jcb",
	"fa-brands fa-cc-mastercard",
	"fa-brands fa-cc-amex",
	"fa-brands fa-apple-pay",
	"fa-brands fa-google-pay",
	"fa-brands fa-amazon-pay",
];

let onIconSelectCallback = () => {};
let handlers = {};
let appLuts = {};
let sortableAssets = null;
let sortableLiabilities = null;
let sortableIncome = null;
let sortableExpense = null;

export function init(initHandlers, luts) {
	handlers = initHandlers;
	appLuts = luts;

	elements.closeButton.addEventListener("click", closeModal);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) closeModal();
	});
	elements.menu.addEventListener("click", (e) => {
		e.preventDefault();
		const link = e.target.closest(".settings-menu-link");
		if (link) navigateTo(link.getAttribute("href"));
	});
	elements.backButton.addEventListener("click", () =>
		navigateTo("#settings-menu")
	);

	// 一般設定
	elements.saveGeneralSettingsButton.addEventListener("click", () => {
		const newPeriod = Number(elements.displayPeriodSelector.value);
		handlers.onUpdateDisplayPeriod(newPeriod);
	});

	// 口座追加
	elements.addAssetButton.addEventListener("click", () => {
		createInlineInput(elements.assetsList, "assets", "新しい資産口座名");
	});
	elements.addLiabilityButton.addEventListener("click", () => {
		createInlineInput(
			elements.liabilitiesList,
			"liabilities",
			"新しい負債口座名"
		);
	});

	// カテゴリ追加
	elements.addIncomeCategoryButton.addEventListener("click", () => {
		createInlineInput(
			elements.incomeCategoriesList,
			"incomeCategories",
			"新しい収入カテゴリ名"
		);
	});
	elements.addExpenseCategoryButton.addEventListener("click", () => {
		createInlineInput(
			elements.expenseCategoriesList,
			"expenseCategories",
			"新しい支出カテゴリ名"
		);
	});

	// アイコンピッカー
	elements.iconPickerModal.addEventListener("click", (e) => {
		const button = e.target.closest(".icon-picker-button");
		if (button) {
			onIconSelectCallback(button.dataset.icon);
		}
		elements.iconPickerModal.classList.add("hidden");
	});
	window.addEventListener("keydown", (e) => {
		if (
			e.key === "Escape" &&
			!elements.iconPickerModal.classList.contains("hidden")
		) {
			elements.iconPickerModal.classList.add("hidden");
		} else if (
			e.key === "Escape" &&
			!elements.modal.classList.contains("hidden")
		) {
			closeModal();
		}
	});

	// イベント委譲
	elements.modal.addEventListener("click", handleRemoveItem);
	elements.modal.addEventListener("click", handleAdjustBalance);
	elements.modal.addEventListener("click", handleChangeIcon);
}

function openIconPicker(callback) {
	onIconSelectCallback = callback;
	elements.iconPickerGrid.innerHTML = availableIcons
		.map(
			(iconClass) => `
        <button class="p-3 rounded-lg hover:bg-gray-200 text-2xl flex items-center justify-center icon-picker-button" data-icon="${iconClass}">
            <i class="${iconClass}"></i>
        </button>
    `
		)
		.join("");
	elements.iconPickerModal.classList.remove("hidden");
}

function navigateTo(paneId) {
	if (paneId === "#settings-menu") {
		elements.menu.classList.remove("hidden");
		elements.panes.forEach((p) => p.classList.add("hidden"));
		elements.backButton.classList.add("hidden");
		elements.title.textContent = "設定";
	} else {
		elements.menu.classList.add("hidden");
		elements.panes.forEach((p) => {
			const isTarget = `#${p.id}` === paneId;
			p.classList.toggle("hidden", !isTarget);
			if (isTarget) {
				elements.title.textContent = document.querySelector(
					`a[href="${paneId}"]`
				).textContent;
			}
		});
		elements.backButton.classList.remove("hidden");
	}
}

function renderList(listElement, items, itemType, constraints) {
	const sortedItems = [...items].sort(
		(a, b) => (a.order || 0) - (b.order || 0)
	);

	listElement.innerHTML = sortedItems
		.map((item) => {
			let isDeletable = true;
			let tooltip = "";

			if (itemType === "account") {
				const balance = constraints.accountBalances[item.name] || 0;
				if (balance !== 0) {
					isDeletable = false;
					tooltip = `残高がゼロではありません (¥${balance.toLocaleString()})。`;
				}
			} else {
				const isProtected = PROTECTED_DEFAULTS.includes(item.name);
				if (isProtected) {
					isDeletable = false;
					tooltip = "このカテゴリは削除できません。";
				}
			}

			const iconHtml =
				itemType === "account"
					? `<button class="p-2 mr-3 rounded-lg hover:bg-gray-200 change-icon-button" data-item-id="${
							item.id
					  }">
                   <i class="${item.icon || "fa-solid fa-question"}"></i>
               </button>`
					: "";

			return `
            <div class="flex items-center justify-between p-2 rounded-md bg-gray-100" data-id="${
							item.id
						}">
                <div class="flex items-center">
                    <i class="fas fa-grip-vertical text-gray-400 mr-3 cursor-move"></i>
                    ${iconHtml}
                    <span class="${
											!isDeletable ? "text-gray-500" : ""
										}" title="${tooltip}">${item.name}</span>
                </div>
                ${
									isDeletable
										? `<button class="text-red-500 hover:text-red-700 remove-item-button" data-item-id="${item.id}" data-item-name="${item.name}" data-item-type="${itemType}">
                     <i class="fas fa-trash-alt pointer-events-none"></i>
                   </button>`
										: `<i class="fas fa-lock text-gray-400" title="${tooltip}"></i>`
								}
            </div>`;
		})
		.join("");
}

function renderBalanceAdjustmentList(accounts, balances) {
	const sortedAccounts = accounts.sort((a, b) => a.order - b.order);

	elements.balanceAdjustmentList.innerHTML = sortedAccounts
		.map(
			(account) => `
        <div class="flex flex-col md:grid md:grid-cols-5 md:items-center gap-2 md:gap-4 p-3 rounded-md bg-gray-50">
            <span class="font-medium md:col-span-2">${account.name}</span>
            <div class="flex items-center gap-2 w-full md:col-span-3">
                <input
                    type="number"
                    class="w-full border-gray-300 rounded-lg p-2 text-right"
                    placeholder="現在の残高: ¥${(
											balances[account.id] || 0
										).toLocaleString()}"
                    data-current-balance="${balances[account.id] || 0}"
                >
                <button class="adjust-balance-button bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 shrink-0">調整</button>
            </div>
        </div>`
		)
		.join("");
}

export function render() {
	const constraints = handlers.getUsedItems();
	const accounts = [...appLuts.accounts.values()].filter((a) => !a.isDeleted);
	const categories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted
	);

	renderList(
		elements.assetsList,
		accounts.filter((a) => a.type === "asset"),
		"account",
		constraints
	);
	renderList(
		elements.liabilitiesList,
		accounts.filter((a) => a.type === "liability"),
		"account",
		constraints
	);
	renderList(
		elements.incomeCategoriesList,
		categories.filter((c) => c.type === "income"),
		"category",
		constraints
	);
	renderList(
		elements.expenseCategoriesList,
		categories.filter((c) => c.type === "expense"),
		"category",
		constraints
	);
	renderBalanceAdjustmentList(
		accounts.filter((a) => a.type === "asset"),
		constraints.accountBalances
	);
}

async function addListItem(type, newItemName) {
	if (!newItemName || newItemName.trim() === "") {
		alert("項目名を入力してください。");
		return;
	}
	try {
		await handlers.onAddItem({ type, name: newItemName.trim() });
	} catch (e) {
		alert(`追加中にエラーが発生しました: ${e.message}`);
	}
}

function createInlineInput(listElement, listName, placeholder) {
	// 既存の入力欄があれば削除
	const existingInput = listElement.querySelector(".inline-input-wrapper");
	if (existingInput) existingInput.remove();

	const inputWrapper = document.createElement("div");
	inputWrapper.className =
		"inline-input-wrapper flex items-center gap-2 p-2 rounded-md bg-gray-100";
	inputWrapper.innerHTML = `
        <input type="text" class="flex-grow border-gray-300 rounded-lg p-1" placeholder="${placeholder}">
        <button class="save-inline-button text-green-600 hover:text-green-800">✓</button>
        <button class="cancel-inline-button text-red-600 hover:text-red-800">×</button>
    `;

	listElement.appendChild(inputWrapper);
	const inputField = inputWrapper.querySelector("input");
	inputField.focus();

	inputWrapper.querySelector(".save-inline-button").onclick = () => {
		addListItem(listName, inputField.value);
		inputWrapper.remove();
	};
	inputWrapper.querySelector(".cancel-inline-button").onclick = () => {
		inputWrapper.remove();
	};
	inputField.onkeydown = (e) => {
		if (e.key === "Enter") addListItem(listName, inputField.value);
		if (e.key === "Escape") inputWrapper.remove();
	};
}

async function handleRemoveItem(e) {
	const button = e.target.closest(".remove-item-button");
	if (!button) return;

	const { itemId, itemName, itemType } = button.dataset;

	if (itemType === "account") {
		if (
			confirm(
				`口座「${itemName}」を本当に削除しますか？\n（取引履歴は消えません）`
			)
		) {
			await handlers.onDeleteItem(itemId, "account");
		}
	} else if (itemType === "category") {
		const category = appLuts.categories.get(itemId);
		const targetName =
			category?.type === "income" ? "受取・その他入金" : "その他支出";
		if (
			confirm(
				`カテゴリ「${itemName}」を削除しますか？\nこのカテゴリの既存の取引はすべて「${targetName}」に振り替えられます。`
			)
		) {
			await handlers.onRemapCategory(itemId, targetName);
		}
	}
}

async function handleAdjustBalance(e) {
	const button = e.target.closest(".adjust-balance-button");
	if (!button) return;

	const input = button.previousElementSibling;
	const { accountId, currentBalance } = input.dataset;
	const actualBalance = parseFloat(input.value);

	if (isNaN(actualBalance)) return alert("数値を入力してください。");

	const difference = actualBalance - parseFloat(currentBalance);
	if (difference === 0) return alert("残高に差がないため、調整は不要です。");

	const accountName = appLuts.accounts.get(accountId)?.name || "不明な口座";
	if (
		confirm(
			`「${accountName}」の残高を ¥${difference.toLocaleString()} 調整しますか？`
		)
	) {
		await handlers.onAdjustBalance(accountId, difference);
		// main.js側で再描画が走るので、ここでは何もしない
	}
}

async function handleChangeIcon(e) {
	const button = e.target.closest(".change-icon-button");
	if (!button) return;
	const accountId = button.dataset.itemId;

	openIconPicker(async (selectedIcon) => {
		try {
			await handlers.onUpdateItem(accountId, { icon: selectedIcon });
			alert("アイコンを変更しました。");
		} catch (error) {
			alert("アイコンの変更に失敗しました。");
		}
	});
}

function initializeSortable() {
	const createSortable = (element, handler) => {
		return new Sortable(element, {
			animation: 150,
			handle: ".fa-grip-vertical",
			onUpdate: () => {
				const orderedIds = [...element.children].map(
					(child) => child.dataset.id
				);
				handler(orderedIds);
			},
		});
	};

	if (sortableAssets) sortableAssets.destroy();
	sortableAssets = createSortable(
		elements.assetsList,
		handlers.onUpdateAccountOrder
	);

	if (sortableLiabilities) sortableLiabilities.destroy();
	sortableLiabilities = createSortable(
		elements.liabilitiesList,
		handlers.onUpdateAccountOrder
	);

	if (sortableIncome) sortableIncome.destroy();
	sortableIncome = createSortable(
		elements.incomeCategoriesList,
		handlers.onUpdateCategoryOrder
	);

	if (sortableExpense) sortableExpense.destroy();
	sortableExpense = createSortable(
		elements.expenseCategoriesList,
		handlers.onUpdateCategoryOrder
	);
}

export function openModal() {
	render();
	navigateTo("#settings-menu");
	initializeSortable();
	elements.displayPeriodSelector.value = handlers.getInitialDisplayPeriod();
	elements.modal.classList.remove("hidden");
}

export function closeModal() {
	elements.modal.classList.add("hidden");
	setTimeout(() => navigateTo("#settings-menu"), 200);
}
