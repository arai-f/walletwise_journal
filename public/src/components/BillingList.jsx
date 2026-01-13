import { addDays, addMonths, lastDayOfMonth, setDate, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import * as utils from '../../js/utils.js';

/**
 * Helper to safely set date day
 */
const setDateSafe = (date, day) => {
    const lastDay = lastDayOfMonth(date).getDate();
    return setDate(date, Math.min(day, lastDay));
};

/**
 * Calculates closing date for a transaction
 */
function getClosingDateForTransaction(txDate, closingDay) {
    const txDateStr = utils.toYYYYMMDD(txDate);
    const [y, m, d] = txDateStr.split("-").map(Number);
    let targetDate = new Date(y, m - 1, d);

    if (targetDate.getDate() > closingDay) {
        targetDate = addMonths(targetDate, 1);
    }

    targetDate = setDateSafe(targetDate, closingDay);
    return fromZonedTime(targetDate, "Asia/Tokyo");
}

/**
 * Calculates payment date based on closing date and rule
 */
export function getPaymentDate(closingDate, rule) {
    let targetDate = toZonedTime(closingDate, "Asia/Tokyo");
    targetDate = addMonths(targetDate, rule.paymentMonthOffset);
    targetDate = setDateSafe(targetDate, rule.paymentDay);
    return fromZonedTime(targetDate, "Asia/Tokyo");
}

/**
 * Helper to get billing period string
 */
function getBillingPeriod(closingDate, rule) {
    const endLocal = toZonedTime(closingDate, "Asia/Tokyo");
    let startLocal;

    if (rule.closingDay >= 31) {
        startLocal = new Date(endLocal);
        startLocal.setDate(1);
    } else {
        const prevClosingDate = subMonths(endLocal, 1);
        startLocal = addDays(prevClosingDate, 1);
    }

    const startTimestamp = fromZonedTime(startLocal, "Asia/Tokyo");
    const endTimestamp = fromZonedTime(endLocal, "Asia/Tokyo");

    const fmt = "yyyy年M月d日";
    const startStr = formatInTimeZone(startTimestamp, "Asia/Tokyo", fmt);
    const endStr = formatInTimeZone(endTimestamp, "Asia/Tokyo", fmt);

    return `${startStr} 〜 ${endStr}`;
}

/**
 * Calculates all bills (unfiltered)
 */
function calculateAllBills(allTransactions, creditCardRules, accountsMap) {
    const allBills = [];
    const liabilityAccounts = [...accountsMap.values()].filter(
        (acc) => acc.type === "liability" && !acc.isDeleted
    );
    const liabilityAccountIds = new Set(liabilityAccounts.map((acc) => acc.id));
    const expensesByAccount = new Map();

    for (const t of allTransactions) {
        let targetAccountId = null;
        if (t.type === "expense" && liabilityAccountIds.has(t.accountId)) {
            targetAccountId = t.accountId;
        } else if (
            t.type === "transfer" &&
            liabilityAccountIds.has(t.fromAccountId)
        ) {
            targetAccountId = t.fromAccountId;
        }

        if (targetAccountId) {
            if (!expensesByAccount.has(targetAccountId)) {
                expensesByAccount.set(targetAccountId, []);
            }
            expensesByAccount.get(targetAccountId).push(t);
        }
    }

    for (const card of liabilityAccounts) {
        const rule = creditCardRules[card.id];
        if (!rule) continue;

        const expenses = expensesByAccount.get(card.id) || [];
        if (expenses.length === 0) continue;

        const billsByCycle = {}; 

        for (const t of expenses) {
            const closingDate = getClosingDateForTransaction(t.date, rule.closingDay);
            const closingDateStr = utils.toYYYYMMDD(closingDate);

            if (!billsByCycle[closingDateStr]) {
                billsByCycle[closingDateStr] = {
                    cardId: card.id,
                    cardName: card.name,
                    rule: rule,
                    closingDate: closingDate,
                    closingDateStr: closingDateStr,
                    amount: 0,
                    icon: card.icon || "fas fa-credit-card",
                    order: card.order || 0,
                };
            }
            billsByCycle[closingDateStr].amount += t.amount;
        }
        allBills.push(...Object.values(billsByCycle));
    }

    return allBills.sort(
        (a, b) => a.order - b.order || a.closingDate - b.closingDate
    );
}

/**
 * Billing Component
 */
export default function BillingList({
    transactions,
    creditCardRules,
    isMasked,
    luts,
    isDataInsufficient,
    onRecordPayment,
    onOpenSettings
}) {
    // Memoize bills calculation if needed, but for now calculate in render
    const allBills = calculateAllBills(transactions, creditCardRules, luts.accounts);

    // Calculate paid amounts
    const paidAmounts = new Map();
    transactions.forEach((tx) => {
        if (
            tx.type === "transfer" &&
            tx.metadata &&
            tx.metadata.paymentTargetCardId &&
            tx.metadata.paymentTargetClosingDate
        ) {
            const key = `${tx.metadata.paymentTargetCardId}_${tx.metadata.paymentTargetClosingDate}`;
            const current = paidAmounts.get(key) || 0;
            paidAmounts.set(key, current + tx.amount);
        }
    });

    // Filter unpaid/remaining bills
    const unpaidBills = allBills.filter((bill) => {
        const key = `${bill.cardId}_${bill.closingDateStr}`;
        const paidAmount = paidAmounts.get(key) || 0;
        bill.paidAmount = paidAmount;
        bill.remainingAmount = bill.amount - paidAmount;
        return bill.remainingAmount > 0;
    });

    const handleRecordPayment = (bill) => {
        const paymentDate = getPaymentDate(bill.closingDate, bill.rule);
        const closingDateStr = utils.toYYYYMMDD(bill.closingDate);
        const paymentDateStr = utils.toYYYYMMDD(paymentDate);

        onRecordPayment({
            toAccountId: bill.cardId,
            cardName: bill.cardName,
            amount: bill.remainingAmount,
            paymentDate: paymentDate, // Date obj
            paymentDateStr: paymentDateStr, // String
            defaultAccountId: bill.rule.defaultPaymentAccountId,
            closingDate: bill.closingDate, // Date obj for display if needed
            closingDateStr: closingDateStr, // String YYYY-MM-DD
            formattedClosingDate: formatInTimeZone(bill.closingDate, "Asia/Tokyo", "M月d日")
        });
    };

    return (
        <div className="space-y-4">
            {isDataInsufficient && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 flex justify-between items-center fade-in">
                    <div className="flex items-center">
                        <i className="fas fa-exclamation-triangle text-yellow-500 mr-3"></i>
                        <div>
                            <p className="text-sm text-yellow-700 font-bold">表示期間が短いため、一部の請求が表示されていない可能性があります。</p>
                            <p className="text-xs text-yellow-600">正確な請求管理を行うには、設定から表示期間を長くしてください。</p>
                        </div>
                    </div>
                    <button
                        onClick={onOpenSettings}
                        className="text-sm bg-white border border-yellow-400 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-100 transition"
                    >
                        設定を変更
                    </button>
                </div>
            )}

            {unpaidBills.length === 0 ? (
                <p className="text-center text-neutral-400 py-4 fade-in">未払いの請求はありません。</p>
            ) : (
                unpaidBills.map((bill) => {
                    const paymentDate = getPaymentDate(bill.closingDate, bill.rule);
                    const billingPeriod = getBillingPeriod(bill.closingDate, bill.rule);
                    const paymentDateDisplay = formatInTimeZone(paymentDate, "Asia/Tokyo", "yyyy年M月d日");
                    
                    // Generate unique key
                    const key = `${bill.cardId}-${bill.closingDateStr}`;

                    return (
                        <div key={key} className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 fade-in-up">
                            <div className="grow">
                                <div className="flex items-center gap-3 mb-2">
                                    <i className={`${bill.icon || "fas fa-credit-card"} text-xl text-neutral-400 w-6 text-center`}></i>
                                    <h3 className="font-bold text-lg text-neutral-800">{bill.cardName}</h3>
                                </div>
                                <p className="text-sm text-neutral-600">請求期間: {billingPeriod}</p>
                                <p className="text-sm text-neutral-600">支払予定日: {paymentDateDisplay}</p>
                            </div>
                            
                            <div className="w-full md:w-auto flex flex-col items-end">
                                <div className="text-right">
                                    {bill.paidAmount > 0 ? (
                                        <>
                                            <p className="text-xs text-neutral-500">
                                                請求総額: {utils.formatCurrency(bill.amount, isMasked)}
                                            </p>
                                            <p className="text-xs text-success">
                                                支払済: {utils.formatCurrency(bill.paidAmount, isMasked)}
                                            </p>
                                            <p className="text-sm text-neutral-600 mt-1">残り支払額</p>
                                        </>
                                    ) : (
                                        <p className="text-sm text-neutral-600">請求額</p>
                                    )}
                                    <p className="font-bold text-2xl text-danger mb-3">
                                        {utils.formatCurrency(bill.remainingAmount, isMasked)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleRecordPayment(bill)}
                                    className="w-full md:w-auto bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-dark transition shadow-md"
                                >
                                    <i className="fas fa-money-bill-wave mr-2"></i>振替を記録する
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
