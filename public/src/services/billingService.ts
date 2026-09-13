import {
	addDays,
	addMonths,
	lastDayOfMonth,
	setDate,
	subMonths,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type { CreditCardRule } from "../types/settings";
import * as utils from "../utils.js";

/**
 * 請求オブジェクトの型定義。
 */
export interface Bill {
	cardId: string;
	cardName: string;
	rule: CreditCardRule;
	closingDate: Date;
	closingDateStr: string;
	amount: number;
	icon?: string;
	order?: number;
	paidAmount: number;
	remainingAmount: number;
}

export interface BillingTransaction {
	id?: string;
	date: string;
	amount: number;
	description?: string;
	categoryId?: string;
	fromAccountId: string;
	toAccountId?: string;
	type: "income" | "expense" | "transfer";
	memo?: string;
	metadata?: {
		paymentTargetCardId?: string;
		paymentTargetClosingDate?: string;
	};
}

/**
 * 指定した月の日付を安全に設定するヘルパー関数。
 * 月末日を超えてしまう場合（例: 2月30日）は、その月の最終日に補正する。
 */
export const setDateSafe = (date: Date, day: number): Date => {
	const lastDay = lastDayOfMonth(date).getDate();
	return setDate(date, Math.min(day, lastDay));
};

/**
 * 取引日と締め日から、その取引が属する請求サイクルの締め日を計算する。
 */
export function getClosingDateForTransaction(txDate: string | Date, closingDay: number): Date {
	const txDateStr = typeof txDate === "string" ? txDate.split("T")[0] : utils.toYYYYMMDD(txDate);
	const [y, m, d] = txDateStr.split("-").map(Number);
	let targetDate = new Date(y, m - 1, d);

	if (targetDate.getDate() > closingDay) {
		targetDate = addMonths(targetDate, 1);
	}

	targetDate = setDateSafe(targetDate, closingDay);
	return fromZonedTime(targetDate, "Asia/Tokyo");
}

/**
 * 締め日と支払ルールに基づいて確定の支払日（引き落とし日）を計算する。
 */
export function getPaymentDate(closingDate: Date, rule: CreditCardRule): Date {
	let targetDate = toZonedTime(closingDate, "Asia/Tokyo");
	targetDate = addMonths(targetDate, rule.paymentMonthOffset);
	targetDate = setDateSafe(targetDate, rule.paymentDay);
	return fromZonedTime(targetDate, "Asia/Tokyo");
}

/**
 * 請求期間の表示用文字列（YYYY年M月D日 〜 YYYY年M月D日）を生成する。
 */
export function getBillingPeriod(closingDate: Date, rule: CreditCardRule): string {
	const endLocal = toZonedTime(closingDate, "Asia/Tokyo");
	let startLocal: Date;

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
 * 全ての取引履歴とカード設定に基づいて、全ての請求データを計算する。
 */
export function calculateAllBills(
	allTransactions: BillingTransaction[],
	creditCardRules: Record<string, CreditCardRule>,
	accountsMap: Map<string, { id: string; name: string; type: string; isDeleted?: boolean; icon?: string; order?: number }>,
): Bill[] {
	const allBills: Bill[] = [];
	const liabilityAccounts = [...accountsMap.values()].filter(
		(acc) => acc.type === "liability" && !acc.isDeleted,
	);
	const liabilityAccountIds = new Set(liabilityAccounts.map((acc) => acc.id));
	const expensesByAccount = new Map<string, BillingTransaction[]>();

	for (const t of allTransactions) {
		let targetAccountId: string | null = null;
		if (t.type === "expense" && liabilityAccountIds.has(t.fromAccountId)) {
			targetAccountId = t.fromAccountId;
		} else if (t.type === "transfer" && liabilityAccountIds.has(t.fromAccountId)) {
			targetAccountId = t.fromAccountId;
		}

		if (targetAccountId) {
			if (!expensesByAccount.has(targetAccountId)) {
				expensesByAccount.set(targetAccountId, []);
			}
			expensesByAccount.get(targetAccountId)!.push(t);
		}
	}

	for (const card of liabilityAccounts) {
		const rule = creditCardRules[card.id];
		if (!rule) continue;

		const expenses = expensesByAccount.get(card.id) || [];
		if (expenses.length === 0) continue;

		const billsByCycle: Record<string, Bill> = {};

		for (const t of expenses) {
			const closingDate = getClosingDateForTransaction(t.date, rule.closingDay);
			const closingDateStr = utils.toYYYYMMDD(closingDate);

			if (!billsByCycle[closingDateStr]) {
				billsByCycle[closingDateStr] = {
					cardId: card.id,
					cardName: card.name,
					rule,
					closingDate,
					closingDateStr,
					amount: 0,
					icon: card.icon,
					order: card.order || 0,
					paidAmount: 0,
					remainingAmount: 0,
				};
			}
			billsByCycle[closingDateStr].amount += t.amount;
		}
		allBills.push(...Object.values(billsByCycle));
	}

	return allBills.sort(
		(a, b) => (a.order || 0) - (b.order || 0) || a.closingDate.getTime() - b.closingDate.getTime(),
	);
}

/**
 * 請求リストと取引履歴から、未払い（残高あり）の請求一覧を計算する。
 */
export function calculateUnpaidBills(
	allBills: Bill[],
	transactions: BillingTransaction[],
): Bill[] {
	const paidAmounts = new Map<string, number>();
	for (const tx of transactions) {
		if (
			tx.type === "transfer" &&
			tx.metadata?.paymentTargetCardId &&
			tx.metadata?.paymentTargetClosingDate
		) {
			const key = `${tx.metadata.paymentTargetCardId}_${tx.metadata.paymentTargetClosingDate}`;
			const current = paidAmounts.get(key) || 0;
			paidAmounts.set(key, current + tx.amount);
		}
	}

	return allBills
		.map((bill) => {
			const key = `${bill.cardId}_${bill.closingDateStr}`;
			const paidAmount = paidAmounts.get(key) || 0;
			return {
				...bill,
				paidAmount,
				remainingAmount: bill.amount - paidAmount,
			};
		})
		.filter((bill) => bill.remainingAmount > 0);
}

