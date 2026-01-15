/**
 * main.jsx
 * アプリケーションのエントリーポイント
 */
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../src/input.css";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { deleteToken, getToken } from "firebase/messaging";
import { createRoot } from "react-dom/client";
import { config as defaultConfig } from "./config.js";
import * as modalManager from "./entries/modalManager.jsx";
import * as notification from "./entries/notificationManager.jsx";
import { auth, messaging, vapidKey } from "./firebase.js";
import * as store from "./services/store.js";
import * as utils from "./utils.js";

import App from "./App.jsx";

// 初期表示をフェードインさせる
setTimeout(() => {
	document.body.style.visibility = "visible";
	document.body.style.opacity = "1";
}, 100);

/* ==========================================================================
   State Bridge & Lifecycle
   ========================================================================== */

// Shared State for Lazy Modules (Settings etc.)
const sharedState = { current: {} };

const lifecycleCallbacks = {
	refresh: null,
	refreshData: null,
	openTransactionModal: null, // React Hook Action
};

const handleNotificationRequest = async () => {
	if (!messaging) {
		notification.error("通知機能はサポートされていません。");
		return;
	}
	try {
		const permission = await Notification.requestPermission();
		if (permission === "granted") {
			const registration = await navigator.serviceWorker.getRegistration("/");
			const token = await getToken(messaging, {
				vapidKey: vapidKey,
				serviceWorkerRegistration: registration,
			});
			if (token) {
				await store.saveFcmToken(token);
				notification.success("通知を有効にしました。");
			}
		} else {
			notification.warn("通知の権限が得られませんでした。");
		}
	} catch (err) {
		console.error("[Main] Token retrieval failed:", err);
		notification.error("通知設定に失敗しました。");
	}
};

const handleNotificationDisable = async () => {
	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		if (!registration) return;

		const token = await getToken(messaging, {
			vapidKey: vapidKey,
			serviceWorkerRegistration: registration,
		}).catch(() => null);

		if (token) {
			await store.deleteFcmToken(token);
			await deleteToken(messaging);
		}
		notification.info("この端末の通知設定をオフにしました。");
	} catch (error) {
		console.error("[Main] Notification disable failed:", error);
		notification.error("通知設定の解除に失敗しました。");
	}
};

/* ==========================================================================
   Lazy Loading Modules
   ========================================================================== */

let settingsModule = null;
const loadSettings = async () => {
	if (!settingsModule) {
		settingsModule = await import("./entries/settings.jsx");
		settingsModule.init({
			getState: () => ({
				luts: sharedState.current.luts || {
					accounts: new Map(),
					categories: new Map(),
				},
				config: sharedState.current.config || {},
				transactions: sharedState.current.transactions || [],
				accountBalances: sharedState.current.accountBalances || {},
			}),
			store,
			utils,
			refresh: (shouldReloadData) => {
				if (lifecycleCallbacks.refresh)
					lifecycleCallbacks.refresh(shouldReloadData);
			},
			refreshApp: (shouldReloadData) => {
				if (lifecycleCallbacks.refresh)
					lifecycleCallbacks.refresh(shouldReloadData);
			},
			reloadApp: () => location.reload(),
			requestNotification: handleNotificationRequest,
			disableNotification: handleNotificationDisable,
			openGuide: async () => {
				const guide = await loadGuide();
				await guide.openModal();
			},
			openTerms: async () => {
				const terms = await loadTerms();
				terms.openViewer();
			},
		});
	}
	return settingsModule;
};

const loadGuide = async () => {
	return {
		openModal: async (config) => {
			return modalManager.openGuideModal(config, handleNotificationRequest);
		},
	};
};

const loadReport = async () => {
	return {
		openModal: async () => {
			return modalManager.openReportModal(
				sharedState.current.luts || {
					accounts: new Map(),
					categories: new Map(),
				}
			);
		},
		init: (luts) => {
			// no-op
		},
		isOpen: () => false,
	};
};

const loadTerms = async () => {
	return {
		openViewer: async () => {
			return modalManager.openTermsViewer();
		},
		openAgreement: async (onAgree, onDisagree) => {
			return modalManager.openTermsAgreement(onAgree, onDisagree);
		},
		close: () => {
			modalManager.closeTermsModal();
		},
		isOpen: () => false,
	};
};

let scanModule = null;
const loadScanModule = async () => {
	if (!scanModule) {
		scanModule = await import("./entries/scanModal.jsx");
		scanModule.init({
			getConfig: () => sharedState.current.config || {},
			getLuts: () =>
				sharedState.current.luts || {
					accounts: new Map(),
					categories: new Map(),
				},
			onSave: async (transactions) => {
				const loadingEl = document.getElementById("loading-indicator");
				if (loadingEl) utils.dom.show(loadingEl);
				try {
					const txns = Array.isArray(transactions)
						? transactions
						: [transactions];
					await Promise.all(txns.map((tx) => store.saveTransaction(tx)));

					if (lifecycleCallbacks.refreshData) {
						await lifecycleCallbacks.refreshData();
					}
					notification.success(`${txns.length}件の取引を保存しました。`);
				} catch (e) {
					console.error(e);
					notification.error("保存できませんでした");
					throw e;
				} finally {
					if (loadingEl) utils.dom.hide(loadingEl);
				}
			},
		});
	}
	return scanModule;
};

/* ==========================================================================
   External Actions Definition
   ========================================================================== */

const externalActions = {
	updateSharedState: (newState) => {
		sharedState.current = newState;
	},
	onLogout: () => signOut(auth),
	onOpenSettings: async () => {
		const settings = await loadSettings();
		settings.openModal();
	},
	onOpenGuide: async () => {
		const guide = await loadGuide();
		await guide.openModal();
	},
	onOpenTerms: async () => {
		const terms = await loadTerms();
		terms.openViewer();
	},
	onOpenReport: async () => {
		const report = await loadReport();
		report.openModal();
	},
	onScanClick: async () => {
		const scan = await loadScanModule();
		scan.openModal();
	},
	onAddClick: () => {
		if (lifecycleCallbacks.openTransactionModal) {
			lifecycleCallbacks.openTransactionModal();
		}
	},
	// Used by App.jsx to open modal for specific transaction
	openTransactionModal: (transaction, defaultValues) => {
		if (lifecycleCallbacks.openTransactionModal) {
			lifecycleCallbacks.openTransactionModal(transaction, defaultValues);
		}
	},
};

/* ==========================================================================
   Global Event Handlers (Legacy & Setup)
   ========================================================================== */
// Keyboard Shortcuts (Cmd+N)
document.addEventListener("keydown", (e) => {
	// New Transaction (Cmd/Ctrl + N)
	if ((e.metaKey || e.ctrlKey) && e.key === "n") {
		e.preventDefault();
		if (auth.currentUser && lifecycleCallbacks.openTransactionModal) {
			lifecycleCallbacks.openTransactionModal();
		}
	}
});

// Firebase Auth Listener
onAuthStateChanged(auth, async (user) => {
	if (user) {
		// Check Terms
		const { config } = await store.fetchAllUserData();
		if (config?.terms?.agreedVersion !== defaultConfig.termsVersion) {
			utils.dom.hide(document.getElementById("auth-container"));
			utils.dom.show(document.getElementById("auth-screen"));

			const onAgree = async () => {
				const agreeBtn = document.getElementById("terms-agree-btn");
				if (agreeBtn) {
					agreeBtn.disabled = true;
					agreeBtn.textContent = "保存中...";
				}
				try {
					await store.updateConfig({
						"terms.agreedVersion": defaultConfig.termsVersion,
					});
					location.reload();
				} catch (e) {
					console.error("[Main] Terms acceptance failed:", e);
					notification.error("規約の中断に失敗しました。再試行してください。");
				}
			};
			const onDisagree = () => signOut(auth);
			const terms = await loadTerms();
			terms.openAgreement(onAgree, onDisagree);
		}
	}
});

/* ==========================================================================
   React Root
   ========================================================================== */

const appContainer =
	document.getElementById("root-portal") ||
	(() => {
		const d = document.createElement("div");
		d.id = "root-portal";
		d.style.display = "none";
		document.body.appendChild(d);
		return d;
	})();

const appRoot = createRoot(appContainer);

appRoot.render(
	<App
		externalActions={externalActions}
		onMount={(hookActions) => {
			lifecycleCallbacks.refresh = hookActions.refreshSettings;
			lifecycleCallbacks.refreshData = hookActions.refreshData;

			lifecycleCallbacks.openTransactionModal =
				hookActions.openTransactionModal;
		}}
	/>
);
