const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

admin.initializeApp();
const db = admin.firestore();

const COLLECTIONS = {
	USER_CONFIGS: "user_configs",
	USER_FCM_TOKENS: "user_fcm_tokens",
	PROCESSED_EVENTS: "processed_events",
	ACCOUNT_BALANCES: "account_balances",
	TRANSACTIONS: "transactions",
	NOTIFICATIONS: "notifications",
};

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
async function sendNotificationToUser(userId, notificationPayload, link = "/") {
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

	if (tokensSnap.empty) return;

	const tokens = tokensSnap.docs.map((doc) => doc.data().token);

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
					failedTokens.push(tokensSnap.docs[idx].ref.delete());
				}
			}
		});
		await Promise.all(failedTokens);
	}
}

/**
 * 取引データの変更（作成・更新・削除）を監視し、口座残高を自動的に更新する。
 * 冪等性を担保するため、イベントIDを使用して重複処理を防止する。
 * @fires Firestore - `account_balances` (残高更新), `processed_events` (重複防止), `user_configs` (最終更新日時) に書き込む。
 * @type {functions.CloudFunction}
 */
exports.onTransactionWrite = functions
	.region("asia-northeast1")
	.firestore.document(`${COLLECTIONS.TRANSACTIONS}/{transactionId}`)
	.onWrite(async (change, context) => {
		const eventId = context.eventId;
		const eventRef = db.collection(COLLECTIONS.PROCESSED_EVENTS).doc(eventId);

		const newData = change.after.exists ? change.after.data() : null;
		const oldData = change.before.exists ? change.before.data() : null;

		if (!newData && !oldData) return null;

		const userId = newData ? newData.userId : oldData.userId;
		const balanceRef = db.collection(COLLECTIONS.ACCOUNT_BALANCES).doc(userId);

		return db.runTransaction(async (transaction) => {
			// 1. 重複処理チェック
			const eventDoc = await transaction.get(eventRef);
			if (eventDoc.exists) {
				return;
			}

			/**
			 * 指定された口座の残高を更新する内部ヘルパー関数。
			 * @param {string} accountId - 更新対象の口座ID。
			 * @param {number} amount - 加算する金額（負の値で減算）。
			 */
			const updateBalance = (accountId, amount) => {
				if (!accountId) return;
				transaction.set(
					balanceRef,
					{ [accountId]: FieldValue.increment(amount) },
					{ merge: true },
				);
			};

			// 2. 変更前のデータの影響を取り消す（逆操作）
			if (oldData) {
				const amount = Number(oldData.amount);
				switch (oldData.type) {
					case "income":
						updateBalance(oldData.accountId, -amount);
						break;
					case "expense":
						updateBalance(oldData.accountId, amount);
						break;
					case "transfer":
						updateBalance(oldData.fromAccountId, amount);
						updateBalance(oldData.toAccountId, -amount);
						break;
				}
			}

			// 3. 変更後のデータの影響を適用する
			if (newData) {
				const amount = Number(newData.amount);
				switch (newData.type) {
					case "income":
						updateBalance(newData.accountId, amount);
						break;
					case "expense":
						updateBalance(newData.accountId, -amount);
						break;
					case "transfer":
						updateBalance(newData.fromAccountId, -amount);
						updateBalance(newData.toAccountId, amount);
						break;
				}
			}

			// 4. イベント処理済みフラグを設定
			transaction.set(eventRef, {
				processedAt: FieldValue.serverTimestamp(),
				transactionId: context.params.transactionId,
			});

			// 5. ユーザーの最終更新日時を記録
			if (userId) {
				const configRef = db.collection(COLLECTIONS.USER_CONFIGS).doc(userId);
				transaction.set(
					configRef,
					{ lastEntryAt: FieldValue.serverTimestamp() },
					{ merge: true },
				);
			}
		});
	});

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
		const now = admin.firestore.Timestamp.now();
		const threeDaysAgo = new Date(
			now.toDate().getTime() - 3 * 24 * 60 * 60 * 1000,
		);
		const sevenDaysAgo = new Date(
			now.toDate().getTime() - 7 * 24 * 60 * 60 * 1000,
		);

		const snapshot = await db
			.collection(COLLECTIONS.USER_CONFIGS)
			.where(
				"lastEntryAt",
				"<",
				admin.firestore.Timestamp.fromDate(threeDaysAgo),
			)
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
				lastRemindedAt: admin.firestore.FieldValue.serverTimestamp(),
			});
			batchCount++;
		});

		if (promises.length > 0) {
			await Promise.all(promises);
			await batch.commit();
		}
	});

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
