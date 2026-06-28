const admin = require("firebase-admin");

admin.initializeApp();

exports.db = admin.firestore();
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
