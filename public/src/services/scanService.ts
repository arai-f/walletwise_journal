/**
 * レシート画像の OCR スキャンと、その結果の取引データ変換を担うサービス。
 * Gemini ベースの Cloud Functions に画像を送信し、結果をアプリ内形式に加工する。
 */
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "../firebase.js";
import type { ScanSettingsConfig } from "../types/settings.js";
import * as utils from "../utils.js";

/**
 * スキャン対象のカテゴリを表す最小型。
 * `Luts.categories` の Map 値型と互換にするための緩い表現。
 */
export type ScanCategoryLike = {
	id: string;
	name: string;
	type: string;
	isDeleted?: boolean;
	order?: number;
};

/**
 * `applyScanSettings` / `scanReceipt` が受け取るルックアップテーブル型。
 * `useScanReceipt` から渡される緩い形との互換性を保つため、
 * プロパティは `unknown` 寄りに受ける。
 */
export type ScanLutsLike = {
	categories?:
		| Map<string, ScanCategoryLike>
		| Record<string, ScanCategoryLike>;
	accounts?: unknown;
};

/**
 * `scanReceipt` が返す取引行データの型。
 * 旧呼び出し側の `ScanTransactionRow` と互換。
 */
export interface ScannedTransactionRow {
	/** 一意な行 ID（編集中も保持される）。 */
	id: string;
	/** 取引日（'yyyy-MM-dd' 形式）。 */
	date: string;
	/** 金額（文字列、編集中は空文字の可能性あり）。 */
	amount: string;
	/** 取引種別。 */
	type: string;
	/** カテゴリ ID。 */
	categoryId: string;
	/** 取引内容。 */
	description: string;
	/** メモ。 */
	memo: string;
}

/**
 * File オブジェクトを Base64 エンコードされた文字列に変換する。
 * Gemini API への送信形式に合わせるために使用する。
 * @param file - 変換対象のファイル。
 * @returns Base64 文字列（プレフィックスなし）。
 */
function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			// データURLのプレフィックス ("data:image/jpeg;base64,") を取り除く
			const base64String = (reader.result as string).split(",")[1];
			resolve(base64String);
		};
		reader.onerror = (error) => reject(error);
	});
}

/**
 * 画像ファイルを一定解像度以下にリサイズ・圧縮して Base64 に変換する。
 * トークン消費を削減し、API 課金を最適化する。
 * @param file - 圧縮対象の画像ファイル。
 * @param maxWidth - 最大横幅（ピクセル）。デフォルトは 1200。
 * @returns 圧縮済み Base64 文字列（プレフィックスなし）。
 */
function resizeAndCompressImage(file: File, maxWidth = 1200): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = (event) => {
			const img = new Image();
			img.src = event.target?.result as string;
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
				if (!ctx) {
					reject(new Error("Canvas 2D context を取得できませんでした。"));
					return;
				}
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
 * `luts.categories` を内部統一形式（配列 + 種別フィルタ済み + ソート済み）に変換する。
 * 旧 `.js` 実装では `luts.categories.values()` を直接呼んでおり、
 * `categories` が `Record<string, ScanCategoryLike>` 形式の場合と
 * `Map` 形式の場合の両方に対応するためのヘルパー。
 * @param luts - ルックアップテーブル。
 * @returns 正規化されたカテゴリの配列。
 */
function listCategories(
	luts: ScanLutsLike | undefined,
): ScanCategoryLike[] {
	if (!luts || !luts.categories) return [];
	const cats = luts.categories;
	if (cats instanceof Map) {
		return Array.from(cats.values()) as ScanCategoryLike[];
	}
	return Object.values(cats) as ScanCategoryLike[];
}

/**
 * 指定された種類のカテゴリリストをソートして取得する。
 * @param luts - ルックアップテーブル。
 * @param type - 'income' または 'expense'。
 * @returns ソート済みカテゴリの配列。
 */
function getSortedCategories(
	luts: ScanLutsLike | undefined,
	type: string,
): ScanCategoryLike[] {
	const all = listCategories(luts).filter(
		(c) => !c.isDeleted && c.type === type,
	);
	// `utils.sortItems` は `BaseItem` 互換の型を想定しているためキャストする。
	return utils.sortItems(all) as ScanCategoryLike[];
}

/**
 * AI が推測したカテゴリテキストから、最も近いカテゴリ ID を検索する。
 * @param luts - ルックアップテーブル。
 * @param aiCategoryText - AI が推測したカテゴリテキスト。
 * @param type - 'income' または 'expense'。
 * @returns マッチしたカテゴリ ID、またはデフォルトのカテゴリ ID。
 */
function findBestCategoryMatch(
	luts: ScanLutsLike | undefined,
	aiCategoryText: string,
	type: string,
): string {
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
 * Gemini からの解析結果 1 件分の最小型。
 * 厳密にはスキーマが決まっているが、緩めに `unknown` で受ける。
 */
interface GeminiScannedItem {
	[key: string]: unknown;
	description?: string;
	amount?: number | string;
	type?: string;
	date?: string;
	category?: string;
}

/**
 * スキャン設定に基づいて解析結果を加工・フィルタリングする。
 * 除外キーワードやカテゴリ自動分類ルールを適用し、アプリ内のトランザクション形式に変換する。
 * @param data - Gemini からの解析結果（単一オブジェクトまたは配列）。
 * @param settings - スキャン設定。
 * @param luts - ルックアップテーブル。
 * @returns 加工・変換後のトランザクション配列。
 */
function applyScanSettings(
	data: unknown,
	settings: ScanSettingsConfig | Record<string, unknown>,
	luts: ScanLutsLike,
): ScannedTransactionRow[] {
	if (!data) return [];

	const isArray = Array.isArray(data);
	const items: GeminiScannedItem[] = isArray
		? (data as GeminiScannedItem[])
		: [data as GeminiScannedItem];

	const settingsObj = settings as ScanSettingsConfig;
	const excludeKeywords: string[] = settingsObj.excludeKeywords || [];
	const categoryRules = settingsObj.categoryRules || [];
	const today = utils.toYYYYMMDD(new Date());

	return items
		.filter((item) => {
			if (!item || !item.description) return true;
			return !excludeKeywords.some((keyword) =>
				(item.description as string).includes(keyword),
			);
		})
		.map((item, index): ScannedTransactionRow | null => {
			if (!item) return null;
			const type = item.type || "expense";
			let catId = "";

			const matchedRule = item.description
				? categoryRules.find((rule) =>
						(item.description as string).includes(rule.keyword),
					)
				: null;

			const cats = luts.categories;
			const isMap = cats instanceof Map;
			const hasMatchedCatId =
				matchedRule &&
				((isMap && cats.has(matchedRule.categoryId)) ||
					(!!cats &&
						!isMap &&
						matchedRule.categoryId in
							(cats as Record<string, unknown>)));
			if (matchedRule && hasMatchedCatId) {
				catId = matchedRule.categoryId;
			} else if (item.category) {
				catId = findBestCategoryMatch(luts, item.category, type);
			} else {
				const defaultCats = getSortedCategories(luts, type);
				if (defaultCats.length > 0) catId = defaultCats[0].id;
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
		.filter((row): row is ScannedTransactionRow => row !== null);
}

/**
 * レシート画像を Vertex AI Gemini モデルに送信し、取引情報を抽出する。
 * 画像内の日付、金額、店名、カテゴリなどを解析し、JSON 形式で返す。
 * @param file - 解析対象の画像ファイル。
 * @param settings - スキャン設定。
 * @param luts - ルックアップテーブル。
 * @returns 解析された取引データの配列。
 * @throws {Error} ファイル未選択や解析失敗時にエラーを投げる。
 */
export async function scanReceipt(
	file: File,
	settings: ScanSettingsConfig | Record<string, unknown> = {},
	luts: ScanLutsLike = {},
): Promise<ScannedTransactionRow[]> {
	if (!file) throw new Error("ファイルが選択されていません。");

	const base64Image = await resizeAndCompressImage(file);
	const todayStr = utils.getLocalToday();

	try {
		const scanReceiptFn = httpsCallable(functions, "scanReceipt");

		const result: HttpsCallableResult<unknown> = await scanReceiptFn({
			base64Image,
			mimeType: file.type,
			todayStr,
		});

		const data = result.data;

		const rows = applyScanSettings(data, settings, luts);

		return rows;
	} catch (error) {
		console.error("[Scan] Cloud Functions Error:", error);
		const err = error as { code?: string; message?: string };
		if (err.code === "functions/resource-exhausted") {
			throw new Error(err.message ?? "Quota exceeded");
		}
		throw new Error("画像の解析に失敗しました。");
	}
}

// `fileToBase64` は現状の呼び出し経路からは未使用だが、
// 旧 `.js` 実装との API 互換性のため公開せずエクスポートもしない。
export { fileToBase64 };

