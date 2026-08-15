import {
	faArrowDown,
	faArrowUp,
	faExchangeAlt,
	faScaleBalanced,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMemo } from "react";
import * as utils from "../utils.js";

/**
 * ハイライトテキストコンポーネントのプロパティ。
 */
interface HighlightedTextProps {
	/** 元のテキスト。 */
	text: string;
	/** ハイライトする語句。 */
	highlight?: string;
}

/**
 * 検索語句を正規表現パターンに前処理する。
 * `terms`（小文字セット）と `parts` 判定用の正規表現を一度だけ生成し、
 * `HighlightedText` の毎レンダリング再計算コストを排除する。
 */
const buildHighlight = (
	highlight: string,
): { lowerTerms: Set<string>; regex: RegExp } | null => {
	if (!highlight) return null;
	const terms = highlight
		.trim()
		.split(/[\s\u3000]+/)
		.filter(Boolean);
	if (terms.length === 0) return null;
	const escaped = terms.map((term) =>
		term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
	);
	return {
		lowerTerms: new Set(terms.map((t) => t.toLowerCase())),
		regex: new RegExp(`(${escaped.join("|")})`, "gi"),
	};
};

/**
 * テキスト内の検索語句をハイライト表示するコンポーネント。
 * ハイライト用データは `useMemo` でメモ化し、再レンダリング時の正規表現生成と
 * 大文字小文字を区別しない `some` 比較（O(parts × terms)）を回避する。
 * @param props - HighlightedTextProps。
 * @returns ハイライト表示されたテキストコンポーネント。
 */
const HighlightedText = ({ text, highlight }: HighlightedTextProps) => {
	const highlightData = useMemo(
		() => buildHighlight(highlight || ""),
		[highlight],
	);
	if (!highlightData || !text) return <>{text}</>;

	const { lowerTerms, regex } = highlightData;
	const parts = text.toString().split(regex);

	return (
		<>
			{parts.map((part, i) =>
				lowerTerms.has(part.toLowerCase()) ? (
					<span
						key={i}
						className="bg-yellow-200 text-neutral-900 rounded-xs px-0.5"
					>
						{part}
					</span>
				) : (
					part
				),
			)}
		</>
	);
};

/**
 * トランザクションデータの型。
 */
type TransactionData = {
	id: string;
	date: string;
	amount: number;
	description: string;
	categoryId: string;
	fromAccountId: string;
	toAccountId?: string;
	type: "income" | "expense" | "transfer";
	memo?: string;
};

/**
 * ルックアップテーブルの型。
 */
interface Luts {
	categories: Map<string, {
		id: string;
		name: string;
		type: "income" | "expense";
		isDeleted?: boolean;
	}>;
	accounts: Map<string, {
		id: string;
		name: string;
		type: string;
		isDeleted?: boolean;
	}>;
}

/**
 * TransactionItemコンポーネントのプロパティ。
 */
interface TransactionItemProps {
	/** 取引データオブジェクト。 */
	transaction: TransactionData;
	/** ルックアップテーブル（カテゴリ、口座）。 */
	luts: Luts;
	/** 金額を隠すマスクモードかどうか。 */
	isMasked: boolean;
	/** アイテムクリック時のコールバック。 */
	onClick: (id: string) => void;
	/** ハイライトする検索語句。 */
	highlightTerm?: string;
}

/**
 * 個別のトランザクションアイテムを表示するコンポーネント。
 * 取引の種類（収入・支出・振替・残高調整）に応じたアイコンと詳細情報をレンダリングする。
 * @param props - TransactionItemProps。
 * @returns トランザクションアイテムコンポーネント。
 */
const TransactionItem = ({
	transaction: t,
	luts,
	isMasked,
	onClick,
	highlightTerm,
}: TransactionItemProps) => {
	const { categories, accounts } = luts;

	// データ解決ロジック。
	const category = categories.get(t.categoryId);
	const fromAccount = accounts.get(t.fromAccountId);
	const toAccount = t.toAccountId ? accounts.get(t.toAccountId) : undefined;

	const formatName = (item: { name: string; isDeleted?: boolean } | undefined, defaultName: string) =>
		item ? `${item.name}${item.isDeleted ? " (削除済み)" : ""}` : defaultName;

	let icon, primaryText, secondaryText;
	let isDeleted = false;

	if (t.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) {
		icon = (
			<div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
				<FontAwesomeIcon icon={faScaleBalanced} className="text-primary" />
			</div>
		);
		primaryText = "残高調整";
		secondaryText = formatName(fromAccount, "不明な口座");
		isDeleted = !!fromAccount?.isDeleted;
	} else if (t.type === "transfer") {
		icon = (
			<div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
				<FontAwesomeIcon icon={faExchangeAlt} className="text-primary" />
			</div>
		);
		primaryText = t.description || "振替";
		const fromName = formatName(fromAccount, "不明");
		const toName = formatName(toAccount, "不明");
		secondaryText = `${fromName} → ${toName}`;
		isDeleted = !!(fromAccount?.isDeleted || toAccount?.isDeleted);
	} else {
		const accountName = formatName(fromAccount, "不明");
		const categoryName = formatName(category, "カテゴリなし");
		const iconObj = category?.type === "income" ? faArrowUp : faArrowDown;
		const colorClass =
			category?.type === "income" ? "text-success" : "text-danger";
		const iconBg =
			category?.type === "income" ? "bg-success-light" : "bg-danger-light";

		icon = (
			<div
				className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}
			>
				<FontAwesomeIcon icon={iconObj} className={colorClass} />
			</div>
		);

		// descriptionがあればそれを、なければカテゴリ名をプライマリテキストにする。
		primaryText = t.description || categoryName;
		// descriptionがある場合、セカンダリに "カテゴリ / 口座" を表示する。
		secondaryText = t.description
			? `${categoryName} / ${accountName}`
			: accountName;
		isDeleted = !!(category?.isDeleted || fromAccount?.isDeleted);
	}

	// 金額表示ロジック。
	const formattedAmount = utils.formatCurrency(Math.abs(t.amount), isMasked);
	let amountElement;

	if (isMasked) {
		amountElement = (
			<p className="font-semibold text-neutral-900 text-lg whitespace-nowrap">
				{formattedAmount}
			</p>
		);
	} else {
		let className = "text-neutral-900";
		let sign = "";
		if (t.type === "expense") {
			className = "text-danger";
			sign = "-";
		} else if (t.type === "income") {
			className = "text-success";
			sign = "+";
		}
		amountElement = (
			<p className={`font-semibold ${className} text-lg whitespace-nowrap`}>
				{sign}
				{formattedAmount}
			</p>
		);
	}

	return (
		<div
			className={`bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4 transition-all duration-200 mb-2 ${
				isDeleted
					? "opacity-60 cursor-not-allowed"
					: "cursor-pointer hover-lift"
			}`}
			onClick={() => !isDeleted && onClick(t.id)}
			data-id={t.id}
		>
			<div className="grow min-w-0 flex items-center space-x-4">
				{icon}
				<div className="min-w-0">
					<p className="font-medium text-neutral-900 truncate">
						<HighlightedText text={primaryText} highlight={highlightTerm} />
					</p>
					<p className="text-sm text-neutral-600 truncate">
						<HighlightedText text={secondaryText} highlight={highlightTerm} />
					</p>
				</div>
			</div>
			{amountElement}
		</div>
	);
};

/**
 * DateGroupコンポーネントのプロパティ。
 */
interface DateGroupProps {
	/** 表示用の日付文字列。 */
	dateStr: string;
	/** その日の取引リスト。 */
	transactions: TransactionData[];
	/** ルックアップテーブル。 */
	luts: Luts;
	/** マスクモード。 */
	isMasked: boolean;
	/** クリックハンドラ。 */
	onTransactionClick: (id: string) => void;
	/** ハイライトする検索語句。 */
	highlightTerm?: string;
}

/**
 * 日付ごとの取引グループコンポーネント。
 * 日付見出しと、その日の取引リストを表示する。
 * @param props - DateGroupProps。
 * @returns 日付グループコンポーネント。
 */
const DateGroup = ({
	dateStr,
	transactions,
	luts,
	isMasked,
	onTransactionClick,
	highlightTerm,
}: DateGroupProps) => {
	return (
		<div className="mb-4">
			<h3 className="text-lg font-semibold text-neutral-600 mt-4 mb-2 sticky top-0 bg-neutral-50 py-2 z-10">
				{dateStr}
			</h3>
			<div className="space-y-2">
				{transactions.map((t) => (
					<TransactionItem
						key={t.id}
						transaction={t}
						luts={luts}
						isMasked={isMasked}
						onClick={onTransactionClick}
						highlightTerm={highlightTerm}
					/>
				))}
			</div>
		</div>
	);
};

/**
 * TransactionListコンポーネントのプロパティ。
 */
interface TransactionListProps {
	/** フィルタリング済みの取引データ配列。 */
	transactions: TransactionData[];
	/** カテゴリや口座のルックアップテーブル。 */
	luts: Luts;
	/** 金額マスクフラグ。 */
	isMasked: boolean;
	/** 取引クリック時のコールバック。 */
	onTransactionClick: (id: string) => void;
	/** ハイライトする検索語句。 */
	highlightTerm?: string;
}

/**
 * 取引リストのメインコンポーネント。
 * 受け取った取引データを日付別にグループ化してレンダリングする。
 * データが空の場合は null を返す。
 * @param props - TransactionListProps。
 * @returns トランザクションリストコンポーネント。
 */
export default function TransactionList({
	transactions,
	luts,
	isMasked,
	onTransactionClick,
	highlightTerm,
}: TransactionListProps) {
	/**
	 * トランザクションを日付文字列キーでグループ化した配列を生成する。
	 * 日付順序は入力配列の順序（通常は降順）に依存する。
	 */
	const groupedTransactions = useMemo(() => {
		const grouped = new Map();
		if (!transactions) return [];

		transactions.forEach((t) => {
			const dateStr = utils.formatDateWithWeekday(new Date(t.date));
			if (!grouped.has(dateStr)) {
				grouped.set(dateStr, []);
			}
			grouped.get(dateStr).push(t);
		});

		// Mapを配列に変換する。
		return Array.from(grouped.entries()).map(([dateStr, items]) => ({
			dateStr,
			items,
		}));
	}, [transactions]);

	if (!transactions || transactions.length === 0) {
		return null;
	}

	return (
		<div className="transaction-list-container">
			{groupedTransactions.map((group) => (
				<DateGroup
					key={group.dateStr}
					dateStr={group.dateStr}
					transactions={group.items}
					luts={luts}
					isMasked={isMasked}
					onTransactionClick={onTransactionClick}
					highlightTerm={highlightTerm}
				/>
			))}
		</div>
	);
}
