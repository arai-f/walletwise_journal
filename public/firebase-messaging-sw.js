importScripts(
	"https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"
);
importScripts(
	"https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js"
);

const params = new URL(location.href).searchParams;
const configString = params.get("config");
const appVersion = params.get("v") || "1.0.0";
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
	// GETメソッド以外や、外部オリジン（Firebase API等）はキャッシュしない
	if (event.request.method !== "GET") return;
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		caches.match(event.request).then((response) => {
			if (response) return response;
			return fetch(event.request).then((networkResponse) => {
				// 有効なレスポンスでなければそのまま返す
				if (
					!networkResponse ||
					networkResponse.status !== 200 ||
					networkResponse.type !== "basic"
				) {
					return networkResponse;
				}
				// レスポンスをクローンしてキャッシュに保存
				const responseToCache = networkResponse.clone();
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});
				return networkResponse;
			});
		})
	);
});

if (configString) {
	const firebaseConfig = JSON.parse(configString);
	firebase.initializeApp(firebaseConfig);
	const messaging = firebase.messaging();

	// バックグラウンド通知のハンドリング
	messaging.onBackgroundMessage((payload) => {
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
