import * as utils from "../utils.js";

const elements = {
	modal: document.getElementById("transaction-modal"),
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

export function init(handlers, luts) {
	logicHandlers = handlers;
	appLuts = luts;

	elements.closeButton.addEventListener("click", closeModal);
	elements.form.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			if (e.target.tagName !== "TEXTAREA") {
				e.preventDefault();
				elements.form.querySelector("button[type='submit']").click();
			}
		}
	});
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && !elements.modal.classList.contains("hidden")) {
			closeModal();
		}
	});
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) closeModal();
	});

	elements.form.addEventListener("submit", (e) => {
		e.preventDefault();
		logicHandlers.submit(e.target);
	});
	elements.deleteButton.addEventListener("click", () => {
		logicHandlers.delete(elements.transactionId.value);
	});
	elements.typeSelector.addEventListener("click", (e) => {
		if (e.target.tagName === "BUTTON") setupFormForType(e.target.dataset.type);
	});

	elements.dateTodayButton.addEventListener("click", () => {
		elements.date.value = utils.toYYYYMMDD(new Date());
	});
	elements.dateYesterdayButton.addEventListener("click", () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		elements.date.value = utils.toYYYYMMDD(yesterday);
	});
}

function setFormDisabled(shouldDisable) {
	const formElements = elements.form.elements;
	for (let i = 0; i < formElements.length; i++) {
		formElements[i].disabled = shouldDisable;
	}
	// 閉じるボタンだけは常に有効化
	elements.closeButton.disabled = false;
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

export function openModal(transaction = null, prefillData = null) {
	elements.form.reset();
	setFormDisabled(false);
	elements.modal.classList.remove("hidden");

	const isEditing = !!transaction;

	if (isEditing) {
		// --- 編集モード ---
		const data = transaction;
		const isBalanceAdjustment = data.categoryId === "SYSTEM_BALANCE_ADJUSTMENT";

		if (isBalanceAdjustment) {
			elements.modalTitle.textContent = "残高調整（表示のみ）";
			setFormDisabled(true);
			elements.deleteButton.classList.add("hidden");
			elements.saveButton.classList.add("hidden");
		} else {
			elements.modalTitle.textContent = "取引を編集";
			elements.deleteButton.classList.remove("hidden");
			elements.saveButton.classList.remove("hidden");
		}

		// データをフォームに設定
		elements.transactionId.value = data.id; // ★IDを設定
		setupFormForType(data.type);
		document.getElementById("date").value = utils.toYYYYMMDD(
			new Date(data.date)
		);
		document.getElementById("amount").value = data.amount;
		document.getElementById("description").value = data.description || "";
		document.getElementById("memo").value = data.memo || "";
		if (data.type === "transfer") {
			document.getElementById("transfer-from").value = data.fromAccountId;
			document.getElementById("transfer-to").value = data.toAccountId;
		} else {
			document.getElementById("category").value = data.categoryId;
			document.getElementById("payment-method").value = data.accountId;
		}
	} else {
		// --- 新規作成モード (通常 or 振替の事前入力) ---
		elements.transactionId.value = ""; // ★IDをクリア
		elements.deleteButton.classList.add("hidden");
		elements.saveButton.classList.remove("hidden");

		const data = prefillData || {};
		const type = data.type || "expense";

		elements.modalTitle.textContent = prefillData
			? "振替の確認・登録"
			: "取引を追加";
		setupFormForType(type);

		document.getElementById("date").value =
			data.date || utils.toYYYYMMDD(new Date());
		document.getElementById("amount").value = data.amount || "";
		document.getElementById("description").value = data.description || "";
		document.getElementById("memo").value = data.memo || "";
		document.getElementById("transfer-from").value = data.fromAccountId || "";
		document.getElementById("transfer-to").value = data.toAccountId || "";
	}
}

export function closeModal() {
	elements.modal.classList.add("hidden");
}
