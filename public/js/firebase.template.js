import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 機密情報をプレースホルダーに置き換える
const firebaseConfig = {
	apiKey: "<YOUR_API_KEY>",
	authDomain: "<YOUR_AUTH_DOMAIN>",
	projectId: "<YOUR_PROJECT_ID>",
	storageBucket: "<YOUR_STORAGE_BUCKET>",
	messagingSenderId: "<YOUR_MESSAGING_SENDER_ID>",
	appId: "<YOUR_APP_ID>",
	measurementId: "<YOUR_MEASUREMENT_ID>",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
	localCache: persistentLocalCache({
		tabManager: persistentMultipleTabManager(),
	}),
});

export { auth, db };
