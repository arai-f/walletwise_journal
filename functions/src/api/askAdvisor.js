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

		const {
			isStart,
			text,
			history,
			baseStats,
			relevantData,
			proactiveDigest,
		} = data;
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
あなたはユーザー専属の敏腕ファイナンシャルプランナー「WalletWise AI」です。
ユーザーがホーム画面を開いた時点で、能動的に家計のトレンド・月末見通し・おすすめアクションを読み取って提示してください。

【全体データ概要】
期間: ${baseStats.period}
全体収支: 収入 ${baseStats.totalIncome} / 支出 ${baseStats.totalExpense} (残高 ${baseStats.balance})
月次推移:
${baseStats.monthlyTrends || "(データなし)"}

【直近1ヶ月の支出トレンド】
${recentContext}

【クライアント事前集計ダイジェスト（今月 vs 先月・月末予測・頻出/最大出費）】
${proactiveDigest?.promptSummary || "事前集計なし"}

【要件】
文字数を極限まで減らし、パッと見て1秒で頭に入る超短文にしてください。
1. **adviceText（1行ヘッドライン）**: 35文字以内。前置きや挨拶は一切省き、今月の結論だけを1文で。
2. **analysisPoints（3つの見出しインサイトカード）**: 画面には title（見出し）のみが表示されます。以下の3つの切り口で計3個作成してください：
   - 1つ目（先月比・ペース）: type は "positive"（節約順調）または "warning"（増加傾向）または "trend"。
   - 2つ目（おすすめ節約提案）: type は "recommendation"。
   - 3つ目（注目・最大出費）: type は "highlight"。
   - **重要**:
     - 各カードの title は **22文字以内** で、それ単体で意味と金額がわかる見出しにしてください（例：「食費が先月比 -¥5,700 と好調」「コンビニ月8回 → 週2回で¥3,000節約」「最大出費：スーパーライフ ¥3,639」）。
     - 各カードの followUpPrompt には、カードタップ時にAIへ送る深掘り質問文を設定。
3. **suggestedQuestions（質問チップ）**: ワンタップ深掘り質問を3個作成（label は12文字以内）。`;
		} else {
			aiPrompt = `【役割】
あなたはユーザー専属のFP「WalletWise AI」です。
ユーザーの家計簿データに基づき、的確なアドバイスを行います。

【全体の統計情報 (マクロ視点)】
期間: ${baseStats.period}
全体収支: 収入 ${baseStats.totalIncome} / 支出 ${baseStats.totalExpense} (残高 ${baseStats.balance})
月次推移:
${baseStats.monthlyTrends}

【直近1ヶ月の支出トレンド（コンテキスト背景情報）】
${recentContext}

【今月のプロアクティブ集計サマリー】
${proactiveDigest?.promptSummary || "なし"}

【参照用・取引詳細リスト (ミクロ視点)】
ユーザーの質問「${text}」に基づいて抽出・集計されたデータ:
抽出条件: **${relevantData?.description || "直近の取引"}**
該当件数: ${relevantData?.count ?? 0}件

[集計結果]
支出合計: ${relevantData?.stats?.totalExpense ?? 0}円
収入合計: ${relevantData?.stats?.totalIncome ?? 0}円
振替合計: ${relevantData?.stats?.totalTransfer ?? 0}円
主な支出内訳: ${relevantData?.stats?.topCategories || "特になし"}

[詳細リスト (最大70件)]
${relevantData?.list || "(データなし)"}

【回答ガイドライン】
1. **箇条書き必須**: 挨拶や前置きは一切省き、各行の先頭を「- 」にした箇条書き（2〜3行、各行は改行コード \\n で区切る）で簡潔に回答してください。
   出力例:
   - **今月の食費**: 合計**¥42,800**（先月比 **-¥5,700**）
   - **主な内訳**: スーパーライフ（**¥18,200**）、カフェ・コンビニ（**¥6,480**）
   - **おすすめ**: コンビニ利用を週2回に絞ると月**¥3,000**節約できます
2. **太字活用**: 重要なキーワードや金額は「**¥12,000**」のようにアスタリスク2つで囲んでください。
3. **短く端的に**: 全体で140文字以内に収めてください。チャット内では analysisPoints は空配列（[]）にしてください。
4. **次の深掘り質問チップ (suggestedQuestions)**: この回答に関連する次の質問を2〜3個提案してください。

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

			// 構造化出力用のスキーマを定義（プロアクティブ・インサイト＆深掘り対応版）
			const advisorSchema = {
				type: "OBJECT",
				properties: {
					adviceText: {
						type: "STRING",
						description: "ユーザーへのメインアドバイスまたは全体総評文章",
					},
					alertLevel: {
						type: "STRING",
						enum: ["safe", "warning", "danger"],
						description: "家計の危険度レベル",
					},
					forecastComment: {
						type: "STRING",
						description: "月末着地見通しに関する一言コメント",
					},
					analysisPoints: {
						type: "ARRAY",
						items: {
							type: "OBJECT",
							properties: {
								title: {
									type: "STRING",
									description: "インサイトカードのタイトル",
								},
								content: {
									type: "STRING",
									description: "具体的な数値を含む分析・提案内容",
								},
								type: {
									type: "STRING",
									enum: [
										"trend",
										"warning",
										"positive",
										"recommendation",
										"highlight",
									],
									description: "インサイトの種類",
								},
								followUpPrompt: {
									type: "STRING",
									description:
										"このカードをタップした際にAIへ送る深掘り質問文",
								},
							},
							required: ["title", "content", "type"],
						},
						description: "能動的インサイトカード（初回は3個、会話時は0～2個）",
					},
					suggestedQuestions: {
						type: "ARRAY",
						items: {
							type: "OBJECT",
							properties: {
								label: {
									type: "STRING",
									description: "絵文字付きの短い質問チップ表示名（15文字以内）",
								},
								text: {
									type: "STRING",
									description: "タップ時に送信する具体的な質問テキスト",
								},
							},
							required: ["label", "text"],
						},
						description: "状況に応じたおすすめ深掘り質問チップ（2～4個）",
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
