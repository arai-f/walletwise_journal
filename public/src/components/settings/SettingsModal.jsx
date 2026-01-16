import { useEffect, useState } from "react";
import * as utils from "../../utils";
import CreditCardRules from "./CreditCardRules";
import GeneralSettings from "./GeneralSettings";
import ListSettings from "./ListSettings";
import ScanSettings from "./ScanSettings";
import SettingsMenu from "./SettingsMenu";

/**
 * 設定画面モーダルを管理するコンテナコンポーネント。
 * ルーティングロジックを持ち、メニュー画面と各設定詳細画面の切り替えを行う。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダル表示状態。
 * @param {Function} props.onClose - 閉じるコールバック関数。
 * @param {object} props.store - ストア操作オブジェクト。
 * @param {Function} props.getState - 現在のステート取得関数。
 * @param {Function} props.refreshApp - アプリ全体の再描画/再取得関数。
 * @param {Function} props.requestNotification - 通知許可リクエスト関数。
 * @param {Function} props.disableNotification - 通知無効化関数。
 * @param {Function} props.openGuide - ガイドを開く関数。
 * @param {Function} props.openTerms - 利用規約を開く関数。
 * @return {JSX.Element} 設定モーダルコンポーネント。
 */
export default function SettingsModal({
	isOpen,
	onClose,
	store,
	getState,
	refreshApp,
	requestNotification,
	disableNotification,
	openGuide,
	openTerms,
}) {
	const [currentView, setCurrentView] = useState("menu");
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
		const handleKeyDown = (e) => {
			if (!isOpen) return;
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
	}, [isOpen, currentView]);

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
	 * @param {string} view - 遷移先のビューID
	 * @param {string} newTitle - ヘッダーに表示するタイトル
	 */
	const navigateTo = (view, newTitle) => {
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
								<i className="fas fa-arrow-left"></i>
							</button>
						)}
						<h2 className="text-lg font-bold text-neutral-900">{title}</h2>
					</div>
					<button
						onClick={onClose}
						className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-600"
					>
						<i className="fas fa-times text-xl"></i>
					</button>
				</div>

				{/* コンテンツエリア */}
				<div className="grow overflow-y-auto bg-white md:rounded-b-lg">
					{currentView === "menu" && (
						<SettingsMenu
							onNavigate={navigateTo}
							store={store}
							getState={getState}
							openGuide={openGuide}
							openTerms={openTerms}
						/>
					)}

					{currentView === "general" && (
						<GeneralSettings
							store={store}
							getState={getState}
							reloadApp={refreshApp}
							requestNotification={requestNotification}
							disableNotification={disableNotification}
						/>
					)}

					{currentView === "assets" && (
						<ListSettings
							type="asset"
							title="資産口座"
							store={store}
							getState={getState}
							refreshApp={refreshApp}
						/>
					)}

					{currentView === "liabilities" && (
						<ListSettings
							type="liability"
							title="負債口座"
							store={store}
							getState={getState}
							refreshApp={refreshApp}
						/>
					)}

					{currentView === "income" && (
						<ListSettings
							type="income"
							title="収入カテゴリ"
							store={store}
							getState={getState}
							refreshApp={refreshApp}
						/>
					)}

					{currentView === "expense" && (
						<ListSettings
							type="expense"
							title="支出カテゴリ"
							store={store}
							getState={getState}
							refreshApp={refreshApp}
						/>
					)}

					{currentView === "cards" && (
						<CreditCardRules
							store={store}
							getState={getState}
							refreshApp={refreshApp}
						/>
					)}

					{currentView === "scan" && (
						<ScanSettings
							store={store}
							getState={getState}
							refreshApp={refreshApp}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
