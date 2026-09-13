import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect } from "react";
import { config as appConfig } from "../config.js";
import * as utils from "../utils.js";
import TermsContent from "./content/TermsContent.jsx";

/**
 * TermsModalコンポーネントのプロパティ。
 */
interface TermsModalProps {
	/** モーダル表示フラグ。 */
	isOpen: boolean;
	/** 閉じるボタン押下時のコールバック（viewerモードのみ有効）。 */
	onClose: () => void;
	/** 表示モード。 */
	mode?: "viewer" | "agreement";
	/** 同意ボタン押下時のコールバック。 */
	onAgree?: () => void;
	/** 同意しないボタン押下時のコールバック。 */
	onDisagree?: () => void;
}

/**
 * 利用規約を表示するモーダルコンポーネント。
 * @param props - TermsModalProps。
 * @returns 利用規約モーダルコンポーネント。
 */
const TermsModal = ({
	isOpen,
	onClose,
	mode = "viewer",
	onAgree,
	onDisagree,
}: TermsModalProps) => {
	// スクロール制御。
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

	// キーボードショートカット (Escで閉じる - viewerモードのみ)。
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (isOpen && e.key === "Escape" && mode === "viewer") {
				onClose();
			}
		};

		if (isOpen) {
			window.addEventListener("keydown", handleKeyDown);
		}

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose, mode]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 modal-overlay z-99 flex justify-center items-center p-0 md:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget && mode === "viewer") onClose();
			}}
		>
			<div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl rounded-none md:rounded-2xl shadow-xl flex flex-col overflow-hidden">
				{/* ヘッダーエリア */}
				<div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white md:rounded-t-2xl">
					<h2 className="text-lg font-bold text-neutral-900">
						{mode === "agreement" ? "利用規約への同意" : "利用規約"}
					</h2>
					{mode === "viewer" && (
						<button
							onClick={onClose}
							className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-600 cursor-pointer"
							aria-label="閉じる"
						>
							<FontAwesomeIcon icon={faTimes} className="text-xl" />
						</button>
					)}
				</div>

				<div
					className={`grow overflow-y-auto min-h-0 bg-white ${mode === "viewer" ? "pb-safe-area" : ""}`}
				>
					<TermsContent version={appConfig.termsVersion} />
				</div>

				{mode === "agreement" && (
					<div className="px-5 py-3 pb-safe-area md:pb-3 bg-white border-t border-neutral-200 flex justify-end gap-3 shrink-0 md:rounded-b-2xl">
						<button
							onClick={onDisagree}
							className="px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-800 transition cursor-pointer"
						>
							同意しない
						</button>
						<button
							id="terms-agree-btn"
							onClick={onAgree}
							className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition cursor-pointer"
						>
							同意する
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

export default TermsModal;
