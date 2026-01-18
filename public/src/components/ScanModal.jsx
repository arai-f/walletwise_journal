import { useEffect, useRef, useState } from "react";
import { scanReceipt } from "../services/geminiScanner.js";
import * as notification from "../services/notification.js";
import * as utils from "../utils.js";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";

/**
 * レシート画像をスキャンし、AI解析して取引データとして登録するモーダルコンポーネント。
 * カメラ撮影または画像アップロード、AI解析、結果確認・編集の3ステップで構成される。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているかどうか。
 * @param {Function} props.onClose - モーダルを閉じる関数。
 * @param {object} props.luts - ルックアップテーブル（カテゴリ、アカウントなど）。
 * @param {object} props.scanSettings - スキャン設定（除外キーワード、カテゴリ自動分類ルール）。
 * @param {Function} props.onSave - 保存時のコールバック関数。
 * @return {JSX.Element} スキャンモーダルコンポーネント。
 */
export default function ScanModal({
	isOpen,
	onClose,
	luts,
	scanSettings,
	onSave,
	initialImageFile,
}) {
	const [step, setStep] = useState("start"); // start, analyzing, confirm
	const [activeTab, setActiveTab] = useState("list");
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [scanResult, setScanResult] = useState(null);
	const [imageFile, setImageFile] = useState(null);
	const [transactions, setTransactions] = useState([]);
	const [globalAccountId, setGlobalAccountId] = useState("");
	const [viewState, setViewState] = useState({
		scale: 1,
		x: 0,
		y: 0,
		dragging: false,
		startX: 0,
		startY: 0,
	});
	const imageContainerRef = useRef(null);

	const modalRef = useRef(null);
	const fileCameraRef = useRef(null);
	const fileUploadRef = useRef(null);
	const isAnalyzingRef = useRef(false);

	/**
	 * 利用可能なアカウントをソートして取得する。
	 * @returns {Array} ソート済みアカウントリスト。
	 */
	const getSortedAccounts = () => {
		if (!luts || !luts.accounts) return [];
		return utils.sortItems(
			[...luts.accounts.values()].filter((a) => !a.isDeleted),
		);
	};

	/**
	 * 指定タイプのカテゴリをソートして取得する。
	 * @param {string} type - カテゴリタイプ。
	 * @returns {Array} ソート済みカテゴリリスト。
	 */
	const getSortedCategories = (type) => {
		if (!luts || !luts.categories) return [];
		return utils.sortItems(
			[...luts.categories.values()].filter(
				(c) => !c.isDeleted && c.type === type,
			),
		);
	};

	/**
	 * AIが提案したカテゴリ名に最も近い既存カテゴリを検索する。
	 * 完全一致または部分一致を試み、見つからない場合はデフォルトカテゴリを返す。
	 * @param {string} aiCategoryText - AIが提案したカテゴリ名。
	 * @param {string} type - カテゴリタイプ。
	 * @returns {string} カテゴリID。
	 */
	const findBestCategoryMatch = (aiCategoryText, type) => {
		if (!aiCategoryText) return "";
		const categories = getSortedCategories(type);
		const text = aiCategoryText.toLowerCase().trim();

		// Exact match
		let match = categories.find((c) => c.name.toLowerCase() === text);
		if (match) return match.id;

		// Partial match
		match = categories.find(
			(c) =>
				c.name.toLowerCase().includes(text) ||
				text.includes(c.name.toLowerCase()),
		);
		if (match) return match.id;

		return categories.length > 0 ? categories[0].id : "";
	};

	useEffect(() => {
		if (isOpen && !globalAccountId) {
			const accounts = getSortedAccounts();
			if (accounts.length > 0) {
				setGlobalAccountId(accounts[0].id);
			}
		}
	}, [isOpen, luts, globalAccountId]);

	// モーダルが途中で閉じられた場合、解析状態をクリーンアップする
	useEffect(() => {
		if (!isOpen) {
			setIsAnalyzing(false);
			isAnalyzingRef.current = false;
			setGlobalAccountId("");
		}
	}, [isOpen]);

	useEffect(() => {
		if (isOpen) {
			setStep("start");
			setTransactions([]);
			// Initial image handling
			if (initialImageFile) {
				setImageFile(initialImageFile);
				handleAnalysisStart(initialImageFile);
			} else {
				setImageFile(null);
				setIsAnalyzing(false);
				isAnalyzingRef.current = false;
			}
			setScanResult(null);
		}
	}, [isOpen, initialImageFile]); // Added initialImageFile to dependencies

	const handleAnalysisStart = async (file) => {
		if (!file) return;

		setStep("analyzing");
		setIsAnalyzing(true);
		isAnalyzingRef.current = true;

		try {
			const result = await scanReceipt(file, scanSettings || {}, luts || {});

			// 結果をトランザクション状態に処理
			const rawItems = !result ? [] : Array.isArray(result) ? result : [result];
			const today = utils.toYYYYMMDD(new Date());

			const newTransactions = rawItems.map((item, index) => {
				const type = item.type || "expense";
				let catId = "";
				if (item.category) {
					catId = findBestCategoryMatch(item.category, type);
				} else {
					const cats = getSortedCategories(type);
					if (cats.length > 0) catId = cats[0].id;
				}

				return {
					id: `temp-${Date.now()}-${index}`,
					date: item.date || today,
					amount: item.amount ? String(item.amount) : "",
					type: type,
					categoryId: catId,
					description: item.description || "",
					memo: "",
				};
			});

			// 配列が空でも確認画面に進み、手動追加を可能にする
			setScanResult(result);

			if (newTransactions.length === 0) {
				notification.info(
					"明細が見つかりませんでした。手動で入力してください。",
				);
				newTransactions.push({
					id: `manual-${Date.now()}`,
					date: today,
					amount: "",
					type: "expense",
					categoryId: getSortedCategories("expense")?.[0]?.id || "",
					description: "",
					memo: "",
				});
			}
			setTransactions(newTransactions);

			// 解析中の場合のみステップを進める（キャンセルされていないか確認）
			if (isAnalyzingRef.current) {
				setStep("confirm");
			}
		} catch (err) {
			console.error("[ScanModal] Scan error", err);
			if (isAnalyzingRef.current) {
				// キャンセルされていない場合のみ通知
				notification.error("スキャンに失敗しました。もう一度お試しください。");
				setStep("start");
				setImageFile(null);
			}
		} finally {
			setIsAnalyzing(false);
			isAnalyzingRef.current = false;
		}
	};

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				if (isOpen && !isAnalyzing) {
					onClose();
				}
			}
		};
		if (isOpen) {
			window.addEventListener("keydown", handleKeyDown);
		}
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, isAnalyzing, onClose]);

	// スクロール制御
	useEffect(() => {
		if (isOpen) {
			utils.toggleBodyScrollLock(true);
		}
		return () => {
			if (isOpen) {
				utils.toggleBodyScrollLock(false);
			}
		};
	}, [isOpen]);

	// 画像変更時にビューアをリセット
	useEffect(() => {
		if (step === "confirm" && imageFile) {
			setViewState({
				scale: 1,
				x: 0,
				y: 0,
				dragging: false,
				startX: 0,
				startY: 0,
			});
		}
	}, [step, imageFile]);

	// ビューア操作ハンドラ
	const handleWheel = (e) => {
		if (step !== "confirm") return;
		e.preventDefault(); // Prevent modal scroll
		const scaleAdjustment = e.deltaY * -0.001;
		const newScale = Math.min(
			Math.max(0.5, viewState.scale + scaleAdjustment),
			5,
		);
		setViewState((prev) => ({ ...prev, scale: newScale }));
	};

	const handleMouseDown = (e) => {
		e.preventDefault();
		setViewState((prev) => ({
			...prev,
			dragging: true,
			startX: e.clientX - prev.x,
			startY: e.clientY - prev.y,
		}));
	};

	const handleMouseMove = (e) => {
		if (!viewState.dragging) return;
		e.preventDefault();
		setViewState((prev) => ({
			...prev,
			x: e.clientX - prev.startX,
			y: e.clientY - prev.startY,
		}));
	};

	const handleMouseUp = () => {
		setViewState((prev) => ({ ...prev, dragging: false }));
	};

	/**
	 * 画像ビューアのズームレベルを変更する。
	 * @param {number} factor - ズーム増減量。
	 */
	const handleZoom = (factor) => {
		setViewState((prev) => {
			const newScale = Math.min(Math.max(0.5, prev.scale + factor), 5);
			return { ...prev, scale: newScale };
		});
	};

	/**
	 * 画像ビューアの表示位置とズームをリセットする。
	 */
	const handleResetView = () => {
		setViewState({
			scale: 1,
			x: 0,
			y: 0,
			dragging: false,
			startX: 0,
			startY: 0,
		});
	};

	/**
	 * ファイル選択時の処理を行う。
	 * 画像を読み込み、AI解析を開始する。
	 * @param {Event} e - ファイル選択イベント。
	 */
	const handleFileSelect = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		setImageFile(file);
		e.target.value = ""; // Clear input
		await handleAnalysisStart(file);
	};

	/**
	 * 解析処理をキャンセルし、開始画面に戻る。
	 */
	const handleCancelAnalysis = () => {
		setIsAnalyzing(false);
		isAnalyzingRef.current = false;
		if (window.confirm("解析を中止しますか？")) {
			onClose();
		} else {
			// 再開
			setIsAnalyzing(true);
			isAnalyzingRef.current = true;
		}
	};

	/**
	 * 取引リスト内の特定の取引データを更新する。
	 * 取引タイプが変更された場合は、カテゴリもリセットする。
	 * @param {string} id - 取引ID。
	 * @param {string} field - 更新対象フィールド。
	 * @param {any} value - 新しい値。
	 */
	const handleTransactionChange = (id, field, value) => {
		setTransactions((prev) =>
			prev.map((t) => {
				if (t.id !== id) return t;

				const updates = { [field]: value };
				if (field === "type") {
					const cats = getSortedCategories(value);
					updates.categoryId = cats.length > 0 ? cats[0].id : "";
				}
				return { ...t, ...updates };
			}),
		);
	};

	/**
	 * 手動で取引行を追加する。
	 */
	const handleAddRow = () => {
		setTransactions((prev) => [
			...prev,
			{
				id: `manual-${Date.now()}`,
				date: utils.toYYYYMMDD(new Date()),
				amount: "",
				type: "expense",
				categoryId: getSortedCategories("expense")?.[0]?.id || "",
				description: "",
				memo: "",
			},
		]);
	};

	/**
	 * 取引行を削除する。
	 * @param {string} id - 取引ID。
	 */
	const handleDeleteRow = (id) => {
		setTransactions((prev) => prev.filter((t) => t.id !== id));
	};

	/**
	 * 編集完了した取引リストを保存する。
	 * バリデーションを行い、すべての取引を一括で保存ハンドラに渡す。
	 */
	const handleSave = async () => {
		if (transactions.length === 0) {
			notification.error("保存する取引がありません。行を追加してください。");
			return;
		}

		for (let i = 0; i < transactions.length; i++) {
			const t = transactions[i];
			if (!t.date) {
				notification.error(`${i + 1}行目: 日付は必須です`);
				return;
			}
			if (!t.amount || Number(t.amount) === 0) {
				notification.error(`${i + 1}行目: 金額を入力してください（0円は登録できません）`);
				return;
			}
		}

		if (!globalAccountId) {
			notification.error("支払元口座を選択してください");
			return;
		}

		const dataToSave = transactions.map((t) => ({
			date: new Date(t.date),
			type: t.type,
			amount: Number(t.amount),
			accountId: globalAccountId,
			categoryId: t.categoryId,
			description: t.description,
			memo: t.memo,
			fromAccountId:
				t.type === "transfer"
					? globalAccountId
					: t.type === "expense"
						? globalAccountId
						: "",
			toAccountId:
				t.type === "transfer" ? "" : t.type === "income" ? globalAccountId : "",
		}));

		try {
			await onSave(dataToSave);
			onClose();
		} catch (err) {
			console.error("[ScanModal] Save failed:", err);
			notification.error("保存中にエラーが発生しました");
		}
	};

	const accounts = getSortedAccounts();

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 modal-overlay z-50 flex justify-center items-center p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget && !isAnalyzing) onClose();
			}}
		>
			<div
				className={`bg-white rounded-2xl shadow-xl border border-neutral-200 w-full transition-all duration-300 overflow-hidden flex flex-col ${
					step === "confirm" ? "max-w-6xl h-[90vh]" : "max-w-md min-h-100"
				}`}
				role="dialog"
				aria-modal="true"
				ref={modalRef}
			>
				{/* ヘッダー */}
				{step !== "analyzing" && (
					<div className="flex justify-between items-center p-4 border-b border-neutral-100 shrink-0 bg-white">
						<h2 className="text-lg font-bold text-neutral-900">
							{step === "start" && "AIで画像を読み取る"}
							{step === "confirm" && "スキャン結果の確認"}
						</h2>
						<button
							onClick={() => !isAnalyzing && onClose()}
							disabled={isAnalyzing}
							className={`w-8 h-8 flex items-center justify-center rounded-full transition ${
								isAnalyzing
									? "text-neutral-300 cursor-not-allowed"
									: "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
							}`}
							aria-label="閉じる"
						>
							<i className="fas fa-times text-xl"></i>
						</button>
					</div>
				)}

				{/* コンテンツ */}
				<div
					className={`grow bg-neutral-50 relative flex flex-col ${
						step === "confirm" ? "overflow-hidden" : "overflow-y-auto"
					}`}
				>
					{/* ステップ: 開始 */}
					{step === "start" && (
						<div className="p-8 text-center bg-white h-full flex flex-col items-center justify-center grow">
							<div className="flex items-center gap-2 mb-8">
								<span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded border border-purple-200">
									BETA
								</span>
								<span className="text-xs text-neutral-600 font-medium">
									Powered by <i className="fas fa-bolt text-yellow-400"></i>{" "}
									Gemini 2.5 Flash
								</span>
							</div>

							<div className="grid grid-cols-1 gap-4 w-full max-w-xs">
								<input
									type="file"
									accept="image/*"
									capture="environment"
									className="hidden"
									ref={fileCameraRef}
									onChange={handleFileSelect}
								/>
								<input
									type="file"
									accept="image/*"
									className="hidden"
									ref={fileUploadRef}
									onChange={handleFileSelect}
								/>

								<button
									onClick={() => fileCameraRef.current.click()}
									className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-300 rounded-xl hover:bg-neutral-50 hover:border-indigo-500 hover:text-indigo-600 transition group"
								>
									<div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
										<i className="fas fa-camera text-xl"></i>
									</div>
									<span className="font-bold text-neutral-700 group-hover:text-indigo-700">
										カメラで撮影
									</span>
									<span className="text-xs text-neutral-500 mt-1">
										レシートを撮影して入力
									</span>
								</button>

								<button
									onClick={() => fileUploadRef.current.click()}
									className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-300 rounded-xl hover:bg-neutral-50 hover:border-indigo-500 hover:text-indigo-600 transition group"
								>
									<div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
										<i className="fas fa-image text-xl"></i>
									</div>
									<span className="font-bold text-neutral-700 group-hover:text-indigo-700">
										アルバムから選択
									</span>
									<span className="text-xs text-neutral-500 mt-1">
										保存済みの画像を使用
									</span>
								</button>
							</div>
						</div>
					)}

					{/* ステップ: 解析中 */}
					{step === "analyzing" && (
						<div className="p-6 text-center h-full flex flex-col items-center justify-center grow bg-white">
							<div className="relative w-14 h-14 mb-4">
								<div className="absolute inset-0 border-[3px] border-neutral-100 rounded-full"></div>
								<div className="absolute inset-0 border-[3px] border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
								<div className="absolute inset-0 flex items-center justify-center">
									<i className="fas fa-bolt text-indigo-500 text-lg animate-pulse"></i>
								</div>
							</div>
							<h3 className="text-lg font-bold text-neutral-800 mb-1">
								解析中...
							</h3>
							<p className="text-neutral-500 text-xs mb-4">
								Gemini 2.5 Flash が画像を読み取っています
							</p>

							<button
								onClick={handleCancelAnalysis}
								className="mt-4 px-6 py-2 rounded-full bg-neutral-100 text-neutral-600 text-sm font-bold hover:bg-neutral-200 transition"
							>
								キャンセル
							</button>
						</div>
					)}

					{/* ステップ: 確認 */}
					{step === "confirm" && (
						<div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
							{/* モバイル用タブスイッチャー */}
							<div className="lg:hidden p-2 border-b border-neutral-200 bg-white grid grid-cols-2 gap-2 shrink-0 z-20">
								<button
									className={`py-2 text-sm font-bold rounded-lg transition flex items-center justify-center ${
										activeTab === "list"
											? "bg-neutral-800 text-white shadow-sm"
											: "text-neutral-500 hover:bg-neutral-100"
									}`}
									onClick={() => setActiveTab("list")}
								>
									<i className="fas fa-list mr-2 text-xs"></i>読み取り結果
								</button>
								<button
									className={`py-2 text-sm font-bold rounded-lg transition flex items-center justify-center ${
										activeTab === "image"
											? "bg-neutral-800 text-white shadow-sm"
											: "text-neutral-500 hover:bg-neutral-100"
									}`}
									onClick={() => setActiveTab("image")}
								>
									<i className="fas fa-image mr-2 text-xs"></i>元画像
								</button>
							</div>

							{/* 画像ビューアカラム */}
							<div
								className={`lg:w-1/2 bg-neutral-900 items-center justify-center relative overflow-hidden cursor-move select-none shrink-0 ${
									activeTab === "image"
										? "flex flex-1 h-full"
										: "hidden lg:flex lg:h-full"
								}`}
								ref={imageContainerRef}
								onWheel={handleWheel}
								onMouseDown={handleMouseDown}
								onMouseMove={handleMouseMove}
								onMouseUp={handleMouseUp}
								onMouseLeave={handleMouseUp}
							>
								{/* Zoom Controls */}
								<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-800/80 backdrop-blur-sm p-2 rounded-lg z-10 shadow-lg border border-neutral-700">
									<button
										onClick={() => handleZoom(-0.25)}
										className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded transition"
										aria-label="Zoom Out"
									>
										<i className="fas fa-minus"></i>
									</button>
									<span className="text-xs text-neutral-300 w-12 text-center font-mono">
										{Math.round(viewState.scale * 100)}%
									</span>
									<button
										onClick={() => handleZoom(0.25)}
										className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded transition"
										aria-label="Zoom In"
									>
										<i className="fas fa-plus"></i>
									</button>
									<div className="w-px h-6 bg-neutral-600 mx-1"></div>
									<button
										onClick={handleResetView}
										className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded transition"
										aria-label="Reset View"
									>
										<i className="fas fa-compress"></i>
									</button>
								</div>

								{imageFile && (
									<img
										src={URL.createObjectURL(imageFile)}
										alt="Scan Target"
										className="max-w-none transition-transform duration-75 ease-out"
										style={{
											transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
											maxHeight: "90%",
											maxWidth: "90%",
										}}
										draggable={false}
									/>
								)}
							</div>

							{/* 編集カラム */}
							<div
								className={`lg:w-1/2 flex-col flex-1 bg-white border-l border-neutral-200 min-h-0 ${
									activeTab === "list" ? "flex" : "hidden lg:flex"
								}`}
							>
								{/* グローバル設定 */}
								<div className="p-4 bg-neutral-50 border-b border-neutral-200 shrink-0">
									{accounts.length > 0 ? (
										<Select
											label="支払元口座 (一括設定)"
											value={globalAccountId}
											onChange={(e) => setGlobalAccountId(e.target.value)}
										>
											<optgroup label="資産">
												{accounts
													.filter((a) => a.type === "asset")
													.map((acc) => (
														<option key={acc.id} value={acc.id}>
															{acc.name}
														</option>
													))}
											</optgroup>
											<optgroup label="負債">
												{accounts
													.filter((a) => a.type === "liability")
													.map((acc) => (
														<option key={acc.id} value={acc.id}>
															{acc.name}
														</option>
													))}
											</optgroup>
										</Select>
									) : (
										<div className="text-sm text-red-500 p-2 border border-red-200 rounded-lg bg-red-50">
											<i className="fas fa-exclamation-circle mr-1"></i>
											口座が登録されていません。設定画面から口座を追加してください。
										</div>
									)}
								</div>

								{/* リスト */}
								<div className="grow overflow-y-auto bg-white">
									{transactions.length === 0 && (
										<div className="text-center py-10 text-neutral-400">
											<p className="text-sm mb-2">明細が見つかりませんでした</p>
											<p className="text-xs">手動で行を追加してください</p>
										</div>
									)}

									<div className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
										{transactions.map((txn, idx) => (
											<div
												key={txn.id}
												className="p-3 hover:bg-neutral-50 transition relative group border-b border-neutral-100 last:border-0"
											>
												{/* PC Layout */}
												<div className="hidden sm:block w-full">
													{/* 1行目: 日付・タイプ・カテゴリ・金額 */}
													<div className="flex items-center gap-3 mb-2">
													<Input
														type="date"
														value={txn.date}
														onChange={(e) =>
															handleTransactionChange(
																txn.id,
																"date",
																e.target.value,
															)
														}
														inputClassName="h-9 text-sm border border-neutral-200 rounded bg-white px-2 w-36 text-neutral-700 font-medium"
													/>
													<div className="flex bg-neutral-100 rounded-md p-1 h-9 items-center shrink-0 border border-neutral-200">
														<button
															type="button"
															onClick={() =>
																handleTransactionChange(
																	txn.id,
																	"type",
																	"expense",
																)
															}
															className={`px-3 text-xs h-full rounded transition flex items-center justify-center font-bold ${
																txn.type === "expense"
																	? "bg-white text-red-500 shadow-sm"
																	: "text-neutral-400 hover:text-neutral-600"
															}`}
														>
															支出
														</button>
														<button
															type="button"
															onClick={() =>
																handleTransactionChange(
																	txn.id,
																	"type",
																	"income",
																)
															}
															className={`px-3 text-xs h-full rounded transition flex items-center justify-center font-bold ${
																txn.type === "income"
																	? "bg-white text-green-500 shadow-sm"
																	: "text-neutral-400 hover:text-neutral-600"
															}`}
														>
															収入
														</button>
													</div>
													<div className="flex-1 min-w-0">
														<Select
															value={txn.categoryId}
															onChange={(e) =>
																handleTransactionChange(
																	txn.id,
																	"categoryId",
																	e.target.value,
																)
															}
															selectClassName="h-9 text-sm border border-neutral-200 rounded bg-white w-full px-2 text-neutral-700 font-medium"
														>
															{getSortedCategories(txn.type).map((c) => (
																<option key={c.id} value={c.id}>
																	{c.name}
																</option>
															))}
														</Select>
													</div>
													<div className="w-32 shrink-0">
														<Input
															type="tel"
															value={txn.amount}
															onChange={(e) =>
																handleTransactionChange(
																	txn.id,
																	"amount",
																	utils.sanitizeNumberInput(e.target.value),
																)
															}
															placeholder="0"
															startAdornment="¥"
															inputClassName="h-9 text-sm border border-neutral-200 rounded bg-white focus:ring-2 focus:ring-indigo-500/50 w-full text-right p-1 pr-2 font-medium"
														/>
													</div>
													</div>

													{/* 2行目: メモ・削除 */}
													<div className="flex items-center gap-3">
														<div className="flex-1">
															<Input
																type="text"
																placeholder="内容・メモ (任意)"
																value={txn.description}
																onChange={(e) =>
																	handleTransactionChange(
																		txn.id,
																		"description",
																		e.target.value,
																	)
																}
																inputClassName="h-9 text-sm border border-neutral-200 rounded bg-white px-2 w-full placeholder-neutral-400"
															/>
														</div>
														<button
															onClick={() => handleDeleteRow(txn.id)}
															className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 border border-transparent hover:border-red-100"
															title="この行を削除"
														>
															<i className="fas fa-trash-alt"></i> 削除
														</button>
													</div>
												</div>

												{/* Mobile Layout */}
												<div className="flex flex-col gap-2 sm:hidden">
													{/* Row 1: Date, Type, Delete */}
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<Input
																type="date"
																value={txn.date}
																onChange={(e) =>
																	handleTransactionChange(
																		txn.id,
																		"date",
																		e.target.value,
																	)
																}
																inputClassName="h-8 text-xs border-0 bg-transparent focus:ring-0 p-0 w-28 text-neutral-600 font-medium"
															/>
															<div className="flex bg-neutral-100 rounded-md p-0.5 h-8 items-center shrink-0">
																<button
																	type="button"
																	onClick={() =>
																		handleTransactionChange(
																			txn.id,
																			"type",
																			"expense",
																		)
																	}
																	className={`px-2 text-xs h-full rounded transition flex items-center justify-center ${
																		txn.type === "expense"
																			? "bg-white text-red-500 shadow-sm font-bold"
																			: "text-neutral-400 hover:text-neutral-600"
																	}`}
																>
																	支出
																</button>
																<button
																	type="button"
																	onClick={() =>
																		handleTransactionChange(
																			txn.id,
																			"type",
																			"income",
																		)
																	}
																	className={`px-2 text-xs h-full rounded transition flex items-center justify-center ${
																		txn.type === "income"
																			? "bg-white text-green-500 shadow-sm font-bold"
																			: "text-neutral-400 hover:text-neutral-600"
																	}`}
																>
																	収入
																</button>
															</div>
														</div>
														<button
															onClick={() => handleDeleteRow(txn.id)}
															className="text-red-400 hover:text-red-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition shrink-0"
															title="削除"
														>
															<i className="fas fa-minus-circle"></i>
														</button>
													</div>

													{/* Row 2: Category, Amount */}
													<div className="flex items-center gap-2">
														<div className="flex-1 min-w-0">
															<Select
																value={txn.categoryId}
																onChange={(e) =>
																	handleTransactionChange(
																		txn.id,
																		"categoryId",
																		e.target.value,
																	)
																}
																selectClassName="h-8 text-xs border-0 bg-transparent focus:ring-0 w-full py-0 pl-0 text-neutral-700 font-medium"
															>
																{getSortedCategories(txn.type).map((c) => (
																	<option key={c.id} value={c.id}>
																		{c.name}
																	</option>
																))}
															</Select>
														</div>
														<div className="w-1/3 min-w-25">
															<Input
																type="tel"
																value={txn.amount}
																onChange={(e) =>
																	handleTransactionChange(
																		txn.id,
																		"amount",
																		utils.sanitizeNumberInput(e.target.value),
																	)
																}
																placeholder="0"
																startAdornment="¥"
																inputClassName="h-8 text-sm border border-neutral-200 rounded bg-white focus:ring-2 focus:ring-indigo-500/50 w-full text-right p-1 pr-2"
															/>
														</div>
													</div>

													{/* Row 3: Memo */}
													<div>
														<Input
															type="text"
															placeholder="メモ"
															value={txn.description}
															onChange={(e) =>
																handleTransactionChange(
																	txn.id,
																	"description",
																	e.target.value,
																)
															}
															inputClassName="h-8 text-xs bg-neutral-50 border-neutral-200 rounded px-2 w-full placeholder-neutral-400"
														/>
													</div>
												</div>
											</div>
										))}
									</div>

									<div className="p-4">
										<Button
											variant="dashed"
											onClick={handleAddRow}
											className="w-full py-2 text-sm"
										>
											<i className="fas fa-plus mr-2"></i>行を追加
										</Button>
									</div>
								</div>

								{/* フッター */}
								<div className="p-4 border-t border-neutral-200 bg-white shrink-0 flex justify-end gap-3">
									<Button variant="secondary" onClick={onClose}>
										キャンセル
									</Button>
									<Button
										variant="primary"
										onClick={handleSave}
										disabled={transactions.length === 0 || !globalAccountId}
										className="px-6"
									>
										<i className="fas fa-check"></i>
										{transactions.length}件を登録
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
