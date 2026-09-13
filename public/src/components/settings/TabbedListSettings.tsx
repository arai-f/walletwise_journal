import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import type { ItemType } from "../../types/settings";
import ListSettings from "./ListSettings";

/**
 * タブ項目の設定定義。
 */
export interface TabItem<T extends ItemType = ItemType> {
	type: T;
	label: string;
	icon: IconDefinition;
	activeClass: string;
}

/**
 * TabbedListSettings のプロパティ。
 */
interface TabbedListSettingsProps<T extends ItemType = ItemType> {
	tabs: TabItem<T>[];
	defaultTab?: T;
}

/**
 * タブ切り替え付きのリスト設定画面共通コンポーネント。
 * 口座設定やカテゴリ設定など、タイプ別のListSettings切り替えを一元管理する。
 */
export default function TabbedListSettings<T extends ItemType = ItemType>({
	tabs,
	defaultTab,
}: TabbedListSettingsProps<T>) {
	const [activeTab, setActiveTab] = useState<T>(defaultTab || tabs[0]?.type);

	return (
		<div className="min-h-full bg-neutral-50">
			{/* タブ切り替えヘッダー */}
			<div className="sticky top-0 z-10 flex shrink-0 bg-white border-b border-neutral-200">
				{tabs.map((tab) => {
					const isActive = activeTab === tab.type;
					return (
						<button
							key={tab.type}
							onClick={() => setActiveTab(tab.type)}
							className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
								isActive
									? tab.activeClass
									: "border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
							}`}
						>
							<div className="flex items-center justify-center gap-2">
								<FontAwesomeIcon icon={tab.icon} />
								{tab.label}
							</div>
						</button>
					);
				})}
			</div>

			{/* コンテンツエリア */}
			<div className="relative">
				<ListSettings key={activeTab} type={activeTab} title="" />
			</div>
		</div>
	);
}
