import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";
import * as utils from "../utils.js";

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
 * 画像ファイルを一定解像度以下にリサイズ・圧縮してBase64に変換する。
 * トークン消費を削減し、API課金を最適化する。
 * @param {File} file - 圧縮対象の画像ファイル。
 * @param {number} [maxWidth=1200] - 最大横幅（ピクセル）。デフォルトは1200。
 * @returns {Promise<string>} 圧縮済みBase64文字列（プレフィックスなし）。
 */
function resizeAndCompressImage(file, maxWidth = 1200) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = (event) => {
			const img = new Image();
			img.src = event.target.result;
			img.onload = () => {
				// 元画像のサイズ確認
				let width = img.width;
				let height = img.height;

				// アスペクト比を維持して最大横幅を制限
				if (width > maxWidth) {
					height = Math.round((height * maxWidth) / width);
					width = maxWidth;
				}

				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;

				const ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0, width, height);

				// JPEG品質 0.75 程度で圧縮してデータURL化
				const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
				const base64String = dataUrl.split(",")[1];
				resolve(base64String);
			};
			img.onerror = (err) => reject(err);
		};
		reader.onerror = (err) => reject(err);
	});
}

/**
 * 指定された種類のカテゴリリストをソートして取得する。
 * @param {object} luts - ルックアップテーブル。
 * @param {string} type - 'income' または 'expense'。
 * @returns {Array} ソート済みカテゴリの配列。
 */
function getSortedCategories(luts, type) {
	if (!luts || !luts.categories) return [];
	return utils.sortItems(
		[...luts.categories.values()].filter(
			(c) => !c.isDeleted && c.type === type,
		),
	);
}

/**
 * AIが推測したカテゴリテキストから、最も近いカテゴリIDを検索する。
 * @param {object} luts - ルックアップテーブル。
 * @param {string} aiCategoryText - AIが推測したカテゴリテキスト。
 * @param {string} type - 'income' または 'expense'。
 * @returns {string} マッチしたカテゴリID、またはデフォルトのカテゴリID。
 */
function findBestCategoryMatch(luts, aiCategoryText, type) {
	if (!aiCategoryText) return "";
	const categories = getSortedCategories(luts, type);
	const text = aiCategoryText.toLowerCase().trim();

	let match = categories.find((c) => c.name.toLowerCase() === text);
	if (match) return match.id;

	match = categories.find(
		(c) =>
			c.name.toLowerCase().includes(text) ||
			text.includes(c.name.toLowerCase()),
	);
	if (match) return match.id;

	return categories.length > 0 ? categories[0].id : "";
}

/**
 * スキャン設定に基づいて解析結果を加工・フィルタリングする。
 * 除外キーワードやカテゴリ自動分類ルールを適用し、アプリ内のトランザクション形式に変換する。
 * @param {object|Array} data - Geminiからの解析結果（単一オブジェクトまたは配列）。
 * @param {object} settings - スキャン設定。
 * @param {object} luts - ルックアップテーブル。
 * @returns {Array} 加工・変換後のトランザクション配列。
 */
function applyScanSettings(data, settings, luts) {
	if (!data) return [];

	const isArray = Array.isArray(data);
	let items = isArray ? data : [data];

	const excludeKeywords = settings.excludeKeywords || [];
	const categoryRules = settings.categoryRules || [];
	const today = utils.toYYYYMMDD(new Date());

	return items
		.filter((item) => {
			if (!item || !item.description) return true;
			return !excludeKeywords.some((keyword) =>
				item.description.includes(keyword),
			);
		})
		.map((item, index) => {
			if (!item) return null;
			const type = item.type || "expense";
			let catId = "";

			const matchedRule = item.description
				? categoryRules.find((rule) => item.description.includes(rule.keyword))
				: null;

			if (
				matchedRule &&
				luts.categories &&
				luts.categories.has(matchedRule.categoryId)
			) {
				catId = matchedRule.categoryId;
			} else if (item.category) {
				catId = findBestCategoryMatch(luts, item.category, type);
			} else {
				const cats = getSortedCategories(luts, type);
				if (cats.length > 0) catId = cats[0].id;
			}

			return {
				id: `temp-${Date.now()}-${index}`,
				date: item.date || today,
				amount: item.amount ? String(item.amount) : "",
				type: type,
				categoryId: catId,
				description: item.description || "",
				memo: "",
			};
		})
		.filter(Boolean);
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

	const base64Image = await resizeAndCompressImage(file);
	const todayStr = utils.getLocalToday();

	try {
		const scanReceiptFn = httpsCallable(functions, "scanReceipt");

		const result = await scanReceiptFn({
			base64Image,
			mimeType: file.type,
			todayStr,
		});

		let data = result.data;

		data = applyScanSettings(data, settings, luts);

		return data;
	} catch (error) {
		console.error("[Scan] Cloud Functions Error:", error);
		if (error.code === "functions/resource-exhausted") {
			throw new Error(error.message);
		}
		throw new Error("画像の解析に失敗しました。");
	}
}
