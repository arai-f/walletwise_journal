import { faArrowLeft, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import type {
	GetState,
	RefreshApp,
	SettingsViewId,
} from "../../types/settings";
import * as utils from "../../utils";
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
	/** モーダル表示状態。 */
	isOpen: boolean;
	/** 閉じるコールバック関数。 */
	onClose: () => void;
	/** 現在のステート取得関数。 */
	getState: GetState;
	/** アプリ全体の再描画/再取得関数。 */
	refreshApp: RefreshApp;
	/** 通知許可リクエスト関数。 */
	requestNotification: () => Promise<boolean>;
	/** 通知無効化関数。 */
	disableNotification: () => Promise<void>;
	/** ガイドを開く関数。 */
	openGuide: () => void;
	/** 利用規約を開く関数。 */
	openTerms: () => void;
	/** ログアウト関数（省略可能）。 */
	onLogout?: () => void;
	/** 閉じる操作を許可するかどうか。 */
	canClose?: boolean;
}

/**
 * 設定画面モーダルを管理するコンテナコンポーネント。
 * ルーティングロジックを持ち、メニュー画面と各設定詳細画面の切り替えを行う。
 * @param props - コンポーネントプロパティ。
 * @returns 設定モーダルコンポーネント。
 */
export default function SettingsModal({
	isOpen,
	onClose,
	getState,
	refreshApp,
	requestNotification,
	disableNotification,
	openGuide,
	openTerms,
	onLogout,
	canClose = true,
}: SettingsModalProps) {
	const [currentView, setCurrentView] = useState<CurrentView>("menu");
	const [title, setTitle] = useState("設定");

	// モーダルが閉じられたときにビューをメニューに戻す副作用。
	useEffect(() => {
		if (!isOpen) {
			// アニメーション完了後にリセットするなど、若干の遅延を入れる
			setTimeout(() => {
				setCurrentView("menu");
				setTitle("設定");
			}, 200);
		}
	}, [isOpen]);

	// Escapeキーでの戻る/閉じる操作をハンドリングする副作用。
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isOpen || !canClose) return;
			if (e.key === "Escape") {
				// メニュー画面ならモーダルを閉じる、詳細画面ならメニューに戻る
				if (currentView === "menu") {
					onClose();
				} else {
					handleBack();
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, currentView, canClose]);

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

	/**
	 * 指定した設定画面へ遷移する。
	 * @param view - 遷移先のビューID。
	 * @param newTitle - ヘッダーに表示するタイトル。
	 */
	const navigateTo = (view: SettingsViewId, newTitle: string) => {
		setCurrentView(view);
		setTitle(newTitle);
	};

	/**
	 * 一つ前の画面（メインメニュー）に戻る。
	 */
	const handleBack = () => {
		setCurrentView("menu");
		setTitle("設定");
	};

	return (
		<div
			className="fixed inset-0 modal-overlay z-50 flex justify-center items-center p-4 md:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
		>
			<div className="bg-white w-full max-h-[90vh] md:max-w-xl rounded-2xl shadow-xl flex flex-col overflow-hidden">
				{/* ヘッダーエリア */}
				<div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white md:rounded-t-lg">
					<div className="flex items-center gap-3">
						{currentView !== "menu" && (
							<button
								onClick={handleBack}
								className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-600"
							>
								<FontAwesomeIcon icon={faArrowLeft} />
							</button>
						)}
						<h2 className="text-lg font-bold text-neutral-900">{title}</h2>
					</div>
					<button
						onClick={onClose}
						className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-600"
					>
						<FontAwesomeIcon icon={faTimes} className="text-xl" />
					</button>
				</div>

				{/* コンテンツエリア */}
				<div className="grow overflow-y-auto bg-white md:rounded-b-lg">
					{currentView === "menu" && (
						<SettingsMenu
							onNavigate={navigateTo}
							openGuide={openGuide}
							openTerms={openTerms}
							onLogout={onLogout}
							appVersion={getState().appVersion || ""}
						/>
					)}

					{currentView === "general" && (
						<GeneralSettings
							getState={getState}
							reloadApp={refreshApp}
							requestNotification={requestNotification}
							disableNotification={disableNotification}
						/>
					)}

					{currentView === "accounts" && (
						<AccountSettings getState={getState} refreshApp={refreshApp} />
					)}

					{currentView === "categories" && (
						<CategorySettings getState={getState} refreshApp={refreshApp} />
					)}

					{currentView === "cards" && (
						<CreditCardRules getState={getState} refreshApp={refreshApp} />
					)}

					{currentView === "scan" && (
						<ScanSettings getState={getState} refreshApp={refreshApp} />
					)}
				</div>
			</div>
		</div>
	);
}
