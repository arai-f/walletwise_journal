import { useState } from "react";
import ListSettings from "./ListSettings";

/**
 * カテゴリ設定画面を管理するコンポーネント。
 * 支出カテゴリと収入カテゴリのタブ切り替え機能を提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Function} props.getState - ステート取得関数。
 * @param {Function} props.refreshApp - アプリ更新関数。
 * @return {JSX.Element} カテゴリ設定コンポーネント
 */
export default function CategorySettings({ getState, refreshApp }) {
	const [activeTab, setActiveTab] = useState("expense");

	return (
		<div className="flex flex-col h-full bg-neutral-50">
			{/* タブ切り替えヘッダー */}
			<div className="flex shrink-0 bg-white border-b border-neutral-200">
				<button
					onClick={() => setActiveTab("expense")}
					className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "expense"
							? "border-primary text-primary"
							: "border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
					}`}
				>
					<div className="flex items-center justify-center gap-2">
						<i className="fas fa-receipt"></i>
						支出カテゴリ
					</div>
				</button>
				<button
					onClick={() => setActiveTab("income")}
					className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "income"
							? "border-emerald-500 text-emerald-600"
							: "border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
					}`}
				>
					<div className="flex items-center justify-center gap-2">
						<i className="fas fa-coins"></i>
						収入カテゴリ
					</div>
				</button>
			</div>

			{/* コンテンツエリア */}
			<div className="flex-1 min-h-0 overflow-hidden relative">
				{activeTab === "expense" ? (
					<ListSettings
						key="expense-list"
						type="expense"
						title=""
						getState={getState}
						refreshApp={refreshApp}
					/>
				) : (
					<ListSettings
						key="income-list"
						type="income"
						title=""
						getState={getState}
						refreshApp={refreshApp}
					/>
				)}
			</div>
		</div>
	);
}
