/**
 * ガイドモーダルのUI要素をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	modal: document.getElementById("guide-modal"),
	contentContainer: document.getElementById("guide-content-container"),
	closeButton: document.getElementById("close-guide-modal-button"),
};

/**
 * ガイドのHTMLコンテンツが読み込み済みかどうかを示すフラグ。
 * @type {boolean}
 */
let isGuideLoaded = false;

/**
 * ガイドモジュールを初期化する。
 */
export function init() {
	elements.closeButton.addEventListener("click", close);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) close();
	});
}

/**
 * ガイドモーダルを開く。初回表示時にHTMLコンテンツを非同期で読み込む。
 * @async
 */
export async function open() {
	// まだ読み込んでいなければ、guide.htmlをフェッチする
	if (!isGuideLoaded) {
		try {
			const response = await fetch("./guide.html");
			if (!response.ok) throw new Error("ガイドの読み込みに失敗しました。");
			const html = await response.text();
			elements.contentContainer.innerHTML = html;
			isGuideLoaded = true;
		} catch (error) {
			elements.contentContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
		}
	}

	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open");
}

/**
 * ガイドモーダルを閉じる。
 */
export function close() {
	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open");
}

/**
 * ガイドモーダルが開いているかどうかを返す。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	return !elements.modal.classList.contains("hidden");
}
