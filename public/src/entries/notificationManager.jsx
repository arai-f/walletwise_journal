// public/src/entries/notificationManager.js
import ReactDOM from "react-dom/client";
import NotificationBanner from "../components/NotificationBanner.jsx";

const notificationRoot = document.getElementById("notification-banner-root");
if (notificationRoot) {
	ReactDOM.createRoot(notificationRoot).render(<NotificationBanner />);
}

/**
 * グローバル通知イベントを発火させる。
 * @param {string} message - 通知メッセージ。
 * @param {string} [type="error"] - 通知タイプ (error, success, info)。
 */
export function show(message, type = "error") {
	const event = new CustomEvent("walletwise-notification", {
		detail: { message, type },
	});
	window.dispatchEvent(event);
}

/**
 * エラー通知を表示する。
 * @param {string} msg - メッセージ。
 */
export function error(msg) {
	show(msg, "error");
}

/**
 * 成功通知を表示する。
 * @param {string} msg - メッセージ。
 */
export function success(msg) {
	show(msg, "success");
}

/**
 * 情報通知を表示する。
 * @param {string} msg - メッセージ。
 */
export function info(msg) {
	show(msg, "info");
}

/**
 * 通知を閉じる（現在は実装のみ）。
 */
export function close() {
	// 現在の実装では自動的に閉じるか、クリックで閉じる仕様となっている
}
