import { config } from "../config.js";

const elements = {
	list: document.getElementById("billing-list"),
};

let onRecordPaymentClickCallback = () => {};

const formatCurrency = (amount, isMasked) => {
	if (isMasked) return "¥ *****";
	return `¥${amount.toLocaleString()}`;
};

export function init(onRecordPaymentClick) {
	onRecordPaymentClickCallback = onRecordPaymentClick;
	elements.list.addEventListener("click", (e) => {
		if (e.target.classList.contains("record-payment-btn")) {
			onRecordPaymentClickCallback(e.target.dataset);
		}
	});
}

export function render(allTransactions, isMasked) {
	elements.list.innerHTML = "";
	const cardData = {};
	config.liabilities.forEach((cardName) => {
		cardData[cardName] = { expenses: [], payments: [] };
	});

	allTransactions.forEach((t) => {
		if (t.type === "expense" && config.liabilities.includes(t.paymentMethod)) {
			cardData[t.paymentMethod].expenses.push(t);
		} else if (t.type === "transfer") {
			if (config.liabilities.includes(t.toAccount))
				cardData[t.toAccount].payments.push(t);
			if (config.liabilities.includes(t.fromAccount))
				cardData[t.fromAccount].expenses.push(t);
		}
	});

	for (const cardName in config.creditCardRules) {
		const rule = config.creditCardRules[cardName];
		const { expenses, payments } = cardData[cardName];
		const bills = expenses.reduce((acc, expense) => {
			const closingDate = getClosingDateForTransaction(
				expense.date,
				rule.closingDay
			);
			const closingDateStr = toYYYYMMDD(closingDate);
			if (!acc[closingDateStr]) acc[closingDateStr] = { amount: 0 };
			acc[closingDateStr].amount += expense.amount;
			return acc;
		}, {});
		for (const closingDateStr in bills) {
			const bill = bills[closingDateStr];
			const [year, month, day] = closingDateStr.split("-").map(Number);
			const closingDate = new Date(year, month - 1, day);
			const paymentDate = getPaymentDate(closingDate, rule);
			const isPaid = payments.some((p) => {
				const dayDiff = Math.abs(p.date - paymentDate) / (1000 * 60 * 60 * 24);
				return dayDiff < 10 && p.amount === bill.amount;
			});
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const monthDiff =
				(paymentDate.getFullYear() - today.getFullYear()) * 12 +
				(paymentDate.getMonth() - today.getMonth());
			if (!isPaid && bill.amount > 0 && monthDiff <= 1) {
				elements.list.appendChild(
					createBillingCard(cardName, rule, closingDate, bill.amount, isMasked)
				);
			}
		}
	}
}

function createBillingCard(cardName, rule, closingDate, amount, isMasked) {
	const cardDiv = document.createElement("div");
	cardDiv.className =
		"bg-white p-4 rounded-lg shadow-sm border flex flex-col md:flex-row items-start md:items-center gap-4";
	const paymentDate = getPaymentDate(closingDate, rule);
	const billingPeriod = getBillingPeriod(closingDate, rule);
	const paymentDateStr = toYYYYMMDD(paymentDate);
	cardDiv.innerHTML = `
        <div class="flex-grow">
            <div class="flex items-center gap-3 mb-2"><i class="fas fa-credit-card text-xl text-gray-400"></i><h3 class="font-bold text-lg text-gray-800">${cardName}</h3></div>
            <p class="text-sm text-gray-500 ml-1">請求期間: ${billingPeriod}</p>
            <p class="text-sm text-gray-500 ml-1">支払予定日: ${paymentDate.toLocaleDateString(
							"ja-JP"
						)}</p>
        </div>
        <div class="text-left md:text-right w-full md:w-auto">
            <p class="text-sm text-gray-500">請求額</p>
            <p class="font-bold text-2xl text-red-600 mb-3">${formatCurrency(
							amount,
							isMasked
						)}</p>
            <button class="record-payment-btn w-full md:w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">振替を記録する</button>
        </div>`;
	const button = cardDiv.querySelector(".record-payment-btn");
	button.dataset.cardName = cardName;
	button.dataset.amount = amount;
	button.dataset.paymentDate = paymentDateStr;
	button.dataset.defaultAccount = rule.defaultPaymentAccount;
	button.dataset.closingDate = closingDate.toLocaleDateString("ja-JP", {
		month: "long",
		day: "numeric",
	});
	return cardDiv;
}

function getClosingDateForTransaction(tDate, closingDay) {
	let cDate = new Date(tDate.getFullYear(), tDate.getMonth(), closingDay);
	if (tDate.getDate() > closingDay) cDate.setMonth(cDate.getMonth() + 1);
	return cDate;
}

function getPaymentDate(closingDate, rule) {
	let pDate = new Date(closingDate);
	pDate.setMonth(pDate.getMonth() + rule.paymentMonthOffset);
	pDate.setDate(rule.paymentDay);
	return pDate;
}

function getBillingPeriod(closingDate, rule) {
	const end = closingDate.toLocaleDateString("ja-JP", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	let startDate = new Date(closingDate);
	startDate.setMonth(startDate.getMonth() - 1);
	startDate.setDate(rule.closingDay + 1);
	const start = startDate.toLocaleDateString("ja-JP", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	return `${start} 〜 ${end}`;
}

function toYYYYMMDD(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}
