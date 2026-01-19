import React from "react";
import logoImg from "../../../favicon/favicon-96x96.png";

/**
 * アプリケーションのヘッダーコンポーネント。
 * ロゴ、ナビゲーション、最終更新日時、設定ボタンなどを表示する。
 * @param {Object} props - コンポーネントプロパティ。
 * @param {boolean} props.loading - データが読み込み中かどうか。
 * @param {Date|string|null} props.lastUpdated - 最終更新日時。
 * @param {Object} props.actions - アクション関数群。
 * @param {Function} props.onRefresh - データ更新ボタンのクリックハンドラ。
 * @returns {JSX.Element} ヘッダーコンポーネント。
 */
export default function Header({ loading, lastUpdated, actions, onRefresh }) {
	const formattedLastUpdated = React.useMemo(() => {
		if (loading) return "データ取得中...";
		if (!lastUpdated) return "";
		if (typeof lastUpdated === "string") return lastUpdated;
		try {
			return `最終取得: ${lastUpdated.toLocaleTimeString("ja-JP", {
				hour: "2-digit",
				minute: "2-digit",
			})}`;
		} catch (e) {
			return "";
		}
	}, [lastUpdated, loading]);

	const [activeSection, setActiveSection] = React.useState("home-section");

	React.useEffect(() => {
		const handleScroll = () => {
			const headerHeight = 64;
			const sections = document.querySelectorAll("main > section[id]");
			const scrollPosition = window.scrollY + headerHeight + 100;

			let current = "";
			sections.forEach((section) => {
				if (scrollPosition >= section.offsetTop) {
					current = section.id;
				}
			});

			if (window.scrollY < 50) current = "home-section";
			if (current) setActiveSection(current);
		};

		window.addEventListener("scroll", handleScroll);
		handleScroll();

		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const handleNavClick = (targetId) => {
		if (targetId === "home-section") {
			window.scrollTo({ top: 0, behavior: "smooth" });
			return;
		}
		const element = document.getElementById(targetId);
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
	};

	return (
		<header className="sticky top-0 z-30 flex items-center justify-between bg-neutral-50/95 backdrop-blur-sm py-2 border-b border-neutral-200 mb-6 h-16 transform-gpu -mx-4 md:-mx-6 px-4 md:px-6 transition-all">
			<div className="flex items-center gap-6 min-w-0 md:ml-3 grow">
				<div className="flex items-center gap-2 shrink-0">
					<img
						src={logoImg}
						alt="Logo"
						className="w-8 h-8 shrink-0 rounded-lg"
						width="32"
						height="32"
					/>
					<h1 className="text-xl md:text-2xl font-bold tracking-tight truncate text-left">
						<span className="bg-clip-text text-transparent bg-linear-to-r from-primary to-violet-600">
							WalletWise
						</span>{" "}
						<span className="text-neutral-800">Journal</span>
					</h1>
				</div>

				{/* PC Navigation */}
				<nav className="hidden md:flex items-center gap-1">
					{[
						{ id: "home-section", label: "ホーム", icon: "fa-home" },
						{
							id: "assets-history-section",
							label: "推移",
							icon: "fa-chart-line",
						},
						{ id: "analysis-section", label: "分析", icon: "fa-chart-pie" },
						{ id: "billing-section", label: "支払い", icon: "fa-credit-card" },
						{ id: "transactions-section", label: "履歴", icon: "fa-list-ul" },
					].map((item) => (
						<button
							key={item.id}
							onClick={() => handleNavClick(item.id)}
							className={`px-2 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
								activeSection === item.id
									? "bg-neutral-100 text-primary"
									: "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
							}`}
						>
							<i
								className={`fas ${item.icon} ${activeSection === item.id ? "text-primary" : "text-neutral-400"}`}
							></i>
							{item.label}
						</button>
					))}
				</nav>
			</div>

			<div className="flex items-center gap-3 shrink-0 z-20 ml-auto">
				<div className="text-neutral-400 text-right mr-1">
					{loading ? (
						<span className="text-[10px]">...</span>
					) : lastUpdated instanceof Date ? (
						<div className="flex flex-col items-end leading-none">
							<span className="text-[8px] opacity-70 scale-90 origin-right mb-0.5">
								最終取得
							</span>
							<span className="text-[10px] font-medium tabular-nums">
								{lastUpdated.toLocaleTimeString("ja-JP", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</div>
					) : (
						<span className="text-[10px]">{formattedLastUpdated}</span>
					)}
				</div>

				<button
					onClick={onRefresh}
					aria-label="データを更新する"
					className="w-10 h-10 flex items-center justify-center rounded-full text-primary bg-white shadow-sm hover:bg-primary-light transition-all active:scale-95"
					title="データを更新"
				>
					<i className="fas fa-sync-alt text-lg"></i>
				</button>

				<button
					onClick={actions?.onOpenSettings}
					className="w-10 h-10 hidden md:flex items-center justify-center rounded-full text-neutral-500 bg-white shadow-sm hover:bg-neutral-100 transition-all active:scale-95"
					title="設定"
				>
					<i className="fas fa-cog text-lg"></i>
				</button>
			</div>
		</header>
	);
}
