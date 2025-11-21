const elements = {
	modal: document.getElementById("guide-modal"),
	contentContainer: document.getElementById("guide-content-container"),
	closeButton: document.getElementById("close-guide-modal-button"),
	// トリガーとなるボタンは main.js から渡されるか、main.js で制御する方が疎結合で良いですが、
	// ここではシンプルに「閉じる」機能と「中身」に集中させます。
};

let isGuideLoaded = false;

export function init() {
	// 閉じるボタンのイベントリスナー
	elements.closeButton.addEventListener("click", close);

	// モーダル背景クリックで閉じる
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) close();
	});
}

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
	document.body.classList.add("modal-open"); // スクロールロック
}

export function close() {
	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open"); // スクロールロック解除
}

// 状態確認用（main.jsのEscキー制御などで使う）
export function isOpen() {
	return !elements.modal.classList.contains("hidden");
}
