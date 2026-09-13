import {
	faChevronLeft,
	faChevronRight,
	faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type FC, type TouchEvent } from "react";
import GuideContent from "./content/GuideContent";
import Modal from "./ui/Modal";

const TOTAL_STEPS = 6;

interface GuideModalProps {
	/** モーダル表示フラグ。 */
	isOpen: boolean;
	/** 閉じるボタン押下時のコールバック。 */
	onClose: () => void;
	/** 通知許可リクエスト時のコールバック。 */
	onRequestNotification: () => Promise<boolean>;
}

const GuideModal: FC<GuideModalProps> = ({
	isOpen,
	onClose,
	onRequestNotification,
}) => {
	const [activeStep, setActiveStep] = useState<number>(0);

	// モーダルが開くたびに最初のステップにリセット
	useEffect(() => {
		if (isOpen) setActiveStep(0);
	}, [isOpen]);

	// キーボードでの左右ステップ移動
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") {
				setActiveStep((prev) => Math.max(0, prev - 1));
			} else if (e.key === "ArrowRight") {
				setActiveStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);

	// タッチスワイプ用
	const touchStartXRef = useRef<number | null>(null);
	const touchStartYRef = useRef<number | null>(null);

	const handleTouchStart = (e: TouchEvent) => {
		touchStartXRef.current = e.touches[0].clientX;
		touchStartYRef.current = e.touches[0].clientY;
	};

	const handleTouchEnd = (e: TouchEvent) => {
		if (touchStartXRef.current === null || touchStartYRef.current === null)
			return;
		const diffX = touchStartXRef.current - e.changedTouches[0].clientX;
		const diffY = touchStartYRef.current - e.changedTouches[0].clientY;

		if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
			if (diffX > 0) {
				setActiveStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));
			} else {
				setActiveStep((prev) => Math.max(0, prev - 1));
			}
		}
		touchStartXRef.current = null;
		touchStartYRef.current = null;
	};

	const isFirstStep = activeStep === 0;
	const isLastStep = activeStep === TOTAL_STEPS - 1;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			overlayClassName="fixed inset-0 modal-overlay z-50 flex justify-center items-center p-0 md:p-4 select-none"
			className="contents"
		>
			{/* PC用: 前へボタン */}
			<button
				onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
				disabled={isFirstStep}
				className={`hidden md:flex w-12 h-12 rounded-full bg-white/90 hover:bg-white text-neutral-700 hover:text-neutral-900 shadow-xl items-center justify-center transition active:scale-95 shrink-0 mr-4 cursor-pointer ${
					isFirstStep ? "opacity-0 pointer-events-none" : "opacity-100"
				}`}
				aria-label="前のスライドへ"
			>
				<FontAwesomeIcon icon={faChevronLeft} className="text-lg" />
			</button>

			{/* モーダル本体 */}
			<div
				className="bg-white w-full h-full md:h-175 md:max-h-[90vh] md:max-w-xl rounded-none md:rounded-2xl shadow-xl flex flex-col overflow-hidden relative shrink-0"
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				<div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white md:rounded-t-2xl">
					<h2 className="text-lg font-bold text-neutral-900">使い方ガイド</h2>
					<button
						id="close-guide-modal-button"
						onClick={onClose}
						className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-600 cursor-pointer"
						aria-label="ガイドを閉じる"
					>
						<FontAwesomeIcon icon={faTimes} className="text-xl" />
					</button>
				</div>

				<div className="grow overflow-hidden relative bg-white flex flex-col min-h-0 pb-8">
					<GuideContent
						activeStep={activeStep}
						onRequestNotification={onRequestNotification}
						onClose={onClose}
					/>
				</div>

				{/* インジケータードット */}
				<div className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-1.5 pointer-events-none z-10 pb-safe-area">
					{Array.from({ length: TOTAL_STEPS }).map((_, index) => (
						<button
							key={index}
							onClick={() => setActiveStep(index)}
							aria-label={`ステップ ${index + 1} へ`}
							className={`h-2 rounded-full transition-all pointer-events-auto cursor-pointer ${
								activeStep === index
									? "w-5 bg-indigo-600 shadow-xs"
									: "w-2 bg-neutral-300 hover:bg-neutral-400"
							}`}
						/>
					))}
				</div>
			</div>

			{/* PC用: 次へボタン */}
			<button
				onClick={() =>
					setActiveStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1))
				}
				disabled={isLastStep}
				className={`hidden md:flex w-12 h-12 rounded-full bg-white/90 hover:bg-white text-neutral-700 hover:text-neutral-900 shadow-xl items-center justify-center transition active:scale-95 shrink-0 ml-4 cursor-pointer ${
					isLastStep ? "opacity-0 pointer-events-none" : "opacity-100"
				}`}
				aria-label="次のスライドへ"
			>
				<FontAwesomeIcon icon={faChevronRight} className="text-lg" />
			</button>
		</Modal>
	);
};

export default GuideModal;
