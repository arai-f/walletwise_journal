import { config as appConfig } from "../config.js";
import { updateConfig } from "../store.js";
import * as utils from "../utils.js";

/**
 * ユーザー設定を保持するモジュールレベルの変数。
 * @type {object|null}
 */
let userConfig = null;

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
 * Swiperインスタンスを保持する変数
 */
let swiperInstance = null;

/**
 * 収支レポートのサマリー表示を動的に行うための仮の関数です。
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
 * Swiperを初期化する
 * @param {any} SwiperClass - Swiperのクラスコンストラクタ
 */
function initSwiper(SwiperClass) {
	if (swiperInstance) {
		swiperInstance.destroy(true, true);
		swiperInstance = null;
	}

	swiperInstance = new SwiperClass(".guide-swiper", {
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
				// 最初のスライドに到達したときに実行
				this.autoplay.stop();
			},
			slideChange: function () {
				if (this.isEnd) {
					// 最後のスライドに到達したらオートプレイを停止
					this.autoplay.stop();
				} else if (!this.autoplay.running) {
					// 最初または途中のスライドに戻ったらオートプレイを再開
					this.autoplay.start();
				}
			},
		},
	});
}

/**
 * ガイドモジュールを初期化する。
 * @param {object} config - ユーザーの設定オブジェクト。
 * @returns {void}
 */
export function init(config) {
	userConfig = config; // ユーザー設定をモジュール変数に保存
	const { closeButton, modal } = getElements();
	utils.dom.on(closeButton, "click", closeModal);
	utils.dom.on(modal, "click", (e) => {
		if (e.target === modal) closeModal();
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
 * @returns {Promise<void>}
 */
export async function openModal() {
	const { contentContainer, modal } = getElements();
	// まだ読み込んでいなければ、guide.htmlをフェッチする
	if (!isGuideLoaded) {
		try {
			const response = await fetch("guide.html?t=" + new Date().getTime());
			if (!response.ok) throw new Error("ガイドの読み込みに失敗しました。");
			const html = await response.text();
			utils.dom.setHtml(contentContainer, html);
			isGuideLoaded = true;

			// HTML挿入後にSwiperを動的インポートして初期化
			const { default: Swiper } = await import("swiper/bundle");
			await import("swiper/css/bundle");
			initSwiper(Swiper);
			setupAnalysisSummaryGuide();
		} catch (error) {
			utils.dom.setHtml(
				contentContainer,
				`<p class="text-danger p-6">${error.message}</p>`
			);
		}
	}

	utils.dom.show(modal);
	utils.toggleBodyScrollLock(true);

	// モーダル表示後にSwiperのサイズ計算を更新（表示崩れ防止）
	if (swiperInstance) {
		setTimeout(() => {
			swiperInstance.update();
			swiperInstance.slideTo(0);
			// 最初の表示では自動再生を開始しない
			swiperInstance.autoplay.stop();
		}, 100);
	}
}

/**
 * ガイドモーダルを閉じる。
 * モーダルを非表示にし、背景のスクロールロックを解除する。
 * @returns {void}
 */
export async function closeModal() {
	const { modal } = getElements();
	utils.toggleBodyScrollLock(false);
	utils.dom.hide(modal);

	// ガイドを見たとしてバージョンをFirestoreに保存
	await updateConfig({ "guide.lastSeenVersion": appConfig.guideVersion }).catch(
		(err) => console.error("ガイドバージョンの更新に失敗しました:", err)
	);

	// 初回表示でガイドが開かれた場合（＝メインコンテンツがまだ非表示）
	// のみリロードしてメインコンテンツを表示する。
	// それ以外（メニューから開いた場合）はリロードしない。
	const mainContent = utils.dom.get("main-content");
	if (mainContent.classList.contains("hidden")) {
		location.reload();
	}
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
