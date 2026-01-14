import { app } from "../firebase.js";

/**
 * レシート解析に使用するVertex AIの生成モデルインスタンス。
 * Gemini 2.5 Flashモデルを使用し、高速かつ低コストな解析を実現する。
 */
async function getModel() {
	const { getAI, getGenerativeModel, VertexAIBackend } = await import(
		"firebase/ai"
	);
	const ai = getAI(app, { backend: new VertexAIBackend() });
	return getGenerativeModel(ai, { model: "gemini-2.5-flash" });
}

/**
 * FileオブジェクトをBase64エンコードされた文字列に変換する。
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

/**
 * スキャン設定に基づいて解析結果を加工・フィルタリングする。
 */
function applyScanSettings(data, settings, luts) {
	if (!data) return null;

	const isArray = Array.isArray(data);
	let items = isArray ? data : [data];

	const excludeKeywords = settings.excludeKeywords || [];
	const categoryRules = settings.categoryRules || [];

	items = items.filter((item) => {
		if (!item || !item.description) return true;
		const desc = item.description;
		const shouldExclude = excludeKeywords.some((keyword) =>
			desc.includes(keyword)
		);
		return !shouldExclude;
	});

	items = items.map((item) => {
		if (!item || !item.description) return item;

		const desc = item.description;
		const matchedRule = categoryRules.find((rule) =>
			desc.includes(rule.keyword)
		);

		if (matchedRule && luts.categories) {
			const category = luts.categories.get(matchedRule.categoryId);
			if (category) {
				item.category = category.name;
			}
		}
		return item;
	});

	if (items.length === 0) {
		return isArray ? [] : null;
	}

	return isArray ? items : items[0];
}

/**
 * レシート画像をVertex AI Geminiモデルに送信し、取引情報を抽出する。
 */
export async function scanReceipt(file, settings = {}, luts = {}) {
	if (!file) throw new Error("ファイルが選択されていません。");

	const base64Image = await fileToBase64(file);

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
		const modelInstance = await getModel();
		const result = await modelInstance.generateContent([prompt, imagePart]);
		const response = await result.response;
		const text = response.text();

		const cleanJson = text.replace(/```json|```/g, "").trim();
		let data = JSON.parse(cleanJson);

		data = applyScanSettings(data, settings, luts);

		return data;
	} catch (error) {
		console.error("[Scan] Gemini解析エラー:", error);
		throw new Error("画像の解析に失敗しました。");
	}
}
