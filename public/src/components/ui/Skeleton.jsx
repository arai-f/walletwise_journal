/**
 * スケルトンローディング用のUIコンポーネント。
 * データ読み込み中にプレースホルダーとして表示される。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {string} [props.className] - 追加のCSSクラス。
 * @returns {JSX.Element} スケルトンコンポーネント。
 */
export const Skeleton = ({ className, ...props }) => {
	return (
		<div
			className={`animate-pulse bg-slate-200 rounded ${className}`}
			{...props}
		/>
	);
};
