/**
 * 取引リストのReactコンポーネントをマウントするためのエントリーポイント。
 * @module entries/transactionList
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import TransactionList from '../components/TransactionList';

/**
 * 取引リストのReactルートインスタンスのキャッシュ。
 * @type {import('react-dom/client').Root | null}
 */
let transactionListRoot = null;

/**
 * 取引リストを指定されたDOM要素にレンダリングする。
 * 
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

/**
 * 取引リストのコンポーネントをアンマウントする（必要な場合）
 */
export function unmountTransactionList() {
    if (transactionListRoot) {
        transactionListRoot.unmount();
        transactionListRoot = null;
    }
}
