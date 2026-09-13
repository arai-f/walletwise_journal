import { useEffect, type ReactNode } from "react";
import * as utils from "../../utils";
import Portal from "./Portal";

export interface ModalProps {
	/** モーダルの開閉状態 */
	isOpen: boolean;
	/** 閉じるコールバック */
	onClose: () => void;
	/** モーダル内部の要素 */
	children: ReactNode;
	/** 背景クリックやEscapeキーで閉じられるかどうか（デフォルト: true） */
	canClose?: boolean;
	/** モーダルコンテンツ外枠のTailwindクラス（幅・高さ・角丸など） */
	className?: string;
	/** オーバーレイ外枠のTailwindクラス */
	overlayClassName?: string;
	/** Escapeキー押下時のカスタム動作（指定がない場合は canClose && onClose()） */
	onEscape?: () => void;
}

/**
 * アプリケーション共通のベースモーダルコンポーネント。
 * Portal描画、iOSスクロールロック、Escapeキー監視、背景オーバーレイクリックを統合管理する。
 */
export default function Modal({
	isOpen,
	onClose,
	children,
	canClose = true,
	className = "bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-2xl shadow-xl flex flex-col overflow-hidden",
	overlayClassName = "fixed inset-0 modal-overlay z-50 flex justify-center items-center p-0 md:p-4 animate-fade-in",
	onEscape,
}: ModalProps) {
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

	// Escapeキー制御
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (onEscape) {
					onEscape();
				} else if (canClose) {
					onClose();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, canClose, onClose, onEscape]);

	if (!isOpen) return null;

	return (
		<Portal>
			<div
				className={overlayClassName}
				onClick={(e) => {
					if (canClose && e.target === e.currentTarget) {
						onClose();
					}
				}}
			>
				<div className={className}>{children}</div>
			</div>
		</Portal>
	);
}
