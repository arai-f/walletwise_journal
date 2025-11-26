import {
	getToken,
	initializeAppCheck,
	ReCaptchaV3Provider,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app-check.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
	connectAuthEmulator,
	getAuth,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
	connectFirestoreEmulator,
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
	connectFunctionsEmulator,
	getFunctions,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-functions.js";
import {
	getGenerativeModel,
	getVertexAI,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-vertexai.js";
import {
	firebaseConfig,
	isLocalDevelopment,
	recaptchaSiteKey,
} from "./firebase-config.js";

if (isLocalDevelopment) {
	window.self.FIREBASE_APPCHECK_DEBUG_TOKEN = recaptchaSiteKey;
}

const app = initializeApp(firebaseConfig);
const appCheck = initializeAppCheck(app, {
	provider: new ReCaptchaV3Provider(recaptchaSiteKey),
	isTokenAutoRefreshEnabled: true,
});
getToken(appCheck).catch((error) => {
	console.log(error.message);
});
const db = initializeFirestore(app, {
	localCache: persistentLocalCache({
		tabManager: persistentMultipleTabManager(),
	}),
});
const auth = getAuth(app);
const functions = getFunctions(app);
const vertexAI = getVertexAI(app);

if (isLocalDevelopment) {
	connectFirestoreEmulator(db, "localhost", 8080);
	connectFunctionsEmulator(functions, "localhost", 5001);
	connectAuthEmulator(auth, "http://127.0.0.1:9099");
}

export { auth, db, getGenerativeModel, vertexAI };
