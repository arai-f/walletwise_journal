import { app } from "../firebase.js";
import * as utils from "../utils.js";

/**
 * レシート解析に使用するVertex AIの生成モデルインスタンス。
 * Gemini 2.5 Flashモデルを使用し、高速かつ低コストな解析を実現する。
 * @async
 * @param {object} [generationConfig] - 生成設定（スキーマなど）。
 * @returns {Promise<object>} 生成モデルインスタンス。
 */
async function getModel(generationConfig) {
	const { getAI, getGenerativeModel, VertexAIBackend } =
		await import("firebase/ai");
	const ai = getAI(app, { backend: new VertexAIBackend() });
	return getGenerativeModel(ai, {
		model: "gemini-2.5-flash",
		generationConfig,
	});
}

/**
 * FileオブジェクトをBase64エンコードされた文字列に変換する。
 * Gemini APIへの送信形式に合わせるために使用する。
 * @param {File} file - 変換対象のファイル。
 * @returns {Promise<string>} Base64文字列（プレフィックスなし）。
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
 * 除外キーワードやカテゴリ自動分類ルールを適用する。
 * @param {object|Array} data - Geminiからの解析結果（単一オブジェクトまたは配列）。
 * @param {object} settings - スキャン設定。
 * @param {object} luts - ルックアップテーブル。
 * @returns {object|Array|null} 加工後のデータ。
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
			desc.includes(keyword),
		);
		return !shouldExclude;
	});

	items = items.map((item) => {
		if (!item || !item.description) return item;

		const desc = item.description;
		const matchedRule = categoryRules.find((rule) =>
			desc.includes(rule.keyword),
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
 * 画像内の日付、金額、店名、カテゴリなどを解析し、JSON形式で返す。
 * @async
 * @param {File} file - 解析対象の画像ファイル。
 * @param {object} [settings={}] - スキャン設定。
 * @param {object} [luts={}] - ルックアップテーブル。
 * @returns {Promise<object|Array>} 解析された取引データ。
 * @throws {Error} ファイル未選択や解析失敗時にエラーを投げる。
 */
export async function scanReceipt(file, settings = {}, luts = {}) {
	if (!file) throw new Error("ファイルが選択されていません。");

	const base64Image = await fileToBase64(file);
	const todayStr = utils.getLocalToday();

	// Response Schema (Structured Outputs) の定義
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

	const imagePart = {
		inlineData: {
			data: base64Image,
			mimeType: file.type,
		},
	};

	try {
		const modelInstance = await getModel({
			responseMimeType: "application/json",
			responseSchema: schema,
		});
		const result = await modelInstance.generateContent([prompt, imagePart]);
		const response = await result.response;
		const text = response.text();

		let data = JSON.parse(text);

		data = applyScanSettings(data, settings, luts);

		return data;
	} catch (error) {
		console.error("[Scan] Gemini Error:", error);
		throw new Error("画像の解析に失敗しました。");
	}
}
