import { faCheckCircle, faCreditCard } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatInTimeZone } from "date-fns-tz";
import {
	type Bill,
	calculateAllBills,
	calculateUnpaidBills,
	getBillingPeriod,
	getPaymentDate,
} from "../services/billingService";
import type { CreditCardRule } from "../types/settings";
import * as utils from "../utils.js";
import { ICON_MAP } from "./settings/IconPicker";
import NoDataState from "./ui/NoDataState";

/**
 * BillingListコンポーネントのプロパティ。
 */
interface BillingListProps {
	/** 取引履歴リスト。 */
	transactions: Array<{
		id: string;
		date: string;
		amount: number;
		description: string;
		categoryId: string;
		fromAccountId: string;
		toAccountId?: string;
		type: "income" | "expense" | "transfer";
		memo?: string;
		metadata?: {
			paymentTargetCardId?: string;
			paymentTargetClosingDate?: string;
		};
	}>;
	/** カード設定ルール。 */
	creditCardRules: Record<string, CreditCardRule>;
	/** 金額マスクフラグ。 */
	isMasked: boolean;
	/** ルックアップテーブル（口座情報など）。 */
	luts: {
		accounts: Map<
			string,
			{
				id: string;
				name: string;
				type: "asset" | "liability";
				isDeleted?: boolean;
				icon?: string;
				order?: number;
			}
		>;
	};
	/** 支払い記録実行時のコールバック。 */
	onRecordPayment: (data: {
		toAccountId: string;
		cardName: string;
		amount: number;
		paymentDate: Date;
		paymentDateStr: string;
		defaultAccountId?: string;
		closingDate: Date;
		closingDateStr: string;
		formattedClosingDate: string;
	}) => void;
}

/**
 * クレジットカード請求一覧表示コンポーネント。
 * 未払いの請求を検出し、カードごとにまとめて表示する。
 * 支払いを記録するための機能も提供する。
 */
export default function BillingList({
	transactions,
	creditCardRules,
	isMasked,
	luts,
	onRecordPayment,
}: BillingListProps) {
	// 請求データおよび未払い請求の計算
	const allBills = calculateAllBills(
		transactions,
		creditCardRules,
		luts.accounts,
	);
	const unpaidBills = calculateUnpaidBills(allBills, transactions);

	const handleRecordPayment = (bill: Bill) => {
		const paymentDate = getPaymentDate(bill.closingDate, bill.rule);
		const closingDateStr = utils.toYYYYMMDD(bill.closingDate);
		const paymentDateStr = utils.toYYYYMMDD(paymentDate);

		onRecordPayment({
			toAccountId: bill.cardId,
			cardName: bill.cardName,
			amount: bill.remainingAmount,
			paymentDate,
			paymentDateStr,
			defaultAccountId: bill.rule.defaultPaymentAccountId,
			closingDate: bill.closingDate,
			closingDateStr,
			formattedClosingDate: formatInTimeZone(
				bill.closingDate,
				"Asia/Tokyo",
				"M月d日",
			),
		});
	};

	// アイコン文字列をオブジェクトに変換するヘルパー
	const getIcon = (iconStr?: string) =>
		ICON_MAP.find((i) => i.value === iconStr)?.icon || faCreditCard;

	return (
		<div className="space-y-4">
			{unpaidBills.length === 0 ? (
				<NoDataState
					message="未払いの請求はありません"
					icon={faCheckCircle}
					className="py-8 fade-in"
				/>
			) : (
				unpaidBills.map((bill) => {
					const paymentDate = getPaymentDate(bill.closingDate, bill.rule);
					const billingPeriod = getBillingPeriod(bill.closingDate, bill.rule);
					const paymentDateDisplay = formatInTimeZone(
						paymentDate,
						"Asia/Tokyo",
						"yyyy年M月d日",
					);

					// 一意なキーを生成する。
					const key = `${bill.cardId}-${bill.closingDateStr}`;

					return (
						<div
							key={key}
							className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 fade-in-up"
						>
							<div className="grow">
								<div className="flex items-center gap-3 mb-2">
									<FontAwesomeIcon
										icon={getIcon(bill.icon)}
										className="text-xl text-neutral-400 w-6 text-center"
									/>
									<h3 className="font-bold text-lg text-neutral-800">
										{bill.cardName}
									</h3>
								</div>
								<p className="text-sm text-neutral-600">
									請求期間: {billingPeriod}
								</p>
								<p className="text-sm text-neutral-600">
									支払予定日: {paymentDateDisplay}
								</p>
							</div>

							<div className="w-full md:w-auto flex flex-col items-end">
								<div className="text-right">
									{bill.paidAmount > 0 ? (
										<>
											<p className="text-xs text-neutral-500">
												請求総額: {utils.formatCurrency(bill.amount, isMasked)}
											</p>
											<p className="text-xs text-success">
												支払済:{" "}
												{utils.formatCurrency(bill.paidAmount, isMasked)}
											</p>
											<p className="text-sm text-neutral-600 mt-1">
												残り支払額
											</p>
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
									<FontAwesomeIcon icon={faCreditCard} className="mr-2" />
									振替を記録する
								</button>
							</div>
						</div>
					);
				})
			)}
		</div>
	);
}
