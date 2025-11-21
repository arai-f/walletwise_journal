import * as scanConfirm from "./scan_confirm.js";
import * as scanner from "./scanner.js";

/**
 * レシートスキャン開始モーダルのUI要素をまとめたオブジェクト。
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
};

/**
 * 画像解析中かどうかを示すフラグ。
 * @type {boolean}
 */
let isAnalyzing = false;

/**
 * レシートスキャン開始モーダルを初期化する。
 */
export function init() {
	const handleClose = () => {
		if (isAnalyzing) return; // 解析中はモーダルを閉じない
		close();
	};
	elements.closeButton.addEventListener("click", handleClose);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) handleClose();
	});

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
			close();
			scanConfirm.open(data, file);
		} catch (err) {
			// 解析中にキャンセルされていた場合はエラー表示もしない
			if (!isAnalyzing) return;

			alert(err.message);
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
 */
export function open() {
	isAnalyzing = false;
	showLoading(false);
	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open");
}

/**
 * スキャン開始モーダルを閉じる。解析中は閉じられない。
 */
export function close() {
	// main.jsのEscキー制御など、外部から呼ばれた場合も解析中はブロックする
	if (isAnalyzing) return;

	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open");
}

/**
 * モーダルが開いているかどうかを返す。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	return !elements.modal.classList.contains("hidden");
}

/**
 * モーダル内の表示を「選択画面」と「ローディング画面」で切り替える。
 * @private
 * @param {boolean} isLoading - trueの場合、ローディング画面を表示する。
 */
function showLoading(isLoading) {
	elements.content.classList.toggle("hidden", isLoading);
	elements.loading.classList.toggle("hidden", !isLoading);
	elements.closeButton.classList.toggle("hidden", isLoading); // ローディング中は閉じるボタンも隠す
}
