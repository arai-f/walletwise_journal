import * as utils from "../utils.js";

/**
 * サイドメニュー（ナビゲーション）のUIロジックを管理するモジュール。
 * メニューの開閉、ユーザー情報の表示、ログアウト、マスク切り替えなどを担当する。
 * @type {object}
 */
const elements = {
	menuButton: utils.dom.get("menu-button"),
	menuPanel: utils.dom.get("menu-panel"),
	menuOverlay: utils.dom.get("menu-overlay"),
	menuUserAvatar: utils.dom.get("menu-user-avatar"),
	menuUserPlaceholder: utils.dom.get("menu-user-avatar-placeholder"),
	maskToggle: utils.dom.get("mask-toggle"),
	menuLogoutButton: utils.dom.get("menu-logout-button"),
	settingsButton: utils.dom.get("settings-button"),
	guideButton: utils.dom.get("guide-button"),
	reportButton: utils.dom.get("report-button"),
	menuLinks: document.querySelectorAll(".menu-link"),
};

/**
 * メニューモジュールを初期化する。
 * 各種ボタンへのイベントリスナーを設定する。
 * @param {object} callbacks - コールバック関数群。
 * @param {function} callbacks.onMaskChange - 金額マスク切り替え時に実行されるコールバック関数。
 * @param {function} callbacks.onLogout - ログアウト時に実行されるコールバック関数。
 * @param {function} callbacks.onSettingsOpen - 設定画面を開く時に実行されるコールバック関数。
 * @param {function} callbacks.onGuideOpen - ガイド画面を開く時に実行されるコールバック関数。
 * @param {function} callbacks.onReportOpen - レポート画面を開く時に実行されるコールバック関数。
 * @returns {void}
 */
export function init({
	onMaskChange,
	onLogout,
	onSettingsOpen,
	onGuideOpen,
	onReportOpen,
}) {
	// メニュー開閉
	utils.dom.on(elements.menuButton, "click", () => {
		elements.menuPanel?.classList.contains("-translate-x-full")
			? openMenu()
			: closeMenu();
	});
	utils.dom.on(elements.menuOverlay, "click", closeMenu);

	// メニュー内のリンククリックで、該当セクションへスクロールしメニューを閉じる
	elements.menuLinks.forEach((link) =>
		utils.dom.on(link, "click", (e) => {
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
	utils.dom.on(elements.maskToggle, "change", (e) => {
		if (onMaskChange) onMaskChange(e.target.checked);
	});

	// ログアウト
	utils.dom.on(elements.menuLogoutButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onLogout) onLogout();
	});

	// 設定
	utils.dom.on(elements.settingsButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onSettingsOpen) onSettingsOpen();
	});

	// ガイド
	utils.dom.on(elements.guideButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onGuideOpen) onGuideOpen();
	});

	// 年間レポート
	utils.dom.on(elements.reportButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onReportOpen) onReportOpen();
	});
}

/**
 * メニューを開く。
 * オーバーレイを表示し、背景スクロールを無効化する。
 * @returns {void}
 */
export function openMenu() {
	elements.menuPanel?.classList.remove("-translate-x-full");
	utils.dom.show(elements.menuOverlay);
	document.body.classList.add("overflow-hidden");
}

/**
 * メニューを閉じる。
 * オーバーレイを非表示にし、背景スクロールを有効化する。
 * @returns {void}
 */
export function closeMenu() {
	elements.menuPanel?.classList.add("-translate-x-full");
	utils.dom.hide(elements.menuOverlay);
	document.body.classList.remove("overflow-hidden");
}

/**
 * ユーザー情報をメニューに表示する。
 * アイコン画像がある場合はそれを表示し、なければプレースホルダーを表示する。
 * @param {object} user - Firebase Userオブジェクト。
 * @returns {void}
 */
export function updateUser(user) {
	if (user.photoURL) {
		if (elements.menuUserAvatar) elements.menuUserAvatar.src = user.photoURL;
		utils.dom.show(elements.menuUserAvatar);
		utils.dom.hide(elements.menuUserPlaceholder);
	} else {
		utils.dom.hide(elements.menuUserAvatar);
		utils.dom.show(elements.menuUserPlaceholder);
	}
}

/**
 * メニューボタンを表示する。
 * @returns {void}
 */
export function showButton() {
	utils.dom.show(elements.menuButton);
}

/**
 * メニューボタンを非表示にする。
 * @returns {void}
 */
export function hideButton() {
	utils.dom.hide(elements.menuButton);
}

/**
 * メニューが開いているかどうかを判定する。
 * @returns {boolean} メニューが開いていればtrue。
 */
export function isOpen() {
	return !elements.menuPanel?.classList.contains("-translate-x-full");
}
