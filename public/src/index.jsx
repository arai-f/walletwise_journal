import "./input.css";

import { createRoot } from "react-dom/client";
import App from "./App.jsx";

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
	navigator.serviceWorker.getRegistrations().then((registrations) => {
		for (const registration of registrations) {
			registration.unregister().then(() => {
				console.log("Service Worker unregistered");
				// 念のため、現在アクティブなSWがあればリロードして解除を確定させたいところですが、
				// 無限リロードループを避けるため、まずは「解除」だけを行います。
			});
		}
	});
}

const appContainer = document.getElementById("root");
const appRoot = createRoot(appContainer);
appRoot.render(<App />);
