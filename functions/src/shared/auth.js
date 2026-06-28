const { COLLECTIONS, db } = require("./db");

/**
 * AuthorizationヘッダーからAPIキーを検証し、ユーザーIDを逆引きする共通関数。
 * apiScanAndSaveReceipt と apiGetAccounts で共用される。
 * @async
 * @param {functions.https.Request} req - HTTPリクエストオブジェクト。
 * @returns {Promise<string>} 検証済みユーザーID。
 * @throws {object} 認証エラー時に401ステータスとエラーメッセージを返却する。
 */
exports.authenticateApiKey = async function (req) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		const error = new Error(
			"Authorizationヘッダーが欠落しているか、不正な形式です。",
		);
		error.status = 401;
		throw error;
	}

	const apiKey = authHeader.substring(7);
	if (!apiKey || apiKey.trim() === "") {
		const error = new Error("APIキーが空です。");
		error.status = 401;
		throw error;
	}

	const apiKeyDoc = await db.collection(COLLECTIONS.API_KEYS).doc(apiKey).get();
	if (!apiKeyDoc.exists) {
		const error = new Error("無効なAPIキーです。");
		error.status = 401;
		throw error;
	}

	const { userId } = apiKeyDoc.data();
	if (!userId) {
		const error = new Error("APIキーにユーザーIDが紐づいていません。");
		error.status = 401;
		throw error;
	}

	return userId;
};
