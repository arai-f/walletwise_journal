import { useEffect, useRef, useState } from "react";
import { config as appConfig } from "../config.js";

/**
 * 利用規約を表示するモーダルコンポーネント。
 * 外部の `terms.html` を読み込んで表示する。
 * 通常の閲覧モード(viewer)と、同意確認モード(agreement)をサポートする。
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
	const [htmlContent, setHtmlContent] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	// 規約コンテンツを非同期ロードする副作用
	useEffect(() => {
		if (isOpen && !htmlContent && !isLoading) {
			setIsLoading(true);
			fetch("terms.html")
				.then((res) => {
					if (!res.ok) throw new Error("Failed to load terms");
					return res.text();
				})
				.then((html) => {
					setHtmlContent(html);
					setIsLoading(false);
				})
				.catch((err) => {
					setHtmlContent(`<p class="text-red-500">${err.message}</p>`);
					setIsLoading(false);
				});
		}
	}, [isOpen, htmlContent, isLoading]);

	const contentRef = useRef(null);

	// ロードされたコンテンツ内に規約バージョン番号を埋め込む副作用
	useEffect(() => {
		if (contentRef.current && appConfig.termsVersion) {
			const el = contentRef.current.querySelector("#terms-version-display");
			if (el) el.textContent = appConfig.termsVersion;
		}
	}, [htmlContent, isOpen]);

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

				<div
					ref={contentRef}
					className="grow overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full"
					dangerouslySetInnerHTML={{
						__html: htmlContent || "<p>読み込んでいます...</p>",
					}}
				/>

				{mode === "agreement" && (
					<div className="p-4 bg-white border-t border-neutral-200 flex justify-end gap-3 shrink-0 md:rounded-b-lg">
						<button
							onClick={onDisagree}
							className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-600 font-bold hover:bg-neutral-50 transition"
						>
							同意しない
						</button>
						<button
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
