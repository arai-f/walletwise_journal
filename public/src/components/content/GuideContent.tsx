import {
	faBell,
	faBolt,
	faCamera,
	faCheck,
	faCog,
	faCoins,
	faHome,
	faImage,
	faLightbulb,
	faMagic,
	faMoneyCheck,
	faPaperPlane,
	faPlus,
	faRobot,
	faSpinner,
	faTags,
	faUser,
	faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState, type FC } from "react";
import { isDeviceRegisteredForNotifications } from "../../services/notification.js";

/**
 * 使い方ガイドコンポーネントのプロパティ。
 */
export interface GuideContentProps {
	/** 現在選択されているステップ番号 (0〜5)。 */
	activeStep: number;
	/** 通知許可をリクエストするコールバック関数。 */
	onRequestNotification: () => Promise<boolean>;
	/** ガイドを閉じるコールバック関数。 */
	onClose: () => void;
}

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
		if (success) {
			setNotificationState("configured");
		} else {
			setNotificationState("initial");
		}
	};

	return (
		<div className="w-full h-full overflow-y-auto px-4 pt-6 pb-10 md:px-6 md:pt-6 md:pb-10 text-neutral-800 flex flex-col items-center">
			<div className="w-full max-w-sm my-auto text-center">
				{/* スライド 0: 資産状況を一目で */}
				{activeStep === 0 && (
					<div className="flex flex-col items-center justify-center py-2">
						<h3 className="font-bold text-xl mb-4 text-neutral-900 flex items-center justify-center">
							<FontAwesomeIcon
								icon={faHome}
								className="text-indigo-500 mr-2.5"
							/>
							資産状況を一目で
						</h3>

						{/* 傾いた純資産カード + 波形SVGチャート + コインバウンス */}
						<div className="w-full max-w-xs h-64 relative mb-5 mx-auto shrink-0">
							<div className="absolute top-4 left-4 right-4 bottom-4 bg-linear-to-br from-blue-50/50 to-indigo-50/50 rounded-3xl transform rotate-3"></div>

							<div className="absolute inset-0 z-10 transform -rotate-1 transition-transform hover:rotate-0 duration-500 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col border border-neutral-100">
								<div className="bg-linear-to-r from-primary to-violet-600 p-5 text-white relative overflow-hidden shrink-0">
									<div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl pointer-events-none"></div>
									<div className="flex flex-col gap-2 relative z-10 text-left">
										<div>
											<h4 className="text-white/80 text-[10px] font-bold mb-0.5">
												純資産 (資産 - 負債)
											</h4>
											<p className="text-2xl font-bold tracking-tight">
												¥1,234,567
											</p>
										</div>
										<div className="flex gap-4 text-sm border-t border-white/20 pt-2 mt-1">
											<div>
												<span className="block text-white/70 text-[10px]">
													総資産
												</span>
												<span className="block font-bold text-sm">
													¥1,500,000
												</span>
											</div>
											<div>
												<span className="block text-white/70 text-[10px]">
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
									<div className="h-24 w-full relative">
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
														stopColor="#4F46E5"
														stopOpacity="0.2"
													/>
													<stop
														offset="100%"
														stopColor="#4F46E5"
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
												fill="none"
												stroke="#4F46E5"
												strokeWidth="3"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
											<circle
												cx="300"
												cy="20"
												r="4"
												fill="#fff"
												stroke="#4F46E5"
												strokeWidth="2"
											/>
										</svg>
									</div>
								</div>
							</div>

							<div className="absolute -top-3 -right-3 z-20 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce text-yellow-400 text-2xl">
								<FontAwesomeIcon icon={faCoins} />
							</div>
						</div>

						<div className="text-neutral-600 max-w-sm mx-auto space-y-2.5">
							<p className="text-sm leading-relaxed">
								現在の「純資産」と、その推移を直感的に確認できます。
							</p>
							<div className="text-xs leading-relaxed text-indigo-700 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100/80 text-left">
								グラフ下部の口座（銀行・現金・クレカ等）をタップすると、その口座だけの残高推移に絞り込まれます。
							</div>
						</div>
					</div>
				)}

				{/* スライド 1: 取引の記録 */}
				{activeStep === 1 && (
					<div className="flex flex-col items-center justify-center py-2">
						<h3 className="font-bold text-xl mb-4 text-neutral-900 flex items-center justify-center">
							<FontAwesomeIcon
								icon={faMagic}
								className="text-purple-500 mr-2.5"
							/>
							取引の記録
						</h3>

						{/* レインボーボタン + 矢印SVG + 入力カード */}
						<div className="w-full max-w-xs h-72 relative mb-4 mx-auto shrink-0">
							<div className="absolute top-8 left-8 right-8 bottom-8 bg-linear-to-br from-purple-100/50 to-pink-100/50 rounded-full blur-2xl"></div>

							<div className="absolute top-0 left-0 z-20 flex flex-col items-center transform -rotate-6">
								<div className="ai-rainbow-btn w-14 h-14 flex items-center justify-center shadow-lg rounded-full mb-2 cursor-pointer hover:scale-105 transition-transform">
									<FontAwesomeIcon
										icon={faPlus}
										className="text-2xl text-indigo-500"
									/>
								</div>
								<div className="bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
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

							<div className="absolute top-16 right-0 z-10 bg-white rounded-xl shadow-xl p-3 text-left w-56 transform rotate-3 border border-neutral-50">
								<div className="flex justify-between items-center mb-3">
									<div className="h-2 w-16 bg-neutral-200 rounded"></div>
									<div className="h-4 w-4 bg-neutral-100 rounded-full"></div>
								</div>

								<div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-lg p-2 mb-3 relative">
									<div className="absolute -top-3 -left-3 bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow z-30">
										2. 選ぶ
									</div>
									<div className="grid grid-cols-2 gap-1.5 opacity-80">
										<div className="h-8 bg-indigo-50 rounded border border-indigo-200 flex items-center justify-center">
											<FontAwesomeIcon
												icon={faCamera}
												className="text-indigo-400 text-xs"
											/>
										</div>
										<div className="h-8 bg-emerald-50 rounded border border-emerald-200 flex items-center justify-center">
											<FontAwesomeIcon
												icon={faImage}
												className="text-emerald-400 text-xs"
											/>
										</div>
									</div>
									<div className="mt-1 flex justify-center items-center gap-1 opacity-60">
										<FontAwesomeIcon
											icon={faBolt}
											className="text-[8px] text-purple-500"
										/>
										<div className="h-1 w-12 bg-neutral-200 rounded-full"></div>
									</div>
								</div>

								<div className="space-y-2 opacity-30 blur-[0.5px]">
									<div className="h-6 w-full bg-neutral-100 rounded"></div>
									<div className="grid grid-cols-2 gap-2">
										<div className="h-6 w-full bg-neutral-100 rounded"></div>
										<div className="h-6 w-full bg-neutral-100 rounded"></div>
									</div>
								</div>
							</div>
						</div>

						<div className="text-neutral-600 max-w-sm mx-auto space-y-2.5">
							<p className="text-sm leading-relaxed">
								右下のボタンから、通常の手入力のほか、
								<br />
								レシート撮影によるAI一括読み取りに対応しています。
							</p>
							<div className="text-xs leading-relaxed text-amber-800 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/80 text-left">
								ATM出金や電子マネーチャージは「振替」で記録すると、総資産を変えずに管理できます。
							</div>
						</div>
					</div>
				)}

				{/* スライド 2: AIアドバイザー */}
				{activeStep === 2 && (
					<div className="flex flex-col items-center justify-center py-2">
						<h3 className="font-bold text-xl mb-4 text-neutral-900 flex items-center justify-center">
							<FontAwesomeIcon
								icon={faRobot}
								className="text-green-500 mr-2.5"
							/>
							AIアドバイザー
						</h3>

						{/* AIチャット吹き出し + 紙飛行機入力バー + 電球パルス */}
						<div className="w-full max-w-xs h-72 relative mb-4 mx-auto shrink-0">
							<div className="absolute top-4 left-4 right-4 bottom-4 bg-linear-to-br from-indigo-50/50 to-purple-50/50 rounded-3xl transform -rotate-3"></div>

							<div className="absolute top-0 right-0 z-10 w-4/5">
								<div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none p-3 text-xs shadow-lg transform rotate-2 flex items-center justify-end gap-2">
									<div className="text-left">先月と比べてどう？</div>
									<div className="w-6 h-6 rounded-full bg-indigo-500 border border-indigo-400 flex items-center justify-center shrink-0">
										<FontAwesomeIcon icon={faUser} className="text-[10px]" />
									</div>
								</div>
							</div>

							<div className="absolute top-16 left-0 z-20 w-11/12">
								<div className="bg-white text-neutral-800 border border-neutral-100 rounded-2xl rounded-tl-none p-4 text-xs shadow-xl transform -rotate-1 flex gap-3">
									<div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shrink-0">
										<FontAwesomeIcon icon={faRobot} className="text-xs" />
									</div>
									<div className="text-left leading-relaxed">
										<span className="font-bold text-indigo-600 block mb-1 text-[10px]">
											WalletWise AI
										</span>
										先月の食費は
										<span className="font-bold text-rose-500 mx-0.5">
											¥45,000
										</span>
										で、前月比
										<span className="font-bold text-rose-500 mx-0.5">+10%</span>
										です。外食が主な要因ですね。
									</div>
								</div>
							</div>

							<div className="absolute bottom-6 left-2 right-2 z-30">
								<div className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-neutral-200 flex items-center gap-2 transform rotate-1">
									<div className="grow text-left text-xs text-neutral-400 pl-2 truncate">
										節約のアドバイスは？
									</div>
									<div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
										<FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
									</div>
								</div>
							</div>

							<div className="absolute top-1/2 right-0 text-5xl text-yellow-400 opacity-20 transform rotate-12 animate-pulse pointer-events-none">
								<FontAwesomeIcon icon={faLightbulb} />
							</div>
						</div>

						<div className="text-neutral-600 max-w-sm mx-auto space-y-2.5">
							<p className="text-sm leading-relaxed">
								「食費の内訳は？」「節約のアドバイスをして」と質問すれば、
								<br />
								AIが家計簿を分析して即座に答えてくれます。
							</p>
							<p className="text-xs leading-relaxed text-neutral-400 text-center">
								※AI機能は「設定」メニューのAI連携からいつでも有効化できます。
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
						<p className="text-sm text-neutral-500 mb-4">
							右上の歯車アイコン「設定」から、初期設定を行いましょう。
						</p>

						{/* 3つの設定項目リスト */}
						<div className="w-full max-w-sm mx-auto divide-y divide-neutral-100 text-left">
							{/* 1. 口座設定 */}
							<div className="flex items-start gap-3.5 py-3.5">
								<div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
									<FontAwesomeIcon icon={faWallet} className="text-sm" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="text-sm font-bold text-neutral-900 mb-0.5">
										口座設定
									</div>
									<div className="text-xs text-neutral-600 leading-relaxed">
										現金・銀行・電子マネーやクレカを登録し、「残高調整」で現在の預金額・所持金を合わせます。
									</div>
								</div>
							</div>

							{/* 2. カード支払い設定 */}
							<div className="flex items-start gap-3.5 py-3.5">
								<div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
									<FontAwesomeIcon icon={faMoneyCheck} className="text-sm" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-1.5 mb-0.5">
										<span className="text-sm font-bold text-neutral-900">
											カード支払い設定
										</span>
										<span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.2 rounded border border-rose-100">
											★重要
										</span>
									</div>
									<div className="text-xs text-neutral-600 leading-relaxed">
										締め日・支払日・引落口座を設定。請求一覧が自動集計され、「振替を記録」で二重計上なく引き落とし処理できます。
									</div>
								</div>
							</div>

							{/* 3. カテゴリ設定 */}
							<div className="flex items-start gap-3.5 py-3.5">
								<div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
									<FontAwesomeIcon icon={faTags} className="text-sm" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="text-sm font-bold text-neutral-900 mb-0.5">
										カテゴリ設定
									</div>
									<div className="text-xs text-neutral-600 leading-relaxed">
										よく使う費目を上に並び替えたり、自分好みの支出・収入項目を自由に追加・編集できます。
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* スライド 4: 通知を受け取る */}
				{activeStep === 4 && (
					<div className="flex flex-col items-center justify-center py-2">
						<h3 className="font-bold text-xl mb-4 text-neutral-900 flex items-center justify-center">
							<FontAwesomeIcon
								icon={faBell}
								className="text-yellow-500 mr-2.5"
							/>
							通知を受け取る
						</h3>

						{/* ベルアイコン + 許可ボタン */}
						<div className="w-full max-w-xs p-6 text-center mb-2 mx-auto shrink-0">
							<div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
								<FontAwesomeIcon
									icon={faBell}
									className="text-4xl text-yellow-500"
								/>
							</div>
							<div className="text-neutral-600 text-sm leading-relaxed mb-6">
								入力忘れ防止のリマインダーや、
								<br />
								定期的なレポートをお届けします。
							</div>
							<button
								onClick={handleNotificationClick}
								className={`px-6 py-2.5 rounded-full font-bold text-sm shadow-md transition w-full cursor-pointer ${
									notificationState === "configured"
										? "bg-green-500 text-white cursor-default"
										: "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
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

						<div className="text-neutral-400 text-xs max-w-xs mx-auto">
							※通知設定は、後からいつでも「設定」メニューから変更できます。
						</div>
					</div>
				)}

				{/* スライド 5: 準備完了です！ */}
				{activeStep === 5 && (
					<div className="flex flex-col items-center justify-center py-2">
						<div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
							<FontAwesomeIcon
								icon={faCheck}
								className="text-5xl text-indigo-500"
							/>
						</div>
						<h3 className="font-bold text-xl md:text-2xl mb-4 text-neutral-900">
							準備完了です！
						</h3>
						<p className="text-neutral-600 leading-relaxed max-w-sm mx-auto text-sm mb-8">
							基本的な機能と設定は以上です。
							<br />
							さっそくあなたのお金の流れを
							<br />
							スマートに記録・管理していきましょう。
						</p>
						<div className="mt-2">
							<button
								onClick={onClose}
								className="bg-primary text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg hover:bg-primary-dark transition transform hover:scale-105 cursor-pointer"
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
