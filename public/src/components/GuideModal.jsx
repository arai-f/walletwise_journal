import { useEffect, useRef, useState } from "react";
import Swiper from "swiper/bundle";
import "swiper/css/bundle";
import { isDeviceRegisteredForNotifications } from "../services/store.js";
import * as utils from "../utils.js";

/**
 * アプリケーションの使い方ガイドを表示するモーダルコンポーネント。
 * Swiperを使用してスライド形式でガイドを表示する。
 * コンテンツは外部の `guide.html` から非同期で読み込まれる。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダル表示フラグ。
 * @param {Function} props.onClose - 閉じるボタン押下時のコールバック。
 * @param {object} props.userConfig - ユーザー設定。
 * @param {Function} props.onRequestNotification - 通知許可リクエスト時のコールバック。
 * @return {JSX.Element} ガイドモーダルコンポーネント。
 */
const GuideModal = ({ isOpen, onClose, userConfig, onRequestNotification }) => {
	const [htmlContent, setHtmlContent] = useState("");
	const swiperRef = useRef(null);
	const containerRef = useRef(null);
	const [isLoading, setIsLoading] = useState(false);

	// ガイドが開かれたときに外部HTMLをロードする副作用
	useEffect(() => {
		if (isOpen && !htmlContent && !isLoading) {
			setIsLoading(true);
			fetch("guide.html?t=" + Date.now())
				.then((res) => {
					if (!res.ok) throw new Error("Failed to load guide");
					return res.text();
				})
				.then((html) => {
					setHtmlContent(html);
					setIsLoading(false);
				})
				.catch((err) => {
					console.error("[GuideModal] Failed to load HTML:", err);
					setHtmlContent(
						'<div class="p-4 text-red-500">ガイドの読み込みに失敗しました</div>'
					);
					setIsLoading(false);
				});
		}
	}, [isOpen, htmlContent, isLoading]);

	// Swiperの初期化と動的コンテンツのセットアップを行う副作用
	useEffect(() => {
		if (htmlContent && containerRef.current && isOpen) {
			// Wait a tick for DOM update
			setTimeout(async () => {
				// 1. Swiperの初期化
				if (swiperRef.current) swiperRef.current.destroy(true, true);

				const swiperEl = containerRef.current.querySelector(".guide-swiper");
				if (swiperEl) {
					swiperRef.current = new Swiper(swiperEl, {
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
								if (this.autoplay) this.autoplay.stop();
							},
							slideChange: function () {
								if (this.isEnd) {
									if (this.autoplay) this.autoplay.stop();
								} else if (this.autoplay && !this.autoplay.running) {
									this.autoplay.start();
								}
							},
						},
					});
				}

				// 2. 動的サマリーガイドの注入 (id="analysis-math-summary-guide")
				const summaryContainer = containerRef.current.querySelector(
					"#analysis-math-summary-guide"
				);
				if (summaryContainer) {
					summaryContainer.innerHTML = `
                        <div class="bg-neutral-50 p-3 rounded-lg border border-neutral-200 space-y-2">
                            <div class="flex justify-between items-center">
                                <span class="font-bold flex items-center text-success text-sm"><i class="fas fa-plus-circle mr-2"></i>収入</span>
                                <span class="text-sm font-bold text-neutral-800">¥120,000</span>
                            </div>
                            <div class="border-b border-neutral-300/70 my-1"></div>
                            <div class="flex justify-between items-center pt-1">
                                <span class="font-bold text-neutral-600 text-sm">収支差</span>
                                <span class="text-lg font-extrabold text-danger">-¥20,000</span>
                            </div>
                        </div>
                    `;
				}

				// 3. 通知ボタンの制御 (id="guide-enable-notification")
				const btn = containerRef.current.querySelector(
					"#guide-enable-notification"
				);
				if (btn) {
					// 現在の状態を確認
					let isConfigured = false;
					if (await isDeviceRegisteredForNotifications()) {
						isConfigured = true;
					}

					if (isConfigured) {
						utils.dom.setText(btn, "設定済みです");
						btn.disabled = true;
						utils.dom.addClass(btn, "bg-green-500");
						utils.dom.removeClass(btn, "bg-indigo-600", "hover:bg-indigo-700");
					} else {
						btn.onclick = async () => {
							if (onRequestNotification) {
								const oldText = btn.innerHTML;
								btn.disabled = true;
								utils.dom.setHtml(
									btn,
									'<i class="fas fa-spinner fa-spin"></i>'
								);

								const success = await onRequestNotification();

								if (success) {
									utils.dom.setText(btn, "設定済みです");
									utils.dom.addClass(btn, "bg-green-500");
									utils.dom.removeClass(
										btn,
										"bg-indigo-600",
										"hover:bg-indigo-700"
									);
								} else {
									btn.disabled = false;
									utils.dom.setHtml(btn, oldText);
								}
							}
						};
					}
				}
			}, 50);
		}
	}, [htmlContent, isOpen]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 modal-overlay z-50 flex justify-center items-center p-0 md:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="bg-white w-full h-full md:h-[80vh] md:max-w-4xl md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden relative">
				<div className="absolute top-4 right-4 z-10">
					<button
						onClick={onClose}
						className="w-10 h-10 bg-white/80 hover:bg-white shadow-sm backdrop-blur-sm flex items-center justify-center rounded-full transition"
						aria-label="ガイドを閉じる"
					>
						<i className="fas fa-times text-2xl text-neutral-500"></i>
					</button>
				</div>
				<div className="grow relative overflow-hidden w-full">
					<div ref={containerRef} className="absolute inset-0 w-full h-full">
						{isLoading ? (
							<p className="p-6 flex items-center justify-center h-full text-neutral-500">
								読み込み中...
							</p>
						) : (
							<div
								className="w-full h-full"
								dangerouslySetInnerHTML={{ __html: htmlContent }}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default GuideModal;
