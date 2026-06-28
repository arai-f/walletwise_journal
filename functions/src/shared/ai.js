const { GoogleGenAI } = require("@google/genai");
const { db, COLLECTIONS } = require("./db");

const DEFAULT_PROJECT_ID = "walletwise-abc97";
const DEFAULT_VERTEXAI_LOCATION = "global";
const DEFAULT_VERTEX_AI_MODEL = "gemini-3.1-flash-lite";
exports.DEFAULT_VERTEX_AI_MODEL = DEFAULT_VERTEX_AI_MODEL;

/**
 * Vertex AI クライアントを初期化する。
 * @param {string} [projectId=DEFAULT_PROJECT_ID] - GCPプロジェクトID。
 * @param {string} [location=DEFAULT_VERTEXAI_LOCATION] - Vertex AIのリージョン。
 * @returns {GoogleGenAI}
 */
const createVertexAIClient = function (
	projectId = DEFAULT_PROJECT_ID,
	location = DEFAULT_VERTEXAI_LOCATION,
) {
	return new GoogleGenAI({
		vertexai: true,
		project: projectId,
		location: location,
	});
};
exports.createVertexAIClient = createVertexAIClient;

/**
 * Vertex AI Geminiモデルを使用してレシート画像を解析し、取引情報を抽出する共通コア関数。
 * scanReceipt (onCall) と apiScanAndSaveReceipt (onRequest) で共用される。
 * @async
 * @param {string} base64Image - Base64エンコードされた画像データ。
 * @param {string} mimeType - 画像のMIMEタイプ。
 * @param {string} todayStr - 現在の日付文字列（YYYY-MM-DD形式）。
 * @returns {Promise<Array<object>>} 抽出された取引データの配列。各要素は {date, amount, description, type, category}。
 * @throws {Error} AI解析失敗時または不正なJSONフォーマット時にエラーを投げる。
 */

exports.analyzeReceiptCore = async function (base64Image, mimeType, todayStr) {
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

	// JSONパース前にテキストの前処理を行う（Markdownコードブロック記号の除去）。
	const jsonText = text.replace(/```json\n?|```\n?/g, "").trim();
	let parsedData;

	try {
		parsedData = JSON.parse(jsonText);
	} catch (parseError) {
		throw new Error(
			`JSONパース失敗: ${parseError.message} | 原文: ${text.substring(0, 200)}`,
		);
	}

	// 配列でない場合はエラーとして処理する。
	if (!Array.isArray(parsedData)) {
		throw new Error(
			`AIの応答が配列形式ではありません。type: ${typeof parsedData}`,
		);
	}

	return parsedData;
};

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
exports.checkAndIncrementUsage = async function (
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
};

/**
 * 過去1ヶ月分の支出データをFirestoreから取得し、コンテキスト情報を生成する。
 * AIアドバイザーのプロンプトに含める背景情報を作成するためのヘルパー関数。
 * @async
 * @param {string} userId - ユーザーID。
 * @returns {Promise<string>} 過去1ヶ月の支出サマリーテキスト。
 */
exports.getRecentContextSummary = async function (userId) {
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
};
