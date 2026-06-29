// 1. HTTP / Callable APIs
exports.scanReceipt = require("./src/api/scanReceipt").scanReceipt;
exports.askAdvisor = require("./src/api/askAdvisor").askAdvisor;
exports.apiScanAndSaveReceipt =
	require("./src/api/apiScanAndSaveReceipt").apiScanAndSaveReceipt;
exports.apiGetAccounts = require("./src/api/apiGetAccounts").apiGetAccounts;

// 2. Firestore Triggers
exports.onTransactionWrite =
	require("./src/triggers/onTransactionWrite").onTransactionWrite;
exports.onNotificationCreate =
	require("./src/triggers/onNotificationCreate").onNotificationCreate;

// 3. Scheduled Jobs (Crons)
exports.checkInactivity =
	require("./src/crons/checkInactivity").checkInactivity;
exports.checkPaymentReminders =
	require("./src/crons/checkPaymentReminders").checkPaymentReminders;
exports.sendMonthlyReport =
	require("./src/crons/sendMonthlyReport").sendMonthlyReport;
