import { app } from "../firebase.js";

/**
 * レシート解析に使用するVertex AIの生成モデルインスタンス。
 * Gemini 2.5 Flashモデルを使用し、高速かつ低コストな解析を実現する。
 * @type {object}
 */
async function getModel() {
	const { getGenerativeModel, getVertexAI } = await import("firebase/vertexai");
	const vertexAI = getVertexAI(app);
	return getGenerativeModel(vertexAI, { model: "gemini-2.5-flash" });
}

/**
 * レシート画像をVertex AI Geminiモデルに送信し、取引情報を抽出する。
 * 画像をBase64に変換し、プロンプトと共にモデルへ送信してJSON形式のレスポンスを得る。
 * @async
 * @param {File} file - 解析対象の画像ファイル。
 * @param {object} [settings={}] - スキャン設定（除外キーワード、カテゴリ分類ルール）。
 * @param {object} [luts={}] - アプリケーションのマスタデータ（カテゴリ名解決用）。
 * @returns {Promise<object>} 抽出された取引情報を含むJSONオブジェクト。
 * @throws {Error} ファイルがない場合、または解析に失敗した場合にエラーを投げる。
 */
export async function scanReceipt(file, settings = {}, luts = {}) {
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
		const modelInstance = await getModel();
		const result = await modelInstance.generateContent([prompt, imagePart]);
		const response = await result.response;
		const text = response.text();

		// JSONをパースする（念のためレスポンスに含まれがちなマークダウン記号を除去）
		const cleanJson = text.replace(/```json|```/g, "").trim();
		let data = JSON.parse(cleanJson);

		// 設定に基づいてデータを加工・フィルタリングする
		data = applyScanSettings(data, settings, luts);

		return data;
	} catch (error) {
		console.error("[Scan] Gemini解析エラー:", error);
		throw new Error("画像の解析に失敗しました。");
	}
}

/**
 * スキャン設定に基づいて解析結果を加工・フィルタリングする。
 * @private
 * @param {object|Array<object>} data - Geminiからの解析結果。
 * @param {object} settings - スキャン設定。
 * @param {object} luts - マスタデータ。
 * @returns {object|Array<object>} 加工後のデータ。除外された場合はnullまたは空配列を返す可能性があるが、呼び出し元でハンドリングが必要。
 */
function applyScanSettings(data, settings, luts) {
	if (!data) return null;

	// 配列でなければ配列化して処理し、最後に単一オブジェクトに戻す（もし元が単一なら）
	const isArray = Array.isArray(data);
	let items = isArray ? data : [data];

	const excludeKeywords = settings.excludeKeywords || [];
	const categoryRules = settings.categoryRules || [];

	items = items.filter((item) => {
		if (!item || !item.description) return true;

		// 1. 除外キーワードのチェック
		const desc = item.description;
		const shouldExclude = excludeKeywords.some((keyword) =>
			desc.includes(keyword)
		);
		return !shouldExclude;
	});

	// 2. カテゴリ分類ルールの適用
	items = items.map((item) => {
		if (!item || !item.description) return item;

		const desc = item.description;
		const matchedRule = categoryRules.find((rule) =>
			desc.includes(rule.keyword)
		);

		if (matchedRule && luts.categories) {
			const category = luts.categories.get(matchedRule.categoryId);
			if (category) {
				// カテゴリ名を上書きする（scan_confirm.jsで名前マッチングされるため）
				item.category = category.name;
			}
		}
		return item;
	});

	if (items.length === 0) {
		// 全て除外された場合
		// scan_confirm.jsは空配列を受け取ると空行を表示するので、空配列を返すのが安全
		return isArray ? [] : null; // 元が単一で除外されたらnullを返すのが自然か？ scan_confirm.jsはnullチェックしていないかも。
		// scan_confirm.js: const transactions = Array.isArray(scanResult) ? scanResult : [scanResult];
		// scanResultがnullだと [null] になる。
		// scan_confirm.jsのaddTransactionRow(data={})は dataがnullだと {} として扱われるので安全。
	}

	return isArray ? items : items[0];
}

/**
 * FileオブジェクトをBase64エンコードされた文字列に変換する。
 * Vertex AI APIに送信するために、データURLのプレフィックスを除去した純粋なBase64文字列を生成する。
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
