const CACHE_NAME = "walletwise-cache-v1.4.4";
const urlsToCache = [
	"/",
	"/guide.html",
	"/index.html",
	"/style.css",
	"/js/config.js",
	"/js/main.js",
	"/js/store.js",
	"/js/utils.js",
	"/js/ui/analysis.js",
	"/js/ui/balances.js",
	"/js/ui/billing.js",
	"/js/ui/dashboard.js",
	"/js/ui/modal.js",
	"/js/ui/settings.js",
	"/js/ui/transactions.js",
];

// インストール時に、必須ファイルをキャッシュする
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			console.log("Opened cache");
			return cache.addAll(urlsToCache);
		})
	);
});

// 新しいサービスワーカーが有効化されたら、古いキャッシュを削除する
self.addEventListener("activate", (event) => {
	const cacheWhitelist = [CACHE_NAME];
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheWhitelist.indexOf(cacheName) === -1) {
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
});

// リクエストがあった際に、キャッシュから返す
self.addEventListener("fetch", (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			// キャッシュにあればそれを返す
			if (response) {
				return response;
			}
			// なければネットワークから取得する
			return fetch(event.request);
		})
	);
});
