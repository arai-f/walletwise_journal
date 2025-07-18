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
	where,
	writeBatch,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";

export const isLocalDevelopment =
	window.location.hostname === "localhost" ||
	window.location.hostname === "127.0.0.1";
// export const isLocalDevelopment = false;

const state = {
	userId: null,
	unsubscribe: null,
};

const convertDocToTransaction = (doc) => {
	const data = doc.data();
	return {
		id: doc.id,
		...data,
		date: data.date.toDate(),
	};
};

export async function fetchAccountBalances() {
	if (isLocalDevelopment || !auth.currentUser) return {};

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

async function updateBalances(
	transaction,
	operationType,
	oldTransaction = null
) {
	if (isLocalDevelopment) return;

	const batch = writeBatch(db);
	const balanceRef = doc(db, "account_balances", state.userId);
	const balanceSnap = await getDoc(balanceRef);
	const currentBalances = balanceSnap.exists() ? balanceSnap.data() : {};

	const updateBalance = (account, amount) => {
		if (currentBalances[account] !== undefined) {
			currentBalances[account] += amount;
		} else {
			currentBalances[account] = amount;
		}
	};

	if (operationType === "delete" || operationType === "edit") {
		const t = oldTransaction || transaction;
		// 古い取引の影響を取り消す
		if (t.type === "transfer") {
			updateBalance(t.fromAccount, t.amount);
			updateBalance(t.toAccount, -t.amount);
		} else {
			const sign = t.type === "income" ? -1 : 1;
			updateBalance(t.paymentMethod, t.amount * sign);
		}
	}

	if (operationType === "add" || operationType === "edit") {
		// 新しい取引の影響を追加する
		if (transaction.type === "transfer") {
			updateBalance(transaction.fromAccount, -transaction.amount);
			updateBalance(transaction.toAccount, transaction.amount);
		} else {
			const sign = transaction.type === "income" ? 1 : -1;
			updateBalance(transaction.paymentMethod, transaction.amount * sign);
		}
	}

	batch.set(balanceRef, currentBalances, { merge: true });
	await batch.commit();
}

export async function fetchLocalTransactions() {
	try {
		const response = await fetch("../transactions.json");
		if (!response.ok) throw new Error("transactions.jsonの読み込みエラー");
		let transactions = await response.json();
		console.log(
			`[Local Read] ローカルファイルから ${transactions.length} 件読み込み`
		);

		// JSONのタイムスタンプ文字列をDateオブジェクトに変換
		transactions = transactions.map((t) => ({
			...t,
			date: new Date(t.date.seconds * 1000),
		}));

		transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
		return transactions;
	} catch (error) {
		console.error(error);
		alert("ローカルデータの読み込みに失敗しました。");
		return [];
	}
}

export async function fetchTransactionsForPeriod(months) {
	if (isLocalDevelopment || !auth.currentUser) return [];

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

export function getTransactionById(id, transactionsList) {
	return transactionsList.find((t) => t.id === id);
}

export async function saveTransaction(data, config, oldTransaction = null) {
	if (isLocalDevelopment) {
		alert("ローカル開発モードでは保存できません。");
		return;
	}

	const id = data.id;
	delete data.id;

	const transactionData = {
		...data,
		userId: state.userId,
		date: Timestamp.fromDate(new Date(data.date)),
		amount: Number(data.amount),
		updatedAt: serverTimestamp(),
	};

	const isCreditCardPayment =
		data.type === "transfer" && config.liabilities.includes(data.toAccount);

	if (id) {
		// 編集
		await setDoc(doc(db, "transactions", id), transactionData, { merge: true });
		await updateBalances(data, "edit", oldTransaction);
	} else {
		// 新規追加
		const newDocRef = await addDoc(
			collection(db, "transactions"),
			transactionData
		);
		await updateBalances(data, "add");

		// もし、この取引がクレジット支払いのために作られたものなら...
		if (isCreditCardPayment && data.metadata && data.metadata.closingDate) {
			await markBillCycleAsPaid(data.toAccount, data.metadata.closingDate);
		}
	}
}

export async function deleteTransaction(transaction) {
	if (isLocalDevelopment) {
		alert("ローカル開発モードでは削除できません。");
		return;
	}

	await deleteDoc(doc(db, "transactions", transaction.id));
	await updateBalances(transaction, "delete");
}

export async function fetchPaidBillCycles() {
	if (isLocalDevelopment || !auth.currentUser) return {};
	const docRef = doc(db, "paid_bill_cycles", auth.currentUser.uid);
	const docSnap = await getDoc(docRef);
	return docSnap.exists() ? docSnap.data().paidUntil : {};
}

export async function markBillCycleAsPaid(cardName, closingDateStr) {
	if (isLocalDevelopment || !auth.currentUser) return;
	const userId = auth.currentUser.uid;
	const docRef = doc(db, "paid_bill_cycles", userId);

	// "paidUntil" フィールドに、カード名と締め日のマッピングを保存
	// 例: { "ANA JCB": "2025-07-15", "JAL VISA": "2025-07-15" }
	await setDoc(
		docRef,
		{
			paidUntil: {
				[cardName]: closingDateStr,
			},
		},
		{ merge: true } // 既存の他のカードのデータを上書きしないようにする
	);
	console.log(
		`${cardName} の ${closingDateStr} までの請求を支払い済みとして記録しました。`
	);
}

export async function fetchUserConfig(configTemplate) {
	if (isLocalDevelopment || !auth.currentUser) return configTemplate;
	const docRef = doc(db, "user_configs", auth.currentUser.uid);
	const docSnap = await getDoc(docRef);

	if (docSnap.exists()) {
		console.log("[Firestore Read] ユーザー設定を取得");
		return docSnap.data();
	} else {
		console.log(
			"ユーザー設定が存在しないため、テンプレートから新規作成します。"
		);
		// 新規ユーザーの場合、テンプレートを元にDBに設定を保存
		await saveUserConfig(configTemplate);
		return configTemplate;
	}
}

export async function saveUserConfig(configToSave) {
	if (isLocalDevelopment || !auth.currentUser) return;
	const docRef = doc(db, "user_configs", auth.currentUser.uid);
	await setDoc(docRef, configToSave);
	console.log("[Firestore Write] ユーザー設定を保存");
}

export async function remapCategoryAndUpdateTransactions(
	oldCategory,
	newCategory,
	type
) {
	if (isLocalDevelopment || !auth.currentUser) return;

	const q = query(
		collection(db, "transactions"),
		where("userId", "==", auth.currentUser.uid),
		where("type", "==", type),
		where("category", "==", oldCategory)
	);

	const querySnapshot = await getDocs(q);
	if (querySnapshot.empty) {
		console.log(`カテゴリ「${oldCategory}」を持つ取引は見つかりませんでした。`);
		return;
	}

	const batch = writeBatch(db);
	querySnapshot.forEach((docSnap) => {
		const docRef = doc(db, "transactions", docSnap.id);
		batch.update(docRef, { category: newCategory });
	});

	await batch.commit();
	console.log(
		`「${oldCategory}」から「${newCategory}」へ ${querySnapshot.size} 件の取引を振り替えました。`
	);
}
