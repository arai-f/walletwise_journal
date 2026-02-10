import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";

/* ==========================================================================
   Constants & Config
   ========================================================================== */

const params = new URL(location.href).searchParams;
const configString = params.get("config");
const appVersion = params.get("v") || "1.0.0";

const CACHE_NAME = `walletwise-cache-${appVersion}`;
const FONT_CACHE_NAME = "walletwise-fonts-v1";

const IGNORED_PATHS = ["@vite", "node_modules"];

/* ==========================================================================
   Lifecycle Events
   ========================================================================== */

/**
 * インストール処理:
 * ハッシュ付きファイル名を指定すると404エラーの原因になるため、
 * ここでの静的アセットの事前キャッシュは行わず、fetch時のRuntime Cachingに任せる。
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

	// 3. フォントファイル: 独立したキャッシュで管理（最優先）
	if (url.pathname.match(/\.(woff2?|ttf|otf|eot)$/)) {
		event.respondWith(fontCacheStrategy(event.request));
		return;
	}

	// 4. HTMLファイル（ナビゲーション）: ネットワーク優先
	if (isNavigationRequest(event.request, url)) {
		event.respondWith(networkFirstStrategy(event.request));
		return;
	}

	// 5. その他の静的リソース（JS, CSS, 画像）: 通常のキャッシュ優先
	event.respondWith(cacheFirstStrategy(event.request));
});

/* ==========================================================================
   Helper Functions (Cache Strategies)
   ========================================================================== */

/**
 * リクエストを無視すべきかどうかを判定する。
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
 * フォント用キャッシュは削除対象から除外する。
 */
async function clearOldCaches() {
	const cacheNames = await caches.keys();
	return Promise.all(
		cacheNames.map((cacheName) => {
			// 現在のアプリキャッシュでもなく、フォントキャッシュでもないものを削除
			if (cacheName !== CACHE_NAME && cacheName !== FONT_CACHE_NAME) {
				console.log("Deleting old cache:", cacheName);
				return caches.delete(cacheName);
			}
		}),
	);
}

/**
 * フォント専用のキャッシュ優先戦略
 * FONT_CACHE_NAME に保存する
 */
async function fontCacheStrategy(request) {
	// 1. キャッシュを探す
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	// 2. キャッシュになければネットワークへ
	try {
		const networkResponse = await fetch(request);
		// 正常なレスポンスならフォント専用キャッシュに保存
		if (networkResponse && networkResponse.status === 200) {
			const cache = await caches.open(FONT_CACHE_NAME);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		// オフラインなどで取得できない場合、キャッシュにあればそれを返す（既存処理と同じ）
		return cachedResponse; // ここではundefinedになる可能性が高いがエラーは投げない
	}
}

/**
 * ネットワーク優先戦略（Network First）
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
 */
async function cacheFirstStrategy(request) {
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	const networkResponse = await fetch(request);
	// basicタイプ以外のレスポンス（opaque responsesなど）もキャッシュした方が良い場合があるが、
	// ここでは元のロジックを尊重
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

		self.addEventListener("notificationclick", (event) => {
			event.notification.close();
			event.waitUntil(handleNotificationClick(event));
		});
	} catch (error) {
		console.error("[Notification] Failed to initialize Firebase:", error);
	}
} else {
	// 開発中などconfigがない場合のエラー抑制
	// console.log("[Notification] Firebase config not provided.");
}

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
