import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faInbox } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { FC } from "react";

/**
 * NoDataStateコンポーネントのプロパティ。
 */
interface NoDataStateProps {
	/**
	 * 表示するメッセージ。
	 * @default "データがありません"
	 */
	message?: string;
	/**
	 * 表示するFontAwesomeアイコンオブジェクト。
	 * @default faInbox
	 */
	icon?: IconProp;
	/**
	 * コンテナ要素に追加するCSSクラス名。
	 * @default "py-12"
	 */
	className?: string;
}

/**
 * データが存在しない場合に表示するプレースホルダーコンポーネント。
 * @param props - コンポーネントプロパティ。
 * @returns データ無し状態の表示コンポーネント。
 */
const NoDataState: FC<NoDataStateProps> = ({
	message = "データがありません",
	icon = faInbox,
	className = "py-12",
}) => {
	return (
		<div
			className={`flex flex-col items-center justify-center text-neutral-400 ${className}`}
		>
			<div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3 text-2xl">
				<FontAwesomeIcon icon={icon} className="text-neutral-300" />
			</div>
			<p className="text-sm font-medium">{message}</p>
		</div>
	);
};

export default NoDataState;