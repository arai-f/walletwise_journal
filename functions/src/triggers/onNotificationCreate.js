const functions = require("firebase-functions/v1");
const { FieldValue } = require("firebase-admin/firestore");
const { COLLECTIONS, db } = require("../shared/db");
const { sendNotificationToUser } = require("../shared/notification");

/**
 * お知らせドキュメントの作成を監視し、全ユーザーに一斉通知を送信する。
 * 管理者が `notifications` コレクションにドキュメントを追加することでトリガーされる。
 * @fires FCM - 全ユーザーに通知を送信する。
 * @type {functions.CloudFunction}
 */
exports.onNotificationCreate = functions
	.region("asia-northeast1")
	.firestore.document(`${COLLECTIONS.NOTIFICATIONS}/{notificationId}`)
	.onCreate(async (snap, context) => {
		const data = snap.data();
		const notificationPayload = {
			title: data.title || "お知らせ",
			body: data.body || "",
		};
		const link = data.link || "/";

		const usersSnap = await db.collection(COLLECTIONS.USER_FCM_TOKENS).get();

		const promises = [];
		usersSnap.forEach((doc) => {
			const userId = doc.id;
			promises.push(sendNotificationToUser(userId, notificationPayload, link));
		});

		await Promise.all(promises);
	});
