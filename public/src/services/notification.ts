/**
 * ブラウザ通知・Firebase Cloud Messaging (FCM) を統合した通知サービス。
 * UIへのグローバル通知表示と、FCMトークンの管理を担う。
 */
import { deleteToken, getToken, type Messaging } from "firebase/messaging";
import { auth, messaging, vapidKey } from "../firebase.js";
import * as store from "./store.js";

/**
 * 通知レベルの種別。UI側のトースト表示で分岐するために利用する。
 */
export type NotificationType = "success" | "warning" | "error" | "info";

/**
 * `walletwise-notification` カスタムイベントの詳細ペイロード。
 */
interface NotificationEventDetail {
	/** 通知メッセージ。 */
	message: string;
	/** 通知タイプ。 */
	type: NotificationType;
}

/**
 * `messaging` インスタンスが初期化済みかを判定するヘルパー。
 * Firebase SDKの `messaging` は `Messaging | undefined` の可能性があるため、
 * 利用側で安全な型ナローイングを行う。
 * @param m - `firebase.js` からエクスポートされた `messaging` 値。
 * @returns 有効な `Messaging` インスタンスなら true。
 */
const hasMessaging = (m: typeof messaging): m is Messaging => Boolean(m);

/**
 * グローバル通知イベントを発火させる。
 * @param message - 通知メッセージ。
 * @param type - 通知タイプ ("success", "warning", "error", "info")。デフォルトは "error"。
 */
export function show(message: string, type: NotificationType = "error"): void {
	const event = new CustomEvent<NotificationEventDetail>(
		"walletwise-notification",
		{
			detail: { message, type },
		},
	);
	window.dispatchEvent(event);
}

/**
 * 成功通知を表示する。
 * @param msg - メッセージ。
 */
export function success(msg: string): void {
	show(msg, "success");
}

/**
 * 警告通知を表示する。
 * @param msg - メッセージ。
 */
export function warn(msg: string): void {
	show(msg, "warning");
}

/**
 * エラー通知を表示する。
 * @param msg - メッセージ。
 */
export function error(msg: string): void {
	show(msg, "error");
}

/**
 * 情報通知を表示する。
 * @param msg - メッセージ。
 */
export function info(msg: string): void {
	show(msg, "info");
}

/**
 * ブラウザの通知権限をリクエストし、FCMトークンを取得・保存する。
 * 成功時はユーザー設定を更新し、失敗時はエラー通知を表示する。
 * @returns 成功した場合は true、失敗またはキャンセルの場合は false を返す。
 */
export async function requestPermission(): Promise<boolean> {
	if (!hasMessaging(messaging)) {
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
export async function disableNotification(): Promise<void> {
	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		if (!registration) return;

		if (!hasMessaging(messaging)) return;

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
 * @returns 設定済みなら true。
 */
export async function isDeviceRegisteredForNotifications(): Promise<boolean> {
	if (!auth.currentUser) return false;
	if (Notification.permission !== "granted") return false;

	if (!hasMessaging(messaging)) return false;

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
