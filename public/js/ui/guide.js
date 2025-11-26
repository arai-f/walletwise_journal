/**
 * ガイドモーダルのUI要素をまとめたオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	modal: document.getElementById("guide-modal"),
	contentContainer: document.getElementById("guide-content-container"),
	closeButton: document.getElementById("close-guide-modal-button"),
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
	elements.closeButton.addEventListener("click", closeModal);
	elements.modal.addEventListener("click", (e) => {
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
			elements.contentContainer.innerHTML = html;
			isGuideLoaded = true;
		} catch (error) {
			elements.contentContainer.innerHTML = `<p class="text-danger">${error.message}</p>`;
		}
	}

	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open");
}

/**
 * ガイドモーダルを閉じる。
 * モーダルを非表示にし、背景のスクロールロックを解除する。
 */
export function closeModal() {
	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open");
}

/**
 * ガイドモーダルが開いているかどうかを判定する。
 * キーボードショートカットなどの制御に使用する。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	return !elements.modal.classList.contains("hidden");
}
