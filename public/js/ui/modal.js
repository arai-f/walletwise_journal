import * as utils from "../utils.js";
import * as notification from "./notification.js";

/**
 * モーダル内のUI要素をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	modal: utils.dom.get("transaction-modal"),
	modalTitle: utils.dom.get("modal-title"),
	form: utils.dom.get("transaction-form"),
	transactionId: utils.dom.get("transaction-id"),
	deleteButton: utils.dom.get("delete-transaction-button"),
	copyButton: utils.dom.get("copy-transaction-button"),
	saveButton: utils.dom.get("save-transaction-button"),
	closeButton: utils.dom.get("close-modal-button"),
	// フォームのフィールド
	typeSelector: utils.dom.get("type-selector"),
	date: utils.dom.get("date"),
	amount: utils.dom.get("amount"),
	categoryField: utils.dom.get("category-field"),
	category: utils.dom.get("category"),
	paymentMethodField: utils.dom.get("payment-method-field"),
	paymentMethod: utils.dom.get("payment-method"),
	transferFromField: utils.dom.get("transfer-from-field"),
	transferToField: utils.dom.get("transfer-to-field"),
	transferFrom: utils.dom.get("transfer-from"),
	transferTo: utils.dom.get("transfer-to"),
	description: utils.dom.get("description"),
	memo: utils.dom.get("memo"),
};

/**
 * イベントハンドラをまとめたオブジェクト。
 * @type {object}
 *
 */
let logicHandlers = {};

/**
 * 口座やカテゴリのルックアップテーブルをまとめたオブジェクト。
 * @type {object}
 */
let appLuts = {};

/**
 * フォームに取引データを設定する。
 * 編集モード時は既存のデータを、新規作成時はデフォルト値をフォームに入力する。
 * @private
 * @param {object} [data={}] - 設定する取引データオブジェクト。新規作成時は空オブジェクトが渡される。
 */
function populateForm(data = {}) {
	elements.transactionId.value = data.id || "";
	elements.date.value = data.date
		? utils.toYYYYMMDD(new Date(data.date))
		: utils.getToday();
	elements.amount.value = data.amount || "";
	elements.description.value = data.description || "";
	elements.memo.value = data.memo || "";

	if (data.type === "transfer") {
		if (data.fromAccountId) elements.transferFrom.value = data.fromAccountId;
		if (data.toAccountId) elements.transferTo.value = data.toAccountId;
	} else {
		if (data.categoryId) elements.category.value = data.categoryId;
		if (data.accountId) elements.paymentMethod.value = data.accountId;
	}
}

/**
 * フォーム全体の入力可否状態を設定する。
 * 保存処理中などにユーザーの操作をブロックするために使用する。
 * @private
 * @param {boolean} shouldDisable - trueの場合、フォーム内の全入力要素を無効化する。
 */
function setFormDisabled(shouldDisable) {
	const formElements = elements.form.elements;
	for (let i = 0; i < formElements.length; i++) {
		formElements[i].disabled = shouldDisable;
	}
	// 閉じるボタンだけは常に有効化
	elements.closeButton.disabled = false;
}

/**
 * 選択された取引種別（収入、支出、振替）に応じてフォームのUIを切り替える。
 * 種別に応じて、カテゴリ選択肢や送金元・送金先フィールドの表示/非表示を制御する。
 * @private
 * @param {string} type - 取引種別 ('income', 'expense', 'transfer')。
 */
function setupFormForType(type) {
	if (elements.form.elements["type"]) {
		elements.form.elements["type"].value = type;
	}

	const activeStyleMap = {
		expense: ["bg-danger-light", "text-danger", "shadow-sm"],
		income: ["bg-success-light", "text-success", "shadow-sm"],
		transfer: ["bg-primary-light", "text-primary", "shadow-sm"],
	};
	const inactiveClasses = ["text-neutral-600", "hover:bg-neutral-50"];

	elements.typeSelector.querySelectorAll(".type-btn").forEach((btn) => {
		const btnType = btn.dataset.type;
		const isSelected = btnType === type;

		// 一旦すべての可能性のあるクラスを削除し、状態をリセットする
		Object.values(activeStyleMap).forEach((classes) =>
			btn.classList.remove(...classes)
		);
		btn.classList.remove(...inactiveClasses);

		if (isSelected) {
			btn.classList.add(...activeStyleMap[btnType]);
		} else {
			btn.classList.add(...inactiveClasses);
		}
	});

	utils.dom.toggle(elements.categoryField, type !== "transfer");
	utils.dom.toggle(elements.paymentMethodField, type !== "transfer");
	utils.dom.toggle(elements.transferFromField, type === "transfer");
	utils.dom.toggle(elements.transferToField, type === "transfer");

	const allAccounts = utils.sortItems(
		[...appLuts.accounts.values()].filter((a) => !a.isDeleted)
	);
	const allCategories = utils.sortItems(
		[...appLuts.categories.values()].filter((c) => !c.isDeleted)
	);

	if (type === "transfer") {
		utils.populateSelect(elements.transferFrom, allAccounts);
		utils.populateSelect(elements.transferTo, allAccounts);

		if (allAccounts.length > 0) {
			elements.transferFrom.value = allAccounts[0].id;
			elements.transferTo.value =
				allAccounts.length > 1 ? allAccounts[1].id : allAccounts[0].id;
		}
	} else {
		const categories = allCategories.filter((c) => c.type === type);
		utils.populateSelect(elements.category, categories);
		utils.populateSelect(elements.paymentMethod, allAccounts);
	}
}

/**
 * モーダルの状態（タイトル、ボタン表示、フォーム内容）を描画する。
 * @private
 * @param {object} state - モーダルの状態オブジェクト。
 * @param {string} state.mode - モーダルのモード ('create', 'edit', 'prefill')。
 * @param {string} state.type - 取引種別。
 * @param {object|null} state.transaction - 編集対象の取引データ。
 * @param {object|null} state.prefillData - 事前入力用のデータ。
 */
function render(state) {
	const { mode, type, transaction, prefillData } = state;

	let title = "取引を追加";
	let showDelete = false;
	let showCopy = false;
	let showSave = true;
	let formDisabled = false;

	if (mode === "edit") {
		// 残高調整取引または振替取引の場合、編集不可にする
		if (
			transaction.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID ||
			transaction.type === "transfer"
		) {
			title =
				transaction.type === "transfer"
					? "振替（表示のみ）"
					: "残高調整（表示のみ）";
			showSave = false;
			formDisabled = true;
		} else {
			title = "取引を編集";
			showDelete = true;
			showCopy = true;
		}
	} else if (mode === "prefill") {
		const isBillingPayment =
			prefillData.type === "transfer" &&
			prefillData.description &&
			prefillData.description.includes("支払い");
		title = isBillingPayment ? "振替の確認・登録" : "取引を追加 (コピー)";
	}

	utils.dom.setText(elements.modalTitle, title);
	utils.dom.toggle(elements.deleteButton, showDelete);
	utils.dom.toggle(elements.copyButton, showCopy);
	utils.dom.toggle(elements.saveButton, showSave);
	setFormDisabled(formDisabled);

	setupFormForType(type);
	populateForm(transaction || prefillData || {});
}

/**
 * 取引モーダルを初期化する。
 * @param {object} handlers - イベントハンドラをまとめたオブジェクト。
 * @param {function} handlers.submit - 保存ボタンクリック時の処理。
 * @param {function} handlers.delete - 削除ボタンクリック時の処理。
 * @param {function} handlers.close - モーダルが閉じる時の処理。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 */
export function init(handlers, luts) {
	logicHandlers = handlers;
	appLuts = luts;

	utils.dom.on(elements.closeButton, "click", closeModal);
	utils.dom.on(elements.modal, "click", (e) => {
		if (e.target === elements.modal) closeModal();
	});
	utils.dom.on(elements.saveButton, "click", () => {
		if (elements.form.reportValidity()) {
			utils.withLoading(elements.saveButton, async () => {
				await logicHandlers.submit(elements.form);
			});
		}
	});
	utils.dom.on(elements.copyButton, "click", () => {
		elements.transactionId.value = "";
		elements.date.value = utils.getToday();
		utils.dom.setText(elements.modalTitle, "取引を追加 (コピー)");
		utils.dom.hide(elements.deleteButton);
		utils.dom.hide(elements.copyButton);
		notification.info("コピーを作成します。内容を確認して保存してください。");
	});
	utils.dom.on(elements.deleteButton, "click", () => {
		logicHandlers.delete(elements.transactionId.value);
	});
	utils.dom.on(elements.typeSelector, "click", (e) => {
		const btn = e.target.closest(".type-btn");
		if (btn) {
			const selectedType = btn.dataset.type;
			setupFormForType(selectedType);
		}
	});

	utils.dom.on(elements.amount, "input", (e) => {
		const sanitized = utils.sanitizeNumberInput(e.target.value);
		if (e.target.value !== sanitized) {
			e.target.value = sanitized;
		}
	});

	// フォーム内でのキーボードショートカットを設定する
	utils.dom.on(elements.form, "keydown", (e) => {
		// 日本語入力変換中は無視する
		if (e.isComposing || e.key === "Process" || e.keyCode === 229) return;

		// Cmd+Enter or Shift+Enter のみ保存
		if ((e.metaKey || e.ctrlKey || e.shiftKey) && e.key === "Enter") {
			e.preventDefault();
			if (elements.form.reportValidity()) {
				// キー操作でもボタンをローディング状態にする
				utils.withLoading(elements.saveButton, async () => {
					await logicHandlers.submit(elements.form);
				});
			}
		} else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
			e.preventDefault();
		}
	});
}

/**
 * 取引モーダルを開く。
 * @param {object|null} [transaction=null] - 編集する取引データ。新規作成時はnull。
 * @param {object|null} [prefillData=null] - フォームに事前入力するデータ。
 */
export function openModal(transaction = null, prefillData = null) {
	document.body.classList.add("modal-open");
	elements.form.reset();
	utils.dom.show(elements.modal);

	const mode = transaction ? "edit" : prefillData ? "prefill" : "create";
	const type = transaction?.type || prefillData?.type || "expense";

	render({ mode, type, transaction, prefillData });
}

/**
 * 取引モーダルを閉じる。
 */
export function closeModal() {
	document.body.classList.remove("modal-open");
	utils.dom.hide(elements.modal);
	if (logicHandlers.close) logicHandlers.close();
}

/**
 * 取引モーダルが開いているかどうかを判定する。
 * @returns {boolean} - モーダルが開いている場合はtrue、閉じている場合はfalse。
 */
export function isOpen() {
	return utils.dom.isVisible(elements.modal);
}
