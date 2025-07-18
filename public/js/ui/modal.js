import * as utils from "../utils.js";

const elements = {
	modal: document.getElementById("transaction-modal"),
	modalTitle: document.getElementById("modal-title"),
	form: document.getElementById("transaction-form"),
	typeSelector: document.getElementById("type-selector"),
	transactionId: document.getElementById("transaction-id"),
	deleteButton: document.getElementById("delete-transaction-button"),
	closeButton: document.getElementById("close-modal-button"),
	// フォームの各フィールド
	categoryField: document.getElementById("category-field"),
	dateField: document.getElementById("date-field"),
	paymentMethodField: document.getElementById("payment-method-field"),
	transferFromField: document.getElementById("transfer-from-field"),
	transferToField: document.getElementById("transfer-to-field"),
};

let logicHandlers = {};
let appConfig = {};

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

	const allAccounts = [...appConfig.assets, ...appConfig.liabilities];
	if (type === "transfer") {
		const fromSelect = document.getElementById("transfer-from");
		const toSelect = document.getElementById("transfer-to");
		populateSelect(document.getElementById("transfer-from"), allAccounts);
		populateSelect(document.getElementById("transfer-to"), allAccounts);
		fromSelect.value = appConfig.assets[0];
		toSelect.value = appConfig.assets[1] || allAccounts[1];
	} else {
		const categorySelect = document.getElementById("category");
		const paymentMethodSelect = document.getElementById("payment-method");
		populateSelect(
			document.getElementById("category"),
			type === "income"
				? appConfig.incomeCategories
				: appConfig.expenseCategories
		);
		populateSelect(document.getElementById("payment-method"), allAccounts);
		categorySelect.selectedIndex = 0;
		paymentMethodSelect.value = appConfig.assets[0];
	}
}

function populateSelect(selectEl, options) {
	selectEl.innerHTML = options
		.map((opt) => `<option value="${opt}">${opt}</option>`)
		.join("");
}

export function init(handlers, config) {
	logicHandlers = handlers;
	appConfig = config;

	elements.closeButton.addEventListener("click", closeModal);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) {
			closeModal();
		}
	});
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && !elements.modal.classList.contains("hidden")) {
			closeModal();
		}
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

	document.getElementById("date-today-btn").addEventListener("click", () => {
		elements.dateField.value = utils.toYYYYMMDD(new Date());
	});
	document
		.getElementById("date-yesterday-btn")
		.addEventListener("click", () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			elements.dateField.value = utils.toYYYYMMDD(yesterday);
		});
}

export function openModal(transaction = null, prefillData = null) {
	elements.form.reset();
	elements.modal.classList.remove("hidden");

	let data = {};
	let isEditing = !!transaction;

	if (isEditing) {
		data = transaction;
		elements.modalTitle.textContent = "取引を編集";
	} else if (prefillData) {
		data = prefillData;
		elements.modalTitle.textContent = "振替の確認・登録";
	} else {
		elements.modalTitle.textContent = "取引を追加";
		data = {
			type: "expense",
			date: utils.toYYYYMMDD(new Date()),
			category: appConfig.expenseCategories[0],
			"payment-method": appConfig.assets[0],
		};
	}

	elements.deleteButton.classList.toggle("hidden", !isEditing);
	elements.transactionId.value = isEditing ? data.id : "";

	document.getElementById("date").value = isEditing
		? utils.toYYYYMMDD(data.date)
		: data.date;
	document.getElementById("amount").value = data.amount || "";
	document.getElementById("description").value = data.description || "";
	document.getElementById("memo").value = data.memo || "";

	setupFormForType(data.type || "expense");

	if (data.type === "transfer") {
		document.getElementById("transfer-from").value = data.fromAccount || "";
		document.getElementById("transfer-to").value = data.toAccount || "";
	} else {
		document.getElementById("category").value =
			data.category || appConfig.expenseCategories[0];
		document.getElementById("payment-method").value =
			data["payment-method"] || data.paymentMethod || appConfig.assets[0];
	}
}

export function closeModal() {
	elements.modal.classList.add("hidden");
}
