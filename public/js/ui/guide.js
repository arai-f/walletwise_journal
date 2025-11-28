import * as utils from "../utils.js";

/**
 * ガイドモーダルのUI要素をまとめたオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	modal: utils.dom.get("guide-modal"),
	contentContainer: utils.dom.get("guide-content-container"),
	closeButton: utils.dom.get("close-guide-modal-button"),
};

/**
 * ガイドのHTMLコンテンツが読み込み済みかどうかを示すフラグ。
 * 重複したフェッチリクエストを防ぐために使用する。
 * @type {boolean}
 */
let isGuideLoaded = false;

/**
 * ガイドモジュールを初期化する。
 * モーダルを閉じるためのイベントリスナーを設定する。
 */
export function init() {
	utils.dom.on(elements.closeButton, "click", closeModal);
	utils.dom.on(elements.modal, "click", (e) => {
		if (e.target === elements.modal) closeModal();
	});
}

/**
 * ガイドモーダルを開く。
 * 初回表示時にHTMLコンテンツを非同期で読み込み、コンテナに挿入する。
 * @async
 */
export async function openModal() {
	// まだ読み込んでいなければ、guide.htmlをフェッチする
	if (!isGuideLoaded) {
		try {
			const response = await fetch("/guide.html");
			if (!response.ok) throw new Error("ガイドの読み込みに失敗しました。");
			const html = await response.text();
			utils.dom.setHtml(elements.contentContainer, html);
			isGuideLoaded = true;
		} catch (error) {
			utils.dom.setHtml(
				elements.contentContainer,
				`<p class="text-danger">${error.message}</p>`
			);
		}
	}

	utils.dom.show(elements.modal);
	document.body.classList.add("modal-open");
}

/**
 * ガイドモーダルを閉じる。
 * モーダルを非表示にし、背景のスクロールロックを解除する。
 */
export function closeModal() {
	utils.dom.hide(elements.modal);
	document.body.classList.remove("modal-open");
}

/**
 * ガイドモーダルが開いているかどうかを判定する。
 * キーボードショートカットなどの制御に使用する。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	return utils.dom.isVisible(elements.modal);
}
