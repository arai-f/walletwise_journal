import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import TransactionModal from "../components/TransactionModal";

let setModalState;
let pendingOpen = null;
let moduleHandlers = null;

// モーダルスタック管理
const modalStack = [];

/**
 * モーダルスタックに閉じるコールバックを登録する。
 * @param {Function} closeCallback - 閉じる処理のコールバック
 * @returns {Function} 登録解除関数
 */
export function register(closeCallback) {
	modalStack.push(closeCallback);
	return () => {
		const index = modalStack.indexOf(closeCallback);
		if (index > -1) {
			modalStack.splice(index, 1);
		}
	};
}

/**
 * 最前面のモーダルを閉じる。
 * @returns {boolean} 閉じたかどうか
 */
export function closeTop() {
	const closeFn = modalStack.pop();
	if (closeFn) {
		closeFn();
		return true;
	}
	return false;
}

/**
 * トランザクションモーダルコンテナ。
 * Reactステートと外部ハンドラを管理する。
 * @param {object} props
 * @param {object} props.handlers - コールバックハンドラ群
 * @param {object} props.luts - ルックアップテーブル
 * @return {JSX.Element} トランザクションモーダルコンポーネント
 */
function TransactionModalContainer({ handlers, luts }) {
	const [isOpen, setIsOpen] = useState(false);
	const [transaction, setTransaction] = useState(null);
	const [prefillData, setPrefillData] = useState(null);

	useEffect(() => {
		setModalState = (state) => {
			if (state.isOpen !== undefined) setIsOpen(state.isOpen);
			if (state.transaction !== undefined) setTransaction(state.transaction);
			if (state.prefillData !== undefined) setPrefillData(state.prefillData);
		};

		if (pendingOpen) {
			setTransaction(pendingOpen.transaction);
			setPrefillData(pendingOpen.prefillData);
			setIsOpen(true);
			pendingOpen = null;
		}
	}, []);

	// スタックへの登録
	useEffect(() => {
		let unregister = null;
		if (isOpen) {
			unregister = register(() => closeModal());
		}
		return () => {
			if (unregister) unregister();
		};
	}, [isOpen]);

	const handleClose = () => {
		setIsOpen(false);
		// main.js側のクローズハンドラがあれば呼び出す
		if (handlers && handlers.close) {
			handlers.close();
		}
	};

	const handleSave = async (data) => {
		if (handlers && handlers.submit) {
			await handlers.submit(data);
			setIsOpen(false);
		}
	};

	const handleDelete = (id) => {
		if (handlers && handlers.delete) {
			handlers.delete(id);
			setIsOpen(false);
		}
	};

	return (
		<TransactionModal
			isOpen={isOpen}
			onClose={handleClose}
			transaction={transaction}
			prefillData={prefillData}
			onSave={handleSave}
			onDelete={handleDelete}
			luts={luts}
		/>
	);
}

/**
 * トランザクションモーダルを初期化し、DOMにマウントする。
 * @param {object} handlers - コールバックハンドラ群。
 * @param {object} luts - ルックアップテーブル。
 */
export function init(handlers, luts) {
	moduleHandlers = handlers;
	const container = document.getElementById("transaction-modal-root");
	if (!container) return;
	if (!container._reactRoot) {
		const root = createRoot(container);
		container._reactRoot = root;
		root.render(<TransactionModalContainer handlers={handlers} luts={luts} />);
	}
}

/**
 * トランザクションモーダルを開く。
 * @param {object} [transaction] - 編集対象データ
 * @param {object} [prefillData] - 初期入力データ
 */
export function openModal(transaction = null, prefillData = null) {
	if (setModalState) {
		setModalState({ isOpen: true, transaction, prefillData });
	} else {
		pendingOpen = { transaction, prefillData };
	}
}

/**
 * トランザクションモーダルを閉じる。
 */
export function closeModal() {
	if (setModalState) {
		setModalState({ isOpen: false });
	}
	if (moduleHandlers && moduleHandlers.close) {
		moduleHandlers.close();
	}
}

/**
 * モーダルが開いているか確認する。
 * @returns {boolean}
 */
export function isOpen() {
	return modalStack.length > 0;
}
