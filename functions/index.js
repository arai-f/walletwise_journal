const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();
const db = admin.firestore();

/**
 * トランザクション（取引）の作成・更新・削除を監視し、
 * 関連する口座の残高を自動的に再計算して更新する関数
 */
exports.onTransactionWrite = functions.firestore
	.document("transactions/{transactionId}")
	.onWrite(async (change, context) => {
		const eventId = context.eventId;
		const eventRef = db.collection("processed_events").doc(eventId);

		// 変更前と変更後のデータを取得
		const newData = change.after.exists ? change.after.data() : null;
		const oldData = change.before.exists ? change.before.data() : null;

		if (!newData && !oldData) return null;

		const userId = newData ? newData.userId : oldData.userId;
		const balanceRef = db.collection("account_balances").doc(userId);

		// Firestoreトランザクションを開始
		return db.runTransaction(async (transaction) => {
			// 1. 既に処理済みのイベントかチェック
			const eventDoc = await transaction.get(eventRef);
			if (eventDoc.exists) {
				console.log(`Event ${eventId} already processed.`);
				return;
			}

			/**
			 * 残高更新用のヘルパー関数 (transactionを使用)
			 */
			const updateBalance = (accountId, amount) => {
				if (!accountId) return;
				transaction.set(
					balanceRef,
					{ [accountId]: FieldValue.increment(amount) },
					{ merge: true }
				);
			};

			// 2. 【取り消し処理】 古いデータの影響を逆算
			if (oldData) {
				const amount = Number(oldData.amount);
				if (oldData.type === "income") {
					updateBalance(oldData.accountId, -amount);
				} else if (oldData.type === "expense") {
					updateBalance(oldData.accountId, amount);
				} else if (oldData.type === "transfer") {
					updateBalance(oldData.fromAccountId, amount);
					updateBalance(oldData.toAccountId, -amount);
				}
			}

			// 3. 【適用処理】 新しいデータの影響を加算
			if (newData) {
				const amount = Number(newData.amount);
				if (newData.type === "income") {
					updateBalance(newData.accountId, amount);
				} else if (newData.type === "expense") {
					updateBalance(newData.accountId, -amount);
				} else if (newData.type === "transfer") {
					updateBalance(newData.fromAccountId, -amount);
					updateBalance(newData.toAccountId, amount);
				}
			}

			// 4. イベントを処理済みとしてマーク (30日後に自動削除されるようにTTLを設定するとベスト)
			transaction.set(eventRef, {
				processedAt: FieldValue.serverTimestamp(),
				transactionId: context.params.transactionId,
			});
		});
	});
