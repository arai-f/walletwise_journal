import { useEffect } from "react";

const AVAILABLE_ICONS = [
	"fa-solid fa-wallet",
	"fa-solid fa-building-columns",
	"fa-solid fa-credit-card",
	"fa-solid fa-money-bill-wave",
	"fa-solid fa-plane",
	"fa-solid fa-train",
	"fa-solid fa-bus",
	"fa-solid fa-car",
	"fa-solid fa-gas-pump",
	"fa-solid fa-store",
	"fa-solid fa-receipt",
	"fa-solid fa-chart-line",
	"fa-solid fa-piggy-bank",
	"fa-solid fa-gift",
	"fa-solid fa-graduation-cap",
	"fa-solid fa-heart",
	"fa-brands fa-paypal",
	"fa-brands fa-cc-visa",
	"fa-brands fa-cc-jcb",
	"fa-brands fa-cc-mastercard",
	"fa-brands fa-cc-amex",
	"fa-brands fa-apple-pay",
	"fa-brands fa-google-pay",
	"fa-brands fa-amazon-pay",
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
					{AVAILABLE_ICONS.map((icon) => (
						<button
							key={icon}
							onClick={() => onSelect(icon)}
							className="p-3 rounded-lg hover:bg-neutral-200 text-2xl flex items-center justify-center transition aspect-square"
						>
							<i className={icon}></i>
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
