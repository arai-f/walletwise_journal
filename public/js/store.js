import { toDate, zonedTimeToUtc } from "https://esm.sh/date-fns-tz@2.0.1";
import {
	endOfDay,
	startOfMonth,
	subMonths,
} from "https://esm.sh/date-fns@2.30.0";
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { config as configTemplate } from "./config.js";
import { isLocalDevelopment } from "./firebase-config.js";
import { auth, db } from "./firebase.js";

/**
 * Firestoreのドキュメントをクライアントサイドで扱う取引オブジェクトに変換する。
 * @param {object} doc - Firestoreのドキュメントスナップショット。
 * @returns {object} 取引オブジェクト。idと、FirestoreのTimestampがJavaScriptのDateオブジェクトに変換されたdateプロパティを持つ。
 */
const convertDocToTransaction = (doc) => {
	const data = doc.data();
	return {
		id: doc.id,
		...data,
		// FirestoreのTimestampをJavaScriptのDateオブジェクトに変換する
		date: data.date.toDate(),
	};
};

/**
 * アプリケーションのグローバルな状態を保持するオブジェクト。
 * @type {object}
 */
let state = {};

let unsubscribeBalances = null;

/**
 * ログインユーザーの口座残高ドキュメントのリアルタイム更新を購読する。
 * ドキュメントが更新されるたびに、onUpdateコールバックが最新のデータで呼び出される。
 * @param {function} onUpdate - ドキュメントが更新された際に呼び出されるコールバック関数。
 */
export function subscribeAccountBalances(onUpdate) {
	if (!auth.currentUser) return;
	const userId = auth.currentUser.uid;

	// 既存のリスナーがあれば解除
	if (unsubscribeBalances) unsubscribeBalances();

	// account_balances/{userId} ドキュメントの変更を検知
	unsubscribeBalances = onSnapshot(
		doc(db, "account_balances", userId),
		(docSnap) => {
			if (docSnap.exists()) {
				onUpdate(docSnap.data());
			} else {
				onUpdate({});
			}
		}
	);
}

/**
 * ストアモジュールを初期化し、アプリケーションの状態オブジェクトへの参照を設定する。
 * @param {object} appState - アプリケーションのグローバルな状態オブジェクト。
 */
export function init(appState) {
	state = appState;
}

/**
 * ローカルのJSONデータを取得する。主にローカル開発用。
 * @async
 * @param {string} filePath - 読み込むJSONファイルのパス。
 * @returns {Promise<Array|object>} 成功した場合はJSONデータ、失敗した場合は空の配列。
 */
async function fetchLocalData(filePath) {
	try {
		const response = await fetch(filePath);
		if (!response.ok) {
			throw new Error(`${filePath}の読み込みエラー`);
		}
		return await response.json();
	} catch (error) {
		return [];
	}
}

function blockWriteInLocal() {
	// ローカル開発モードでは、データの保存・更新・削除はできない
	if (isLocalDevelopment) {
		alert("ローカル開発モードでは、データの保存・更新・削除はできません。");
		return true; // 処理をブロックする
	}
	return false;
}

// データ取得関数群
// ==========================================================================

/**
 * 新規ユーザー向けの初期データ（口座、カテゴリ、設定）を生成し、Firestoreに保存する。
 * config.jsのテンプレートを元にデータを作成する。
 * @async
 * @param {string} userId - ユーザーID。
 * @returns {Promise<object>} 生成された初期データを含むオブジェクト。
 * @property {object} accounts - 口座データ。
 * @property {object} categories - カテゴリデータ。
 * @property {object} config - 設定データ。
 * @fires Firestore - ユーザーデータ、残高データをバッチ書き込みする。
 */
async function createInitialUserData(userId) {
	const batch = writeBatch(db);
	const newAccounts = {};
	const newCategories = {};
	const initialBalances = {};

	// テンプレートから口座データを生成
	configTemplate.assets.forEach((name, index) => {
		// 資産
		const id = `acc_${Math.random().toString(36).substring(2, 12)}`;
		newAccounts[id] = {
			userId,
			name,
			type: "asset",
			order: index,
			isDeleted: false,
			icon: configTemplate.accountIcons[name] || "fa-solid fa-credit-card",
		};
		initialBalances[id] = 0;
	});
	configTemplate.liabilities.forEach((name, index) => {
		// 負債
		const id = `acc_${Math.random().toString(36).substring(2, 12)}`;
		newAccounts[id] = {
			userId,
			name,
			type: "liability",
			order: index,
			isDeleted: false,
			icon: configTemplate.accountIcons[name] || "fa-solid fa-credit-card",
		};
		initialBalances[id] = 0;
	});

	// テンプレートからカテゴリデータを生成
	configTemplate.incomeCategories.forEach((name, index) => {
		// 収入カテゴリ
		const id = `cat_${Math.random().toString(36).substring(2, 12)}`;
		newCategories[id] = {
			userId,
			name,
			type: "income",
			order: index,
			isDeleted: false,
		};
	});
	configTemplate.expenseCategories.forEach((name, index) => {
		// 支出カテゴリ
		const id = `cat_${Math.random().toString(36).substring(2, 12)}`;
		newCategories[id] = {
			userId,
			name,
			type: "expense",
			order: index,
			isDeleted: false,
		};
	});

	// テンプレートから設定データを生成
	const newConfig = {
		creditCardRules: configTemplate.creditCardRules,
		displayPeriod: 3,
	};

	// ローカル開発モードでは書き込みをスキップ
	if (blockWriteInLocal())
		return {
			accounts: newAccounts,
			categories: newCategories,
			config: newConfig,
		};

	// Firestoreにバッチ書き込み
	batch.set(doc(db, "user_accounts", userId), { accounts: newAccounts });
	batch.set(doc(db, "user_categories", userId), { categories: newCategories });
	batch.set(doc(db, "user_configs", userId), newConfig);
	batch.set(doc(db, "account_balances", userId), initialBalances);
	await batch.commit();

	return {
		accounts: newAccounts,
		categories: newCategories,
		config: newConfig,
	};
}

/**
 * ログインユーザーの全ての基本データ（口座、カテゴリ、設定）をFirestoreから取得する。
 * 新規ユーザーの場合は、初期データを生成して返す。
 * ローカル開発モードの場合は、ローカルのJSONファイルからデータを読み込む。
 * @async
 * @returns {Promise<object>} ユーザーデータを含むオブジェクト。
 * @property {object} accounts - 口座データ。
 * @property {object} categories - カテゴリデータ。
 * @property {object} config - 設定データ。
 * @fires Firestore - ユーザーの口座、カテゴリ、設定データを取得する。
 */
export async function fetchAllUserData() {
	// ローカル開発モード
	if (isLocalDevelopment) {
		const [accounts, categories, config] = await Promise.all([
			fetchLocalData("../local_data/user_accounts.json"),
			fetchLocalData("../local_data/user_categories.json"),
			fetchLocalData("../local_data/user_configs.json"),
		]);

		// configがなければ新規ユーザーとみなし、初期データを作成
		if (config.length === 0) {
			return await createInitialUserData(auth.currentUser.uid);
		} else {
			return { accounts, categories, config };
		}
	}

	// Firestoreから取得
	if (!auth.currentUser) return { accounts: {}, categories: {}, config: {} };
	const userId = auth.currentUser.uid;

	// 3つのドキュメントを並行して取得し、読み取り回数を削減
	const [accountsDoc, categoriesDoc, configDoc] = await Promise.all([
		getDoc(doc(db, "user_accounts", userId)),
		getDoc(doc(db, "user_categories", userId)),
		getDoc(doc(db, "user_configs", userId)),
	]);
	console.log(`[Firestore Read] ユーザーデータを取得`);

	// configドキュメントが存在しない場合は新規ユーザーと判断
	if (!configDoc.exists()) {
		console.log("新規ユーザーのため、初期設定を生成する。");
		return await createInitialUserData(userId);
	}

	// 既存ユーザーの場合は各ドキュメントのデータを返す
	return {
		accounts: accountsDoc.exists() ? accountsDoc.data().accounts : {},
		categories: categoriesDoc.exists() ? categoriesDoc.data().categories : {},
		config: configDoc.data(),
	};
}

/**
 * ログインユーザーの全口座の残高データをFirestoreから取得する。
 * ローカル開発モードの場合は、ローカルのJSONファイルからデータを読み込む。
 * @async
 * @returns {Promise<object|null>} 口座IDをキー、残高を値とするオブジェクト。データが存在しない場合はnull。
 * @fires Firestore - `account_balances`ドキュメントを取得する。
 */
export async function fetchAccountBalances() {
	if (isLocalDevelopment)
		return fetchLocalData("../local_data/account_balances.json");
	if (!auth.currentUser) return {};
	state.userId = auth.currentUser.uid;
	const docRef = doc(db, "account_balances", state.userId);
	const docSnap = await getDoc(docRef);
	if (docSnap.exists()) {
		console.log("[Firestore Read] 残高データを取得");
		return docSnap.data();
	} else {
		console.log("残高データが存在しない。");
		return null;
	}
}

/**
 * 指定された期間の取引データをFirestoreから取得する。
 * 日付は日本時間を基準としてクエリを実行する。
 * ローカル開発モードの場合は、ローカルのJSONファイルから全取引を読み込む。
 * @async
 * @param {number} months - 取得する期間（現在から過去Nヶ月分）。
 * @returns {Promise<Array<object>>} 取引オブジェクトの配列。日付の降順でソートされる。
 * @fires Firestore - `transactions`コレクションから指定期間のデータをクエリする。
 */
export async function fetchTransactionsForPeriod(months) {
	if (isLocalDevelopment) {
		let transactions = await fetchLocalData("../local_data/transactions.json");
		// ローカルデータ内のTimestampライクなオブジェクトをDateオブジェクトに変換
		return transactions
			.map((t) => ({
				...t,
				date: new Date(t.date.seconds * 1000 + t.date.nanoseconds / 1000000),
			}))
			.sort((a, b) => b.date.getTime() - a.date.getTime());
	}
	if (!auth.currentUser) return [];

	state.userId = auth.currentUser.uid;

	const timeZone = "Asia/Tokyo";
	// APIの仕様により、日付は日本時間基準で解釈し、UTCに変換してクエリする
	const nowInTokyo = toDate(new Date(), { timeZone });
	const endDate = endOfDay(nowInTokyo);
	const startDate = startOfMonth(subMonths(nowInTokyo, months));
	const startTimestamp = zonedTimeToUtc(startDate, timeZone);
	const endTimestamp = zonedTimeToUtc(endDate, timeZone);

	const q = query(
		collection(db, "transactions"),
		where("userId", "==", state.userId),
		where("date", ">=", startTimestamp),
		where("date", "<=", endTimestamp),
		orderBy("date", "desc"),
		orderBy("updatedAt", "desc")
	);
	const querySnapshot = await getDocs(q);
	console.log(
		`[Firestore Read] ${months}ヶ月分の取引を取得: ${querySnapshot.size} 件`
	);
	return querySnapshot.docs.map(convertDocToTransaction);
}

/**
 * 指定された年の取引データをFirestoreから取得する。
 * 日付は日本時間を基準としてクエリを実行する。
 * ローカル開発モードの場合は、ローカルのJSONファイルから全取引を読み込み、JS側でフィルタリングする。
 * @async
 * @param {number} year - 取得する年（西暦4桁）。
 * @returns {Promise<Array<object>>} 取引オブジェクトの配列。日付の降順でソートされる。
 * @fires Firestore - `transactions`コレクションから指定年のデータをクエリする。
 */
export async function fetchTransactionsByYear(year) {
	if (isLocalDevelopment) {
		// ローカルの場合は全データを読んでJS側でフィルタリング
		const all = await fetchLocalData("../local_data/transactions.json");
		// 日付変換などが必要なため簡易実装
		return all
			.filter((t) => {
				const d = new Date(t.date.seconds ? t.date.seconds * 1000 : t.date);
				return d.getFullYear() === year;
			})
			.map((t) => ({
				...t,
				date: new Date(t.date.seconds ? t.date.seconds * 1000 : t.date),
			}));
	}

	if (!auth.currentUser) return [];
	const userId = auth.currentUser.uid;
	const timeZone = "Asia/Tokyo";

	// 指定年の1月1日 00:00:00
	const startDate = new Date(year, 0, 1);
	// 指定年の12月31日 23:59:59
	const endDate = new Date(year, 11, 31, 23, 59, 59);

	const startTimestamp = zonedTimeToUtc(startDate, timeZone);
	const endTimestamp = zonedTimeToUtc(endDate, timeZone);

	const q = query(
		collection(db, "transactions"),
		where("userId", "==", userId),
		where("date", ">=", startTimestamp),
		where("date", "<=", endTimestamp),
		orderBy("date", "desc")
	);

	const querySnapshot = await getDocs(q);
	return querySnapshot.docs.map(convertDocToTransaction);
}

// 書き込み系関数群（ローカル開発モードではブロック）
// ==========================================================================

/**
 * 新規または既存の取引データを保存し、関連する口座残高を更新する。
 * 日付は日本時間として解釈され、UTCのタイムスタンプとしてFirestoreに保存される。
 * @async
 * @param {object} data - 保存する取引データ。idが含まれていれば編集、なければ新規作成。
 * @param {object|null} [oldTransaction=null] - 編集前の取引データ。残高計算に必要。
 * @returns {Promise<void>}
 * @fires Firestore - `transactions`コレクションへの書き込みと、`account_balances`ドキュメントの更新を行う。
 */
export async function saveTransaction(data, oldTransaction = null) {
	// 入力データの基本的な検証
	validateTransaction(data);

	if (blockWriteInLocal()) return;

	const id = data.id;
	// dataオブジェクトを直接操作すると呼び出し元に影響が出る可能性があるため、コピーを作成
	const dataToSave = { ...data };
	delete dataToSave.id;

	const transactionData = {
		...data,
		userId: auth.currentUser.uid,
		// APIの仕様により、日付文字列を日本時間として解釈し、UTCタイムスタンプに変換して保存
		date: Timestamp.fromDate(zonedTimeToUtc(data.date, "Asia/Tokyo")),
		amount: Number(data.amount),
		updatedAt: serverTimestamp(),
	};

	if (id) {
		// --- 編集モード ---
		const docRef = doc(db, "transactions", id);
		await setDoc(docRef, transactionData, { merge: true });
	} else {
		// --- 新規追加モード ---
		await addDoc(collection(db, "transactions"), transactionData);
	}
}

/**
 * 指定された取引を削除し、関連する口座残高を更新する。
 * @async
 * @param {object} transaction - 削除する取引オブジェクト。
 * @returns {Promise<void>}
 * @fires Firestore - `transactions`ドキュメントの削除と、`account_balances`ドキュメントの更新を行う。
 */
export async function deleteTransaction(transaction) {
	if (blockWriteInLocal()) return;

	await deleteDoc(doc(db, "transactions", transaction.id));
}

/**
 * 新しい項目（口座またはカテゴリ）をFirestoreに追加する。
 * データはユーザーごとのマップフィールドに格納される。
 * @async
 * @param {object} itemData - 追加する項目のデータ。
 * @param {string} itemData.type - 項目の種類（'asset', 'liability', 'income', 'expense'）。
 * @param {string} itemData.name - 項目の名前。
 * @param {number} itemData.order - 項目の表示順。
 * @returns {Promise<void>}
 * @fires Firestore - `user_accounts`または`user_categories`ドキュメントを更新する。
 */
export async function addItem({ type, name, order }) {
	if (blockWriteInLocal()) return;
	const isAccount = type === "asset" || type === "liability";
	const collectionName = isAccount ? "user_accounts" : "user_categories";
	const mapFieldName = isAccount ? "accounts" : "categories";
	const prefix = isAccount ? "acc_" : "cat_";

	const newId = `${prefix}${Math.random().toString(36).substring(2, 12)}`;
	const docRef = doc(db, collectionName, auth.currentUser.uid);

	const newData = {
		userId: auth.currentUser.uid,
		name,
		type,
		isDeleted: false,
		order,
	};

	// ドット記法を使い、マップフィールドに新しいキーと値を追加する
	await updateDoc(docRef, { [`${mapFieldName}.${newId}`]: newData });
}

/**
 * 既存の項目（口座またはカテゴリ）の情報を更新する。
 * @async
 * @param {string} itemId - 更新する項目のID。
 * @param {string} itemType - 項目の種類（'account' または 'category'）。
 * @param {object} updateData - 更新するデータを含むオブジェクト。
 * @returns {Promise<void>}
 * @fires Firestore - `user_accounts`または`user_categories`ドキュメントを更新する。
 */
export async function updateItem(itemId, itemType, updateData) {
	if (blockWriteInLocal()) return;
	const collectionName =
		itemType === "account" ? "user_accounts" : "user_categories";
	const mapFieldName = itemType === "account" ? "accounts" : "categories";
	const docRef = doc(db, collectionName, auth.currentUser.uid);

	// ドット記法を使い、更新対象のフィールドだけを効率的に更新する
	const updates = {};
	for (const key in updateData) {
		updates[`${mapFieldName}.${itemId}.${key}`] = updateData[key];
	}
	await updateDoc(docRef, updates);
}

/**
 * 項目（口座またはカテゴリ）を論理削除する（isDeletedフラグをtrueに設定）。
 * @async
 * @param {string} itemId - 論理削除する項目のID。
 * @param {string} itemType - 項目の種類（'account' または 'category'）。
 * @returns {Promise<void>}
 * @fires Firestore - `user_accounts`または`user_categories`ドキュメントを更新する。
 */
export async function deleteItem(itemId, itemType) {
	if (blockWriteInLocal()) return;
	// isDeletedフラグを立てる（updateItemを再利用）
	await updateItem(itemId, itemType, { isDeleted: true });
}

/**
 * 特定のカテゴリに紐づく全ての取引を、別のカテゴリに一括で付け替える。
 * @async
 * @param {string} fromCatId - 付け替え元のカテゴリID。
 * @param {string} toCatId - 付け替え先のカテゴリID。
 * @returns {Promise<void>}
 * @fires Firestore - 関連する`transactions`ドキュメントをバッチ更新する。
 */
export async function remapTransactions(fromCatId, toCatId) {
	if (blockWriteInLocal()) return;

	const q = query(
		collection(db, "transactions"),
		where("userId", "==", auth.currentUser.uid),
		where("categoryId", "==", fromCatId)
	);
	const querySnapshot = await getDocs(q);

	if (querySnapshot.empty) return;

	const batch = writeBatch(db);
	querySnapshot.forEach((docSnap) => {
		batch.update(doc(db, "transactions", docSnap.id), { categoryId: toCatId });
	});
	await batch.commit();
}

/**
 * クレジットカードの特定の締め日サイクルを「支払い済み」としてマークする。
 * ユーザー設定情報に最終支払いサイクル日を記録する。
 * @async
 * @param {string} cardId - 対象のクレジットカードの口座ID。
 * @param {string} closingDateStr - 支払い済みとしてマークする締め日の文字列 (YYYY-MM-DD)。
 * @param {object} creditCardRules - 現在のクレジットカード設定ルール。
 * @returns {Promise<void>}
 * @fires Firestore - `user_configs`ドキュメントを更新する。
 */
export async function markBillCycleAsPaid(
	cardId,
	closingDateStr,
	creditCardRules
) {
	if (blockWriteInLocal()) return;
	const userId = auth.currentUser.uid;
	const configRef = doc(db, "user_configs", userId);
	const existingPaidCycleStr = creditCardRules[cardId]?.lastPaidCycle;

	// 新しい日付が、既存の日付より後である場合のみ更新する
	if (!existingPaidCycleStr || closingDateStr > existingPaidCycleStr) {
		const fieldPath = `creditCardRules.${cardId}.lastPaidCycle`;
		await updateDoc(configRef, { [fieldPath]: closingDateStr });
	}
}

/**
 * 口座の表示順序を更新する。
 * @async
 * @param {Array<string>} orderedIds - 新しい順序に並べ替えられた口座IDの配列。
 * @returns {Promise<void>}
 * @fires Firestore - `user_accounts`ドキュメントの各口座のorderプロパティを更新する。
 */
export async function updateAccountOrder(orderedIds) {
	if (blockWriteInLocal()) return;
	const docRef = doc(db, "user_accounts", auth.currentUser.uid);
	const updates = {};
	orderedIds.forEach((id, index) => {
		updates[`accounts.${id}.order`] = index;
	});
	await updateDoc(docRef, updates);
}

/**
 * カテゴリの表示順序を更新する。
 * @async
 * @param {Array<string>} orderedIds - 新しい順序に並べ替えられたカテゴリIDの配列。
 * @returns {Promise<void>}
 * @fires Firestore - `user_categories`ドキュメントの各カテゴリのorderプロパティを更新する。
 */
export async function updateCategoryOrder(orderedIds) {
	if (blockWriteInLocal()) return;
	const docRef = doc(db, "user_categories", auth.currentUser.uid);
	const updates = {};
	orderedIds.forEach((id, index) => {
		updates[`categories.${id}.order`] = index;
	});
	await updateDoc(docRef, updates);
}

/**
 * ユーザーの設定情報を更新する。
 * @async
 * @param {object} updateData - 更新する設定データ。
 * @returns {Promise<void>}
 * @fires Firestore - `user_configs`ドキュメントをマージ更新する。
 */
export async function updateUserConfig(updateData) {
	if (blockWriteInLocal()) return;

	const userId = auth.currentUser.uid;
	const docRef = doc(db, "user_configs", userId);
	await setDoc(docRef, updateData, { merge: true });
}

// ヘルパー関数群
// ==========================================================================

/**
 * 取引データの論理的整合性を検証する。
 * Firestoreのセキュリティルールに準拠しつつ、アプリケーション固有の矛盾もチェックする。
 * @param {object} data - 検証対象の取引データ
 * @throws {Error} 検証に失敗した場合、エラーメッセージを投げる
 */
function validateTransaction(data) {
	// 1. 金額のチェック (DBルール: amount > 0)
	if (
		typeof data.amount !== "number" ||
		isNaN(data.amount) ||
		data.amount <= 0
	) {
		throw new Error("金額は0より大きい数値を入力してください。");
	}

	// 2. 日付のチェック (DBルール: timestamp)
	if (!data.date) {
		throw new Error("日付を指定してください。");
	}
	const dateObj = new Date(data.date);
	if (isNaN(dateObj.getTime())) {
		throw new Error("有効な日付形式ではありません。");
	}

	// 3. 取引種別のチェック (DBルール: type in ['expense', 'income', 'transfer'])
	if (!["expense", "income", "transfer"].includes(data.type)) {
		throw new Error("無効な取引種別です。");
	}

	// 4. 種別ごとの必須項目と論理整合性のチェック
	if (data.type === "transfer") {
		// 振替の場合
		if (!data.fromAccountId || typeof data.fromAccountId !== "string") {
			throw new Error("振替元口座を指定してください。");
		}
		if (!data.toAccountId || typeof data.toAccountId !== "string") {
			throw new Error("振替先口座を指定してください。");
		}
		// 【論理整合性】振替元と先が同じであってはならない
		if (data.fromAccountId === data.toAccountId) {
			throw new Error("振替元と振替先には異なる口座を指定してください。");
		}
	} else {
		// 支出・収入の場合
		if (!data.accountId || typeof data.accountId !== "string") {
			throw new Error("口座を指定してください。");
		}
		if (!data.categoryId || typeof data.categoryId !== "string") {
			throw new Error("カテゴリを指定してください。");
		}
	}
}

/**
 * 取引リストの中から指定されたIDの取引オブジェクトを取得する。
 * @param {string} id - 検索する取引のID。
 * @param {Array<object>} transactionsList - 検索対象の取引オブジェクトの配列。
 * @returns {object|undefined} 見つかった取引オブジェクト。見つからない場合はundefined。
 */
export function getTransactionById(id, transactionsList) {
	return transactionsList.find((t) => t.id === id);
}
