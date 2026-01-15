import { useEffect, useState } from "react";

/**
 * グローバル通知バナーを表示するコンポーネント。
 * カスタムイベント `walletwise-notification` をリッスンし、通知メッセージを画面上部に表示する。
 * 通知は数秒後に自動的に消える。
 * @return {JSX.Element} 通知バナーコンポーネント。
 */
const NotificationBanner = () => {
	const [notification, setNotification] = useState(null);
	const [isVisible, setIsVisible] = useState(false);

	/**
	 * 通知イベントを監視する副作用。
	 * 通知を受け取ると表示状態にし、一定時間後に非表示にするタイマーをセットする。
	 */
	useEffect(() => {
		// カスタムイベントリスナーの設定
		const handleNotification = (e) => {
			const { message, type } = e.detail;
			setNotification({ message, type });
			setIsVisible(true);

			// 3秒後に自動的に非表示にする
			setTimeout(() => {
				setIsVisible(false);
			}, 3000);
		};

		window.addEventListener("walletwise-notification", handleNotification);
		return () =>
			window.removeEventListener("walletwise-notification", handleNotification);
	}, []);

	if (!notification) return null;

	const typeConfig = {
		success: "bg-green-500",
		warning: "bg-orange-500",
		error: "bg-red-600",
		info: "bg-indigo-600",
	};

	const bgColor = typeConfig[notification.type] || typeConfig.error;

	return (
		<div
			className={`fixed top-0 left-0 right-0 p-4 z-100 text-center text-white font-bold shadow-lg transition-transform duration-300 ease-in-out ${
				isVisible ? "translate-y-0" : "-translate-y-full"
			} ${bgColor}`}
			onClick={() => setIsVisible(false)}
		>
			<span id="notification-message">{notification.message}</span>
		</div>
	);
};

export default NotificationBanner;
