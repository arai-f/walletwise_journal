import * as utils from "../utils.js";
import * as notification from "./notification.js";

/* ==========================================================================
   Modal Stack Management
   ========================================================================== */

const modalStack = [];

/**
 * モーダルをスタックに登録する。
 * @param {Function} closeCallback - 閉じる際に実行する関数。
 * @returns {Function} 登録解除用の関数。
 */
export function register(closeCallback) {
	modalStack.push(closeCallback);
	return () => {
		const index = modalStack.indexOf(closeCallback);
		if (index > -1) {
			modalStack.splice(index, 1);
		}
	};
}

/**
 * スタックの最前面にあるモーダルを閉じる。
 * @returns {boolean} 閉じた場合はtrue、スタックが空の場合はfalse。
 */
export function closeTop() {
	const closeFn = modalStack.pop();
	if (closeFn) {
		closeFn();
		return true;
	}
	return false;
}

/**
 * モーダル内のUI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
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
});

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
 * スタック登録解除用の関数を保持する変数。
 * @type {Function|null}
 */
let unregisterStack = null;

/**
 * フォームに取引データを設定する。
 * 編集モード時は既存のデータを、新規作成時はデフォルト値をフォームに入力する。
 * @private
 * @param {object} [data={}] - 設定する取引データオブジェクト。新規作成時は空オブジェクトが渡される。
 * @returns {void}
 */
function populateForm(data = {}) {
	const {
		transactionId,
		date,
		amount,
		description,
		memo,
		transferFrom,
		transferTo,
		category,
		paymentMethod,
	} = getElements();

	transactionId.value = data.id || "";
	date.value = data.date
		? utils.toYYYYMMDD(new Date(data.date))
		: utils.getLocalToday();
	amount.value = data.amount || "";
	description.value = data.description || "";
	memo.value = data.memo || "";

	if (data.type === "transfer") {
		if (data.fromAccountId) transferFrom.value = data.fromAccountId;
		if (data.toAccountId) transferTo.value = data.toAccountId;
	} else {
		if (data.categoryId) category.value = data.categoryId;
		if (data.accountId) paymentMethod.value = data.accountId;
	}
}

/**
 * フォーム全体の入力可否状態を設定する。
 * 保存処理中などにユーザーの操作をブロックするために使用する。
 * @private
 * @param {boolean} shouldDisable - trueの場合、フォーム内の全入力要素を無効化する。
 * @returns {void}
 */
function setFormDisabled(shouldDisable) {
	const { form, closeButton } = getElements();
	const formElements = form.elements;
	for (let i = 0; i < formElements.length; i++) {
		formElements[i].disabled = shouldDisable;
	}
	// 閉じるボタンだけは常に有効化
	closeButton.disabled = false;
}

/**
 * 選択された取引種別（収入、支出、振替）に応じてフォームのUIを切り替える。
 * 種別に応じて、カテゴリ選択肢や送金元・送金先フィールドの表示/非表示を制御する。
 * @private
 * @param {string} type - 取引種別 ('income', 'expense', 'transfer')。
 * @returns {void}
 */
function setupFormForType(type) {
	const {
		form,
		typeSelector,
		categoryField,
		paymentMethodField,
		transferFromField,
		transferToField,
		transferFrom,
		transferTo,
		category,
		paymentMethod,
	} = getElements();

	if (form.elements["type"]) {
		form.elements["type"].value = type;
	}

	const activeStyleMap = {
		expense: ["bg-danger-light", "text-danger", "shadow-sm"],
		income: ["bg-success-light", "text-success", "shadow-sm"],
		transfer: ["bg-primary-light", "text-primary", "shadow-sm"],
	};
	const inactiveClasses = ["text-neutral-600", "hover:bg-neutral-50"];

	typeSelector.querySelectorAll(".type-btn").forEach((btn) => {
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

	utils.dom.toggle(categoryField, type !== "transfer");
	utils.dom.toggle(paymentMethodField, type !== "transfer");
	utils.dom.toggle(transferFromField, type === "transfer");
	utils.dom.toggle(transferToField, type === "transfer");

	const allAccounts = utils.sortItems(
		[...appLuts.accounts.values()].filter((a) => !a.isDeleted)
	);
	const allCategories = utils.sortItems(
		[...appLuts.categories.values()].filter((c) => !c.isDeleted)
	);

	if (type === "transfer") {
		utils.populateSelect(transferFrom, allAccounts);
		utils.populateSelect(transferTo, allAccounts);

		if (allAccounts.length > 0) {
			transferFrom.value = allAccounts[0].id;
			transferTo.value =
				allAccounts.length > 1 ? allAccounts[1].id : allAccounts[0].id;
		}
	} else {
		const categories = allCategories.filter((c) => c.type === type);
		utils.populateSelect(category, categories);
		utils.populateSelect(paymentMethod, allAccounts);
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
 * @returns {void}
 */
function render(state) {
	const { mode, type, transaction, prefillData } = state;
	const { modalTitle, deleteButton, copyButton, saveButton } = getElements();

	let title = "取引を追加";
	let showDelete = false;
	let showCopy = false;
	let showSave = true;
	let formDisabled = false;

	if (mode === "edit") {
		// 残高調整取引または振替取引の場合、編集不可にする
		if (
			transaction.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID
		) {
			title = "残高調整（表示のみ）";
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

	utils.dom.setText(modalTitle, title);
	utils.dom.toggle(deleteButton, showDelete);
	utils.dom.toggle(copyButton, showCopy);
	utils.dom.toggle(saveButton, showSave);
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
 * @returns {void}
 */
export function init(handlers, luts) {
	logicHandlers = handlers;
	appLuts = luts;

	const {
		closeButton,
		modal,
		saveButton,
		form,
		copyButton,
		transactionId,
		date,
		modalTitle,
		deleteButton,
		typeSelector,
		amount,
	} = getElements();

	utils.dom.on(closeButton, "click", closeModal);
	utils.dom.on(modal, "click", (e) => {
		if (e.target === modal) closeModal();
	});
	utils.dom.on(saveButton, "click", () => {
		if (form.reportValidity()) {
			utils.withLoading(saveButton, async () => {
				await logicHandlers.submit(form);
			});
		}
	});
	utils.dom.on(copyButton, "click", () => {
		transactionId.value = "";
		date.value = utils.toYYYYMMDD(new Date());
		utils.dom.setText(modalTitle, "取引を追加 (コピー)");
		utils.dom.hide(deleteButton);
		utils.dom.hide(copyButton);
		notification.info("コピーを作成します。内容を確認して保存してください。");
	});
	utils.dom.on(deleteButton, "click", () => {
		logicHandlers.delete(transactionId.value);
	});
	utils.dom.on(typeSelector, "click", (e) => {
		const btn = e.target.closest(".type-btn");
		if (btn) {
			const selectedType = btn.dataset.type;
			setupFormForType(selectedType);
		}
	});

	utils.dom.on(amount, "input", (e) => {
		const sanitized = utils.sanitizeNumberInput(e.target.value);
		if (e.target.value !== sanitized) {
			e.target.value = sanitized;
		}
	});

	// フォーム内でのキーボードショートカットを設定する
	utils.dom.on(form, "keydown", (e) => {
		// 日本語入力変換中は無視する
		if (e.isComposing || e.key === "Process" || e.keyCode === 229) return;

		// Cmd+Enter or Shift+Enter のみ保存
		if ((e.metaKey || e.ctrlKey || e.shiftKey) && e.key === "Enter") {
			e.preventDefault();
			if (form.reportValidity()) {
				// キー操作でもボタンをローディング状態にする
				utils.withLoading(saveButton, async () => {
					await logicHandlers.submit(form);
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
 * @returns {void}
 */
export function openModal(transaction = null, prefillData = null) {
	const { form, modal } = getElements();
	utils.toggleBodyScrollLock(true);
	form.reset();
	utils.dom.show(modal);

	// スタックに登録（二重登録防止のため既存があれば解除）
	if (unregisterStack) unregisterStack();
	unregisterStack = register(closeModal);

	const mode = transaction ? "edit" : prefillData ? "prefill" : "create";
	const type = transaction?.type || prefillData?.type || "expense";

	render({ mode, type, transaction, prefillData });
}

/**
 * 取引モーダルを閉じる。
 * モーダルを非表示にし、背景のスクロールロックを解除する。
 * @returns {void}
 */
export function closeModal() {
	// 手動で閉じた場合もスタックから解除する
	if (unregisterStack) {
		unregisterStack();
		unregisterStack = null;
	}

	const { modal } = getElements();
	utils.toggleBodyScrollLock(false);
	utils.dom.hide(modal);
	if (logicHandlers.close) logicHandlers.close();
}

/**
 * 取引モーダルが開いているかどうかを判定する。
 * @returns {boolean} - モーダルが開いている場合はtrue、閉じている場合はfalse。
 */
export function isOpen() {
	const { modal } = getElements();
	return utils.dom.isVisible(modal);
}
