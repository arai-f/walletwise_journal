import React from "react";
import SideMenu from "../SideMenu";

const Header = ({
	user,
	loading,
	lastUpdated,
	isAmountMasked,
	actions,
	appVersion,
	onRefresh,
}) => {
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

	return (
		<header className="sticky top-0 z-30 flex items-center justify-between bg-neutral-50 py-2 border-b border-neutral-200 mb-6 h-16 transform-gpu">
			<div id="side-menu-wrapper">
				<SideMenu
					isVisible={true}
					user={user}
					isMasked={isAmountMasked}
					appVersion={appVersion}
					lastUpdated={formattedLastUpdated}
					onMaskChange={actions.onMaskChange}
					onLogout={actions.onLogout}
					onOpenSettings={actions.onOpenSettings}
					onOpenGuide={actions.onOpenGuide}
					onOpenTerms={actions.onOpenTerms}
					onOpenReport={actions.onOpenReport}
				/>
			</div>

			<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-2 w-full max-w-[calc(100%-100px)] md:static md:w-auto md:max-w-none md:justify-start md:grow md:ml-3 md:translate-x-0 md:translate-y-0">
				<img
					src="/favicon/favicon-96x96.png"
					alt="Logo"
					className="w-8 h-8 shrink-0 rounded-lg"
					width="32"
					height="32"
				/>
				<h1 className="text-xl md:text-2xl font-bold tracking-tight truncate text-center md:text-left">
					<span className="bg-clip-text text-transparent bg-linear-to-r from-primary to-violet-600">
						WalletWise
					</span>
					<span className="text-neutral-800">Journal</span>
				</h1>
			</div>

			<div className="flex items-center gap-3 shrink-0 z-20 ml-auto md:ml-0">
				<div className="hidden md:block">
					<p className="text-xs text-neutral-400 whitespace-nowrap">
						{formattedLastUpdated}
					</p>
				</div>

				<button
					onClick={onRefresh}
					aria-label="データを更新する"
					className="w-10 h-10 flex items-center justify-center rounded-full text-primary bg-white shadow-sm hover:bg-primary-light transition-all active:scale-95"
					title="データを更新"
				>
					<i className="fas fa-sync-alt text-lg"></i>
				</button>
			</div>
		</header>
	);
};

export default Header;
