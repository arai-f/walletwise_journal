import * as scanConfirm from "./scan_confirm.js";
import * as scanner from "./scanner.js";

const elements = {
	modal: document.getElementById("scan-start-modal"),
	closeButton: document.getElementById("close-scan-start-button"),
	content: document.getElementById("scan-start-content"),
	loading: document.getElementById("scan-loading-content"),

	btnCamera: document.getElementById("scan-camera-button"),
	btnUpload: document.getElementById("scan-upload-button"),
	fileCamera: document.getElementById("scan-file-camera"),
	fileUpload: document.getElementById("scan-file-upload"),

	// ★追加
	btnCancel: document.getElementById("scan-cancel-analysis-button"),
};

// ★解析中フラグ
let isAnalyzing = false;

export function init() {
	// 閉じるボタン（解析中はブロック）
	const handleClose = () => {
		if (isAnalyzing) return; // ★解析中は無視
		close();
	};
	elements.closeButton.addEventListener("click", handleClose);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) handleClose();
	});

	// ★キャンセルボタン（解析を中断して入力画面に戻る）
	if (elements.btnCancel) {
		elements.btnCancel.addEventListener("click", () => {
			isAnalyzing = false; // フラグを下ろす
			showLoading(false); // 入力画面に戻す
			// 入力をリセット
			elements.fileCamera.value = "";
			elements.fileUpload.value = "";
		});
	}

	// カメラ/アルバムボタン
	elements.btnCamera.addEventListener("click", () =>
		elements.fileCamera.click()
	);
	elements.btnUpload.addEventListener("click", () =>
		elements.fileUpload.click()
	);

	// ファイル選択後の処理
	const handleFileSelect = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		// 解析開始
		isAnalyzing = true; // ★フラグを立てる
		showLoading(true);

		try {
			// Gemini解析実行
			const data = await scanner.scanReceipt(file);

			// ★キャンセルされていたら何もしない
			if (!isAnalyzing) return;

			// 成功したのでフラグを下ろして閉じる
			isAnalyzing = false;
			close();
			scanConfirm.open(data, file);
		} catch (err) {
			// ★キャンセルされていたらエラーも無視
			if (!isAnalyzing) return;

			alert(err.message);
			isAnalyzing = false;
			showLoading(false); // エラー時は入力画面に戻す
		} finally {
			// inputをリセット
			e.target.value = "";
		}
	};

	elements.fileCamera.addEventListener("change", handleFileSelect);
	elements.fileUpload.addEventListener("change", handleFileSelect);
}

export function open() {
	isAnalyzing = false; // 初期化
	showLoading(false);
	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open");
}

export function close() {
	// ★外部（main.jsのEscキーなど）から呼ばれた場合も解析中はブロック
	if (isAnalyzing) return;

	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open");
}

export function isOpen() {
	return !elements.modal.classList.contains("hidden");
}

function showLoading(isLoading) {
	elements.content.classList.toggle("hidden", isLoading);
	elements.loading.classList.toggle("hidden", !isLoading);
	elements.closeButton.classList.toggle("hidden", isLoading); // ★閉じるボタンも隠す
}
