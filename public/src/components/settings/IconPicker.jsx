import {
	faAmazonPay,
	faApplePay,
	faCcAmex,
	faCcJcb,
	faCcMastercard,
	faCcVisa,
	faGooglePay,
	faPaypal,
} from "@fortawesome/free-brands-svg-icons";
import {
	faBus,
	faCar,
	faChartLine,
	faCreditCard,
	faGasPump,
	faGift,
	faGraduationCap,
	faHeart,
	faLandmark,
	faMoneyBillWave,
	faPiggyBank,
	faPlane,
	faReceipt,
	faStore,
	faTrain,
	faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect } from "react";

// アイコン定義と保存用文字列のマッピング
const ICON_MAP = [
	{ icon: faWallet, value: "fa-solid fa-wallet" },
	{ icon: faLandmark, value: "fa-solid fa-building-columns" },
	{ icon: faCreditCard, value: "fa-solid fa-credit-card" },
	{ icon: faMoneyBillWave, value: "fa-solid fa-money-bill-wave" },
	{ icon: faPlane, value: "fa-solid fa-plane" },
	{ icon: faTrain, value: "fa-solid fa-train" },
	{ icon: faBus, value: "fa-solid fa-bus" },
	{ icon: faCar, value: "fa-solid fa-car" },
	{ icon: faGasPump, value: "fa-solid fa-gas-pump" },
	{ icon: faStore, value: "fa-solid fa-store" },
	{ icon: faReceipt, value: "fa-solid fa-receipt" },
	{ icon: faChartLine, value: "fa-solid fa-chart-line" },
	{ icon: faPiggyBank, value: "fa-solid fa-piggy-bank" },
	{ icon: faGift, value: "fa-solid fa-gift" },
	{ icon: faGraduationCap, value: "fa-solid fa-graduation-cap" },
	{ icon: faHeart, value: "fa-solid fa-heart" },
	// Brands代替 (Solidアイコンを使用しつつ、保存値は互換性を維持)
	{ icon: faPaypal, value: "fa-brands fa-paypal" },
	{ icon: faCcVisa, value: "fa-brands fa-cc-visa" },
	{ icon: faCcJcb, value: "fa-brands fa-cc-jcb" },
	{ icon: faCcMastercard, value: "fa-brands fa-cc-mastercard" },
	{ icon: faCcAmex, value: "fa-brands fa-cc-amex" },
	{ icon: faApplePay, value: "fa-brands fa-apple-pay" },
	{ icon: faGooglePay, value: "fa-brands fa-google-pay" },
	{ icon: faAmazonPay, value: "fa-brands fa-amazon-pay" },
];

/**
 * アイコン選択モーダルコンポーネント。
 * FontAwesomeクラス名のリストからアイコンを選択させる。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているかどうか。
 * @param {Function} props.onClose - モーダルを閉じる関数。
 * @param {Function} props.onSelect - アイコン選択時のコールバック関数。選択されたアイコンのクラス名を引数に取る。
 * @return {JSX.Element} アイコン選択モーダルコンポーネント。
 */
export default function IconPicker({ isOpen, onClose, onSelect }) {
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!isOpen) return;
			if (e.key === "Escape") {
				e.stopPropagation();
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 modal-overlay z-60 flex justify-center items-center p-4 bg-black/50"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
				<div className="p-4 border-b border-neutral-200">
					<h3 className="font-bold text-lg text-neutral-900">アイコンを選択</h3>
				</div>
				<div className="p-4 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[60vh] overflow-y-auto">
					{ICON_MAP.map((item) => (
						<button
							key={item.value}
							onClick={() => onSelect(item.value)}
							className="p-3 rounded-lg hover:bg-neutral-200 text-2xl flex items-center justify-center transition aspect-square"
						>
							<FontAwesomeIcon icon={item.icon} />
						</button>
					))}
				</div>
				<div className="p-4 border-t border-neutral-200 flex justify-end">
					<button
						onClick={onClose}
						className="px-4 py-2 bg-neutral-100 rounded-lg hover:bg-neutral-200 text-sm font-bold text-neutral-700"
					>
						キャンセル
					</button>
				</div>
			</div>
		</div>
	);
}
