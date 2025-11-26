/**
 * 通知UIのDOM要素を保持するオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	banner: document.getElementById("notification-banner"),
	message: document.getElementById("notification-message"),
};

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
	// 既存のタイマーがあればクリアし、多重実行を防ぐ
	clearTimeout(timeoutId);

	// メッセージを設定
	elements.message.textContent = message;

	// スタイルをリセットし、基本スタイルを適用
	elements.banner.className = `fixed top-0 left-0 right-0 p-4 z-[100] text-center text-white font-bold shadow-lg transition-transform duration-300 ease-in-out`;

	// 通知タイプに応じて背景色を設定
	if (type === "success") {
		elements.banner.classList.add("bg-success");
	} else if (type === "info") {
		elements.banner.classList.add("bg-primary");
	} else {
		// デフォルトはerror
		elements.banner.classList.add("bg-danger");
	}

	// 表示処理（スライドインアニメーション）
	elements.banner.classList.remove("hidden");
	// 次のフレームでtransformを解除し、CSSトランジションを発火させる
	requestAnimationFrame(() => {
		elements.banner.classList.remove("-translate-y-full");
	});

	// 3秒後に自動で閉じるタイマーを設定
	timeoutId = setTimeout(() => {
		close();
	}, 3000);
}

/**
 * 通知バナーを閉じる。
 * スライドアウトアニメーションを実行し、通知を画面外へ移動させる。
 */
export function close() {
	// スライドアウトアニメーションで非表示にする
	elements.banner.classList.add("-translate-y-full");
	// アニメーション完了後にhiddenクラスを追加することも可能だが、
	// translateで画面外に移動しているため、必須ではない。
}

/**
 * エラー通知を表示するショートカット関数。
 * 処理の失敗や警告をユーザーに伝える。
 * @param {string} msg - 表示するエラーメッセージ。
 */
export const error = (msg) => show(msg, "error");
/**
 * 成功通知を表示するショートカット関数。
 * 処理の完了をユーザーに伝える。
 * @param {string} msg - 表示する成功メッセージ。
 */
export const success = (msg) => show(msg, "success");
/**
 * 情報通知を表示するショートカット関数。
 * 一般的な情報をユーザーに伝える。
 * @param {string} msg - 表示する情報メッセージ。
 */
export const info = (msg) => show(msg, "info");
