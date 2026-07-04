import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// スタイルバリアントの定義
const variants = {
	primary:
		"bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm focus:ring-indigo-600",
	secondary:
		"bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-700 font-bold focus:ring-neutral-200",
	danger:
		"bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm focus:ring-red-600",
	"danger-ghost": "bg-red-50 text-red-600 hover:bg-red-100 font-bold",
	success:
		"bg-green-600 hover:bg-green-700 text-white font-bold shadow-sm focus:ring-green-600",
	ghost:
		"text-neutral-600 hover:text-neutral-900 bg-transparent hover:bg-neutral-100",
	dashed:
		"border-2 border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-400 font-bold",
	icon: "p-2 text-neutral-600 hover:bg-neutral-100 rounded-full",
	menu: "block px-6 py-3 text-neutral-800 hover:bg-indigo-50 text-left w-full",
	danger_text: "text-red-600 hover:bg-red-50 font-bold",
};

type ButtonVariant = keyof typeof variants;

/**
 * ボタンコンポーネントのプロパティ。
 * 標準の `button` 要素の属性をすべて継承する。
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** ボタン内に表示するコンテンツ。 */
	children: ReactNode;
	/**
	 * スタイルバリアント。
	 * @default "primary"
	 */
	variant?: ButtonVariant;
}

/**
 * 汎用ボタンコンポーネント。
 * 定義済みのバリアントスタイルを適用し、クリックイベントや状態変化に対応する。
 * @param props - コンポーネントプロパティ。
 * @param ref - フォワードされた参照。
 * @returns ボタンコンポーネント。
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			children,
			type = "button",
			variant = "primary",
			className = "",
			...props
		},
		ref,
	) => {
		const baseClass =
			"rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center justify-center gap-2";
		const paddingClass = variant === "icon" ? "" : "px-4 py-1.5";
		const variantClass = variants[variant] || variants.primary;

		return (
			<button
				ref={ref}
				type={type}
				className={`${baseClass} ${paddingClass} ${variantClass} ${className}`}
				{...props}
			>
				{children}
			</button>
		);
	},
);

Button.displayName = "Button";
export default Button;