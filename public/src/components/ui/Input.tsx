import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

/**
 * テキスト入力フィールドのプロパティ。
 * 標準の `input` 要素の属性を継承する。
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	/** 入力項目のラベル。 */
	label?: string;
	/**
	 * 入力欄の先頭に表示するアイコンや単位。
	 */
	startAdornment?: ReactNode;
	/**
	 * コンテナ要素の追加CSSクラス名。
	 */
	className?: string;
	/**
	 * `input` 要素の追加CSSクラス名。
	 */
	inputClassName?: string;
}

/**
 * テキスト入力フィールドコンポーネント。
 * ラベルやアイコン（装飾）付きの入力フィールドを表示する。
 * @param props - コンポーネントプロパティ。
 * @param ref - フォワードされた参照。
 * @returns 入力フィールドコンポーネント。
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
	(
		{
			label,
			type = "text",
			startAdornment,
			className = "",
			inputClassName = "",
			...props
		},
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
	},
);

Input.displayName = "Input";
export default Input;