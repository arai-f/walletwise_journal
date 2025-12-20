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
import { getGenerativeModel, getVertexAI } from "firebase/vertexai";
import {
	firebaseConfig,
	isLocalDevelopment,
	recaptchaSiteKey,
} from "./firebase-config.js";

if (isLocalDevelopment) {
	window.self.FIREBASE_APPCHECK_DEBUG_TOKEN = recaptchaSiteKey;
}

/**
 * 初期化されたFirebaseアプリインスタンス。
 * @type {object}
 */
const app = initializeApp(firebaseConfig);
console.info("[Firebase] App Initialized");

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
 * Vertex AIインスタンス。
 * Geminiモデルなどの生成AI機能へのアクセスを提供する。
 * @type {object}
 */
const vertexAI = getVertexAI(app);

if (isLocalDevelopment) {
	connectAuthEmulator(auth, "http://localhost:9099");
	connectFunctionsEmulator(functions, "localhost", 5001);
	connectFirestoreEmulator(db, "localhost", 8080);
}

export { auth, db, getGenerativeModel, vertexAI };
