import * as utils from "../utils.js";
import * as notification from "./notification.js";
import * as scanConfirm from "./scan_confirm.js";
import * as scanner from "./scanner.js";

/**
 * レシートスキャン開始モーダルのUI要素をまとめたオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	modal: utils.dom.get("scan-start-modal"),
	closeButton: utils.dom.get("close-scan-start-button"),
	content: utils.dom.get("scan-start-content"),
	loading: utils.dom.get("scan-loading-content"),

	btnCamera: utils.dom.get("scan-camera-button"),
	btnUpload: utils.dom.get("scan-upload-button"),
	fileCamera: utils.dom.get("scan-file-camera"),
	fileUpload: utils.dom.get("scan-file-upload"),

	btnCancel: utils.dom.get("scan-cancel-analysis-button"),
	scanFab: utils.dom.get("scan-receipt-fab"),
};

/**
 * 画像解析中かどうかを示すフラグ。
 * 解析実行中にモーダルを閉じたり、重複して解析を開始したりするのを防ぐ。
 * @type {boolean}
 */
let isAnalyzing = false;

/**
 * 設定取得用のコールバック関数。
 * @type {function}
 */
let getConfig = () => ({});

/**
 * マスタデータ取得用のコールバック関数。
 * @type {function}
 */
let getLuts = () => ({ accounts: new Map(), categories: new Map() });

/**
 * レシートスキャン開始モーダルを初期化する。
 * イベントリスナーの設定と、ファイル選択時の解析フローを定義する。
 * @param {object} params - 初期化パラメータ。
 * @param {function} params.onOpen - モーダルを開くトリガーが押された時に実行されるコールバック関数。
 * @param {function} params.getConfig - 最新のアプリ設定を取得するコールバック関数。
 * @param {function} params.getLuts - 最新のマスタデータを取得するコールバック関数。
 * @returns {void}
 */
export function init({
	onOpen,
	getConfig: getConfigCallback,
	getLuts: getLutsCallback,
} = {}) {
	if (getConfigCallback) getConfig = getConfigCallback;
	if (getLutsCallback) getLuts = getLutsCallback;

	const handleClose = () => {
		if (isAnalyzing) return; // 解析中はモーダルを閉じない
		closeModal();
	};
	utils.dom.on(elements.closeButton, "click", handleClose);
	utils.dom.on(elements.modal, "click", (e) => {
		if (e.target === elements.modal) handleClose();
	});

	// FABクリックでモーダルを開く
	if (elements.scanFab) {
		utils.dom.on(elements.scanFab, "click", () => {
			if (onOpen) onOpen();
			else openModal();
		});
	}

	// 解析キャンセルボタンの処理
	if (elements.btnCancel) {
		utils.dom.on(elements.btnCancel, "click", () => {
			isAnalyzing = false;
			showLoading(false); // UIをローディング状態から選択画面に戻す
			// ファイル選択をリセットする
			elements.fileCamera.value = "";
			elements.fileUpload.value = "";
		});
	}

	// 「カメラで撮影」「アルバムから選択」ボタンのクリックイベント
	utils.dom.on(elements.btnCamera, "click", () => elements.fileCamera.click());
	utils.dom.on(elements.btnUpload, "click", () => elements.fileUpload.click());

	// ファイルが選択された後の処理
	const handleFileSelect = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		// 解析開始
		isAnalyzing = true; // ★フラグを立てる
		showLoading(true);

		try {
			// Gemini解析実行
			const config = getConfig();
			const luts = getLuts();
			const scanSettings = config.scanSettings || {};
			const data = await scanner.scanReceipt(file, scanSettings, luts);

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

	utils.dom.on(elements.fileCamera, "change", handleFileSelect);
	utils.dom.on(elements.fileUpload, "change", handleFileSelect);
}

/**
 * スキャン開始モーダルを開く。
 * 状態をリセットし、ユーザーが新しいスキャンを開始できるようにする。
 * @returns {void}
 */
export function openModal() {
	isAnalyzing = false;
	showLoading(false);
	utils.dom.show(elements.modal);
	document.body.classList.add("modal-open");
}

/**
 * スキャン開始モーダルを閉じる。
 * 解析実行中の場合は、誤操作防止のため閉じる操作をブロックする。
 * @returns {void}
 */
export function closeModal() {
	// main.jsのEscキー制御など、外部から呼ばれた場合も解析中はブロックする
	if (isAnalyzing) return;

	utils.dom.hide(elements.modal);
	document.body.classList.remove("modal-open");
}

/**
 * モーダルが開いているかどうかを判定する。
 * キーボードショートカットなどの制御に使用する。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	return utils.dom.isVisible(elements.modal);
}

/**
 * モーダル内の表示を「選択画面」と「ローディング画面」で切り替える。
 * 解析中はユーザー操作を制限し、進行状況を視覚的に伝える。
 * @private
 * @param {boolean} isLoading - trueの場合、ローディング画面を表示する。
 * @returns {void}
 */
function showLoading(isLoading) {
	utils.dom.toggle(elements.content, !isLoading);
	utils.dom.toggle(elements.loading, isLoading);
	utils.dom.toggle(elements.closeButton, !isLoading); // ローディング中は閉じるボタンも隠す
}
