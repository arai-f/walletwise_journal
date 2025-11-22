import { toDate } from "https://esm.sh/date-fns-tz@2.0.1";
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
	saveButton: document.getElementById("save-transaction-button"),
	closeButton: document.getElementById("close-modal-button"),
	// フォームのフィールド
	typeSelector: document.getElementById("type-selector"),
	date: document.getElementById("date"),
	dateTodayButton: document.getElementById("date-today-btn"),
	dateYesterdayButton: document.getElementById("date-yesterday-btn"),
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
 * @private
 * @param {object} [data={}] - 設定する取引データ。新規作成時は空オブジェクト。
 */
function populateForm(data = {}) {
	elements.transactionId.value = data.id || "";
	elements.date.value = data.date
		? utils.toYYYYMMDD(new Date(data.date))
		: utils.toYYYYMMDD(new Date());
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
 * select要素にオプションを生成して設定する。
 * @private
 * @param {HTMLSelectElement} selectEl - 対象のselect要素。
 * @param {Array<object>} items - オプションとして設定する項目の配列（口座またはカテゴリ）。
 */
function populateSelect(selectEl, items) {
	const sortedItems = [...items].sort((a, b) => {
		// 1. 種類でソート (assetが先)
		if (a.type !== b.type) {
			return a.type === "asset" ? -1 : 1;
		}
		// 2. ユーザー設定順でソート
		const orderA = a.order ?? Infinity;
		const orderB = b.order ?? Infinity;
		if (orderA !== orderB) {
			return orderA - orderB;
		}
		// 3. 名前でソート
		return a.name.localeCompare(b.name);
	});

	selectEl.innerHTML = sortedItems
		.map((item) => `<option value="${item.id}">${item.name}</option>`)
		.join("");
}

/**
 * フォーム全体の入力可否状態を設定する。
 * @private
 * @param {boolean} shouldDisable - trueの場合、フォームを無効化する。
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
 * @private
 * @param {string} type - 取引種別 ('income', 'expense', 'transfer')。
 */
function setupFormForType(type) {
	if (elements.form.elements["type"]) {
		elements.form.elements["type"].value = type;
	}

	const colorClasses = {
		expense: "text-red-600",
		income: "text-green-600",
		transfer: "text-blue-600",
	};
	const inactiveClasses = ["text-gray-500", "hover:bg-white/60"];
	const activeClasses = ["bg-white", "shadow-sm"];

	elements.typeSelector.querySelectorAll(".type-btn").forEach((btn) => {
		const btnType = btn.dataset.type;
		const isSelected = btnType === type;
		btn.classList.remove(...activeClasses, ...Object.values(colorClasses));

		if (isSelected) {
			btn.classList.remove(...inactiveClasses);
			btn.classList.add(...activeClasses, colorClasses[btnType]);
		} else {
			btn.classList.add(...inactiveClasses);
		}
	});

	const show = (el, condition) => el.classList.toggle("hidden", !condition);
	show(elements.categoryField, type !== "transfer");
	show(elements.paymentMethodField, type !== "transfer");
	show(elements.transferFromField, type === "transfer");
	show(elements.transferToField, type === "transfer");

	const allAccounts = [...appLuts.accounts.values()].filter(
		(a) => !a.isDeleted
	);
	const allCategories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted
	);
	const sortedAccounts = [...allAccounts].sort((a, b) => {
		if (a.type !== b.type) return a.type === "asset" ? -1 : 1;
		const orderA = a.order ?? Infinity;
		const orderB = b.order ?? Infinity;
		if (orderA !== orderB) return orderA - orderB;
		return a.name.localeCompare(b.name);
	});

	if (type === "transfer") {
		const fromSelect = elements.transferFrom;
		const toSelect = elements.transferTo;

		populateSelect(fromSelect, sortedAccounts);
		populateSelect(toSelect, sortedAccounts);

		if (sortedAccounts.length > 0) {
			fromSelect.value = sortedAccounts[0].id;
		}
		if (sortedAccounts.length > 1) {
			toSelect.value = sortedAccounts[1].id;
		} else if (sortedAccounts.length > 0) {
			toSelect.value = sortedAccounts[0].id;
		}
	} else {
		const categories = allCategories.filter((c) => c.type === type);
		populateSelect(elements.category, categories);
		populateSelect(elements.paymentMethod, allAccounts);
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
	let showSave = true;
	let formDisabled = false;

	if (mode === "edit") {
		// 残高調整取引は表示のみで編集不可
		if (transaction.categoryId === "SYSTEM_BALANCE_ADJUSTMENT") {
			title = "残高調整（表示のみ）";
			showSave = false;
			formDisabled = true;
		} else {
			title = "取引を編集";
			showDelete = true;
		}
	} else if (mode === "prefill") {
		title = "振替の確認・登録";
	}

	elements.modalTitle.textContent = title;
	elements.deleteButton.classList.toggle("hidden", !showDelete);
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
		if (elements.form.reportValidity()) logicHandlers.submit(elements.form);
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
	elements.dateTodayButton.addEventListener("click", () => {
		const todayInTokyo = toDate(new Date(), { timeZone: "Asia/Tokyo" });
		elements.date.value = utils.toYYYYMMDD(todayInTokyo);
	});
	elements.dateYesterdayButton.addEventListener("click", () => {
		const todayInTokyo = toDate(new Date(), { timeZone: "Asia/Tokyo" });
		const yesterdayInTokyo = new Date(todayInTokyo);
		yesterdayInTokyo.setDate(yesterdayInTokyo.getDate() - 1);
		elements.date.value = utils.toYYYYMMDD(yesterdayInTokyo);
	});

	elements.amount.addEventListener("input", (e) => {
		const value = e.target.value;

		// 数字と小数点以外の文字を除去する
		let sanitizedValue = value.replace(/[^0-9.]/g, "");
		const parts = sanitizedValue.split(".");
		if (parts.length > 2) {
			sanitizedValue = parts[0] + "." + parts.slice(1).join("");
		}

		if (value !== sanitizedValue) {
			e.target.value = sanitizedValue;
		}
	});

	// フォーム内でのキーボードショートカットを設定する
	elements.form.addEventListener("keydown", (e) => {
		// 日本語入力変換中は無視する
		if (e.isComposing) return;

		// Cmd+Enter or Shift+Enter のみ保存
		if ((e.metaKey || e.ctrlKey || e.shiftKey) && e.key === "Enter") {
			e.preventDefault();
			if (elements.form.reportValidity()) logicHandlers.submit(elements.form);
		}
		// Enterキー単体での意図しない送信を無効化する（textareaは除く）
		else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
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
	if (transaction && transaction.type === "transfer") {
		notification.info(
			"この振替取引は編集できません。金額の修正などは「残高調整」をご利用ください。"
		);
		return;
	}

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
