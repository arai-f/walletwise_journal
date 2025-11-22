import { getGenerativeModel, vertexAI } from "../firebase.js";

/**
 * レシート解析に使用するVertex AIの生成モデルインスタンス。
 * @type {object}
 */
const model = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });

/**
 * レシート画像をVertex AI Geminiモデルに送信し、取引情報を抽出する。
 * @async
 * @param {File} file - 解析対象の画像ファイル。
 * @returns {Promise<object>} 抽出された取引情報を含むJSONオブジェクト。
 * @throws {Error} ファイルがない場合、または解析に失敗した場合にエラーを投げる。
 * @fires Vertex AI API - Geminiモデルに画像とプロンプトを送信する。
 */
export async function scanReceipt(file) {
	if (!file) throw new Error("ファイルが選択されていません。");

	// 画像をBase64文字列に変換する
	const base64Image = await fileToBase64(file);

	// Geminiモデルに与えるプロンプトを定義する
	const prompt = `
    あなたは優秀な経理アシスタントです。アップロードされた画像（レシート、領収書、請求書、クレジットカード明細など）を解析し、以下の情報を抽出してJSON形式のみを出力してください。
    余計なマークダウン記号（\`\`\`jsonなど）は含めないでください。

    【抽出項目】
    - date: 取引日時 (YYYY-MM-DD形式)。不明な場合は今日の日付。
    - amount: 合計金額 (数値のみ)。
    - description: 店名または摘要。
    - type: "expense" (支出) または "income" (収入)。基本はexpense。
    - category: 取引内容から推測されるカテゴリ名 (例: 食費, 交通費, 日用品, 交際費, 水道光熱費, 通信費, その他)。

    画像が読み取れない場合は null を返してください。
    `;

	const imagePart = {
		inlineData: {
			data: base64Image,
			mimeType: file.type,
		},
	};

	try {
		const result = await model.generateContent([prompt, imagePart]);
		const response = await result.response;
		const text = response.text();

		// JSONをパースする（念のためレスポンスに含まれがちなマークダウン記号を除去）
		const cleanJson = text.replace(/```json|```/g, "").trim();
		return JSON.parse(cleanJson);
	} catch (error) {
		console.error("Gemini解析エラー:", error);
		throw new Error("画像の解析に失敗しました。");
	}
}

/**
 * FileオブジェクトをBase64エンコードされた文字列に変換する（データURLのプレフィックスは除去）。
 * @private
 * @param {File} file - 変換するファイルオブジェクト。
 * @returns {Promise<string>} Base64エンコードされた文字列。
 */
function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			// データURLのプレフィックス ("data:image/jpeg;base64,") を取り除く
			const base64String = reader.result.split(",")[1];
			resolve(base64String);
		};
		reader.onerror = (error) => reject(error);
	});
}
