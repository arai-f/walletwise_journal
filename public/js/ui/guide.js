import Swiper from "swiper/bundle";
import { config as appConfig } from "../config.js";
import { isDeviceRegisteredForNotifications, updateConfig } from "../store.js";
import * as utils from "../utils.js";

/* ==========================================================================
   Module State
   ========================================================================== */

let userConfig = null;
let requestNotificationHandler = null;
let isGuideLoaded = false;
let swiperInstance = null;

// DOM要素キャッシュ
const elements = {};

/* ==========================================================================
   Helper Functions
   ========================================================================== */

/**
 * 頻繁に使用するDOM要素を取得し、キャッシュする。
 * @returns {void}
 */
function cacheDomElements() {
	Object.assign(elements, {
		modal: utils.dom.get("guide-modal"),
		contentContainer: utils.dom.get("guide-content-container"),
		closeButton: utils.dom.get("close-guide-modal-button"),
	});
}

/**
 * 収支レポートのサマリー表示を動的に行うための仮の関数。
 * @returns {void}
 */
function setupAnalysisSummaryGuide() {
	const container = document.getElementById("analysis-math-summary-guide");
	if (!container) return;

	const summaryHTML = `
		<div class="bg-neutral-50 p-3 rounded-lg border border-neutral-200 space-y-2">
			<div class="flex justify-between items-center">
				<span class="font-bold flex items-center text-success text-sm"><i class="fas fa-plus-circle mr-2"></i>収入</span>
				<span class="text-sm font-bold text-neutral-800">¥100,000</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="font-bold flex items-center text-danger text-sm"><i class="fas fa-minus-circle mr-2"></i>支出</span>
				<span class="text-sm font-bold text-neutral-800">¥120,000</span>
			</div>
			<div class="border-b border-neutral-300/70 my-1"></div>
			<div class="flex justify-between items-center pt-1">
				<span class="font-bold text-neutral-600 text-sm">収支差</span>
				<span class="text-lg font-extrabold text-danger">-¥20,000</span>
			</div>
		</div>
	`;
	container.innerHTML = summaryHTML;
}

/**
 * Swiperを初期化する。
 * @returns {void}
 */
function initSwiper() {
	if (swiperInstance) {
		swiperInstance.destroy(true, true);
		swiperInstance = null;
	}

	swiperInstance = new Swiper(".guide-swiper", {
		loop: false,
		pagination: {
			el: ".swiper-pagination",
			clickable: true,
		},
		navigation: {
			nextEl: ".swiper-button-next",
			prevEl: ".swiper-button-prev",
		},
		autoplay: {
			delay: 8000,
			disableOnInteraction: true,
		},
		on: {
			init: function () {
				this.autoplay.stop();
			},
			slideChange: function () {
				if (this.isEnd) {
					this.autoplay.stop();
				} else if (!this.autoplay.running) {
					this.autoplay.start();
				}
			},
		},
	});
}

/**
 * 通知設定ボタンのクリックリスナーを設定する。
 * @returns {void}
 */
function setupNotificationButtonListener() {
	const btn = utils.dom.get("guide-enable-notification");
	if (!btn) return;

	// 既存のリスナーが重複しないように考慮（guide.jsの構造上、load時に一度だけ呼ばれるため基本OK）
	btn.addEventListener("click", async () => {
		if (requestNotificationHandler) {
			utils.withLoading(btn, async () => {
				const success = await requestNotificationHandler();
				if (success) {
					updateNotificationButtonState(); // 成功したら表示を更新
				}
			});
		}
	});
}

/**
 * 通知設定ボタンの状態を更新する。
 * @async
 * @returns {Promise<void>}
 */
async function updateNotificationButtonState() {
	const btn = utils.dom.get("guide-enable-notification");
	if (!btn) return;

	// デフォルト状態（未設定）
	let isConfigured = false;

	if (await isDeviceRegisteredForNotifications()) {
		isConfigured = true;
	}

	console.log(
		"[Guide] Notification button state - isConfigured:",
		isConfigured
	);

	// UI更新
	if (isConfigured) {
		btn.textContent = "設定済みです";
		btn.disabled = true;
		utils.dom.addClass(btn, "bg-green-500");
		utils.dom.removeClass(btn, "bg-indigo-600", "hover:bg-indigo-700");
	}
}

/* ==========================================================================
   Public API
   ========================================================================== */

/**
 * ガイドモジュールを初期化する。
 * @param {object} config - ユーザーの設定オブジェクト。
 * @param {function} requestNotification - 通知許可をリクエストする関数。
 * @returns {void}
 */
export function init(config, requestNotification) {
	userConfig = config;
	requestNotificationHandler = requestNotification;

	cacheDomElements();

	utils.dom.on(elements.closeButton, "click", closeModal);
	utils.dom.on(elements.modal, "click", (e) => {
		if (e.target === elements.modal) closeModal();
	});
}

/**
 * 初回表示時にガイドを表示すべきかどうかを判断する。
 * @returns {boolean}
 */
export function shouldShowGuide() {
	if (!userConfig) return false;
	const seenVersion = userConfig?.guide?.lastSeenVersion;
	return seenVersion !== appConfig.guideVersion;
}

/**
 * ガイドモーダルを開く。
 * 初回表示時にHTMLコンテンツを非同期で読み込み、コンテナに挿入する。
 * @async
 * @param {object|null} [config=null] - 最新のユーザー設定。
 * @returns {Promise<void>}
 */
export async function openModal(config = null) {
	if (config) userConfig = config;

	if (!isGuideLoaded) {
		try {
			const response = await fetch("guide.html?t=" + new Date().getTime());
			if (!response.ok) throw new Error("ガイドの読み込みに失敗しました。");

			const html = await response.text();
			utils.dom.setHtml(elements.contentContainer, html);
			isGuideLoaded = true;

			initSwiper();
			setupAnalysisSummaryGuide();
			setupNotificationButtonListener();
		} catch (error) {
			console.error("[Guide] ガイドの読み込みエラー:", error);
			utils.dom.setHtml(
				elements.contentContainer,
				`<p class="text-danger p-6">ガイドの読み込みエラー: ${error.message}</p>`
			);
		}
	}

	utils.dom.show(elements.modal);
	utils.toggleBodyScrollLock(true);

	if (isGuideLoaded) {
		updateNotificationButtonState();
	}

	if (swiperInstance) {
		setTimeout(() => {
			swiperInstance.update();
			swiperInstance.slideTo(0);
			swiperInstance.autoplay.stop();
		}, 100);
	}
}

/**
 * ガイドモーダルを閉じる。
 * モーダルを非表示にし、背景のスクロールロックを解除する。
 * @async
 * @returns {Promise<void>}
 */
export async function closeModal() {
	utils.toggleBodyScrollLock(false);
	utils.dom.hide(elements.modal);

	await updateConfig({ "guide.lastSeenVersion": appConfig.guideVersion }).catch(
		(err) => console.error("ガイドバージョンの更新に失敗しました:", err)
	);

	const mainContent = utils.dom.get("main-content");
	if (mainContent.classList.contains("hidden")) {
		location.reload();
	}
}

/**
 * ガイドモーダルが開いているかどうかを判定する。
 * @returns {boolean}
 */
export function isOpen() {
	return utils.dom.isVisible(elements.modal);
}
