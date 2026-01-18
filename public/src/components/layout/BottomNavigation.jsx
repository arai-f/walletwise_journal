import { useEffect, useRef, useState } from "react";

/**
 * モバイル用ボトムナビゲーションコンポーネント。
 * 画面下部に固定され、主要な画面への遷移とアクションを提供する。
 * @param {object} props - プロパティ。
 * @param {string} props.activeSection - 現在アクティブなセクションID。
 * @param {Function} props.onNavigate - ナビゲーション実行時のコールバック。
 * @param {Function} props.onOpenAdd - 追加モーダルを開くコールバック。
 * @param {Function} props.onOpenSettings - 設定モーダルを開くコールバック。
 */
export default function BottomNavigation({
	activeSection,
	onNavigate,
	onOpenAdd,
	onOpenSettings,
}) {
	const [isVisible, setIsVisible] = useState(true);
	const lastScrollY = useRef(0);

	useEffect(() => {
		const handleScroll = () => {
			const currentScrollY = window.scrollY;

			// 最上部付近は常に表示
			if (currentScrollY < 10) {
				setIsVisible(true);
				lastScrollY.current = currentScrollY;
				return;
			}

			if (currentScrollY > lastScrollY.current) {
				setIsVisible(false);
			} else {
				setIsVisible(true);
			}
			lastScrollY.current = currentScrollY;
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const navItems = [
		{
			id: "home-section",
			relatedIds: ["assets-history-section"],
			icon: "fa-home",
			label: "ホーム",
		},
		{
			id: "analysis-section",
			relatedIds: ["billing-section"],
			icon: "fa-chart-pie",
			label: "分析",
		},
		{ id: "add", icon: "fa-plus", label: "登録", isAction: true },
		{ id: "transactions-section", icon: "fa-list-ul", label: "履歴" },
		{ id: "settings", icon: "fa-cog", label: "設定", isAction: true },
	];

	return (
		<nav
			className={`fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-neutral-200 pb-safe-area shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-40 transition-transform duration-300 ${
				isVisible ? "translate-y-0" : "translate-y-[160%]"
			}`}
		>
			<div className="flex justify-around items-end h-20 px-2 pb-4">
				{navItems.map((item) => {
					if (item.id === "add") {
						return (
							<button
								key={item.id}
								onClick={onOpenAdd}
								className="flex flex-col items-center justify-center -mt-8 group"
								aria-label="取引を追加"
							>
								<div className="w-14 h-14 ai-rainbow-btn rounded-full shadow-lg flex items-center justify-center mb-1 transition-all duration-200 ease-out group-active:scale-90 group-active:brightness-90">
									<i
										className={`fas ${item.icon} text-2xl transition-transform duration-300 group-active:rotate-90`}
									></i>
								</div>
								<span className="text-[10px] font-bold text-neutral-500">
									{item.label}
								</span>
							</button>
						);
					} else if (item.id === "settings") {
						return (
							<button
								key={item.id}
								onClick={onOpenSettings}
								className="flex flex-col items-center justify-center w-14 py-1 text-neutral-400 hover:text-neutral-600 active:text-primary active:scale-90 transition-all duration-200"
								aria-label="設定を開く"
							>
								<i className={`fas ${item.icon} text-2xl mb-1`}></i>
								<span className="text-[10px] font-medium">{item.label}</span>
							</button>
						);
					}

					const isActive =
						activeSection === item.id ||
						item.relatedIds?.includes(activeSection);
					return (
						<button
							key={item.id}
							onClick={() => onNavigate(item.id)}
							className={`flex flex-col items-center justify-center w-14 py-1 active:scale-90 transition-all duration-200 ${
								isActive
									? "text-primary"
									: "text-neutral-400 hover:text-neutral-600"
							}`}
						>
							<i
								className={`fas ${item.icon} text-2xl mb-1 transition-transform duration-200 ${
									isActive ? "-translate-y-1" : ""
								}`}
							></i>
							<span
								className={`text-[10px] ${
									isActive ? "font-bold" : "font-medium"
								}`}
							>
								{item.label}
							</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}
