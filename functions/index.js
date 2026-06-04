const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { GoogleGenAI } = require("@google/genai");

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

const DEFAULT_PROJECT_ID = "walletwise-abc97";
const DEFAULT_VERTEXAI_LOCATION = "global";
const DEFAULT_VERTEX_AI_MODEL = "gemini-3.1-flash-lite";

/**
 * Vertex AI クライアントを初期化する。
 * @param {string} [projectId=DEFAULT_PROJECT_ID] - GCPプロジェクトID。
 * @param {string} [location=DEFAULT_VERTEXAI_LOCATION] - Vertex AIのリージョン。
 * @returns {GoogleGenAI}
 */
function createVertexAIClient(
	projectId = DEFAULT_PROJECT_ID,
	location = DEFAULT_VERTEXAI_LOCATION,
) {
	return new GoogleGenAI({
		vertexai: true,
		project: projectId,
		location: location,
	});
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

/**
 * ユーザーのAI機能の利用回数をチェックし、制限内でなければエラーを投げる。
 * 制限内の場合は利用回数をインクリメントする。
 * @async
 * @param {string} userId - ユーザーID。
 * @param {string} featureKey - 機能ごとの使用回数を保存するキー。
 * @param {number} [maxCalls=20] - 1日あたりの最大利用回数。
 * @returns {Promise<void>}
 * @throws {functions.https.HttpsError} 利用回数制限に達した場合にエラーを投げる。
 */
async function checkAndIncrementUsage(
	userId,
	featureKey,
	maxCalls = 20,
	errorMessage = "本日の利用回数制限に達しました。",
) {
	const dateObj = new Date(
		new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
	);
	const yyyy = dateObj.getFullYear();
	const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
	const dd = String(dateObj.getDate()).padStart(2, "0");
	const todayStr = `${yyyy}${mm}${dd}`;

	const configRef = db.collection(COLLECTIONS.USER_CONFIGS).doc(userId);

	await db.runTransaction(async (transaction) => {
		const doc = await transaction.get(configRef);
		let currentUsage = { date: todayStr, count: 0 };

		if (doc.exists) {
			const data = doc.data();
			if (data[featureKey] && data[featureKey].date === todayStr) {
				currentUsage = data[featureKey];
			}
		}

		if (currentUsage.count >= maxCalls) {
			throw new functions.https.HttpsError("resource-exhausted", errorMessage);
		}

		const newUsage = { date: todayStr, count: currentUsage.count + 1 };
		transaction.set(configRef, { [featureKey]: newUsage }, { merge: true });
	});
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

/**
 * レシート画像をVertex AI Geminiモデルに送信し、取引情報を抽出する。
 * クライアント側にAI呼び出しのロジックやスキーマを露出させず、安全に解析を行う。
 * @async
 * @param {object} data - リクエストデータ。
 * @param {string} data.base64Image - Base64エンコードされた画像データ。
 * @param {string} data.mimeType - 画像のMIMEタイプ。
 * @param {string} data.todayStr - 現在のローカル日付文字列（YYYY-MM-DD形式）。
 * @param {functions.https.CallableContext} context - 実行コンテキスト。
 * @returns {Promise<Array<object>>} 抽出された取引データの配列。
 * @fires VertexAI - Geminiモデルを呼び出して画像を解析する。
 * @throws {functions.https.HttpsError} 認証エラーやパラメータ不足、解析失敗時にエラーを投げる。
 */
exports.scanReceipt = functions
	.region("asia-northeast1")
	.https.onCall(async (data, context) => {
		// 未認証ユーザーによるAPIの不正利用を防ぐ。
		if (!context.auth) {
			throw new functions.https.HttpsError(
				"unauthenticated",
				"ログインが必要です。",
			);
		}

		const { base64Image, mimeType, todayStr } = data;
		if (!base64Image || !mimeType || !todayStr) {
			throw new functions.https.HttpsError(
				"invalid-argument",
				"必要なパラメータが不足しています。",
			);
		}

		await checkAndIncrementUsage(
			context.auth.uid,
			"aiScannerUsage",
			20,
			"本日のスキャン利用回数制限に達しました。",
		);

		try {
			const ai = createVertexAIClient();

			// Structured Outputsを用いて、Geminiからの返却値を厳密なJSON配列のスキーマに強制する。
			const schema = {
				type: "ARRAY",
				items: {
					type: "OBJECT",
					properties: {
						date: { type: "STRING", description: "取引日時 (YYYY-MM-DD形式)" },
						amount: { type: "NUMBER", description: "合計金額" },
						description: { type: "STRING", description: "店名または摘要" },
						type: {
							type: "STRING",
							enum: ["expense", "income"],
							description: "取引種別",
						},
						category: { type: "STRING", description: "カテゴリ名" },
					},
					required: ["date", "amount", "description", "type", "category"],
				},
			};

			const prompt = `
あなたは優秀な経理アシスタントです。アップロードされた画像（レシート、領収書、請求書、クレジットカード明細など）を解析し、画像に含まれる全ての取引情報を抽出してください。

現在の日付は ${todayStr} です。

【抽出ルール】
- date: 取引日時 (YYYY-MM-DD形式)。
	- 画像内に年がなく月日のみ（例: 1/7）の場合は、現在の日付 (${todayStr}) を基準に、最も近い過去の日付になるよう年を補完してください。
	- 日付自体が読み取れない場合は今日の日付 (${todayStr}) としてください。
- amount: 合計金額。
- description: 店名または摘要。
- type: "expense" (支出) または "income" (収入)。基本はexpense。
- category: 取引内容から推測されるカテゴリ名 (例: 食費, 交通費, 日用品, 交際費, 水道光熱費, 通信費, その他)。
`;

			const response = await ai.models.generateContent({
				model: DEFAULT_VERTEX_AI_MODEL,
				contents: [
					{ text: prompt },
					{
						inlineData: {
							data: base64Image,
							mimeType: mimeType,
						},
					},
				],
				config: {
					responseMimeType: "application/json",
					responseSchema: schema,
				},
			});

			// テキストが返却されなかった場合はエラーとして処理する。
			const text = response.text;
			if (!text) {
				throw new Error("解析結果のテキストが空でした。");
			}

			const parsedData = JSON.parse(text);
			return parsedData;
		} catch (error) {
			console.error("[Scan] Cloud Functions Gemini Error:", error);
			throw new functions.https.HttpsError(
				"internal",
				"画像の解析に失敗しました。",
				error.message,
			);
		}
	});

/**
 * 過去1ヶ月分の支出データをFirestoreから取得し、コンテキスト情報を生成する。
 * AIアドバイザーのプロンプトに含める背景情報を作成するためのヘルパー関数。
 * @async
 * @param {string} userId - ユーザーID。
 * @returns {Promise<string>} 過去1ヶ月の支出サマリーテキスト。
 */
async function getRecentContextSummary(userId) {
	const now = new Date();
	const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}${String(
		oneMonthAgo.getMonth() + 1,
	).padStart(2, "0")}${String(oneMonthAgo.getDate()).padStart(2, "0")}`;

	try {
		const snapshot = await db
			.collection(COLLECTIONS.TRANSACTIONS)
			.where("userId", "==", userId)
			.where("date", ">=", oneMonthAgoStr)
			.get();

		if (snapshot.empty) return "過去1ヶ月のデータなし";

		// カテゴリ別の集計
		const categoryTotals = {};
		let totalExpense = 0;

		snapshot.forEach((doc) => {
			const t = doc.data();
			if (t.type !== "expense") return;

			const amount = Number(t.amount);
			totalExpense += amount;

			const catId = t.categoryId || "未分類";
			categoryTotals[catId] = (categoryTotals[catId] || 0) + amount;
		});

		// 上位5カテゴリを取得
		const topCategories = Object.entries(categoryTotals)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([catId, amount]) => `${catId}: ¥${Math.round(amount)}`)
			.join(", ");

		return `過去1ヶ月の支出: 合計¥${totalExpense} | 主なカテゴリ: ${topCategories}`;
	} catch (error) {
		console.error("[Context] Error fetching context:", error);
		return "コンテキスト取得エラー";
	}
}

/**
 * AIアドバイザーからのリクエストを受け取り、Geminiモデルで回答を生成する。
 * クライアント側にAI呼び出しのロジックやキーを露出させず、安全に回答を生成する。
 * 構造化出力（JSON）で感情ステータスと注目カテゴリを返す。
 * @async
 * @param {object} data - リクエストデータ。
 * @param {string} data.prompt - AIに送信するプロンプト。
 * @param {boolean} data.isStart - 会話開始時の挨拶かどうか。
 * @param {string} [data.text] - ユーザーの入力テキスト。
 * @param {Array<object>} [data.history] - これまでの会話履歴。
 * @param {object} data.baseStats - 基本統計情報。
 * @param {object} [data.relevantData] - 質問に関連する抽出データ。
 * @param {functions.https.CallableContext} context - 実行コンテキスト。
 * @returns {Promise<object>} 生成された回答（JSON構造化出力）。
 * @fires VertexAI - Geminiモデルを呼び出してテキストを生成する。
 * @throws {functions.https.HttpsError} 認証エラーやパラメータ不足、生成失敗時にエラーを投げる。
 */
exports.askAdvisor = functions
	.region("asia-northeast1")
	.https.onCall(async (data, context) => {
		// 未認証ユーザーによるAPIの不正利用を防ぐ。
		if (!context.auth) {
			throw new functions.https.HttpsError(
				"unauthenticated",
				"ログインが必要です。",
			);
		}

		const { isStart, text, history, baseStats, relevantData } = data;
		if (!baseStats) {
			throw new functions.https.HttpsError(
				"invalid-argument",
				"必要なパラメータが不足しています。",
			);
		}

		await checkAndIncrementUsage(
			context.auth.uid,
			"aiAdvisorUsage",
			20,
			"本日のAI利用回数制限に達しました。また明日お話ししましょう！",
		);

		// 過去1ヶ月のコンテキストを自動取得
		const recentContext = await getRecentContextSummary(context.auth.uid);

		let aiPrompt = "";
		if (isStart) {
			aiPrompt = `
あなたは親しみやすいファイナンシャルプランナーです。
以下の家計簿データの全体像を分析し、ユーザーに最初の挨拶を行ってください。

【全体データ概要】
期間: ${baseStats.period}
全体収支: 収入 ${baseStats.totalIncome} / 支出 ${baseStats.totalExpense} (残高 ${baseStats.balance})

【直近1ヶ月の支出トレンド】
${recentContext}

【要件】
- 現在の季節感に触れつつ、親しみやすく挨拶。
- 家計の全体的な状態（黒字/赤字など）に一言触れる。
- 家計の全体的な状態（黒字/赤字など）に一言触れる。重要な金額やキーワードは「**テキスト**」のように囲んで太文字にする。
- 150文字以内で簡潔に。

【JSON出力形式】
以下のJSON形式で回答してください（初回はanalysisPointsとbudgetSuggestionは不要）:
{
  "adviceText": "ユーザーへの挨拶テキスト（150文字以内）",
  "alertLevel": "safe" | "warning" | "danger"
}`;
		} else {
			aiPrompt = `【役割】
あなたはユーザー専属のFP「WalletWise AI」です。
ユーザーの家計簿データに基づき、親しみやすく、かつ的確なアドバイスを行います。

【全体の統計情報 (マクロ視点)】
期間: ${baseStats.period}
全体収支: 収入 ${baseStats.totalIncome} / 支出 ${baseStats.totalExpense} (残高 ${baseStats.balance})
月次推移:
${baseStats.monthlyTrends}

【直近1ヶ月の支出トレンド（コンテキスト背景情報）】
${recentContext}

【参照用・取引詳細リスト (ミクロ視点)】
ユーザーの質問「${text}」に基づいて抽出・集計されたデータ:
抽出条件: **${relevantData.description}**
該当件数: ${relevantData.count}件

[集計結果]
支出合計: ${relevantData.stats.totalExpense}円
収入合計: ${relevantData.stats.totalIncome}円
振替合計: ${relevantData.stats.totalTransfer}円
主な支出内訳: ${relevantData.stats.topCategories || "特になし"}

[詳細リスト (最大70件)]
${relevantData.list || "(データなし)"}

【回答ガイドライン】
1. **超簡潔**: adviceTextは150文字以内。無駄な説明は不要。
2. **改行活用**: 「- 」で箇条書き化し、改行で見やすく整形してください（改行はフロントエンドで保持される）。
3. **データ根拠**: 「〇〇が〇〇円」と数字を入れ、具体的に。
4. **1つの提案**: 改善アクションは1つだけ、簡潔に。
5. **分析ポイント**: 「支出トレンド」「カテゴリ分析」「改善機会」など、3～4個の短い分析ポイントを提示してください。
2. **箇条書き**: 「・」（ドット）で箇条書き化し、改行で見やすく整形してください（改行はフロントエンドで保持される）。
3. **太字活用**: 重要なキーワードや金額は「**金額**」のようにアスタリスク2つで囲み太文字にしてください。
4. **データ根拠**: 「〇〇が〇〇円」と数字を入れ、具体的に。
5. **1つの提案**: 改善アクションは1つだけ、簡潔に。
6. **分析ポイント**: ユーザーの質問や状況に応じて、本当に重要な分析ポイントのみを0〜3個の範囲で提示してください（不要な場合は0個で構いません）。

【JSON出力形式】
以下のJSON形式で必ず回答してください:
{
  "adviceText": "ユーザーへのアドバイス文章（150文字以内、改行活用）",
  "alertLevel": "safe" | "warning" | "danger",
  "analysisPoints": [
    {
      "title": "ポイントのタイトル（例：支出トレンド）",
      "content": "短い分析内容",
      "type": "trend" | "warning" | "positive"
    },
    ...
  ]
}

【会話履歴】
`;
			if (history && history.length > 0) {
				history.forEach((msg) => {
					const roleLabel = msg.role === "user" ? "User" : "AI";
					aiPrompt += `${roleLabel}: ${msg.text}\n`;
				});
			}
			aiPrompt += `\nUser: ${text}\nAI:`;
		}

		try {
			const ai = createVertexAIClient();

			// 構造化出力用のスキーマを定義（拡張版）
			const advisorSchema = {
				type: "OBJECT",
				properties: {
					adviceText: {
						type: "STRING",
						description: "ユーザーへのメインアドバイス文章",
					},
					alertLevel: {
						type: "STRING",
						enum: ["safe", "warning", "danger"],
						description: "家計の危険度レベル",
					},
					analysisPoints: {
						type: "ARRAY",
						items: {
							type: "OBJECT",
							properties: {
								title: {
									type: "STRING",
									description: "分析ポイントのタイトル（例：支出トレンド）",
								},
								content: {
									type: "STRING",
									description: "分析内容",
								},
								type: {
									type: "STRING",
									enum: ["trend", "warning", "positive"],
									description: "ポイントの種類",
								},
							},
							required: ["title", "content", "type"],
						},
						description: "状況に応じた重要な分析ポイント（0～3個）",
					},
				},
				required: ["adviceText", "alertLevel"],
			};

			const response = await ai.models.generateContent({
				model: DEFAULT_VERTEX_AI_MODEL,
				contents: aiPrompt,
				config: {
					responseMimeType: "application/json",
					responseSchema: advisorSchema,
					safetySettings: [
						{
							category: "HARM_CATEGORY_HARASSMENT",
							threshold: "BLOCK_LOW_AND_ABOVE",
						},
						{
							category: "HARM_CATEGORY_HATE_SPEECH",
							threshold: "BLOCK_LOW_AND_ABOVE",
						},
						{
							category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
							threshold: "BLOCK_LOW_AND_ABOVE",
						},
						{
							category: "HARM_CATEGORY_DANGEROUS_CONTENT",
							threshold: "BLOCK_LOW_AND_ABOVE",
						},
					],
				},
			});

			// JSON形式の応答を解析
			const responseText = response.text;
			if (!responseText) {
				throw new Error("生成結果のテキストが空でした。");
			}

			// テキストをJSONとして解析（Markdown記号の削除）
			const jsonText = responseText.replace(/```json\n?|\```/g, "").trim();
			const result = JSON.parse(jsonText);

			return result;
		} catch (error) {
			console.error("[Advisor] Cloud Functions Gemini Error:", error);
			throw new functions.https.HttpsError(
				"internal",
				"回答の生成に失敗しました。",
				error.message,
			);
		}
	});
