import { faArrowLeft, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { useApp } from "../../contexts/AppContext";
import type { SettingsViewId } from "../../types/settings";
import Modal from "../ui/Modal";
import AccountSettings from "./AccountSettings";
import CategorySettings from "./CategorySettings";
import CreditCardRules from "./CreditCardRules";
import GeneralSettings from "./GeneralSettings";
import ScanSettings from "./ScanSettings";
import SettingsMenu from "./SettingsMenu";

/** 現在の画面種別（メニュー含む）。 */
type CurrentView = SettingsViewId | "menu";

/**
 * `SettingsModal` のコンポーネントプロパティ。
 */
interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	requestNotification: () => Promise<boolean>;
	disableNotification: () => Promise<void>;
	openGuide: () => void;
	openTerms: () => void;
	onLogout?: () => void;
	canClose?: boolean;
}

/**
 * 設定画面モーダルを管理するコンテナコンポーネント。
 */
export default function SettingsModal({
	isOpen,
	onClose,
	requestNotification,
	disableNotification,
	openGuide,
	openTerms,
	onLogout,
	canClose = true,
}: SettingsModalProps) {
	const { appVersion } = useApp();
	const [currentView, setCurrentView] = useState<CurrentView>("menu");
	const [title, setTitle] = useState("設定");

	// モーダルが閉じられたときにビューをメニューに戻す
	useEffect(() => {
		if (!isOpen) {
			const timer = setTimeout(() => {
				setCurrentView("menu");
				setTitle("設定");
			}, 200);
			return () => clearTimeout(timer);
		}
	}, [isOpen]);

	const navigateTo = (view: SettingsViewId, newTitle: string) => {
		setCurrentView(view);
		setTitle(newTitle);
	};

	const handleBack = () => {
		setCurrentView("menu");
		setTitle("設定");
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			canClose={canClose}
			onEscape={() => (currentView === "menu" ? onClose() : handleBack())}
			className="bg-white w-full h-full md:h-175 md:max-h-[90vh] md:max-w-xl rounded-none md:rounded-2xl shadow-xl flex flex-col overflow-hidden"
		>
			{/* ヘッダーエリア */}
			<div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white md:rounded-t-2xl">
				<div className="flex items-center gap-3">
					{currentView !== "menu" && (
						<button
							onClick={handleBack}
							className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-600 cursor-pointer"
						>
							<FontAwesomeIcon icon={faArrowLeft} />
						</button>
					)}
					<h2 className="text-lg font-bold text-neutral-900">{title}</h2>
				</div>
				<button
					onClick={onClose}
					className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-600 cursor-pointer"
				>
					<FontAwesomeIcon icon={faTimes} className="text-xl" />
				</button>
			</div>

			{/* コンテンツエリア */}
			<div className="grow overflow-y-auto min-h-0 bg-white pb-safe-area md:rounded-b-2xl">
				{currentView === "menu" && (
					<SettingsMenu
						onNavigate={navigateTo}
						openGuide={openGuide}
						openTerms={openTerms}
						onLogout={onLogout}
						appVersion={appVersion || ""}
					/>
				)}

				{currentView === "general" && (
					<GeneralSettings
						requestNotification={requestNotification}
						disableNotification={disableNotification}
					/>
				)}

				{currentView === "accounts" && <AccountSettings />}

				{currentView === "categories" && <CategorySettings />}

				{currentView === "cards" && <CreditCardRules />}

				{currentView === "scan" && <ScanSettings />}
			</div>
		</Modal>
	);
}
