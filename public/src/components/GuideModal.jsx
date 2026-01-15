import { useEffect, useRef } from "react";
import Swiper from "swiper/bundle";
import "swiper/css/bundle";
import * as utils from "../utils.js";
import GuideContent from "./content/GuideContent.jsx";

/**
 * アプリケーションの使い方ガイドを表示するモーダルコンポーネント。
 * Swiperを使用してスライド形式でガイドを表示する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダル表示フラグ。
 * @param {Function} props.onClose - 閉じるボタン押下時のコールバック。
 * @param {object} props.userConfig - ユーザー設定。
 * @param {Function} props.onRequestNotification - 通知許可リクエスト時のコールバック。
 * @return {JSX.Element} ガイドモーダルコンポーネント。
 */
const GuideModal = ({ isOpen, onClose, userConfig, onRequestNotification }) => {
	const swiperRef = useRef(null);
	const containerRef = useRef(null);

	// スクロール制御
	useEffect(() => {
		if (isOpen) {
			utils.toggleBodyScrollLock(true);
		}
		return () => {
			if (isOpen) {
				utils.toggleBodyScrollLock(false);
			}
		};
	}, [isOpen]);

	// キーボードショートカット (Escで閉じる)
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (isOpen && e.key === "Escape") {
				onClose();
			}
		};

		if (isOpen) {
			window.addEventListener("keydown", handleKeyDown);
		}

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose]);

	// Swiperの初期化
	useEffect(() => {
		if (isOpen && containerRef.current) {
			// DOMの描画完了を待つ小待機 (Reactのレンダリングサイクル後)
			const timerId = setTimeout(() => {
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
			}, 100);

			return () => clearTimeout(timerId);
		}
	}, [isOpen]);

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
						id="close-guide-modal-button"
						onClick={onClose}
						className="w-10 h-10 bg-white/80 hover:bg-white shadow-sm backdrop-blur-sm flex items-center justify-center rounded-full transition"
						aria-label="ガイドを閉じる"
					>
						<i className="fas fa-times text-2xl text-neutral-500"></i>
					</button>
				</div>
				<div className="grow relative overflow-hidden w-full">
					<div ref={containerRef} className="absolute inset-0 w-full h-full">
						<GuideContent
							onRequestNotification={onRequestNotification}
							onClose={onClose}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default GuideModal;
