import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	limit,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
} from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { config as configTemplate } from "./config.js";
import { auth, db, messaging, vapidKey } from "./firebase.js";
import {
	getEndOfYear,
	getStartOfMonthAgo,
	getStartOfYear,
	SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID,
	toUtcDate,
	toYYYYMM,
} from "./utils.js";

/**
 * Firestoreのドキュメントをクライアントサイドで扱う取引オブジェクトに変換する。
 * FirestoreのTimestamp型は扱いづらいため、標準のDateオブジェクトに変換して返す。
 * @param {object} doc - Firestoreのドキュメントスナップショット。
 * @returns {object} 取引オブジェクト。`date` プロパティは JavaScript の Date オブジェクトに変換される。
 */
const convertDocToTransaction = (doc) => {
	const data = doc.data();
	return {
		id: doc.id,
		...data,
		// FirestoreのTimestampをJavaScriptのDateオブジェクトに変換する
		// データ不整合に備えて安全に変換（Timestamp型でなければDateとしてパースを試みる）
		date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
	};
};

/**
 * Firestoreの残高ドキュメントの購読解除関数。
 * Firestoreのリアルタイムリスナーを停止するために使用される。
 * @type {function|null}
 */
let unsubscribeBalances = null;

/**
 * ユーザー統計情報の購読解除関数。
 * @type {function|null}
 */
let unsubscribeStats = null;

/**
 * 指定されたコレクションのユーザードキュメントを更新するヘルパー関数。
 * @async
 * @param {string} collectionName - コレクション名。
 * @param {object} data - 更新データ。
 * @param {boolean} [merge=false] - マージ更新するかどうか（setDoc vs updateDoc）。
 * @returns {Promise<void>}
 */
const updateUserDoc = async (collectionName, data, merge = false) => {
	const docRef = doc(db, collectionName, auth.currentUser.uid);
	if (merge) {
		await setDoc(docRef, data, { merge: true });
	} else {
		await updateDoc(docRef, data);
	}
};

/**
 * アイテムタイプに基づいてコレクション名とフィールド名を取得するヘルパー関数。
 * @param {string} type - アイテムタイプ ('asset', 'liability', 'income', 'expense', 'account', 'category')。
 * @returns {object} コレクション名、フィールド名、プレフィックスを含む設定オブジェクト。
 */
const getItemConfig = (type) => {
	const isAccount = ["asset", "liability", "account"].includes(type);
	return {
		collectionName: isAccount ? "user_accounts" : "user_categories",
		fieldName: isAccount ? "accounts" : "categories",
		prefix: isAccount ? "acc_" : "cat_",
	};
};

/**
 * 新規ユーザー向けの初期データ（口座、カテゴリ、設定）を生成し、Firestoreに保存する。
 * `config.js` で定義されたテンプレートデータを元に、ユーザー固有のデータを作成する。
 * 初回ログイン時のオンボーディングプロセスの一部として実行される。
 * @async
 * @param {string} userId - 初期データを作成するユーザーのID。
 * @returns {Promise<object>} 生成された初期データを含むオブジェクト（口座、カテゴリ、設定）。
 * @fires Firestore - ユーザーデータ、口座データ、カテゴリデータ、初期残高データをバッチ処理で書き込む。
 */
async function createInitialUserData(userId) {
	console.info("[Store] 初期ユーザーデータを作成します:", userId);
	const batch = writeBatch(db);
	const newAccounts = {};
	const newCategories = {};
	const initialBalances = {};

	// テンプレートから口座データを生成
	configTemplate.assets.forEach((name, index) => {
		// 資産
		const id = `acc_${crypto.randomUUID()}`;
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
		const id = `acc_${crypto.randomUUID()}`;
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
		const id = `cat_${crypto.randomUUID()}`;
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
		const id = `cat_${crypto.randomUUID()}`;
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
		general: {
			displayPeriod: 3,
		},
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
		config: {
			...newConfig,
			displayPeriod: 3, // 互換性のためルートにも持たせる
		},
	};
}

/**
 * ログインユーザーの全ての基本データ（口座、カテゴリ、設定）をFirestoreから取得する。
 * 新規ユーザーの場合は、初期データを生成して返す。
 * アプリケーション起動時に必要なマスタデータを一括でロードする。
 * @async
 * @returns {Promise<object>} ユーザーデータを含むオブジェクト。
 * @property {object} accounts - 口座データ。
 * @property {object} categories - カテゴリデータ。
 * @property {object} config - 設定データ。
 * @fires Firestore - ユーザーの口座、カテゴリ、設定データを取得する。
 */
export async function fetchAllUserData() {
	if (!auth.currentUser) return { accounts: {}, categories: {}, config: {} };
	const userId = auth.currentUser.uid;

	// 3つのドキュメントを並行して取得し、読み取り回数を削減
	const [accountsDoc, categoriesDoc, configDoc] = await Promise.all([
		getDoc(doc(db, "user_accounts", userId)),
		getDoc(doc(db, "user_categories", userId)),
		getDoc(doc(db, "user_configs", userId)),
	]);

	// configドキュメントが存在しない場合は新規ユーザーと判断
	if (!configDoc.exists()) {
		return await createInitialUserData(userId);
	}

	// 既存ユーザーの場合は各ドキュメントのデータを返す
	const configData = configDoc.data();
	// 互換性対応: displayPeriodを正規化
	// general.displayPeriod があればそれを優先、なければルートの displayPeriod、それもなければデフォルト3
	const displayPeriod =
		configData.general?.displayPeriod ?? configData.displayPeriod ?? 3;

	return {
		accounts: accountsDoc.exists() ? accountsDoc.data().accounts : {},
		categories: categoriesDoc.exists() ? categoriesDoc.data().categories : {},
		config: {
			...configData,
			displayPeriod, // アプリケーション内で使いやすいようにルートに配置
		},
	};
}

/**
 * ログインユーザーの全口座の残高データをFirestoreから取得する。
 * 各口座の現在の残高を把握し、UIに反映させるために使用する。
 * @async
 * @returns {Promise<object|null>} 口座IDをキー、残高を値とするオブジェクト。データが存在しない場合はnull。
 * @fires Firestore - `account_balances`ドキュメントを取得する。
 */
export async function fetchAccountBalances() {
	if (!auth.currentUser) return {};
	const userId = auth.currentUser.uid;
	const docRef = doc(db, "account_balances", userId);
	const docSnap = await getDoc(docRef);

	if (docSnap.exists()) return docSnap.data();
	else return null;
}

/**
 * 指定された期間の取引データをFirestoreから取得する。
 * 日付は日本時間を基準としてクエリを実行し、ユーザーのローカルタイムゾーンに合わせたデータを取得する。
 * @async
 * @param {number} months - 取得する期間（現在から過去Nヶ月分）。
 * @returns {Promise<Array<object>>} 取引オブジェクトの配列。日付の降順でソートされる。
 * @fires Firestore - `transactions`コレクションから指定期間のデータをクエリする。
 */
export async function fetchTransactionsForPeriod(months) {
	if (!auth.currentUser) return [];

	const userId = auth.currentUser.uid;

	const startTimestamp = getStartOfMonthAgo(months);

	const q = query(
		collection(db, "transactions"),
		where("userId", "==", userId),
		where("date", ">=", startTimestamp),
		orderBy("date", "desc"),
		orderBy("updatedAt", "desc")
	);
	const querySnapshot = await getDocs(q);
	console.debug(
		`[Store] ${months}ヶ月分の取引を取得: ${querySnapshot.size} 件`
	);
	return querySnapshot.docs.map(convertDocToTransaction);
}

/**
 * 指定された年の取引データをFirestoreから取得する。
 * 年間レポートなどの長期的な分析のために、特定年の全データを取得する。
 * @async
 * @param {number} year - 取得する年（西暦4桁）。
 * @returns {Promise<Array<object>>} 取引オブジェクトの配列。日付の降順でソートされる。
 * @fires Firestore - `transactions`コレクションから指定年のデータをクエリする。
 */
export async function fetchTransactionsByYear(year) {
	if (!auth.currentUser) return [];
	const userId = auth.currentUser.uid;

	const startTimestamp = getStartOfYear(year);
	const endTimestamp = getEndOfYear(year);

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

/**
 * 新規または既存の取引データを保存し、関連する口座残高を更新する。
 * トランザクション処理（Firestoreのバッチ書き込み）を使用して、データ整合性を保つ。
 * @async
 * @param {object} data - 保存する取引データ。idが含まれていれば編集、なければ新規作成。
 * @returns {Promise<void>}
 * @fires Firestore - `transactions`コレクションへの書き込みと、`account_balances`ドキュメントの更新を行う。
 */
export async function saveTransaction(data) {
	console.debug("[Store] 取引を保存します:", data);
	// 入力データの基本的な検証
	validateTransaction(data);

	const id = data.id;
	// dataオブジェクトを直接操作すると呼び出し元に影響が出る可能性があるため、コピーを作成
	const dataToSave = { ...data };
	delete dataToSave.id;

	const transactionData = {
		...dataToSave,
		userId: auth.currentUser.uid,
		// APIの仕様により、日付文字列を日本時間として解釈し、UTCタイムスタンプに変換して保存
		date: Timestamp.fromDate(toUtcDate(data.date)),
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
 * Cloud Functionsのトリガーにより、削除後の残高再計算が自動的に行われる。
 * @async
 * @param {object} transaction - 削除する取引オブジェクト。
 * @returns {Promise<void>}
 * @fires Firestore - `transactions`ドキュメントの削除と、`account_balances`ドキュメントの更新を行う。
 */
export async function deleteTransaction(transaction) {
	console.debug("[Store] 取引を削除します:", transaction.id);
	await deleteDoc(doc(db, "transactions", transaction.id));
}

/**
 * 新しい項目（口座またはカテゴリ）をFirestoreに追加する。
 * ユーザーごとの単一ドキュメント内のマップフィールドとして管理し、読み取りコストを最適化する。
 * @async
 * @param {object} itemData - 追加する項目のデータ。
 * @param {string} itemData.type - 項目の種類（'asset', 'liability', 'income', 'expense'）。
 * @param {string} itemData.name - 項目の名前。
 * @param {number} itemData.order - 項目の表示順。
 * @returns {Promise<void>}
 * @fires Firestore - `user_accounts`または`user_categories`ドキュメントを更新する。
 */
export async function addItem({ type, name, order }) {
	const { collectionName, fieldName, prefix } = getItemConfig(type);
	const newId = `${prefix}${Math.random().toString(36).substring(2, 12)}`;
	const newData = { name, type, isDeleted: false, order };
	await updateUserDoc(collectionName, { [`${fieldName}.${newId}`]: newData });
}

/**
 * 既存の項目（口座またはカテゴリ）の情報を更新する。
 * ドット記法を使用して、ネストされたマップフィールドの一部のみを効率的に更新する。
 * @async
 * @param {string} itemId - 更新する項目のID。
 * @param {string} itemType - 項目の種類（'account' または 'category'）。
 * @param {object} updateData - 更新するデータを含むオブジェクト。
 * @returns {Promise<void>}
 * @fires Firestore - `user_accounts`または`user_categories`ドキュメントを更新する。
 */
export async function updateItem(itemId, itemType, updateData) {
	const { collectionName, fieldName } = getItemConfig(itemType);
	const updates = {};
	for (const key in updateData) {
		updates[`${fieldName}.${itemId}.${key}`] = updateData[key];
	}
	await updateUserDoc(collectionName, updates);
}

/**
 * 項目（口座またはカテゴリ）を論理削除する（isDeletedフラグをtrueに設定）。
 * 過去の取引データとの整合性を保つため、物理削除ではなくフラグによる非表示を行う。
 * @async
 * @param {string} itemId - 論理削除する項目のID。
 * @param {string} itemType - 項目の種類（'account' または 'category'）。
 * @returns {Promise<void>}
 * @fires Firestore - `user_accounts`または`user_categories`ドキュメントを更新する。
 */
export async function deleteItem(itemId, itemType) {
	// isDeletedフラグを立てる（updateItemを再利用）
	await updateItem(itemId, itemType, { isDeleted: true });
}

/**
 * 特定のカテゴリに紐づく全ての取引を、別のカテゴリに一括で付け替える。
 * カテゴリ削除時のデータ整合性を保つために使用される。
 * @async
 * @param {string} fromCatId - 付け替え元のカテゴリID。
 * @param {string} toCatId - 付け替え先のカテゴリID。
 * @returns {Promise<void>}
 * @fires Firestore - 関連する`transactions`ドキュメントをバッチ更新する。
 */
export async function remapTransactions(fromCatId, toCatId) {
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
 * 口座の表示順序を更新する。
 * ドラッグアンドドロップによる並べ替え結果を永続化する。
 * @async
 * @param {Array<string>} orderedIds - 新しい順序に並べ替えられた口座IDの配列。
 * @returns {Promise<void>}
 * @fires Firestore - `user_accounts`ドキュメントの各口座のorderプロパティを更新する。
 */
export async function updateAccountOrder(orderedIds) {
	const updates = {};
	orderedIds.forEach((id, index) => {
		updates[`accounts.${id}.order`] = index;
	});
	await updateUserDoc("user_accounts", updates);
}

/**
 * カテゴリの表示順序を更新する。
 * ドラッグアンドドロップによる並べ替え結果を永続化する。
 * @async
 * @param {Array<string>} orderedIds - 新しい順序に並べ替えられたカテゴリIDの配列。
 * @returns {Promise<void>}
 * @fires Firestore - `user_categories`ドキュメントの各カテゴリのorderプロパティを更新する。
 */
export async function updateCategoryOrder(orderedIds) {
	const updates = {};
	orderedIds.forEach((id, index) => {
		updates[`categories.${id}.order`] = index;
	});
	await updateUserDoc("user_categories", updates);
}

/**
 * ユーザーの設定情報を更新する。
 * 表示期間やクレジットカード設定などのユーザー設定を保存する。
 * @async
 * @param {object} updateData - 更新する設定データ。
 * @param {boolean} [merge=false] - マージ更新するかどうか（trueならsetDoc、falseならupdateDoc）。
 * ドット記法でフィールドを更新する場合はfalseを指定すること。
 * ネストされたオブジェクトをマージしたい場合はtrueを指定すること。
 * @returns {Promise<void>}
 * @fires Firestore - `user_configs`ドキュメントを更新する。
 */
export async function updateConfig(updateData, merge = false) {
	await updateUserDoc("user_configs", updateData, merge);
}

/**
 * AIアドバイザーのアドバイスを保存する。
 * @async
 * @param {string} advice - 生成されたアドバイスのテキスト。
 * @returns {Promise<void>}
 */
export async function saveAiAdvice(advice) {
	await updateConfig(
		{
			general: {
				aiAdvisor: {
					message: advice,
					lastAnalyzedAt: serverTimestamp(),
				},
			},
		},
		true
	);
}

/**
 * 取引データの論理的整合性を検証する。
 * Firestoreのセキュリティルールに準拠しつつ、アプリケーション固有の矛盾もチェックする。
 * 不正なデータがDBに送信されるのを防ぎ、エラーメッセージをユーザーにフィードバックする。
 * @param {object} data - 検証対象の取引データ
 * @throws {Error} 検証に失敗した場合、エラーメッセージを投げる
 * @returns {void}
 */
export function validateTransaction(data) {
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
 * ログインユーザーの口座残高ドキュメントのリアルタイム更新を購読する。
 * Cloud Functionsによる残高計算の結果を即座にUIに反映させるために使用する。
 * @param {function} onUpdate - ドキュメントが更新された際に呼び出されるコールバック関数。
 * @returns {void}
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
 * 口座残高ドキュメントのリアルタイム更新購読を解除する。
 * ログアウト時などに呼び出し、不要な通信と権限エラーを防ぐ。
 * @returns {void}
 */
export function unsubscribeAccountBalances() {
	if (unsubscribeBalances) {
		unsubscribeBalances();
		unsubscribeBalances = null;
	}
}

/**
 * ログインユーザーの統計情報（サーバーサイド計算済み）のリアルタイム更新を購読する。
 * @param {function} onUpdate - データ更新時のコールバック。
 */
export function subscribeUserStats(onUpdate) {
	if (!auth.currentUser) return;
	const userId = auth.currentUser.uid;

	if (unsubscribeStats) unsubscribeStats();

	// 月次統計コレクションを購読（新しい順）
	const q = query(
		collection(db, "user_monthly_stats", userId, "months"),
		orderBy("month", "desc")
	);
	unsubscribeStats = onSnapshot(q, (snapshot) => {
		const stats = snapshot.docs.map((d) => d.data());
		onUpdate(stats);
	});
}

/**
 * 統計情報の購読を解除する。
 * ログアウト時などに呼び出し、不要な通信と権限エラーを防ぐ。
 * @returns {void}
 */
export function unsubscribeUserStats() {
	if (unsubscribeStats) {
		unsubscribeStats();
		unsubscribeStats = null;
	}
}

/**
 * 取引リストの中から指定されたIDの取引オブジェクトを取得する。
 * 編集や削除の対象となる取引を特定するために使用する。
 * @param {string} id - 検索する取引ID。
 * @param {Array<object>} transactions - 検索対象の取引リスト。
 * @returns {object|undefined} 見つかった取引オブジェクト、またはundefined。
 */
export function getTransactionById(id, transactions) {
	return transactions.find((t) => t.id === id);
}

/**
 * ユーザーの登録済みFCMトークン一覧を取得する。
 * @async
 * @returns {Promise<Array<object>>} トークン情報の配列
 */
export async function getFcmTokens() {
	if (!auth.currentUser) return [];
	const userId = auth.currentUser.uid;
	const tokensRef = collection(db, "user_fcm_tokens", userId, "tokens");
	const q = query(tokensRef, orderBy("updatedAt", "desc"));
	const snapshot = await getDocs(q);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * FCMトークンをユーザー情報として保存する。
 * 通知送信の宛先として使用される。
 * @async
 * @param {string} token - FCMトークン
 * @returns {Promise<void>}
 */
export async function saveFcmToken(token) {
	if (!auth.currentUser) return;
	const userId = auth.currentUser.uid;

	// ▼▼▼ 修正: 親ドキュメントとサブコレクションの参照 ▼▼▼
	const userRef = doc(db, "user_fcm_tokens", userId);
	const tokenRef = doc(userRef, "tokens", token);

	// 1. 親ドキュメントを明示的に作成/更新する（これでクエリに引っかかるようになる）
	// （merge: true なので既存データは消えません）
	await setDoc(
		userRef,
		{
			lastUpdatedAt: serverTimestamp(),
		},
		{ merge: true }
	);

	// 2. トークンをサブコレクションに保存
	await setDoc(
		tokenRef,
		{
			token: token,
			updatedAt: serverTimestamp(),
			deviceInfo: navigator.userAgent,
		},
		{ merge: true }
	);
}

/**
 * 指定されたFCMトークンを削除する。
 * 特定のブラウザ/デバイスの通知のみを解除する場合に使用する。
 * @async
 * @param {string} token - 削除するFCMトークン
 * @returns {Promise<void>}
 */
export async function deleteFcmToken(token) {
	if (!auth.currentUser) return;
	const userId = auth.currentUser.uid;
	const tokenRef = doc(db, "user_fcm_tokens", userId, "tokens", token);
	await deleteDoc(tokenRef);
}

/**
 * 現在のデバイスが通知設定済み（FCMトークン取得済みかつFirestoreに保存済み）かを確認する。
 * @async
 * @returns {Promise<boolean>} 設定済みならtrue
 */
export async function isDeviceRegisteredForNotifications() {
	if (!auth.currentUser) return false;
	if (Notification.permission !== "granted") return false;

	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		if (!registration) return false;

		const currentToken = await getToken(messaging, {
			vapidKey: vapidKey,
			serviceWorkerRegistration: registration,
		});

		if (!currentToken) return false;

		const savedTokens = await getFcmTokens();
		return savedTokens.some((t) => t.token === currentToken);
	} catch (error) {
		console.warn("[Store] Notification check failed:", error);
		return false;
	}
}

/**
 * 【移行・修復用】現在のユーザーの全取引データを取得し、月次統計情報を再計算してFirestoreに保存する。
 * ブラウザのコンソールから手動で実行することを想定。
 * @async
 * @returns {Promise<void>}
 */
export async function recalculateUserStats() {
	if (!auth.currentUser) return;

	const userId = auth.currentUser.uid;
	const q = query(
		collection(db, "transactions"),
		where("userId", "==", userId)
	);
	const snapshot = await getDocs(q);
	const transactions = snapshot.docs.map(convertDocToTransaction);
	const stats = {};

	for (const t of transactions) {
		const month = toYYYYMM(t.date);
		const amount = Number(t.amount) || 0;

		if (!stats[month]) {
			stats[month] = { income: 0, expense: 0, netChange: 0 };
		}

		if (t.type === "income") {
			stats[month].netChange += amount;
			if (t.categoryId !== SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) {
				stats[month].income += amount;
			}
		} else if (t.type === "expense") {
			stats[month].netChange -= amount;
			if (t.categoryId !== SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) {
				stats[month].expense += amount;
			}
		}
	}

	const batch = writeBatch(db);
	for (const [month, data] of Object.entries(stats)) {
		const ref = doc(db, "user_monthly_stats", userId, "months", month);
		batch.set(ref, {
			month: month,
			...data,
			updatedAt: serverTimestamp(),
		});
	}

	await batch.commit();
}

/**
 * ユーザーの統計情報が存在するかどうかを確認する。
 * 再計算が必要かどうかの判定に使用する。
 * @async
 * @returns {Promise<boolean>} 統計データが存在すればtrue
 */
export async function hasUserStats() {
	if (!auth.currentUser) return false;
	const userId = auth.currentUser.uid;
	const q = query(
		collection(db, "user_monthly_stats", userId, "months"),
		limit(1)
	);
	const snapshot = await getDocs(q);
	return !snapshot.empty;
}
