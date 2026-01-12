import { config } from "../config.js";
import * as utils from "../utils.js";

/**
 * サイドメニュー（ナビゲーション）のUI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
	menuButton: utils.dom.get("menu-button"),
	menuPanel: utils.dom.get("menu-panel"),
	menuOverlay: utils.dom.get("menu-overlay"),
	menuUserAvatar: utils.dom.get("menu-user-avatar"),
	menuUserPlaceholder: utils.dom.get("menu-user-avatar-placeholder"),
	maskToggle: utils.dom.get("mask-toggle"),
	menuLogoutButton: utils.dom.get("menu-logout-button"),
	settingsButton: utils.dom.get("settings-button"),
	guideButton: utils.dom.get("guide-button"),
	termsButton: utils.dom.get("terms-button"),
	reportButton: utils.dom.get("report-button"),
	menuLinks: utils.dom.queryAll(".menu-link"),
});

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
	onTermsOpen,
	onReportOpen,
}) {
	const {
		menuButton,
		menuPanel,
		menuOverlay,
		menuLinks,
		maskToggle,
		menuLogoutButton,
		settingsButton,
		guideButton,
		termsButton,
		reportButton,
	} = getElements();

	// メニュー開閉
	utils.dom.on(menuButton, "click", () => {
		menuPanel?.classList.contains("-translate-x-full")
			? openMenu()
			: closeMenu();
	});
	utils.dom.on(menuOverlay, "click", closeMenu);

	// メニュー内のリンククリックで、該当セクションへスクロールしメニューを閉じる
	menuLinks.forEach((link) =>
		utils.dom.on(link, "click", (e) => {
			// 内部リンク(#)の場合のみスクロール処理を行う
			const targetId = link.getAttribute("href");
			if (targetId && targetId.startsWith("#")) {
				e.preventDefault();
				closeMenu();
				const targetElement = utils.dom.query(targetId);
				if (targetElement) targetElement.scrollIntoView({ behavior: "smooth" });
			}
		})
	);

	// 金額マスク切替
	utils.dom.on(maskToggle, "change", (e) => {
		if (onMaskChange) onMaskChange(e.target.checked);
	});

	// ログアウト
	utils.dom.on(menuLogoutButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onLogout) onLogout();
	});

	// 設定
	utils.dom.on(settingsButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onSettingsOpen) onSettingsOpen();
	});

	// ガイド
	utils.dom.on(guideButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onGuideOpen) onGuideOpen();
	});

	// 利用規約
	utils.dom.on(termsButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onTermsOpen) onTermsOpen();
	});

	// 年間レポート
	utils.dom.on(reportButton, "click", (e) => {
		e.preventDefault();
		closeMenu();
		if (onReportOpen) onReportOpen();
	});

	// バージョン表示
	const versionDisplay = document.getElementById("app-version-display");
	if (versionDisplay) {
		versionDisplay.textContent = config.appVersion;
	}
}

/**
 * メニューを開く。
 * オーバーレイを表示し、背景スクロールを無効化する。
 * @returns {void}
 */
export function openMenu() {
	const { menuPanel, menuOverlay } = getElements();
	menuPanel?.classList.remove("-translate-x-full");
	utils.dom.show(menuOverlay);
	document.body.classList.add("overflow-hidden");
}

/**
 * メニューを閉じる。
 * オーバーレイを非表示にし、背景スクロールを有効化する。
 * @returns {void}
 */
export function closeMenu() {
	const { menuPanel, menuOverlay } = getElements();
	menuPanel?.classList.add("-translate-x-full");
	utils.dom.hide(menuOverlay);
	document.body.classList.remove("overflow-hidden");
}

/**
 * ユーザー情報をメニューに表示する。
 * アイコン画像がある場合はそれを表示し、なければプレースホルダーを表示する。
 * @param {object} user - Firebase Userオブジェクト。
 * @returns {void}
 */
export function updateUser(user) {
	const { menuUserAvatar, menuUserPlaceholder } = getElements();
	if (user.photoURL) {
		if (menuUserAvatar) {
			menuUserAvatar.src = user.photoURL;
			// デフォルトアイコンのクラスが残っていると画像と重なって表示される場合があるため削除
			menuUserAvatar.classList.remove(
				"fa-solid",
				"fa-user",
				"fas",
				"fa-circle-user"
			);
		}
		utils.dom.show(menuUserAvatar);
		utils.dom.hide(menuUserPlaceholder);
	} else {
		utils.dom.hide(menuUserAvatar);
		utils.dom.show(menuUserPlaceholder);
	}
}

/**
 * メニューボタンを表示する。
 * @returns {void}
 */
export function showButton() {
	const { menuButton } = getElements();
	utils.dom.show(menuButton);
}

/**
 * メニューボタンを非表示にする。
 * @returns {void}
 */
export function hideButton() {
	const { menuButton } = getElements();
	utils.dom.hide(menuButton);
}

/**
 * メニューが開いているかどうかを判定する。
 * @returns {boolean} メニューが開いていればtrue。
 */
export function isOpen() {
	const { menuPanel } = getElements();
	return !menuPanel?.classList.contains("-translate-x-full");
}
