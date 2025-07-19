import * as utils from "../utils.js";

const elements = {
	modal: document.getElementById("transaction-modal"),
	modalTitle: document.getElementById("modal-title"),
	form: document.getElementById("transaction-form"),
	typeSelector: document.getElementById("type-selector"),
	transactionId: document.getElementById("transaction-id"),
	deleteButton: document.getElementById("delete-transaction-button"),
	closeButton: document.getElementById("close-modal-button"),
	categoryField: document.getElementById("category-field"),
	paymentMethodField: document.getElementById("payment-method-field"),
	transferFromField: document.getElementById("transfer-from-field"),
	transferToField: document.getElementById("transfer-to-field"),
};

let logicHandlers = {};
let appLuts = {};

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
	const assets = allAccounts.filter((a) => a.type === "asset");
	const allCategories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted && !c.isSystemCategory
	);
	const sortedAccounts = [...allAccounts].sort((a, b) => {
		if (a.type !== b.type) return a.type === "asset" ? -1 : 1;
		const orderA = a.order ?? Infinity;
		const orderB = b.order ?? Infinity;
		if (orderA !== orderB) return orderA - orderB;
		return a.name.localeCompare(b.name);
	});

	if (type === "transfer") {
		const fromSelect = document.getElementById("transfer-from");
		const toSelect = document.getElementById("transfer-to");

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
		populateSelect(document.getElementById("category"), categories);
		populateSelect(document.getElementById("payment-method"), assets);
	}
}

export function init(handlers, luts) {
	logicHandlers = handlers;
	appLuts = luts;
	elements.closeButton.addEventListener("click", closeModal);
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
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && !elements.modal.classList.contains("hidden"))
			closeModal();
	});
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) closeModal();
	});

	const dateInput = document.getElementById("date");
	document.getElementById("date-today-btn").addEventListener("click", () => {
		dateInput.value = utils.toYYYYMMDD(new Date());
	});
	document
		.getElementById("date-yesterday-btn")
		.addEventListener("click", () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			dateInput.value = utils.toYYYYMMDD(yesterday);
		});
}

export function openModal(transaction = null, prefillData = null) {
	elements.form.reset();
	elements.modal.classList.remove("hidden");
	const isEditing = !!transaction;

	if (!isEditing && !prefillData) {
		setupFormForType("expense");
		document.getElementById("date").value = utils.toYYYYMMDD(new Date());
		elements.modalTitle.textContent = "取引を追加";
		elements.deleteButton.classList.add("hidden");
		return;
	}

	const data = transaction || prefillData;
	const type = data.type || "expense";

	elements.modalTitle.textContent = isEditing
		? "取引を編集"
		: "振替の確認・登録";
	elements.deleteButton.classList.toggle("hidden", !isEditing);
	elements.transactionId.value = isEditing ? data.id : "";

	document.getElementById("date").value = data.date
		? utils.toYYYYMMDD(new Date(data.date))
		: utils.toYYYYMMDD(new Date());
	document.getElementById("amount").value = data.amount || "";
	document.getElementById("description").value = data.description || "";
	document.getElementById("memo").value = data.memo || "";

	setupFormForType(type);

	if (type === "transfer") {
		document.getElementById("transfer-from").value = data.fromAccountId || "";
		document.getElementById("transfer-to").value = data.toAccountId || "";
	} else {
		document.getElementById("category").value = data.categoryId || "";
		document.getElementById("payment-method").value = data.accountId || "";
	}
}

export function closeModal() {
	elements.modal.classList.add("hidden");
}
