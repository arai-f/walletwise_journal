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

export function calculateBills(allTransactions, paidCycles) {
	const cardData = {};
	config.liabilities.forEach((cardName) => {
		cardData[cardName] = { expenses: [] };
	});

	// 1. まず、全取引の中からクレジットカードでの支出だけを抽出する
	allTransactions.forEach((t) => {
		if (t.type === "expense" && config.liabilities.includes(t.paymentMethod)) {
			cardData[t.paymentMethod].expenses.push(t);
		}
	});

	const unpaidBills = [];

	// 2. カードごとに請求額を計算する
	for (const cardName in config.creditCardRules) {
		const rule = config.creditCardRules[cardName];
		const { expenses } = cardData[cardName];

		// 締め日ごとに支出をまとめる
		const billsByCycle = expenses.reduce((acc, expense) => {
			const closingDate = getClosingDateForTransaction(
				expense.date,
				rule.closingDay
			);
			const closingDateStr = toYYYYMMDD(closingDate);
			if (!acc[closingDateStr]) {
				acc[closingDateStr] = { amount: 0, date: closingDate };
			}
			acc[closingDateStr].amount += expense.amount;
			return acc;
		}, {});

		// 3. 各請求サイクルが支払い済みかどうかを判定する
		for (const closingDateStr in billsByCycle) {
			const bill = billsByCycle[closingDateStr];
			const paymentDate = getPaymentDate(bill.date, rule);

			// 支払い済みサイクルの日付と比較して、支払い済みかを判断
			const lastPaidCycle = paidCycles[cardName];
			const isPaid = lastPaidCycle && closingDateStr <= lastPaidCycle;

			// 未来の支払い（今月と来月）に絞り込む
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const monthDiff =
				(paymentDate.getFullYear() - today.getFullYear()) * 12 +
				(paymentDate.getMonth() - today.getMonth());

			// 未払いで、請求額があり、支払日が直近の請求のみをリストアップ
			if (!isPaid && bill.amount > 0 && monthDiff <= 1) {
				unpaidBills.push({
					cardName: cardName,
					rule: rule,
					closingDate: bill.date,
					amount: bill.amount,
				});
			}
		}
	}
	return unpaidBills;
}

export function render(unpaidBills, isMasked) {
	elements.list.innerHTML = "";
	if (unpaidBills.length === 0) {
		elements.list.innerHTML = `<p class="text-center text-gray-500 py-4">未払いの請求はありません。</p>`;
		return;
	}
	unpaidBills.forEach((bill) => {
		elements.list.appendChild(
			createBillingCard(
				bill.cardName,
				bill.rule,
				bill.closingDate,
				bill.amount,
				isMasked
			)
		);
	});
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
