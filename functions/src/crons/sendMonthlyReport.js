const functions = require("firebase-functions/v1");
const { db, COLLECTIONS } = require("../shared/db");
const { sendNotificationToUser } = require("../shared/notification");

/**
 * 毎月1日の朝9時に実行され、先月の振り返りを促す通知を一斉送信する。
 * 個別の収支計算は行わず、アプリへの誘導を目的とする。
 * @fires FCM - 全ユーザーに通知を送信する。
 * @type {functions.CloudFunction}
 */
exports.sendMonthlyReport = functions
	.region("asia-northeast1")
	.pubsub.schedule("0 9 1 * *")
	.timeZone("Asia/Tokyo")
	.onRun(async (context) => {
		const notificationPayload = {
			title: "先月の収支を確認しましょう",
			body: "新しい月が始まりました。先月の家計簿を振り返ってみませんか？",
		};

		// 通知トークンを持つ全ユーザーを取得
		const usersSnap = await db.collection(COLLECTIONS.USER_FCM_TOKENS).get();

		const promises = [];
		usersSnap.forEach((doc) => {
			const userId = doc.id;
			promises.push(sendNotificationToUser(userId, notificationPayload));
		});

		await Promise.all(promises);
	});
