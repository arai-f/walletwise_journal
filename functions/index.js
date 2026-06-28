const functions = require("firebase-functions/v1");
const { FieldValue } = require("firebase-admin/firestore");
const { db, COLLECTIONS } = require("./src/shared/db");

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

/**
 * accountId → fromAccountId へのマイグレーション関数（一回限りの実行）
 *
 * 既存のtransactionsドキュメントで:
 * - transfer以外: accountId → fromAccountIdにコピー
 * - すべて: accountIdを削除
 *
 * デプロイ後に一度だけHTTPリクエストを実行:
 * curl -X POST "https://asia-northeast1-YOUR_PROJECT.cloudfunctions.net/migrateAccountIdToFromAccountId"
 *
 * @param {functions.https.Request} req - HTTPリクエスト
 * @param {functions.Response} res - HTTPレスポンス
 */
exports.migrateAccountIdToFromAccountId = functions
	.region("asia-northeast1")
	.https.onRequest(async (req, res) => {
		res.set("Access-Control-Allow-Origin", "*");
		res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
		res.set("Access-Control-Allow-Headers", "Content-Type");

		if (req.method === "OPTIONS") {
			res.status(204).send("");
			return;
		}

		if (req.method !== "POST") {
			res.status(405).json({ error: "Method Not Allowed" });
			return;
		}

		const { secret } = req.body || {};
		// 実行時のセキュリティ: シークレットキーで認証
		// Firebase Functions Configで設定した環境変数（migration.secret → migration_secret）
		if (secret !== process.env.migration_secret) {
			res.status(403).json({ error: "Forbidden: invalid secret" });
			return;
		}

		console.log("[Migration] Starting accountId → fromAccountId migration...");

		try {
			const transactionsRef = db.collection(COLLECTIONS.TRANSACTIONS);
			const snapshot = await transactionsRef.get();

			let migrated = 0;
			let skipped = 0;
			let errors = 0;

			// バッチ処理 (Firestoreの制限: 1バッチあたり500件)
			let batch = db.batch();
			let batchCount = 0;

			for (const docSnap of snapshot.docs) {
				const doc = docSnap;
				const data = doc.data();

				// accountIdがない場合はスキップ
				if (!data.accountId) {
					skipped++;
					continue;
				}

				const updates = {};

				if (data.type !== "transfer") {
					// expense/incomeの場合、fromAccountIdにaccountIdをコピー
					updates.fromAccountId = data.accountId;
					updates.toAccountId = ""; // toAccountIdは空にする
				}

				// accountIdを削除
				updates.accountId = FieldValue.delete();

				batch.update(doc.ref, updates);
				batchCount++;
				migrated++;

				// バッチが500件に達したらコミット
				if (batchCount >= 500) {
					await batch.commit();
					console.log(`[Migration] Committed batch: ${batchCount} documents`);
					batch = db.batch();
					batchCount = 0;
				}
			}

			// 残りのバッチをコミット
			if (batchCount > 0) {
				await batch.commit();
				console.log(
					`[Migration] Final batch committed: ${batchCount} documents`,
				);
			}

			const message = `[Migration] Completed. Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`;
			console.log(message);

			res.status(200).json({
				success: true,
				migrated,
				skipped,
				errors,
				message,
			});
		} catch (error) {
			console.error("[Migration] Error:", error);
			res.status(500).json({
				success: false,
				error: error.message,
			});
		}
	});
