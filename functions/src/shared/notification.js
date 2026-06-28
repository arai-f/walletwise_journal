const { getMessaging } = require("firebase-admin/messaging");
const { db, COLLECTIONS } = require("./db");

/**
 * 指定ユーザーにプッシュ通知を送信する。
 * ユーザーごとの通知設定を確認し、有効な場合のみ送信を行う。
 * 送信時に無効なトークンが検出された場合、自動的に削除するクリーンアップ処理も行う。
 * @async
 * @param {string} userId - 通知送信先のユーザーID。
 * @param {object} notificationPayload - 通知のペイロード (title, body)。
 * @param {string} [link="/"] - 通知クリック時の遷移先URL。
 * @returns {Promise<void>}
 * @fires Firestore - 無効なトークンがある場合、`user_fcm_tokens` から削除する。
 */
exports.sendNotificationToUser = async function (
	userId,
	notificationPayload,
	link = "/",
) {
	// 1. グローバルな通知設定を確認
	const configDoc = await db
		.collection(COLLECTIONS.USER_CONFIGS)
		.doc(userId)
		.get();

	if (configDoc.exists) {
		const config = configDoc.data();
		if (config.general && config.general.enableNotification === false) {
			return;
		}
	}

	// 2. ユーザーのFCMトークンを取得
	const tokensSnap = await db
		.collection(COLLECTIONS.USER_FCM_TOKENS)
		.doc(userId)
		.collection("tokens")
		.get();

	// tokensSnap.docsからフィルター済みトークンとその参照を取得
	const validTokensWithRefs = tokensSnap.docs
		.map((doc, idx) => ({ token: doc.data().token, ref: doc.ref, idx }))
		.filter((item) => item.token && typeof item.token === "string");

	const tokens = validTokensWithRefs.map((item) => item.token);

	if (tokens.length === 0) return;

	const message = {
		notification: notificationPayload,
		tokens: tokens,
		webpush: {
			fcm_options: {
				link: link,
			},
		},
	};

	// 3. 通知を送信
	const response = await getMessaging().sendEachForMulticast(message);

	// 4. 無効なトークンを削除（クリーンアップ）
	if (response.failureCount > 0) {
		const failedTokens = [];
		response.responses.forEach((resp, idx) => {
			if (!resp.success) {
				const error = resp.error;
				if (
					error.code === "messaging/invalid-registration-token" ||
					error.code === "messaging/registration-token-not-registered"
				) {
					failedTokens.push(validTokensWithRefs[idx].ref.delete());
				}
			}
		});
		await Promise.all(failedTokens);
	}
};
