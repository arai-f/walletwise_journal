import React from "react";
import { createRoot } from "react-dom/client";
import TransactionsSection from "../components/TransactionsSection";

let transactionsSectionRoot = null;

/**
 * トランザクションセクションを指定されたDOM要素にレンダリングする。
 * @param {string} containerId - マウント対象のDOM要素のID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 */
export function renderTransactionsSection(containerId, props) {
	const container = document.getElementById(containerId);
	if (!container) return;
	if (!transactionsSectionRoot) {
		transactionsSectionRoot = createRoot(container);
	}
	transactionsSectionRoot.render(
		<React.StrictMode>
			<TransactionsSection {...props} />
		</React.StrictMode>
	);
}
