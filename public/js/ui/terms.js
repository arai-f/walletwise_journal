import { config } from "../config.js";
import * as utils from "../utils.js";

/**
 * モーダル内のDOM要素を取得する
 * @returns {Object} DOM要素のコレクション
 */
const getElements = () => ({
	modal: utils.dom.get("terms-modal"),
	title: utils.dom.get("terms-modal-title"),
	content: utils.dom.get("terms-content"),
	closeButton: utils.dom.get("close-terms-modal-button"),
	agreeButton: utils.dom.get("terms-agree-btn"),
	disagreeButton: utils.dom.get("terms-disagree-btn"),
	buttonContainer: utils.dom.get("terms-agree-btn").parentElement,
});

let isContentLoaded = false;

/**
 * 利用規約のコンテンツをロードし、バージョン情報を設定する
 * @async
 */
async function loadContent() {
	if (isContentLoaded) return;
	const { content } = getElements();
	try {
		const response = await fetch("terms.html");
		if (!response.ok) throw new Error("利用規約の読み込みに失敗しました。");
		content.innerHTML = await response.text();

		// バージョン番号を反映
		const versionElement = document.getElementById("terms-version-display");
		if (versionElement) {
			versionElement.textContent = config.termsVersion;
		}

		isContentLoaded = true;
	} catch (error) {
		console.error(error);
		content.innerHTML = `<p class="text-danger">${error.message}</p>`;
	}
}

/**
 * モジュールを初期化する
 * イベントリスナーを設定する
 */
export function init() {
	const { modal, closeButton } = getElements();
	utils.dom.on(closeButton, "click", close);
	utils.dom.on(modal, "click", (e) => {
		if (e.target === modal) {
			close();
		}
	});
}

/**
 * 利用規約ビューアー（同意ボタンなし）を開く
 * @async
 */
export async function openViewer() {
	const { modal, title, closeButton, buttonContainer } = getElements();
	await loadContent();

	title.textContent = "利用規約";
	utils.dom.hide(buttonContainer);
	utils.dom.show(closeButton);

	utils.dom.show(modal);
	utils.toggleBodyScrollLock(true);
}

/**
 * 利用規約同意画面（同意/拒否ボタンあり）を開く
 * @async
 * @param {Function} onAgree - 同意ボタンクリック時のコールバック
 * @param {Function} onDisagree - 拒否ボタンクリック時のコールバック
 */
export async function openAgreement(onAgree, onDisagree) {
	const {
		modal,
		title,
		closeButton,
		agreeButton,
		disagreeButton,
		buttonContainer,
	} = getElements();
	await loadContent();

	title.textContent = "利用規約への同意";
	utils.dom.show(buttonContainer);
	utils.dom.hide(closeButton);

	// Remove old listeners before adding new ones
	const newAgreeBtn = agreeButton.cloneNode(true);
	agreeButton.parentNode.replaceChild(newAgreeBtn, agreeButton);
	utils.dom.on(newAgreeBtn, "click", onAgree);

	const newDisagreeBtn = disagreeButton.cloneNode(true);
	disagreeButton.parentNode.replaceChild(newDisagreeBtn, disagreeButton);
	utils.dom.on(newDisagreeBtn, "click", onDisagree);

	utils.dom.show(modal);
	utils.toggleBodyScrollLock(true);
}

/**
 * 利用規約モーダルを閉じる
 */
export function close() {
	const { modal } = getElements();
	utils.dom.hide(modal);
	utils.toggleBodyScrollLock(false);
}

/**
 * 利用規約モーダルが開いているかどうかを返す
 * @returns {boolean} 開いている場合はtrue
 */
export function isOpen() {
	const { modal } = getElements();
	return utils.dom.isVisible(modal);
}
