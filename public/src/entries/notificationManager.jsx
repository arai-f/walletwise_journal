// public/src/entries/notificationManager.js
import ReactDOM from "react-dom/client";
import NotificationBanner from "../components/NotificationBanner.jsx";

// Mount the component
const notificationRoot = document.getElementById("notification-banner-root");
if (notificationRoot) {
	ReactDOM.createRoot(notificationRoot).render(<NotificationBanner />);
}

// Dispatch event to show notification
export function show(message, type = "error") {
	const event = new CustomEvent("walletwise-notification", {
		detail: { message, type },
	});
	window.dispatchEvent(event);
}

export function error(msg) {
	show(msg, "error");
}

export function success(msg) {
	show(msg, "success");
}

export function info(msg) {
	show(msg, "info");
}

export function close() {
	// Current implementation auto-closes or closes on click
	// We could expose an event to close it programmatically if needed
}
