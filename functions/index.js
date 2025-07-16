// functions/index.js

const { onCall } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
// v2のBlocking Functionsをインポート
const { beforeUserCreated } = require("firebase-functions/v2/identity");

initializeApp();

/**
 * 登録を許可するメールアドレスのリスト（ホワイトリスト）
 * ここにあなたのメールアドレスを追加してください。
 * 複数許可する場合は、カンマで区切って追加します。
 * 例: ["user1@example.com", "user2@another.com"]
 */
const a_users = ["araifumiya1102@gmail.com"];

// 新しいユーザーが作成される直前にこの関数が実行されます
exports.beforeCreate = beforeUserCreated((event) => {
	const user = event.data;

	// 許可リストにユーザーのメールアドレスが含まれているかチェック
	if (!a_users.includes(user.email)) {
		// 含まれていなければ、エラーを投げて登録をブロックする
		throw new Error(
			`このメールアドレス (${user.email}) は登録が許可されていません。`
		);
	}

	// エラーがなければ、何も返さずに正常終了する（=登録が許可される）
	return;
});
