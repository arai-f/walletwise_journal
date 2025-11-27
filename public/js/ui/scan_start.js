import * as notification from "./notification.js";
import * as scanConfirm from "./scan_confirm.js";
import * as scanner from "./scanner.js";

/**
 * レシートスキャン開始モーダルのUI要素をまとめたオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	modal: document.getElementById("scan-start-modal"),
	closeButton: document.getElementById("close-scan-start-button"),
	content: document.getElementById("scan-start-content"),
	loading: document.getElementById("scan-loading-content"),

	btnCamera: document.getElementById("scan-camera-button"),
	btnUpload: document.getElementById("scan-upload-button"),
	fileCamera: document.getElementById("scan-file-camera"),
	fileUpload: document.getElementById("scan-file-upload"),

	btnCancel: document.getElementById("scan-cancel-analysis-button"),
	scanFab: document.getElementById("scan-receipt-fab"),
};

/**
 * 画像解析中かどうかを示すフラグ。
 * 解析実行中にモーダルを閉じたり、重複して解析を開始したりするのを防ぐ。
 * @type {boolean}
 */
let isAnalyzing = false;

/**
 * レシートスキャン開始モーダルを初期化する。
 * イベントリスナーの設定と、ファイル選択時の解析フローを定義する。
 * @param {object} params - 初期化パラメータ。
 * @param {function} params.onOpen - モーダルを開くトリガーが押された時に実行されるコールバック関数。
 * @returns {void}
 */
export function init({ onOpen } = {}) {
	const handleClose = () => {
		if (isAnalyzing) return; // 解析中はモーダルを閉じない
		closeModal();
	};
	elements.closeButton.addEventListener("click", handleClose);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) handleClose();
	});

	// FABクリックでモーダルを開く
	if (elements.scanFab) {
		elements.scanFab.addEventListener("click", () => {
			if (onOpen) onOpen();
			else openModal();
		});
	}

	// 解析キャンセルボタンの処理
	if (elements.btnCancel) {
		elements.btnCancel.addEventListener("click", () => {
			isAnalyzing = false;
			showLoading(false); // UIをローディング状態から選択画面に戻す
			// ファイル選択をリセットする
			elements.fileCamera.value = "";
			elements.fileUpload.value = "";
		});
	}

	// 「カメラで撮影」「アルバムから選択」ボタンのクリックイベント
	elements.btnCamera.addEventListener("click", () =>
		elements.fileCamera.click()
	);
	elements.btnUpload.addEventListener("click", () =>
		elements.fileUpload.click()
	);

	// ファイルが選択された後の処理
	const handleFileSelect = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		// 解析開始
		isAnalyzing = true; // ★フラグを立てる
		showLoading(true);

		try {
			// Gemini解析実行
			const data = await scanner.scanReceipt(file);

			// 解析中にユーザーがキャンセルしていた場合は何もしない
			if (!isAnalyzing) return;

			// 解析成功後、フラグをリセットして確認モーダルを開く
			isAnalyzing = false;
			closeModal();
			scanConfirm.openModal(data, file);
		} catch (err) {
			// 解析中にキャンセルされていた場合はエラー表示もしない
			if (!isAnalyzing) return;

			notification.error(
				"レシートの解析に失敗しました。もう一度お試しください。"
			);
			isAnalyzing = false;
			showLoading(false); // エラー発生時はUIを選択画面に戻す
		} finally {
			// inputをリセット
			e.target.value = "";
		}
	};

	elements.fileCamera.addEventListener("change", handleFileSelect);
	elements.fileUpload.addEventListener("change", handleFileSelect);
}

/**
 * スキャン開始モーダルを開く。
 * 状態をリセットし、ユーザーが新しいスキャンを開始できるようにする。
 */
export function openModal() {
	isAnalyzing = false;
	showLoading(false);
	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open");
}

/**
 * スキャン開始モーダルを閉じる。
 * 解析実行中の場合は、誤操作防止のため閉じる操作をブロックする。
 */
export function closeModal() {
	// main.jsのEscキー制御など、外部から呼ばれた場合も解析中はブロックする
	if (isAnalyzing) return;

	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open");
}

/**
 * モーダルが開いているかどうかを判定する。
 * キーボードショートカットなどの制御に使用する。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	return !elements.modal.classList.contains("hidden");
}

/**
 * モーダル内の表示を「選択画面」と「ローディング画面」で切り替える。
 * 解析中はユーザー操作を制限し、進行状況を視覚的に伝える。
 * @private
 * @param {boolean} isLoading - trueの場合、ローディング画面を表示する。
 */
function showLoading(isLoading) {
	elements.content.classList.toggle("hidden", isLoading);
	elements.loading.classList.toggle("hidden", !isLoading);
	elements.closeButton.classList.toggle("hidden", isLoading); // ローディング中は閉じるボタンも隠す
}
