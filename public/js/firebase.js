import { initializeApp } from "firebase/app";
import {
	getToken,
	initializeAppCheck,
	ReCaptchaV3Provider,
} from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
	connectFirestoreEmulator,
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";
import {
	firebaseConfig,
	isLocalDevelopment,
	recaptchaSiteKey,
	vapidKey,
} from "./firebase-config.js";

if (isLocalDevelopment) {
	window.self.FIREBASE_APPCHECK_DEBUG_TOKEN = recaptchaSiteKey;
}

/**
 * 初期化されたFirebaseアプリインスタンス。
 * @type {object}
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase App Checkインスタンス。
 * 不正なトラフィックからバックエンドリソースを保護する。
 * @type {object}
 */
const appCheck = initializeAppCheck(app, {
	provider: new ReCaptchaV3Provider(recaptchaSiteKey),
	isTokenAutoRefreshEnabled: true,
});
getToken(appCheck).catch((error) => {
	console.error("[Firebase] App Check Error:", error.message);
});

/**
 * Firestoreデータベースインスタンス。
 * オフライン永続化キャッシュが有効化されており、ネットワーク切断時でもデータの読み書きが可能。
 * @type {object}
 */
const db = initializeFirestore(app, {
	localCache: persistentLocalCache({
		tabManager: persistentMultipleTabManager(),
	}),
});

/**
 * Firebase Authenticationインスタンス。
 * ユーザー認証の状態管理を行う。
 * @type {object}
 */
const auth = getAuth(app);

/**
 * Cloud Functionsインスタンス。
 * サーバーレス関数の呼び出しに使用する。
 * @type {object}
 */
const functions = getFunctions(app);

/**
 * Cloud Messagingインスタンス。
 * プッシュ通知の送受信に使用する。
 * @type {object}
 */
const messaging = getMessaging(app);

if (isLocalDevelopment) {
	connectAuthEmulator(auth, "http://127.0.0.1:9099");
	connectFunctionsEmulator(functions, "127.0.0.1", 5001);
	connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export { app, auth, db, firebaseConfig, messaging, vapidKey };
