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
 * @param {string} [type="error"] - 通知タイプ （"success", "warning", "error", "info"）。
 */
export function show(message, type = "error") {
	const event = new CustomEvent("walletwise-notification", {
		detail: { message, type },
	});
	window.dispatchEvent(event);
}

/**
 * 成功通知を表示する。
 * @param {string} msg - メッセージ。
 */
export function success(msg) {
	show(msg, "success");
}

/**
 * 警告通知を表示する。
 * @param {string} msg - メッセージ。
 */
export function warn(msg) {
	show(msg, "warning");
}

/**
 * エラー通知を表示する。
 * @param {string} msg - メッセージ。
 */
export function error(msg) {
	show(msg, "error");
}

/**
 * 情報通知を表示する。
 * @param {string} msg - メッセージ。
 */
export function info(msg) {
	show(msg, "info");
}
