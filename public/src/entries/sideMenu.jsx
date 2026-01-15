import React from "react";
import { createRoot } from "react-dom/client";
import SideMenu from "../components/SideMenu";

let sideMenuRoot = null;

/**
 * サイドメニューを指定されたDOM要素にレンダリングする。
 * ボタン部分が指定コンテナに描画され、パネルはPortalでbodyに描画される。
 * @param {string} containerId - マウント対象のDOM要素のID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 */
export function renderSideMenu(containerId, props) {
	const container = document.getElementById(containerId);
	if (!container) return;
	if (!sideMenuRoot) {
		sideMenuRoot = createRoot(container);
	}
	sideMenuRoot.render(
		<React.StrictMode>
			<SideMenu {...props} />
		</React.StrictMode>
	);
}
