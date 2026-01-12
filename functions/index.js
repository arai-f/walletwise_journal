const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { formatInTimeZone } = require("date-fns-tz");

admin.initializeApp();
const db = admin.firestore();

/* ==========================================================================
   Constants
   ========================================================================== */

const TIMEZONE = "Asia/Tokyo";
const SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID = "SYSTEM_BALANCE_ADJUSTMENT";
const COLLECTIONS = {
	USER_CONFIGS: "user_configs",
	USER_FCM_TOKENS: "user_fcm_tokens",
	PROCESSED_EVENTS: "processed_events",
	ACCOUNT_BALANCES: "account_balances",
	TRANSACTIONS: "transactions",
	NOTIFICATIONS: "notifications",
};

/* ==========================================================================
   Helper Functions
   ========================================================================== */

function toYYYYMM(date) {
	return formatInTimeZone(date, TIMEZONE, "yyyy-MM");
}

/**
 * 指定ユーザーにプッシュ通知を送信する。
 * ユーザーごとの通知設定を確認し、有効な場合のみ送信を行う。
 * @async
 * @param {string} userId - 通知送信先のユーザーID。
 * @param {object} notificationPayload - 通知のペイロード (title, body)。
 * @param {string} [link="/"] - 通知クリック時の遷移先URL。
 * @returns {Promise<void>}
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

/* ==========================================================================
   Cloud Functions
   ========================================================================== */

/**
 * 取引データの変更（作成・更新・削除）を監視し、口座残高を自動的に更新する。
 * 冪等性を担保するため、イベントIDを使用して重複処理を防止する。
 * @type {functions.CloudFunction}
 */
exports.onTransactionWrite = functions.firestore
	.document(`${COLLECTIONS.TRANSACTIONS}/{transactionId}`)
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
					{ merge: true }
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
					{ merge: true }
				);
			}
		});
	});

/**
 * 毎日20時に実行され、最終入力から3日以上経過したユーザーにリマインド通知を送信する。
 * @type {functions.CloudFunction}
 */
exports.checkInactivity = functions.pubsub
	.schedule("0 20 * * *")
	.timeZone("Asia/Tokyo")
	.onRun(async (context) => {
		const now = admin.firestore.Timestamp.now();
		const threeDaysAgo = new Date(
			now.toDate().getTime() - 3 * 24 * 60 * 60 * 1000
		);
		// [修正] リマインドの頻度制御用 (7日間は再通知しない)
		const sevenDaysAgo = new Date(
			now.toDate().getTime() - 7 * 24 * 60 * 60 * 1000
		);

		const snapshot = await db
			.collection(COLLECTIONS.USER_CONFIGS)
			.where(
				"lastEntryAt",
				"<",
				admin.firestore.Timestamp.fromDate(threeDaysAgo)
			)
			.get();

		if (snapshot.empty) return;

		const promises = [];
		const batch = db.batch(); // 通知日時更新用バッチ
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
				})
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
 * @type {functions.CloudFunction}
 */
exports.onNotificationCreate = functions.firestore
	.document(`${COLLECTIONS.NOTIFICATIONS}/{notificationId}`)
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

/**
 * 取引データが更新された際に、ユーザーの統計情報（純資産推移など）を再計算する。
 * クライアント側の負荷を軽減し、全期間のデータを正確に反映させるためにサーバーサイドで実行する。
 * @type {functions.CloudFunction}
 */
exports.updateUserStats = onDocumentWritten(
	`${COLLECTIONS.TRANSACTIONS}/{transactionId}`,
	async (event) => {
		const snapshot = event.data;
		if (!snapshot) return; // Function deletion case

		const data = snapshot.after.data() || snapshot.before.data();
		const userId = data.userId;

		if (!userId) return;

		// 1. ユーザーの全取引データを取得
		const transactionsSnapshot = await db
			.collection(COLLECTIONS.TRANSACTIONS)
			.where("userId", "==", userId)
			.orderBy("date", "desc")
			.get();

		const transactions = transactionsSnapshot.docs.map((doc) => {
			const d = doc.data();
			return {
				id: doc.id,
				...d,
				date: d.date.toDate(), // Timestamp -> Date
			};
		});

		// 2. 現在の口座残高を全取引から再計算（整合性確保のため）
		const currentAccountBalances = {};
		transactions.forEach((t) => {
			if (t.accountId && currentAccountBalances[t.accountId] === undefined)
				currentAccountBalances[t.accountId] = 0;
			if (
				t.fromAccountId &&
				currentAccountBalances[t.fromAccountId] === undefined
			)
				currentAccountBalances[t.fromAccountId] = 0;
			if (t.toAccountId && currentAccountBalances[t.toAccountId] === undefined)
				currentAccountBalances[t.toAccountId] = 0;

			if (t.type === "income") {
				currentAccountBalances[t.accountId] += t.amount;
			} else if (t.type === "expense") {
				currentAccountBalances[t.accountId] -= t.amount;
			} else if (t.type === "transfer") {
				currentAccountBalances[t.fromAccountId] -= t.amount;
				currentAccountBalances[t.toAccountId] += t.amount;
			}
		});

		// 3. 純資産推移データの計算
		let currentNetWorth = Object.values(currentAccountBalances).reduce(
			(sum, balance) => sum + balance,
			0
		);

		const summaries = new Map();

		for (const t of transactions) {
			if (t.categoryId === SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) continue;

			const month = toYYYYMM(t.date);
			if (!summaries.has(month)) {
				summaries.set(month, { income: 0, expense: 0 });
			}

			const s = summaries.get(month);
			if (t.type === "income") {
				s.income += t.amount;
			} else if (t.type === "expense") {
				s.expense += t.amount;
			}
		}

		const sortedMonths = Array.from(summaries.keys()).sort().reverse();
		const historicalData = [];

		for (const month of sortedMonths) {
			const s = summaries.get(month);
			historicalData.push({
				month: month,
				netWorth: currentNetWorth,
				income: s.income,
				expense: s.expense,
			});

			// 過去に遡る
			currentNetWorth = currentNetWorth - s.income + s.expense;
		}

		// 時系列順（古い順）に戻す
		const finalHistoricalData = historicalData.reverse();

		// 4. 計算結果を保存
		await db.collection("user_stats").doc(userId).set(
			{
				historicalData: finalHistoricalData,
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true }
		);
	}
);
