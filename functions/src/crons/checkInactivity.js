const functions = require("firebase-functions/v1");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { db, COLLECTIONS } = require("../shared/db");
const { sendNotificationToUser } = require("../shared/notification");

// 3. Scheduled Jobs (Crons)
/**
 * 毎日20時に実行され、最終入力から3日以上経過したユーザーにリマインド通知を送信する。
 * 頻繁な通知を防ぐため、前回の通知から7日間は再送しない制御を行っている。
 * @fires Firestore - `user_configs` (最終リマインド日時) を更新する。
 * @fires FCM - 対象ユーザーに通知を送信する。
 * @type {functions.CloudFunction}
 */
exports.checkInactivity = functions
	.region("asia-northeast1")
	.pubsub.schedule("0 20 * * *")
	.timeZone("Asia/Tokyo")
	.onRun(async (context) => {
		const now = Timestamp.now();
		const threeDaysAgo = new Date(
			now.toDate().getTime() - 3 * 24 * 60 * 60 * 1000,
		);
		const sevenDaysAgo = new Date(
			now.toDate().getTime() - 7 * 24 * 60 * 60 * 1000,
		);

		const snapshot = await db
			.collection(COLLECTIONS.USER_CONFIGS)
			.where("lastEntryAt", "<", Timestamp.fromDate(threeDaysAgo))
			.get();

		if (snapshot.empty) return;

		const promises = [];
		const batch = db.batch();
		let batchCount = 0;

		snapshot.forEach((doc) => {
			const data = doc.data();

			if (data.lastRemindedAt) {
				const lastRemindedDate = data.lastRemindedAt.toDate();
				if (lastRemindedDate > sevenDaysAgo) {
					return;
				}
			}

			const userId = doc.id;
			promises.push(
				sendNotificationToUser(userId, {
					title: "入力をお忘れですか？",
					body: "最後の記録から3日が経過しました。レシートが溜まる前に記録しましょう！",
				}),
			);

			batch.update(doc.ref, {
				lastRemindedAt: FieldValue.serverTimestamp(),
			});
			batchCount++;
		});

		if (promises.length > 0) {
			await Promise.all(promises);
			await batch.commit();
		}
	});
