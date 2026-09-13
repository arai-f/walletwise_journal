import { faCoins, faReceipt } from "@fortawesome/free-solid-svg-icons";
import TabbedListSettings, { type TabItem } from "./TabbedListSettings";

const CATEGORY_TABS: TabItem<"expense" | "income">[] = [
	{
		type: "expense",
		label: "支出カテゴリ",
		icon: faReceipt,
		activeClass: "border-primary text-primary",
	},
	{
		type: "income",
		label: "収入カテゴリ",
		icon: faCoins,
		activeClass: "border-emerald-500 text-emerald-600",
	},
];

/**
 * カテゴリ設定コンポーネント（支出カテゴリ / 収入カテゴリ）。
 */
export default function CategorySettings() {
	return <TabbedListSettings tabs={CATEGORY_TABS} />;
}
