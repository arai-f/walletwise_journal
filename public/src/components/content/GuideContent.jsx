import { useEffect, useState } from "react";
import { isDeviceRegisteredForNotifications } from "../../services/notification.js";

export default function GuideContent({ onRequestNotification, onClose }) {
	const [notificationState, setNotificationState] = useState("initial"); // initial, loading, configured

	const checkNotificationStatus = async () => {
		const isRegistered = await isDeviceRegisteredForNotifications();
		if (isRegistered) {
			setNotificationState("configured");
		}
	};

	useEffect(() => {
		checkNotificationStatus();
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
		<div className="w-full h-full flex flex-col">
			<div className="swiper guide-swiper w-full h-full bg-white">
				<div className="swiper-wrapper">
					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
								<i className="fas fa-lightbulb text-5xl text-yellow-500"></i>
							</div>
							<h3 className="font-bold text-3xl mb-6 text-gray-800">
								WalletWise Journal
								<br />
								使い方ガイド
							</h3>
							<p className="text-gray-600 leading-relaxed max-w-sm mx-auto text-base mb-8">
								あなたのお金の流れをシンプルに記録・管理するための家計簿アプリです。
							</p>
							<div className="animate-bounce text-gray-400 mt-4">
								<span className="text-sm block mb-2">スワイプして開始</span>
								<i className="fas fa-chevron-right text-2xl"></i>
							</div>
						</div>
					</div>

					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-home text-indigo-500 mr-3"></i>
								資産状況を一目で
							</h3>

							<div className="w-full max-w-xs h-64 relative mb-8 mx-auto">
								<div className="absolute top-4 left-4 right-4 bottom-4 bg-linear-to-br from-blue-50/50 to-indigo-50/50 rounded-3xl transform rotate-3"></div>

								<div className="absolute inset-0 z-10 transform -rotate-1 transition-transform hover:rotate-0 duration-500 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col border border-neutral-100">
									<div className="bg-linear-to-r from-primary to-violet-600 p-5 text-white relative overflow-hidden shrink-0">
										<div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl pointer-events-none"></div>
										<div className="flex flex-col gap-2 relative z-10">
											<div>
												<h3 className="text-white/80 text-[10px] font-bold mb-0.5">
													純資産 (資産 - 負債)
												</h3>
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
									<i className="fas fa-coins"></i>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">ホーム画面</p>
								<p className="text-sm leading-relaxed">
									現在の「純資産」と、その推移をひと目で確認。下部には各口座の残高リストが表示され、タップするとその口座の推移に切り替わります。
								</p>
							</div>
						</div>
					</div>

					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-magic text-purple-500 mr-3"></i>
								取引の記録
							</h3>

							<div className="w-full max-w-xs h-72 relative mb-6 mx-auto">
								<div className="absolute top-8 left-8 right-8 bottom-8 bg-linear-to-br from-purple-100/50 to-pink-100/50 rounded-full blur-2xl"></div>

								<div className="absolute top-0 left-0 z-20 flex flex-col items-center transform -rotate-6">
									<div className="ai-rainbow-btn w-14 h-14 flex items-center justify-center shadow-lg rounded-full mb-2 cursor-pointer hover:scale-105 transition-transform">
										<i className="fas fa-plus text-2xl text-white"></i>
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
												<i className="fas fa-camera text-indigo-400 text-xs"></i>
											</div>
											<div className="h-8 bg-emerald-50 rounded border border-emerald-200 flex items-center justify-center">
												<i className="fas fa-image text-emerald-400 text-xs"></i>
											</div>
										</div>
										<div className="mt-1 flex justify-center items-center gap-1 opacity-60">
											<i className="fas fa-bolt text-[8px] text-purple-500"></i>
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

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									AIスキャンも、手入力も
								</p>
								<p className="text-sm leading-relaxed">
									右下のボタンから登録画面を開き、そのまま数値を入力するか、「読み取り」ボタンでAI入力を選びます。
								</p>
								<div className="text-xs bg-purple-50 text-purple-700 px-3 py-2 rounded-lg inline-block border border-purple-100">
									<i className="fas fa-bolt mr-1"></i>
									Gemini 2.5 Flashで高速解析
								</div>
							</div>
						</div>
					</div>

					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-robot text-green-500 mr-3"></i>
								AIアドバイザー
							</h3>

							<div className="w-full max-w-xs h-72 relative mb-8 mx-auto">
								<div className="absolute top-4 left-4 right-4 bottom-4 bg-linear-to-br from-indigo-50/50 to-purple-50/50 rounded-3xl transform -rotate-3"></div>

								<div className="absolute top-0 right-0 z-10 w-4/5">
									<div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none p-3 text-xs shadow-lg transform rotate-2 flex items-center justify-end gap-2">
										<div className="text-left">先月と比べてどう？</div>
										<div className="w-6 h-6 rounded-full bg-indigo-500 border border-indigo-400 flex items-center justify-center shrink-0">
											<i className="fas fa-user text-[10px]"></i>
										</div>
									</div>
								</div>

								<div className="absolute top-16 left-0 z-20 w-11/12">
									<div className="bg-white text-neutral-800 border border-neutral-100 rounded-2xl rounded-tl-none p-4 text-xs shadow-xl transform -rotate-1 flex gap-3">
										<div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shrink-0">
											<i className="fa-solid fa-robot text-xs"></i>
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
											<span className="font-bold text-rose-500 mx-0.5">
												+10%
											</span>
											です。外食が主な要因ですね。
										</div>
									</div>
								</div>

								<div className="absolute bottom-6 left-2 right-2 z-30">
									<div className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-neutral-200 flex items-center gap-2 transform rotate-1">
										<div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
											<i className="fas fa-plus text-xs"></i>
										</div>
										<div className="grow text-left text-xs text-neutral-400 pl-2 truncate">
											節約のアドバイスは？
										</div>
										<div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
											<i className="fas fa-paper-plane text-xs"></i>
										</div>
									</div>
								</div>

								<div className="absolute top-1/2 right-0 text-5xl text-yellow-400 opacity-20 transform rotate-12 animate-pulse pointer-events-none">
									<i className="fas fa-lightbulb"></i>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									チャットで気軽に相談
								</p>
								<p className="text-sm leading-relaxed">
									「食費の内訳は？」「節約のアドバイスをして」
									<br />
									チャット形式で質問すれば、
									<br />
									AIが家計簿を分析して即座に答えてくれます。
									<br />
									<p className="text-xs text-gray-400 mt-2">
										設定から有効にする必要があります。
									</p>
								</p>
							</div>
						</div>
					</div>

					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-cog text-neutral-600 mr-3"></i>
								自分好みに設定
							</h3>

							<div className="w-full max-w-xs h-64 relative mb-8 mx-auto">
								<div className="absolute top-4 left-4 right-4 bottom-4 bg-linear-to-br from-gray-100 to-slate-200 rounded-3xl transform rotate-3"></div>

								<div className="absolute inset-x-2 top-0 bottom-4 z-10 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col transform -rotate-1">
									<div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-white">
										<div className="flex items-center gap-2">
											<h2 className="text-sm font-bold text-neutral-900">
												設定
											</h2>
										</div>
										<div className="w-6 h-6 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
											<i className="fas fa-times text-xs"></i>
										</div>
									</div>

									<div className="p-2 bg-white flex flex-col gap-1">
										<div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-neutral-50 transition-colors">
											<div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
												<i className="fa-solid fa-sliders text-xs"></i>
											</div>
											<div className="flex-1">
												<span className="text-xs font-bold text-neutral-700 block">
													一般設定
												</span>
												<span className="text-[10px] text-neutral-400 block">
													表示期間、通知など
												</span>
											</div>
											<i className="fas fa-chevron-right text-neutral-300 text-xs"></i>
										</div>

										<div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-neutral-50 transition-colors">
											<div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
												<i className="fa-solid fa-wallet text-xs"></i>
											</div>
											<div className="flex-1">
												<span className="text-xs font-bold text-neutral-700 block">
													口座設定
												</span>
												<span className="text-[10px] text-neutral-400 block">
													銀行、現金、電子マネー
												</span>
											</div>
											<i className="fas fa-chevron-right text-neutral-300 text-xs"></i>
										</div>

										<div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-neutral-50 transition-colors">
											<div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
												<i className="fa-solid fa-tags text-xs"></i>
											</div>
											<div className="flex-1">
												<span className="text-xs font-bold text-neutral-700 block">
													カテゴリ設定
												</span>
												<span className="text-[10px] text-neutral-400 block">
													費目の追加・編集
												</span>
											</div>
											<i className="fas fa-chevron-right text-neutral-300 text-xs"></i>
										</div>
									</div>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									より使いやすく
								</p>
								<p className="text-sm leading-relaxed">
									「設定」メニューから、口座やカテゴリのカスタマイズ、クレジットカードのルールなどを細かく設定できます。
								</p>
							</div>
						</div>
					</div>

					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-bell text-yellow-500 mr-3"></i>
								通知を受け取る
							</h3>

							<div className="w-full max-w-xs p-6 text-center mb-8 mx-auto">
								<div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
									<i className="fas fa-bell text-4xl text-yellow-500"></i>
								</div>
								<p className="text-gray-600 text-sm leading-relaxed mb-6">
									入力忘れ防止のリマインダーや、定期的なレポートをお届けします。（後から設定で変更可能です）
								</p>
								<button
									onClick={handleNotificationClick}
									className={`px-6 py-2 rounded-full font-bold shadow-md transition w-full ${
										notificationState === "configured"
											? "bg-green-500 text-white cursor-default"
											: "bg-indigo-600 text-white hover:bg-indigo-700"
									}`}
									disabled={
										notificationState === "loading" ||
										notificationState === "configured"
									}
								>
									{notificationState === "loading" ? (
										<i className="fas fa-spinner fa-spin"></i>
									) : notificationState === "configured" ? (
										"設定済みです"
									) : (
										"通知を許可する"
									)}
								</button>
							</div>
						</div>
					</div>

					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
								<i className="fas fa-check text-5xl text-indigo-500"></i>
							</div>
							<h3 className="font-bold text-3xl mb-6 text-gray-800">
								準備完了です！
							</h3>
							<p className="text-gray-600 leading-relaxed max-w-sm mx-auto text-base mb-8">
								基本的な機能は以上です。さっそくあなたのお金の管理を始めましょう。
							</p>
							<div className="mt-8">
								<button
									onClick={onClose}
									className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-primary-dark transition transform hover:scale-105"
								>
									さあ、始めましょう！
								</button>
							</div>
						</div>
					</div>
				</div>

				<div className="swiper-pagination"></div>
				<div className="swiper-button-prev text-gray-400! hover:text-primary! transition-colors"></div>
				<div className="swiper-button-next text-gray-400! hover:text-primary! transition-colors"></div>
			</div>
		</div>
	);
}
