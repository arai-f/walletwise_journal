import { deleteField } from "firebase/firestore";
import { useEffect, useState } from "react";
import * as notification from "../../services/notification.js";
import Button from "../ui/Button";
import Select from "../ui/Select";
import Switch from "../ui/Switch";

/**
 * 一般設定（表示期間、AIアドバイザー、通知設定）を行うコンポーネント。
 * アプリケーション全体に影響する基本的な設定項目を提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.store - ストア操作オブジェクト。
 * @param {Function} props.getState - 現在のステート取得関数。
 * @param {Function} props.reloadApp - アプリ再ロード関数（設定反映用）。
 * @param {Function} props.requestNotification - 通知許可リクエスト関数。
 * @param {Function} props.disableNotification - 通知無効化関数。
 * @return {JSX.Element} 一般設定コンポーネント。
 */
export default function GeneralSettings({
	store,
	getState,
	reloadApp,
	requestNotification,
	disableNotification,
}) {
	const [displayPeriod, setDisplayPeriod] = useState(3);
	const [enableAi, setEnableAi] = useState(false);
	const [enableNotification, setEnableNotification] = useState(false);
	const [loading, setLoading] = useState(false);

	// 初期化：現在の設定値をロード。
	useEffect(() => {
		const state = getState();
		const config = state.config || {};
		setDisplayPeriod(
			config.general?.displayPeriod || config.displayPeriod || 3
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
	 * 古いキー構造との互換性のために `config.displayPeriod` の削除も行う。
	 */
	const handleSaveDisplayPeriod = async () => {
		setLoading(true);
		try {
			const newPeriod = Number(displayPeriod);
			await store.updateConfig({
				displayPeriod: deleteField(),
				"general.displayPeriod": newPeriod,
			});
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
			<div className="flex items-center justify-between py-4 px-5 border-b border-neutral-100">
				<div className="flex flex-col">
					<label className="text-base font-medium text-neutral-900">
						デフォルトの表示月数
					</label>
					<span className="text-xs text-neutral-500 mt-0.5">
						アプリ起動時やレポートの期間
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Select
						value={displayPeriod}
						onChange={(e) => setDisplayPeriod(e.target.value)}
						className="w-24"
						selectClassName="!py-1.5 !h-9 !text-sm !border-neutral-200 bg-neutral-50"
					>
						<option value="1">1ヶ月</option>
						<option value="3">3ヶ月</option>
						<option value="6">6ヶ月</option>
						<option value="12">12ヶ月</option>
					</Select>
					<Button
						onClick={handleSaveDisplayPeriod}
						disabled={loading}
						variant="ghost"
						className="text-indigo-600 font-medium hover:bg-indigo-50 px-3!"
					>
						{loading ? <i className="fas fa-spinner fa-spin"></i> : "保存"}
					</Button>
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
