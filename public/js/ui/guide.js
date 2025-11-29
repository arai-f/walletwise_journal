import * as utils from "../utils.js";

/**
 * ガイドモーダルのUI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
	modal: utils.dom.get("guide-modal"),
	contentContainer: utils.dom.get("guide-content-container"),
	closeButton: utils.dom.get("close-guide-modal-button"),
});

/**
 * ガイドのHTMLコンテンツが読み込み済みかどうかを示すフラグ。
 * 重複したフェッチリクエストを防ぐために使用する。
 * @type {boolean}
 */
let isGuideLoaded = false;

/**
 * ガイドモジュールを初期化する。
 * モーダルを閉じるためのイベントリスナーを設定する。
 * @returns {void}
 */
export function init() {
	const { closeButton, modal } = getElements();
	utils.dom.on(closeButton, "click", closeModal);
	utils.dom.on(modal, "click", (e) => {
		if (e.target === modal) closeModal();
	});
}

/**
 * ガイドモーダルを開く。
 * 初回表示時にHTMLコンテンツを非同期で読み込み、コンテナに挿入する。
 * @async
 * @returns {Promise<void>}
 */
export async function openModal() {
	const { contentContainer, modal } = getElements();
	// まだ読み込んでいなければ、guide.htmlをフェッチする
	if (!isGuideLoaded) {
		try {
			const response = await fetch("/guide.html");
			if (!response.ok) throw new Error("ガイドの読み込みに失敗しました。");
			const html = await response.text();
			utils.dom.setHtml(contentContainer, html);
			isGuideLoaded = true;
		} catch (error) {
			utils.dom.setHtml(
				contentContainer,
				`<p class="text-danger">${error.message}</p>`
			);
		}
	}

	utils.dom.show(modal);
	document.body.classList.add("modal-open");
}

/**
 * ガイドモーダルを閉じる。
 * モーダルを非表示にし、背景のスクロールロックを解除する。
 * @returns {void}
 */
export function closeModal() {
	const { modal } = getElements();
	utils.dom.hide(modal);
	document.body.classList.remove("modal-open");
}

/**
 * ガイドモーダルが開いているかどうかを判定する。
 * キーボードショートカットなどの制御に使用する。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	const { modal } = getElements();
	return utils.dom.isVisible(modal);
}
