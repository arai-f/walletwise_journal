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

/* ==========================================================================
   Cloud Functions
   ========================================================================== */

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
			now.toDate().getTime() - 3 * 24 * 60 * 60 * 1000
		);
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

/**
 * 取引データが更新された際に、ユーザーの統計情報（純資産推移など）を再計算する。
 * クライアント側の負荷を軽減し、全期間のデータを正確に反映させるためにサーバーサイドで実行する。
 * 現在の純資産から過去に遡って計算することで、計算コストを最適化している。
 * @fires Firestore - `user_stats` (統計データ) を更新する。
 * @type {functions.CloudFunction}
 */
exports.updateUserStats = onDocumentWritten(
	{
		document: `${COLLECTIONS.TRANSACTIONS}/{transactionId}`,
		region: "asia-northeast1",
	},
	async (event) => {
		const snapshot = event.data;
		if (!snapshot) return;

		const data = snapshot.after.data() || snapshot.before.data();
		const userId = data.userId;
		if (!userId) return;

		// 1. ユーザーの全取引データを取得（降順）
		const transactionsSnapshot = await db
			.collection(COLLECTIONS.TRANSACTIONS)
			.where("userId", "==", userId)
			.orderBy("date", "desc")
			.get();

		if (transactionsSnapshot.empty) return;

		// 2. 集計処理（現在の純資産と月次集計を同時に行う）
		let currentNetWorth = 0;
		const monthlySummary = {};

		transactionsSnapshot.docs.forEach((doc) => {
			const t = doc.data();
			const amount = Number(t.amount) || 0;
			const month = toYYYYMM(t.date.toDate());

			// 純資産総額の計算 (Income - Expense)
			if (t.type === "income") {
				currentNetWorth += amount;
			} else if (t.type === "expense") {
				currentNetWorth -= amount;
			}

			// 月次集計
			if (!monthlySummary[month]) {
				monthlySummary[month] = { income: 0, expense: 0, netChange: 0 };
			}

			if (t.type === "income") {
				monthlySummary[month].netChange += amount;
				if (t.categoryId !== SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) {
					monthlySummary[month].income += amount;
				}
			} else if (t.type === "expense") {
				monthlySummary[month].netChange -= amount;
				if (t.categoryId !== SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) {
					monthlySummary[month].expense += amount;
				}
			}
		});

		// 3. 期間の特定（最古の取引月 ～ 今月）
		const now = new Date();
		const oldestDoc = transactionsSnapshot.docs[transactionsSnapshot.size - 1];
		const oldestMonthStr = toYYYYMM(oldestDoc.data().date.toDate());

		const historicalData = [];
		let iterDate = new Date(now.getFullYear(), now.getMonth(), 1);
		let iterMonthStr = toYYYYMM(iterDate);

		// 今月から最古の月まで遡ってループ
		while (iterMonthStr >= oldestMonthStr) {
			const s = monthlySummary[iterMonthStr] || {
				income: 0,
				expense: 0,
				netChange: 0,
			};

			historicalData.push({
				month: iterMonthStr,
				netWorth: currentNetWorth,
				income: s.income,
				expense: s.expense,
			});

			// 過去へ遡る：現在の純資産からその月の変化分を引く
			currentNetWorth -= s.netChange;

			// 1ヶ月前に戻す
			iterDate.setMonth(iterDate.getMonth() - 1);
			iterMonthStr = toYYYYMM(iterDate);

			// 無限ループ防止（安全策）
			if (historicalData.length > 240) break;
		}

		// 古い順にして保存
		await db.collection("user_stats").doc(userId).set(
			{
				historicalData: historicalData.reverse(),
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true }
		);
	}
);
