import * as utils from "../utils.js";

const elements = {
	modal: document.getElementById("settings-modal"),
	header: document.getElementById("settings-header"),
	title: document.getElementById("settings-title"),
	backButton: document.getElementById("settings-back-button"),
	closeButton: document.getElementById("close-settings-modal-button"),
	menu: document.getElementById("settings-menu"),
	panes: document.querySelectorAll(".settings-tab-pane"),
	// 口座設定
	assetsList: document.getElementById("assets-list"),
	liabilitiesList: document.getElementById("liabilities-list"),
	addAssetButton: document.getElementById("add-asset-button"),
	addLiabilityButton: document.getElementById("add-liability-button"),
	// カテゴリ設定
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
	// 保存ボタン
	saveButton: document.getElementById("save-settings-button"),
};
const PROTECTED_DEFAULTS = ["受取・その他入金", "その他支出"];

let handlers = {};
let currentConfig = {};

function navigateTo(paneId) {
	if (paneId === "#settings-menu") {
		// メニューに戻る
		elements.menu.classList.remove("hidden");
		elements.panes.forEach((p) => p.classList.add("hidden"));
		elements.backButton.classList.add("hidden");
		elements.title.textContent = "設定";
	} else {
		// 各設定パネルに移動
		elements.menu.classList.add("hidden");
		elements.panes.forEach((p) => {
			if (`#${p.id}` === paneId) {
				p.classList.remove("hidden");
				// タイトルをパネルから取得（data属性などで）
				elements.title.textContent = document.querySelector(
					`a[href="${paneId}"]`
				).textContent;
			} else {
				p.classList.add("hidden");
			}
		});
		elements.backButton.classList.remove("hidden");
	}
}

function renderList(listElement, items, listName, constraints) {
	listElement.innerHTML = items
		.map((item) => {
			let isDeletable = true;
			let tooltip = "";

			if (listName === "assets" || listName === "liabilities") {
				const balance = constraints.accountBalances[item] || 0;
				if (balance !== 0) {
					isDeletable = false;
					tooltip = `残高がゼロではありません (${utils.formatCurrency(
						balance,
						false
					)})。`;
				}
			} else {
				// カテゴリの場合
				const isProtected =
					PROTECTED_DEFAULTS.includes(item) ||
					(constraints.systemCategories &&
						constraints.systemCategories.includes(item));
				if (isProtected) {
					isDeletable = false;
					tooltip = "このカテゴリは削除できません。";
				}
			}

			return `
            <div class="flex items-center justify-between p-2 rounded-md ${
							!isDeletable ? "bg-gray-200" : "bg-gray-100"
						}">
                <span class="${
									!isDeletable ? "text-gray-500" : ""
								}" title="${tooltip}">
                    ${item}
                </span>
                ${
									isDeletable
										? `
                    <button class="text-red-500 hover:text-red-700 remove-item-button" data-item-name="${item}" data-list-name="${listName}">
                       <i class="fas fa-trash-alt"></i>
                    </button>
                `
										: `
                    <i class="fas fa-lock text-gray-400" title="${tooltip}"></i>
                `
								}
            </div>
        `;
		})
		.join("");
}

function renderBalanceAdjustmentList(accounts, balances) {
	elements.balanceAdjustmentList.innerHTML = accounts
		.map(
			(account) => `
        <div class="flex flex-col md:grid md:grid-cols-5 md:items-center gap-2 md:gap-4 p-3 rounded-md bg-gray-50">
            <span class="font-medium md:col-span-2">${account}</span>
            <div class="flex items-center gap-2 w-full md:col-span-3">
                <input 
                    type="number" 
                    class="w-full border-gray-300 rounded-lg p-2 text-right" 
                    placeholder="現在の残高: ¥${(
											balances[account] || 0
										).toLocaleString()}"
                    data-account-name="${account}"
                    data-current-balance="${balances[account] || 0}"
                >
                <button class="adjust-balance-button bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 shrink-0">調整</button>
            </div>
        </div>
    `
		)
		.join("");
}

function render() {
	const constraints = handlers.getUsedItems();

	renderList(elements.assetsList, currentConfig.assets, "assets", constraints);
	renderList(
		elements.liabilitiesList,
		currentConfig.liabilities,
		"liabilities",
		constraints
	);
	renderList(
		elements.incomeCategoriesList,
		currentConfig.incomeCategories,
		"incomeCategories",
		constraints
	);
	renderList(
		elements.expenseCategoriesList,
		currentConfig.expenseCategories,
		"expenseCategories",
		constraints
	);
	renderBalanceAdjustmentList(
		currentConfig.assets,
		constraints.accountBalances
	);
}

function addListItem(listName, newItemName) {
	if (!newItemName || newItemName.trim() === "") {
		alert("項目名を入力してください。");
		return;
	}
	const list = currentConfig[listName];
	if (list.includes(newItemName.trim())) {
		alert("同じ名前の項目が既に存在します。");
		return;
	}
	list.push(newItemName.trim());
	render();
}

async function removeListItem(e) {
	const targetButton = e.target.closest(".remove-item-button");
	if (!targetButton) return;

	const itemName = targetButton.dataset.itemName;
	const listName = targetButton.dataset.listName;

	if (listName === "assets" || listName === "liabilities") {
		if (confirm(`口座「${itemName}」を本当に削除しますか？`)) {
			currentConfig[listName] = currentConfig[listName].filter(
				(i) => i !== itemName
			);
		}
	} else if (
		listName === "incomeCategories" ||
		listName === "expenseCategories"
	) {
		const type = listName === "incomeCategories" ? "income" : "expense";
		const targetCategory =
			type === "income" ? "受取・その他入金" : "その他支出";

		if (
			confirm(
				`カテゴリ「${itemName}」を削除しますか？\n\nこのカテゴリの既存の取引はすべて「${targetCategory}」に振り替えられます。`
			)
		) {
			// main.js の振り替え処理を呼び出す
			await handlers.onRemapCategory(itemName, targetCategory, type);
			// configからカテゴリを削除
			currentConfig[listName] = currentConfig[listName].filter(
				(i) => i !== itemName
			);
		}
	}
	render();
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

export function init(initHandlers) {
	handlers = initHandlers;
	elements.closeButton.addEventListener("click", closeModal);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) closeModal();
	});
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && !elements.modal.classList.contains("hidden")) {
			closeModal();
		}
	});

	// メニューリンクのクリックイベント
	elements.menu.addEventListener("click", (e) => {
		e.preventDefault();
		const link = e.target.closest(".settings-menu-link");
		if (link) {
			navigateTo(link.getAttribute("href"));
		}
	});

	// 戻るボタンのクリックイベント
	elements.backButton.addEventListener("click", () => {
		navigateTo("#settings-menu");
	});

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
	elements.balanceAdjustmentList.addEventListener("click", async (e) => {
		if (!e.target.classList.contains("adjust-balance-button")) return;

		const button = e.target;
		const input = button.previousElementSibling;
		const accountName = input.dataset.accountName;
		const currentBalance = parseFloat(input.dataset.currentBalance);
		const actualBalance = parseFloat(input.value);

		if (isNaN(actualBalance)) {
			alert("数値を入力してください。");
			return;
		}

		const difference = actualBalance - currentBalance;

		if (difference === 0) {
			alert("残高に差がないため、調整は不要です。");
			return;
		}

		if (
			confirm(
				`「${accountName}」の残高を ¥${difference.toLocaleString()} 調整しますか？`
			)
		) {
			await handlers.onAdjustBalance(accountName, difference);
			alert("残高を調整しました。");
			// 入力欄をクリア
			input.value = "";
			input.placeholder = `現在の残高: ¥${actualBalance.toLocaleString()}`;
			input.dataset.currentBalance = actualBalance;
		}
	});

	// すべてのリストで同じ削除関数をリスニング
	elements.modal.addEventListener("click", removeListItem);

	elements.saveButton.addEventListener("click", () => {
		handlers.onSave(currentConfig);
	});
}

export function openModal() {
	// getInitialConfigから渡されるのは、現在アプリで使われている設定
	currentConfig = JSON.parse(JSON.stringify(handlers.getInitialConfig()));
	render();
	navigateTo("#settings-menu");
	elements.modal.classList.remove("hidden");
}

export function closeModal() {
	elements.modal.classList.add("hidden");
	setTimeout(() => navigateTo("#settings-menu"), 200);
}
