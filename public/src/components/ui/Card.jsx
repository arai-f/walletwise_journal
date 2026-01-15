/**
 * 汎用カードコンポーネント。
 * コンテンツを白いボックスで囲み、影をつけるベーススタイルを提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {React.ReactNode} props.children - カード内に表示するコンテンツ。
 * @param {string} [props.className=""] - 追加のCSSクラス名。
 * @return {JSX.Element} カードコンポーネントのJSX要素。
 */
const Card = ({ children, className = "", ...props }) => {
	return (
		<div
			className={`block bg-white rounded-lg shadow-sm p-4 ${className}`}
			{...props}
		>
			{children}
		</div>
	);
};

export default Card;
