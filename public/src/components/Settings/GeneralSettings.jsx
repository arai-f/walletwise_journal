import { deleteField } from "firebase/firestore";
import { useEffect, useState } from "react";
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
			console.error(e);
			alert("保存に失敗しました");
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
			console.error(error);
			alert("設定の更新に失敗しました。");
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
			console.error(e);
		}
	};

	return (
		<div className="p-4 space-y-6">
			<section className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
				<h3 className="font-bold text-neutral-800 mb-4 border-l-4 border-primary pl-3">
					表示設定
				</h3>
				<div className="flex flex-col gap-3">
					<label className="text-sm font-medium text-neutral-700">
						デフォルトの表示月数
					</label>
					<div className="flex gap-2">
						<Select
							value={displayPeriod}
							onChange={(e) => setDisplayPeriod(e.target.value)}
							className="grow"
						>
							<option value="1">1ヶ月</option>
							<option value="3">3ヶ月</option>
							<option value="6">6ヶ月</option>
							<option value="12">12ヶ月</option>
						</Select>
						<Button
							onClick={handleSaveDisplayPeriod}
							disabled={loading}
							className="shrink-0"
							variant="primary"
						>
							{loading && <i className="fas fa-spinner fa-spin"></i>}
							保存
						</Button>
					</div>
					<p className="text-xs text-neutral-500">
						トップページやグラフで一度に読み込む期間を設定します。
						<br />
						期間が長いほど読み込みに時間がかかる場合があります。
					</p>
				</div>
			</section>

			<section className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
				<h3 className="font-bold text-neutral-800 mb-4 border-l-4 border-primary pl-3">
					AIアドバイザー
				</h3>
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-neutral-900">
							AIアドバイザーを有効にする
						</p>
						<p className="text-xs text-neutral-500 mt-1">
							月ごとの収支状況を分析し、アドバイスを表示します。
							<br />
							(Google Gemini APIを使用)
						</p>
					</div>
					<Switch checked={enableAi} onChange={handleAiToggle} />
				</div>
			</section>

			<section className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
				<h3 className="font-bold text-neutral-800 mb-4 border-l-4 border-primary pl-3">
					通知設定
				</h3>
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-neutral-900">支払予定の通知</p>
						<p className="text-xs text-neutral-500 mt-1">
							クレジットカードの引き落とし日や入金予定日の前日に通知を受け取ります。
						</p>
					</div>
					<Switch
						checked={enableNotification}
						onChange={handleNotificationToggle}
					/>
				</div>
			</section>
		</div>
	);
}
