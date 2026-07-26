import { forwardRef, type ButtonHTMLAttributes } from "react";

/**
 * スイッチコンポーネントのプロパティ。
 * `button` 要素の属性を継承するが、`onChange` は内部で管理される。
 */
interface SwitchProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
	/**
	 * スイッチがオン（checked）の状態か。
	 */
	checked: boolean;
	/**
	 * スイッチの状態が変更されたときに呼び出されるコールバック関数。
	 * @param checked - 新しい状態。
	 */
	onChange: (checked: boolean) => void;
}

/**
 * 汎用スイッチ（トグル）コンポーネント。
 * `button` 要素と `role="switch"` を使用してアクセシビリティを確保する。
 * @param props - コンポーネントプロパティ。
 * @param ref - フォワードされた参照。
 * @returns スイッチコンポーネント。
 */
const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
	({ checked, onChange, className = "", ...props }, ref) => {
		const baseClass =
			"relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2";
		const toggleClass = checked ? "bg-indigo-600" : "bg-gray-200";
		const knobClass =
			"inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out";
		const knobTranslateClass = checked ? "translate-x-5" : "translate-x-0";

		return (
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				ref={ref}
				className={`${baseClass} ${toggleClass} ${className}`}
				{...props}
			>
				<span aria-hidden="true" className={`${knobClass} ${knobTranslateClass}`} />
			</button>
		);
	},
);

Switch.displayName = "Switch";
export default Switch;