import { deleteField } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import * as utils from "../utils.js";
import * as notification from "./notification.js";

// --- Module Dependencies (initialized in init) ---
let store;
let billing;
let getState;
let refreshApp;
let reloadApp;
let appLuts = {};
let appConfig = {};

/**
 * 編集・削除が制限されるデフォルトのカテゴリ名。
 * システム上重要なカテゴリであり、ユーザーによる変更を許可しない。
 * @type {Array<string>}
 */
const PROTECTED_DEFAULTS = ["その他収入", "その他支出"];

/**
 * 利用可能なアイコンのリスト。
 * FontAwesomeのクラス名を使用している。
 * @type {Array<string>}
 */
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
const getElements = () => ({
	modal: utils.dom.get("settings-modal"),
	// ヘッダー
	header: utils.dom.get("settings-header"),
	title: utils.dom.get("settings-title"),
	backButton: utils.dom.get("settings-back-button"),
	closeButton: utils.dom.get("close-settings-modal-button"),
	// コンテンツ制御
	menu: utils.dom.get("settings-menu"),
	panes: utils.dom.queryAll(".settings-tab-pane"),
	// フォーム要素 & リスト
	displayPeriodSelector: utils.dom.get("display-period-selector"),
	aiAdvisorToggle: utils.dom.get("ai-advisor-toggle"),
	saveGeneralSettingsButton: utils.dom.get("save-general-settings-button"),
	assetsList: utils.dom.get("assets-list"),
	liabilitiesList: utils.dom.get("liabilities-list"),
	incomeCategoriesList: utils.dom.get("income-categories-list"),
	expenseCategoriesList: utils.dom.get("expense-categories-list"),
	balanceAdjustmentList: utils.dom.get("balance-adjustment-list"),
	creditCardRulesContainer: utils.dom.get("credit-card-rules-container"),
	scanExcludeKeywordsList: utils.dom.get("scan-exclude-keywords-list"),
	scanSettingsList: utils.dom.get("scan-settings-list"),
	scanCategoryRulesList: utils.dom.get("scan-category-rules-list"),
	// アクションボタン
	addAssetButton: utils.dom.get("add-asset-button"),
	addLiabilityButton: utils.dom.get("add-liability-button"),
	addIncomeCategoryButton: utils.dom.get("add-income-category-button"),
	addExpenseCategoryButton: utils.dom.get("add-expense-category-button"),
	addCardRuleButton: utils.dom.get("add-card-rule-button"),
	addScanExcludeKeywordButton: utils.dom.get("add-scan-exclude-keyword-button"),
	addScanCategoryRuleButton: utils.dom.get("add-scan-category-rule-button"),
	// アイコンピッカー
	iconPickerModal: utils.dom.get("icon-picker-modal"),
	iconPickerGrid: utils.dom.get("icon-picker-grid"),
});

/**
 * 項目編集中（インラインフォーム表示中）かどうかを示すフラグ。
 * Escapeキーの挙動制御などに使用する。
 * @type {boolean}
 */
let isEditingState = false;

/**
 * SortableJSのインスタンスを保持するオブジェクト。
 * ドラッグアンドドロップによる並べ替え機能を提供する。
 * @type {object}
 */
let sortables = {
	asset: null,
	liability: null,
	income: null,
	expense: null,
};

/**
 * 設定モーダルを初期化し、イベントリスナーを設定する。
 * @param {object} dependencies - main.jsから渡される依存関係。
 */
export function init(dependencies) {
	// Dependency Injection
	store = dependencies.store;
	billing = dependencies.billing;
	getState = dependencies.getState;
	refreshApp = dependencies.refresh;
	reloadApp = dependencies.reloadApp;

	const {
		closeButton,
		backButton,
		saveGeneralSettingsButton,
		aiAdvisorToggle,
		menu,
		addAssetButton,
		assetsList,
		addLiabilityButton,
		liabilitiesList,
		addIncomeCategoryButton,
		incomeCategoriesList,
		addExpenseCategoryButton,
		expenseCategoriesList,
		addCardRuleButton,
		addScanExcludeKeywordButton,
		scanExcludeKeywordsList,
		addScanCategoryRuleButton,
		modal,
		iconPickerModal,
	} = getElements();

	utils.dom.on(closeButton, "click", closeModal);
	utils.dom.on(backButton, "click", () => navigateTo("#settings-menu"));
	utils.dom.on(saveGeneralSettingsButton, "click", () => {
		utils.withLoading(saveGeneralSettingsButton, async () => {
			handleSaveDisplayPeriod();
		});
	});

	// AIアドバイザー設定の即時反映
	utils.dom.on(aiAdvisorToggle, "change", async (e) => {
		const isEnabled = e.target.checked;
		try {
			await store.updateConfig({
				"general.enableAiAdvisor": isEnabled,
			});
			// main.js の state も更新する (getState()経由で参照可能)
			const state = getState();
			if (!state.config.general) state.config.general = {};
			state.config.general.enableAiAdvisor = isEnabled;

			notification.success(
				`AIアドバイザーを${isEnabled ? "有効" : "無効"}にしました。`
			);
			await refreshApp(); // UI（Advisorカード）を再描画
		} catch (error) {
			console.error("AI設定の更新に失敗:", error);
			notification.error("設定の更新に失敗しました。");
			e.target.checked = !isEnabled;
		}
	});

	// メニュー遷移のイベントを設定する
	utils.dom.on(menu, "click", (e) => {
		e.preventDefault();
		const link = e.target.closest(".settings-menu-link");
		if (link) navigateTo(link.getAttribute("href"));
	});

	// 「追加」ボタンのイベントリスナーを設定する
	utils.dom.on(addAssetButton, "click", () =>
		createInlineInput(assetsList, "asset", "新しい資産口座名")
	);
	utils.dom.on(addLiabilityButton, "click", () =>
		createInlineInput(liabilitiesList, "liability", "新しい負債口座名")
	);
	utils.dom.on(addIncomeCategoryButton, "click", () =>
		createInlineInput(incomeCategoriesList, "income", "新しい収入カテゴリ名")
	);
	utils.dom.on(addExpenseCategoryButton, "click", () =>
		createInlineInput(expenseCategoriesList, "expense", "新しい支出カテゴリ名")
	);

	utils.dom.on(addCardRuleButton, "click", () => renderCardRuleForm());

	utils.dom.on(addScanExcludeKeywordButton, "click", () =>
		createInlineInput(
			scanExcludeKeywordsList,
			"scan-exclude",
			"除外するキーワード"
		)
	);
	utils.dom.on(addScanCategoryRuleButton, "click", () =>
		renderScanCategoryRuleForm()
	);

	// 動的に生成される要素に対するイベント委任を設定する
	utils.dom.on(modal, "click", (e) => {
		if (e.target === modal) closeModal();
		if (e.target.closest(".edit-item-button")) handleEditItemToggle(e);
		if (e.target.closest(".remove-item-button")) handleRemoveItem(e);
		if (e.target.closest(".change-icon-button")) handleChangeIcon(e);
		if (e.target.closest(".remove-scan-setting-button"))
			handleRemoveScanSetting(e);
		if (e.target.closest(".edit-scan-rule-button")) {
			const btn = e.target.closest(".edit-scan-rule-button");
			renderScanCategoryRuleForm(btn.dataset.keyword);
		}
		if (e.target.closest(".adjust-balance-button")) {
			const btn = e.target.closest(".adjust-balance-button");
			utils.withLoading(btn, async () => handleAdjustBalance(e));
		}
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
	utils.dom.on(iconPickerModal, "click", (e) => {
		const button = e.target.closest(".icon-picker-button");
		if (button && window._onIconSelect) {
			window._onIconSelect(button.dataset.icon);
			utils.dom.hide(iconPickerModal);
		} else if (e.target === iconPickerModal) {
			utils.dom.hide(iconPickerModal);
		}
	});

	// モーダル表示中のグローバルなキーボードショートカット
	document.addEventListener("keydown", (e) => {
		if (modal.classList.contains("hidden")) return;
		if (e.isComposing || e.key === "Process" || e.keyCode === 229) return;
		else if (e.key === "Enter") {
			if (
				e.target.closest("#balance-adjustment-list") &&
				e.target.tagName === "INPUT"
			) {
				e.target.nextElementSibling?.click();
			}
		} else if (e.key === "Escape") {
			if (utils.dom.isVisible(iconPickerModal)) {
				utils.dom.hide(iconPickerModal);
				return;
			}
			if (!isEditingState) {
				closeModal();
			}
			isEditingState = false;
		}
	});
}

/**
 * 設定モーダルを開く。
 * 最新のデータを取得して描画し、Sortable.jsを初期化する。
 */
export function openModal() {
	const { luts, config } = getState();
	render(luts, config);

	navigateTo("#settings-menu");
	initializeSortable();

	const { displayPeriodSelector, aiAdvisorToggle, modal } = getElements();

	displayPeriodSelector.value =
		config.displayPeriod || config.general?.displayPeriod || 3;
	aiAdvisorToggle.checked = config.general?.enableAiAdvisor || false;

	utils.dom.show(modal);
	utils.toggleBodyScrollLock(true);
}

/**
 * 設定モーダルを閉じる。
 */
export function closeModal() {
	const { modal } = getElements();
	utils.toggleBodyScrollLock(false);
	utils.dom.hide(modal);
	setTimeout(() => {
		navigateTo("#settings-menu");
		isEditingState = false;
	}, 200);
}

export function isOpen() {
	const { modal } = getElements();
	return utils.dom.isVisible(modal);
}

function navigateTo(paneId) {
	const isMenu = paneId === "#settings-menu";
	const { menu, backButton, panes, title } = getElements();

	utils.dom.toggle(menu, isMenu);
	utils.dom.toggle(backButton, !isMenu);

	panes.forEach((p) => {
		const isTarget = `#${p.id}` === paneId;
		utils.dom.toggle(p, isTarget);
		if (isTarget) {
			const link = menu.querySelector(`a[href="${paneId}"]`);
			utils.dom.setText(title, link ? link.textContent : "設定");
		}
	});

	if (isMenu) utils.dom.setText(title, "設定");
}

/**
 * 設定モーダル内の全リストを描画する。
 * 口座、カテゴリ、残高調整、クレジットカード設定の各リストを更新する。
 * @param {object} luts - 口座とカテゴリのルックアップテーブル。
 * @param {object} config - ユーザー設定情報。
 * @returns {void}
 */
export function render(luts, config) {
	appLuts = luts;
	appConfig = config;
	const { transactions, accountBalances } = getState();

	const usedAccounts = new Set();
	const usedCategories = new Set();
	transactions.forEach((t) => {
		if (t.type === "transfer") {
			if (t.fromAccountId) usedAccounts.add(t.fromAccountId);
			if (t.toAccountId) usedAccounts.add(t.toAccountId);
		} else {
			if (t.accountId) usedAccounts.add(t.accountId);
			if (t.categoryId) usedCategories.add(t.categoryId);
		}
	});

	const constraints = {
		accounts: [...usedAccounts],
		categories: [...usedCategories],
		accountBalances,
	};

	const accounts = [...appLuts.accounts.values()].filter((a) => !a.isDeleted);
	const categories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted
	);

	const {
		assetsList,
		liabilitiesList,
		incomeCategoriesList,
		expenseCategoriesList,
	} = getElements();

	renderList(
		assetsList,
		accounts.filter((a) => a.type === "asset"),
		"account",
		constraints
	);
	renderList(
		liabilitiesList,
		accounts.filter((a) => a.type === "liability"),
		"account",
		constraints
	);
	renderList(
		incomeCategoriesList,
		categories.filter((c) => c.type === "income"),
		"category",
		constraints
	);
	renderList(
		expenseCategoriesList,
		categories.filter((c) => c.type === "expense"),
		"category",
		constraints
	);

	renderBalanceAdjustmentList(
		accounts.filter((a) => a.type === "asset"),
		constraints.accountBalances
	);
	renderCreditCardRulesList();
	renderScanSettingsList();
}

/**
 * 口座またはカテゴリのリストをレンダリングする汎用関数。
 * 編集・削除ボタンの制御や、ドラッグ＆ドロップ用のハンドルを含めてHTMLを生成する。
 * @private
 * @param {HTMLElement} listElement - 描画対象のリスト要素。
 * @param {Array<object>} items - 描画する項目の配列。
 * @param {string} itemType - 項目の種類 ('account' または 'category')。
 * @param {object} constraints - 削除可否などを判断するための制約情報。
 * @returns {void}
 */
function renderList(listElement, items, itemType, constraints) {
	const sortedItems = utils.sortItems(items);
	utils.dom.setHtml(
		listElement,
		sortedItems
			.map((item) => {
				let isEditable = true;
				let isDeletable = true;
				let tooltip = "";

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
						? `<button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-neutral-600 transition change-icon-button mr-2" data-item-id="${
								item.id
						  }"><i class="${
								item.icon || "fa-solid fa-question"
						  }"></i></button>`
						: "";
				const editButtonHtml = isEditable
					? `<button class="text-primary hover:text-primary-dark p-2 rounded-lg hover:bg-white transition edit-item-button" title="名前を編集"><i class="fas fa-pen pointer-events-none"></i></button>`
					: "";
				const deleteButtonHtml = isDeletable
					? `<button class="text-danger hover:text-danger-dark p-2 rounded-lg hover:bg-white transition remove-item-button" data-item-id="${item.id}" data-item-name="${item.name}" data-item-type="${itemType}" title="削除"><i class="fas fa-trash-alt pointer-events-none"></i></button>`
					: `<div class="p-2 text-neutral-400 cursor-help" title="${tooltip}"><i class="fas fa-lock"></i></div>`;

				return `<div class="flex items-center justify-between p-3 rounded-md bg-neutral-50 mb-2 group" data-id="${
					item.id
				}"><div class="flex items-center flex-grow min-w-0"><i class="fas fa-grip-vertical text-neutral-500 hover:text-neutral-700 mr-3 cursor-move handle p-2"></i>${iconHtml}<div class="item-name-wrapper flex-grow min-w-0 mr-2"><span class="item-name block truncate font-medium text-neutral-900 text-base">${utils.escapeHtml(
					item.name
				)}</span><input type="text" class="item-name-input hidden w-full border border-neutral-300 rounded-lg px-2 h-9 text-sm text-neutral-900 focus:ring-2 focus:ring-primary focus:border-primary" value="${utils.escapeHtml(
					item.name
				)}"></div></div><div class="flex items-center gap-1 shrink-0">${editButtonHtml}${deleteButtonHtml}</div></div>`;
			})
			.join("")
	);
}

/**
 * 残高調整リストを描画する。
 * 各資産口座の現在の残高を表示し、調整ボタンを配置する。
 * @private
 * @param {Array<object>} accounts - 資産口座の配列。
 * @param {object} balances - 全口座の残高情報。
 * @returns {void}
 */
function renderBalanceAdjustmentList(accounts, balances) {
	const sortedAccounts = utils.sortItems(accounts);
	const { balanceAdjustmentList } = getElements();
	utils.dom.setHtml(
		balanceAdjustmentList,
		sortedAccounts
			.map(
				(account) =>
					`<div class="flex flex-col md:grid md:grid-cols-5 md:items-center gap-2 md:gap-4 p-3 rounded-md bg-neutral-50"><span class="font-medium text-neutral-900 md:col-span-2">${
						account.name
					}</span><div class="flex items-center gap-2 w-full md:col-span-3"><input type="number" class="w-full border-neutral-300 rounded-lg px-2 h-9 text-sm text-right text-neutral-900 focus:ring-2 focus:ring-primary focus:border-primary" placeholder="現在の残高: ¥${(
						balances[account.id] || 0
					).toLocaleString()}" data-account-id="${
						account.id
					}" data-current-balance="${
						balances[account.id] || 0
					}"><button class="adjust-balance-button bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary-dark shrink-0 text-sm font-bold">調整</button></div></div>`
			)
			.join("")
	);
}

/**
 * クレジットカードの支払いルールリストを描画する。
 * 設定済みのルールを表示し、未設定のカードがある場合は追加ボタンを表示する。
 * @private
 * @returns {void}
 */
function renderCreditCardRulesList() {
	const { config, luts } = getState();
	const rules = config.creditCardRules || {};
	const liabilityAccounts = [...luts.accounts.values()].filter(
		(acc) => acc.type === "liability" && !acc.isDeleted
	);
	const sortedAccounts = utils.sortItems(liabilityAccounts);
	const monthOffsetMap = { 1: "翌月", 2: "翌々月", 3: "3ヶ月後" };
	let html = "";
	const unconfiguredCards = sortedAccounts.filter((acc) => !rules[acc.id]);
	const { addCardRuleButton, creditCardRulesContainer } = getElements();
	utils.dom.toggle(addCardRuleButton, unconfiguredCards.length > 0);
	for (const card of sortedAccounts) {
		const rule = rules[card.id];
		if (!rule) continue;
		const paymentAccountName =
			luts.accounts.get(rule.defaultPaymentAccountId)?.name || "未設定";
		const paymentTimingText = monthOffsetMap[rule.paymentMonthOffset] || "翌月";
		html += `<div class="flex items-center justify-between p-3 rounded-md bg-neutral-50 mb-2 border border-neutral-200"><div class="flex items-center gap-4 flex-grow min-w-0"><div class="flex items-center gap-3 shrink-0"><i class="${
			card.icon || "fa-solid fa-credit-card"
		} text-neutral-600"></i><h4 class="font-medium text-neutral-800">${utils.escapeHtml(
			card.name
		)}</h4></div><div class="hidden sm:flex items-center gap-3 text-xs text-neutral-600 font-medium overflow-hidden whitespace-nowrap text-ellipsis"><span class="bg-white px-2 py-0.5 rounded border border-neutral-300">${
			rule.closingDay
		}日締め</span><i class="fas fa-arrow-right text-neutral-400"></i><span class="bg-white px-2 py-0.5 rounded border border-neutral-300">${paymentTimingText} ${
			rule.paymentDay
		}日払い</span><span class="text-neutral-600">(${utils.escapeHtml(
			paymentAccountName
		)})</span></div><div class="sm:hidden text-xs text-neutral-600 leading-snug"><div class="whitespace-nowrap font-medium">${
			rule.closingDay
		}日締め</div><div class="whitespace-nowrap"><i class="fas fa-arrow-right text-[10px] text-neutral-400 mr-1"></i>${paymentTimingText} ${
			rule.paymentDay
		}日払い</div></div></div><div class="flex items-center gap-1 shrink-0 ml-2"><button class="text-primary hover:text-primary-dark p-2 rounded-lg hover:bg-white transition edit-card-rule-button" data-card-id="${
			card.id
		}"><i class="fas fa-pen pointer-events-none"></i></button><button class="text-danger hover:text-danger-dark p-2 rounded-lg hover:bg-white transition delete-card-rule-button" data-card-id="${
			card.id
		}"><i class="fas fa-trash-alt pointer-events-none"></i></button></div></div>`;
	}
	utils.dom.setHtml(creditCardRulesContainer, html);
}

/**
 * クレジットカードルールの追加・編集フォームを動的に生成して表示する。
 * 既存のルールがある場合は編集モード、なければ新規作成モードとなる。
 * @private
 * @param {string|null} [cardIdToEdit=null] - 編集対象のカードID。新規作成時はnull。
 * @return {void}
 */
function renderCardRuleForm(cardIdToEdit = null) {
	isEditingState = true;
	const { config, luts } = getState();
	const rules = config.creditCardRules || {};
	const rule = cardIdToEdit ? rules[cardIdToEdit] : {};
	const isEditing = !!cardIdToEdit;
	document.getElementById("card-rule-edit-panel")?.remove();
	const assetAccounts = utils.sortItems(
		[...luts.accounts.values()].filter(
			(a) => a.type === "asset" && !a.isDeleted
		)
	);
	const assetOptionsHtml = assetAccounts
		.map(
			(acc) =>
				`<option value="${acc.id}" ${
					isEditing && acc.id === rule.defaultPaymentAccountId ? "selected" : ""
				}>${acc.name}</option>`
		)
		.join("");
	let cardOptions = "";
	if (!isEditing) {
		const unconfigured = utils.sortItems(
			[...luts.accounts.values()].filter(
				(a) => a.type === "liability" && !a.isDeleted && !rules[a.id]
			)
		);
		cardOptions = unconfigured
			.map((c) => `<option value="${c.id}">${c.name}</option>`)
			.join("");
	}
	const panel = document.createElement("div");
	panel.id = "card-rule-edit-panel";
	panel.className =
		"p-3 rounded-md border border-primary-ring bg-primary-light space-y-3 text-sm";
	const inputClass =
		"border-neutral-300 rounded-lg px-2 h-9 text-sm w-full focus:ring-2 focus:ring-primary focus:border-primary text-neutral-900";
	utils.dom.setHtml(
		panel,
		`<h4 class="font-bold text-neutral-900 mb-1">${
			isEditing ? "ルールを編集" : "新しいルールを追加"
		}</h4>${
			!isEditing
				? `<div class="grid grid-cols-12 items-center gap-2"><label class="col-span-4 font-semibold text-neutral-800">対象カード</label><div class="col-span-8"><select id="card-rule-id" class="${inputClass}">${cardOptions}</select></div></div>`
				: ""
		}<div class="grid grid-cols-12 items-center gap-2"><label class="col-span-4 font-semibold text-neutral-800">締め日</label><div class="col-span-8 flex items-center gap-2"><input type="number" id="card-rule-closing" class="${inputClass}" value="${
			rule.closingDay || 15
		}" min="1" max="31"><span class="whitespace-nowrap text-neutral-900">日</span></div></div><div class="grid grid-cols-12 items-center gap-2"><label class="col-span-4 font-semibold text-neutral-800">支払日</label><div class="col-span-8 flex items-center gap-2"><select id="card-rule-payment-month" class="${inputClass} min-w-[80px]">${[
			1, 2, 3,
		]
			.map(
				(m) =>
					`<option value="${m}" ${
						(rule.paymentMonthOffset || 1) === m ? "selected" : ""
					}>${m === 1 ? "翌月" : m === 2 ? "翌々月" : "3ヶ月後"}</option>`
			)
			.join(
				""
			)}</select><input type="number" id="card-rule-payment-day" class="${inputClass}" value="${
			rule.paymentDay || 10
		}" min="1" max="31"><span class="whitespace-nowrap text-neutral-900">日</span></div></div><div class="grid grid-cols-12 items-center gap-2"><label class="col-span-4 font-semibold text-neutral-800">支払元口座</label><div class="col-span-8"><select id="card-rule-account" class="${inputClass}">${assetOptionsHtml}</select></div></div><div class="flex justify-end gap-2 pt-2 border-t border-primary-ring/30 mt-1"><button id="cancel-card-rule-button" class="bg-white border border-neutral-300 text-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-50 text-xs font-bold transition">キャンセル</button><button id="save-card-rule-button" class="bg-primary text-white px-4 py-1.5 rounded-lg hover:bg-primary-dark shadow-sm text-xs font-bold transition">保存</button></div>`
	);
	const { creditCardRulesContainer } = getElements();
	creditCardRulesContainer.appendChild(panel);
	const saveBtn = panel.querySelector("#save-card-rule-button");
	const cancelBtn = panel.querySelector("#cancel-card-rule-button");
	const closingInput = panel.querySelector("#card-rule-closing");
	const paymentDayInput = panel.querySelector("#card-rule-payment-day");
	const sanitizeIntInput = (e) => {
		e.target.value = e.target.value.replace(/[^0-9]/g, "");
	};
	utils.dom.on(closingInput, "input", sanitizeIntInput);
	utils.dom.on(paymentDayInput, "input", sanitizeIntInput);
	const handleSave = async () => {
		const targetCardId = isEditing
			? cardIdToEdit
			: panel.querySelector("#card-rule-id").value;
		if (!targetCardId)
			return notification.error("対象カードを選択してください。");
		const closingDay = parseInt(closingInput.value, 10);
		const paymentDay = parseInt(paymentDayInput.value, 10);
		if (isNaN(closingDay) || closingDay < 1 || closingDay > 31) {
			return notification.error("締め日は1〜31の範囲で入力してください。");
		}
		if (isNaN(paymentDay) || paymentDay < 1 || paymentDay > 31) {
			return notification.error("支払日は1〜31の範囲で入力してください。");
		}
		const ruleData = {
			closingDay,
			paymentDay,
			paymentMonthOffset: parseInt(
				panel.querySelector("#card-rule-payment-month").value,
				10
			),
			defaultPaymentAccountId: panel.querySelector("#card-rule-account").value,
			lastPaidCycle: rule.lastPaidCycle || null,
		};
		await store.updateConfig(
			{ creditCardRules: { [targetCardId]: ruleData } },
			true
		);
		await refreshApp(true);
		panel.remove();
		isEditingState = false;
	};
	utils.dom.on(saveBtn, "click", () => utils.withLoading(saveBtn, handleSave));
	utils.dom.on(cancelBtn, "click", () => {
		panel.remove();
		isEditingState = false;
	});
	utils.dom.on(panel, "keydown", (e) => {
		if (e.isComposing || e.key === "Process" || e.keyCode === 229) return;
		else if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			e.stopPropagation();
			cancelBtn.click();
		}
	});
}

/**
 * スキャン設定（除外キーワード、カテゴリ分類ルール）のリストを描画する。
 * @private
 * @return {void}
 */
function renderScanSettingsList() {
	const { config, luts } = getState();
	const scanSettings = config.scanSettings || {
		excludeKeywords: [],
		categoryRules: [],
	};
	const { scanExcludeKeywordsList, scanCategoryRulesList } = getElements();
	utils.dom.setHtml(
		scanExcludeKeywordsList,
		(scanSettings.excludeKeywords || [])
			.map(
				(keyword) =>
					`<div class="flex items-center justify-between p-3 rounded-md bg-neutral-50 mb-2 group"><span class="font-medium text-neutral-900">${utils.escapeHtml(
						keyword
					)}</span><button class="text-danger hover:text-danger-dark p-2 rounded-lg hover:bg-white transition remove-scan-setting-button" data-type="exclude" data-keyword="${utils.escapeHtml(
						keyword
					)}" title="削除"><i class="fas fa-trash-alt pointer-events-none"></i></button></div>`
			)
			.join("")
	);
	utils.dom.setHtml(
		scanCategoryRulesList,
		(scanSettings.categoryRules || [])
			.map((rule) => {
				const category = luts.categories.get(rule.categoryId);
				const categoryName = category ? category.name : "不明なカテゴリ";
				return `<div class="flex items-center justify-between p-3 rounded-md bg-neutral-50 mb-2 group"><div class="flex items-center gap-3 overflow-hidden"><span class="font-medium text-neutral-900 whitespace-nowrap">"${utils.escapeHtml(
					rule.keyword
				)}"</span><i class="fas fa-arrow-right text-neutral-400 text-xs"></i><span class="text-sm text-neutral-600 truncate">${utils.escapeHtml(
					categoryName
				)}</span></div><div class="flex items-center gap-1 shrink-0"><button class="text-primary hover:text-primary-dark p-2 rounded-lg hover:bg-white transition edit-scan-rule-button" data-keyword="${utils.escapeHtml(
					rule.keyword
				)}" title="編集"><i class="fas fa-pen pointer-events-none"></i></button><button class="text-danger hover:text-danger-dark p-2 rounded-lg hover:bg-white transition remove-scan-setting-button" data-type="rule" data-keyword="${utils.escapeHtml(
					rule.keyword
				)}" title="削除"><i class="fas fa-trash-alt pointer-events-none"></i></button></div></div>`;
			})
			.join("")
	);
}

/**
 * スキャンカテゴリ分類ルールの追加・編集フォームを表示する。
 * @private
 * @param {string|null} [keywordToEdit=null] - 編集対象のキーワード。新規作成時はnull。
 * @return {void}
 */
function renderScanCategoryRuleForm(keywordToEdit = null) {
	isEditingState = true;
	const { config, luts } = getState();
	const scanSettings = config.scanSettings || { categoryRules: [] };
	const rules = scanSettings.categoryRules || [];
	const rule = keywordToEdit
		? rules.find((r) => r.keyword === keywordToEdit)
		: {};
	const isEditing = !!keywordToEdit;
	document.getElementById("scan-rule-edit-panel")?.remove();
	const categories = utils.sortItems(
		[...luts.categories.values()].filter((c) => !c.isDeleted)
	);
	const incomeOptions = categories
		.filter((c) => c.type === "income")
		.map(
			(c) =>
				`<option value="${c.id}" ${
					isEditing && c.id === rule.categoryId ? "selected" : ""
				}>${c.name}</option>`
		)
		.join("");
	const expenseOptions = categories
		.filter((c) => c.type === "expense")
		.map(
			(c) =>
				`<option value="${c.id}" ${
					isEditing && c.id === rule.categoryId ? "selected" : ""
				}>${c.name}</option>`
		)
		.join("");
	const panel = document.createElement("div");
	panel.id = "scan-rule-edit-panel";
	panel.className =
		"p-3 rounded-md border border-primary-ring bg-primary-light space-y-3 text-sm";
	const inputClass =
		"border-neutral-300 rounded-lg px-2 h-9 text-sm w-full focus:ring-2 focus:ring-primary focus:border-primary text-neutral-900";
	utils.dom.setHtml(
		panel,
		`<h4 class="font-bold text-neutral-900 mb-1">${
			isEditing ? "ルールを編集" : "新しいルールを追加"
		}</h4><div class="grid grid-cols-12 items-center gap-2"><label class="col-span-4 font-semibold text-neutral-800">キーワード</label><div class="col-span-8"><input type="text" id="scan-rule-keyword" class="${inputClass}" value="${
			rule.keyword || ""
		}" placeholder="例: スーパー, コンビニ"></div></div><div class="grid grid-cols-12 items-center gap-2"><label class="col-span-4 font-semibold text-neutral-800">分類先カテゴリ</label><div class="col-span-8"><select id="scan-rule-category" class="${inputClass}"><optgroup label="支出">${expenseOptions}</optgroup><optgroup label="収入">${incomeOptions}</optgroup></select></div></div><div class="flex justify-end gap-2 pt-2 border-t border-primary-ring/30 mt-1"><button id="cancel-scan-rule-button" class="bg-white border border-neutral-300 text-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-50 text-xs font-bold transition">キャンセル</button><button id="save-scan-rule-button" class="bg-primary text-white px-4 py-1.5 rounded-lg hover:bg-primary-dark shadow-sm text-xs font-bold transition">保存</button></div>`
	);
	const { scanCategoryRulesList } = getElements();
	scanCategoryRulesList.prepend(panel);
	const keywordInput = panel.querySelector("#scan-rule-keyword");
	keywordInput.focus();
	const saveBtn = panel.querySelector("#save-scan-rule-button");
	const cancelBtn = panel.querySelector("#cancel-scan-rule-button");
	const handleSave = async () => {
		const keyword = keywordInput.value.trim();
		const categoryId = panel.querySelector("#scan-rule-category").value;
		if (!keyword) return notification.error("キーワードを入力してください。");
		if (!categoryId) return notification.error("カテゴリを選択してください。");
		const existingRule = rules.find((r) => r.keyword === keyword);
		if (existingRule && (!isEditing || keyword !== keywordToEdit)) {
			return notification.error("このキーワードのルールは既に存在します。");
		}
		const newRules = isEditing
			? rules.map((r) =>
					r.keyword === keywordToEdit ? { keyword, categoryId } : r
			  )
			: [...rules, { keyword, categoryId }];
		await saveScanSettings({ ...scanSettings, categoryRules: newRules });
		panel.remove();
		isEditingState = false;
	};
	utils.dom.on(saveBtn, "click", () => utils.withLoading(saveBtn, handleSave));
	utils.dom.on(cancelBtn, "click", () => {
		panel.remove();
		isEditingState = false;
	});
	utils.dom.on(panel, "keydown", (e) => {
		if (e.isComposing || e.key === "Process" || e.keyCode === 229) return;
		else if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			e.stopPropagation();
			cancelBtn.click();
		}
	});
}

/**
 * 口座・カテゴリ追加用のインライン入力フォームを生成する。
 * 既存のフォームがあれば削除し、新しいフォームをリストに追加する。
 * @private
 * @param {HTMLElement} listElement - フォームを追加するリスト要素。
 * @param {string} listName - 項目の種類 ('asset', 'liability', 'income', 'expense')。
 * @param {string} placeholder - 入力フィールドのプレースホルダーテキスト。
 * @return {void}
 */
function createInlineInput(listElement, listName, placeholder) {
	const existingInput = listElement.querySelector(".inline-input-wrapper");
	if (existingInput) existingInput.remove();
	isEditingState = true;
	const inputWrapper = document.createElement("div");
	inputWrapper.className =
		"inline-input-wrapper flex items-center gap-2 p-2 rounded-md bg-neutral-100";
	utils.dom.setHtml(
		inputWrapper,
		`<input type="text" class="flex-grow border-neutral-300 rounded-lg px-2 h-9 text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="${placeholder}"><button class="save-inline-button text-success hover:text-success-dark p-1"><i class="fas fa-check"></i></button><button class="cancel-inline-button text-danger hover:text-danger-dark p-1"><i class="fas fa-times"></i></button>`
	);
	listElement.appendChild(inputWrapper);
	const inputField = inputWrapper.querySelector("input");
	inputField.focus();
	const handleAdd = () => {
		utils.withLoading(
			inputWrapper.querySelector(".save-inline-button"),
			async () => {
				let success = false;
				if (listName === "scan-exclude") {
					success = await handleAddScanExcludeKeyword(inputField.value);
				} else {
					success = await handleAddItem(listName, inputField.value);
				}
				if (success) {
					inputWrapper.remove();
					isEditingState = false;
				}
			}
		);
	};
	const handleCancel = () => {
		inputWrapper.remove();
		isEditingState = false;
	};
	utils.dom.on(
		inputWrapper.querySelector(".save-inline-button"),
		"click",
		handleAdd
	);
	utils.dom.on(
		inputWrapper.querySelector(".cancel-inline-button"),
		"click",
		handleCancel
	);
	utils.dom.on(inputField, "keydown", (e) => {
		if (e.isComposing || e.key === "Process" || e.keyCode === 229) return;
		else if (e.key === "Enter") handleAdd();
		else if (e.key === "Escape") {
			e.stopPropagation();
			handleCancel();
		}
	});
}

/**
 * 「一般設定」の保存ボタンがクリックされたときの処理。
 * 選択された表示期間を保存する。
 * @private
 * @returns {void}
 */
async function handleSaveDisplayPeriod() {
	const { displayPeriodSelector } = getElements();
	const newPeriod = Number(displayPeriodSelector.value);
	await store.updateConfig({
		displayPeriod: deleteField(), // legacy
		"general.displayPeriod": newPeriod,
	});
	reloadApp();
}

/**
 * 新しい項目（口座・カテゴリ）を追加する処理。
 * 名前が空でないか、重複していないかを検証してから追加する。
 * @private
 * @async
 * @param {string} type - 項目の種類 ('asset', 'liability', 'income', 'expense')。
 * @param {string} name - 追加する項目の名前。
 * @returns {boolean} 追加が成功した場合はtrue、失敗またはキャンセルされた場合はfalse。
 */
async function handleAddItem(type, name) {
	const trimmedName = name ? name.trim() : "";
	if (trimmedName === "") {
		return notification.error("項目名を入力してください。");
	}
	const { luts } = getState();
	const allNames = [
		...[...luts.accounts.values()].map((a) => a.name.toLowerCase()),
		...[...luts.categories.values()].map((c) => c.name.toLowerCase()),
	];
	if (allNames.includes(trimmedName.toLowerCase())) {
		return notification.error(
			`「${trimmedName}」という名前は既に使用されています。`
		);
	}
	try {
		let currentCount = 0;
		if (type === "asset" || type === "liability") {
			currentCount = luts.accounts.size;
		} else {
			currentCount = luts.categories.size;
		}
		const dataToSave = { type, name: trimmedName, order: currentCount };
		await store.addItem(dataToSave);
		await refreshApp();
		return true;
	} catch (e) {
		notification.error(`追加中にエラーが発生しました: ${e.message}`);
		return false;
	}
}

/**
 * 項目名の編集モードをトグルし、保存処理を行う。
 * 編集モード開始時はUIを切り替え、終了時は変更内容を検証して保存する。
 * @private
 * @async
 * @param {Event} e - クリックイベントオブジェクト。
 * @return {void}
 */
async function handleEditItemToggle(e) {
	const button = e.target.closest(".edit-item-button");
	const row = button.closest("[data-id]");
	const wrapper = row.querySelector(".item-name-wrapper");
	const nameSpan = wrapper.querySelector(".item-name");
	const nameInput = wrapper.querySelector(".item-name-input");
	const itemId = row.dataset.id;
	const { luts } = getState();
	const itemType = luts.accounts.has(itemId) ? "account" : "category";
	if (PROTECTED_DEFAULTS.includes(nameSpan.textContent)) {
		return notification.error("このカテゴリは編集できません。");
	}
	const isCurrentlyEditing = !nameInput.classList.contains("hidden");
	if (isCurrentlyEditing) {
		const newName = nameInput.value.trim();
		const oldName = nameSpan.textContent;
		if (newName === oldName) {
			return toggleEditUI(wrapper, false);
		}
		const allNames = [
			...[...luts.accounts.values()].map((a) => a.name.toLowerCase()),
			...[...luts.categories.values()].map((c) => c.name.toLowerCase()),
		];
		if (allNames.includes(newName.toLowerCase())) {
			return notification.error(
				`「${newName}」という名前は既に使用されています。`
			);
		}
		try {
			await store.updateItem(itemId, itemType, { name: newName });
			await refreshApp();
			toggleEditUI(wrapper, false);
		} catch (error) {
			notification.error("名前の変更に失敗しました。");
		}
	} else {
		toggleEditUI(wrapper, true);
		nameInput.onkeydown = (e) => {
			if (e.isComposing || e.key === "Process" || e.keyCode === 229) return;
			else if (e.key === "Enter") {
				e.preventDefault();
				button.click();
			} else if (e.key === "Escape") {
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
	utils.dom.toggle(nameSpan, !isEditing);
	utils.dom.toggle(nameInput, isEditing);
	utils.dom.setHtml(
		editButton,
		isEditing ? '<i class="fas fa-check"></i>' : '<i class="fas fa-pen"></i>'
	);
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
 * 削除確認を行い、カテゴリの場合は振替先を指定して削除する。
 * @private
 * @async
 * @param {Event} e - クリックイベントオブジェクト。
 * @returns {Promise<void>} 処理完了までのPromise。
 */
async function handleRemoveItem(e) {
	const button = e.target.closest(".remove-item-button");
	const { itemId, itemName, itemType } = button.dataset;
	const { luts } = getState();

	if (itemType === "account") {
		if (
			confirm(
				`口座「${itemName}」を本当に削除しますか？\n（取引履歴は消えません）`
			)
		) {
			await store.deleteItem(itemId, "account");
			await refreshApp();
		}
	} else if (itemType === "category") {
		const category = luts.categories.get(itemId);
		const targetName =
			category?.type === "income"
				? PROTECTED_DEFAULTS[0]
				: PROTECTED_DEFAULTS[1];
		if (
			confirm(
				`カテゴリ「${itemName}」を削除しますか？\nこのカテゴリの既存の取引はすべて「${targetName}」に振り替えられます。`
			)
		) {
			const toCategory = [...luts.categories.values()].find(
				(c) => c.name === targetName
			);
			if (!toCategory) {
				return notification.error(
					`振替先のカテゴリ「${targetName}」が見つかりません。`
				);
			}
			await store.remapTransactions(itemId, toCategory.id);
			// After remapping, also update local state to reflect immediately
			const { transactions } = getState();
			transactions.forEach((t) => {
				if (t.categoryId === itemId) t.categoryId = toCategory.id;
			});
			await store.deleteItem(itemId, "category");
			await refreshApp();
		}
	}
}

/**
 * 残高調整ボタンがクリックされたときの処理。
 * 入力された残高と現在の残高の差分を計算し、調整取引を作成する。
 * @private
 * @async
 * @param {Event} e - クリックイベントオブジェクト。
 * @returns {Promise<void>} 処理完了までのPromise。
 */
async function handleAdjustBalance(e) {
	const button = e.target.closest(".adjust-balance-button");
	const input = button.previousElementSibling;
	const { accountId, currentBalance } = input.dataset;
	const { luts } = getState();

	const actualBalance = parseFloat(input.value);
	if (isNaN(actualBalance))
		return notification.error("数値を入力してください。");
	const difference = actualBalance - parseFloat(currentBalance);
	if (difference === 0)
		return notification.error("残高に差がないため、調整は不要です。");
	const accountName = luts.accounts.get(accountId)?.name || "不明な口座";
	if (
		confirm(
			`「${accountName}」の残高を ¥${difference.toLocaleString()} 調整しますか？`
		)
	) {
		const transaction = {
			type: difference > 0 ? "income" : "expense",
			date: utils.getToday(),
			amount: Math.abs(difference),
			categoryId: utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID,
			accountId: accountId,
			description: "残高のズレを実績値に調整",
			memo: `調整前の残高: ¥${parseFloat(currentBalance).toLocaleString()}`,
		};
		await store.saveTransaction(transaction);
		await refreshApp(true); // reload data
	}
}

/**
 * 口座アイコンの変更ボタンがクリックされたときの処理。
 * アイコンピッカーを開き、選択されたアイコンを保存する。
 * @private
 * @async
 * @param {Event} e - クリックイベントオブジェクト。
 * @returns {Promise<void>} 処理完了までのPromise。
 */
async function handleChangeIcon(e) {
	const accountId = e.target.closest(".change-icon-button").dataset.itemId;
	openIconPicker(async (selectedIcon) => {
		try {
			await store.updateItem(accountId, "account", { icon: selectedIcon });
			await refreshApp();
		} catch (error) {
			notification.error("アイコンの変更に失敗しました。");
		}
	});
}

/**
 * クレジットカードルールの削除ボタンがクリックされたときの処理。
 * 確認ダイアログを表示し、承認されたら削除する。
 * @private
 * @async
 * @param {string} cardId - 削除するクレジットカードルールのID。
 * @returns {Promise<void>} 処理完了までのPromise。
 */
async function handleDeleteCardRule(cardId) {
	const { luts } = getState();
	const cardName = luts.accounts.get(cardId)?.name || cardId;
	if (confirm(`「${cardName}」のルールを本当に削除しますか？`)) {
		const fieldPath = `creditCardRules.${cardId}`;
		await store.updateConfig({ [fieldPath]: deleteField() });
		await refreshApp(true);
	}
}

/**
 * スキャン除外キーワードを追加する。
 * @private
 * @async
 * @param {string} keyword - 追加する除外キーワード。
 * @returns {Promise<boolean>} 追加が成功したかどうか。
 */
async function handleAddScanExcludeKeyword(keyword) {
	const trimmedKeyword = keyword ? keyword.trim() : "";
	if (trimmedKeyword === "") {
		notification.error("キーワードを入力してください。");
		return false;
	}
	const { config } = getState();
	const scanSettings = config.scanSettings || { excludeKeywords: [] };
	const currentKeywords = scanSettings.excludeKeywords || [];
	if (currentKeywords.includes(trimmedKeyword)) {
		notification.error("このキーワードは既に登録されています。");
		return false;
	}
	await saveScanSettings({
		...scanSettings,
		excludeKeywords: [...currentKeywords, trimmedKeyword],
	});
	return true;
}

/**
 * スキャン設定（除外キーワード、カテゴリ分類ルール）を削除する。
 * @private
 * @async
 * @param {Event} e - クリックイベントオブジェクト。
 * @returns {Promise<void>} 処理完了までのPromise。
 */
async function handleRemoveScanSetting(e) {
	const button = e.target.closest(".remove-scan-setting-button");
	const { type, keyword } = button.dataset;
	const { config } = getState();
	const scanSettings = config.scanSettings || {};

	if (type === "exclude") {
		if (confirm(`除外キーワード「${keyword}」を削除しますか？`)) {
			const newKeywords = (scanSettings.excludeKeywords || []).filter(
				(k) => k !== keyword
			);
			await saveScanSettings({ ...scanSettings, excludeKeywords: newKeywords });
		}
	} else if (type === "rule") {
		if (confirm(`キーワード「${keyword}」の分類ルールを削除しますか？`)) {
			const newRules = (scanSettings.categoryRules || []).filter(
				(r) => r.keyword !== keyword
			);
			await saveScanSettings({ ...scanSettings, categoryRules: newRules });
		}
	}
}

/**
 * アイコン選択モーダルを開く。
 * 利用可能なアイコン一覧を表示し、クリックイベントを設定する。
 * @private
 * @param {function} callback - アイコンが選択されたときに呼び出されるコールバック関数。
 * @returns {void}
 */
function openIconPicker(callback) {
	window._onIconSelect = callback;
	const { iconPickerGrid, iconPickerModal } = getElements();
	utils.dom.setHtml(
		iconPickerGrid,
		AVAILABLE_ICONS.map(
			(iconClass) =>
				`<button class="p-3 rounded-lg hover:bg-neutral-200 text-2xl flex items-center justify-center icon-picker-button" data-icon="${iconClass}"><i class="${iconClass}"></i></button>`
		).join("")
	);
	utils.dom.show(iconPickerModal);
}

/**
 * SortableJSライブラリを初期化し、リストのドラッグ＆ドロップ並び替えを有効にする。
 * 並び替えが発生したときに、新しい順序を保存するハンドラを呼び出す。
 * @private
 * @returns {void}
 */
function initializeSortable() {
	const handleSort = async (handler, orderedIds) => {
		try {
			await handler(orderedIds);
			await refreshApp();
		} catch (error) {
			notification.error("順序の更新に失敗しました。");
		}
	};

	const createSortable = (element, handler) => {
		return new Sortable(element, {
			animation: 150,
			handle: ".fa-grip-vertical",
			onUpdate: () => {
				const orderedIds = [...element.children].map(
					(child) => child.dataset.id
				);
				handleSort(handler, orderedIds);
			},
		});
	};
	if (sortables.asset) sortables.asset.destroy();
	if (sortables.liability) sortables.liability.destroy();
	if (sortables.income) sortables.income.destroy();
	if (sortables.expense) sortables.expense.destroy();
	const {
		assetsList,
		liabilitiesList,
		incomeCategoriesList,
		expenseCategoriesList,
	} = getElements();
	sortables.asset = createSortable(assetsList, store.updateAccountOrder);
	sortables.liability = createSortable(
		liabilitiesList,
		store.updateAccountOrder
	);
	sortables.income = createSortable(
		incomeCategoriesList,
		store.updateCategoryOrder
	);
	sortables.expense = createSortable(
		expenseCategoriesList,
		store.updateCategoryOrder
	);
}

/**
 * スキャン設定を保存し、画面を再描画する。
 * @private
 * @async
 * @param {Object} newSettings - 保存するスキャン設定オブジェクト。
 * @returns {Promise<void>} 処理完了までのPromise。
 */
async function saveScanSettings(newSettings) {
	try {
		await store.updateConfig({ scanSettings: newSettings });
		await refreshApp();
	} catch (error) {
		console.error("スキャン設定の保存に失敗:", error);
		notification.error("設定の保存に失敗しました。");
	}
}
