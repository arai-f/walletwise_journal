import {
	faBook,
	faCamera,
	faChevronRight,
	faCog,
	faFileAlt,
	faMoneyCheck,
	faSignOutAlt,
	faTags,
	faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

/**
 * 設定メニューのリストを表示するコンポーネント。
 * 各設定項目へのナビゲーションボタンを提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Function} props.onNavigate - ナビゲーション実行時のコールバック (viewId, title)。
 * @param {Function} props.openGuide - ガイド画面オープン関数。
 * @param {Function} props.openTerms - 利用規約オープン関数。
 * @param {Function} props.onLogout - ログアウト関数。
 * @param {string} props.appVersion - アプリバージョン。
 * @return {JSX.Element} 設定メニューコンポーネント。
 */
export default function SettingsMenu({
	onNavigate,
	openGuide,
	openTerms,
	onLogout,
	appVersion,
}) {
	// メニュー項目の定義リスト
	const menuItems = [
		{
			id: "general",
			title: "一般設定",
			icon: faCog,
			desc: "表示期間、通知など",
		},
		{
			id: "accounts",
			title: "口座設定",
			icon: faWallet,
			desc: "資産・負債口座の管理",
		},
		{
			id: "categories",
			title: "カテゴリ設定",
			icon: faTags,
			desc: "支出・収入カテゴリの管理",
		},
		{
			id: "cards",
			title: "カード支払い設定",
			icon: faMoneyCheck,
			desc: "引き落とし口座、締め日設定",
		},
		{
			id: "scan",
			title: "スキャン設定",
			icon: faCamera,
			desc: "除外ワード、自動分類ルール",
		},
	];

	return (
		<div className="pb-6">
			{menuItems.map((item) => (
				<button
					key={item.id}
					onClick={() => onNavigate(item.id, item.title)}
					className="w-full text-left flex items-center py-3.5 px-5 border-b border-neutral-100 bg-white hover:bg-neutral-50 transition"
				>
					<div className="w-8 h-8 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600 mr-3 shrink-0">
						<FontAwesomeIcon icon={item.icon} className="text-sm" />
					</div>
					<div className="flex flex-col">
						<span className="text-base font-medium text-neutral-900 leading-none">
							{item.title}
						</span>
						{item.desc && (
							<span className="text-xs text-neutral-500 mt-1 leading-none">
								{item.desc}
							</span>
						)}
					</div>
					<FontAwesomeIcon
						icon={faChevronRight}
						className="ml-auto text-neutral-400 text-sm"
					/>
				</button>
			))}

			<div className="h-4 bg-neutral-50 border-y border-neutral-100 my-0"></div>

			<button
				onClick={openGuide}
				className="w-full text-left flex items-center py-3.5 px-5 border-b border-neutral-100 bg-white hover:bg-neutral-50 transition"
			>
				<div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600 mr-3 shrink-0">
					<FontAwesomeIcon icon={faBook} className="text-sm" />
				</div>
				<span className="text-base font-medium text-neutral-900">
					使い方ガイド
				</span>
				<FontAwesomeIcon
					icon={faChevronRight}
					className="ml-auto text-neutral-400 text-sm"
				/>
			</button>

			<button
				onClick={openTerms}
				className="w-full text-left flex items-center py-3.5 px-5 border-b border-neutral-100 bg-white hover:bg-neutral-50 transition"
			>
				<div className="w-8 h-8 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-600 mr-3 shrink-0">
					<FontAwesomeIcon icon={faFileAlt} className="text-sm" />
				</div>
				<span className="text-base font-medium text-neutral-900">利用規約</span>
				<FontAwesomeIcon
					icon={faChevronRight}
					className="ml-auto text-neutral-400 text-sm"
				/>
			</button>

			<div className="px-5 pt-4">
				{onLogout && (
					<button
						onClick={() => {
							if (confirm("ログアウトしますか？")) {
								onLogout();
							}
						}}
						className="w-full py-3 flex items-center justify-center gap-2 text-rose-600 font-bold bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors mb-4"
					>
						<FontAwesomeIcon icon={faSignOutAlt} />
						ログアウト
					</button>
				)}

				<div className="text-center">
					<p className="text-xs text-neutral-400 font-mono">
						WalletWise Journal v{appVersion}
					</p>
					<p className="text-[10px] text-neutral-300 mt-1">
						© 2026 Fumiya ARAI. Licensed under AGPL v3.
					</p>
				</div>
			</div>
		</div>
	);
}
