import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMemo } from "react";
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
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {object} props.filters - 外部から注入されるフィルタ状態。
 * @param {object} props.onFilterChange - フィルタ状態変更コールバック。
 * @param {Function} props.onFilterReset - フィルタリセットコールバック。
 * @returns {JSX.Element} トランザクションセクションコンポーネント。
 */
const TransactionsSection = ({
	transactions = [],
	luts,
	currentMonthFilter,
	onMonthChange,
	onAddClick,
	onTransactionClick,
	isMasked,
	filters,
	onFilterChange,
	onFilterReset,
}) => {
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

		if (filters.sourceFilter !== "all") {
			if (filters.sourceFilter.startsWith("type:")) {
				const type = filters.sourceFilter.split(":")[1];
				filtered = filtered.filter((t) => t.type === type);
			} else if (filters.sourceFilter.startsWith("cat:")) {
				const catId = filters.sourceFilter.split(":")[1];
				filtered = filtered.filter((t) => t.categoryId === catId);
			}
		}

		if (filters.paymentMethodFilter !== "all") {
			filtered = filtered.filter(
				(t) =>
					t.accountId === filters.paymentMethodFilter ||
					t.fromAccountId === filters.paymentMethodFilter ||
					t.toAccountId === filters.paymentMethodFilter,
			);
		}

		if (filters.searchTerm.trim() !== "") {
			const term = filters.searchTerm.trim().toLowerCase();
			filtered = filtered.filter((t) => {
				const categoryName = luts.categories.get(t.categoryId)?.name || "";
				const accountName = luts.accounts.get(t.accountId)?.name || "";
				const fromName = luts.accounts.get(t.fromAccountId)?.name || "";
				const toName = luts.accounts.get(t.toAccountId)?.name || "";
				const amountStr = String(t.amount);

				return (
					(t.description && t.description.toLowerCase().includes(term)) ||
					(t.memo && t.memo.toLowerCase().includes(term)) ||
					categoryName.toLowerCase().includes(term) ||
					accountName.toLowerCase().includes(term) ||
					fromName.toLowerCase().includes(term) ||
					toName.toLowerCase().includes(term) ||
					amountStr.includes(term)
				);
			});
		}

		return filtered;
	}, [
		transactionsInMonth,
		filters.sourceFilter,
		filters.paymentMethodFilter,
		filters.searchTerm,
		luts,
	]);

	/**
	 * 統合されたフィルタオプション（種別とカテゴリ）を生成する。
	 */
	const sourceOptions = useMemo(() => {
		const allCategories = [...luts.categories.values()].filter(
			(c) => !c.isDeleted,
		);
		const sortCats = (cats) =>
			cats.sort(
				(a, b) =>
					(a.order || 0) - (b.order || 0) ||
					(a.name || "").localeCompare(b.name || ""),
			);

		const incomeCats = sortCats(
			allCategories.filter((c) => c.type === "income"),
		);
		const expenseCats = sortCats(
			allCategories.filter((c) => c.type === "expense"),
		);

		return { incomeCats, expenseCats };
	}, [luts.categories]);

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

	const hasActiveFilters =
		filters.sourceFilter !== "all" ||
		filters.paymentMethodFilter !== "all" ||
		filters.searchTerm.trim() !== "";

	const periodLabel =
		luts.config?.displayPeriod === 12
			? "過去1年"
			: `過去${luts.config?.displayPeriod || 3}ヶ月`;
	return (
		<section id="transactions-section">
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3">
					取引履歴
				</h2>
				<Select
					id="month-filter"
					name="monthFilter"
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
				className="bg-white p-4 rounded-xl shadow-sm mb-4 flex flex-col md:grid md:grid-cols-3 items-stretch md:items-center gap-3"
			>
				<div className="w-full">
					<Select
						id="source-filter"
						name="sourceFilter"
						aria-label="種別・カテゴリで絞り込む"
						value={filters.sourceFilter}
						onChange={(e) => onFilterChange.source(e.target.value)}
						className="w-full"
					>
						<option value="all">すべての取引</option>
						<optgroup label="支出">
							<option value="type:expense">支出 (すべて)</option>
							{sourceOptions.expenseCats.map((c) => (
								<option key={c.id} value={`cat:${c.id}`}>
									{c.name}
								</option>
							))}
						</optgroup>
						<optgroup label="収入">
							<option value="type:income">収入 (すべて)</option>
							{sourceOptions.incomeCats.map((c) => (
								<option key={c.id} value={`cat:${c.id}`}>
									{c.name}
								</option>
							))}
						</optgroup>
						<optgroup label="その他">
							<option value="type:transfer">振替</option>
						</optgroup>
					</Select>
				</div>

				<div className="w-full">
					<Select
						id="payment-method-filter"
						name="paymentMethodFilter"
						aria-label="支払方法で絞り込む"
						value={filters.paymentMethodFilter}
						onChange={(e) => onFilterChange.paymentMethod(e.target.value)}
						className="w-full"
					>
						<option value="all">すべての支払方法</option>
						{accountOptions.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</Select>
				</div>

				<div className="w-full flex items-center gap-2">
					<div className="grow">
						<Input
							id="search-input"
							name="search"
							aria-label="キーワードで検索"
							type="text"
							placeholder="キーワードで検索..."
							value={filters.searchTerm}
							onChange={(e) => onFilterChange.search(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Escape") onFilterChange.search("");
							}}
							autoComplete="off"
						/>
					</div>
					{hasActiveFilters && (
						<Button
							id="reset-filters-button"
							variant="secondary"
							aria-label="フィルターをリセット"
							onClick={onFilterReset}
							className="whitespace-nowrap bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800 px-4 py-2 rounded-lg transition-all text-sm font-bold flex items-center gap-2 shrink-0"
						>
							<FontAwesomeIcon icon={faTimes} />
							<span>クリア</span>
						</Button>
					)}
				</div>
			</div>

			<div id="transactions-list" className="space-y-3">
				<TransactionList
					transactions={filteredTransactions}
					luts={luts}
					isMasked={isMasked}
					onTransactionClick={onTransactionClick}
					highlightTerm={filters.searchTerm}
				/>
			</div>

			<div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-4 items-end pointer-events-none">
				<div className="group flex items-center gap-3 pointer-events-auto">
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
						<FontAwesomeIcon
							icon={faPlus}
							className="text-2xl text-indigo-600"
						/>
					</button>
				</div>
			</div>

			<input
				type="file"
				id="receipt-file-input"
				name="receiptFile"
				accept="image/*"
				hidden
			/>
		</section>
	);
};

export default TransactionsSection;
