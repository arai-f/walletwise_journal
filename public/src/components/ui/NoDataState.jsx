/**
 * データが存在しない場合に表示するコンポーネント。
 * @param {object} props - コンポーネントプロパティ。
 * @param {string} [props.message="データがありません"] - 表示メッセージ。
 * @param {string} [props.icon="fa-solid fa-inbox"] - FontAwesomeアイコンクラス。
 * @param {string} [props.className="py-12"] - コンテナの追加クラス（高さやパディングなど）。
 * @returns {JSX.Element} データ無し状態の表示コンポーネント。
 */
export default function NoDataState({
	message = "データがありません",
	icon = "fa-solid fa-inbox",
	className = "py-12",
}) {
	return (
		<div
			className={`flex flex-col items-center justify-center text-neutral-400 ${className}`}
		>
			<div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3 text-2xl">
				<i className={`${icon} text-neutral-300`}></i>
			</div>
			<p className="text-sm font-medium">{message}</p>
		</div>
	);
}
