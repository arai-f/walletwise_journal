import { useEffect, useRef, useState } from "react";
import * as notification from "../entries/notificationManager.jsx";
import { scanReceipt } from "../services/geminiScanner.js";
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
}) {
	const [step, setStep] = useState("start"); // start, analyzing, confirm
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
			[...luts.accounts.values()].filter((a) => !a.isDeleted)
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
				(c) => !c.isDeleted && c.type === type
			)
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
				text.includes(c.name.toLowerCase())
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
			// トランザクションはオープン時にリセットされるためここでは不要
		}
	}, [isOpen]);

	useEffect(() => {
		if (isOpen) {
			setStep("start");
			setTransactions([]);
			setImageFile(null);
			setScanResult(null);
			setIsAnalyzing(false);
			isAnalyzingRef.current = false;

			// スクロールを無効化
			utils.dom.scrollLock.enable();
		}

		return () => {
			if (isOpen) {
				utils.dom.scrollLock.disable();
			}
		};
	}, [isOpen]);

	// ESCキーで閉じる（解析中でない場合のみ）
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
			5
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
		setStep("analyzing");
		setIsAnalyzing(true);
		isAnalyzingRef.current = true;

		try {
			const result = await scanReceipt(file, scanSettings || {}, luts || {});

			if (!result) throw new Error("Result is empty or null");

			// 結果をトランザクション状態に処理
			const rawItems = Array.isArray(result) ? result : [result];
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
			e.target.value = "";
		}
	};

	/**
	 * 解析処理をキャンセルし、開始画面に戻る。
	 */
	const handleCancelAnalysis = () => {
		setIsAnalyzing(false);
		isAnalyzingRef.current = false;
		setStep("start");
		setImageFile(null);
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
			})
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
			notification.warn("保存する取引がありません");
			return;
		}

		for (const t of transactions) {
			if (!t.date || !t.amount) {
				notification.warn("日付と金額は必須です");
				return;
			}
		}

		if (!globalAccountId) {
			notification.warn("支払元口座を選択してください");
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
				<div className="flex justify-between items-center p-4 border-b border-neutral-100 shrink-0 bg-white">
					<h2 className="text-lg font-bold text-neutral-900">
						{step === "start" && "AIで画像を読み取る"}
						{step === "analyzing" && "解析中..."}
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
						<div className="p-12 text-center h-full flex flex-col items-center justify-center grow bg-white">
							<div className="relative w-20 h-20 mb-6">
								<div className="absolute inset-0 border-4 border-neutral-100 rounded-full"></div>
								<div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
								<div className="absolute inset-0 flex items-center justify-center">
									<i className="fas fa-pen text-indigo-500 text-2xl animate-pulse"></i>
								</div>
							</div>
							<h3 className="text-xl font-bold text-neutral-800 mb-2">
								解析しています...
							</h3>
							<p className="text-neutral-500 text-sm mb-6">
								AIがレシートの内容を読み取っています。
								<br />
								そのままお待ちください。
							</p>

							<button
								onClick={handleCancelAnalysis}
								className="text-neutral-500 hover:text-neutral-700 text-sm font-bold underline decoration-neutral-300 underline-offset-4"
							>
								キャンセル
							</button>
						</div>
					)}

					{/* ステップ: 確認 */}
					{step === "confirm" && (
						<div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
							{/* 画像ビューアカラム */}
							<div
								className="lg:w-1/2 bg-neutral-900 flex items-center justify-center min-h-75 lg:h-full relative overflow-hidden cursor-move select-none shrink-0"
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
							<div className="lg:w-1/2 flex flex-col flex-1 bg-white border-l border-neutral-200 min-h-0">
								{/* グローバル設定 */}
								<div className="p-4 bg-neutral-50 border-b border-neutral-200 shrink-0">
									{accounts.length > 0 ? (
										<Select
											label="支払元口座 (一括設定)"
											value={globalAccountId}
											onChange={(e) => setGlobalAccountId(e.target.value)}
										>
											{accounts.map((acc) => (
												<option key={acc.id} value={acc.id}>
													{acc.name}
												</option>
											))}
										</Select>
									) : (
										<div className="text-sm text-red-500 p-2 border border-red-200 rounded-lg bg-red-50">
											<i className="fas fa-exclamation-circle mr-1"></i>
											口座が登録されていません。設定画面から口座を追加してください。
										</div>
									)}
								</div>

								{/* リスト */}
								<div className="grow overflow-y-auto p-4 space-y-4">
									{transactions.length === 0 && (
										<div className="text-center py-10 text-neutral-400">
											<p className="text-sm mb-2">明細が見つかりませんでした</p>
											<p className="text-xs">手動で行を追加してください</p>
										</div>
									)}

									{transactions.map((txn, idx) => (
										<div
											key={txn.id}
											className="bg-white border border-neutral-200 rounded-lg shadow-sm relative group hover:border-indigo-300 transition pr-10 pl-3 py-3"
										>
											<button
												onClick={() => handleDeleteRow(txn.id)}
												className="absolute top-3 right-2 text-neutral-300 hover:text-red-500 p-2 transition z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100"
											>
												<i className="fas fa-times"></i>
											</button>

											<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
												<div>
													<label className="text-[10px] text-neutral-500 font-medium block mb-0.5">
														日付
													</label>
													<Input
														type="date"
														value={txn.date}
														onChange={(e) =>
															handleTransactionChange(
																txn.id,
																"date",
																e.target.value
															)
														}
														inputClassName="h-9 text-sm px-2 min-w-0"
													/>
												</div>
												<div>
													<label className="text-[10px] text-neutral-500 font-medium block mb-0.5">
														金額
													</label>
													<Input
														type="tel"
														value={txn.amount}
														onChange={(e) =>
															handleTransactionChange(
																txn.id,
																"amount",
																utils.sanitizeNumberInput(e.target.value)
															)
														}
														startAdornment="¥"
														inputClassName="h-9 text-sm pl-7 min-w-0"
													/>
												</div>
											</div>

											<div className="grid grid-cols-2 gap-2 mb-2">
												<div>
													<label className="text-[10px] text-neutral-500 font-medium block mb-0.5">
														種別
													</label>
													<div className="flex bg-neutral-100 rounded-lg p-0.5 border border-neutral-200 h-9 items-center">
														<button
															type="button"
															onClick={() =>
																handleTransactionChange(
																	txn.id,
																	"type",
																	"expense"
																)
															}
															className={`flex-1 text-[10px] h-full rounded-md font-medium transition flex items-center justify-center ${
																txn.type === "expense"
																	? "bg-white text-red-500 shadow-sm"
																	: "text-neutral-500"
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
																	"income"
																)
															}
															className={`flex-1 text-[10px] h-full rounded-md font-medium transition flex items-center justify-center ${
																txn.type === "income"
																	? "bg-white text-green-500 shadow-sm"
																	: "text-neutral-500"
															}`}
														>
															収入
														</button>
													</div>
												</div>
												<div>
													<label className="text-[10px] text-neutral-500 font-medium block mb-0.5">
														カテゴリ
													</label>
													<Select
														value={txn.categoryId}
														onChange={(e) =>
															handleTransactionChange(
																txn.id,
																"categoryId",
																e.target.value
															)
														}
														selectClassName="h-9 text-xs"
													>
														{getSortedCategories(txn.type).map((c) => (
															<option key={c.id} value={c.id}>
																{c.name}
															</option>
														))}
													</Select>
												</div>
											</div>

											<div>
												<Input
													type="text"
													placeholder="詳細 (任意)"
													value={txn.description}
													onChange={(e) =>
														handleTransactionChange(
															txn.id,
															"description",
															e.target.value
														)
													}
													inputClassName="h-9 text-sm placeholder-neutral-400"
												/>
											</div>
										</div>
									))}

									<Button
										variant="dashed"
										onClick={handleAddRow}
										className="w-full py-3"
									>
										<i className="fas fa-plus mr-2"></i>行を追加
									</Button>
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
