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

export { auth, db };
