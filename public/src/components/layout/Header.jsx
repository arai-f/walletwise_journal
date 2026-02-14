import {
	faChartPie,
	faCog,
	faCreditCard,
	faHome,
	faListUl,
	faSyncAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useMemo, useState } from "react";
import logoImg from "../../../favicon/favicon-96x96.png";
import { formatCurrency, toYYYYMM, toYYYYMMDD } from "../../utils.js";

/**
 * アプリケーションのヘッダーコンポーネント。
 * アイコン、ナビゲーション（PC）、資産情報ティッカー、更新情報を横並びで表示する。
 * @param {Object} props - コンポーネントプロパティ。
 * @param {boolean} props.loading - データが読み込み中かどうか。
 * @param {Date|string|null} props.lastUpdated - 最終更新日時。
 * @param {Object} props.actions - アクション関数群。
 * @param {Function} props.onRefresh - データ更新ボタンのクリックハンドラ。
 * @param {Object} props.accountBalances - 口座残高マップ。
 * @param {Array} props.transactions - 取引履歴。
 * @param {boolean} props.isMasked - 金額マスク状態。
 * @returns {JSX.Element} ヘッダーコンポーネント。
 */
export default function Header({
	loading,
	lastUpdated,
	actions,
	onRefresh,
	accountBalances = {},
	transactions = [],
	isMasked = false,
}) {
	/**
	 * 最終更新日時を表示用にフォーマットする。
	 * ローディング中は「更新中...」、データがない場合は空文字を返す。
	 */
	const formattedLastUpdated = React.useMemo(() => {
		if (loading) return "更新中...";
		if (!lastUpdated) return "";
		if (typeof lastUpdated === "string") return lastUpdated;
		try {
			return lastUpdated.toLocaleTimeString("ja-JP", {
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch (e) {
			return "";
		}
	}, [lastUpdated, loading]);

	// 現在のアクティブなセクションIDを管理するステート
	const [activeSection, setActiveSection] = useState("home-section");

	/**
	 * スクロールイベントを監視し、現在表示されているセクションを特定してナビゲーションを更新する。
	 * ヘッダーの高さとオフセットを考慮して判定を行う。
	 */
	useEffect(() => {
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

	/**
	 * ナビゲーション項目クリック時のハンドラ。
	 * 指定されたセクションへスムーズスクロールする。
	 */
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

	// ========================================================================
	// 資産情報ティッカーの実装
	// ========================================================================

	// 表示モード: 0:総資産, 1:本日の収支, 2:今月の収支
	const [tickerMode, setTickerMode] = useState(0);
	const [isAnimating, setIsAnimating] = useState(false);

	/**
	 * 口座残高と取引履歴から、資産合計・本日の収支・今月の収支を計算する。
	 * @returns {Object} { totalAssets, dailyNet, monthlyNet } 計算結果オブジェクト。
	 */
	const stats = useMemo(() => {
		const totalAssets = Object.values(accountBalances).reduce(
			(sum, val) => sum + val,
			0,
		);

		const todayStr = toYYYYMMDD(new Date());
		const thisMonthStr = toYYYYMM(new Date());

		let dailyNet = 0;
		let monthlyNet = 0;

		transactions.forEach((t) => {
			const tDateStr = toYYYYMMDD(t.date);
			const tMonthStr = toYYYYMM(t.date);
			const amt = Number(t.amount);
			const val = t.type === "income" ? amt : t.type === "expense" ? -amt : 0;

			if (val !== 0) {
				if (tDateStr === todayStr) dailyNet += val;
				if (tMonthStr === thisMonthStr) monthlyNet += val;
			}
		});

		return { totalAssets, dailyNet, monthlyNet };
	}, [accountBalances, transactions]);

	/**
	 * ティッカーの表示モードを一定間隔で自動的に切り替える。
	 */
	useEffect(() => {
		const interval = setInterval(() => {
			handleNextTicker();
		}, 5000);
		return () => clearInterval(interval);
	}, []);

	/**
	 * 次のティッカーモードへ切り替えるアニメーションを開始する。
	 */
	const handleNextTicker = () => {
		setIsAnimating(true);
		setTimeout(() => {
			setTickerMode((prev) => (prev + 1) % 3);
			setIsAnimating(false);
		}, 300);
	};

	/**
	 * 現在のティッカーモード（総資産、本日、今月）に応じたJSXコンテンツを生成する。
	 * @returns {JSX.Element|null} ティッカーの中身。
	 */
	const renderTickerContent = () => {
		switch (tickerMode) {
			case 0: // Total
				return (
					<div className="flex flex-col justify-center h-full">
						<span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider leading-none mb-0.5">
							Total Assets
						</span>
						<span className="text-lg font-bold text-neutral-900 tabular-nums leading-tight truncate">
							{formatCurrency(stats.totalAssets, isMasked)}
						</span>
					</div>
				);
			case 1: // Today
				return (
					<div className="flex flex-col justify-center h-full">
						<span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider leading-none mb-0.5">
							Today's Change
						</span>
						<span
							className={`text-lg font-bold tabular-nums leading-tight truncate ${
								stats.dailyNet > 0
									? "text-green-600"
									: stats.dailyNet < 0
										? "text-red-600"
										: "text-neutral-600"
							}`}
						>
							{stats.dailyNet > 0 ? "+" : ""}
							{formatCurrency(stats.dailyNet, isMasked)}
						</span>
					</div>
				);
			case 2: // Month
				return (
					<div className="flex flex-col justify-center h-full">
						<span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider leading-none mb-0.5">
							This Month
						</span>
						<span
							className={`text-lg font-bold tabular-nums leading-tight truncate ${
								stats.monthlyNet > 0
									? "text-green-600"
									: stats.monthlyNet < 0
										? "text-red-600"
										: "text-neutral-600"
							}`}
						>
							{stats.monthlyNet > 0 ? "+" : ""}
							{formatCurrency(stats.monthlyNet, isMasked)}
						</span>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<header className="sticky top-0 z-30 flex items-center justify-between bg-neutral-50/95 backdrop-blur-sm py-2 border-b border-neutral-200 mb-6 h-16 transform-gpu -mx-4 md:-mx-6 px-4 md:px-6 transition-all">
			<div className="flex items-center shrink-0 mr-4 md:mr-6">
				<div className="flex items-center gap-2">
					<img
						src={logoImg}
						alt="Logo"
						className="w-8 h-8"
						width="32"
						height="32"
					/>
					<div className="flex flex-col justify-center leading-none">
						<span className="font-bold text-sm tracking-tight bg-clip-text text-transparent bg-linear-to-r from-primary to-violet-600">
							WalletWise
						</span>
						<span className="text-[10px] font-bold text-neutral-400 tracking-widest uppercase">
							Journal
						</span>
					</div>
				</div>

				<nav className="hidden md:flex items-center gap-1 ml-4 pl-4 pr-4 border-l border-r border-neutral-200 h-8">
					{[
						{ id: "home-section", label: "ホーム", icon: faHome },
						{ id: "analysis-section", label: "分析", icon: faChartPie },
						{ id: "billing-section", label: "支払い", icon: faCreditCard },
						{ id: "transactions-section", label: "履歴", icon: faListUl },
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
							<FontAwesomeIcon
								icon={item.icon}
								className={
									activeSection === item.id
										? "text-primary"
										: "text-neutral-400"
								}
							/>
							{item.label}
						</button>
					))}
				</nav>
			</div>

			<div
				className="flex-1 min-w-0 h-10 flex items-center cursor-pointer select-none group relative overflow-hidden"
				onClick={handleNextTicker}
			>
				<div
					className={`absolute inset-0 flex items-center transition-all duration-300 ease-out ${
						isAnimating
							? "-translate-y-2 opacity-0"
							: "translate-y-0 opacity-100"
					}`}
				>
					{renderTickerContent()}
				</div>

				<div className="absolute bottom-0 left-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className={`w-1 h-1 rounded-full transition-colors ${
								tickerMode === i ? "bg-primary" : "bg-neutral-300"
							}`}
						/>
					))}
				</div>
			</div>

			<div className="flex items-center gap-2 shrink-0 ml-4">
				<div className="text-neutral-400 text-right mr-1">
					<div className="flex flex-col items-end leading-none">
						<span className="text-[8px] opacity-70 scale-90 origin-right mb-0.5">
							{loading ? "SYNCING" : "UPDATED"}
						</span>
						<span className="text-[10px] font-medium tabular-nums">
							{loading ? "..." : formattedLastUpdated}
						</span>
					</div>
				</div>

				<button
					onClick={onRefresh}
					aria-label="データを更新する"
					className="w-10 h-10 flex items-center justify-center rounded-full text-primary bg-white shadow-sm hover:bg-primary-light transition-all active:scale-95"
					title="データを更新"
				>
					<FontAwesomeIcon icon={faSyncAlt} className="text-lg" />
				</button>

				<button
					onClick={actions?.onOpenSettings}
					className="w-10 h-10 hidden md:flex items-center justify-center rounded-full text-neutral-500 bg-white shadow-sm hover:bg-neutral-100 transition-all active:scale-95"
					title="設定"
				>
					<FontAwesomeIcon icon={faCog} className="text-lg" />
				</button>
			</div>
		</header>
	);
}
