import { initializeApp, type FirebaseApp } from "firebase/app";
import {
    getToken,
    initializeAppCheck,
    ReCaptchaV3Provider,
    type AppCheck,
} from "firebase/app-check";
import {
    browserLocalPersistence,
    browserPopupRedirectResolver,
    connectAuthEmulator,
    initializeAuth,
    type Auth,
} from "firebase/auth";
import {
    connectFirestoreEmulator,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    type Firestore,
} from "firebase/firestore";
import {
    connectFunctionsEmulator,
    getFunctions,
    type Functions,
} from "firebase/functions";
import type { Messaging } from "firebase/messaging";
import {
    appCheckDebugToken,
    firebaseConfig,
    isLocalDevelopment,
    recaptchaSiteKey,
    vapidKey,
} from "./firebase-config.js";

declare global {
	interface Window {
		FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
	}
}

if (isLocalDevelopment) {
	window.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken || true;
}

/**
 * 初期化されたFirebaseアプリインスタンス。
 */
const app: FirebaseApp = initializeApp(firebaseConfig);

/**
 * Firebase App Checkインスタンス。
 * 不正なトラフィックからバックエンドリソースを保護する。
 */
const appCheck: AppCheck = initializeAppCheck(app, {
	provider: new ReCaptchaV3Provider(recaptchaSiteKey),
	isTokenAutoRefreshEnabled: true,
});
getToken(appCheck).catch((error: Error) => {
	console.error("[Firebase] App Check Error:", error.message);
});

/**
 * Firestoreデータベースインスタンス。
 * オフライン永続化キャッシュが有効化されており、ネットワーク切断時でもデータの読み書きが可能。
 */
const db: Firestore = initializeFirestore(app, {
	localCache: persistentLocalCache({
		tabManager: persistentMultipleTabManager(),
	}),
});

/**
 * Firebase Authenticationインスタンス。
 * ユーザー認証の状態管理を行う。
 * localStorageベースの永続化を使用してIndexedDBのclosing/hiddenエラーを防止する。
 */
const auth: Auth = initializeAuth(app, {
	persistence: browserLocalPersistence,
	popupRedirectResolver: browserPopupRedirectResolver,
});

/**
 * Cloud Functionsインスタンス。
 * サーバーレス関数の呼び出しに使用する。
 */
const functions: Functions = getFunctions(app, "asia-northeast1");

/**
 * Cloud Messagingインスタンスを遅延取得する。
 * プッシュ通知設定時のみモジュールを動的にロードする。
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
	if (location.protocol === "https:" || location.hostname === "localhost") {
		const { getMessaging } = await import("firebase/messaging");
		return getMessaging(app);
	}
	console.warn("[Firebase] Messaging skipped: Requires HTTPS or localhost");
	return null;
}

if (isLocalDevelopment) {
	const { hostname } = window.location;
	connectAuthEmulator(auth, `http://${hostname}:9099`);
	connectFunctionsEmulator(functions, hostname, 5001);
	connectFirestoreEmulator(db, hostname, 8080);
}

export { app, auth, db, firebaseConfig, functions, vapidKey };

