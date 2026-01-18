import { useState } from "react";
import ListSettings from "./ListSettings";

/**
 * 口座設定画面を管理するコンポーネント。
 * 資産口座と負債口座のタブ切り替え機能を提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Function} props.getState - ステート取得関数。
 * @param {Function} props.refreshApp - アプリ更新関数。
 * @return {JSX.Element} 口座設定コンポーネント
 */
export default function AccountSettings({ getState, refreshApp }) {
	const [activeTab, setActiveTab] = useState("asset");

	return (
		<div className="flex flex-col h-full bg-neutral-50">
			{/* タブ切り替えヘッダー */}
			<div className="flex shrink-0 bg-white border-b border-neutral-200">
				<button
					onClick={() => setActiveTab("asset")}
					className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "asset"
							? "border-primary text-primary"
							: "border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
					}`}
				>
					<div className="flex items-center justify-center gap-2">
						<i className="fas fa-wallet"></i>
						資産口座
					</div>
				</button>
				<button
					onClick={() => setActiveTab("liability")}
					className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "liability"
							? "border-rose-500 text-rose-600"
							: "border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
					}`}
				>
					<div className="flex items-center justify-center gap-2">
						<i className="fas fa-credit-card"></i>
						負債口座
					</div>
				</button>
			</div>

			{/* コンテンツエリア */}
			<div className="flex-1 min-h-0 overflow-hidden relative">
				<ListSettings
					key={activeTab} // keyを変更してコンポーネントを再マウントさせる
					type={activeTab}
					title="" // タブで明示されているためタイトルは非表示
					getState={getState}
					refreshApp={refreshApp}
				/>
			</div>
		</div>
	);
}
