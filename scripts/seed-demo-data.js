/**
 * WalletWise Journal - デモ用テストデータシードスクリプト
 *
 * エミュレータ上のテストユーザー (test@example.com) に対して、
 * 魅力的なダッシュボード、グラフ、クレカ請求、分析レポートを描画できる
 * リアルな12ヶ月分の家計簿データを一括投入します。
 */

const path = require("path");

process.env.FIRESTORE_EMULATOR_HOST =
	process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST =
	process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

const admin = require(
	path.join(__dirname, "../functions/node_modules/firebase-admin"),
);

if (!admin.apps.length) {
	admin.initializeApp({
		projectId: "walletwise-abc97",
	});
}

const db = admin.firestore();

// accounts.json の test@example.com の UID
const DEMO_USER_ID = "Xeszm7eLSRojgEeZHL280Z4uM4na";

// 口座定義
const ACCOUNTS = {
	acc_cash: {
		userId: DEMO_USER_ID,
		name: "現金 (お財布)",
		type: "asset",
		order: 0,
		isDeleted: false,
		icon: "fa-solid fa-wallet",
	},
	acc_mufg: {
		userId: DEMO_USER_ID,
		name: "三菱UFJ銀行 (給与口座)",
		type: "asset",
		order: 1,
		isDeleted: false,
		icon: "fa-solid fa-landmark",
	},
	acc_rakuten_bank: {
		userId: DEMO_USER_ID,
		name: "楽天銀行 (貯蓄・投資)",
		type: "asset",
		order: 2,
		isDeleted: false,
		icon: "fa-solid fa-piggy-bank",
	},
	acc_paypay: {
		userId: DEMO_USER_ID,
		name: "PayPay残高",
		type: "asset",
		order: 3,
		isDeleted: false,
		icon: "fa-solid fa-store",
	},
	acc_rakuten_card: {
		userId: DEMO_USER_ID,
		name: "楽天カード",
		type: "liability",
		order: 4,
		isDeleted: false,
		icon: "fa-solid fa-credit-card",
	},
	acc_smbc_card: {
		userId: DEMO_USER_ID,
		name: "三井住友カード (NL)",
		type: "liability",
		order: 5,
		isDeleted: false,
		icon: "fa-brands fa-cc-visa",
	},
};

// カテゴリ定義
const CATEGORIES = {
	// 収入
	cat_salary: {
		userId: DEMO_USER_ID,
		name: "給与",
		type: "income",
		order: 0,
		isDeleted: false,
	},
	cat_bonus: {
		userId: DEMO_USER_ID,
		name: "賞与",
		type: "income",
		order: 1,
		isDeleted: false,
	},
	cat_side: {
		userId: DEMO_USER_ID,
		name: "副業",
		type: "income",
		order: 2,
		isDeleted: false,
	},
	cat_extra_inc: {
		userId: DEMO_USER_ID,
		name: "その他収入",
		type: "income",
		order: 3,
		isDeleted: false,
	},

	// 支出
	cat_food: {
		userId: DEMO_USER_ID,
		name: "食費",
		type: "expense",
		order: 0,
		isDeleted: false,
	},
	cat_daily: {
		userId: DEMO_USER_ID,
		name: "日用品",
		type: "expense",
		order: 1,
		isDeleted: false,
	},
	cat_housing: {
		userId: DEMO_USER_ID,
		name: "家賃",
		type: "expense",
		order: 2,
		isDeleted: false,
	},
	cat_utilities: {
		userId: DEMO_USER_ID,
		name: "水道・光熱費",
		type: "expense",
		order: 3,
		isDeleted: false,
	},
	cat_comm: {
		userId: DEMO_USER_ID,
		name: "通信費",
		type: "expense",
		order: 4,
		isDeleted: false,
	},
	cat_transport: {
		userId: DEMO_USER_ID,
		name: "交通費",
		type: "expense",
		order: 5,
		isDeleted: false,
	},
	cat_entertainment: {
		userId: DEMO_USER_ID,
		name: "趣味・娯楽",
		type: "expense",
		order: 6,
		isDeleted: false,
	},
	cat_social: {
		userId: DEMO_USER_ID,
		name: "交際費",
		type: "expense",
		order: 7,
		isDeleted: false,
	},
	cat_beauty: {
		userId: DEMO_USER_ID,
		name: "衣服・美容",
		type: "expense",
		order: 8,
		isDeleted: false,
	},
	cat_medical: {
		userId: DEMO_USER_ID,
		name: "健康・医療",
		type: "expense",
		order: 9,
		isDeleted: false,
	},
	cat_special: {
		userId: DEMO_USER_ID,
		name: "特別な支出",
		type: "expense",
		order: 10,
		isDeleted: false,
	},
};

// ユーザー設定定義
const CONFIG = {
	creditCardRules: {
		acc_rakuten_card: {
			closingDay: 27,
			paymentDay: 27,
			paymentMonthOffset: 1,
			defaultPaymentAccountId: "acc_mufg",
		},
		acc_smbc_card: {
			closingDay: 15,
			paymentDay: 10,
			paymentMonthOffset: 1,
			defaultPaymentAccountId: "acc_mufg",
		},
	},
	general: {
		displayPeriod: 6,
		enableAiAdvisor: true,
	},
	terms: {
		agreedVersion: "1.1.0",
	},
	guide: {
		lastSeenVersion: "1.7.1",
	},
};

// 初期残高（12ヶ月前の開始時点）
const INITIAL_BALANCES = {
	acc_cash: 30000,
	acc_mufg: 750000,
	acc_rakuten_bank: 1200000,
	acc_paypay: 8500,
	acc_rakuten_card: 0,
	acc_smbc_card: 0,
};

async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedData() {
	console.log(`[Seed] ターゲットユーザー: ${DEMO_USER_ID}`);
	console.log(
		`[Seed] Firestoreエミュレータ: ${process.env.FIRESTORE_EMULATOR_HOST}`,
	);

	// 1. 口座、カテゴリ、設定の書き込み
	const batch1 = db.batch();
	batch1.set(db.collection("user_accounts").doc(DEMO_USER_ID), {
		accounts: ACCOUNTS,
	});
	batch1.set(db.collection("user_categories").doc(DEMO_USER_ID), {
		categories: CATEGORIES,
	});
	batch1.set(db.collection("user_configs").doc(DEMO_USER_ID), CONFIG);
	await batch1.commit();
	console.log("[Seed] 口座・カテゴリ・ユーザー設定を登録完了");

	// 2. 既存の取引データを削除
	console.log("[Seed] 既存の取引データを検索中...");
	const existingSnap = await db
		.collection("transactions")
		.where("userId", "==", DEMO_USER_ID)
		.get();

	if (!existingSnap.empty) {
		console.log(`[Seed] 既存取引 ${existingSnap.size} 件を削除中...`);
		const docs = existingSnap.docs;
		for (let i = 0; i < docs.length; i += 400) {
			const delBatch = db.batch();
			docs.slice(i, i + 400).forEach((d) => delBatch.delete(d.ref));
			await delBatch.commit();
		}
		console.log("[Seed] 既存取引の削除完了");
		await sleep(1000);
	}

	// 3. 12ヶ月分のリアルな取引データを生成
	const balances = { ...INITIAL_BALANCES };
	const transactions = [];

	// クレジットカードの締めサイクルごとの利用合計を追跡
	const cycleSpend = {
		acc_rakuten_card: {},
		acc_smbc_card: {},
	};

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth(); // 0-indexed

	// 11ヶ月前から今月まで
	for (let offset = 11; offset >= 0; offset--) {
		const targetDate = new Date(currentYear, currentMonth - offset, 1);
		const year = targetDate.getFullYear();
		const month = targetDate.getMonth(); // 0-indexed (0 = 1月)

		const isCurrentMonth = offset === 0;
		const maxDayInMonth = isCurrentMonth
			? Math.min(now.getDate(), 28)
			: new Date(year, month + 1, 0).getDate();

		const addTx = (
			d,
			type,
			amount,
			fromAcc,
			toAcc,
			catId,
			desc,
			memo,
			metadata,
		) => {
			if (d > maxDayInMonth) return;
			const txDate = new Date(year, month, d, 12, 0, 0);
			const tx = {
				userId: DEMO_USER_ID,
				type,
				amount: Math.round(amount),
				date: admin.firestore.Timestamp.fromDate(txDate),
				fromAccountId: fromAcc,
				description: desc,
				memo: memo || "",
				categoryId: catId || "",
				balanceSource: "client",
				updatedAt: admin.firestore.Timestamp.fromDate(txDate),
			};
			if (toAcc) tx.toAccountId = toAcc;
			if (metadata) tx.metadata = metadata;

			transactions.push(tx);

			// 残高計算
			if (type === "income") {
				balances[fromAcc] += tx.amount;
			} else if (type === "expense") {
				balances[fromAcc] -= tx.amount;

				// カード利用額の追跡
				if (fromAcc === "acc_rakuten_card") {
					const closingMonth = d <= 27 ? month : month + 1;
					const closingYear = closingMonth > 11 ? year + 1 : year;
					const normMonth = (closingMonth % 12) + 1;
					const closingKey = `${closingYear}-${String(normMonth).padStart(2, "0")}-27`;
					cycleSpend.acc_rakuten_card[closingKey] =
						(cycleSpend.acc_rakuten_card[closingKey] || 0) + tx.amount;
				} else if (fromAcc === "acc_smbc_card") {
					const closingMonth = d <= 15 ? month : month + 1;
					const closingYear = closingMonth > 11 ? year + 1 : year;
					const normMonth = (closingMonth % 12) + 1;
					const closingKey = `${closingYear}-${String(normMonth).padStart(2, "0")}-15`;
					cycleSpend.acc_smbc_card[closingKey] =
						(cycleSpend.acc_smbc_card[closingKey] || 0) + tx.amount;
				}
			} else if (type === "transfer") {
				balances[fromAcc] -= tx.amount;
				balances[toAcc] += tx.amount;
			}
		};

		// --- 毎月の定例取引 ---

		// 給与振込 (毎月25日)
		const salary = 360000 + (month % 2 === 0 ? 5000 : -3000);
		addTx(
			25,
			"income",
			salary,
			"acc_mufg",
			null,
			"cat_salary",
			"給与振込 株式会社サイバーテクノロジー",
			"手取り給与 (基本給+残業手当)",
		);

		// 夏・冬の賞与 (6月、12月)
		if (month === 5) {
			addTx(
				10,
				"income",
				680000,
				"acc_mufg",
				null,
				"cat_bonus",
				"夏季賞与振込",
				"2026年夏季賞与",
			);
		} else if (month === 11) {
			addTx(
				10,
				"income",
				720000,
				"acc_mufg",
				null,
				"cat_bonus",
				"冬季賞与振込",
				"2025年冬季賞与",
			);
		}

		// 副業・技術顧問料 (毎月10日: 月の前半でも収入がある状態にする)
		addTx(
			10,
			"income",
			55000,
			"acc_mufg",
			null,
			"cat_side",
			"副業・技術顧問料",
			"開発コンサルティング報酬",
		);

		// 毎月の自動貯金・積立投資 (26日: MUFG -> 楽天銀行)
		addTx(
			26,
			"transfer",
			50000,
			"acc_mufg",
			"acc_rakuten_bank",
			null,
			"定期自動振替 (貯蓄積立)",
			"インデックス投資・貯蓄用",
		);

		// 家賃引き落とし (27日)
		addTx(
			27,
			"expense",
			88000,
			"acc_mufg",
			null,
			"cat_housing",
			"家賃引き落とし (グランドパークレジデンス)",
			"賃貸料 (共益費込み)",
		);

		// 光熱費 (電気・ガス・水道)
		const elecAmount = [0, 1, 6, 7].includes(month) ? 10800 : 7600;
		const gasAmount = [0, 1, 2, 11].includes(month) ? 6200 : 3800;
		addTx(
			20,
			"expense",
			elecAmount,
			"acc_rakuten_card",
			null,
			"cat_utilities",
			"東京電力エナジーパートナー",
			"電気料金自動決済",
		);
		addTx(
			22,
			"expense",
			gasAmount,
			"acc_rakuten_card",
			null,
			"cat_utilities",
			"東京ガス",
			"都市ガス料金",
		);
		if (month % 2 === 0) {
			addTx(
				24,
				"expense",
				3740,
				"acc_mufg",
				null,
				"cat_utilities",
				"東京都水道局",
				"水道料金 (2ヶ月分)",
			);
		}

		// 通信費・サブスク
		addTx(
			18,
			"expense",
			6480,
			"acc_rakuten_card",
			null,
			"cat_comm",
			"NTTドコモ / ahamo・光回線",
			"携帯・自宅光回線合算",
		);
		addTx(
			15,
			"expense",
			1490,
			"acc_rakuten_card",
			null,
			"cat_entertainment",
			"Netflix スタンダードプラン",
			"月額サブスクリプション",
		);
		addTx(
			28,
			"expense",
			980,
			"acc_rakuten_card",
			null,
			"cat_entertainment",
			"Spotify Premium",
			"音楽サブスク",
		);

		// 現金引き出し (ATM) & PayPayチャージ
		addTx(
			5,
			"transfer",
			20000,
			"acc_mufg",
			"acc_cash",
			null,
			"ATM現金引き出し (セブン銀行)",
			"お財布補充",
		);
		addTx(
			8,
			"transfer",
			15000,
			"acc_mufg",
			"acc_paypay",
			null,
			"PayPay銀行口座チャージ",
			"QR決済チャージ",
		);

		// 現金での支払い
		addTx(
			6,
			"expense",
			2800,
			"acc_cash",
			null,
			"cat_food",
			"ブーランジェリー 天然酵母パン",
			"週末朝食用パン",
		);
		addTx(
			13,
			"expense",
			3200,
			"acc_cash",
			null,
			"cat_daily",
			"白洋舎 クリーニング代",
			"スーツ・ワイシャツ",
		);
		addTx(
			21,
			"expense",
			1850,
			"acc_cash",
			null,
			"cat_medical",
			"内科クリニック 診察・処方箋",
			"定期健診・目薬",
		);

		// 食費（スーパー、買い出し、週末まとめ買い）
		addTx(
			3,
			"expense",
			4820,
			"acc_rakuten_card",
			null,
			"cat_food",
			"ライフ セントラルスクエア",
			"週末食材まとめ買い",
		);
		addTx(
			9,
			"expense",
			3650,
			"acc_rakuten_card",
			null,
			"cat_food",
			"オーケー 新鮮食材・飲料",
			"平日自炊用",
		);
		addTx(
			16,
			"expense",
			5120,
			"acc_rakuten_card",
			null,
			"cat_food",
			"成城石井 特選惣菜・ワイン",
			"週末ディナー食材",
		);
		addTx(
			23,
			"expense",
			4200,
			"acc_rakuten_card",
			null,
			"cat_food",
			"イトーヨーカドー 食料品",
			"調味料・常備菜",
		);

		// ランチ・カフェ・コンビニ (PayPay中心)
		addTx(
			4,
			"expense",
			1280,
			"acc_paypay",
			null,
			"cat_food",
			"大戸屋 鶏と野菜の黒酢あん定食",
			"平日ランチ",
		);
		addTx(
			7,
			"expense",
			680,
			"acc_paypay",
			null,
			"cat_food",
			"スターバックス カフェラテ",
			"作業用カフェ",
		);
		addTx(
			11,
			"expense",
			740,
			"acc_paypay",
			null,
			"cat_food",
			"セブン-イレブン サンドイッチ・お茶",
			"コンビニ昼食",
		);
		addTx(
			14,
			"expense",
			920,
			"acc_paypay",
			null,
			"cat_food",
			"丸亀製麺 かけうどん＆季節天ぷら",
			"ランチ",
		);
		addTx(
			19,
			"expense",
			1450,
			"acc_paypay",
			null,
			"cat_food",
			"スープストックトーキョー セット",
			"休日ランチ",
		);
		addTx(
			22,
			"expense",
			1100,
			"acc_paypay",
			null,
			"cat_food",
			"すき家 牛丼ランチセット",
			"昼食",
		);

		// 日用品 (Amazon, マツキヨ, 無印)
		addTx(
			6,
			"expense",
			3280,
			"acc_rakuten_card",
			null,
			"cat_daily",
			"Amazon.co.jp 日用品定期便",
			"洗剤・シャンプー・ペーパー類",
		);
		addTx(
			17,
			"expense",
			2450,
			"acc_rakuten_card",
			null,
			"cat_daily",
			"マツモトキヨシ スキンケア・日用品",
			"薬・衛生用品",
		);

		// 交通費 (モバイルSuica)
		addTx(
			2,
			"expense",
			5000,
			"acc_smbc_card",
			null,
			"cat_transport",
			"モバイルSuica チャージ",
			"通勤・移動交通費",
		);
		addTx(
			18,
			"expense",
			5000,
			"acc_smbc_card",
			null,
			"cat_transport",
			"モバイルSuica チャージ",
			"おでかけ交通費",
		);

		// 交際費・外食 (三井住友カード)
		addTx(
			12,
			"expense",
			6500,
			"acc_smbc_card",
			null,
			"cat_social",
			"恵比寿 イタリアン 友人会食",
			"ディナーコース",
		);
		addTx(
			26,
			"expense",
			4800,
			"acc_smbc_card",
			null,
			"cat_social",
			"新宿 居酒屋同僚飲み会",
			"懇親会",
		);

		// 衣服・美容 (隔月〜)
		if (month % 2 === 1) {
			addTx(
				10,
				"expense",
				9800,
				"acc_rakuten_card",
				null,
				"cat_beauty",
				"美容室 カット＆ヘッドスパ",
				"ヘアメンテナンス",
			);
		}

		// クレジットカード引き落とし振替 (過去月の分)
		if (offset >= 1) {
			const prevMonthDate = new Date(year, month - 1, 1);
			const prevY = prevMonthDate.getFullYear();
			const prevM = prevMonthDate.getMonth() + 1;
			const rakutenPrevClosingKey = `${prevY}-${String(prevM).padStart(2, "0")}-27`;
			const rakutenBillAmount =
				cycleSpend.acc_rakuten_card[rakutenPrevClosingKey];

			if (rakutenBillAmount && rakutenBillAmount > 0) {
				addTx(
					27,
					"transfer",
					rakutenBillAmount,
					"acc_mufg",
					"acc_rakuten_card",
					null,
					"楽天カード 引き落とし決済",
					`${prevM}月確定請求分振替`,
					{
						paymentTargetCardId: "acc_rakuten_card",
						paymentTargetClosingDate: rakutenPrevClosingKey,
					},
				);
			}

			const smbcPrevClosingKey = `${prevY}-${String(prevM).padStart(2, "0")}-15`;
			const smbcBillAmount = cycleSpend.acc_smbc_card[smbcPrevClosingKey];

			if (smbcBillAmount && smbcBillAmount > 0) {
				addTx(
					10,
					"transfer",
					smbcBillAmount,
					"acc_mufg",
					"acc_smbc_card",
					null,
					"三井住友カード 引き落とし決済",
					`${prevM}月確定請求分振替`,
					{
						paymentTargetCardId: "acc_smbc_card",
						paymentTargetClosingDate: smbcPrevClosingKey,
					},
				);
			}
		}
	}

	console.log(
		`[Seed] 合計 ${transactions.length} 件の取引データを生成しました。`,
	);

	// 4. transactions コレクションへバッチ一括書き込み
	const chunkSize = 400;
	for (let i = 0; i < transactions.length; i += chunkSize) {
		const chunk = transactions.slice(i, i + chunkSize);
		const batch = db.batch();
		chunk.forEach((tx) => {
			const docRef = db.collection("transactions").doc();
			batch.set(docRef, tx);
		});
		await batch.commit();
		console.log(
			`[Seed] 取引データ書き込み進捗: ${Math.min(i + chunkSize, transactions.length)} / ${transactions.length}`,
		);
	}

	// Cloud Functionsのトリガー実行が落ち着くまで少し待機
	await sleep(1500);

	// 5. 計算された最終口座残高を account_balances/{DEMO_USER_ID} に保存
	console.log("[Seed] 計算された最終口座残高:", balances);
	await db.collection("account_balances").doc(DEMO_USER_ID).set(balances);
	console.log("[Seed] 口座残高を正常に同期しました。");

	console.log("\n==================================================");
	console.log("🎉 デモ用テストデータのシードが正常に完了しました！");
	console.log("==================================================");
}

seedData().catch((err) => {
	console.error("[Seed] エラーが発生しました:", err);
	process.exit(1);
});
