import { deleteField } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useApp } from "../../contexts/AppContext";
import * as notification from "../../services/notification.js";
import * as store from "../../services/store.js";
import Switch from "../ui/Switch";

interface GeneralSettingsProps {
	/** 通知許可リクエスト関数。 */
	requestNotification: () => Promise<boolean>;
	/** 通知無効化関数。 */
	disableNotification: () => Promise<void>;
	/** 後方互換用オプショナル */
	getState?: unknown;
	reloadApp?: unknown;
}

export default function GeneralSettings({
	requestNotification,
	disableNotification,
}: GeneralSettingsProps) {
	const { config, actions } = useApp();
	const initialDisplayPeriod =
		config?.general?.displayPeriod || config?.displayPeriod || 3;
	const initialEnableAi = config?.general?.enableAiAdvisor || false;

	const [displayPeriod, setDisplayPeriod] =
		useState<number>(initialDisplayPeriod);
	const [enableAi, setEnableAi] = useState<boolean>(initialEnableAi);
	const [enableNotification, setEnableNotification] = useState(false);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		setDisplayPeriod(
			config?.general?.displayPeriod || config?.displayPeriod || 3,
		);
		setEnableAi(config?.general?.enableAiAdvisor || false);

		async function checkNotification() {
			const isRegistered =
				await notification.isDeviceRegisteredForNotifications();
			setEnableNotification(isRegistered);
		}
		checkNotification();
	}, [config]);

	const handleSaveDisplayPeriod = async (period: number) => {
		if (loading || period === displayPeriod) return;
		setLoading(true);
		try {
			await store.updateConfig({
				displayPeriod: deleteField(),
				"general.displayPeriod": period,
			});
			setDisplayPeriod(period);
			await actions.refreshSettings();
		} catch (e) {
			console.error("[GeneralSettings] Save display period failed:", e);
			notification.error("保存に失敗しました");
		} finally {
			setLoading(false);
		}
	};

	const handleAiToggle = async (isEnabled: boolean) => {
		try {
			await store.updateConfig({
				"general.enableAiAdvisor": isEnabled,
			});
			setEnableAi(isEnabled);
			await actions.refreshSettings();
		} catch (error) {
			console.error("[GeneralSettings] AI settings update failed:", error);
			notification.error("AIアドバイザー設定の更新に失敗しました。");
			setEnableAi(!isEnabled); // ロールバック
		}
	};

	const handleNotificationToggle = async (isEnabled: boolean) => {
		if (isEnabled) {
			const granted = await requestNotification();
			setEnableNotification(granted);
		} else {
			await disableNotification();
			setEnableNotification(false);
		}
	};

	return (
		<div className="divide-y divide-neutral-100">
			{/* 表示期間設定 */}
			<div className="p-5">
				<h3 className="font-bold text-neutral-900 text-sm mb-1">
					取引の表示期間
				</h3>
				<p className="text-xs text-neutral-500 mb-3">
					一覧やグラフに初期表示する過去データの期間を設定します。
				</p>
				<div className="flex gap-2">
					{[3, 6, 12].map((period) => (
						<button
							key={period}
							type="button"
							onClick={() => handleSaveDisplayPeriod(period)}
							disabled={loading}
							className={`flex-1 py-2 text-sm font-medium rounded-lg border transition ${
								displayPeriod === period
									? "bg-indigo-50 border-primary text-primary"
									: "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
							}`}
						>
							{period === 12 ? "1年間" : `${period}ヶ月`}
						</button>
					))}
				</div>
			</div>

			{/* AIアドバイザー設定 */}
			<div className="p-5">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-bold text-neutral-900 text-sm mb-1">
							AIアドバイザー機能
						</h3>
						<p className="text-xs text-neutral-500">
							支出の傾向や節約のアドバイスをAIが自動生成します。
						</p>
					</div>
					<Switch
						checked={enableAi}
						onChange={handleAiToggle}
						aria-label="AIアドバイザーの有効化"
					/>
				</div>
			</div>

			{/* 通知設定 */}
			<div className="p-5">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-bold text-neutral-900 text-sm mb-1">
							プッシュ通知
						</h3>
						<p className="text-xs text-neutral-500">
							入力忘れ防止や定期レポートの通知を受け取ります。
						</p>
					</div>
					<Switch
						checked={enableNotification}
						onChange={handleNotificationToggle}
						aria-label="プッシュ通知の有効化"
					/>
				</div>
			</div>
		</div>
	);
}
