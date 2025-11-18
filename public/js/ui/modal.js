import { toDate } from "https://esm.sh/date-fns-tz@2.0.1";
import * as utils from "../utils.js";

export const modalElement = document.getElementById("transaction-modal");

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

function setFormDisabled(shouldDisable) {
	const formElements = elements.form.elements;
	for (let i = 0; i < formElements.length; i++) {
		formElements[i].disabled = shouldDisable;
	}
	// 閉じるボタンだけは常に有効化
	elements.closeButton.disabled = false;
}

function setupFormForType(type) {
	elements.typeSelector.querySelectorAll(".type-btn").forEach((btn) => {
		btn.className = `type-btn flex-1 px-4 py-2 rounded-lg ${
			btn.dataset.type === type
				? (type === "expense"
						? "bg-red-500"
						: type === "income"
						? "bg-green-500"
						: "bg-blue-500") + " text-white"
				: "bg-gray-200 text-gray-700"
		}`;
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

function render(state) {
	const { mode, type, transaction, prefillData } = state;

	// 1. タイトルとボタンの表示状態を決定
	let title = "取引を追加";
	let showDelete = false;
	let showSave = true;
	let formDisabled = false;

	if (mode === "edit") {
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

	// 2. フォームの種別ごとのUIを設定
	setupFormForType(type);

	// 3. フォームにデータを設定
	populateForm(transaction || prefillData || {});
}

export function init(handlers, luts) {
	logicHandlers = handlers;
	appLuts = luts;

	// イベントリスナーの設定
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
		if (e.target.tagName === "BUTTON") setupFormForType(e.target.dataset.type);
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

	// 金額フィールドの入力制限
	elements.amount.addEventListener("input", (e) => {
		const value = e.target.value;
		// 正規表現を使い、数字(0-9)と小数点(.)以外の文字をすべて除去する
		const sanitizedValue = value.replace(/[^0-9.]/g, "");

		// 値が変更された場合のみ、フィールドに再設定
		if (value !== sanitizedValue) {
			e.target.value = sanitizedValue;
		}
	});

	// ショートカットキーでの保存
	elements.form.addEventListener("keydown", (e) => {
		// 日本語入力確定中は無視
		if (e.isComposing) return;

		// Cmd+Enter or Shift+Enter のみ保存
		if ((e.metaKey || e.ctrlKey || e.shiftKey) && e.key === "Enter") {
			e.preventDefault();
			if (elements.form.reportValidity()) logicHandlers.submit(elements.form);
		}
		// Enter 単体は無効化（ただし textarea は許可）
		else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
			e.preventDefault();
		}
	});
}

export function openModal(transaction = null, prefillData = null) {
	if (transaction && transaction.type === "transfer") {
		alert(
			"この振替取引は編集できません。\n\n" +
				"クレジットカードの支払いなど、計上済みの取引を修正すると、残高の不整合の原因となります。\n\n" +
				"金額のずれなどを修正したい場合は、お手数ですが「残高調整」機能をご利用ください。"
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

export function closeModal() {
	document.body.classList.remove("modal-open");
	elements.modal.classList.add("hidden");
	if (logicHandlers.close) logicHandlers.close();
}
