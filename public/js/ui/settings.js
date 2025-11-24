import * as utils from "../utils.js";
import * as notification from "./notification.js";

/**
 * 編集・削除が制限されるデフォルトのカテゴリ名。
 * @type {Array<string>}
 */
const PROTECTED_DEFAULTS = ["その他収入", "その他支出"];
const AVAILABLE_ICONS = [
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

/**
 * 設定モーダルのUI要素をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	modal: document.getElementById("settings-modal"),
	// ヘッダー
	header: document.getElementById("settings-header"),
	title: document.getElementById("settings-title"),
	backButton: document.getElementById("settings-back-button"),
	closeButton: document.getElementById("close-settings-modal-button"),
	// コンテンツ制御
	menu: document.getElementById("settings-menu"),
	panes: document.querySelectorAll(".settings-tab-pane"),
	// フォーム要素 & リスト
	displayPeriodSelector: document.getElementById("display-period-selector"),
	saveGeneralSettingsButton: document.getElementById(
		"save-general-settings-button"
	),
	assetsList: document.getElementById("assets-list"),
	liabilitiesList: document.getElementById("liabilities-list"),
	incomeCategoriesList: document.getElementById("income-categories-list"),
	expenseCategoriesList: document.getElementById("expense-categories-list"),
	balanceAdjustmentList: document.getElementById("balance-adjustment-list"),
	creditCardRulesContainer: document.getElementById(
		"credit-card-rules-container"
	),
	// アクションボタン
	addAssetButton: document.getElementById("add-asset-button"),
	addLiabilityButton: document.getElementById("add-liability-button"),
	addIncomeCategoryButton: document.getElementById(
		"add-income-category-button"
	),
	addExpenseCategoryButton: document.getElementById(
		"add-expense-category-button"
	),
	addCardRuleButton: document.getElementById("add-card-rule-button"),
	// アイコンピッカー
	iconPickerModal: document.getElementById("icon-picker-modal"),
	iconPickerGrid: document.getElementById("icon-picker-grid"),
};

let handlers = {};
let appLuts = {};
let appConfig = {};

/**
 * 項目編集中（インラインフォーム表示中）かどうかを示すフラグ。
 * Escapeキーの挙動制御などに使用する。
 * @type {boolean}
 */
let isEditingState = false;

// Sortable instances
let sortables = {
	asset: null,
	liability: null,
	income: null,
	expense: null,
};

/**
 * 設定モーダルを初期化し、イベントリスナーを設定する。
 * @param {object} initHandlers - 各種操作のコールバック関数をまとめたオブジェクト。
 */
export function init(initHandlers) {
	handlers = initHandlers;

	elements.closeButton.addEventListener("click", closeModal);
	elements.backButton.addEventListener("click", () =>
		navigateTo("#settings-menu")
	);
	elements.saveGeneralSettingsButton.addEventListener(
		"click",
		handleSaveGeneralSettings
	);

	// Navigation
	elements.menu.addEventListener("click", (e) => {
		e.preventDefault();
		const link = e.target.closest(".settings-menu-link");
		if (link) navigateTo(link.getAttribute("href"));
	});

	// 「追加」ボタンのイベントリスナー
	elements.addAssetButton.addEventListener("click", () =>
		createInlineInput(elements.assetsList, "asset", "新しい資産口座名")
	);
	elements.addLiabilityButton.addEventListener("click", () =>
		createInlineInput(elements.liabilitiesList, "liability", "新しい負債口座名")
	);
	elements.addIncomeCategoryButton.addEventListener("click", () =>
		createInlineInput(
			elements.incomeCategoriesList,
			"income",
			"新しい収入カテゴリ名"
		)
	);
	elements.addExpenseCategoryButton.addEventListener("click", () =>
		createInlineInput(
			elements.expenseCategoriesList,
			"expense",
			"新しい支出カテゴリ名"
		)
	);

	elements.addCardRuleButton.addEventListener("click", () =>
		renderCardRuleForm()
	);

	// 動的に生成される要素に対するイベント委任
	elements.modal.addEventListener("click", (e) => {
		// モーダル背景クリックで閉じる
		if (e.target === elements.modal) closeModal();

		// 項目（口座・カテゴリ）の操作
		if (e.target.closest(".edit-item-button")) handleEditItemToggle(e);
		if (e.target.closest(".remove-item-button")) handleRemoveItem(e);
		if (e.target.closest(".change-icon-button")) handleChangeIcon(e);

		// Balance Adjustment
		if (e.target.closest(".adjust-balance-button")) handleAdjustBalance(e);

		// クレジットカードルールの操作
		if (e.target.closest(".edit-card-rule-button")) {
			const btn = e.target.closest(".edit-card-rule-button");
			renderCardRuleForm(btn.dataset.cardId);
		}
		if (e.target.closest(".delete-card-rule-button")) {
			const btn = e.target.closest(".delete-card-rule-button");
			handleDeleteCardRule(btn.dataset.cardId);
		}
	});

	// アイコンピッカーの操作
	elements.iconPickerModal.addEventListener("click", (e) => {
		const button = e.target.closest(".icon-picker-button");
		if (button && window._onIconSelect) {
			window._onIconSelect(button.dataset.icon);
			elements.iconPickerModal.classList.add("hidden");
		} else if (e.target === elements.iconPickerModal) {
			elements.iconPickerModal.classList.add("hidden");
		}
	});

	// モーダル表示中のグローバルなキーボードショートカット
	document.addEventListener("keydown", (e) => {
		if (elements.modal.classList.contains("hidden")) return;

		if (e.key === "Enter") {
			// 残高調整入力中のEnter対応
			if (
				e.target.closest("#balance-adjustment-list") &&
				e.target.tagName === "INPUT"
			) {
				e.target.nextElementSibling?.click();
			}
		}

		if (e.key === "Escape") {
			// 重なり順に閉じる
			if (!elements.iconPickerModal.classList.contains("hidden")) {
				elements.iconPickerModal.classList.add("hidden");
				return;
			}
			// 項目編集中はモーダルを閉じずに編集をキャンセルする
			if (!isEditingState) {
				closeModal();
			}
			isEditingState = false;
		}
	});
}

/**
 * 設定モーダルを開く。
 */
export function openModal() {
	const initialData = handlers.getInitialData();
	render(initialData.luts, initialData.config);

	navigateTo("#settings-menu");
	initializeSortable();

	elements.displayPeriodSelector.value = handlers.getInitialDisplayPeriod();

	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open"); // スクロールロック
}

/**
 * 設定モーダルを閉じる。
 */
export function closeModal() {
	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open"); // スクロールロック解除

	// 閉じるアニメーション後にUIを初期状態（メニュー画面）に戻す
	setTimeout(() => {
		navigateTo("#settings-menu");
		isEditingState = false;
	}, 200);
}

function navigateTo(paneId) {
	/**
	 * 設定モーダル内の表示ペインを切り替える。
	 * @private
	 * @param {string} paneId - 表示するペインのID（例: "#settings-menu"）。
	 */
	const isMenu = paneId === "#settings-menu";

	elements.menu.classList.toggle("hidden", !isMenu);
	elements.backButton.classList.toggle("hidden", isMenu);

	elements.panes.forEach((p) => {
		const isTarget = `#${p.id}` === paneId;
		p.classList.toggle("hidden", !isTarget);
		if (isTarget) {
			// タイトル更新: リンクのテキストを取得して設定
			const link = elements.menu.querySelector(`a[href="${paneId}"]`);
			elements.title.textContent = link ? link.textContent : "設定";
		}
	});

	if (isMenu) elements.title.textContent = "設定";
}

/**
 * 設定モーダル内の全リストを描画する。
 * @param {object} luts - 口座とカテゴリのルックアップテーブル。
 * @param {object} config - ユーザー設定情報。
 */
export function render(luts, config) {
	appLuts = luts;
	appConfig = config;

	const constraints = handlers.getUsedItems(); // 削除可否判定用データ
	const accounts = [...appLuts.accounts.values()].filter((a) => !a.isDeleted);
	const categories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted
	);

	// 各リストの描画
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

/**
 * 口座またはカテゴリのリストをレンダリングする汎用関数。
 * @private
 * @param {HTMLElement} listElement - 描画対象のリスト要素。
 * @param {Array<object>} items - 描画する項目の配列。
 * @param {string} itemType - 項目の種類 ('account' または 'category')。
 * @param {object} constraints - 削除可否などを判断するための制約情報。
 * @param {object} constraints.accountBalances - 口座残高。
 */
function renderList(listElement, items, itemType, constraints) {
	const sortedItems = utils.sortItems(items);

	listElement.innerHTML = sortedItems
		.map((item) => {
			let isEditable = true;
			let isDeletable = true;
			let tooltip = "";

			// 制約チェック
			if (itemType === "account") {
				const balance = constraints.accountBalances[item.id] || 0;
				if (balance !== 0) {
					isDeletable = false;
					tooltip = `残高がゼロではありません (${utils.formatCurrency(
						balance
					)})。`;
				}
			} else {
				if (PROTECTED_DEFAULTS.includes(item.name)) {
					isEditable = false;
					isDeletable = false;
					tooltip = "このカテゴリは削除できません。";
				}
			}

			const iconHtml =
				itemType === "account"
					? `<button class="p-2 mr-3 rounded-lg hover:bg-neutral-200 change-icon-button" data-item-id="${
							item.id
					  }">
                   <i class="${item.icon || "fa-solid fa-question"}"></i>
               </button>`
					: "";

			return `
        <div class="flex items-center justify-between p-2 rounded-md bg-neutral-100" data-id="${
					item.id
				}">
            <div class="flex items-center">
                <i class="fas fa-grip-vertical text-neutral-400 mr-3 cursor-move handle"></i>
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
										? `<button class="text-primary hover:text-primary-dark px-2 edit-item-button"><i class="fas fa-pen"></i></button>`
										: ""
								}
                ${
									isDeletable
										? `<button class="text-danger hover:text-danger remove-item-button" data-item-id="${item.id}" data-item-name="${item.name}" data-item-type="${itemType}">
                        <i class="fas fa-trash-alt pointer-events-none"></i>
                       </button>`
										: `<i class="fas fa-lock text-neutral-400" title="${tooltip}"></i>`
								}
            </div>
        </div>`;
		})
		.join("");
}

/**
 * 残高調整リストを描画する。
 * @private
 * @param {Array<object>} accounts - 資産口座の配列。
 * @param {object} balances - 全口座の残高情報。
 */
function renderBalanceAdjustmentList(accounts, balances) {
	const sortedAccounts = utils.sortItems(accounts);

	elements.balanceAdjustmentList.innerHTML = sortedAccounts
		.map(
			(account) => `
        <div class="flex flex-col md:grid md:grid-cols-5 md:items-center gap-2 md:gap-4 p-3 rounded-md bg-neutral-50">
            <span class="font-medium md:col-span-2">${account.name}</span>
            <div class="flex items-center gap-2 w-full md:col-span-3">
                <input type="number" 
                    class="w-full border-neutral-300 rounded-lg p-2 text-right" 
                    placeholder="現在の残高: ¥${(
											balances[account.id] || 0
										).toLocaleString()}"
                    data-account-id="${account.id}" 
                    data-current-balance="${balances[account.id] || 0}">
                <button class="adjust-balance-button bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary-dark shrink-0">調整</button>
            </div>
        </div>`
		)
		.join("");
}

/**
 * クレジットカードの支払いルールリストを描画する。
 * @private
 */
function renderCreditCardRulesList() {
	const rules = appConfig.creditCardRules || {};
	const liabilityAccounts = [...appLuts.accounts.values()].filter(
		(acc) => acc.type === "liability" && !acc.isDeleted
	);
	const sortedAccounts = utils.sortItems(liabilityAccounts);

	const monthOffsetMap = { 1: "翌月", 2: "翌々月", 3: "3ヶ月後" };
	let html = "";

	// 未設定の負債口座がある場合のみ「追加」ボタンを表示する
	const unconfiguredCards = sortedAccounts.filter((acc) => !rules[acc.id]);
	elements.addCardRuleButton.style.display =
		unconfiguredCards.length > 0 ? "block" : "none";

	for (const card of sortedAccounts) {
		const rule = rules[card.id];
		if (!rule) continue;

		const paymentAccountName =
			appLuts.accounts.get(rule.defaultPaymentAccountId)?.name || "未設定";
		const paymentTimingText = monthOffsetMap[rule.paymentMonthOffset] || "翌月";

		html += `
        <div class="p-3 rounded-md bg-neutral-100">
            <div class="flex items-center justify-between">
                <h4 class="font-bold text-neutral-800">${card.name}</h4>
                <div>
                    <button class="text-primary hover:text-primary-dark px-2 edit-card-rule-button" data-card-id="${card.id}">
                        <i class="fas fa-pen pointer-events-none"></i>
                    </button>
                    <button class="text-danger hover:text-danger px-2 delete-card-rule-button" data-card-id="${card.id}">
                        <i class="fas fa-trash-alt pointer-events-none"></i>
                    </button>
                </div>
            </div>
            <div class="text-sm text-neutral-600 mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <span>締め日:</span> <span class="font-medium">${rule.closingDay}日</span>
                <span>支払日:</span> <span class="font-medium">${paymentTimingText} ${rule.paymentDay}日</span>
                <span>支払元:</span> <span class="font-medium">${paymentAccountName}</span>
            </div>
        </div>`;
	}

	elements.creditCardRulesContainer.innerHTML = html;
}

/**
 * クレジットカードルールの追加・編集フォームを動的に生成して表示する。
 * @private
 * @param {string|null} [cardIdToEdit=null] - 編集対象のカードID。新規作成時はnull。
 */
function renderCardRuleForm(cardIdToEdit = null) {
	isEditingState = true;
	const rules = appConfig.creditCardRules || {};
	const rule = cardIdToEdit ? rules[cardIdToEdit] : {};
	const isEditing = !!cardIdToEdit;

	// 既存フォーム削除
	const existingPanel = document.getElementById("card-rule-edit-panel");
	if (existingPanel) existingPanel.remove();

	// 選択肢生成
	const assetAccounts = [...appLuts.accounts.values()].filter(
		(a) => a.type === "asset" && !a.isDeleted
	);
	const tempSelect = document.createElement("select");
	utils.populateSelect(tempSelect, assetAccounts);
	const assetOptions = tempSelect.innerHTML;
	const sortedAssets = utils.sortItems(assetAccounts);
	const assetOptionsHtml = sortedAssets
		.map(
			(acc) =>
				`<option value="${acc.id}" ${
					isEditing && acc.id === rule.defaultPaymentAccountId ? "selected" : ""
				}>${acc.name}</option>`
		)
		.join("");

	let cardOptions = "";
	if (!isEditing) {
		const unconfigured = [...appLuts.accounts.values()].filter(
			(acc) => acc.type === "liability" && !acc.isDeleted && !rules[acc.id]
		);
		const sortedUnconfigured = utils.sortItems(unconfigured);
		cardOptions = sortedUnconfigured
			.map((c) => `<option value="${c.id}">${c.name}</option>`)
			.join("");
	}

	const panel = document.createElement("div");
	panel.id = "card-rule-edit-panel";
	panel.className =
		"p-4 rounded-md border border-primary-ring bg-primary-light space-y-4";
	panel.innerHTML = `
        <h4 class="font-bold text-lg">${
					isEditing
						? `「${appLuts.accounts.get(cardIdToEdit)?.name}」のルールを編集`
						: "新しい支払いルールを追加"
				}</h4>
        ${
					!isEditing
						? `<div class="grid grid-cols-3 items-center"><label class="font-semibold text-neutral-700">対象カード</label><select id="card-rule-id" class="col-span-2 border-neutral-300 rounded-lg p-2">${cardOptions}</select></div>`
						: ""
				}
        <div class="grid grid-cols-3 items-center"><label class="font-semibold text-neutral-700">締め日</label><input type="number" id="card-rule-closing" class="col-span-2 border-neutral-300 rounded-lg p-2" value="${
					rule.closingDay || 15
				}" min="1" max="31"></div>
        <div class="grid grid-cols-3 items-center"><label class="font-semibold text-neutral-700">支払日</label>
            <div class="col-span-2 flex items-center gap-2">
                <select id="card-rule-payment-month" class="border-neutral-300 rounded-lg p-2"><option value="1" ${
									(rule.paymentMonthOffset || 1) === 1 ? "selected" : ""
								}>翌月</option><option value="2" ${
		rule.paymentMonthOffset === 2 ? "selected" : ""
	}>翌々月</option><option value="3" ${
		rule.paymentMonthOffset === 3 ? "selected" : ""
	}>3ヶ月後</option></select>
                <input type="number" id="card-rule-payment-day" class="border-neutral-300 rounded-lg p-2 w-full" value="${
									rule.paymentDay || 10
								}" min="1" max="31"><span>日</span>
            </div>
        </div>
        <div class="grid grid-cols-3 items-center"><label class="font-semibold text-neutral-700">支払元口座</label><select id="card-rule-account" class="col-span-2 border-neutral-300 rounded-lg p-2">${assetOptionsHtml}</select></div>
        <div class="flex justify-end gap-3 pt-3 border-t">
            <button id="cancel-card-rule-button" class="bg-neutral-200 text-neutral-700 px-4 py-2 rounded-lg hover:bg-neutral-300">キャンセル</button>
            <button id="save-card-rule-button" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">保存</button>
        </div>`;

	elements.creditCardRulesContainer.appendChild(panel);
	const saveBtn = panel.querySelector("#save-card-rule-button");
	const cancelBtn = panel.querySelector("#cancel-card-rule-button");

	const handleSave = async () => {
		const targetCardId = isEditing
			? cardIdToEdit
			: panel.querySelector("#card-rule-id").value;
		if (!targetCardId)
			return notification.error("対象カードを選択してください。");

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
		await handlers.onUpdateCardRule(targetCardId, ruleData);
		panel.remove();
		isEditingState = false;
	};

	saveBtn.onclick = handleSave;
	cancelBtn.onclick = () => {
		panel.remove();
		isEditingState = false;
	};
	panel.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		}
		if (e.key === "Escape") {
			e.stopPropagation();
			cancelBtn.click();
		}
	});
}

/**
 * 口座・カテゴリ追加用のインライン入力フォームを生成する。
 * @private
 * @param {HTMLElement} listElement - フォームを追加するリスト要素。
 * @param {string} listName - 項目の種類 ('asset', 'liability', 'income', 'expense')。
 * @param {string} placeholder - 入力フィールドのプレースホルダーテキスト。
 */
function createInlineInput(listElement, listName, placeholder) {
	const existingInput = listElement.querySelector(".inline-input-wrapper");
	if (existingInput) existingInput.remove();

	isEditingState = true;
	const inputWrapper = document.createElement("div");
	inputWrapper.className =
		"inline-input-wrapper flex items-center gap-2 p-2 rounded-md bg-neutral-100";
	inputWrapper.innerHTML = `
        <input type="text" class="flex-grow border-neutral-300 rounded-lg p-1" placeholder="${placeholder}">
        <button class="save-inline-button text-success hover:text-success-dark">✓</button>
        <button class="cancel-inline-button text-danger hover:text-danger-dark">×</button>
    `;
	listElement.appendChild(inputWrapper);

	const inputField = inputWrapper.querySelector("input");
	inputField.focus();

	const handleAdd = () => {
		handleAddItem(listName, inputField.value).then((success) => {
			if (success) {
				inputWrapper.remove();
				isEditingState = false;
			}
		});
	};
	const handleCancel = () => {
		inputWrapper.remove();
		isEditingState = false;
	};

	inputWrapper.querySelector(".save-inline-button").onclick = handleAdd;
	inputWrapper.querySelector(".cancel-inline-button").onclick = handleCancel;

	inputField.onkeydown = (e) => {
		if (e.key === "Enter") handleAdd();
		if (e.key === "Escape") {
			e.stopPropagation();
			handleCancel();
		}
	};
}

/**
 * 「一般設定」の保存ボタンがクリックされたときの処理。
 * @private
 */
function handleSaveGeneralSettings() {
	const newPeriod = Number(elements.displayPeriodSelector.value);
	handlers.onUpdateDisplayPeriod(newPeriod);
}

/**
 * 新しい項目（口座・カテゴリ）を追加する処理。
 * @private
 * @async
 */
async function handleAddItem(type, name) {
	const trimmedName = name ? name.trim() : "";
	if (trimmedName === "") {
		notification.error("項目名を入力してください。");
		return false;
	}

	const allNames = [
		...[...appLuts.accounts.values()].map((a) => a.name),
		...[...appLuts.categories.values()].map((c) => c.name),
	];
	if (allNames.includes(trimmedName)) {
		notification.error(`「${trimmedName}」という名前は既に使用されています。`);
		return false;
	}

	try {
		await handlers.onAddItem({ type, name: trimmedName });
		return true;
	} catch (e) {
		notification.error(`追加中にエラーが発生しました: ${e.message}`);
		return false;
	}
}

/**
 * 項目名の編集モードをトグルし、保存処理を行う。
 * @private
 * @async
 */
async function handleEditItemToggle(e) {
	const button = e.target.closest(".edit-item-button");
	const wrapper = button.closest(".flex").querySelector(".item-name-wrapper");
	const nameSpan = wrapper.querySelector(".item-name");
	const nameInput = wrapper.querySelector(".item-name-input");
	const itemId = button.closest("[data-id]").dataset.id;
	const itemType = appLuts.accounts.has(itemId) ? "account" : "category";

	// 保護されたデフォルトカテゴリは編集不可
	if (PROTECTED_DEFAULTS.includes(nameSpan.textContent)) {
		notification.error("このカテゴリは編集できません。");
		return;
	}

	const isCurrentlyEditing = !nameInput.classList.contains("hidden");

	if (isCurrentlyEditing) {
		// --- 保存処理 ---
		const newName = nameInput.value.trim();
		const oldName = nameSpan.textContent;

		if (newName === oldName) {
			toggleEditUI(wrapper, false);
			return;
		}

		// 重複チェック
		const allNames = [
			...appLuts.accounts.values(),
			...appLuts.categories.values(),
		].map((x) => x.name);
		if (allNames.includes(newName)) {
			notification.error(`「${newName}」という名前は既に使用されています。`);
			return;
		}

		try {
			await handlers.onUpdateItem(itemId, itemType, { name: newName });
			toggleEditUI(wrapper, false);
		} catch (error) {
			notification.error("名前の変更に失敗しました。");
		}
	} else {
		// --- 編集モード開始 ---
		toggleEditUI(wrapper, true);

		// 編集中のキーボード操作を定義
		nameInput.onkeydown = (ev) => {
			if (ev.key === "Enter") {
				ev.preventDefault();
				button.click();
			}
			if (ev.key === "Escape") {
				nameInput.value = nameSpan.textContent;
				toggleEditUI(wrapper, false);
			}
		};
	}
}

/**
 * 項目名編集のUI（テキストと入力欄の表示切替）を制御する。
 * @private
 * @param {HTMLElement} wrapper - 編集対象のUI要素の親コンテナ。
 * @param {boolean} isEditing - 編集モードにする場合はtrue。
 */
function toggleEditUI(wrapper, isEditing) {
	const nameSpan = wrapper.querySelector(".item-name");
	const nameInput = wrapper.querySelector(".item-name-input");
	const editButton =
		wrapper.parentElement.nextElementSibling.querySelector(".edit-item-button");

	nameSpan.classList.toggle("hidden", isEditing);
	nameInput.classList.toggle("hidden", !isEditing);
	editButton.innerHTML = isEditing
		? '<i class="fas fa-check"></i>'
		: '<i class="fas fa-pen"></i>';

	isEditingState = isEditing;
	if (isEditing) {
		nameInput.focus();
		nameInput.select();
	} else {
		nameInput.onkeydown = null;
	}
}

/**
 * 項目（口座・カテゴリ）の削除ボタンがクリックされたときの処理。
 * @private
 * @async
 */
async function handleRemoveItem(e) {
	const button = e.target.closest(".remove-item-button");
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

/**
 * 残高調整ボタンがクリックされたときの処理。
 * @private
 * @async
 */
async function handleAdjustBalance(e) {
	const button = e.target.closest(".adjust-balance-button");
	const input = button.previousElementSibling;
	const { accountId, currentBalance } = input.dataset;

	const actualBalance = parseFloat(input.value);
	if (isNaN(actualBalance))
		return notification.error("数値を入力してください。");

	const difference = actualBalance - parseFloat(currentBalance);
	if (difference === 0)
		return notification.error("残高に差がないため、調整は不要です。");

	const accountName = appLuts.accounts.get(accountId)?.name || "不明な口座";
	if (
		confirm(
			`「${accountName}」の残高を ¥${difference.toLocaleString()} 調整しますか？`
		)
	) {
		await handlers.onAdjustBalance(accountId, difference);
	}
}

/**
 * 口座アイコンの変更ボタンがクリックされたときの処理。
 * @private
 * @async
 */
async function handleChangeIcon(e) {
	const accountId = e.target.closest(".change-icon-button").dataset.itemId;
	openIconPicker(async (selectedIcon) => {
		try {
			await handlers.onUpdateItem(accountId, "account", { icon: selectedIcon });
		} catch (error) {
			notification.error("アイコンの変更に失敗しました。");
		}
	});
}

/**
 * クレジットカードルールの削除ボタンがクリックされたときの処理。
 * @private
 * @async
 */
async function handleDeleteCardRule(cardId) {
	if (confirm(`「${cardId}」のルールを本当に削除しますか？`)) {
		handlers.onDeleteCardRule(cardId);
	}
}

/**
 * アイコン選択モーダルを開く。
 * @private
 * @param {function} callback - アイコンが選択されたときに呼び出されるコールバック関数。
 */
function openIconPicker(callback) {
	window._onIconSelect = callback; // グローバルにコールバックを保持（initで参照）
	elements.iconPickerGrid.innerHTML = AVAILABLE_ICONS.map(
		(iconClass) => `
        <button class="p-3 rounded-lg hover:bg-neutral-200 text-2xl flex items-center justify-center icon-picker-button" data-icon="${iconClass}">
            <i class="${iconClass}"></i>
        </button>
    `
	).join("");
	elements.iconPickerModal.classList.remove("hidden");
}

/**
 * SortableJSライブラリを初期化し、リストのドラッグ＆ドロップ並び替えを有効にする。
 * @private
 */
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

	if (sortables.asset) sortables.asset.destroy();
	if (sortables.liability) sortables.liability.destroy();
	if (sortables.income) sortables.income.destroy();
	if (sortables.expense) sortables.expense.destroy();

	sortables.asset = createSortable(
		elements.assetsList,
		handlers.onUpdateAccountOrder
	);
	sortables.liability = createSortable(
		elements.liabilitiesList,
		handlers.onUpdateAccountOrder
	);
	sortables.income = createSortable(
		elements.incomeCategoriesList,
		handlers.onUpdateCategoryOrder
	);
	sortables.expense = createSortable(
		elements.expenseCategoriesList,
		handlers.onUpdateCategoryOrder
	);
}
