import { faCoins, faReceipt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import type { GetState, RefreshApp } from "../../types/settings";
import ListSettings from "./ListSettings";

/**
 * カテゴリ設定画面のコンポーネントプロパティ。
 */
interface CategorySettingsProps {
	/** ステート取得関数。 */
	getState: GetState;
	/** アプリ更新関数。 */
	refreshApp: RefreshApp;
}

/**
 * カテゴリ設定画面を管理するコンポーネント。
 * 支出カテゴリと収入カテゴリのタブ切り替え機能を提供する。
 * @param props - コンポーネントプロパティ。
 * @returns カテゴリ設定コンポーネント。
 */
export default function CategorySettings({
	getState,
	refreshApp,
}: CategorySettingsProps) {
	const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");

	return (
		<div className="min-h-full bg-neutral-50">
			{/* タブ切り替えヘッダー */}
			<div className="sticky top-0 z-10 flex shrink-0 bg-white border-b border-neutral-200">
				<button
					onClick={() => setActiveTab("expense")}
					className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "expense"
							? "border-primary text-primary"
							: "border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
					}`}
				>
					<div className="flex items-center justify-center gap-2">
						<FontAwesomeIcon icon={faReceipt} />
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
						<FontAwesomeIcon icon={faCoins} />
						収入カテゴリ
					</div>
				</button>
			</div>

			{/* コンテンツエリア */}
			<div className="relative">
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
