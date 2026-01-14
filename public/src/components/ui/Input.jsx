import React from "react";

/**
 * テキスト入力フィールドコンポーネント。
 * ラベルやアイコン（装飾）付きの入力フィールドを提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {string} props.label - 入力項目のラベル。
 * @param {string} [props.type="text"] - 入力タイプ。
 * @param {string} props.startAdornment - 入力欄の先頭に表示するアイコンや単位。
 * @param {string} [props.className=""] - コンテナの追加CSSクラス名。
 * @param {string} [props.inputClassName=""] - 入力フィールドの追加CSSクラス名。
 * @param {React.Ref} ref - フォワードされた参照。
 * @return {JSX.Element} 入力フィールドコンポーネントのJSX要素。
 */
const Input = React.forwardRef(
	(
		{
			label,
			type = "text",
			startAdornment,
			className = "",
			inputClassName = "",
			...props
		},
		ref
	) => {
		return (
			<div className={className}>
				{label && (
					<label className="block text-sm font-medium text-neutral-700 mb-1">
						{label}
					</label>
				)}
				<div className="relative">
					{startAdornment && (
						<div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 flex items-center pointer-events-none">
							{startAdornment}
						</div>
					)}
					<input
						ref={ref}
						type={type}
						className={`h-9 w-full border border-neutral-300 rounded-lg px-3 ${
							startAdornment ? "pl-8" : ""
						} text-sm text-neutral-900 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-white placeholder-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-500 transition-shadow ${inputClassName}`}
						{...props}
					/>
				</div>
			</div>
		);
	}
);

Input.displayName = "Input";
export default Input;
