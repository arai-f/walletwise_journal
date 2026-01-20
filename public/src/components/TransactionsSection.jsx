import { useMemo, useState } from "react";
import * as utils from "../utils.js";
import TransactionList from "./TransactionList";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";

/**
 * トランザクション一覧セクションコンポーネント。
 * 取引履歴の表示、フィルタリング（月、種類、カテゴリ、検索）、および新規追加・スキャンボタンを提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Array<object>} props.transactions - 取引データ配列。
 * @param {object} props.luts - ルックアップテーブル。
 * @param {string} props.currentMonthFilter - 現在の月フィルタ ('YYYY-MM' または 'all-time')。
 * @param {string} props.periodLabel - 期間表示ラベル。
 * @param {Function} props.onMonthChange - 月変更コールバック。
 * @param {Function} props.onAddClick - 追加ボタンクリックコールバック。
 * @param {Function} props.onTransactionClick - 取引クリックコールバック (id) => void。
 * @param {Function} props.onScanClick - スキャンボタンクリックコールバック。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @returns {JSX.Element} トランザクションセクションコンポーネント。
 */
const TransactionsSection = ({
	transactions = [],
	luts,
	currentMonthFilter,
	periodLabel = "全期間",
	onMonthChange,
	onAddClick,
	onTransactionClick,
	onScanClick,
	isMasked,
}) => {
	const [filterType, setFilterType] = useState("all");
	const [filterCategory, setFilterCategory] = useState("all");
	const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");
	const [searchTerm, setSearchTerm] = useState("");

	/**
	 * トランザクションデータから存在する月のリストを生成する。
	 * 「YYYY-MM」形式の重複なしリストを降順で返す。
	 */
	const monthOptions = useMemo(() => {
		const months = new Set(transactions.map((t) => utils.toYYYYMM(t.date)));
		const sortedMonths = [...months].sort().reverse();
		return sortedMonths;
	}, [transactions]);

	/**
	 * 月フィルタの変更を処理する。
	 * 親コンポーネントに通知を行う。
	 * @param {Event} e - 変更イベント。
	 */
	const handleMonthChange = (e) => {
		onMonthChange(e.target.value);
	};

	/**
	 * 指定された月フィルタに基づいてトランザクションを抽出する。
	 * 'all-time' の場合は全てのトランザクションを返す。
	 */
	const transactionsInMonth = useMemo(() => {
		if (currentMonthFilter === "all-time") return transactions;
		const [year, month] = currentMonthFilter.split("-").map(Number);
		return transactions.filter((t) => {
			const yyyymm = utils.toYYYYMM(t.date);
			const [tYear, tMonth] = yyyymm.split("-").map(Number);
			return tYear === year && tMonth === month;
		});
	}, [transactions, currentMonthFilter]);

	/**
	 * ローカルフィルタ（種別、カテゴリ、支払方法、キーワード検索）を適用したトランザクションリストを生成する。
	 * 月フィルタ済みのデータをさらに絞り込む。
	 */
	const filteredTransactions = useMemo(() => {
		let filtered = [...transactionsInMonth];

		if (filterType !== "all") {
			filtered = filtered.filter((t) => t.type === filterType);
		}

		if (filterCategory !== "all") {
			filtered = filtered.filter((t) => t.categoryId === filterCategory);
		}

		if (filterPaymentMethod !== "all") {
			filtered = filtered.filter(
				(t) =>
					t.accountId === filterPaymentMethod ||
					t.fromAccountId === filterPaymentMethod ||
					t.toAccountId === filterPaymentMethod,
			);
		}

		if (searchTerm.trim() !== "") {
			const term = searchTerm.trim().toLowerCase();
			filtered = filtered.filter((t) => {
				const categoryName = luts.categories.get(t.categoryId)?.name || "";
				const accountName = luts.accounts.get(t.accountId)?.name || "";
				const fromName = luts.accounts.get(t.fromAccountId)?.name || "";
				const toName = luts.accounts.get(t.toAccountId)?.name || "";

				return (
					(t.description && t.description.toLowerCase().includes(term)) ||
					(t.memo && t.memo.toLowerCase().includes(term)) ||
					categoryName.toLowerCase().includes(term) ||
					accountName.toLowerCase().includes(term) ||
					fromName.toLowerCase().includes(term) ||
					toName.toLowerCase().includes(term)
				);
			});
		}

		return filtered;
	}, [
		transactionsInMonth,
		filterType,
		filterCategory,
		filterPaymentMethod,
		searchTerm,
		luts,
	]);

	/**
	 * 現在のフィルタ状態に基づいて利用可能なカテゴリオプションを生成する。
	 * 収入/支出フィルタが適用されている場合、対応するカテゴリのみを表示する。
	 */
	const categoryOptions = useMemo(() => {
		const allCategories = [...luts.categories.values()].filter(
			(c) => !c.isDeleted,
		);
		let options = allCategories;
		if (filterType === "income" || filterType === "expense") {
			options = options.filter((c) => c.type === filterType);
		}
		return options.sort(
			(a, b) =>
				(a.order || 0) - (b.order || 0) ||
				(a.name || "").localeCompare(b.name || ""),
		);
	}, [luts.categories, filterType]);

	/**
	 * 利用可能なアカウントオプションを生成・ソートする。
	 * 資産タイプのアカウントを優先的に表示する。
	 */
	const accountOptions = useMemo(() => {
		return [...luts.accounts.values()]
			.filter((a) => !a.isDeleted)
			.sort((a, b) => {
				if (a.type !== b.type) return a.type === "asset" ? -1 : 1;
				return (
					(a.order || 0) - (b.order || 0) ||
					(a.name || "").localeCompare(b.name || "")
				);
			});
	}, [luts.accounts]);

	/**
	 * 全てのフィルタ条件を初期状態にリセットする。
	 */
	const handleReset = () => {
		setFilterType("all");
		setFilterCategory("all");
		setFilterPaymentMethod("all");
		setSearchTerm("");
	};

	return (
		<section id="transactions-section">
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3">
					取引履歴
				</h2>
				<Select
					id="month-filter"
					aria-label="取引履歴の表示月"
					className="w-36 md:w-40"
					value={currentMonthFilter}
					onChange={handleMonthChange}
					disabled={false}
				>
					<option value="all-time">{periodLabel}</option>
					{monthOptions.map((m) => (
						<option key={m} value={m}>
							{m.replace("-", "年")}月
						</option>
					))}
				</Select>
			</div>

			<div
				id="filter-section"
				className="bg-white p-4 rounded-xl shadow-sm mb-4 flex flex-wrap items-center gap-x-4 gap-y-3"
			>
				{/* Type Filter */}
				<div className="w-full sm:w-auto grow">
					<Select
						id="type-filter"
						aria-label="取引種別で絞り込む"
						value={filterType}
						onChange={(e) => {
							setFilterType(e.target.value);
							setFilterCategory("all");
						}}
					>
						<option value="all">すべての取引</option>
						<option value="income">収入</option>
						<option value="expense">支出</option>
						<option value="transfer">振替</option>
					</Select>
				</div>

				{/* Category Filter */}
				<div className="w-full sm:w-auto grow">
					<Select
						id="category-filter"
						aria-label="カテゴリで絞り込む"
						value={filterCategory}
						onChange={(e) => setFilterCategory(e.target.value)}
						disabled={filterType !== "income" && filterType !== "expense"}
					>
						<option value="all">すべてのカテゴリ</option>
						{categoryOptions.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</Select>
				</div>

				{/* Payment Method Filter */}
				<div className="w-full sm:w-auto grow">
					<Select
						id="payment-method-filter"
						aria-label="支払方法で絞り込む"
						value={filterPaymentMethod}
						onChange={(e) => setFilterPaymentMethod(e.target.value)}
					>
						<option value="all">すべての支払方法</option>
						{accountOptions.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</Select>
				</div>

				{/* Search & Reset */}
				<div className="w-full md:w-auto grow flex items-center gap-2">
					<div className="grow">
						<Input
							id="search-input"
							type="text"
							placeholder="キーワードで検索..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Escape") setSearchTerm("");
							}}
						/>
					</div>
					<Button
						id="reset-filters-button"
						variant="secondary"
						aria-label="フィルターをリセット"
						onClick={handleReset}
						className="whitespace-nowrap"
					>
						リセット
					</Button>
				</div>
			</div>

			{/* List */}
			<div id="transactions-list" className="space-y-3">
				<TransactionList
					transactions={filteredTransactions}
					luts={luts}
					isMasked={isMasked}
					onTransactionClick={onTransactionClick}
				/>
			</div>

			{/* FABs */}
			<div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-4 items-end pointer-events-none">
				<div className="group flex items-center gap-3 pointer-events-auto">
					{/* PC用ツールチップ */}
					<span className="hidden md:block opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 transition-all duration-200 bg-neutral-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl">
						取引を追加
					</span>
					<button
						id="add-transaction-button"
						aria-label="新しい取引を追加する"
						className="ai-rainbow-btn w-16 h-16 flex items-center justify-center shadow-lg transform transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-300"
						title="取引を手動入力"
						onClick={onAddClick}
					>
						<i className="fas fa-plus text-2xl"></i>
					</button>
				</div>
			</div>

			<input type="file" id="receipt-file-input" accept="image/*" hidden />
		</section>
	);
};

export default TransactionsSection;
