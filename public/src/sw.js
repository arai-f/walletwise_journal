import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

const params = new URL(location.href).searchParams;
const configString = params.get("config");
const appVersion = params.get("v") || "1.0.0" + Date.now();
const CACHE_NAME = `walletwise-cache-${appVersion}`;

// インストール処理: 新しいSWを即座に有効化
self.addEventListener("install", (event) => {
	self.skipWaiting();
});

// アクティベート処理: 古いキャッシュを削除し、クライアントの制御を開始
self.addEventListener("activate", (event) => {
	event.waitUntil(
		Promise.all([
			clients.claim(),
			caches.keys().then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== CACHE_NAME) {
							return caches.delete(cacheName);
						}
					})
				);
			}),
		])
	);
});

// フェッチ処理: 同一オリジンのリクエストをキャッシュ
self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// 【1】開発用リクエスト(Vite/HMR)はSWを完全に無視（スルー）
	if (
		url.pathname.includes("@vite") ||
		url.searchParams.has("token") ||
		url.pathname.includes("node_modules") ||
		event.request.headers.get("Upgrade") === "websocket"
	) {
		return;
	}

	// GET以外、外部オリジンは無視
	if (event.request.method !== "GET") return;
	if (url.origin !== self.location.origin) return;

	// 【2】HTMLファイル（ナビゲーション）は「ネットワーク優先」にする
	// これにより、デプロイ直後に必ず最新の index.html が取得され、新しい JS が読み込まれる
	if (
		event.request.mode === "navigate" ||
		url.pathname.endsWith(".html") ||
		url.pathname === "/"
	) {
		event.respondWith(
			fetch(event.request).catch(() => {
				return caches.match(event.request); // オフライン時のみキャッシュ
			})
		);
		return;
	}

	// 【3】その他の静的リソース(JS, CSS, Image)は「キャッシュ優先」
	event.respondWith(
		caches.match(event.request).then((response) => {
			if (response) return response;
			return fetch(event.request).then((networkResponse) => {
				// 有効なレスポンスならキャッシュに追加
				if (
					!networkResponse ||
					networkResponse.status !== 200 ||
					networkResponse.type !== "basic"
				) {
					return networkResponse;
				}
				const responseToCache = networkResponse.clone();
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});
				return networkResponse;
			});
		})
	);
});

// Firebase初期化とバックグラウンドメッセージのハンドリング
if (configString) {
	const firebaseConfig = JSON.parse(configString);
	initializeApp(firebaseConfig);
	const messaging = getMessaging();

	// バックグラウンド通知のハンドリング
	onBackgroundMessage(messaging, (payload) => {
		const notificationTitle =
			payload.notification?.title || "WalletWise Journal";
		const notificationOptions = {
			body: payload.notification?.body || "",
			icon: "/favicon/favicon-96x96.png",
		};

		return self.registration.showNotification(
			notificationTitle,
			notificationOptions
		);
	});

	// 通知クリック時のイベントハンドラ
	self.addEventListener("notificationclick", (event) => {
		event.notification.close();
		event.waitUntil(
			clients
				.matchAll({ type: "window", includeUncontrolled: true })
				.then((windowClients) => {
					// 既に開いているタブがあればフォーカス
					for (const client of windowClients) {
						if (client.url.includes("/") && "focus" in client) {
							return client.focus();
						}
					}
					// なければ新規オープン
					if (clients.openWindow) {
						return clients.openWindow("/");
					}
				})
		);
	});
} else {
	console.error("[Notification] Firebase config not found in URL parameters.");
}
