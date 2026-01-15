import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import SettingsModal from "../components/Settings/SettingsModal";

let setModalOpen;
let pendingOpen = false;

/**
 * 設定モーダルコンテナ。
 * Reactステートでモーダルの開閉を管理し、依存関係を注入する。
 * @param {object} dependencies - ストアやユーティリティなどの依存関係オブジェクト
 * @return {JSX.Element} 設定モーダルコンポーネント
 */
function SettingsContainer({ dependencies }) {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		setModalOpen = setIsOpen;
		if (pendingOpen) {
			setIsOpen(true);
			pendingOpen = false;
		}
	}, []);

	return (
		<SettingsModal
			isOpen={isOpen}
			onClose={() => setIsOpen(false)}
			{...dependencies}
		/>
	);
}

/**
 * 設定モーダルを初期化し、DOMにマウントする。
 * @param {object} dependencies - ストアやユーティリティなどの依存関係オブジェクト。
 */
export function init(dependencies) {
	const container = document.getElementById("settings-root");
	if (!container) return;
	if (!container._reactRoot) {
		const root = createRoot(container);
		container._reactRoot = root;
		root.render(<SettingsContainer dependencies={dependencies} />);
	}
}

/**
 * 設定モーダルを開く。
 */
export function openModal() {
	if (setModalOpen) {
		setModalOpen(true);
	} else {
		pendingOpen = true;
	}
}

/**
 * 設定モーダルを閉じる。
 */
export function closeModal() {
	if (setModalOpen) setModalOpen(false);
}

/**
 * 設定モーダルが開いているかどうかを確認する（簡易実装）。
 * DOM要素の存在チェックによる判定。
 * @returns {boolean}
 */
export function isOpen() {
	const root = document.getElementById("settings-root");
	return !!root && root.children.length > 0;
}
