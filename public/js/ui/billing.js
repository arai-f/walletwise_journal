import * as utils from "../utils.js";

const elements = {
	list: document.getElementById("billing-list"),
};

let onRecordPaymentClickCallback = () => {};
let appLuts = {};

export function init(onRecordPaymentClick) {
	onRecordPaymentClickCallback = onRecordPaymentClick;

	elements.list.addEventListener("click", (e) => {
		if (e.target.classList.contains("record-payment-btn")) {
			onRecordPaymentClickCallback(e.target.dataset);
		}
	});
}

function getClosingDateForTransaction(tDate, closingDay) {
	const transactionDate = new Date(tDate);
	let cDate = new Date(
		transactionDate.getFullYear(),
		transactionDate.getMonth(),
		closingDay
	);
	if (transactionDate.getDate() > closingDay) {
		cDate.setMonth(cDate.getMonth() + 1);
	}
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

function createBillingCard(
	cardId,
	cardName,
	rule,
	closingDate,
	amount,
	icon,
	isMasked
) {
	const cardDiv = document.createElement("div");
	cardDiv.className =
		"bg-white p-4 rounded-lg shadow-sm border flex flex-col md:flex-row items-start md:items-center gap-4";
	const paymentDate = getPaymentDate(closingDate, rule);
	const billingPeriod = getBillingPeriod(closingDate, rule);
	const paymentDateStr = utils.toYYYYMMDD(paymentDate);
	const iconClass = icon || "fas fa-credit-card";

	cardDiv.innerHTML = `
        <div class="flex-grow">
            <div class="flex items-center gap-3 mb-2">
                <i class="${iconClass} text-xl text-gray-400 w-6 text-center"></i>
                <h3 class="font-bold text-lg text-gray-800">${cardName}</h3>
            </div>
            <p class="text-sm text-gray-500 ml-1">請求期間: ${billingPeriod}</p>
            <p class="text-sm text-gray-500 ml-1">支払予定日: ${paymentDate.toLocaleDateString(
							"ja-JP"
						)}</p>
        </div>
        <div class="text-left md:text-right w-full md:w-auto">
            <p class="text-sm text-gray-500">請求額</p>
            <p class="font-bold text-2xl text-red-600 mb-3">${utils.formatCurrency(
							amount,
							isMasked
						)}</p>
            <button class="record-payment-btn w-full md:w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">振替を記録する</button>
        </div>`;
	const button = cardDiv.querySelector(".record-payment-btn");
	button.dataset.toAccountId = cardId;
	button.dataset.cardName = cardName;
	button.dataset.amount = amount;
	button.dataset.paymentDate = paymentDateStr;
	button.dataset.defaultAccountId = rule.defaultPaymentAccountId;
	button.dataset.closingDate = closingDate.toLocaleDateString("ja-JP", {
		month: "long",
		day: "numeric",
	});
	return cardDiv;
}

export function calculateBills(allTransactions, creditCardRules) {
	const unpaidBills = [];
	const liabilityAccounts = [...appLuts.accounts.values()].filter(
		(acc) => acc.type === "liability" && !acc.isDeleted
	);

	for (const card of liabilityAccounts) {
		const rule = creditCardRules[card.id];
		if (!rule) continue;

		const expensesForThisCard = allTransactions.filter(
			(t) => t.accountId === card.id && t.type === "expense"
		);
		if (expensesForThisCard.length === 0) continue;

		// 1. 計算を開始すべき最初の締め日を決定する
		let firstClosingDate;
		if (rule.lastPaidCycle) {
			firstClosingDate = new Date(rule.lastPaidCycle);
			firstClosingDate.setMonth(firstClosingDate.getMonth() + 1);
		} else {
			// 支払い履歴がなければ、最も古い取引の日付を基準にする
			const oldestTxDate = new Date(
				Math.min(...expensesForThisCard.map((t) => new Date(t.date)))
			);
			firstClosingDate = getClosingDateForTransaction(
				oldestTxDate,
				rule.closingDay
			);
		}

		// 2. 計算を終了すべき最後の締め日を決定する
		const today = new Date();
		const finalClosingDate = getClosingDateForTransaction(
			today,
			rule.closingDay
		);
		if (today.getDate() > rule.closingDay) {
			finalClosingDate.setMonth(finalClosingDate.getMonth() + 1);
		}

		// 3. 開始から終了までのすべての請求期間をループで処理
		let currentClosingDate = new Date(firstClosingDate);
		while (currentClosingDate <= finalClosingDate) {
			const cycleEndDate = new Date(currentClosingDate);
			const cycleStartDate = new Date(cycleEndDate);
			cycleStartDate.setMonth(cycleStartDate.getMonth() - 1);
			cycleStartDate.setDate(rule.closingDay + 1);

			// この期間内の取引をフィルタリング
			const amountForCycle = expensesForThisCard
				.filter((t) => {
					const txDate = new Date(t.date);
					return txDate >= cycleStartDate && txDate <= cycleEndDate;
				})
				.reduce((sum, t) => sum + t.amount, 0);

			if (amountForCycle > 0) {
				unpaidBills.push({
					cardId: card.id,
					cardName: card.name,
					rule: rule,
					closingDate: cycleEndDate,
					amount: amountForCycle,
					icon: card.icon || "fas fa-credit-card",
					order: card.order || 0,
				});
			}
			// 次の月の締め日に進む
			currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
		}
	}
	return unpaidBills.sort(
		(a, b) => a.order - b.order || a.closingDate - b.closingDate
	);
}

export function render(allTransactions, creditCardRules, isMasked, luts) {
	appLuts = luts;
	const unpaidBills = calculateBills(allTransactions, creditCardRules);

	elements.list.innerHTML = "";
	if (unpaidBills.length === 0) {
		elements.list.innerHTML = `<p class="text-center text-gray-500 py-4">未払いの請求はありません。</p>`;
		return;
	}
	unpaidBills.forEach((bill) => {
		elements.list.appendChild(
			createBillingCard(
				bill.cardId,
				bill.cardName,
				bill.rule,
				bill.closingDate,
				bill.amount,
				bill.icon,
				isMasked
			)
		);
	});
}
