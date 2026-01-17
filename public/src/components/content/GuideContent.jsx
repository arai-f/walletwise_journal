import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { isDeviceRegisteredForNotifications } from "../../services/store.js";

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

	const chartData = [
		{ name: "食費", value: 35, color: "#f43f5e" },
		{ name: "住居", value: 40, color: "#fb923c" },
		{ name: "交通", value: 15, color: "#facc15" },
		{ name: "他", value: 10, color: "#94a3b8" },
	];

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
								WalletWise Journalへ
								<br />
								ようこそ
							</h3>
							<p className="text-gray-600 leading-relaxed max-w-sm mx-auto text-base mb-8">
								あなたのお金の流れを
								<br />
								シンプルに記録・管理するための
								<br />
								家計簿アプリです。
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

							<div className="w-full max-w-xs rounded-xl shadow-md mb-8 mx-auto text-left">
								<div className="bg-linear-to-r from-primary to-violet-600 rounded-xl p-5 text-white shadow-sm">
									<div className="flex flex-col gap-3">
										<div>
											<h3 className="text-white/80 text-xs font-medium mb-1">
												純資産 (資産 - 負債)
											</h3>
											<p className="text-2xl font-bold tracking-tight">
												¥1,234,567
											</p>
										</div>
										<div className="flex gap-4 text-sm border-t border-white/30 pt-3">
											<div>
												<span className="block text-white/60 text-[10px]">
													総資産
												</span>
												<span className="block font-bold text-base">
													¥1,500,000
												</span>
											</div>
											<div>
												<span className="block text-white/60 text-[10px]">
													総負債
												</span>
												<span className="block font-bold text-base">
													¥265,433
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">ホーム画面</p>
								<p className="text-sm leading-relaxed">
									現在の「純資産」と、その内訳（総資産・総負債）をリアルタイムで確認できます。
									<br />
									お金の健康状態がひと目でわかります。
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

							<div className="w-full max-w-sm mb-6 pb-2 mx-auto relative">
								<div className="absolute top-0 left-4 z-10 flex flex-col items-center">
									<div className="ai-rainbow-btn w-14 h-14 flex items-center justify-center shadow-lg rounded-full mb-2">
										<i className="fas fa-plus text-2xl text-white"></i>
									</div>
									<div className="bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
										1. タップ
									</div>
								</div>

								<div className="absolute top-7 left-14 w-12 h-0.5 bg-neutral-300"></div>
								<div className="absolute top-5 left-24 text-neutral-400">
									<i className="fas fa-caret-right text-xl"></i>
								</div>

								<div className="ml-24 mt-4 bg-white border border-neutral-200 rounded-xl shadow-lg p-3 text-left w-56 transform -rotate-2">
									<div className="flex justify-between items-center mb-3">
										<div className="h-2 w-16 bg-neutral-200 rounded"></div>
										<div className="h-4 w-4 bg-neutral-100 rounded-full"></div>
									</div>

									<div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-lg p-2 mb-3 relative">
										<div className="absolute -top-3 -right-3 bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow z-20">
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
									右下のボタンから登録画面を開き、
									<br />
									そのまま数値を入力するか、
									<br />
									「読み取り」ボタンでAI入力を選びます。
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
								<i className="fas fa-chart-pie text-blue-500 mr-3"></i>
								分析・レポート
							</h3>

							<div className="w-full max-w-xs bg-white border border-gray-200 rounded-xl shadow-md mb-8 p-4 mx-auto text-left space-y-4">
								<div className="flex justify-between items-center">
									<h2 className="text-lg font-bold text-neutral-900 border-l-4 border-primary pl-3">
										収支レポート
									</h2>
									<div className="h-9 border border-neutral-300 rounded-lg px-2 text-sm bg-white flex items-center">
										2025年12月
									</div>
								</div>

								<div className="grid grid-cols-1 gap-2">
									<div className="p-2 rounded-lg border border-neutral-200 bg-white shadow-sm">
										<div className="text-xs text-neutral-500 mb-0.5">収入</div>
										<div className="text-lg font-bold text-emerald-600 tabular-nums tracking-tight truncate">
											¥120,000
										</div>
									</div>
									<div className="p-2 rounded-lg border border-rose-500 bg-rose-50 shadow-sm">
										<div className="text-xs text-neutral-500 mb-0.5">支出</div>
										<div className="text-lg font-bold text-rose-600 tabular-nums tracking-tight truncate">
											¥140,000
										</div>
									</div>
									<div className="p-2 rounded-lg border border-neutral-100 bg-neutral-50">
										<div className="text-xs text-neutral-500 mb-0.5">
											収支差
										</div>
										<div className="text-lg font-bold text-rose-600 tabular-nums tracking-tight truncate">
											-¥20,000
										</div>
									</div>
								</div>

								<div className="h-32 w-full relative mt-2">
									<ResponsiveContainer width="100%" height="100%">
										<PieChart>
											<Pie
												data={chartData}
												dataKey="value"
												cx="50%"
												cy="50%"
												innerRadius={35}
												outerRadius={50}
												paddingAngle={2}
												startAngle={90}
												endAngle={-270}
												stroke="none"
											>
												{chartData.map((entry, index) => (
													<Cell key={`cell-${index}`} fill={entry.color} />
												))}
											</Pie>
										</PieChart>
									</ResponsiveContainer>
									<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
										<span className="text-[10px] font-bold text-neutral-400">
											支出内訳
										</span>
									</div>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									お金の流れを見える化
								</p>
								<p className="text-sm leading-relaxed">
									カテゴリ別の支出割合や、月ごとの収支推移をグラフで確認。
									<br />
									無駄遣いの発見に役立ちます。
								</p>
							</div>
						</div>
					</div>

					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-robot text-green-500 mr-3"></i>
								AIアドバイザー
								<span className="ml-2 bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded border border-purple-200">
									BETA
								</span>
							</h3>

							<div className="w-full max-w-xs bg-white border border-gray-200 rounded-xl shadow-md mb-8 overflow-hidden mx-auto text-left flex flex-col h-64">
								<div className="px-3 py-2 border-b border-neutral-100 bg-neutral-50/80 flex items-center gap-2">
									<div className="w-6 h-6 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs">
										<i className="fa-solid fa-robot"></i>
									</div>
									<span className="text-xs font-bold text-neutral-800">
										AI Advisor
									</span>
								</div>

								<div className="grow p-3 space-y-3 bg-white overflow-hidden relative">
									<div className="flex w-full justify-end">
										<div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none px-3 py-2 text-xs max-w-[85%]">
											先月と比べてどう？
										</div>
									</div>
									<div className="flex w-full justify-start">
										<div className="bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-none px-3 py-2 text-xs max-w-[90%]">
											先月より約3,000円節約できています！素晴らしいですね🎉
										</div>
									</div>
								</div>

								<div className="p-2 border-t border-neutral-100 bg-white flex gap-2 items-center">
									<div className="grow bg-neutral-50 border border-neutral-200 rounded-full h-8 px-3 text-xs flex items-center text-neutral-400">
										質問を入力...
									</div>
									<div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
										<i className="fas fa-paper-plane text-xs"></i>
									</div>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									チャットで気軽に相談
								</p>
								<p className="text-sm leading-relaxed">
									「食費の内訳は？」「節約のアドバイスをして」
									<br />
									チャット形式で質問すれば、AIが家計簿を分析して即座に答えてくれます。
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

							<div className="w-full max-w-xs bg-white border border-gray-200 rounded-xl shadow-md mb-8 text-left overflow-hidden mx-auto">
								<div className="p-4 border-b border-neutral-200 flex items-center gap-3">
									<i className="fas fa-cog text-primary text-xl"></i>
									<h2 className="text-xl font-bold text-neutral-900">設定</h2>
								</div>
								<div className="p-2 bg-white flex flex-col gap-1">
									<div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100">
										<div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
											<i className="fa-solid fa-list text-sm"></i>
										</div>
										<span className="text-sm font-bold text-neutral-700">
											リスト管理
										</span>
									</div>
									<div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100">
										<div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
											<i className="fa-solid fa-credit-card text-sm"></i>
										</div>
										<span className="text-sm font-bold text-neutral-700">
											クレジットカード設定
										</span>
									</div>
									<div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100">
										<div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
											<i className="fa-solid fa-camera text-sm"></i>
										</div>
										<span className="text-sm font-bold text-neutral-700">
											スキャン設定
										</span>
									</div>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									より使いやすく
								</p>
								<p className="text-sm leading-relaxed">
									「設定」メニューから、よく使うカテゴリやクレジットカードのルールを細かく設定できます。
								</p>
							</div>
						</div>
					</div>

					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-mobile-alt text-blue-500 mr-3"></i>
								アプリとして使う
							</h3>

							<div className="w-full max-w-xs bg-white border border-gray-200 rounded-xl shadow-md mb-8 p-5 mx-auto text-left space-y-6">
								<div className="space-y-2">
									<div className="flex items-center gap-2 mb-1">
										<i className="fab fa-apple text-xl text-gray-800"></i>
										<span className="font-bold text-sm text-gray-800">
											iPhone (Safari)
										</span>
									</div>
									<div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 text-xs text-gray-600 leading-relaxed">
										<ol className="list-decimal list-inside space-y-1">
											<li>
												画面下部の
												<span className="font-bold mx-1 text-blue-500">
													<i className="fas fa-share-square"></i> 共有
												</span>
												をタップ
											</li>
											<li>
												<span className="font-bold mx-1">
													<i className="far fa-plus-square"></i>{" "}
													ホーム画面に追加
												</span>
												を選択
											</li>
										</ol>
									</div>
								</div>

								<div className="space-y-2">
									<div className="flex items-center gap-2 mb-1">
										<i className="fab fa-android text-xl text-green-500"></i>
										<span className="font-bold text-sm text-gray-800">
											Android (Chrome)
										</span>
									</div>
									<div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 text-xs text-gray-600 leading-relaxed">
										<ol className="list-decimal list-inside space-y-1">
											<li>
												右上の
												<span className="font-bold mx-1 text-gray-500">
													<i className="fas fa-ellipsis-v"></i> メニュー
												</span>
												をタップ
											</li>
											<li>
												<span className="font-bold mx-1">
													<i className="fas fa-download"></i>{" "}
													アプリをインストール
												</span>
												<br />
												<span className="ml-4 text-[10px] text-gray-400">
													(または「ホーム画面に追加」)
												</span>
											</li>
										</ol>
									</div>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									ホーム画面から即起動
								</p>
								<p className="text-sm leading-relaxed">
									ホーム画面に追加することで、ブラウザのアドレスバーが消え、アプリのように広く画面を使えます。
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
									入力忘れ防止のリマインダーや、
									<br />
									定期的なレポートをお届けします。
									<br />
									（後から設定で変更可能です）
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
								基本的な機能は以上です。
								<br />
								さっそくあなたのお金の管理を始めましょう。
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
