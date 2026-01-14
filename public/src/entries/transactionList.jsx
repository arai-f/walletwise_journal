import React from 'react';
import { createRoot } from 'react-dom/client';
import TransactionList from '../components/TransactionList';

let transactionListRoot = null;

/**
 * 取引リストを指定されたDOM要素にレンダリングする。
 * @param {string} containerId - マウント対象のDOM要素のID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Array<object>} props.transactions - 取引データ。
 * @param {object} props.luts - ルックアップテーブル。
 * @param {boolean} props.isMasked - マスクフラグ。
 * @param {function} props.onTransactionClick - クリックハンドラ。
 */
export function renderTransactionList(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with id '${containerId}' not found.`);
        return;
    }

    if (!transactionListRoot) {
        transactionListRoot = createRoot(container);
    }

    transactionListRoot.render(
        <React.StrictMode>
            <TransactionList {...props} />
        </React.StrictMode>
    );
}
