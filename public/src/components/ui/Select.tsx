import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";

/**
 * セレクトボックス（プルダウン）コンポーネント。
 * ラベル付きの選択フィールドとカスタム矢印アイコンを表示する。
 * @param {object} props - コンポーネントプロパティ。
 * @param {string} props.label - 選択項目のラベル。
 * @param {React.ReactNode} props.children - セレクトボックス内の選択肢要素。
 * @param {string} [props.className=""] - コンテナの追加CSSクラス名。
 * @param {string} [props.selectClassName=""] - select要素に追加するクラス名。
 * @param {React.Ref} ref - フォワードされた参照。
 * @returns {JSX.Element} セレクトボックスコンポーネント。
 */
const Select = React.forwardRef(
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
