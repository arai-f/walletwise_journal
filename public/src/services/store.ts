/**
 * Firestore とのデータ永続化を担うストアサービス。
 * 取引データ、口座、カテゴリ、設定、FCM トークンの読み書きとリアルタイム購読を提供する。
 */
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	FirestoreDataConverter,
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
	WithFieldValue,
	writeBatch,
} from "firebase/firestore";
import { config as configTemplate } from "../config.js";
import { auth, db } from "../firebase.js";
import type {
	AccountBalances,
	Transaction,
	TransactionInput,
	TransactionSaveResult,
} from "../types/hooks.js";
import type { AppConfig } from "../types/settings.js";
import {
	getEndOfYear,
	getStartOfMonthAgo,
	getStartOfYear,
	toUtcDate,
} from "../utils.js";

/**
 * 取引データ本体（最小表現）。
 * Firestore 上のプロパティと互換性を持つよう、`Record<string, unknown>` を許容する。
 */
type TransactionFirestoreData = Transaction & Record<string, unknown>;

/**
 * 取引データ用の Firestore コンバーター。
 * アプリケーションのオブジェクトと Firestore のドキュメントデータの相互変換を定義する。
 */
const transactionConverter: FirestoreDataConverter<TransactionFirestoreData> = {
	toFirestore(transaction) {
		const data: Record<string, unknown> = { ...transaction };
		if (data.id) delete data.id;

		// 日付の変換: 日本時間として解釈し、UTC タイムスタンプに変換して保存する。
		if (data.date) {
			const dateObj = new Date(data.date as string | number | Date);
			data.date = Timestamp.fromDate(toUtcDate(dateObj));
		}
		return data;
	},
	fromFirestore(snapshot, options) {
		const data = snapshot.data(options) as Record<string, unknown> & {
			date?: { toDate?: () => Date } | string | number | Date;
		};
		const rawDate = data.date;
		let date: Date;
		if (rawDate instanceof Date) {
			date = rawDate;
		} else if (
			rawDate &&
			typeof rawDate === "object" &&
			typeof rawDate.toDate === "function"
		) {
			date = rawDate.toDate();
		} else {
			date = new Date(rawDate as string | number | Date);
		}
		return {
			id: snapshot.id,
			...data,
			date,
		} as unknown as TransactionFirestoreData;
	},
};

/**
 * `getItemConfig` が返す設定オブジェクト。
 */
interface ItemConfig {
	/** Firestore コレクション名。 */
	collectionName: "user_accounts" | "user_categories";
	/** ドキュメント内のマップフィールド名。 */
	fieldName: "accounts" | "categories";
	/** 新規 ID に付与するプレフィックス。 */
	prefix: "acc_" | "cat_";
}

/**
 * 指定されたコレクションのユーザードキュメントを更新するヘルパー関数。
 * @param collectionName - コレクション名。
 * @param data - 更新データ。
 * @param merge - マージ更新するかどうか（`setDoc` vs `updateDoc`）。
 * @throws {Error} 未認証ユーザーの場合にエラーを投げる。
 */
const updateUserDoc = async (
	collectionName: string,
	data: Record<string, unknown>,
	merge = false,
): Promise<void> => {
	if (!auth.currentUser) throw new Error("User not authenticated");
	const docRef = doc(db, collectionName, auth.currentUser.uid);
	if (merge) {
		await setDoc(docRef, data as Record<string, unknown>, { merge: true });
	} else {
		await updateDoc(docRef, data as Record<string, unknown>);
	}
};

/**
 * アイテムタイプに基づいてコレクション名とフィールド名を取得するヘルパー関数。
 * @param type - アイテムタイプ ('asset', 'liability', 'income', 'expense', 'account', 'category')。
 * @returns コレクション名、フィールド名、プレフィックスを含む設定オブジェクト。
 */
const getItemConfig = (type: string): ItemConfig => {
	const isAccount = ["asset", "liability", "account"].includes(type);
	return {
		collectionName: isAccount ? "user_accounts" : "user_categories",
		fieldName: isAccount ? "accounts" : "categories",
		prefix: isAccount ? "acc_" : "cat_",
	};
};

/**
 * `createInitialUserData` が返す初期データオブジェクト。
 */
interface InitialUserData {
	accounts: Record<string, Record<string, unknown>>;
	categories: Record<string, Record<string, unknown>>;
	config: AppConfig & { displayPeriod: number };
}

/**
 * 新規ユーザー向けの初期データ（口座、カテゴリ、設定）を生成し、Firestore に保存する。
 * `config.js` で定義されたテンプレートデータを元に、ユーザー固有のデータを作成する。
 * 初回ログイン時のオンボーディングプロセスの一部として実行される。
 * @param userId - 初期データを作成するユーザーの ID。
 * @returns 生成された初期データを含むオブジェクト（口座、カテゴリ、設定）。
 * @fires Firestore - ユーザーデータ、口座データ、カテゴリデータ、初期残高データをバッチ処理で書き込む。
 */
async function createInitialUserData(userId: string): Promise<InitialUserData> {
	const batch = writeBatch(db);
	const newAccounts: Record<string, Record<string, unknown>> = {};
	const newCategories: Record<string, Record<string, unknown>> = {};
	const initialBalances: Record<string, number> = {};

	// テンプレートから口座データを生成する。
	configTemplate.assets.forEach((name: string, index: number) => {
		// 資産。
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
	configTemplate.liabilities.forEach((name: string, index: number) => {
		// 負債。
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

	// テンプレートからカテゴリデータを生成する。
	configTemplate.incomeCategories.forEach((name: string, index: number) => {
		// 収入カテゴリ。
		const id = `cat_${crypto.randomUUID()}`;
		newCategories[id] = {
			userId,
			name,
			type: "income",
			order: index,
			isDeleted: false,
		};
	});
	configTemplate.expenseCategories.forEach((name: string, index: number) => {
		// 支出カテゴリ。
		const id = `cat_${crypto.randomUUID()}`;
		newCategories[id] = {
			userId,
			name,
			type: "expense",
			order: index,
			isDeleted: false,
		};
	});

	// テンプレートから設定データを生成する。
	const newConfig: AppConfig = {
		creditCardRules: configTemplate.creditCardRules,
		general: {
			displayPeriod: 3,
		},
	};

	// Firestore にバッチ書き込みを行う。
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
			displayPeriod: 3, // 互換性のためルートにも持たせる。
		},
	};
}

/**
 * `fetchAllUserData` が返すユーザーデータオブジェクト。
 * 口座とカテゴリは ID をキーとする Map 形式で返す。
 * 値オブジェクトは呼び出し側の緩い型（`Luts` の `Map<string, Account | ...>` 等）との
 * 互換性を保つため、値を緩めに表現する。
 */
export interface UserDataResult {
	accounts: Map<string, any>;
	categories: Map<string, any>;
	config: Record<string, any>;
}

/**
 * ログインユーザーの全ての基本データ（口座、カテゴリ、設定）を Firestore から取得する。
 * 新規ユーザーの場合は、初期データを生成して返す。
 * アプリケーション起動時に必要なマスタデータを一括でロードする。
 * @returns ユーザーデータを含むオブジェクト。
 * @throws {Error} 未認証の場合は空のデータを返す（例外を投げない）。
 * @fires Firestore - ユーザーの口座、カテゴリ、設定データを取得する。
 */
export async function fetchAllUserData(): Promise<UserDataResult> {
	if (!auth.currentUser)
		return {
			accounts: new Map(),
			categories: new Map(),
			config: {},
		};
	const userId = auth.currentUser.uid;

	// 3つのドキュメントを並行して取得し、読み取り回数を削減する。
	const [accountsDoc, categoriesDoc, configDoc] = await Promise.all([
		getDoc(doc(db, "user_accounts", userId)),
		getDoc(doc(db, "user_categories", userId)),
		getDoc(doc(db, "user_configs", userId)),
	]);

	let accountsData: Record<string, Record<string, unknown>>;
	let categoriesData: Record<string, Record<string, unknown>>;
	let configData: AppConfig;

	// config ドキュメントが存在しない場合は新規ユーザーと判断する。
	if (!configDoc.exists()) {
		const initial = await createInitialUserData(userId);
		accountsData = initial.accounts;
		categoriesData = initial.categories;
		configData = initial.config;
	} else {
		// 既存ユーザーの場合は各ドキュメントのデータを返す。
		accountsData = accountsDoc.exists()
			? (accountsDoc.data().accounts as Record<
					string,
					Record<string, unknown>
				>)
			: {};
		categoriesData = categoriesDoc.exists()
			? (categoriesDoc.data().categories as Record<
					string,
					Record<string, unknown>
				>)
			: {};
		const rawConfig = configDoc.data() as AppConfig;
		// 互換性対応: displayPeriod を正規化する。
		const displayPeriod =
			rawConfig.general?.displayPeriod ?? rawConfig.displayPeriod ?? 3;
		configData = { ...rawConfig, displayPeriod };
	}

	// Mapに変換して返却する（ID をオブジェクト内に注入）
	const toMap = (
		obj: Record<string, Record<string, unknown>> | undefined,
	): Map<string, any> =>
		new Map(
			Object.entries(obj || {}).map(([k, v]) => [k, { id: k, ...v }]),
		);

	return {
		accounts: toMap(accountsData),
		categories: toMap(categoriesData),
		config: configData as Record<string, any>,
	};
}

/**
 * 指定された期間の取引データを Firestore から取得する。
 * 日付は日本時間を基準としてクエリを実行し、ユーザーのローカルタイムゾーンに合わせたデータを取得する。
 * @param months - 取得する期間（現在から過去 N ヶ月分）。
 * @returns 取引オブジェクトの配列。日付の降順でソートされる。
 * @fires Firestore - `transactions` コレクションから指定期間のデータをクエリする。
 */
export async function fetchTransactionsForPeriod(
	months: number,
): Promise<Transaction[]> {
	if (!auth.currentUser) return [];

	const userId = auth.currentUser.uid;

	const startTimestamp = getStartOfMonthAgo(months);

	const q = query(
		collection(db, "transactions").withConverter(transactionConverter),
		where("userId", "==", userId),
		where("date", ">=", startTimestamp),
		orderBy("date", "desc"),
		orderBy("updatedAt", "desc"),
	);
	const querySnapshot = await getDocs(q);
	console.debug(
		`[Store] ${months}ヶ月分の取引を取得: ${querySnapshot.size} 件`,
	);
	return querySnapshot.docs.map((doc) => doc.data() as Transaction);
}

/**
 * 指定された年の取引データを Firestore から取得する。
 * 年間レポートなどの長期的な分析のために、特定年の全データを取得する。
 * @param year - 取得する年（西暦 4 桁）。
 * @returns 取引オブジェクトの配列。日付の降順でソートされる。
 * @fires Firestore - `transactions` コレクションから指定年のデータをクエリする。
 */
export async function fetchTransactionsByYear(
	year: number,
): Promise<Transaction[]> {
	if (!auth.currentUser) return [];
	const userId = auth.currentUser.uid;

	const startTimestamp = getStartOfYear(year);
	const endTimestamp = getEndOfYear(year);

	const q = query(
		collection(db, "transactions").withConverter(transactionConverter),
		where("userId", "==", userId),
		where("date", ">=", startTimestamp),
		where("date", "<=", endTimestamp),
		orderBy("date", "desc"),
	);

	const querySnapshot = await getDocs(q);
	console.debug(`[Store] ${year}年の取引を取得: ${querySnapshot.size} 件`);
	return querySnapshot.docs.map((doc) => doc.data() as Transaction);
}

/**
 * 新規または既存の取引データを保存し、関連する口座残高を更新する。
 * トランザクション処理（Firestore のバッチ書き込み）を使用して、データ整合性を保つ。
 * @param data - 保存する取引データ。id が含まれていれば編集、なければ新規作成。
 * @returns 保存された取引の Firestore ドキュメント ID。
 * @fires Firestore - `transactions` コレクションへの書き込みと、`account_balances` ドキュメントの更新を行う。
 */
export async function saveTransaction(
	data: TransactionInput | Record<string, any>,
): Promise<TransactionSaveResult> {
	console.debug("[Store] 取引を保存します:", data);

	// データを受け取ったらすぐに数値化して正規化する。
	// これにより、AI スキャンやインポート機能から文字列で渡されても安全に処理できる。
	const rawData = data as TransactionInput;
	const normalizedData = {
		...rawData,
		amount: Number(rawData.amount),
	};

	// 入力データの基本的な検証。
	validateTransaction(normalizedData);

	if (!auth.currentUser) throw new Error("User not authenticated");
	const id = normalizedData.id;
	const dataToSave = {
		...normalizedData,
		userId: auth.currentUser.uid,
		updatedAt: serverTimestamp(),
	};

	if (id) {
		// 編集モード。
		const docRef = doc(db, "transactions", id).withConverter(
			transactionConverter,
		);
		await setDoc(
			docRef,
			dataToSave as WithFieldValue<TransactionFirestoreData>,
			{ merge: true },
		);
		return id;
	} else {
		// 新規追加モード。
		const colRef = collection(db, "transactions").withConverter(
			transactionConverter,
		);
		const docRef = await addDoc(
			colRef,
			dataToSave as WithFieldValue<TransactionFirestoreData>,
		);
		return docRef.id;
	}
}

/**
 * 指定された取引を削除し、関連する口座残高を更新する。
 * Cloud Functions のトリガーにより、削除後の残高再計算が自動的に行われる。
 * @param transaction - 削除する取引オブジェクト。
 * @fires Firestore - `transactions` ドキュメントの削除と、`account_balances` ドキュメントの更新を行う。
 */
export async function deleteTransaction(transaction: Transaction): Promise<void> {
	console.debug("[Store] 取引を削除します:", transaction.id);
	await deleteDoc(doc(db, "transactions", transaction.id));
}

/**
 * `addItem` に渡す入力データ。
 */
export interface AddItemInput {
	/** 項目の種類（'asset', 'liability', 'income', 'expense'）。 */
	type: "asset" | "liability" | "income" | "expense";
	/** 項目の名前。 */
	name: string;
	/** 項目の表示順。 */
	order: number;
}

/**
 * 新しい項目（口座またはカテゴリ）を Firestore に追加する。
 * ユーザーごとの単一ドキュメント内のマップフィールドとして管理し、読み取りコストを最適化する。
 * @param itemData - 追加する項目のデータ。
 * @fires Firestore - `user_accounts` または `user_categories` ドキュメントを更新する。
 */
export async function addItem(itemData: AddItemInput): Promise<void> {
	const { collectionName, fieldName, prefix } = getItemConfig(itemData.type);
	const newId = `${prefix}${crypto.randomUUID()}`;
	const newData = {
		name: itemData.name,
		type: itemData.type,
		isDeleted: false,
		order: itemData.order,
	};
	await updateUserDoc(collectionName, {
		[`${fieldName}.${newId}`]: newData,
	});
}

/**
 * 既存の項目（口座またはカテゴリ）の情報を更新する。
 * ドット記法を使用して、ネストされたマップフィールドの一部のみを効率的に更新する。
 * @param itemId - 更新する項目の ID。
 * @param itemType - 項目の種類（'account' または 'category'）。
 * @param updateData - 更新するデータを含むオブジェクト。
 * @fires Firestore - `user_accounts` または `user_categories` ドキュメントを更新する。
 */
export async function updateItem(
	itemId: string,
	itemType: string,
	updateData: Record<string, unknown>,
): Promise<void> {
	const { collectionName, fieldName } = getItemConfig(itemType);
	const updates: Record<string, unknown> = {};
	for (const key in updateData) {
		updates[`${fieldName}.${itemId}.${key}`] = updateData[key];
	}
	await updateUserDoc(collectionName, updates);
}

/**
 * 項目（口座またはカテゴリ）を論理削除する（`isDeleted` フラグを `true` に設定）。
 * 過去の取引データとの整合性を保つため、物理削除ではなくフラグによる非表示を行う。
 * @param itemId - 論理削除する項目の ID。
 * @param itemType - 項目の種類（'account' または 'category'）。
 * @fires Firestore - `user_accounts` または `user_categories` ドキュメントを更新する。
 */
export async function deleteItem(
	itemId: string,
	itemType: string,
): Promise<void> {
	// isDeleted フラグを立てる（updateItem を再利用）。
	await updateItem(itemId, itemType, { isDeleted: true });
}

/**
 * 特定のカテゴリに紐づく全ての取引を、別のカテゴリに一括で付け替える。
 * カテゴリ削除時のデータ整合性を保つために使用される。
 * @param fromCatId - 付け替え元のカテゴリ ID。
 * @param toCatId - 付け替え先のカテゴリ ID。
 * @fires Firestore - 関連する `transactions` ドキュメントをバッチ更新する。
 */
export async function remapTransactions(
	fromCatId: string,
	toCatId: string,
): Promise<void> {
	if (!auth.currentUser) return;
	const q = query(
		collection(db, "transactions"),
		where("userId", "==", auth.currentUser.uid),
		where("categoryId", "==", fromCatId),
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
 * @param orderedIds - 新しい順序に並べ替えられた口座 ID の配列。
 * @fires Firestore - `user_accounts` ドキュメントの各口座の order プロパティを更新する。
 */
export async function updateAccountOrder(orderedIds: string[]): Promise<void> {
	const updates: Record<string, unknown> = {};
	orderedIds.forEach((id, index) => {
		updates[`accounts.${id}.order`] = index;
	});
	await updateUserDoc("user_accounts", updates);
}

/**
 * カテゴリの表示順序を更新する。
 * ドラッグアンドドロップによる並べ替え結果を永続化する。
 * @param orderedIds - 新しい順序に並べ替えられたカテゴリ ID の配列。
 * @fires Firestore - `user_categories` ドキュメントの各カテゴリの order プロパティを更新する。
 */
export async function updateCategoryOrder(orderedIds: string[]): Promise<void> {
	const updates: Record<string, unknown> = {};
	orderedIds.forEach((id, index) => {
		updates[`categories.${id}.order`] = index;
	});
	await updateUserDoc("user_categories", updates);
}

/**
 * ユーザーの設定情報を更新する。
 * 表示期間やクレジットカード設定などのユーザー設定を保存する。
 * @param updateData - 更新する設定データ。
 * @param merge - マージ更新するかどうか（true なら setDoc、false なら updateDoc）。
 * ドット記法でフィールドを更新する場合は false を指定すること。
 * ネストされたオブジェクトをマージしたい場合は true を指定すること。
 * @fires Firestore - `user_configs` ドキュメントを更新する。
 */
export async function updateConfig(
	updateData: Record<string, unknown>,
	merge = false,
): Promise<void> {
	await updateUserDoc("user_configs", updateData, merge);
}

/**
 * 取引データの論理的整合性を検証する。
 * Firestore のセキュリティルールに準拠しつつ、アプリケーション固有の矛盾もチェックする。
 * 不正なデータが DB に送信されるのを防ぎ、エラーメッセージをユーザーにフィードバックする。
 * @param data - 検証対象の取引データ。
 * @throws {Error} 検証に失敗した場合、エラーメッセージを投げる。
 */
export function validateTransaction(data: TransactionInput): void {
	// 1. 金額のチェック (DB ルール: amount > 0)
	if (
		typeof data.amount !== "number" ||
		isNaN(data.amount) ||
		data.amount <= 0
	) {
		throw new Error("金額は0より大きい数値を入力してください。");
	}

	// 2. 日付のチェック (DB ルール: timestamp)
	if (!data.date) {
		throw new Error("日付を指定してください。");
	}
	const dateObj = new Date(data.date);
	if (isNaN(dateObj.getTime())) {
		throw new Error("有効な日付形式ではありません。");
	}

	// 3. 取引種別のチェック (DB ルール: type in ['expense', 'income', 'transfer'])
	if (!["expense", "income", "transfer"].includes(data.type)) {
		throw new Error("無効な取引種別です。");
	}

	// 4. 種別ごとの必須項目と論理整合性のチェック
	// accountId は廃止。fromAccountId は全ての場合に必須。
	if (!data.fromAccountId || typeof data.fromAccountId !== "string") {
		throw new Error("口座を指定してください。");
	}

	if (data.type === "transfer") {
		// 振替の場合、toAccountId も必須。
		if (!data.toAccountId || typeof data.toAccountId !== "string") {
			throw new Error("振替先口座を指定してください。");
		}
		// 【論理整合性】振替元と先が同じであってはならない。
		if (data.fromAccountId === data.toAccountId) {
			throw new Error("振替元と振替先には異なる口座を指定してください。");
		}
	} else {
		// 支出・収入の場合、カテゴリも必須。
		if (!data.categoryId || typeof data.categoryId !== "string") {
			throw new Error("カテゴリを指定してください。");
		}
	}
}

/**
 * ログインユーザーの口座残高ドキュメントのリアルタイム更新を購読する。
 * Cloud Functions による残高計算の結果を即座に UI に反映させるために使用する。
 * @param onUpdate - ドキュメントが更新された際に呼び出されるコールバック関数。
 * @returns 購読解除関数。
 */
export function subscribeAccountBalances(
	onUpdate: (balances: AccountBalances) => void,
): () => void {
	if (!auth.currentUser) return () => {};
	const userId = auth.currentUser.uid;

	// account_balances/{userId} ドキュメントの変更を検知
	return onSnapshot(
		doc(db, "account_balances", userId),
		(docSnap) => {
			if (docSnap.exists()) {
				onUpdate(docSnap.data() as AccountBalances);
			} else {
				onUpdate({});
			}
		},
		(error) => {
			if (error.code !== "aborted") {
				console.error("[Store] Account balances listener error:", error);
			}
		},
	);
}

/**
 * FCM トークン情報の最小型。
 */
export interface FcmTokenRecord {
	id: string;
	token: string;
	updatedAt?: unknown;
	deviceInfo?: string;
}

/**
 * ユーザーの登録済み FCM トークン一覧を取得する。
 * @returns トークン情報の配列。
 */
export async function getFcmTokens(): Promise<FcmTokenRecord[]> {
	if (!auth.currentUser) return [];
	const userId = auth.currentUser.uid;
	const tokensRef = collection(db, "user_fcm_tokens", userId, "tokens");
	const q = query(tokensRef, orderBy("updatedAt", "desc"));
	const snapshot = await getDocs(q);
	return snapshot.docs.map(
		(doc) => ({ id: doc.id, ...doc.data() }) as FcmTokenRecord,
	);
}

/**
 * FCM トークンをユーザー情報として保存する。
 * 通知送信の宛先として使用される。
 * @param token - FCM トークン。
 */
export async function saveFcmToken(token: string): Promise<void> {
	if (!auth.currentUser) return;
	const userId = auth.currentUser.uid;

	const userRef = doc(db, "user_fcm_tokens", userId);
	const tokenRef = doc(userRef, "tokens", token);

	// 1. 親ドキュメントを明示的に作成/更新する（これでクエリに引っかかるようになる）。
	// （merge: true なので既存データは消えない）。
	await setDoc(
		userRef,
		{
			lastUpdatedAt: serverTimestamp(),
		},
		{ merge: true },
	);

	// 2. トークンをサブコレクションに保存する。
	await setDoc(
		tokenRef,
		{
			token: token,
			updatedAt: serverTimestamp(),
			deviceInfo: navigator.userAgent,
		},
		{ merge: true },
	);
}

/**
 * 指定された FCM トークンを削除する。
 * 特定のブラウザ/デバイスの通知のみを解除する場合に使用する。
 * @param token - 削除する FCM トークン。
 */
export async function deleteFcmToken(token: string): Promise<void> {
	if (!auth.currentUser) return;
	const userId = auth.currentUser.uid;
	const tokenRef = doc(db, "user_fcm_tokens", userId, "tokens", token);
	await deleteDoc(tokenRef);
}
