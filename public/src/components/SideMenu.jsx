import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * サイドメニューコンポーネント。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isVisible - メニューボタンを表示するかどうか。
 * @param {object} props.user - ログインユーザー情報。
 * @param {boolean} props.isMasked - 金額マスク状態。
 * @param {string} props.appVersion - アプリバージョン文字列。
 * @param {string} props.lastUpdated - 最終更新日時文字列。
 * @param {function} props.onMaskChange - マスク状態変更時のコールバック。
 * @param {function} props.onLogout - ログアウト実行時のコールバック。
 * @param {function} props.onOpenSettings - 設定画面オープン時のコールバック。
 * @param {function} props.onOpenGuide - ガイド画面オープン時のコールバック。
 * @param {function} props.onOpenTerms - 利用規約オープン時のコールバック。
 * @param {function} props.onOpenReport - レポート画面オープン時のコールバック。
 * @returns {JSX.Element|null} サイドメニューコンポーネント。
 */
export default function SideMenu({
	isVisible,
	user,
	isMasked,
	appVersion,
	lastUpdated,
	onMaskChange,
	onLogout,
	onOpenSettings,
	onOpenGuide,
	onOpenTerms,
	onOpenReport,
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [activeSection, setActiveSection] = useState("home-section"); // Default to home

	/**
	 * スクロール位置に応じてアクティブなセクションを判定する副作用（スクロールスパイ）。
	 * メニュー項目のハイライトに使用される。
	 */
	useEffect(() => {
		const handleScroll = () => {
			const headerHeight = 64; // ヘッダーの高さ概算
			const sections = document.querySelectorAll("main > section[id]");
			const scrollPosition = window.scrollY + headerHeight + 20;

			let current = "";
			sections.forEach((section) => {
				if (scrollPosition >= section.offsetTop) {
					current = section.id;
				}
			});

			// If at the very top, force home-section
			if (window.scrollY < 50) {
				current = "home-section";
			}

			if (current) {
				setActiveSection(current);
			}
		};

		window.addEventListener("scroll", handleScroll);
		// 初回実行
		handleScroll();

		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	/**
	 * メニューが開いているときに背景のスクロールを固定する副作用。
	 * メニュー展開時のUX向上のためにbodyのスクロールを無効化する。
	 */
	useEffect(() => {
		if (isOpen) {
			document.body.classList.add("overflow-hidden");
		} else {
			document.body.classList.remove("overflow-hidden");
		}
		return () => document.body.classList.remove("overflow-hidden");
	}, [isOpen]);

	const handleLinkClick = (e, targetId) => {
		e.preventDefault();
		setIsOpen(false);
		const targetElement = document.getElementById(targetId);
		if (targetElement) {
			const headerOffset = 80; // ヘッダーの高さ＋余白
			const elementPosition = targetElement.getBoundingClientRect().top;
			const offsetPosition = elementPosition + window.scrollY - headerOffset;

			window.scrollTo({
				top: offsetPosition,
				behavior: "smooth",
			});
		}
	};

	if (!isVisible) return null;

	const MenuContent = (
		<>
			{/* Overlay */}
			<div
				className={`fixed inset-0 modal-overlay z-40 transition-opacity duration-300 ${
					isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
				}`}
				onClick={() => setIsOpen(false)}
				style={{ display: isOpen ? "block" : "none" }} // transitionが終わるまで待つのが理想だが簡易実装
			></div>

			{/* Panel */}
			<nav
				className={`fixed top-0 left-0 w-64 h-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${
					isOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				{/* User Header */}
				<div className="p-4 border-b border-neutral-200 flex items-center">
					<div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden mr-3 shrink-0">
						{user?.photoURL ? (
							<img
								src={user.photoURL}
								alt="User Avatar"
								className="w-full h-full object-cover"
							/>
						) : (
							<i className="fas fa-user text-xl text-neutral-500"></i>
						)}
					</div>
					{/* User Name could go here if available, currently just avatar based on original html */}
				</div>

				{/* Links */}
				<div className="grow overflow-y-auto">
					{[
						{ id: "home-section", icon: "fa-home", text: "ホーム" },
						{
							id: "assets-history-section",
							icon: "fa-chart-line",
							text: "資産推移",
						},
						{
							id: "analysis-section",
							icon: "fa-chart-pie",
							text: "収支レポート",
						},
						{
							id: "billing-section",
							icon: "fa-credit-card",
							text: "支払い予定",
						},
						{
							id: "transactions-section",
							icon: "fa-list-ul",
							text: "取引履歴",
						},
					].map((link) => (
						<a
							key={link.id}
							href={`#${link.id}`}
							onClick={(e) => handleLinkClick(e, link.id)}
							className={`menu-link block px-6 py-3 text-neutral-800 hover:bg-primary-light ${
								activeSection === link.id
									? "menu-link-active bg-primary-light text-primary font-bold border-r-4 border-primary"
									: ""
							}`}
						>
							<i className={`fas ${link.icon} w-6 mr-2`}></i>
							{link.text}
						</a>
					))}

					<hr className="my-2 border-neutral-200" />

					<button
						onClick={() => {
							setIsOpen(false);
							onOpenReport();
						}}
						className="w-full text-left menu-link block px-6 py-3 text-neutral-800 hover:bg-primary-light"
					>
						<i className="fas fa-file-invoice-dollar w-6 mr-2"></i>年間レポート
					</button>
					<button
						onClick={() => {
							setIsOpen(false);
							onOpenSettings();
						}}
						className="w-full text-left menu-link block px-6 py-3 text-neutral-800 hover:bg-primary-light"
					>
						<i className="fas fa-cog w-6 mr-2"></i>設定
					</button>
				</div>

				{/* Footer */}
				<div className="p-4 border-t border-neutral-200 bg-neutral-50 mb-safe">
					<button
						onClick={() => {
							setIsOpen(false);
							onLogout();
						}}
						className="block w-full text-center px-4 py-2 text-sm text-danger hover:bg-danger-light rounded-lg transition font-bold"
					>
						ログアウト
					</button>
					<div className="mt-4 text-center">
						<p className="text-xs text-neutral-400 font-mono">
							Version <span>{appVersion}</span>
						</p>
						{lastUpdated && (
							<p className="text-[10px] text-neutral-300 mt-1 md:hidden">
								{lastUpdated}
							</p>
						)}
					</div>
				</div>
			</nav>
		</>
	);

	return (
		<>
			<button
				aria-label="メニューを開く"
				onClick={() => setIsOpen(!isOpen)}
				className="w-10 h-10 shrink-0 items-center justify-center rounded-full text-neutral-500 bg-white shadow-sm hover:bg-primary-light hover:text-primary transition-all active:scale-95 z-20 flex"
			>
				<i className="fas fa-bars text-lg"></i>
			</button>
			{createPortal(MenuContent, document.body)}
		</>
	);
}
