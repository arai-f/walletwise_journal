/**
 * トランザクションセクションのReactコンポーネントをマウントするためのエントリーポイント。
 * @module entries/transactionsSection
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import TransactionsSection from '../components/TransactionsSection';

/**
 * Reactルートインスタンスのキャッシュ。
 * @type {import('react-dom/client').Root | null}
 */
let root = null;

/**
 * トランザクションセクションを指定されたDOM要素にレンダリングする。
 * 
 * @param {string} containerId - マウント対象のDOM要素のID ('transactions-section' 推奨)。
 * @param {object} props - コンポーネントに渡すプロパティ。
 */
export function renderTransactionsSection(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with id '${containerId}' not found.`);
        return;
    }

    if (!root) {
        root = createRoot(container);
    }

    root.render(
        <React.StrictMode>
            <TransactionsSection {...props} />
        </React.StrictMode>
    );
}
