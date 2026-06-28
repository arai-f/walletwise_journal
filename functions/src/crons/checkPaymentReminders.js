const functions = require("firebase-functions/v1");
const { db, COLLECTIONS } = require("../shared/db");
const { sendNotificationToUser } = require("../shared/notification");

/**
 * 毎日9時に実行され、当日がクレジットカードの支払日（引き落とし日）であるユーザーに通知を送る。
 * 月末の補正（例: 30日払いで2月は28日に通知）も考慮する。
 * @fires FCM - 対象ユーザーに通知を送信する。
 * @type {functions.CloudFunction}
 */
exports.checkPaymentReminders = functions
	.region("asia-northeast1")
	.pubsub.schedule("0 9 * * *")
	.timeZone("Asia/Tokyo")
	.onRun(async (context) => {
		const now = new Date();
		// 日本時間の現在時刻を取得
		const tokyoDate = new Date(
			now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
		);
		const currentDay = tokyoDate.getDate();

		// 月末かどうかを判定（翌月の0日 = 今月の最終日）
		const lastDayOfMonth = new Date(
			tokyoDate.getFullYear(),
			tokyoDate.getMonth() + 1,
			0,
		).getDate();
		const isLastDay = currentDay === lastDayOfMonth;

		// 全ユーザーの設定を取得
		const configsSnap = await db.collection(COLLECTIONS.USER_CONFIGS).get();

		const promises = [];
		configsSnap.forEach((doc) => {
			const config = doc.data();
			const rules = config.creditCardRules;

			if (!rules) return;

			// 支払日が今日に該当するカードがあるかチェック
			const hasPaymentToday = Object.values(rules).some((rule) => {
				if (!rule.paymentDay) return false;
				const pDay = Number(rule.paymentDay);

				// 設定日が今日と一致するか
				if (pDay === currentDay) return true;

				// 月末補正: 今日が月末で、かつ設定日が今日以降（例: 30日払いで今日が28日）の場合
				if (isLastDay && pDay >= currentDay) return true;

				return false;
			});

			if (hasPaymentToday) {
				const userId = doc.id;
				promises.push(
					sendNotificationToUser(userId, {
						title: "支払日のリマインド",
						body: "本日はクレジットカードの引き落とし予定日です。口座残高と振替記録を確認しましょう。",
					}),
				);
			}
		});

		await Promise.all(promises);
	});
