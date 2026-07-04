import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

/**
 * セレクトコンポーネントのプロパティ。
 * 標準の `select` 要素の属性をすべて継承する。
 */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	/** 選択項目のラベル。 */
	label?: string;
	/** `<option>` 要素などの子要素。 */
	children: ReactNode;
	/** select要素に追加するクラス名。 */
	selectClassName?: string;
}

/**
 * 汎用セレクト（ドロップダウン）コンポーネント。
 * ラベル付きの選択フィールドとカスタム矢印アイコンを表示する。
 * @param props - コンポーネントプロパティ。
 * @param ref - フォワードされた参照。
 * @returns セレクトボックスコンポーネント。
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
	(
		{ label, children, className = "", selectClassName = "", ...props },
		ref,
	) => {
		return (
			<div className={className}>
				{label && (
					<label className="block text-sm font-medium text-neutral-700 mb-1">
						{label}
					</label>
				)}
				<div className="relative">
					<select
						ref={ref}
						className={`h-9 w-full border border-neutral-300 rounded-lg pl-3 pr-8 py-1 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-white disabled:bg-neutral-100 disabled:text-neutral-500 appearance-none cursor-pointer ${selectClassName}`}
						{...props}
					>
						{children}
					</select>
					<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-500">
						<FontAwesomeIcon icon={faChevronDown} className="text-xs" />
					</div>
				</div>
			</div>
		);
	},
);

Select.displayName = "Select";
export default Select;