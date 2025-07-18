import * as utils from "../utils.js";

const elements = {
	modal: document.getElementById("settings-modal"),
	closeButton: document.getElementById("close-settings-modal-button"),
	tabs: document.getElementById("settings-tabs"),
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
	// 保存ボタン
	saveButton: document.getElementById("save-settings-button"),
};
const PROTECTED_CATEGORIES = ["受取・その他入金", "その他支出"];

let handlers = {};
let currentConfig = {};

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
				if (PROTECTED_CATEGORIES.includes(item)) {
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
}

function handleTabClick(e) {
	e.preventDefault();
	const targetTab = e.target.closest("a");
	if (!targetTab) return;

	// すべてのタブからactiveクラスを削除
	document
		.querySelectorAll(".settings-tab-button")
		.forEach((button) => button.classList.remove("settings-tab-active"));
	// クリックされたタブにactiveクラスを追加
	targetTab.classList.add("settings-tab-active");

	// すべてのパネルを非表示
	elements.panes.forEach((pane) => pane.classList.add("hidden"));
	// 対象のパネルを表示
	const targetPaneId = targetTab.getAttribute("href");
	document.querySelector(targetPaneId).classList.remove("hidden");
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
	elements.tabs.addEventListener("click", handleTabClick);

	elements.addAssetButton.addEventListener("click", () => {
		const name = prompt("新しい資産口座名を入力してください:");
		addListItem("assets", name);
	});
	elements.addLiabilityButton.addEventListener("click", () => {
		const name = prompt("新しい負債口座名を入力してください:");
		addListItem("liabilities", name);
	});
	elements.addIncomeCategoryButton.addEventListener("click", () => {
		addListItem("incomeCategories", elements.newIncomeCategoryInput.value);
		elements.newIncomeCategoryInput.value = "";
	});
	elements.addExpenseCategoryButton.addEventListener("click", () => {
		addListItem("expenseCategories", elements.newExpenseCategoryInput.value);
		elements.newExpenseCategoryInput.value = "";
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
	const firstTab = elements.tabs.querySelector("a");
	if (firstTab) {
		firstTab.click();
	}
	elements.modal.classList.remove("hidden");
}

export function closeModal() {
	elements.modal.classList.add("hidden");
}
