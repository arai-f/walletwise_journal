import "@fortawesome/fontawesome-free/css/all.min.css";
import "./input.css";

import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { config } from "./config.js";
import { firebaseConfig } from "./firebase-config.js";
import * as utils from "./utils.js";

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
					registration.scope
				);
			})
			.catch((err) => {
				console.error("[SW] Service Worker registration failed:", err);
			});
	});
}

const appContainer = utils.dom.get("root") || document.getElementById("root");

if (appContainer) {
	const appRoot = createRoot(appContainer);
	appRoot.render(<App />);
} else {
	console.error("Root element #root not found");
}
