import { zonedTimeToUtc } from "https://esm.sh/date-fns-tz@2.0.1";
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	runTransaction,
	serverTimestamp,
	setDoc,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { config as configTemplate } from "./config.js";
import { auth, db } from "./firebase.js";

export const isLocalDevelopment = window.location.hostname === "127.0.0.1";
// export const isLocalDevelopment = false;

const convertDocToTransaction = (doc) => {
	const data = doc.data();
	return {
		id: doc.id,
		...data,
		date: data.date.toDate(),
	};
};

let state = {};

export function init(appState) {
	state = appState;
}

async function fetchLocalData(filePath) {
	try {
		const response = await fetch(filePath);
		if (!response.ok) throw new Error(`${filePath}の読み込みエラー`);
		return await response.json();
	} catch (error) {
		return [];
	}
}

function blockWriteInLocal() {
	if (isLocalDevelopment) {
		alert("ローカル開発モードでは、データの保存・更新・削除はできません。");
		return true; // 処理をブロック
	}
	return false;
}

// データ取得関数群

async function createInitialUserData(userId) {
	const batch = writeBatch(db);
	const newAccounts = {};
	const newCategories = {};
	const initialBalances = {};

	// テンプレートから口座データを生成
	configTemplate.assets.forEach((name, index) => {
		const id = `acc_${Math.random().toString(36).substring(2, 12)}`;
		newAccounts[id] = {
			userId,
			name,
			type: "asset",
			order: index,
			isDeleted: false,
			icon: configTemplate.accountIcons[name] || "fa-solid fa-credit-card",
		};
		initialBalances[id] = 0; // 初期残高を0に設定
	});
	configTemplate.liabilities.forEach((name, index) => {
		const id = `acc_${Math.random().toString(36).substring(2, 12)}`;
		newAccounts[id] = {
			userId,
			name,
			type: "liability",
			order: index,
			isDeleted: false,
			icon: configTemplate.accountIcons[name] || "fa-solid fa-credit-card",
		};
		initialBalances[id] = 0; // 初期残高を0に設定
	});

	// テンプレートからカテゴリデータを生成
	configTemplate.incomeCategories.forEach((name, index) => {
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

export async function fetchAllUserData() {
	if (isLocalDevelopment) {
		const [accounts, categories, config] = await Promise.all([
			fetchLocalData("../local_data/user_accounts.json"),
			fetchLocalData("../local_data/user_categories.json"),
			fetchLocalData("../local_data/user_configs.json"),
		]);

		if (config.length === 0) {
			return await createInitialUserData(auth.currentUser.uid);
		} else {
			return { accounts, categories, config };
		}
	}

	if (!auth.currentUser) return { accounts: {}, categories: {}, config: {} };
	const userId = auth.currentUser.uid;

	// 3つのドキュメントを並行して取得
	const [accountsDoc, categoriesDoc, configDoc] = await Promise.all([
		getDoc(doc(db, "user_accounts", userId)),
		getDoc(doc(db, "user_categories", userId)),
		getDoc(doc(db, "user_configs", userId)),
	]);
	console.log(`[Firestore Read] ユーザーデータを取得`);

	// もしconfigドキュメントが存在しない場合 => 新規ユーザーと判断
	if (!configDoc.exists()) {
		console.log("新規ユーザーのため、初期設定を生成します。");
		return await createInitialUserData(userId);
	}

	// 既存ユーザーの場合
	return {
		accounts: accountsDoc.exists() ? accountsDoc.data().accounts : {},
		categories: categoriesDoc.exists() ? categoriesDoc.data().categories : {},
		config: configDoc.data(),
	};
}

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
		console.log("残高データが存在しません。");
		return null;
	}
}

export async function fetchTransactionsForPeriod(months) {
	if (isLocalDevelopment) {
		let transactions = await fetchLocalData("../local_data/transactions.json");
		// FirestoreのTimestampオブジェクトをDateオブジェクトに変換
		return transactions
			.map((t) => ({
				...t,
				date: new Date(t.date.seconds * 1000 + t.date.nanoseconds / 1000000),
			}))
			.sort((a, b) => b.date.getTime() - a.date.getTime());
	}
	if (!auth.currentUser) return [];

	state.userId = auth.currentUser.uid;

	const endDate = new Date();
	endDate.setHours(23, 59, 59, 999);
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - months);
	startDate.setDate(1);
	startDate.setHours(0, 0, 0, 0);

	const q = query(
		collection(db, "transactions"),
		where("userId", "==", state.userId),
		where("date", ">=", startDate),
		where("date", "<=", endDate),
		orderBy("date", "desc"), // ★まず日付で降順ソート
		orderBy("updatedAt", "desc") // ★更新日時で降順ソート
	);
	const querySnapshot = await getDocs(q);
	console.log(
		`[Firestore Read] ${months}ヶ月分の取引を取得: ${querySnapshot.size} 件`
	);
	return querySnapshot.docs.map(convertDocToTransaction);
}

// 書き込み系関数群（ローカル開発モードではブロック）

export async function saveTransaction(data, oldTransaction = null) {
	if (blockWriteInLocal()) return;

	const id = data.id;
	delete data.id;

	const transactionData = {
		...data,
		userId: auth.currentUser.uid,
		date: Timestamp.fromDate(zonedTimeToUtc(data.date, "Asia/Tokyo")),
		amount: Number(data.amount),
		updatedAt: serverTimestamp(),
	};

	if (id) {
		// --- 編集モード ---
		const docRef = doc(db, "transactions", id);
		await setDoc(docRef, transactionData, { merge: true });
		// 編集前後の差分を元に残高を更新
		await updateBalances(transactionData, "edit", oldTransaction);
	} else {
		// --- 新規追加モード ---
		await addDoc(collection(db, "transactions"), transactionData);
		// 新しい取引を元に残高を更新
		await updateBalances(transactionData, "add");
	}
}

export async function deleteTransaction(transaction) {
	if (blockWriteInLocal()) return;

	await deleteDoc(doc(db, "transactions", transaction.id));
	await updateBalances(transaction, "delete");
}

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

	// ドット記法で、マップに新しいキーと値を追加
	await updateDoc(docRef, { [`${mapFieldName}.${newId}`]: newData });
}

export async function updateItem(itemId, itemType, updateData) {
	if (blockWriteInLocal()) return;
	const collectionName =
		itemType === "account" ? "user_accounts" : "user_categories";
	const mapFieldName = itemType === "account" ? "accounts" : "categories";
	const docRef = doc(db, collectionName, auth.currentUser.uid);

	// ドット記法で、更新対象のフィールドだけを効率的に更新
	const updates = {};
	for (const key in updateData) {
		updates[`${mapFieldName}.${itemId}.${key}`] = updateData[key];
	}
	await updateDoc(docRef, updates);
}

export async function deleteItem(itemId, itemType) {
	if (blockWriteInLocal()) return;
	// isDeletedフラグを立てる (updateItemを再利用)
	await updateItem(itemId, itemType, { isDeleted: true });
}

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

export async function markBillCycleAsPaid(
	cardId,
	closingDateStr,
	creditCardRules
) {
	if (blockWriteInLocal()) return;
	const userId = auth.currentUser.uid;
	const configRef = doc(db, "user_configs", userId);
	const existingPaidCycleStr = creditCardRules[cardId]?.lastPaidCycle;

	// 新しい日付が、既存の日付より後である場合のみ更新
	if (!existingPaidCycleStr || closingDateStr > existingPaidCycleStr) {
		const fieldPath = `creditCardRules.${cardId}.lastPaidCycle`;
		await updateDoc(configRef, { [fieldPath]: closingDateStr });
	}
}

export async function updateAccountOrder(orderedIds) {
	if (blockWriteInLocal()) return;
	const docRef = doc(db, "user_accounts", auth.currentUser.uid);
	const updates = {};
	orderedIds.forEach((id, index) => {
		updates[`accounts.${id}.order`] = index;
	});
	await updateDoc(docRef, updates);
}

export async function updateCategoryOrder(orderedIds) {
	if (blockWriteInLocal()) return;
	const docRef = doc(db, "user_categories", auth.currentUser.uid);
	const updates = {};
	orderedIds.forEach((id, index) => {
		updates[`categories.${id}.order`] = index;
	});
	await updateDoc(docRef, updates);
}

export async function updateUserConfig(updateData) {
	if (blockWriteInLocal()) return;

	const userId = auth.currentUser.uid;
	const docRef = doc(db, "user_configs", userId);
	await setDoc(docRef, updateData, { merge: true });
}

// ヘルパー関数群

async function updateBalances(
	transaction,
	operationType,
	oldTransaction = null
) {
	if (blockWriteInLocal()) return;
	const balanceRef = doc(db, "account_balances", auth.currentUser.uid);

	// ★★★ Firestoreトランザクションを使用 ★★★
	await runTransaction(db, async (t) => {
		// 1. トランザクション内で、必ず最新の残高ドキュメントを取得
		const balanceSnap = await t.get(balanceRef);
		const currentBalances = balanceSnap.exists() ? balanceSnap.data() : {};

		const updateBalance = (accountId, amount) => {
			if (!accountId) return;
			currentBalances[accountId] = (currentBalances[accountId] || 0) + amount;
		};

		// 2. 影響を取り消す処理
		if (operationType === "edit" || operationType === "delete") {
			const tr = oldTransaction || transaction;
			const sign = tr.type === "income" ? -1 : 1;
			if (tr.type === "transfer") {
				updateBalance(tr.fromAccountId, tr.amount);
				updateBalance(tr.toAccountId, -tr.amount);
			} else {
				updateBalance(tr.accountId, tr.amount * sign);
			}
		}

		// 3. 影響を追加する処理
		if (operationType === "add" || operationType === "edit") {
			const tr = transaction;
			const sign = tr.type === "income" ? 1 : -1;
			if (tr.type === "transfer") {
				updateBalance(tr.fromAccountId, -tr.amount);
				updateBalance(tr.toAccountId, tr.amount);
			} else {
				updateBalance(tr.accountId, tr.amount * sign);
			}
		}

		// 4. トランザクション内で、計算後の新しい残高を書き込む
		t.set(balanceRef, currentBalances);
	});
}

export function getTransactionById(id, transactionsList) {
	return transactionsList.find((t) => t.id === id);
}
