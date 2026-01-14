import ReactDOM from "react-dom/client";
import GuideModal from "../components/GuideModal.jsx";
import ReportModal from "../components/ReportModal.jsx";
import TermsModal from "../components/TermsModal.jsx";

// Roots for Modal Mounting
const guideRoot = document.getElementById("guide-modal-root");
const termsRoot = document.getElementById("terms-modal-root");
const reportRoot = document.getElementById("report-modal-root");

// Roots React Instances
let guideReactRoot = null;
let termsReactRoot = null;
let reportReactRoot = null;

// Ensure roots exist
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

export const renderGuideModal = (props) => {
	if (guideReactRoot) {
		guideReactRoot.render(<GuideModal {...props} />);
	}
};

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

export const renderTermsModal = (props) => {
	if (termsReactRoot) {
		termsReactRoot.render(<TermsModal {...props} />);
	}
};

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

export const openTermsAgreement = (onAgree, onDisagree) => {
	// No Promise here because the actions are button clicks
	// But we will wrap the callbacks to close the modal

	const handleClose = () => {
		// Just in case, though agreement usually forces choice
		renderTermsModal({
			isOpen: false,
			onClose: () => {},
			mode: "agreement",
			onAgree: () => {},
			onDisagree: () => {},
		});
	};

	const wrappedOnAgree = () => {
		// handleClose call might be handled by caller or we do it here?
		// In original code, updateConfig & reload happens.
		// Reload will clear it anyway. But updateConfig is async.
		// Let's passed functions handle the logic, we just pass events.
		onAgree();
	};

	const wrappedOnDisagree = () => {
		if (onDisagree) onDisagree();
		// Usually signs out or redirects
	};

	renderTermsModal({
		isOpen: true,
		onClose: handleClose,
		mode: "agreement",
		onAgree: wrappedOnAgree,
		onDisagree: wrappedOnDisagree,
	});
};

export const closeTermsModal = () => {
	renderTermsModal({ isOpen: false, onClose: () => {}, mode: "viewer" });
};

/* ==========================================================================
   Report Modal Wrapper
   ========================================================================== */

export const renderReportModal = (props) => {
	if (reportReactRoot) {
		reportReactRoot.render(<ReportModal {...props} />);
	}
};

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

export const closeReportModal = () => {
	renderReportModal({ isOpen: false, onClose: () => {}, luts: {} });
};
