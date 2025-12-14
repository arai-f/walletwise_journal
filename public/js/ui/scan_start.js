import * as utils from "../utils.js";
import * as notification from "./notification.js";
import * as scanConfirm from "./scan_confirm.js";
import * as scanner from "./scanner.js";

/**
 * レシートスキャン開始モーダルのUI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
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
});

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

	const {
		closeButton,
		modal,
		scanFab,
		btnCancel,
		fileCamera,
		fileUpload,
		btnCamera,
		btnUpload,
	} = getElements();

	const handleClose = () => {
		if (isAnalyzing) return; // 解析中はモーダルを閉じない
		closeModal();
	};
	utils.dom.on(closeButton, "click", handleClose);
	utils.dom.on(modal, "click", (e) => {
		if (e.target === modal) handleClose();
	});

	// FABクリックでモーダルを開く
	if (scanFab) {
		utils.dom.on(scanFab, "click", () => {
			if (onOpen) onOpen();
			else openModal();
		});
	}

	// 解析キャンセルボタンの処理
	if (btnCancel) {
		utils.dom.on(btnCancel, "click", () => {
			isAnalyzing = false;
			showLoading(false); // UIをローディング状態から選択画面に戻す
			// ファイル選択をリセットする
			fileCamera.value = "";
			fileUpload.value = "";
		});
	}

	// 「カメラで撮影」「アルバムから選択」ボタンのクリックイベント
	utils.dom.on(btnCamera, "click", () => fileCamera.click());
	utils.dom.on(btnUpload, "click", () => fileUpload.click());

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

	utils.dom.on(fileCamera, "change", handleFileSelect);
	utils.dom.on(fileUpload, "change", handleFileSelect);
}

/**
 * スキャン開始モーダルを開く。
 * 状態をリセットし、ユーザーが新しいスキャンを開始できるようにする。
 * @returns {void}
 */
export function openModal() {
	const { modal } = getElements();
	isAnalyzing = false;
	showLoading(false);
	utils.dom.show(modal);
	utils.toggleBodyScrollLock(true);
}

/**
 * スキャン開始モーダルを閉じる。
 * 解析実行中の場合は、誤操作防止のため閉じる操作をブロックする。
 * @returns {void}
 */
export function closeModal() {
	const { modal } = getElements();
	// main.jsのEscキー制御など、外部から呼ばれた場合も解析中はブロックする
	if (isAnalyzing) return;

	utils.toggleBodyScrollLock(false);
	utils.dom.hide(modal);
}

/**
 * モーダルが開いているかどうかを判定する。
 * キーボードショートカットなどの制御に使用する。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	const { modal } = getElements();
	return utils.dom.isVisible(modal);
}

/**
 * モーダル内の表示を「選択画面」と「ローディング画面」で切り替える。
 * 解析中はユーザー操作を制限し、進行状況を視覚的に伝える。
 * @private
 * @param {boolean} isLoading - trueの場合、ローディング画面を表示する。
 * @returns {void}
 */
function showLoading(isLoading) {
	const { content, loading, closeButton } = getElements();
	utils.dom.toggle(content, !isLoading);
	utils.dom.toggle(loading, isLoading);
	utils.dom.toggle(closeButton, !isLoading); // ローディング中は閉じるボタンも隠す
}
