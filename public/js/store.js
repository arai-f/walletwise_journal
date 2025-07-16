// js/store.js

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	onSnapshot,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	where,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";

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

export async function fetchAllTransactions() {
	if (!auth.currentUser) return [];
	state.userId = auth.currentUser.uid;
	const q = query(
		collection(db, "transactions"),
		where("userId", "==", state.userId)
	);
	const querySnapshot = await getDocs(q);
	console.log(`[Firestore Read] 全件取得: ${querySnapshot.size} 件`);
	const allTransactions = querySnapshot.docs.map(convertDocToTransaction);
	allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
	return allTransactions;
}

export function subscribeToMonthlyTransactions(year, month, callback) {
	if (state.unsubscribe) state.unsubscribe();
	state.userId = auth.currentUser.uid;
	const startDate = new Date(year, month - 1, 1);
	const endDate = new Date(year, month, 1);

	const q = query(
		collection(db, "transactions"),
		where("userId", "==", state.userId),
		where("date", ">=", startDate),
		where("date", "<", endDate)
	);

	state.unsubscribe = onSnapshot(
		q,
		(querySnapshot) => {
			console.log(
				`[Firestore Read] ${year}年${month}月分: ${querySnapshot.size} 件`
			);
			const monthlyTransactions = querySnapshot.docs.map(
				convertDocToTransaction
			);
			monthlyTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
			callback(monthlyTransactions);
		},
		(error) => {
			console.error("月次データ購読エラー:", error);
		}
	);
}

export function getTransactionById(id, transactionsList) {
	return transactionsList.find((t) => t.id === id);
}

export async function saveTransaction(data) {
	const id = data.id;
	delete data.id;

	const transactionData = {
		...data,
		userId: state.userId,
		date: Timestamp.fromDate(new Date(data.date)),
		amount: Number(data.amount),
		updatedAt: serverTimestamp(),
	};

	if (id) {
		await setDoc(doc(db, "transactions", id), transactionData, { merge: true });
	} else {
		transactionData.createdAt = serverTimestamp();
		await addDoc(collection(db, "transactions"), transactionData);
	}
}

export async function deleteTransaction(id) {
	await deleteDoc(doc(db, "transactions", id));
}
