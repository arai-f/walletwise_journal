importScripts(
	"https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"
);
importScripts(
	"https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js"
);

const params = new URL(location.href).searchParams;
const firebaseConfig = JSON.parse(params.get("config"));

if (firebaseConfig) {
	firebase.initializeApp(firebaseConfig);
	const messaging = firebase.messaging();

	// バックグラウンド通知のハンドリング
	messaging.onBackgroundMessage((payload) => {
		const notificationTitle = payload.notification.title;
		const notificationOptions = {
			body: payload.notification.body,
			icon: "/favicon/web-app-manifest-192x192.png",
		};

		self.registration.showNotification(notificationTitle, notificationOptions);
	});

	return self.registration.showNotification(
		notificationTitle,
		notificationOptions
	);
} else {
	console.error("[Notification] Firebase config not found in URL parameters.");
}
