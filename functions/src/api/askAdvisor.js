const functions = require("firebase-functions/v1");
const {
	checkAndIncrementUsage,
	getRecentContextSummary,
	createVertexAIClient,
	DEFAULT_VERTEX_AI_MODEL,
} = require("../shared/ai");

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
			const jsonText = responseText.replace(/```json\n?|```\n?/g, "").trim();
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
