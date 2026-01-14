import ReactDOM from "react-dom/client";
import GuideModal from "../components/GuideModal.jsx";
import ReportModal from "../components/ReportModal.jsx";
import TermsModal from "../components/TermsModal.jsx";

const guideRoot = document.getElementById("guide-modal-root");
const termsRoot = document.getElementById("terms-modal-root");
const reportRoot = document.getElementById("report-modal-root");

let guideReactRoot = null;
let termsReactRoot = null;
let reportReactRoot = null;

if (guideRoot && !guideReactRoot) {
	guideReactRoot = ReactDOM.createRoot(guideRoot);
}
if (termsRoot && !termsReactRoot) {
	termsReactRoot = ReactDOM.createRoot(termsRoot);
}
if (reportRoot && !reportReactRoot) {
	reportReactRoot = ReactDOM.createRoot(reportRoot);
}

/* ==========================================================================
   Guide Modal Wrapper
   ========================================================================== */

/**
 * ガイドモーダルをレンダリングする。
 * @param {object} props - モーダルに渡すプロパティ。
 */
export const renderGuideModal = (props) => {
	if (guideReactRoot) {
		guideReactRoot.render(<GuideModal {...props} />);
	}
};

/**
 * ガイドモーダルを開く。
 * 閉じるまで待機するPromiseを返す。
 * 
 * @param {object} config - ユーザー設定
 * @param {Function} requestNotification - 通知リクエスト関数
 * @returns {Promise<void>} モーダルが閉じられた時に解決される
 */
export const openGuideModal = (config, requestNotification) => {
	return new Promise((resolve) => {
		const handleClose = () => {
			renderGuideModal({
				isOpen: false,
				onClose: () => {},
				userConfig: null,
				onRequestNotification: null,
			});
			resolve();
		};

		renderGuideModal({
			isOpen: true,
			onClose: handleClose,
			userConfig: config,
			onRequestNotification: requestNotification,
		});
	});
};

/* ==========================================================================
   Terms Modal Wrapper
   ========================================================================== */

/**
 * 利用規約モーダルをレンダリングする。
 * @param {object} props - モーダルに渡すプロパティ。
 */
export const renderTermsModal = (props) => {
	if (termsReactRoot) {
		termsReactRoot.render(<TermsModal {...props} />);
	}
};

/**
 * 利用規約閲覧モードでモーダルを開く。
 * @returns {Promise<void>} モーダルが閉じられた時に解決される。
 */
export const openTermsViewer = () => {
	return new Promise((resolve) => {
		const handleClose = () => {
			renderTermsModal({ isOpen: false, onClose: () => {}, mode: "viewer" });
			resolve();
		};

		renderTermsModal({
			isOpen: true,
			onClose: handleClose,
			mode: "viewer",
		});
	});
};

/**
 * 利用規約同意フローを開始する。
 * 同意・非同意のコールバックを受け付けて処理する。
 * @param {Function} onAgree - 同意時のコールバック。
 * @param {Function} onDisagree - 非同意時のコールバック。
 */
export const openTermsAgreement = (onAgree, onDisagree) => {
	const handleClose = () => {
		renderTermsModal({
			isOpen: false,
			onClose: () => {},
			mode: "agreement",
			onAgree: () => {},
			onDisagree: () => {},
		});
	};

	const wrappedOnAgree = () => {
		onAgree();
	};

	const wrappedOnDisagree = () => {
		if (onDisagree) onDisagree();
	};

	renderTermsModal({
		isOpen: true,
		onClose: handleClose,
		mode: "agreement",
		onAgree: wrappedOnAgree,
		onDisagree: wrappedOnDisagree,
	});
};

/**
 * 利用規約モーダルを強制的に閉じる。
 */
export const closeTermsModal = () => {
	renderTermsModal({ isOpen: false, onClose: () => {}, mode: "viewer" });
};

/* ==========================================================================
   Report Modal Wrapper
   ========================================================================== */

/**
 * レポートモーダルをレンダリングする。
 * @param {object} props - モーダルに渡すプロパティ。
 */
export const renderReportModal = (props) => {
	if (reportReactRoot) {
		reportReactRoot.render(<ReportModal {...props} />);
	}
};

/**
 * レポートモーダルを開く。
 * @param {object} luts - ルックアップテーブル。
 * @returns {Promise<void>} モーダルが閉じられた時に解決される。
 */
export const openReportModal = (luts) => {
	return new Promise((resolve) => {
		const handleClose = () => {
			renderReportModal({ isOpen: false, onClose: () => {}, luts });
			resolve();
		};

		renderReportModal({
			isOpen: true,
			onClose: handleClose,
			luts,
		});
	});
};

/**
 * レポートモーダルを強制的に閉じる。
 */
export const closeReportModal = () => {
	renderReportModal({ isOpen: false, onClose: () => {}, luts: {} });
};
