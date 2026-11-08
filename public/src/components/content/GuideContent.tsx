import {
	faBell,
	faBolt,
	faCamera,
	faChartPie,
	faCheck,
	faChevronRight,
	faCog,
	faCoins,
	faComments,
	faHome,
	faImage,
	faLightbulb,
	faMagic,
	faMoneyCheck,
	faPaperPlane,
	faPlus,
	faSpinner,
	faTags,
	faWallet,
	type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState, type FC } from "react";
import { isDeviceRegisteredForNotifications } from "../../services/notification.js";

export interface GuideContentProps {
	activeStep: number;
	onRequestNotification: () => Promise<boolean>;
	onClose: () => void;
}

const SETTINGS_ITEMS = [
	{
		icon: faWallet,
		title: "口座設定",
		desc: "現金・銀行・電子マネーやクレカを登録し、「残高調整」で現在の預金額・所持金を合わせます。",
	},
	{
		icon: faMoneyCheck,
		title: "カード支払い設定",
		badge: "★重要",
		desc: "締め日・支払日・引落口座を設定。請求一覧が自動集計され、「振替を記録」で二重計上なく引き落とし処理できます。",
	},
	{
		icon: faTags,
		title: "カテゴリ設定",
		desc: "よく使う費目を上に並び替えたり、自分好みの支出・収入項目を自由に追加・編集できます。",
	},
];

const GuideContent: FC<GuideContentProps> = ({
	activeStep,
	onRequestNotification,
	onClose,
}) => {
	const [notificationState, setNotificationState] = useState<
		"initial" | "loading" | "configured"
	>("initial");

	useEffect(() => {
		const checkStatus = async () => {
			const isRegistered = await isDeviceRegisteredForNotifications();
			if (isRegistered) {
				setNotificationState("configured");
			}
		};
		checkStatus();
	}, []);

	const handleNotificationClick = async () => {
		if (notificationState === "configured") return;
		setNotificationState("loading");
		const success = await onRequestNotification();
		setNotificationState(success ? "configured" : "initial");
	};

	const renderStepHeader = (
		icon: IconDefinition,
		iconColor: string,
		title: string,
	) => (
		<h3 className="font-bold text-xl mb-4 text-neutral-900 flex items-center justify-center">
			<FontAwesomeIcon icon={icon} className={`${iconColor} mr-2.5`} />
			{title}
		</h3>
	);

	return (
		<div className="w-full h-full overflow-y-auto px-4 pt-6 pb-10 md:px-6 md:pt-6 md:pb-10 text-neutral-800 flex flex-col items-center">
			<div className="w-full max-w-sm my-auto text-center">
				{/* スライド 0: 資産状況を一目で */}
				{activeStep === 0 && (
					<div className="flex flex-col items-center justify-center py-2">
						{renderStepHeader(faHome, "text-primary", "資産状況を一目で")}

						<div className="w-full max-w-xs h-64 relative mb-5 mx-auto shrink-0">
							<div className="absolute top-4 left-4 right-4 bottom-4 bg-primary-light/60 rounded-3xl transform rotate-3" />
							<div className="absolute inset-0 z-10 transform -rotate-1 transition-transform hover:rotate-0 duration-500 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col border border-neutral-200">
								<div className="bg-linear-to-r from-primary to-primary-dark p-5 text-white relative overflow-hidden shrink-0">
									<div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl pointer-events-none" />
									<div className="flex flex-col gap-2 relative z-10 text-left">
										<div>
											<h4 className="text-white/80 text-xs font-bold mb-0.5">
												純資産 (資産 - 負債)
											</h4>
											<p className="text-2xl font-bold tracking-tight">
												¥1,234,567
											</p>
										</div>
										<div className="flex gap-4 text-sm border-t border-white/20 pt-2 mt-1">
											<div>
												<span className="block text-white/70 text-xs">
													総資産
												</span>
												<span className="block font-bold text-sm">
													¥1,500,000
												</span>
											</div>
											<div>
												<span className="block text-white/70 text-xs">
													総負債
												</span>
												<span className="block font-bold text-sm">
													¥265,433
												</span>
											</div>
										</div>
									</div>
								</div>
								<div className="p-4 bg-white grow relative flex items-end pb-0">
									<div className="h-24 w-full relative text-primary">
										<svg
											viewBox="0 0 300 100"
											className="w-full h-full overflow-visible"
											preserveAspectRatio="none"
										>
											<defs>
												<linearGradient
													id="guideChartGradient"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="0%"
														stopColor="currentColor"
														stopOpacity="0.2"
													/>
													<stop
														offset="100%"
														stopColor="currentColor"
														stopOpacity="0"
													/>
												</linearGradient>
											</defs>
											<path
												d="M0,80 L60,65 L120,70 L180,40 L240,50 L300,20 V100 H0 Z"
												fill="url(#guideChartGradient)"
											/>
											<path
												d="M0,80 L60,65 L120,70 L180,40 L240,50 L300,20"
												className="fill-none stroke-primary"
												strokeWidth="3"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
											<circle
												cx="300"
												cy="20"
												r="4"
												className="fill-white stroke-primary"
												strokeWidth="2"
											/>
										</svg>
									</div>
								</div>
							</div>
							<div className="absolute -top-3 -right-3 z-20 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce text-primary text-2xl">
								<FontAwesomeIcon icon={faCoins} />
							</div>
						</div>

						<div className="text-neutral-600 max-w-sm mx-auto space-y-2.5">
							<p className="text-sm font-normal text-neutral-800 leading-relaxed">
								現在の「純資産」と、その推移を直感的に確認できます。
							</p>
							<div className="text-xs font-normal leading-relaxed text-neutral-800 bg-primary-light p-3 rounded-md border border-neutral-200 text-left">
								グラフ下部の口座（銀行・現金・クレカ等）をタップすると、その口座だけの残高推移に絞り込まれます。
							</div>
						</div>
					</div>
				)}

				{/* スライド 1: 取引の記録 */}
				{activeStep === 1 && (
					<div className="flex flex-col items-center justify-center py-2">
						{renderStepHeader(faMagic, "text-primary", "取引の記録")}

						<div className="w-full max-w-xs h-72 relative mb-4 mx-auto shrink-0">
							<div className="absolute top-8 left-8 right-8 bottom-8 bg-primary-light/60 rounded-full blur-2xl" />
							<div className="absolute top-0 left-0 z-20 flex flex-col items-center transform -rotate-6">
								<div className="ai-rainbow-btn w-14 h-14 flex items-center justify-center shadow-lg rounded-full mb-2 cursor-pointer hover:scale-105 transition-transform">
									<FontAwesomeIcon
										icon={faPlus}
										className="text-2xl text-primary"
									/>
								</div>
								<div className="bg-neutral-800 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
									1. タップ
								</div>
							</div>

							<div className="absolute top-10 left-16 z-20 pointer-events-none">
								<svg
									width="60"
									height="40"
									viewBox="0 0 60 40"
									className="text-neutral-300 fill-none stroke-current stroke-2 drop-shadow-sm"
								>
									<path d="M5,5 Q30,5 50,30" />
									<polygon
										points="50,30 40,28 48,20"
										className="fill-neutral-300 stroke-none"
									/>
								</svg>
							</div>

							<div className="absolute top-16 right-0 z-10 bg-white rounded-xl shadow-xl p-3 text-left w-56 transform rotate-3 border border-neutral-200">
								<div className="flex justify-between items-center mb-3">
									<div className="h-2 w-16 bg-neutral-200 rounded" />
									<div className="h-4 w-4 bg-neutral-100 rounded-full" />
								</div>
								<div className="border-2 border-dashed border-neutral-300 bg-primary-light/50 rounded-lg p-2 mb-3 relative">
									<div className="absolute -top-3 -left-3 bg-neutral-800 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow z-30">
										2. 選ぶ
									</div>
									<div className="grid grid-cols-2 gap-1.5 opacity-80">
										<div className="h-8 bg-primary-light rounded border border-neutral-200 flex items-center justify-center">
											<FontAwesomeIcon
												icon={faCamera}
												className="text-primary text-xs"
											/>
										</div>
										<div className="h-8 bg-success-light rounded border border-neutral-200 flex items-center justify-center">
											<FontAwesomeIcon
												icon={faImage}
												className="text-success text-xs"
											/>
										</div>
									</div>
									<div className="mt-1 flex justify-center items-center gap-1 opacity-50">
										<FontAwesomeIcon
											icon={faBolt}
											className="text-xs text-primary"
										/>
										<div className="h-1 w-12 bg-neutral-300 rounded-full" />
									</div>
								</div>
								<div className="space-y-2 opacity-50">
									<div className="h-6 w-full bg-neutral-100 rounded" />
									<div className="grid grid-cols-2 gap-2">
										<div className="h-6 w-full bg-neutral-100 rounded" />
										<div className="h-6 w-full bg-neutral-100 rounded" />
									</div>
								</div>
							</div>
						</div>

						<div className="text-neutral-600 max-w-sm mx-auto space-y-2.5">
							<p className="text-sm font-normal text-neutral-800 leading-relaxed">
								右下のボタンから、通常の手入力のほか、
								<br />
								レシート撮影によるAI一括読み取りに対応しています。
							</p>
							<div className="text-xs font-normal leading-relaxed text-neutral-800 bg-neutral-50 p-3 rounded-md border border-neutral-200 text-left">
								ATM出金や電子マネーチャージは「振替」で記録すると、総資産を変えずに管理できます。
							</div>
						</div>
					</div>
				)}

				{/* スライド 2: 収支レポート & AIアドバイザー */}
				{activeStep === 2 && (
					<div className="flex flex-col items-center justify-center py-2">
						{renderStepHeader(
							faChartPie,
							"text-primary",
							"収支レポート & AI分析",
						)}

						<div className="w-full max-w-xs h-72 relative mb-4 mx-auto shrink-0">
							{/* 背景の淡いプレート */}
							<div className="absolute top-4 left-4 right-4 bottom-4 bg-primary-light/60 rounded-3xl transform rotate-3" />

							{/* 背面の収支レポート＆インサイト抽象カード（左傾き） */}
							<div className="absolute top-2 left-1 right-5 z-10 bg-white rounded-xl shadow-lg border border-neutral-200 p-3 text-left transform -rotate-2 transition-transform hover:rotate-0 duration-500">
								{/* 抽象化した筆算＆ドーナツチャート行 */}
								<div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-neutral-200">
									<div className="flex-1 space-y-1.5">
										<div className="flex justify-between items-center">
											<div className="h-2 w-8 bg-neutral-200 rounded-full" />
											<div className="h-2.5 w-14 bg-success-light rounded-full" />
										</div>
										<div className="flex justify-between items-center">
											<div className="h-2 w-8 bg-neutral-200 rounded-full" />
											<div className="h-2.5 w-12 bg-danger-light rounded-full" />
										</div>
										<div className="border-b border-neutral-200 my-1" />
										<div className="flex items-center gap-1.5 pt-0.5">
											<span className="w-2 h-2 rounded-full bg-success shrink-0" />
											<span className="text-xs font-medium text-success truncate">
												収支は安定しています
											</span>
										</div>
									</div>

									{/* ミニ抽象ドーナツグラフ */}
									<div className="w-14 h-14 relative flex items-center justify-center shrink-0">
										<svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
											<circle
												cx="18"
												cy="18"
												r="13"
												className="fill-none stroke-neutral-200"
												strokeWidth="5"
											/>
											<circle
												cx="18"
												cy="18"
												r="13"
												className="fill-none stroke-primary"
												strokeWidth="5"
												strokeDasharray="48 100"
												strokeLinecap="round"
											/>
											<circle
												cx="18"
												cy="18"
												r="13"
												className="fill-none stroke-danger"
												strokeWidth="5"
												strokeDasharray="24 100"
												strokeDashoffset="-52"
												strokeLinecap="round"
											/>
										</svg>
										<div className="absolute h-2 w-6 bg-neutral-200 rounded-full" />
									</div>
								</div>

								{/* インサイトカード（リストアイテム仕様：1枚目を強調、2枚目を抽象化） */}
								<div className="space-y-1.5">
									<div className="bg-primary-light border border-neutral-200 rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2">
										<span className="text-xs font-medium text-neutral-900 truncate">
											⚠️ 食費が前月比+15%増加
										</span>
										<FontAwesomeIcon
											icon={faChevronRight}
											className="text-xs text-primary shrink-0"
										/>
									</div>
									<div className="bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2 opacity-50">
										<div className="flex items-center gap-1.5 w-full">
											<span className="text-xs">💡</span>
											<div className="h-2 w-28 bg-neutral-300 rounded-full" />
										</div>
										<FontAwesomeIcon
											icon={faChevronRight}
											className="text-xs text-neutral-600 shrink-0"
										/>
									</div>
								</div>
							</div>

							{/* 前面に重なるAI深掘りチャットカード（右傾き） */}
							<div className="absolute bottom-2 right-0 left-6 z-20 bg-white rounded-xl shadow-xl border border-neutral-200 p-3 text-left transform rotate-2 transition-transform hover:rotate-0 duration-500">
								<div className="flex items-center justify-between mb-2">
									<span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-primary px-2.5 py-0.5 rounded-lg shadow-sm">
										<FontAwesomeIcon icon={faComments} />
										<span>AIに相談</span>
									</span>
									<div className="flex gap-1">
										<div className="h-3 w-10 bg-neutral-50 border border-neutral-200 rounded-md" />
										<div className="h-3 w-10 bg-neutral-50 border border-neutral-200 rounded-md" />
									</div>
								</div>

								<div className="bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-2 text-xs text-neutral-800 space-y-1.5 mb-2">
									<div className="flex items-center gap-1.5">
										<span className="text-primary font-bold">•</span>
										<span>
											外食が<strong className="font-bold text-danger">+¥8,000</strong>
											増加しています
										</span>
									</div>
									<div className="flex items-center gap-1.5">
										<span className="text-primary font-bold">•</span>
										<div className="h-2 w-36 bg-neutral-200 rounded-full" />
									</div>
								</div>

								<div className="flex items-center gap-1.5">
									<div className="h-7 grow border border-neutral-300 rounded-lg px-2 bg-white flex items-center">
										<div className="h-2 w-24 bg-neutral-200 rounded-full" />
									</div>
									<div className="w-7 h-7 bg-primary text-white rounded-lg flex items-center justify-center shadow-sm shrink-0">
										<FontAwesomeIcon
											icon={faPaperPlane}
											className="text-xs"
										/>
									</div>
								</div>
							</div>

							{/* 右上のフローティング電球バッジ */}
							<div className="absolute -top-2 -right-2 z-30 w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce text-primary text-xl">
								<FontAwesomeIcon icon={faLightbulb} />
							</div>
						</div>

						<div className="text-neutral-600 max-w-sm mx-auto space-y-2">
							<p className="text-sm font-normal text-neutral-800 leading-relaxed">
								収支レポート内でAIが家計の安定度と注目ポイントを自動分析。
								<br />
								気になるカードや「AIに相談」から深掘り質問できます。
							</p>
							<p className="text-xs font-normal leading-relaxed text-neutral-400 text-center">
								※AI機能は「設定」の一般設定からいつでも切り替えられます。
							</p>
						</div>
					</div>
				)}

				{/* スライド 3: 自分好みに設定 */}
				{activeStep === 3 && (
					<div className="flex flex-col items-center justify-center py-2">
						<h3 className="font-bold text-xl mb-2 text-neutral-900 flex items-center justify-center">
							<FontAwesomeIcon
								icon={faCog}
								className="text-neutral-600 mr-2.5"
							/>
							自分好みに設定
						</h3>
						<p className="text-sm font-normal text-neutral-600 mb-4">
							「設定」から、初期設定を行いましょう。
						</p>
						<div className="w-full max-w-sm mx-auto divide-y divide-neutral-200 text-left">
							{SETTINGS_ITEMS.map((item) => (
								<div
									key={item.title}
									className="flex items-start gap-3.5 py-3.5"
								>
									<div className="w-9 h-9 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0 mt-0.5">
										<FontAwesomeIcon icon={item.icon} className="text-sm" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5 mb-0.5">
											<span className="text-sm font-medium text-neutral-900">
												{item.title}
											</span>
											{item.badge && (
												<span className="text-xs bg-danger-light text-danger font-bold px-1.5 py-0.5 rounded border border-neutral-200">
													{item.badge}
												</span>
											)}
										</div>
										<div className="text-xs font-normal text-neutral-600 leading-relaxed">
											{item.desc}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* スライド 4: 通知を受け取る */}
				{activeStep === 4 && (
					<div className="flex flex-col items-center justify-center py-2">
						{renderStepHeader(faBell, "text-primary", "通知を受け取る")}
						<div className="w-full max-w-xs p-6 text-center mb-2 mx-auto shrink-0">
							<div className="w-24 h-24 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
								<FontAwesomeIcon
									icon={faBell}
									className="text-4xl text-primary"
								/>
							</div>
							<div className="text-neutral-800 text-sm font-normal leading-relaxed mb-6">
								入力忘れ防止のリマインダーや、
								<br />
								定期的なレポートをお届けします。
							</div>
							<button
								onClick={handleNotificationClick}
								className={`px-6 py-2 rounded-lg font-bold text-sm shadow-sm transition w-full cursor-pointer ${
									notificationState === "configured"
										? "bg-success text-white cursor-default"
										: "bg-primary text-white hover:bg-primary-dark"
								}`}
								disabled={
									notificationState === "loading" ||
									notificationState === "configured"
								}
							>
								{notificationState === "loading" ? (
									<FontAwesomeIcon icon={faSpinner} spin />
								) : notificationState === "configured" ? (
									"設定済みです"
								) : (
									"通知を許可する"
								)}
							</button>
						</div>
						<div className="text-neutral-400 text-xs font-normal max-w-xs mx-auto">
							※通知設定は、後からいつでも「設定」の一般設定から変更できます。
						</div>
					</div>
				)}

				{/* スライド 5: 準備完了です！ */}
				{activeStep === 5 && (
					<div className="flex flex-col items-center justify-center py-2">
						<div className="w-24 h-24 bg-primary-light rounded-full flex items-center justify-center mb-8 shadow-inner">
							<FontAwesomeIcon
								icon={faCheck}
								className="text-5xl text-primary"
							/>
						</div>
						<h3 className="font-bold text-xl md:text-2xl mb-4 text-neutral-900">
							準備完了です！
						</h3>
						<p className="text-neutral-800 font-normal leading-relaxed max-w-sm mx-auto text-sm mb-8">
							基本的な機能と設定は以上です。
							<br />
							さっそくあなたのお金の流れを
							<br />
							スマートに記録・管理していきましょう。
						</p>
						<div className="mt-2">
							<button
								onClick={onClose}
								className="bg-primary hover:bg-primary-dark text-white px-8 py-2.5 rounded-lg font-bold text-sm shadow-sm transition cursor-pointer"
							>
								さあ、始めましょう！
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default GuideContent;
