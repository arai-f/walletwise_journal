import { deleteToken, getToken } from "firebase/messaging";
import { auth, messaging, vapidKey } from "../firebase.js";
import * as store from "./store.js";

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

/**
 * ブラウザの通知権限をリクエストし、FCMトークンを取得・保存する。
 * 成功時はユーザー設定を更新し、失敗時はエラー通知を表示する。
 * @returns {Promise<boolean>} 成功した場合はtrue、失敗またはキャンセルの場合はfalseを返す。
 */
export async function requestPermission() {
	if (!messaging) {
		error("通知機能はサポートされていません。");
		return false;
	}
	try {
		const permission = await Notification.requestPermission();
		if (permission === "granted") {
			const registration = await navigator.serviceWorker.getRegistration("/");
			const token = await getToken(messaging, {
				vapidKey: vapidKey,
				serviceWorkerRegistration: registration,
			});
			if (token) {
				await store.saveFcmToken(token);
				success("通知を有効にしました。");
				return true;
			}
		} else if (permission === "denied") {
			warn(
				"通知がブロックされています。ブラウザの設定から通知を許可してください。",
			);
		} else {
			warn("通知の権限が得られませんでした。");
		}
	} catch (err) {
		console.error("[Notification] Token retrieval failed:", err);
		error("通知設定に失敗しました。");
	}
	return false;
}

/**
 * FCMトークンを削除し、このデバイスでの通知を無効化する。
 */
export async function disableNotification() {
	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		if (!registration) return;

		const token = await getToken(messaging, {
			vapidKey: vapidKey,
			serviceWorkerRegistration: registration,
		}).catch(() => null);

		if (token) {
			await store.deleteFcmToken(token);
			await deleteToken(messaging);
		}
		info("この端末の通知設定をオフにしました。");
	} catch (err) {
		console.error("[Notification] Disable failed:", err);
		error("通知設定の解除に失敗しました。");
	}
}

/**
 * 現在のデバイスが通知設定済み（FCMトークン取得済みかつFirestoreに保存済み）かを確認する。
 * @async
 * @returns {Promise<boolean>} 設定済みならtrue
 */
export async function isDeviceRegisteredForNotifications() {
	if (!auth.currentUser) return false;
	if (Notification.permission !== "granted") return false;

	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		if (!registration) return false;

		const currentToken = await getToken(messaging, {
			vapidKey: vapidKey,
			serviceWorkerRegistration: registration,
		});

		if (!currentToken) return false;

		const savedTokens = await store.getFcmTokens();
		return savedTokens.some((t) => t.token === currentToken);
	} catch (error) {
		console.error("[Notification] Notification check failed:", error);
		return false;
	}
}
