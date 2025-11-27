import * as utils from "../utils.js";
import * as notification from "./notification.js";

/**
 * 取引追加・編集モーダルのDOM要素。
 * @type {HTMLElement}
 */
export const modalElement = document.getElementById("transaction-modal");

/**
 * モーダル内のUI要素をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	modal: modalElement,
	modalTitle: document.getElementById("modal-title"),
	form: document.getElementById("transaction-form"),
	transactionId: document.getElementById("transaction-id"),
	deleteButton: document.getElementById("delete-transaction-button"),
	copyButton: document.getElementById("copy-transaction-button"),
	saveButton: document.getElementById("save-transaction-button"),
	closeButton: document.getElementById("close-modal-button"),
	// フォームのフィールド
	typeSelector: document.getElementById("type-selector"),
	date: document.getElementById("date"),
	amount: document.getElementById("amount"),
	categoryField: document.getElementById("category-field"),
	category: document.getElementById("category"),
	paymentMethodField: document.getElementById("payment-method-field"),
	paymentMethod: document.getElementById("payment-method"),
	transferFromField: document.getElementById("transfer-from-field"),
	transferToField: document.getElementById("transfer-to-field"),
	transferFrom: document.getElementById("transfer-from"),
	transferTo: document.getElementById("transfer-to"),
	description: document.getElementById("description"),
	memo: document.getElementById("memo"),
};

let logicHandlers = {};
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

	const show = (el, condition) => el.classList.toggle("hidden", !condition);
	show(elements.categoryField, type !== "transfer");
	show(elements.paymentMethodField, type !== "transfer");
	show(elements.transferFromField, type === "transfer");
	show(elements.transferToField, type === "transfer");

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

	elements.modalTitle.textContent = title;
	elements.deleteButton.classList.toggle("hidden", !showDelete);
	elements.copyButton.classList.toggle("hidden", !showCopy);
	elements.saveButton.classList.toggle("hidden", !showSave);
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

	elements.closeButton.addEventListener("click", closeModal);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) closeModal();
	});
	elements.saveButton.addEventListener("click", () => {
		if (elements.form.reportValidity()) {
			utils.withLoading(elements.saveButton, async () => {
				await logicHandlers.submit(elements.form);
			});
		}
	});
	elements.copyButton.addEventListener("click", () => {
		elements.transactionId.value = "";
		elements.date.value = utils.getToday();
		elements.modalTitle.textContent = "取引を追加 (コピー)";
		elements.deleteButton.classList.add("hidden");
		elements.copyButton.classList.add("hidden");
		notification.info("コピーを作成します。内容を確認して保存してください。");
	});
	elements.deleteButton.addEventListener("click", () => {
		logicHandlers.delete(elements.transactionId.value);
	});
	elements.typeSelector.addEventListener("click", (e) => {
		const btn = e.target.closest(".type-btn");
		if (btn) {
			const selectedType = btn.dataset.type;
			setupFormForType(selectedType);
		}
	});

	elements.amount.addEventListener("input", (e) => {
		const sanitized = utils.sanitizeNumberInput(e.target.value);
		if (e.target.value !== sanitized) {
			e.target.value = sanitized;
		}
	});

	// フォーム内でのキーボードショートカットを設定する
	elements.form.addEventListener("keydown", (e) => {
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
	elements.modal.classList.remove("hidden");

	const mode = transaction ? "edit" : prefillData ? "prefill" : "create";
	const type = transaction?.type || prefillData?.type || "expense";

	render({ mode, type, transaction, prefillData });
}

/**
 * 取引モーダルを閉じる。
 */
export function closeModal() {
	document.body.classList.remove("modal-open");
	elements.modal.classList.add("hidden");
	if (logicHandlers.close) logicHandlers.close();
}
