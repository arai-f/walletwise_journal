const functions = require("firebase-functions/v1");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { db, COLLECTIONS } = require("../shared/db");
const { authenticateApiKey } = require("../shared/auth");
const { analyzeReceiptCore, checkAndIncrementUsage } = require("../shared/ai");

/**
 * APIキーを使用してレシート画像を解析し、抽出した取引情報をFirestoreに保存するHTTP API。
 * AuthorizationヘッダーからAPIキーを検証し、ユーザー紐付けを行う。
 * @async
 * @param {functions.https.Request} req - HTTPリクエストオブジェクト。
 * @param {functions.Response} res - HTTPレスポンスオブジェクト。
 * @fires Firestore - transactions コレクションに一括保存する。
 * @returns {Promise<void>}
 */
exports.apiScanAndSaveReceipt = functions
	.region("asia-northeast1")
	.https.onRequest(async (req, res) => {
		// CORS対応
		res.set("Access-Control-Allow-Origin", "*");
		res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
		res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

		if (req.method === "OPTIONS") {
			res.status(204).send("");
			return;
		}

		if (req.method !== "POST") {
			res.status(405).json({ success: false, error: "Method Not Allowed" });
			return;
		}

		try {
			// 1. APIキー認証
			const userId = await authenticateApiKey(req);

			// 2. リクエストボディの展開と必須パラメータ検証
			const { base64Image, mimeType, todayStr, fromAccountId } = req.body || {};

			if (
				!base64Image ||
				typeof base64Image !== "string" ||
				base64Image.trim() === ""
			) {
				res.status(400).json({
					success: false,
					error: "base64Imageパラメータが欠落しているか、空です。",
				});
				return;
			}
			if (!mimeType || typeof mimeType !== "string" || mimeType.trim() === "") {
				res.status(400).json({
					success: false,
					error: "mimeTypeパラメータが欠落しているか、空です。",
				});
				return;
			}
			if (!todayStr || typeof todayStr !== "string" || todayStr.trim() === "") {
				res.status(400).json({
					success: false,
					error: "todayStrパラメータが欠落しているか、空です。",
				});
				return;
			}
			if (
				!fromAccountId ||
				typeof fromAccountId !== "string" ||
				fromAccountId.trim() === ""
			) {
				res.status(400).json({
					success: false,
					error: "fromAccountIdパラメータが欠落しているか、空です。",
				});
				return;
			}

			// YYYY-MM-DD形式の基本検証
			if (!/^\d{4}-\d{2}-\d{2}$/.test(todayStr)) {
				res.status(400).json({
					success: false,
					error: "todayStrはYYYY-MM-DD形式である必要があります。",
				});
				return;
			}

			// 3. 利用回数制限のチェック
			await checkAndIncrementUsage(
				userId,
				"aiScannerUsage",
				20,
				"本日のスキャン利用回数制限に達しました。",
			);

			// 4. AI解析コア関数を呼び出し
			let parsedData;
			try {
				parsedData = await analyzeReceiptCore(base64Image, mimeType, todayStr);
			} catch (aiError) {
				console.error("[API Scan] AI解析エラー:", aiError);
				res.status(500).json({
					success: false,
					error: `画像の解析に失敗しました: ${aiError.message}`,
				});
				return;
			}

			// 5. AI応答の配列検証
			if (!Array.isArray(parsedData)) {
				res.status(500).json({
					success: false,
					error: "AIの応答が配列形式ではありません。",
				});
				return;
			}

			// 6. ユーザーカテゴリ一覧を取得し、マッチング用のデータを構築
			const categoryDoc = await db
				.collection(COLLECTIONS.USER_CATEGORIES)
				.doc(userId)
				.get();

			const idToName = {};
			let firstCategoryId = null;
			let firstCategoryName = null;
			let minOrder = Infinity;

			const expenseCategories = [];
			const incomeCategories = [];

			if (categoryDoc.exists && categoryDoc.data().categories) {
				const categories = categoryDoc.data().categories;
				Object.entries(categories).forEach(([id, cat]) => {
					if (!cat.isDeleted && cat.name) {
						idToName[id] = cat.name;
						// orderが最小のカテゴリを記録（フォールバック用）
						if (cat.order !== undefined && cat.order < minOrder) {
							minOrder = cat.order;
							firstCategoryId = id;
							firstCategoryName = cat.name;
						}
						if (cat.type === "expense") {
							expenseCategories.push({ id, name: cat.name, order: cat.order });
						} else if (cat.type === "income") {
							incomeCategories.push({ id, name: cat.name, order: cat.order });
						}
					}
				});
			}

			// scanService.jsのfindBestCategoryMatch同理のヘルパー関数
			const findBestCategoryMatch = (categories, aiCategoryText) => {
				if (!aiCategoryText || !categories || categories.length === 0) {
					return categories.length > 0
						? categories[0].id
						: firstCategoryId || "";
				}
				const text = aiCategoryText.toLowerCase().trim();

				// 1. 大文字小文字を無視した完全一致
				const exactMatch = categories.find(
					(c) => c.name.toLowerCase() === text,
				);
				if (exactMatch) return exactMatch.id;

				// 2. 部分一致（AIテキストがカテゴリ名を含む、またはその逆）
				const partialMatch = categories.find(
					(c) =>
						c.name.toLowerCase().includes(text) ||
						text.includes(c.name.toLowerCase()),
				);
				if (partialMatch) return partialMatch.id;

				// 3. フォールバック
				return categories.length > 0 ? categories[0].id : firstCategoryId || "";
			};

			// スキャン設定を取得（excludeKeywords, categoryRules）
			const configDoc = await db
				.collection(COLLECTIONS.USER_CONFIGS)
				.doc(userId)
				.get();
			const scanSettings =
				configDoc.exists && configDoc.data().scanSettings
					? configDoc.data().scanSettings
					: {};
			const excludeKeywords = scanSettings.excludeKeywords || [];
			const categoryRules = scanSettings.categoryRules || [];

			// 7. Firestoreに一括保存（db.batch()を使用）
			if (parsedData.length === 0) {
				res.status(200).json({
					success: true,
					data: { count: 0, totalAmount: 0, items: [] },
				});
				return;
			}

			let batch = db.batch();
			let batchCount = 0;
			let totalAmount = 0;
			const savedItems = [];
			const BATCH_LIMIT = 500;

			for (const item of parsedData) {
				// 各アイテムの必須フィールド検証
				if (!item.date || !item.amount || !item.description || !item.type) {
					console.warn("[API Scan] 必須フィールド欠落:", item);
					continue;
				}

				const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
				const amount = Number(item.amount);
				if (isNaN(amount)) {
					console.warn("[API Scan] amountが数値ではありません:", item.amount);
					continue;
				}

				// scanService.jsのapplyScanSettings同理：除外キーワードチェック
				const description = item.description || "";
				if (
					excludeKeywords.length > 0 &&
					excludeKeywords.some((keyword) => description.includes(keyword))
				) {
					console.log("[API Scan] 除外キーワードに一致:", item.description);
					continue;
				}

				// scanService.js同理：カテゴリールールの適用
				const type = item.type === "income" ? "income" : "expense";
				const categories =
					type === "expense" ? expenseCategories : incomeCategories;
				let categoryId = "";
				const matchedRule = description
					? categoryRules.find((rule) => description.includes(rule.keyword))
					: null;

				if (matchedRule && idToName[matchedRule.categoryId]) {
					// categoryRulesに一致した場合はそのカテゴリを使用
					categoryId = matchedRule.categoryId;
				} else if (item.category) {
					// AIが推測したカテゴリテキストからマッチング
					categoryId = findBestCategoryMatch(categories, item.category);
				} else {
					// フォールバック：最初のカテゴリ
					categoryId =
						categories.length > 0 ? categories[0].id : firstCategoryId || "";
				}
				const categoryName =
					idToName[categoryId] || firstCategoryName || "未分類";

				// onTransactionWriteトリガーのスキーマと互換性のあるデータ構造
				// dateはstore.jsのtransactionConverterと同じ変換を行う（JST→UTC変換）
				const jstDate = new Date(item.date + "T00:00:00+09:00");
				const utcDate = new Date(jstDate.getTime() - 9 * 60 * 60 * 1000);
				const transactionData = {
					userId: userId,
					fromAccountId: fromAccountId,
					toAccountId: "",
					type: type,
					amount: amount,
					date: Timestamp.fromDate(utcDate),
					description: item.description,
					memo: "AIスキャンAPIによる自動登録",
					categoryId: categoryId,
					updatedAt: FieldValue.serverTimestamp(),
				};

				batch.set(transactionRef, transactionData);
				batchCount++;

				if (type === "expense") {
					totalAmount += amount;
				}

				savedItems.push({
					description: item.description,
					amount: amount,
					date: item.date,
					categoryId: categoryId,
					categoryName: categoryName,
				});

				// バッチが500件に達したらコミット
				if (batchCount === BATCH_LIMIT) {
					await batch.commit();
					batch = db.batch();
					batchCount = 0;
				}
			}

			if (batchCount > 0) {
				await batch.commit();
			}

			// 8. 成功レスポンスを返す
			res.status(200).json({
				success: true,
				data: {
					count: savedItems.length,
					totalAmount: totalAmount,
					items: savedItems,
				},
			});
		} catch (error) {
			// authenticateApiKeyからのエラーはステータスコードを持つ
			if (error.status === 401) {
				res.status(401).json({ success: false, error: error.message });
				return;
			}
			console.error("[API Scan] 予期しないエラー:", error);
			res.status(500).json({
				success: false,
				error: `サーバー内部エラー: ${error.message}`,
			});
		}
	});
