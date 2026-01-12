import * as utils from "../utils.js";

/**
 * 通知UIのDOM要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
	banner: utils.dom.get("notification-banner"),
	message: utils.dom.get("notification-message"),
});

/**
 * 通知を自動的に閉じるためのタイマーID。
 * 新しい通知が表示されたときに既存のタイマーをキャンセルするために使用する。
 * @type {number}
 */
let timeoutId;

/**
 * 画面上部に通知バナーを表示する。
 * ユーザーに操作の結果をフィードバックし、3秒後に自動的に閉じる。
 * @param {string} message - 表示するメッセージ。
 * @param {'error' | 'success' | 'info'} [type='error'] - 通知の種類。背景色が変わる。
 * @returns {void}
 */
export function show(message, type = "error") {
	const { banner, message: messageEl } = getElements();
	// 既存のタイマーがあればクリアし、多重実行を防ぐ
	clearTimeout(timeoutId);

	// バナーをクリックしたら即座に閉じる
	banner.onclick = () => {
		clearTimeout(timeoutId);
		close();
	};

	// メッセージを設定
	utils.dom.setText(messageEl, message);

	// スタイルをリセットし、基本スタイルを適用
	banner.className = `fixed top-0 left-0 right-0 p-4 z-[100] text-center text-white font-bold shadow-lg transition-transform duration-300 ease-in-out`;

	// 通知タイプに応じて背景色を設定
	if (type === "success") {
		utils.dom.addClass(banner, "bg-success");
	} else if (type === "info") {
		utils.dom.addClass(banner, "bg-primary");
	} else {
		// デフォルトはerror
		utils.dom.addClass(banner, "bg-danger");
	}

	// 表示処理（スライドインアニメーション）
	utils.dom.show(banner);
	// 次のフレームでtransformを解除し、CSSトランジションを発火させる
	requestAnimationFrame(() => {
		utils.dom.removeClass(banner, "-translate-y-full");
	});

	// 3秒後に自動で閉じるタイマーを設定
	timeoutId = setTimeout(() => {
		close();
	}, 3000);
}

/**
 * 通知バナーを閉じる。
 * スライドアウトアニメーションを実行し、通知を画面外へ移動させる。
 * @returns {void}
 */
export function close() {
	const { banner } = getElements();
	// スライドアウトアニメーションで非表示にする
	utils.dom.addClass(banner, "-translate-y-full");
	// アニメーション完了後にhiddenクラスを追加することも可能だが、
	// translateで画面外に移動しているため、必須ではない。
}

/**
 * エラー通知を表示するショートカット関数。
 * 処理の失敗や警告をユーザーに伝える。
 * @param {string} msg - 表示するエラーメッセージ。
 * @returns {void}
 */
export const error = (msg) => show(msg, "error");

/**
 * 成功通知を表示するショートカット関数。
 * 処理の完了をユーザーに伝える。
 * @param {string} msg - 表示する成功メッセージ。
 * @returns {void}
 */
export const success = (msg) => show(msg, "success");

/**
 * 情報通知を表示するショートカット関数。
 * 一般的な情報をユーザーに伝える。
 * @param {string} msg - 表示する情報メッセージ。
 * @returns {void}
 */
export const info = (msg) => show(msg, "info");
