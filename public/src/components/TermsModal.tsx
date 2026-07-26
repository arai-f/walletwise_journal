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
			className="fixed inset-0 modal-overlay z-99 flex justify-center items-center p-4 md:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget && mode === "viewer") onClose();
			}}
		>
			<div className="bg-white w-full max-h-[90vh] md:max-w-2xl rounded-2xl md:rounded-lg shadow-xl flex flex-col overflow-hidden">
				<div className="px-5 py-3 border-b border-neutral-100 shrink-0 flex justify-between items-center bg-white md:rounded-t-lg">
					<h2 className="text-base font-bold text-neutral-900">
						{mode === "agreement" ? "利用規約への同意" : "利用規約"}
					</h2>
					{mode === "viewer" && (
						<button
							onClick={onClose}
							className="w-8 h-8 rounded-full hover:bg-neutral-100 shrink-0 flex items-center justify-center transition"
							aria-label="閉じる"
						>
							<FontAwesomeIcon
								icon={faTimes}
								className="text-neutral-500 text-lg"
							/>
						</button>
					)}
				</div>

				<div className="grow overflow-y-auto bg-white">
					<TermsContent version={appConfig.termsVersion} />
				</div>

				{mode === "agreement" && (
					<div className="px-5 py-3 bg-white border-t border-neutral-100 flex justify-end gap-3 shrink-0 md:rounded-b-lg">
						<button
							onClick={onDisagree}
							className="px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-800 transition"
						>
							同意しない
						</button>
						<button
							id="terms-agree-btn"
							onClick={onAgree}
							className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition"
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
