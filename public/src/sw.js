// 緊急解除用 Service Worker (Kill Switch)
const CACHE_NAME = "kill-switch-v1";

self.addEventListener("install", (event) => {
	// 待機状態をスキップして即座に新しいSWをアクティブにする
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				// 全てのキャッシュストレージを削除する
				return Promise.all(
					cacheNames.map((cacheName) => {
						console.log("Deleting cache:", cacheName);
						return caches.delete(cacheName);
					}),
				);
			})
			.then(() => {
				// ページのコントロールを即座に奪取し、更新を反映させる
				return self.clients.claim();
			}),
	);
});

self.addEventListener("fetch", (event) => {
	// キャッシュは一切使わず、全てネットワークへスルーする
	// これにより、index.html や JS/CSS は常に最新が取得されるようになる
	event.respondWith(fetch(event.request));
});
