const functions = require("firebase-functions/v1");
const { FieldValue } = require("firebase-admin/firestore");
const { COLLECTIONS, db } = require("../shared/db");

/**
 * 取引データの変更（作成・更新・削除）を監視し、口座残高を自動的に更新する。
 * 冪等性を担保するため、イベントIDを使用して重複処理を防止する。
 * @fires Firestore - `account_balances` (残高更新), `processed_events` (重複防止), `user_configs` (最終更新日時) に書き込む。
 * @type {functions.CloudFunction}
 */
exports.onTransactionWrite = functions
	.region("asia-northeast1")
	.firestore.document(`${COLLECTIONS.TRANSACTIONS}/{transactionId}`)
	.onWrite(async (change, context) => {
		const eventId = context.eventId;
		const eventRef = db.collection(COLLECTIONS.PROCESSED_EVENTS).doc(eventId);

		const newData = change.after.exists ? change.after.data() : null;
		const oldData = change.before.exists ? change.before.data() : null;

		if (!newData && !oldData) return null;

		const userId = newData ? newData.userId : oldData.userId;
		const balanceRef = db.collection(COLLECTIONS.ACCOUNT_BALANCES).doc(userId);

		return db.runTransaction(async (transaction) => {
			// 1. 重複処理チェック
			const eventDoc = await transaction.get(eventRef);
			if (eventDoc.exists) {
				return;
			}

			// 2. クライアントが既に残高を更新済みの場合、Cloud Functionでの更新をスキップ
			if (newData?.balanceSource === "client") {
				console.log(
					`[onTransactionWrite] Transaction ${context.params.transactionId} was updated by client, skipping balance update`,
				);
				// イベント処理済みフラグのみ設定して終了
				transaction.set(eventRef, {
					processedAt: FieldValue.serverTimestamp(),
					transactionId: context.params.transactionId,
					skippedAt: FieldValue.serverTimestamp(),
				});
				return;
			}

			/**
			 * 指定された口座の残高を更新する内部ヘルパー関数。
			 * @param {string} accountId - 更新対象の口座ID。
			 * @param {number} amount - 加算する金額（負の値で減算）。
			 */
			const updateBalance = (accountId, amount) => {
				if (!accountId) return;
				transaction.set(
					balanceRef,
					{ [accountId]: FieldValue.increment(amount) },
					{ merge: true },
				);
			};

			// 2. 変更前のデータの影響を取り消す（逆操作）
			if (oldData) {
				const amount = Number(oldData.amount);
				switch (oldData.type) {
					case "income":
						updateBalance(oldData.fromAccountId, -amount);
						break;
					case "expense":
						updateBalance(oldData.fromAccountId, amount);
						break;
					case "transfer":
						updateBalance(oldData.fromAccountId, amount);
						updateBalance(oldData.toAccountId, -amount);
						break;
				}
			}

			// 3. 変更後のデータの影響を適用する
			if (newData) {
				const amount = Number(newData.amount);
				switch (newData.type) {
					case "income":
						updateBalance(newData.fromAccountId, amount);
						break;
					case "expense":
						updateBalance(newData.fromAccountId, -amount);
						break;
					case "transfer":
						updateBalance(newData.fromAccountId, -amount);
						updateBalance(newData.toAccountId, amount);
						break;
				}
			}

			// 4. イベント処理済みフラグを設定
			transaction.set(eventRef, {
				processedAt: FieldValue.serverTimestamp(),
				transactionId: context.params.transactionId,
			});

			// 5. ユーザーの最終更新日時を記録
			if (userId) {
				const configRef = db.collection(COLLECTIONS.USER_CONFIGS).doc(userId);
				transaction.set(
					configRef,
					{ lastEntryAt: FieldValue.serverTimestamp() },
					{ merge: true },
				);
			}
		});
	});
