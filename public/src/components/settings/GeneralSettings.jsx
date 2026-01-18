import { deleteField } from "firebase/firestore";
import { useEffect, useState } from "react";
import * as notification from "../../services/notification.js";
import * as store from "../../services/store.js";
import Switch from "../ui/Switch";

/**
 * 一般設定（表示期間、AIアドバイザー、通知設定）を行うコンポーネント。
 * アプリケーション全体に影響する基本的な設定項目を提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Function} props.getState - 現在のステート取得関数。
 * @param {Function} props.reloadApp - アプリ再ロード関数（設定反映用）。
 * @param {Function} props.requestNotification - 通知許可リクエスト関数。
 * @param {Function} props.disableNotification - 通知無効化関数。
 * @return {JSX.Element} 一般設定コンポーネント。
 */
export default function GeneralSettings({
	getState,
	reloadApp,
	requestNotification,
	disableNotification,
}) {
	const [displayPeriod, setDisplayPeriod] = useState(() => {
		const config = getState().config || {};
		return config.general?.displayPeriod || config.displayPeriod || 3;
	});
	const [enableAi, setEnableAi] = useState(() => {
		const config = getState().config || {};
		return config.general?.enableAiAdvisor || false;
	});
	const [enableNotification, setEnableNotification] = useState(false);
	const [loading, setLoading] = useState(false);

	// 初期化：現在の設定値をロード。
	useEffect(() => {
		const state = getState();
		const config = state.config || {};
		setDisplayPeriod(
			config.general?.displayPeriod || config.displayPeriod || 3,
		);
		setEnableAi(config.general?.enableAiAdvisor || false);

		async function checkNotification() {
			const isRegistered = await store.isDeviceRegisteredForNotifications();
			setEnableNotification(isRegistered);
		}
		checkNotification();
	}, [getState, store]);

	/**
	 * 表示期間設定を保存するハンドラ。
	 * @param {number} period - 設定する期間（月数）。
	 */
	const handleSaveDisplayPeriod = async (period) => {
		if (loading || period === displayPeriod) return;
		setLoading(true);
		try {
			await store.updateConfig({
				displayPeriod: deleteField(),
				"general.displayPeriod": period,
			});
			setDisplayPeriod(period);
			reloadApp();
		} catch (e) {
			console.error("[GeneralSettings] Save display period failed:", e);
			notification.error("保存に失敗しました");
		} finally {
			setLoading(false);
		}
	};

	/**
	 * AIアドバイザー有効化トグルハンドラ。
	 * 設定を更新し、アプリをリロードして反映させる。
	 * @param {Event} e - トグル変更イベント
	 */
	const handleAiToggle = async (e) => {
		const isEnabled = e.target.checked;
		try {
			await store.updateConfig({
				"general.enableAiAdvisor": isEnabled,
			});
			const state = getState();
			if (!state.config.general) state.config.general = {};
			state.config.general.enableAiAdvisor = isEnabled;

			setEnableAi(isEnabled);
			reloadApp();
		} catch (error) {
			console.error("[GeneralSettings] AI settings update failed:", error);
			notification.error("設定の更新に失敗しました。");
			setEnableAi(!isEnabled);
		}
	};

	/**
	 * 通知設定トグルハンドラ。
	 * 通知の許可/無効化を行い、状態を更新する。
	 * @param {Event} e - トグル変更イベント
	 */
	const handleNotificationToggle = async (e) => {
		const isChecked = e.target.checked;
		let result = false;
		try {
			if (isChecked) {
				result = await requestNotification();
			} else {
				const disabled = await disableNotification();
				result = !disabled;
			}
			setEnableNotification(result);
		} catch (e) {
			console.error("[GeneralSettings] Notification toggle failed:", e);
		}
	};

	return (
		<div>
			<div className="flex flex-col gap-3 py-4 px-5 border-b border-neutral-100">
				<div>
					<p className="text-base font-medium text-neutral-900">表示期間</p>
					<span className="text-xs text-neutral-500 mt-0.5">
						アプリ起動時やレポートの期間
					</span>
				</div>
				<div className="flex bg-neutral-100 p-1 rounded-lg">
					{[1, 3, 6, 12].map((m) => (
						<button
							key={m}
							onClick={() => handleSaveDisplayPeriod(m)}
							disabled={loading}
							className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
								displayPeriod === m
									? "bg-white text-indigo-600 shadow-sm"
									: "text-neutral-500 hover:text-neutral-700"
							}`}
						>
							{m}ヶ月
						</button>
					))}
				</div>
			</div>

			<div className="flex items-center justify-between py-4 px-5 border-b border-neutral-100">
				<div className="pr-4">
					<p className="text-base font-medium text-neutral-900">
						AIアドバイザー
					</p>
					<p className="text-xs text-neutral-500 mt-0.5">
						月ごとの収支分析アドバイスを表示
					</p>
				</div>
				<Switch checked={enableAi} onChange={handleAiToggle} />
			</div>

			<div className="flex items-center justify-between py-4 px-5 border-b border-neutral-100">
				<div className="pr-4">
					<p className="text-base font-medium text-neutral-900">通知設定</p>
					<p className="text-xs text-neutral-500 mt-0.5">
						記録忘れ防止のリマインダーなど
					</p>
				</div>
				<Switch
					checked={enableNotification}
					onChange={handleNotificationToggle}
				/>
			</div>
		</div>
	);
}
