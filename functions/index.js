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
		// 変更前と変更後のデータを取得
		const newData = change.after.exists ? change.after.data() : null;
		const oldData = change.before.exists ? change.before.data() : null;

		// データがない（ありえないケース）は無視
		if (!newData && !oldData) return null;

		// ユーザーIDを取得（新規作成時はnewDataから、削除時はoldDataから）
		const userId = newData ? newData.userId : oldData.userId;
		const balanceRef = db.collection("account_balances").doc(userId);
		const batch = db.batch();

		/**
		 * 残高更新用のヘルパー関数
		 * FieldValue.incrementを使うことで、現在の値を読み込まずに差分更新できる
		 * @param {string} accountId - 口座ID
		 * @param {number} amount - 加算する金額（マイナスなら減算）
		 */
		const updateBalance = (accountId, amount) => {
			if (!accountId) return;
			batch.set(
				balanceRef,
				{ [accountId]: FieldValue.increment(amount) },
				{ merge: true }
			);
		};

		// 1. 【取り消し処理】 古いデータの影響を逆算する（更新・削除時）
		// 例: 1000円の支出を削除 -> 口座に1000円戻す（+1000）
		if (oldData) {
			const amount = Number(oldData.amount);
			if (oldData.type === "income") {
				updateBalance(oldData.accountId, -amount); // 収入の取消 = 減算
			} else if (oldData.type === "expense") {
				updateBalance(oldData.accountId, amount); // 支出の取消 = 加算
			} else if (oldData.type === "transfer") {
				updateBalance(oldData.fromAccountId, amount); // 出金の取消 = 加算
				updateBalance(oldData.toAccountId, -amount); // 入金の取消 = 減算
			}
		}

		// 2. 【適用処理】 新しいデータの影響を加算する（作成・更新時）
		// 例: 1000円の支出を作成 -> 口座から1000円引く（-1000）
		if (newData) {
			const amount = Number(newData.amount);
			if (newData.type === "income") {
				updateBalance(newData.accountId, amount); // 収入 = 加算
			} else if (newData.type === "expense") {
				updateBalance(newData.accountId, -amount); // 支出 = 減算
			} else if (newData.type === "transfer") {
				updateBalance(newData.fromAccountId, -amount); // 出金 = 減算
				updateBalance(newData.toAccountId, amount); // 入金 = 加算
			}
		}

		// まとめて書き込み（アトミックな更新）
		await batch.commit();
		console.log(`Transaction ${context.params.transactionId} processed.`);
	});
