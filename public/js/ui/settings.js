import * as utils from "../utils.js";

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
	// クレジットカード設定
	creditCardRulesContainer: document.getElementById(
		"credit-card-rules-container"
	),
	addCardRuleButton: document.getElementById("add-card-rule-button"),
};

const PROTECTED_DEFAULTS = ["その他収入", "その他支出"];
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
let appConfig = {};
let sortableAssets = null;
let sortableLiabilities = null;
let sortableIncome = null;
let sortableExpense = null;
let isEditingState = false;

export function init(initHandlers) {
	handlers = initHandlers;

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
		createInlineInput(elements.assetsList, "asset", "新しい資産口座名");
	});
	elements.addLiabilityButton.addEventListener("click", () => {
		createInlineInput(
			elements.liabilitiesList,
			"liability",
			"新しい負債口座名"
		);
	});

	// カテゴリ追加
	elements.addIncomeCategoryButton.addEventListener("click", () => {
		createInlineInput(
			elements.incomeCategoriesList,
			"income",
			"新しい収入カテゴリ名"
		);
	});
	elements.addExpenseCategoryButton.addEventListener("click", () => {
		createInlineInput(
			elements.expenseCategoriesList,
			"expense",
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

	// クレジットカード設定
	elements.addCardRuleButton.addEventListener("click", () =>
		renderCardRuleForm()
	);
	elements.creditCardRulesContainer.addEventListener("click", (e) => {
		const editBtn = e.target.closest(".edit-card-rule-button");
		const deleteBtn = e.target.closest(".delete-card-rule-button");

		if (editBtn) renderCardRuleForm(editBtn.dataset.cardId);
		if (deleteBtn) {
			const cardId = deleteBtn.dataset.cardId;
			if (confirm(`「${cardId}」のルールを本当に削除しますか？`)) {
				handlers.onDeleteCardRule(cardId);
			}
		}
	});

	// キー操作
	document.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			if (e.target.closest("#balance-adjustment-list")) {
				// 残高調整の入力欄でEnterを押した場合
				e.target.nextElementSibling?.click(); // 隣の「調整」ボタンをクリック
			}
		}
		if (e.key === "Escape") {
			if (!elements.iconPickerModal.classList.contains("hidden")) {
				elements.iconPickerModal.classList.add("hidden");
				return;
			}
			if (!isEditingState) {
				closeModal();
			}

			isEditingState = false;
		}
	});

	// イベント委譲
	elements.modal.addEventListener("click", (e) => {
		handleEditItem(e);
		handleRemoveItem(e);
		handleAdjustBalance(e);
		handleChangeIcon(e);
	});
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
			let isEditable = true;
			let isDeletable = true;
			let tooltip = "";

			if (itemType === "account") {
				const balance = constraints.accountBalances[item.id] || 0;
				if (balance !== 0) {
					isDeletable = false;
					tooltip = `残高がゼロではありません (¥${utils.formatCurrency(
						balance
					)})。`;
				}
			} else {
				const isProtected = PROTECTED_DEFAULTS.includes(item.name);
				if (isProtected) {
					isEditable = false;
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
                    <i class="fas fa-grip-vertical text-gray-400 mr-3 cursor-move handle"></i>
                    ${iconHtml}
                    <div class="item-name-wrapper flex-grow">
                        <span class="item-name p-1">${item.name}</span>
                        <input type="text" class="item-name-input hidden border rounded p-1 w-full" value="${
													item.name
												}">
                    </div>
                </div>
                <div class="flex items-center">
					${
						isEditable
							? `<button class="text-blue-600 hover:text-blue-800 px-2 edit-item-button"><i class="fas fa-pen"></i></button>`
							: ""
					}
					${
						isDeletable
							? `<button class="text-red-500 hover:text-red-700 remove-item-button" data-item-id="${item.id}" data-item-name="${item.name}" data-item-type="${itemType}">
						<i class="fas fa-trash-alt pointer-events-none"></i>
					</button>`
							: `<i class="fas fa-lock text-gray-400" title="${tooltip}"></i>`
					}
				</div>
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
                    data-account-id="${account.id}" data-current-balance="${
				balances[account.id] || 0
			}"
                >
                <button class="adjust-balance-button bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 shrink-0">調整</button>
            </div>
        </div>`
		)
		.join("");
}

function renderCreditCardRulesList() {
	const rules = appConfig.creditCardRules || {};
	const liabilityAccounts = [...appLuts.accounts.values()]
		.filter((acc) => acc.type === "liability" && !acc.isDeleted)
		.sort((a, b) => (a.order || 0) - (b.order || 0));
	const monthOffsetMap = { 1: "翌月", 2: "翌々月", 3: "3ヶ月後" };
	let html = "";

	const unconfiguredCards = liabilityAccounts.filter((acc) => !rules[acc.id]);

	for (const card of liabilityAccounts) {
		const rule = rules[card.id];
		if (!rule) continue;

		const paymentAccountName = appLuts.accounts.get(
			rule.defaultPaymentAccountId
		)?.name;
		const paymentTimingText = monthOffsetMap[rule.paymentMonthOffset] || "翌月";

		html += `
            <div class="p-3 rounded-md bg-gray-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-gray-800">${card.name}</h4>
                    <div>
                        <button class="text-blue-600 hover:text-blue-800 px-2 edit-card-rule-button" data-card-id="${
													card.id
												}"><i class="fas fa-pen pointer-events-none"></i></button>
                        <button class="text-red-500 hover:text-red-700 px-2 delete-card-rule-button" data-card-id="${
													card.id
												}"><i class="fas fa-trash-alt pointer-events-none"></i></button>
                    </div>
                </div>
                <div class="text-sm text-gray-600 mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>締め日:</span> <span class="font-medium">${
											rule.closingDay
										}日</span>
                    <span>支払日:</span> <span class="font-medium">${paymentTimingText} ${
			rule.paymentDay
		}日</span>
                    <span>支払元口座:</span> <span class="font-medium">${
											paymentAccountName || "未設定"
										}</span>
                </div>
            </div>`;
	}

	elements.creditCardRulesContainer.innerHTML = html;
	elements.addCardRuleButton.style.display =
		unconfiguredCards.length > 0 ? "block" : "none";
}

function renderCardRuleForm(cardIdToEdit = null) {
	const rules = appConfig.creditCardRules || {};
	const rule = cardIdToEdit ? rules[cardIdToEdit] : {};
	const isEditing = !!cardIdToEdit;
	isEditingState = true;

	const existingPanel = document.getElementById("card-rule-edit-panel");
	if (existingPanel) existingPanel.remove();

	const assetAccounts = [...appLuts.accounts.values()].filter(
		(a) => a.type === "asset" && !a.isDeleted
	);
	const sortedAssetAccounts = [...assetAccounts].sort(
		(a, b) => (a.order || 0) - (b.order || 0)
	);
	const assetOptionsHtml = sortedAssetAccounts
		.map((account, index) => {
			let isSelected = false;
			if (isEditing) {
				isSelected = account.id === rule.defaultPaymentAccountId;
			} else {
				isSelected = index === 0;
			}
			return `<option value="${account.id}" ${isSelected ? "selected" : ""}>${
				account.name
			}</option>`;
		})
		.join("");

	// 「追加」の場合、まだルールが設定されていない負債口座のみを選択肢にする
	const unconfiguredCards = [...appLuts.accounts.values()].filter(
		(acc) => acc.type === "liability" && !acc.isDeleted && !rules[acc.id]
	);
	const cardOptionsHtml = unconfiguredCards
		.map((c) => `<option value="${c.id}">${c.name}</option>`)
		.join("");

	const panel = document.createElement("div");
	panel.id = "card-rule-edit-panel";
	panel.className =
		"p-4 rounded-md border border-blue-300 bg-blue-50 space-y-4";
	panel.innerHTML = `
        <h4 class="font-bold text-lg">${
					isEditing
						? `「${appLuts.accounts.get(cardIdToEdit)?.name}」のルールを編集`
						: "新しい支払いルールを追加"
				}</h4>
        
        ${
					!isEditing
						? `
        <div class="grid grid-cols-3 items-center">
            <label for="card-rule-id" class="font-semibold text-gray-700">対象カード</label>
            <select id="card-rule-id" class="col-span-2 border-gray-300 rounded-lg p-2">${cardOptionsHtml}</select>
        </div>`
						: ""
				}

        <div class="grid grid-cols-3 items-center">
            <label for="card-rule-closing" class="font-semibold text-gray-700">締め日</label>
            <input type="number" id="card-rule-closing" class="col-span-2 border-gray-300 rounded-lg p-2" value="${
							rule.closingDay || 15
						}" min="1" max="31">
        </div>
        
        <div class="grid grid-cols-3 items-center">
            <label class="font-semibold text-gray-700">支払日</label>
            <div class="col-span-2 flex items-center gap-2">
                <select id="card-rule-payment-month" class="border-gray-300 rounded-lg p-2">
                    <option value="1" ${
											(rule.paymentMonthOffset || 1) === 1 ? "selected" : ""
										}>翌月</option>
                    <option value="2" ${
											rule.paymentMonthOffset === 2 ? "selected" : ""
										}>翌々月</option>
                    <option value="3" ${
											rule.paymentMonthOffset === 3 ? "selected" : ""
										}>3ヶ月後</option>
                </select>
                <input type="number" id="card-rule-payment-day" class="border-gray-300 rounded-lg p-2 w-full" value="${
									rule.paymentDay || 10
								}" min="1" max="31">
                <span class="font-medium text-gray-600">日</span>
            </div>
        </div>
        <div class="grid grid-cols-3 items-center">
            <label for="card-rule-account" class="font-semibold text-gray-700">支払元口座</label>
            <select id="card-rule-account" class="col-span-2 border-gray-300 rounded-lg p-2">${assetOptionsHtml}</select>
        </div>
        <div class="flex justify-end gap-3 pt-3 border-t">
            <button id="cancel-card-rule-button" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">キャンセル</button>
            <button id="save-card-rule-button" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">保存</button>
        </div>
    `;

	elements.creditCardRulesContainer.appendChild(panel);

	panel.querySelector("#cancel-card-rule-button").onclick = () =>
		panel.remove();
	panel.querySelector("#save-card-rule-button").onclick = async () => {
		const cardId = isEditing
			? cardIdToEdit
			: panel.querySelector("#card-rule-id").value;
		if (!cardId) return alert("対象カードを選択してください。");

		const ruleData = {
			closingDay: parseInt(panel.querySelector("#card-rule-closing").value, 10),
			paymentDay: parseInt(
				panel.querySelector("#card-rule-payment-day").value,
				10
			),
			paymentMonthOffset: parseInt(
				panel.querySelector("#card-rule-payment-month").value,
				10
			),
			defaultPaymentAccountId: panel.querySelector("#card-rule-account").value,
			lastPaidCycle: rule.lastPaidCycle || null,
		};

		await handlers.onUpdateCardRule(cardId, ruleData);
		panel.remove();
	};

	panel.onkeydown = (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			panel.querySelector("#save-card-rule-button").click();
		}
		if (e.key === "Escape") {
			e.preventDefault();
			panel.querySelector("#cancel-card-rule-button").click();
		}
	};
}

export function render(luts, config) {
	appLuts = luts;
	appConfig = config;

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
	renderCreditCardRulesList();
}

function createInlineInput(listElement, listName, placeholder) {
	// 既存の入力欄があれば削除
	const existingInput = listElement.querySelector(".inline-input-wrapper");
	if (existingInput) existingInput.remove();

	isEditingState = true;

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
		handleAddItem(listName, inputField.value);
		inputWrapper.remove();
	};
	inputWrapper.querySelector(".cancel-inline-button").onclick = () => {
		inputWrapper.remove();
	};
	inputField.onkeydown = (e) => {
		if (e.key === "Enter") handleAddItem(listName, inputField.value);
		if (e.key === "Escape") inputWrapper.remove();
	};
}

function toggleEditMode(wrapper, isEditing) {
	const nameSpan = wrapper.querySelector(".item-name");
	const nameInput = wrapper.querySelector(".item-name-input");
	const editButton = wrapper
		.closest(".flex.items-center.justify-between")
		.querySelector(".edit-item-button");
	const originalName = nameSpan.textContent;

	nameSpan.classList.toggle("hidden", isEditing);
	nameInput.classList.toggle("hidden", !isEditing);
	editButton.innerHTML = isEditing
		? '<i class="fas fa-check"></i>'
		: '<i class="fas fa-pen"></i>';

	if (isEditing) {
		nameInput.focus();
		nameInput.select();
		isEditingState = true;

		// 編集中のキーボードイベント
		nameInput.onkeydown = (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				editButton.click();
			}
			if (e.key === "Escape") {
				nameInput.value = originalName;
				toggleEditMode(wrapper, false);
			}
		};
	} else {
		nameInput.onkeydown = null; // イベントリスナーをクリア
	}
}

async function handleAddItem(type, name) {
	if (!name || name.trim() === "") {
		alert("項目名を入力してください。");
		return false;
	}

	// --- 重複チェック ---
	const allNames = [
		...[...appLuts.accounts.values()].map((a) => a.name),
		...[...appLuts.categories.values()].map((c) => c.name),
	];
	if (allNames.includes(name.trim())) {
		alert(`「${name}」という名前は既に使用されています。`);
		return false;
	}

	try {
		await handlers.onAddItem({ type, name: name.trim() });
		return true;
	} catch (e) {
		alert(`追加中にエラーが発生しました: ${e.message}`);
		return false;
	}
}

async function handleEditItem(e) {
	const button = e.target.closest(".edit-item-button");
	if (!button) return;

	const wrapper = button
		.closest(".flex.items-center.justify-between")
		.querySelector(".item-name-wrapper");
	const nameSpan = wrapper.querySelector(".item-name");
	const nameInput = wrapper.querySelector(".item-name-input");
	const itemId = button.closest("[data-id]").dataset.id;
	const itemType = appLuts.accounts.has(itemId) ? "account" : "category";

	if (PROTECTED_DEFAULTS.includes(nameSpan.textContent)) {
		alert("このカテゴリは編集できません。");
		return;
	}

	const isCurrentlyEditing =
		nameInput.style.display !== "none" &&
		!nameInput.classList.contains("hidden");

	if (isCurrentlyEditing) {
		// 保存ボタンとして機能
		const newName = nameInput.value.trim();
		const oldName = nameSpan.textContent;

		if (newName === oldName) {
			// 変更がなければ何もしない
			toggleEditMode(wrapper, false);
			return;
		}

		// --- 重複チェック ---
		const allNames = [
			...[...appLuts.accounts.values()].map((a) => a.name),
			...[...appLuts.categories.values()].map((c) => c.name),
		];
		if (allNames.includes(newName)) {
			alert(`「${newName}」という名前は既に使用されています。`);
			return;
		}

		try {
			await handlers.onUpdateItem(itemId, itemType, { name: newName });
			toggleEditMode(wrapper, false);
		} catch (error) {
			alert("名前の変更に失敗しました。");
		}
	} else {
		// 編集モードを開始
		toggleEditMode(wrapper, true);
	}
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
			category?.type === "income"
				? PROTECTED_DEFAULTS[0]
				: PROTECTED_DEFAULTS[1];
		if (
			confirm(
				`カテゴリ「${itemName}」を削除しますか？\nこのカテゴリの既存の取引はすべて「${targetName}」に振り替えられます。`
			)
		) {
			await handlers.onRemapCategory(itemId, targetName);
			await handlers.onDeleteItem(itemId, "category");
		}
	}
}

async function handleAdjustBalance(e) {
	const button = e.target.closest(".adjust-balance-button");
	if (!button) return;

	const input = button.previousElementSibling;
	// datasetからaccountIdを取得
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
	}
}

async function handleChangeIcon(e) {
	const button = e.target.closest(".change-icon-button");
	if (!button) return;
	const accountId = button.dataset.itemId;

	openIconPicker(async (selectedIcon) => {
		try {
			await handlers.onUpdateItem(accountId, "account", { icon: selectedIcon });
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
	const initialData = handlers.getInitialData();
	render(initialData.luts, initialData.config);
	navigateTo("#settings-menu");
	initializeSortable();
	elements.displayPeriodSelector.value = handlers.getInitialDisplayPeriod();
	elements.modal.classList.remove("hidden");
}

export function closeModal() {
	elements.modal.classList.add("hidden");
	setTimeout(() => navigateTo("#settings-menu"), 200);
}
