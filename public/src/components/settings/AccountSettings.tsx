import { faCreditCard, faWallet } from "@fortawesome/free-solid-svg-icons";
import TabbedListSettings, { type TabItem } from "./TabbedListSettings";

const ACCOUNT_TABS: TabItem<"asset" | "liability">[] = [
	{
		type: "asset",
		label: "資産口座",
		icon: faWallet,
		activeClass: "border-primary text-primary",
	},
	{
		type: "liability",
		label: "負債口座",
		icon: faCreditCard,
		activeClass: "border-rose-500 text-rose-600",
	},
];

/**
 * 口座設定コンポーネント（資産口座 / 負債口座）。
 */
export default function AccountSettings() {
	return <TabbedListSettings tabs={ACCOUNT_TABS} />;
}
