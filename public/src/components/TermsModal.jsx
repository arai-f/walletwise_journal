import { useEffect } from "react";
import { config as appConfig } from "../config.js";
import * as utils from "../utils.js";
import TermsContent from "./content/TermsContent.jsx";

/**
 * 利用規約を表示するモーダルコンポーネント。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダル表示フラグ。
 * @param {Function} props.onClose - 閉じるボタン押下時のコールバック（viewerモードのみ有効）。
 * @param {'viewer'|'agreement'} [props.mode='viewer'] - 表示モード。
 * @param {Function} [props.onAgree] - 同意ボタン押下時のコールバック。
 * @param {Function} [props.onDisagree] - 同意しないボタン押下時のコールバック。
 * @return {JSX.Element} 利用規約モーダルコンポーネント。
 */
const TermsModal = ({
	isOpen,
	onClose,
	mode = "viewer",
	onAgree,
	onDisagree,
}) => {
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

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 modal-overlay z-99 flex justify-center items-center p-0 md:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget && mode === "viewer") onClose();
			}}
		>
			<div className="bg-white w-full h-full md:h-auto md:max-w-3xl md:max-h-[90vh] md:rounded-lg md:shadow-xl flex flex-col">
				<div className="p-4 border-b border-neutral-200 shrink-0 flex justify-between items-center md:rounded-t-lg">
					<h2 className="text-xl font-bold text-neutral-900">
						{mode === "agreement" ? "利用規約への同意" : "利用規約"}
					</h2>
					{mode === "viewer" && (
						<button
							onClick={onClose}
							className="w-8 h-8 rounded-full hover:bg-neutral-100 shrink-0 p-1 flex items-center justify-center transition"
							aria-label="閉じる"
						>
							<i className="fas fa-times text-2xl text-neutral-500"></i>
						</button>
					)}
				</div>

				<div className="grow overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full">
					<TermsContent version={appConfig.termsVersion} />
				</div>

				{mode === "agreement" && (
					<div className="p-4 bg-white border-t border-neutral-200 flex justify-end gap-3 shrink-0 md:rounded-b-lg">
						<button
							onClick={onDisagree}
							className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-600 font-bold hover:bg-neutral-50 transition"
						>
							同意しない
						</button>
						<button
							id="terms-agree-btn"
							onClick={onAgree}
							className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow transition"
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
