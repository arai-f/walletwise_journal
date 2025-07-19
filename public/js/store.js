import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";

export const isLocalDevelopment =
	window.location.hostname === "localhost" ||
	window.location.hostname === "127.0.0.1";
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
		console.error(error);
		alert(`ローカルデータの読み込みに失敗しました: ${filePath}`);
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

export function fetchUserAccounts() {
	if (isLocalDevelopment)
		return fetchLocalData("../local_data/user_accounts.json");
	return fetchCollectionForUser("user_accounts");
}

export function fetchUserCategories() {
	if (isLocalDevelopment)
		return fetchLocalData("../local_data/user_categories.json");
	return fetchCollectionForUser("user_categories");
}

export async function fetchUserConfig() {
	if (isLocalDevelopment)
		return fetchLocalData("../local_data/user_configs.json");
	if (!auth.currentUser) return {};
	const docRef = doc(db, "user_configs", auth.currentUser.uid);
	const docSnap = await getDoc(docRef);
	console.log(`[Firestore Read] ユーザ設定を取得`);
	return docSnap.exists() ? docSnap.data() : {};
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
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - months);
	startDate.setDate(1);
	startDate.setHours(0, 0, 0, 0);

	const q = query(
		collection(db, "transactions"),
		where("userId", "==", state.userId),
		where("date", ">=", startDate),
		where("date", "<=", endDate)
	);
	const querySnapshot = await getDocs(q);
	console.log(
		`[Firestore Read] ${months}ヶ月分の取引を取得: ${querySnapshot.size} 件`
	);
	const transactions = querySnapshot.docs.map(convertDocToTransaction);
	transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
	return transactions;
}

// 書き込み系関数群（ローカル開発モードではブロック）

export async function saveTransaction(data, oldTransaction = null) {
	if (blockWriteInLocal()) return;

	const id = data.id;
	delete data.id;

	const transactionData = {
		...data,
		userId: state.userId,
		date: Timestamp.fromDate(new Date(data.date)),
		amount: Number(data.amount),
		updatedAt: serverTimestamp(),
	};

	// const isCreditCardPayment =
	// 	data.type === "transfer" && config.liabilities.includes(data.toAccount);

	if (id) {
		// 編集
		await setDoc(doc(db, "transactions", id), transactionData, { merge: true });
		await updateBalances(transactionData, "edit", oldTransaction);
	} else {
		// 新規追加
		const newDocRef = await addDoc(
			collection(db, "transactions"),
			transactionData
		);
		await updateBalances(transactionData, "add");

		// もし、この取引がクレジット支払いのために作られたものなら...
		if (isCreditCardPayment && data.metadata && data.metadata.closingDate) {
			await markBillCycleAsPaid(data.toAccount, data.metadata.closingDate);
		}
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
	const collectionName =
		type === "asset" || type === "liability"
			? "user_accounts"
			: "user_categories";
	const prefix = isAccount ? "acc_" : "cat_";
	const newId = `${prefix}${Math.random().toString(36).substring(2, 12)}`;
	const docRef = doc(db, collectionName, newId);

	const newData = {
		userId: auth.currentUser.uid,
		name: name,
		type: type,
		isDeleted: false,
		order: order,
	};

	await setDoc(docRef, newData);
}

export async function updateItem(itemId, itemType, updateData) {
	if (blockWriteInLocal()) return;

	const collectionName =
		itemType === "account" ? "user_accounts" : "user_categories";
	const docRef = doc(db, collectionName, itemId);
	await updateDoc(docRef, updateData);
}

export async function deleteItem(itemId, itemType) {
	if (blockWriteInLocal()) return;

	const collectionName =
		itemType === "account" ? "user_accounts" : "user_categories";
	const docRef = doc(db, collectionName, itemId);
	await updateDoc(docRef, { isDeleted: true });
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

export async function markBillCycleAsPaid(cardName, closingDateStr) {
	if (blockWriteInLocal()) return;

	const userId = auth.currentUser.uid;
	const docRef = doc(db, "user_configs", userId);

	// ドット記法を使い、特定のカードのlastPaidCycleフィールドのみを更新
	// 例: "creditCardRules.ANA JCB.lastPaidCycle"
	const fieldPath = `creditCardRules.${cardName}.lastPaidCycle`;

	await updateDoc(docRef, {
		[fieldPath]: closingDateStr,
	});

	console.log(
		`${cardName} の ${closingDateStr} までの請求を支払い済みとして記録しました。`
	);
}

export async function updateUserConfig(updateData) {
	if (blockWriteInLocal()) return;

	const userId = auth.currentUser.uid;
	const docRef = doc(db, "user_configs", userId);
	await updateDoc(docRef, updateData);
}

export async function updateAccountOrder(orderedIds) {
	if (blockWriteInLocal()) return;

	const batch = writeBatch(db);
	orderedIds.forEach((id, index) => {
		const docRef = doc(db, "user_accounts", id);
		batch.update(docRef, { order: index });
	});
	await batch.commit();
}

export async function updateCategoryOrder(orderedIds) {
	if (blockWriteInLocal()) return;

	const batch = writeBatch(db);
	orderedIds.forEach((id, index) => {
		const docRef = doc(db, "user_categories", id);
		batch.update(docRef, { order: index });
	});
	await batch.commit();
}

// ヘルパー関数群

async function updateBalances(
	transaction,
	operationType,
	oldTransaction = null
) {
	if (blockWriteInLocal()) return;

	const batch = writeBatch(db);
	const balanceRef = doc(db, "account_balances", state.userId);
	const balanceSnap = await getDoc(balanceRef);
	const currentBalances = balanceSnap.exists() ? balanceSnap.data() : {};

	// 口座IDをキーにして直接残高を更新する
	const updateBalance = (accountId, amount) => {
		if (!accountId) return; // accountIdがなければ何もしない
		currentBalances[accountId] = (currentBalances[accountId] || 0) + amount;
	};

	// 影響を取り消す処理
	if (operationType === "delete" || operationType === "edit") {
		const t = oldTransaction || transaction;
		const sign = t.type === "income" ? -1 : 1;
		if (t.type === "transfer") {
			updateBalance(t.fromAccountId, t.amount); // プラスに戻す
			updateBalance(t.toAccountId, -t.amount); // マイナスに戻す
		} else {
			updateBalance(t.accountId, t.amount * sign);
		}
	}

	// 影響を追加する処理
	if (operationType === "add" || operationType === "edit") {
		const t = transaction;
		const sign = t.type === "income" ? 1 : -1;
		if (t.type === "transfer") {
			updateBalance(t.fromAccountId, -t.amount); // マイナス
			updateBalance(t.toAccountId, t.amount); // プラス
		} else {
			updateBalance(t.accountId, t.amount * sign);
		}
	}
	// Firestoreに書き戻すデータは、IDがキーになった新しい残高オブジェクト
	batch.set(balanceRef, currentBalances);
	await batch.commit();
}

async function fetchCollectionForUser(collectionName) {
	if (isLocalDevelopment || !auth.currentUser) return [];
	const q = query(
		collection(db, collectionName),
		where("userId", "==", auth.currentUser.uid)
	);
	const querySnapshot = await getDocs(q);
	console.log(
		`[Firestore Read] ${collectionName} を取得: ${querySnapshot.size} 件`
	);
	return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export function getTransactionById(id, transactionsList) {
	return transactionsList.find((t) => t.id === id);
}
