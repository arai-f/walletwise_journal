import { useEffect, useState } from 'react';
import * as utils from '../utils.js';
import Select from './ui/Select';

/**
 * Monthly Analysis Report Component
 * Renders the Header (Title + Filter), Math Summary, and Category Cards.
 */
export default function AnalysisReport({
    transactions,
    isMasked,
    initialMonth, // "YYYY-MM" or "all-time"
    availableMonths = [], // Array of "YYYY-MM"
    periodLabel = "全期間",
    luts,
    onMonthFilterChange
}) {
    const [selectedMonth, setSelectedMonth] = useState(initialMonth || "all-time");
    const [activeTab, setActiveTab] = useState("expense"); // 'income' or 'expense'

    useEffect(() => {
        if (initialMonth) {
            setSelectedMonth(initialMonth);
        }
    }, [initialMonth]);

    const handleTabChange = (type) => {
        if (activeTab !== type) setActiveTab(type);
    };

    const handleMonthChange = (e) => {
        const val = e.target.value;
        setSelectedMonth(val);
        if (onMonthFilterChange) onMonthFilterChange(val);
    };

    // Calculate Stats
    const stats = utils.summarizeTransactions(transactions, luts);

    const format = (val) => utils.formatCurrency(val, isMasked);

    // --- Sub-Components ---

    const MathSummary = () => {
        const balanceColor = stats.balance >= 0 ? "text-primary" : "text-danger";
        const balanceSign = stats.balance > 0 ? "+" : "";

        const activeClass = "bg-white shadow-sm ring-1 ring-neutral-200 transform scale-[1.01] transition-all duration-200";
        const inactiveClass = "opacity-60 hover:opacity-100 transition-opacity duration-200 cursor-pointer";

        const incomeClass = activeTab === "income" ? `${activeClass} border-l-4 border-success` : inactiveClass;
        const expenseClass = activeTab === "expense" ? `${activeClass} border-l-4 border-danger` : inactiveClass;

        return (
            <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 select-none fade-in">
                <div 
                    className={`flex justify-between items-center p-2 rounded mb-1 ${incomeClass}`}
                    onClick={() => handleTabChange("income")}
                >
                    <span className="font-bold flex items-center text-success text-sm">
                        <i className="fas fa-plus-circle mr-2"></i>収入
                        {activeTab === "income" && (
                            <span className="ml-2 text-[10px] bg-success-light text-success-dark px-1.5 py-0.5 rounded-full">表示中</span>
                        )}
                    </span>
                    <span className="text-lg font-bold text-neutral-800 tracking-tight">{format(stats.income)}</span>
                </div>

                <div 
                    className={`flex justify-between items-center p-2 rounded mb-3 ${expenseClass}`}
                    onClick={() => handleTabChange("expense")}
                >
                    <span className="font-bold flex items-center text-danger text-sm">
                        <i className="fas fa-minus-circle mr-2"></i>支出
                        {activeTab === "expense" && (
                            <span className="ml-2 text-[10px] bg-danger-light text-danger-dark px-1.5 py-0.5 rounded-full">表示中</span>
                        )}
                    </span>
                    <span className="text-lg font-bold text-neutral-800 tracking-tight">{format(stats.expense)}</span>
                </div>
                
                <div className="border-b-2 border-neutral-300 mx-2 mb-2"></div>
                
                <div className={`flex justify-between items-center px-2 pt-1 ${balanceColor}`}>
                    <span className="font-bold text-neutral-600 text-sm">収支差</span>
                    <span className="text-xl sm:text-2xl font-extrabold tracking-tight">
                        {balanceSign}{format(stats.balance)}
                    </span>
                </div>
            </div>
        );
    };

    const CategoryCards = () => {
        const targetDetails = activeTab === "income" ? stats.incomeDetails : stats.expenseDetails;
        const isIncome = activeTab === "income";

        const cards = targetDetails.slice(0, 10).map((item, i) => {
            const total = isIncome ? stats.income : stats.expense;
            const pct = total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0;
            const badgeColor = isIncome
                ? "bg-success-light text-success border border-success-light"
                : "bg-danger-light text-danger border border-danger-light";

            return (
                <div key={item.id} className="shrink-0 w-32 bg-white border border-neutral-200 rounded-lg p-3 shadow-sm flex flex-col justify-between relative overflow-hidden snap-start hover:shadow-md transition-shadow fade-in">
                    <div className="flex justify-between items-center mb-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}>#{i + 1}</span>
                        <span className="text-xs font-bold text-neutral-600">{pct}%</span>
                    </div>
                    
                    <div>
                        <div className="text-xs text-neutral-600 font-medium truncate mb-0.5" title={item.name}>{item.name}</div>
                        <div className="text-sm font-bold text-neutral-900 truncate tracking-tight">{format(item.amount)}</div>
                    </div>
                    
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: item.color }}></div>
                </div>
            );
        });

        if (cards.length === 0) {
            const message = isIncome ? "収入なし" : "支出なし";
            return (
                <div className="w-full flex flex-col items-center justify-center py-4 text-neutral-400 border-2 border-dashed border-neutral-200 rounded-lg fade-in">
                    <p className="text-xs">{message}</p>
                </div>
            );
        }
        
        return <>{cards}</>;
    };

    return (
        <div className="fade-in">
            {/* Header with Title and Filter */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg md:text-xl font-bold text-neutral-900 border-l-4 border-primary pl-3">
                    収支レポート
                </h2>
                <Select
                    value={selectedMonth}
                    onChange={handleMonthChange}
                    className="w-40"
                    aria-label="収支レポートの表示月"
                >
                    <option value="all-time">{periodLabel}</option>
                    {availableMonths.map(m => (
                        <option key={m} value={m}>{m.replace("-", "年")}月</option>
                    ))}
                </Select>
            </div>

            {/* Content Container */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm space-y-6">
                <MathSummary />
                <div className="scroll-hint-wrapper md:mx-0 md:px-0">
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        <CategoryCards />
                    </div>
                </div>
            </div>
        </div>
    );
}
