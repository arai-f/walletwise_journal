/**
 * サイドメニュー（ナビゲーション）のUIロジックを管理するモジュール。
 * メニューの開閉、ユーザー情報の表示、ログアウト、マスク切り替えなどを担当する。
 */

const elements = {
	menuButton: document.getElementById("menu-button"),
	menuPanel: document.getElementById("menu-panel"),
	menuOverlay: document.getElementById("menu-overlay"),
	menuUserAvatar: document.getElementById("menu-user-avatar"),
	menuUserPlaceholder: document.getElementById("menu-user-avatar-placeholder"),
	maskToggle: document.getElementById("mask-toggle"),
	menuLogoutButton: document.getElementById("menu-logout-button"),
	settingsButton: document.getElementById("settings-button"),
	guideButton: document.getElementById("guide-button"),
	reportButton: document.getElementById("report-button"),
	menuLinks: document.querySelectorAll(".menu-link"),
};

/**
 * メニューを開く
 */
export function openMenu() {
	elements.menuPanel.classList.remove("-translate-x-full");
	elements.menuOverlay.classList.remove("hidden");
	document.body.classList.add("overflow-hidden");
}

/**
 * メニューを閉じる
 */
export function closeMenu() {
	elements.menuPanel.classList.add("-translate-x-full");
	elements.menuOverlay.classList.add("hidden");
	document.body.classList.remove("overflow-hidden");
}

/**
 * メニューモジュールを初期化する。
 * イベントリスナーを設定する。
 * @param {object} callbacks - コールバック関数群
 * @param {function} callbacks.onMaskChange - 金額マスク切り替え時のコールバック
 * @param {function} callbacks.onLogout - ログアウト時のコールバック
 * @param {function} callbacks.onSettingsOpen - 設定画面を開く時のコールバック
 * @param {function} callbacks.onGuideOpen - ガイド画面を開く時のコールバック
 * @param {function} callbacks.onReportOpen - レポート画面を開く時のコールバック
 */
export function init({
	onMaskChange,
	onLogout,
	onSettingsOpen,
	onGuideOpen,
	onReportOpen,
}) {
	// メニュー開閉
	elements.menuButton.addEventListener("click", () => {
		elements.menuPanel.classList.contains("-translate-x-full")
			? openMenu()
			: closeMenu();
	});
	elements.menuOverlay.addEventListener("click", closeMenu);

	// メニュー内のリンククリックで、該当セクションへスクロールしメニューを閉じる
	elements.menuLinks.forEach((link) =>
		link.addEventListener("click", (e) => {
			// 内部リンク(#)の場合のみスクロール処理を行う
			const targetId = link.getAttribute("href");
			if (targetId && targetId.startsWith("#")) {
				e.preventDefault();
				closeMenu();
				const targetElement = document.querySelector(targetId);
				if (targetElement) targetElement.scrollIntoView({ behavior: "smooth" });
			}
		})
	);

	// 金額マスク切替
	elements.maskToggle.addEventListener("change", (e) => {
		if (onMaskChange) onMaskChange(e.target.checked);
	});

	// ログアウト
	elements.menuLogoutButton.addEventListener("click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onLogout) onLogout();
	});

	// 設定
	elements.settingsButton.addEventListener("click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onSettingsOpen) onSettingsOpen();
	});

	// ガイド
	elements.guideButton.addEventListener("click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onGuideOpen) onGuideOpen();
	});

	// 年間レポート
	elements.reportButton.addEventListener("click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onReportOpen) onReportOpen();
	});
}

/**
 * ユーザー情報をメニューに表示する。
 * @param {object} user - Firebase Userオブジェクト
 */
export function updateUser(user) {
	if (user.photoURL) {
		elements.menuUserAvatar.src = user.photoURL;
		elements.menuUserAvatar.classList.remove("hidden");
		elements.menuUserPlaceholder.classList.add("hidden");
	} else {
		elements.menuUserAvatar.classList.add("hidden");
		elements.menuUserPlaceholder.classList.remove("hidden");
	}
}

/**
 * メニューボタンを表示する
 */
export function showButton() {
	elements.menuButton.classList.remove("hidden");
}

/**
 * メニューボタンを非表示にする
 */
export function hideButton() {
	elements.menuButton.classList.add("hidden");
}
