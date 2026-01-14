/**
 * 取引リストを表示するReactコンポーネント。
 * 取引データを日付ごとにグループ化して表示する。
 * @module components/TransactionList
 */
import { useMemo } from 'react';
import * as utils from "../utils.js";

/**
 * トランザクションアイテムコンポーネント
 * 
 * @param {object} props
 * @param {object} props.transaction - 取引データ
 * @param {object} props.luts - ルックアップテーブル
 * @param {boolean} props.isMasked - 金額マスクフラグ
 * @param {function} props.onClick - クリック時のハンドラ
 */
const TransactionItem = ({ transaction: t, luts, isMasked, onClick }) => {
    const { categories, accounts } = luts;
    
    // データ解決ロジック (createTransactionElementから移植)
    const category = categories.get(t.categoryId);
    const account = accounts.get(t.accountId);
    const fromAccount = accounts.get(t.fromAccountId);
    const toAccount = accounts.get(t.toAccountId);

    let icon, primaryText, secondaryText; // iconはJSXエレメントにする

    if (t.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) {
        icon = (
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                <i className="fas fa-scale-balanced text-primary"></i>
            </div>
        );
        primaryText = "残高調整";
        secondaryText = account?.name || "不明な口座";
    } else if (t.type === "transfer") {
        icon = (
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                <i className="fas fa-exchange-alt text-primary"></i>
            </div>
        );
        primaryText = t.description || "振替";
        secondaryText = `${fromAccount?.name || "不明"} → ${toAccount?.name || "不明"}`;
    } else {
        const accountName = account?.name || "不明";
        const categoryName = category?.name || "カテゴリなし";
        const iconClass = category?.type === "income"
                ? "fa-arrow-up text-success"
                : "fa-arrow-down text-danger";
        const iconBg = category?.type === "income" ? "bg-success-light" : "bg-danger-light";

        icon = (
            <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                <i className={`fas ${iconClass}`}></i>
            </div>
        );
        
        // descriptionがあればそれを、なければカテゴリ名をプライマリテキストに
        primaryText = t.description || categoryName;
        // descriptionがある場合、セカンダリに "カテゴリ / 口座" を表示
        secondaryText = t.description ? `${categoryName} / ${accountName}` : accountName;
    }

    // 金額表示ロジック
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
                {sign}{formattedAmount}
            </p>
        );
    }

    return (
        <div 
            className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4 cursor-pointer hover-lift transform transition-transform duration-200 hover:-translate-y-1 mb-2"
            onClick={() => onClick(t.id)}
            data-id={t.id}
        >
            <div className="grow min-w-0 flex items-center space-x-4">
                {icon}
                <div className="min-w-0">
                    <p className="font-medium text-neutral-900 truncate">{primaryText}</p>
                    <p className="text-sm text-neutral-600 truncate">{secondaryText}</p>
                </div>
            </div>
            {amountElement}
        </div>
    );
};

/**
 * 日付グループコンポーネント
 */
const DateGroup = ({ dateStr, transactions, luts, isMasked, onTransactionClick }) => {
    return (
        <div className="mb-4">
            <h3 className="text-lg font-semibold text-neutral-600 mt-4 mb-2 sticky top-0 bg-neutral-50 py-2 z-10">
                {dateStr}
            </h3>
            <div className="space-y-2">
                {transactions.map(t => (
                    <TransactionItem 
                        key={t.id} 
                        transaction={t} 
                        luts={luts} 
                        isMasked={isMasked} 
                        onClick={onTransactionClick}
                    />
                ))}
            </div>
        </div>
    );
};

/**
 * 取引リストコンポーネントメイン
 * 
 * @component
 * @param {object} props
 * @param {Array<object>} props.transactions - フィルタリング済みの取引データ配列
 * @param {object} props.luts - カテゴリや口座のルックアップテーブル
 * @param {boolean} props.isMasked - 金額マスクフラグ
 * @param {function} props.onTransactionClick - 取引クリック時のコールバック
 */
export default function TransactionList({ transactions, luts, isMasked, onTransactionClick }) {
    
    // 取引を日付でグループ化
    const groupedTransactions = useMemo(() => {
        const grouped = new Map();
        if (!transactions) return [];

        transactions.forEach((t) => {
            const dateStr = utils.formatDateWithWeekday(t.date);
            if (!grouped.has(dateStr)) {
                grouped.set(dateStr, []);
            }
            grouped.get(dateStr).push(t);
        });
        
        // Mapを配列に変換 (日付順序は元のtransactionsのソート順に依存すると仮定)
        // Mapのイテレーション順序は挿入順なので、transactionsが日付順であれば保持される
        return Array.from(grouped.entries()).map(([dateStr, items]) => ({
            dateStr,
            items
        }));
    }, [transactions]);

    if (!transactions || transactions.length === 0) {
        // データがない、またはフィルタ結果が0件の場合の表示は親(HTML側で非表示制御)か、ここでするか。
        // 現在のanalysis.jsの実装では `noTransactionsMessage` の表示切替を行っている。
        // React側ではリストが空なら何も描画しない、または空ステートを描画する。
        // ここでは空配列を返してDOMを空にする(親のno-transactions-messageが表示されるはず)
        // ただしReact化するならno-transactions-messageもReact内に含めるのが自然だが、
        // 段階的移行のため、リスト部分のみ置き換える。
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
                />
            ))}
        </div>
    );
}
