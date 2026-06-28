const functions = require("firebase-functions/v1");
const { checkAndIncrementUsage, analyzeReceiptCore } = require("../shared/ai");

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
			// 共通コア関数を使用してレシート画像を解析する。
			const parsedData = await analyzeReceiptCore(
				base64Image,
				mimeType,
				todayStr,
			);
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
