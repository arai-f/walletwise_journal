// public/src/components/TransactionsSection.jsx
import { useMemo, useState } from 'react';
import * as utils from "../../js/utils.js";
import TransactionList from './TransactionList';

/**
 * Filtered Transactions Section Component
 * 
 * Replaces public/js/ui/transactions.js
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
    isMasked
}) => {
    // Local Filter States
    const [filterType, setFilterType] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // --- Helpers ---
    
    // Sort transactions for month options
    const monthOptions = useMemo(() => {
        const months = new Set(transactions.map(t => utils.toYYYYMM(t.date)));
        const sortedMonths = [...months].sort().reverse();
        return sortedMonths;
    }, [transactions]);

    // Handle Month Change
    const handleMonthChange = (e) => {
        onMonthChange(e.target.value);
    };

    // Filter Logic
    // 1. Filter by Month (This is actually done by Parent in current architecture, but here we can double check or rely on props)
    // The prop `transactions` passed here - if it's ALL transactions, we must filter by month.
    // Use `currentMonthFilter`.
    
    const transactionsInMonth = useMemo(() => {
        if (currentMonthFilter === "all-time") return transactions;
        const [year, month] = currentMonthFilter.split("-").map(Number);
        return transactions.filter(t => {
            const yyyymm = utils.toYYYYMM(t.date);
            const [tYear, tMonth] = yyyymm.split("-").map(Number);
            return tYear === year && tMonth === month;
        });
    }, [transactions, currentMonthFilter]);

    // 2. Apply Local Filters (Type, Category, Account, Search)
    const filteredTransactions = useMemo(() => {
        let filtered = [...transactionsInMonth];
        
        if (filterType !== 'all') {
            filtered = filtered.filter(t => t.type === filterType);
        }
        
        if (filterCategory !== 'all') {
            filtered = filtered.filter(t => t.categoryId === filterCategory);
        }
        
        if (filterPaymentMethod !== 'all') {
            filtered = filtered.filter(t => 
                t.accountId === filterPaymentMethod ||
                t.fromAccountId === filterPaymentMethod ||
                t.toAccountId === filterPaymentMethod
            );
        }

        if (searchTerm.trim() !== '') {
            const term = searchTerm.trim().toLowerCase();
            filtered = filtered.filter(t => {
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
        
        // Sort by date desc (if not already?) usually handled by TransactionList or Main. 
        // Main.js usually keeps state.transactions sorted.
        return filtered; 
    }, [transactionsInMonth, filterType, filterCategory, filterPaymentMethod, searchTerm, luts]);

    // --- Derived Options ---
    
    const categoryOptions = useMemo(() => {
        const allCategories = [...luts.categories.values()].filter(c => !c.isDeleted);
        let options = allCategories;
        if (filterType === 'income' || filterType === 'expense') {
            options = options.filter(c => c.type === filterType);
        }
        // Sort
        return options.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
    }, [luts.categories, filterType]);

    const accountOptions = useMemo(() => {
        return [...luts.accounts.values()]
            .filter(a => !a.isDeleted)
            .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'asset' ? -1 : 1;
                return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
            });
    }, [luts.accounts]);

    // Reset handler
    const handleReset = () => {
        setFilterType('all');
        setFilterCategory('all');
        setFilterPaymentMethod('all');
        setSearchTerm('');
    };

    // Style classes
    const inputClass = "h-9 w-full border border-neutral-300 rounded-lg px-2 text-sm text-neutral-900 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-white placeholder-neutral-400";
    const btnClass = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed h-9 px-3 whitespace-nowrap bg-neutral-200 text-neutral-900 border border-neutral-200 hover:bg-neutral-300 focus:ring-neutral-500";

    // Period Label
    // Config defaults
    // In legacy, specific logic to determine "Past 3 months" etc.
    // PeriodLabel is now passed as prop

    return (
        <section id="transactions-section">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3">
                    取引履歴
                </h2>
                <div className="relative">
                    <select 
                        id="month-filter"
                        aria-label="取引履歴の表示月"
                        className="h-9 w-40 pl-3 pr-8 py-1 text-sm bg-white border border-neutral-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                        value={currentMonthFilter}
                        onChange={handleMonthChange}
                    >
                        <option value="all-time">{periodLabel}</option>
                        {monthOptions.map(m => (
                            <option key={m} value={m}>{m.replace("-", "年")}月</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <i className="fas fa-chevron-down text-xs"></i>
                    </div>
                </div>
            </div>

            <div id="filter-section" className="bg-white p-4 rounded-xl shadow-sm mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                
                {/* Type Filter */}
                <div className="w-full sm:w-auto grow">
                    <select 
                        id="type-filter"
                        aria-label="取引種別で絞り込む"
                        className={inputClass}
                        value={filterType}
                        onChange={(e) => {
                            setFilterType(e.target.value);
                            setFilterCategory('all'); // Reset category when type changes
                        }}
                    >
                        <option value="all">すべての取引</option>
                        <option value="income">収入</option>
                        <option value="expense">支出</option>
                        <option value="transfer">振替</option>
                    </select>
                </div>

                {/* Category Filter */}
                <div className="w-full sm:w-auto grow">
                    <select
                        id="category-filter"
                        aria-label="カテゴリで絞り込む"
                        className={inputClass}
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        disabled={filterType !== 'income' && filterType !== 'expense'}
                    >
                        <option value="all">すべてのカテゴリ</option>
                        {categoryOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Payment Method Filter */}
                <div className="w-full sm:w-auto grow">
                    <select
                        id="payment-method-filter"
                        aria-label="支払方法で絞り込む"
                        className={inputClass}
                        value={filterPaymentMethod}
                        onChange={(e) => setFilterPaymentMethod(e.target.value)}
                    >
                        <option value="all">すべての支払方法</option>
                        {accountOptions.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                {/* Search & Reset */}
                <div className="w-full md:w-auto grow flex items-center gap-2">
                    <div className="grow">
                        <input
                            id="search-input"
                            type="text"
                            placeholder="キーワードで検索..."
                            className={inputClass}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Escape") setSearchTerm(""); }}
                        />
                    </div>
                    <button
                        id="reset-filters-button"
                        className={btnClass}
                        aria-label="フィルターをリセット"
                        onClick={handleReset}
                    >
                        リセット
                    </button>
                </div>
            </div>

            {/* List */}
            <div id="transactions-list" className="space-y-3">
                {filteredTransactions.length > 0 ? (
                    <TransactionList 
                        transactions={filteredTransactions} // TransactionList handles grouping
                        luts={luts}
                        isMasked={isMasked}
                        onTransactionClick={onTransactionClick}
                    />
                ) : (
                    <p id="no-transactions-message" className="text-center text-neutral-500 py-8">
                        この月の取引はありません。
                    </p>
                )}
            </div>

            {/* FABs */}
            <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-4 items-center">
                <button
                    id="scan-receipt-fab"
                    aria-label="AIでレシートをスキャンする"
                    className="ai-rainbow-btn w-14 h-14 flex items-center justify-center shadow-lg rounded-full transform transition-transform duration-200 hover:scale-105 active:scale-95"
                    title="AIで画像を読み取る"
                    onClick={onScanClick}
                >
                    <i className="fas fa-camera text-xl text-white"></i>
                </button>

                <button
                    id="add-transaction-button"
                    aria-label="新しい取引を追加する"
                    className="indigo-ring-btn w-16 h-16 flex items-center justify-center shadow-lg transform transition-transform duration-200 hover:scale-105 active:scale-95"
                    title="取引を手動入力"
                    onClick={onAddClick}
                >
                    <i className="fas fa-plus text-2xl text-white"></i>
                </button>
            </div>

            {/* Hidden Input for Receipt (Handled by Scan Module usually, but we need to put it somewhere? 
               Actually main.js scanModule handles the input element by ID 'receipt-file-input'. 
               We should check if we need to render it or if main.js expects it to exist.)
            */}
             <input type="file" id="receipt-file-input" accept="image/*" hidden />
             {/* 
                 Wait, if I render this input here, React controls it. 
                 But main.js has `scan-start.js` which might listen to it?
                 `scanModule` in `main.js`: `document.getElementById('receipt-file-input').click()`.
                 So we just need to make sure this element exists in the DOM.
             */}
        </section>
    );
};

export default TransactionsSection;
