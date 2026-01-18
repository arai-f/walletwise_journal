import "@fortawesome/fontawesome-free/css/all.min.css";
import "./input.css";

import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { config } from "./config.js";
import { firebaseConfig } from "./firebase-config.js";

// Rechartsの特定の警告を抑制
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const RECHARTS_WARNING =
	/The width\(-1\) and height\(-1\) of chart should be greater than 0/;

console.error = (...args) => {
	if (typeof args[0] === "string" && RECHARTS_WARNING.test(args[0])) {
		return;
	}
	originalConsoleError(...args);
};

console.warn = (...args) => {
	if (typeof args[0] === "string" && RECHARTS_WARNING.test(args[0])) {
		return;
	}
	originalConsoleWarn(...args);
};

// Service Workerの登録
if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		const params = new URLSearchParams({
			config: JSON.stringify(firebaseConfig),
			v: config.appVersion,
		});
		const swUrl = `/firebase-messaging-sw.js?${params.toString()}`;

		navigator.serviceWorker
			.register(swUrl)
			.then((registration) => {
				console.debug(
					"[SW] Service Worker registered with scope:",
					registration.scope,
				);
			})
			.catch((err) => {
				console.error("[SW] Service Worker registration failed:", err);
			});
	});
}

const appContainer = document.getElementById("root");
const appRoot = createRoot(appContainer);
appRoot.render(<App />);
