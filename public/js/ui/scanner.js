import { getGenerativeModel, vertexAI } from "../firebase.js";

const model = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });

export async function scanReceipt(file) {
	if (!file) throw new Error("ファイルが選択されていません。");

	// 画像をBase64に変換
	const base64Image = await fileToBase64(file);

	// プロンプトの定義
	const prompt = `
    あなたは優秀な経理アシスタントです。アップロードされたレシートや明細書の画像を解析し、以下の情報を抽出してJSON形式のみを出力してください。
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

		// JSONをパース（念のためマークダウン記号除去）
		const cleanJson = text.replace(/```json|```/g, "").trim();
		return JSON.parse(cleanJson);
	} catch (error) {
		console.error("Gemini解析エラー:", error);
		throw new Error("画像の解析に失敗しました。");
	}
}

// Helper: File -> Base64 (タグ部分除く)
function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			// "data:image/jpeg;base64,..." の部分を取り除く
			const base64String = reader.result.split(",")[1];
			resolve(base64String);
		};
		reader.onerror = (error) => reject(error);
	});
}
