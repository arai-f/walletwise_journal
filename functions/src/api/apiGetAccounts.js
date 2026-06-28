const functions = require("firebase-functions/v1");
const { db, COLLECTIONS } = require("../shared/db");
const { authenticateApiKey } = require("../shared/auth");

/**
 * APIキーを使用してユーザーの口座一覧を取得するHTTP API。
 * AuthorizationヘッダーからAPIキーを検証し、user_accountsコレクションから口座データを取得する。
 * @async
 * @param {functions.https.Request} req - HTTPリクエストオブジェクト。
 * @param {functions.Response} res - HTTPレスポンスオブジェクト。
 * @fires Firestore - user_accounts コレクションからデータを取得する。
 * @returns {Promise<void>}
 */
exports.apiGetAccounts = functions
	.region("asia-northeast1")
	.https.onRequest(async (req, res) => {
		// CORS対応
		res.set("Access-Control-Allow-Origin", "*");
		res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
		res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

		if (req.method === "OPTIONS") {
			res.status(204).send("");
			return;
		}

		if (req.method !== "GET") {
			res.status(405).json({ success: false, error: "Method Not Allowed" });
			return;
		}

		try {
			// 1. APIキー認証
			const userId = await authenticateApiKey(req);

			// 2. user_accountsコレクションから口座データを取得
			const accountDoc = await db
				.collection(COLLECTIONS.USER_ACCOUNTS)
				.doc(userId)
				.get();

			// 3. ドキュメントが存在しない、またはaccountsフィールドがない場合は空配列を返す
			if (!accountDoc.exists || !accountDoc.data().accounts) {
				res.status(200).json({ success: true, data: [] });
				return;
			}

			const accountsMap = accountDoc.data().accounts;

			// 4. マップ形式から配列に変換し、isDeletedを除外してorderでソート
			const accounts = Object.entries(accountsMap)
				.filter(([, account]) => !account.isDeleted)
				.map(([id, account]) => ({
					id,
					name: account.name || "",
					type: account.type || "asset",
					order: account.order || 0,
				}))
				.sort((a, b) => a.order - b.order);

			res.status(200).json({ success: true, data: accounts });
		} catch (error) {
			// authenticateApiKeyからのエラーはステータスコードを持つ
			if (error.status === 401) {
				res.status(401).json({ success: false, error: error.message });
				return;
			}
			console.error("[API GetAccounts] 予期しないエラー:", error);
			res.status(500).json({
				success: false,
				error: `サーバー内部エラー: ${error.message}`,
			});
		}
	});
