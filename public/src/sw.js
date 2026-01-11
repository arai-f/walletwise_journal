import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";

/* ==========================================================================
   Constants & Config
   ========================================================================== */

const params = new URL(location.href).searchParams;
const configString = params.get("config");
const appVersion = params.get("v");
const CACHE_NAME = `walletwise-cache-${appVersion}`;
const IGNORED_PATHS = ["@vite", "node_modules"];

/* ==========================================================================
   Lifecycle Events
   ========================================================================== */

/**
 * インストール処理: 新しいSWを即座に有効化する。
 */
self.addEventListener("install", (event) => {
	self.skipWaiting();
});

/**
 * アクティベート処理: 古いキャッシュを削除し、クライアントの制御を開始する。
 */
self.addEventListener("activate", (event) => {
	event.waitUntil(Promise.all([clients.claim(), clearOldCaches()]));
});

/**
 * フェッチ処理: リクエストに応じてキャッシュ戦略を適用する。
 */
self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// 1. 無視すべきリクエスト（開発用など）
	if (shouldIgnoreRequest(url, event.request)) {
		return;
	}

	// 2. GETメソッド以外、または別オリジンのリクエストは無視
	if (event.request.method !== "GET" || url.origin !== self.location.origin) {
		return;
	}

	// 3. HTMLファイル（ナビゲーション）: ネットワーク優先
	if (isNavigationRequest(event.request, url)) {
		event.respondWith(networkFirstStrategy(event.request));
		return;
	}

	// 4. その他の静的リソース: キャッシュ優先
	event.respondWith(cacheFirstStrategy(event.request));
});

/* ==========================================================================
   Helper Functions (Cache Strategies)
   ========================================================================== */

/**
 * リクエストを無視すべきかどうかを判定する。
 * @param {URL} url
 * @param {Request} request
 * @returns {boolean}
 */
function shouldIgnoreRequest(url, request) {
	return (
		IGNORED_PATHS.some((path) => url.pathname.includes(path)) ||
		url.searchParams.has("token") ||
		request.headers.get("Upgrade") === "websocket" ||
		self.location.hostname === "localhost" ||
		self.location.hostname === "127.0.0.1"
	);
}

/**
 * ナビゲーションリクエスト（HTML）かどうかを判定する。
 * @param {Request} request
 * @param {URL} url
 * @returns {boolean}
 */
function isNavigationRequest(request, url) {
	return (
		request.mode === "navigate" ||
		url.pathname.endsWith(".html") ||
		url.pathname === "/"
	);
}

/**
 * 古いキャッシュを削除する。
 * @returns {Promise<void[]>}
 */
async function clearOldCaches() {
	const cacheNames = await caches.keys();
	return Promise.all(
		cacheNames.map((cacheName) => {
			if (cacheName !== CACHE_NAME) {
				return caches.delete(cacheName);
			}
		})
	);
}

/**
 * ネットワーク優先戦略（Network First）
 * 成功時にはキャッシュを更新し、失敗時（オフライン）はキャッシュを使用する。
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirstStrategy(request) {
	try {
		const networkResponse = await fetch(request);
		if (networkResponse && networkResponse.status === 200) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		return caches.match(request);
	}
}

/**
 * キャッシュ優先戦略（Cache First）
 * キャッシュにあればそれを返し、なければネットワークへリクエストしてキャッシュする。
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirstStrategy(request) {
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	const networkResponse = await fetch(request);
	if (
		!networkResponse ||
		networkResponse.status !== 200 ||
		networkResponse.type !== "basic"
	) {
		return networkResponse;
	}

	const cache = await caches.open(CACHE_NAME);
	cache.put(request, networkResponse.clone());

	return networkResponse;
}

/* ==========================================================================
   Firebase Messaging
   ========================================================================== */

if (configString) {
	try {
		const firebaseConfig = JSON.parse(configString);
		initializeApp(firebaseConfig);
		const messaging = getMessaging();

		// 通知クリック時のイベントハンドラ
		self.addEventListener("notificationclick", (event) => {
			event.notification.close();
			event.waitUntil(handleNotificationClick(event));
		});
	} catch (error) {
		console.error("[Notification] Failed to initialize Firebase:", error);
	}
} else {
	console.error("[Notification] Firebase config not found in URL parameters.");
}

/**
 * 通知クリック時の処理を行う。
 * 既存のウィンドウがあればフォーカスし、なければ新規ウィンドウを開く。
 * @returns {Promise<void|WindowClient>}
 */
async function handleNotificationClick(event) {
	const windowClients = await clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});

	for (const client of windowClients) {
		if (client.url.includes("/") && "focus" in client) {
			return client.focus();
		}
	}

	if (clients.openWindow) {
		return clients.openWindow("/");
	}
}
