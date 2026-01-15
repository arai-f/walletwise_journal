import { useEffect, useState } from "react";
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

	return (
		<div className="w-full h-full flex flex-col">
			<div className="swiper guide-swiper w-full h-full bg-white">
				<div className="swiper-wrapper">
					{/* Slide 1: Welcome */}
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

					{/* Slide 2: Dashboard Overview */}
					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-home text-indigo-500 mr-3"></i>
								資産状況を一目で
							</h3>

							{/* Actual UI: Dashboard Asset Card Structure */}
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

					{/* Slide 3: Record Transaction Entry */}
					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-pencil-alt text-primary mr-3"></i>
								取引の記録
							</h3>

							{/* Actual UI: FAB Menu Structure */}
							<div className="w-full max-w-xs mb-8 p-5 mx-auto text-left">
								<div className="flex flex-col gap-4 items-center">
									<div className="flex items-center gap-4">
										<span className="bg-white px-3 py-1.5 rounded-lg shadow text-sm font-bold text-gray-700 border border-gray-200">
											レシート撮影
										</span>
										<button
											className="ai-rainbow-btn w-14 h-14 flex items-center justify-center shadow-lg"
											title="AIで画像を読み取る"
										>
											<i className="fas fa-camera text-xl text-white"></i>
										</button>
									</div>
									<div className="flex items-center gap-4">
										<span className="bg-white px-3 py-1.5 rounded-lg shadow text-sm font-bold text-gray-700 border border-gray-200">
											手動入力
										</span>
										<button
											className="indigo-ring-btn w-16 h-16 flex items-center justify-center shadow-lg"
											title="取引を手動入力"
										>
											<i className="fas fa-plus text-2xl text-white"></i>
										</button>
									</div>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									右下のボタンからスタート
								</p>
								<p className="text-sm leading-relaxed">
									日々の買い物や収入は、画面右下の大きなプラスボタンから記録します。
									<br />
									手動入力とAIスキャンを選べます。
								</p>
							</div>
						</div>
					</div>

					{/* Slide 4: Manual Input */}
					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-keyboard text-indigo-500 mr-3"></i>
								シンプル手動入力
							</h3>

							{/* Mockup: Manual Input Form */}
							<div className="w-full max-w-xs bg-white border border-gray-200 rounded-xl shadow-md mb-8 p-5 mx-auto text-left">
								<div className="space-y-4">
									{/* Segmented Control Mockup */}
									<div className="bg-neutral-100 p-1.5 rounded-full flex border border-neutral-100/50 items-center">
										<button
											type="button"
											className="flex-1 py-1.5 text-xs font-bold rounded-full bg-red-500 text-white shadow-md flex items-center justify-center gap-1.5 transform scale-[1.02]"
										>
											<i className="fas fa-minus-circle text-white/90"></i>
											<span>支出</span>
										</button>
										<button
											type="button"
											className="flex-1 py-1.5 text-xs font-bold rounded-full text-neutral-500 flex items-center justify-center gap-1.5"
										>
											<i className="fas fa-plus-circle text-neutral-400"></i>
											<span>収入</span>
										</button>
										<button
											type="button"
											className="flex-1 py-1.5 text-xs font-bold rounded-full text-neutral-500 flex items-center justify-center gap-1.5"
										>
											<i className="fas fa-exchange-alt text-neutral-400"></i>
											<span>振替</span>
										</button>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-xs font-bold text-neutral-600 mb-1">
												日付
											</label>
											<div className="w-full h-9 text-sm border border-neutral-300 rounded-lg px-2 flex items-center bg-white text-neutral-900">
												2025-01-01
											</div>
										</div>
										<div>
											<label className="block text-xs font-bold text-neutral-600 mb-1">
												金額
											</label>
											<div className="w-full h-9 text-sm border border-neutral-300 rounded-lg px-2 flex items-center bg-white text-neutral-900">
												1,200
											</div>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-xs font-bold text-neutral-600 mb-1">
												支払方法
											</label>
											<div className="w-full h-9 text-sm border border-neutral-300 rounded-lg px-2 flex items-center bg-white text-neutral-900">
												現金
											</div>
										</div>
										<div>
											<label className="block text-xs font-bold text-neutral-600 mb-1">
												カテゴリ
											</label>
											<div className="w-full h-9 text-sm border border-neutral-300 rounded-lg px-2 flex items-center bg-white text-neutral-900">
												食費
											</div>
										</div>
									</div>
									<div>
										<label className="block text-xs font-bold text-neutral-600 mb-1">
											詳細 (任意)
										</label>
										<div className="w-full h-9 text-sm border border-neutral-300 rounded-lg px-2 flex items-center bg-white text-neutral-900">
											ランチ
										</div>
									</div>
								</div>
								<div className="flex justify-end gap-3 pt-4 mt-4 border-t border-neutral-200">
									<button
										type="button"
										className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition shadow-md font-bold"
									>
										保存
									</button>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">サクサク入力</p>
								<p className="text-sm leading-relaxed">
									日付、金額、カテゴリなどを選んで保存するだけ。
									<br />
									シンプルで直感的な操作画面です。
								</p>
							</div>
						</div>
					</div>

					{/* Slide 5: AI Scan */}
					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-magic text-purple-500 mr-3"></i>
								AIスキャン入力
								<span className="ml-2 bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded border border-purple-200">
									BETA
								</span>
							</h3>

							<div className="w-full max-w-xs p-6 text-center relative mb-8 mx-auto">
								<div className="space-y-6">
									<div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 bg-neutral-50">
										<p className="text-neutral-500 text-sm mb-4">
											レシートや明細書の
											<br />
											画像を選択してください
										</p>
										<div className="flex justify-center gap-4">
											<div className="flex flex-col items-center justify-center w-20 h-20 bg-white border border-neutral-200 rounded-lg shadow-sm">
												<i className="fas fa-camera text-2xl text-primary mb-2"></i>
												<span className="text-xs font-bold text-neutral-600">
													カメラ
												</span>
											</div>
											<div className="flex flex-col items-center justify-center w-20 h-20 bg-white border border-neutral-200 rounded-lg shadow-sm">
												<i className="fas fa-images text-2xl text-green-500 mb-2"></i>
												<span className="text-xs font-bold text-neutral-600">
													アルバム
												</span>
											</div>
										</div>
									</div>
								</div>
								<div className="absolute top-0 right-0 -mt-2 -mr-2 text-3xl text-yellow-400 drop-shadow-md">
									<i className="fas fa-bolt"></i>
								</div>
							</div>

							<div className="text-gray-600 max-w-xs mx-auto space-y-4">
								<p className="font-bold text-lg text-gray-800">
									レシートを撮るだけ
								</p>
								<p className="text-sm leading-relaxed">
									「カメラ」ボタンでレシートを撮影すれば、
									<br />
									AIが内容を解析して自動で入力します。
									<br />
									面倒な入力作業から解放されましょう。
								</p>
							</div>
						</div>
					</div>

					{/* Slide 6: Analysis */}
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

								<div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 space-y-2">
									<div className="flex justify-between items-center">
										<span className="font-bold flex items-center text-green-500 text-sm">
											<i className="fas fa-plus-circle mr-2"></i>収入
										</span>
										<span className="text-sm font-bold text-neutral-800">
											¥120,000
										</span>
									</div>
									<div className="border-b border-neutral-300/70 my-1"></div>
									<div className="flex justify-between items-center pt-1">
										<span className="font-bold text-neutral-600 text-sm">
											収支差
										</span>
										<span className="text-lg font-extrabold text-red-500">
											-¥20,000
										</span>
									</div>
								</div>

								<div className="hidden">
									<div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
										<p className="text-xs text-center text-gray-400 w-full">
											（ここにカテゴリ別支出カードが入ります）
										</p>
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

					{/* Slide 7: AI Advisor */}
					<div className="swiper-slide p-6 text-center">
						<div className="flex flex-col items-center justify-center h-full">
							<h3 className="font-bold text-2xl mb-8 text-gray-800 flex items-center justify-center">
								<i className="fas fa-robot text-green-500 mr-3"></i>
								AIアドバイザー
								<span className="ml-2 bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded border border-purple-200">
									BETA
								</span>
							</h3>

							{/* Mockup: Chat UI */}
							<div className="w-full max-w-xs bg-white border border-gray-200 rounded-xl shadow-md mb-8 overflow-hidden mx-auto text-left flex flex-col h-64">
								{/* Header */}
								<div className="px-3 py-2 border-b border-neutral-100 bg-neutral-50/80 flex items-center gap-2">
									<div className="w-6 h-6 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs">
										<i className="fa-solid fa-robot"></i>
									</div>
									<span className="text-xs font-bold text-neutral-800">
										AI Advisor
									</span>
								</div>

								{/* Chat Log */}
								<div className="grow p-3 space-y-3 bg-white overflow-hidden relative">
									{/* User Message */}
									<div className="flex w-full justify-end">
										<div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none px-3 py-2 text-xs max-w-[85%]">
											先月と比べてどう？
										</div>
									</div>
									{/* AI Message */}
									<div className="flex w-full justify-start">
										<div className="bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-none px-3 py-2 text-xs max-w-[90%]">
											先月より約3,000円節約できています！素晴らしいですね🎉
										</div>
									</div>
								</div>

								{/* Input Area */}
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

					{/* Slide 8: Settings (UPDATED) */}
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

					{/* Slide 9: Notifications */}
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

					{/* Slide 10: Get Started */}
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
