const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = initializeApp();

exports.db = getFirestore(app);
exports.COLLECTIONS = {
	ACCOUNT_BALANCES: "account_balances",
	API_KEYS: "api_keys",
	NOTIFICATIONS: "notifications",
	PROCESSED_EVENTS: "processed_events",
	TRANSACTIONS: "transactions",
	USER_ACCOUNTS: "user_accounts",
	USER_CATEGORIES: "user_categories",
	USER_CONFIGS: "user_configs",
	USER_FCM_TOKENS: "user_fcm_tokens",
};
