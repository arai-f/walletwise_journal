import {
	getGenerativeModel,
	getVertexAI,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-vertexai.js";
import {
	initializeAppCheck,
	ReCaptchaV3Provider,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app-check.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
	apiKey: "__API_KEY__",
	authDomain: "__AUTH_DOMAIN__",
	projectId: "__PROJECT_ID__",
	storageBucket: "__STORAGE_BUCKET__",
	messagingSenderId: "__MESSAGING_SENDER_ID__",
	appId: "__APP_ID__",
	measurementId: "__MEASUREMENT_ID__",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
	localCache: persistentLocalCache({
		tabManager: persistentMultipleTabManager(),
	}),
});

if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
	self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
const appCheck = initializeAppCheck(app, {
	provider: new ReCaptchaV3Provider("__RECAPTCHA_SITE_KEY__"),
	isTokenAutoRefreshEnabled: true,
});

const vertexAI = getVertexAI(app);

export { auth, db, getGenerativeModel, vertexAI };
