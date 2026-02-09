import {
	faBolt,
	faCheck,
	faChevronDown,
	faChevronUp,
	faCompress,
	faExclamationCircle,
	faImage,
	faList,
	faMinus,
	faPlus,
	faTimes,
	faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import { useImageViewer } from "../hooks/useImageViewer.js";
import { useScanReceipt } from "../hooks/useScanReceipt.js";
import * as utils from "../utils.js";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";

/**
 * レシート画像をスキャンし、AI解析して取引データとして登録するモーダルコンポーネント。
 * 画像の拡大縮小・移動などのビューア機能と、解析結果の編集機能を提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているかどうか。
 * @param {Function} props.onClose - モーダルを閉じる関数。
 * @param {object} props.luts - ルックアップテーブル（カテゴリ、アカウント）。
 * @param {object} [props.scanSettings] - スキャン設定。
 * @param {Function} props.onSave - 保存時のコールバック関数。
 * @param {File} [props.initialImageFile] - 初期表示する画像ファイル。
 * @returns {JSX.Element|null} スキャンモーダルコンポーネント。
 */
export default function ScanModal({
	isOpen,
	onClose,
	luts,
	scanSettings,
	onSave,
	initialImageFile,
}) {
	const [activeTab, setActiveTab] = useState("list");
	const [imageFile, setImageFile] = useState(null);

	const imageContainerRef = useRef(null);
	const modalRef = useRef(null);

	// カスタムフックの利用
	const {
		step,
		setStep,
		isAnalyzing,
		setIsAnalyzing,
		isAnalyzingRef,
		transactions,
		setTransactions,
		globalAccountId,
		setGlobalAccountId,
		expandedRowId,
		setExpandedRowId,
		getSortedAccounts,
		getSortedCategories,
		handleAnalysisStart,
		handleAddRow,
		handleTransactionChange,
		handleDeleteRow,
		handleSaveTransactions,
	} = useScanReceipt({ isOpen, luts, scanSettings, onSave, onClose });

	const viewer = useImageViewer();

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

	useEffect(() => {
		if (isOpen) {
			setTransactions([]);
			if (initialImageFile) {
				setStep("analyzing");
				setImageFile(initialImageFile);
				handleAnalysisStart(initialImageFile);
			} else {
				onClose();
			}
		}
	}, [isOpen, initialImageFile]);

	const handleCancelAnalysis = () => {
		setIsAnalyzing(false);
		isAnalyzingRef.current = false;
		if (window.confirm("解析を中止しますか？")) onClose();
		else {
			setIsAnalyzing(true);
			isAnalyzingRef.current = true;
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
				className={`bg-white rounded-2xl shadow-xl border border-neutral-200 w-full transition-all duration-300 overflow-hidden flex flex-col ${step === "confirm" ? "max-w-4xl h-[85vh]" : "max-w-md min-h-100"}`}
				ref={modalRef}
			>
				{/* ヘッダー */}
				{step !== "analyzing" && (
					<div className="flex justify-between items-center p-4 border-b border-neutral-100 shrink-0 bg-white">
						<h2 className="text-lg font-bold text-neutral-900">
							{step === "confirm" && "スキャン結果の確認"}
						</h2>
						<button
							onClick={() => !isAnalyzing && onClose()}
							disabled={isAnalyzing}
							className={`w-8 h-8 flex items-center justify-center rounded-full transition ${isAnalyzing ? "text-neutral-300 cursor-not-allowed" : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"}`}
						>
							<FontAwesomeIcon icon={faTimes} className="text-xl" />
						</button>
					</div>
				)}

				<div
					className={`grow bg-neutral-50 relative flex flex-col ${step === "confirm" ? "overflow-hidden" : "overflow-y-auto"}`}
				>
					{/* STEP 1: 解析中 */}
					{step === "analyzing" && (
						<div className="p-6 text-center h-full flex flex-col items-center justify-center grow bg-white">
							<div className="relative w-14 h-14 mb-4">
								<div className="absolute inset-0 border-[3px] border-neutral-100 rounded-full"></div>
								<div className="absolute inset-0 border-[3px] border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
								<div className="absolute inset-0 flex items-center justify-center">
									<FontAwesomeIcon
										icon={faBolt}
										className="text-indigo-500 text-lg animate-pulse"
									/>
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

					{/* STEP 2: 確認 */}
					{step === "confirm" && (
						<div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
							{/* モバイル用タブ */}
							<div className="lg:hidden p-2 border-b border-neutral-200 bg-white grid grid-cols-2 gap-2 shrink-0 z-20">
								<button
									className={`py-2 text-sm font-bold rounded-lg transition flex items-center justify-center ${activeTab === "list" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-100"}`}
									onClick={() => setActiveTab("list")}
								>
									<FontAwesomeIcon icon={faList} className="mr-2 text-xs" />
									読み取り結果
								</button>
								<button
									className={`py-2 text-sm font-bold rounded-lg transition flex items-center justify-center ${activeTab === "image" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-100"}`}
									onClick={() => setActiveTab("image")}
								>
									<FontAwesomeIcon icon={faImage} className="mr-2 text-xs" />
									元画像
								</button>
							</div>

							{/* 左カラム: 画像ビューア */}
							<div
								className={`lg:w-1/2 bg-neutral-900 items-center justify-center relative overflow-hidden cursor-move select-none shrink-0 ${activeTab === "image" ? "flex flex-1 h-full" : "hidden lg:flex lg:h-full"}`}
								ref={imageContainerRef}
								onWheel={(e) => step === "confirm" && viewer.handleWheel(e)}
								onMouseDown={viewer.handleMouseDown}
								onMouseMove={viewer.handleMouseMove}
								onMouseUp={viewer.handleMouseUp}
								onMouseLeave={viewer.handleMouseUp}
							>
								<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-800/80 backdrop-blur-sm p-2 rounded-lg z-10 shadow-lg border border-neutral-700">
									<button
										onClick={() => viewer.handleZoom(-0.25)}
										className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded transition"
									>
										<FontAwesomeIcon icon={faMinus} />
									</button>
									<span className="text-xs text-neutral-300 w-12 text-center font-mono">
										{Math.round(viewer.viewState.scale * 100)}%
									</span>
									<button
										onClick={() => viewer.handleZoom(0.25)}
										className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded transition"
									>
										<FontAwesomeIcon icon={faPlus} />
									</button>
									<div className="w-px h-6 bg-neutral-600 mx-1"></div>
									<button
										onClick={viewer.handleResetView}
										className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded transition"
									>
										<FontAwesomeIcon icon={faCompress} />
									</button>
								</div>
								{imageFile && (
									<img
										src={URL.createObjectURL(imageFile)}
										alt="Scan Target"
										className="max-w-none transition-transform duration-75 ease-out"
										style={{
											transform: `translate(${viewer.viewState.x}px, ${viewer.viewState.y}px) scale(${viewer.viewState.scale})`,
											maxHeight: "90%",
											maxWidth: "90%",
										}}
										draggable={false}
									/>
								)}
							</div>

							{/* 右カラム: 編集リスト */}
							<div
								className={`lg:w-1/2 flex-col flex-1 bg-white border-l border-neutral-200 min-h-0 ${activeTab === "list" ? "flex" : "hidden lg:flex"}`}
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
											<FontAwesomeIcon
												icon={faExclamationCircle}
												className="mr-1"
											/>
											口座が登録されていません。
										</div>
									)}
								</div>

								<div className="grow overflow-y-auto bg-white">
									{transactions.length === 0 && (
										<div className="text-center py-8 px-4 mx-4 mt-4 bg-red-50 rounded-xl border border-red-100 text-red-600 animate-pulse">
											<div className="mb-2 text-2xl">
												<FontAwesomeIcon icon={faExclamationCircle} />
											</div>
											<p className="text-sm font-bold mb-1">明細がありません</p>
											<p className="text-xs opacity-80">
												下のボタンから手動で追加してください
											</p>
										</div>
									)}

									{/* リスト表示: カードスタイルに変更 */}
									<div className="flex flex-col gap-3 p-3 pb-4">
										{transactions.map((txn) => {
											const isExpanded = expandedRowId === txn.id;
											const cats = getSortedCategories(txn.type);
											const catName =
												cats.find((c) => c.id === txn.categoryId)?.name ||
												"カテゴリ未選択";

											return (
												<div
													key={txn.id}
													className={`group transition-all duration-300 rounded-xl border ${
														isExpanded
															? "bg-white border-indigo-300 shadow-lg ring-1 ring-indigo-500/20 z-10 relative"
															: "bg-white border-neutral-100 shadow-sm hover:border-neutral-300 hover:shadow-md"
													}`}
												>
													{/* Header (概要) - 展開時は非表示 */}
													{!isExpanded && (
														<div
															className="p-4 cursor-pointer"
															onClick={() => setExpandedRowId(txn.id)}
														>
															<div className="flex items-center gap-3">
																{/* 内容 */}
																<div className="flex-1 min-w-0">
																	<div className="flex justify-between items-baseline mb-1">
																		<span className="font-bold text-neutral-800 truncate mr-2 text-sm">
																			{txn.description || "内容未入力"}
																		</span>
																		<span
																			className={`font-bold whitespace-nowrap text-sm ${
																				txn.type === "income"
																					? "text-emerald-600"
																					: "text-rose-600"
																			}`}
																		>
																			¥{Number(txn.amount).toLocaleString()}
																		</span>
																	</div>
																	<div className="flex items-center gap-2 text-xs text-neutral-500">
																		<span className="font-mono">
																			{txn.date
																				? txn.date
																						.substring(5)
																						.replace("-", "/")
																				: "--/--"}
																		</span>
																		<span className="w-px h-3 bg-neutral-300"></span>
																		<span className="truncate">{catName}</span>
																	</div>
																</div>

																{/* 展開アイコン */}
																<div className="text-neutral-300 group-hover:text-neutral-500 transition-colors">
																	<FontAwesomeIcon icon={faChevronDown} />
																</div>
															</div>
														</div>
													)}

													{/* Body (詳細フォーム) - 展開時のみ表示 */}
													{isExpanded && (
														<div className="p-4 pt-2 animate-fadeIn">
															{/* ヘッダー部分（閉じるボタン） */}
															<div className="flex justify-between items-center mb-4 border-b border-indigo-100 pb-2">
																<span className="text-xs font-bold text-indigo-500">
																	詳細を編集
																</span>
																<button
																	onClick={() => setExpandedRowId(null)}
																	className="w-6 h-6 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 transition"
																>
																	<FontAwesomeIcon
																		icon={faChevronUp}
																		className="text-xs"
																	/>
																</button>
															</div>

															<div className="flex flex-col gap-3">
																{/* 1. 日付 & タイプ */}
																<div className="flex gap-2">
																	<div className="w-1/2">
																		<label className="block text-[10px] font-bold text-neutral-400 mb-1">
																			日付
																		</label>
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
																			// border-neutral-200 を使用して標準的な見た目に
																			inputClassName="h-10 text-sm border border-neutral-200 bg-white rounded-lg px-2 w-full focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
																			autoComplete="off"
																		/>
																	</div>
																	<div className="w-1/2">
																		<label className="block text-[10px] font-bold text-neutral-400 mb-1">
																			収支
																		</label>
																		<div className="flex bg-neutral-100 rounded-lg p-1 h-10 border border-neutral-200 w-full">
																			<button
																				type="button"
																				onClick={() =>
																					handleTransactionChange(
																						txn.id,
																						"type",
																						"expense",
																					)
																				}
																				className={`flex-1 px-1 text-xs rounded-md transition-all font-bold flex items-center justify-center ${
																					txn.type === "expense"
																						? "bg-white text-rose-600 shadow-sm"
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
																				className={`flex-1 px-1 text-xs rounded-md transition-all font-bold flex items-center justify-center ${
																					txn.type === "income"
																						? "bg-white text-emerald-600 shadow-sm"
																						: "text-neutral-400 hover:text-neutral-600"
																				}`}
																			>
																				収入
																			</button>
																		</div>
																	</div>
																</div>

																{/* 2. カテゴリ & 金額 */}
																<div className="flex gap-2">
																	<div className="w-1/2">
																		<label className="block text-[10px] font-bold text-neutral-400 mb-1">
																			カテゴリ
																		</label>
																		<Select
																			value={txn.categoryId}
																			onChange={(e) =>
																				handleTransactionChange(
																					txn.id,
																					"categoryId",
																					e.target.value,
																				)
																			}
																			selectClassName="h-10 text-sm border border-neutral-200 bg-white rounded-lg w-full px-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 truncate"
																		>
																			{getSortedCategories(txn.type).map(
																				(c) => (
																					<option key={c.id} value={c.id}>
																						{c.name}
																					</option>
																				),
																			)}
																		</Select>
																	</div>
																	<div className="w-1/2">
																		<label className="block text-[10px] font-bold text-neutral-400 mb-1">
																			金額
																		</label>
																		<Input
																			type="tel"
																			value={txn.amount}
																			onChange={(e) =>
																				handleTransactionChange(
																					txn.id,
																					"amount",
																					utils.sanitizeNumberInput(
																						e.target.value,
																					),
																				)
																			}
																			placeholder="0"
																			startAdornment="¥"
																			inputClassName="h-10 text-lg border border-neutral-200 bg-white rounded-lg w-full text-right font-medium pr-3 pl-6 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
																			autoComplete="off"
																		/>
																	</div>
																</div>

																{/* 3. 内容 & 削除 */}
																<div className="flex gap-2 items-end">
																	<div className="grow">
																		<label className="block text-[10px] font-bold text-neutral-400 mb-1">
																			内容 (任意)
																		</label>
																		<Input
																			type="text"
																			placeholder="内容・メモ"
																			value={txn.description}
																			onChange={(e) =>
																				handleTransactionChange(
																					txn.id,
																					"description",
																					e.target.value,
																				)
																			}
																			inputClassName="h-10 text-sm border border-neutral-200 bg-white rounded-lg px-3 w-full placeholder-neutral-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
																			autoComplete="on"
																		/>
																	</div>
																	<button
																		onClick={() => handleDeleteRow(txn.id)}
																		className="w-10 h-10 shrink-0 flex items-center justify-center text-rose-500 hover:bg-rose-100 rounded-full transition-colors"
																		title="削除"
																	>
																		<FontAwesomeIcon icon={faTrashAlt} />
																	</button>
																</div>
															</div>
														</div>
													)}
												</div>
											);
										})}
									</div>

									<div className="px-3 pb-20">
										<Button
											variant="dashed"
											onClick={handleAddRow}
											className="w-full py-3 text-sm font-bold border-2 border-dashed border-neutral-200 text-neutral-400 rounded-xl hover:border-neutral-300 hover:text-neutral-500 hover:bg-neutral-50"
										>
											<FontAwesomeIcon icon={faPlus} className="mr-2" />
											行を追加
										</Button>
									</div>
								</div>

								{/* フッター */}
								<div className="p-4 border-t border-neutral-200 bg-white shrink-0 flex justify-end gap-3 items-center">
									<div className="flex gap-3">
										<Button
											variant="secondary"
											onClick={onClose}
											className="px-4"
										>
											キャンセル
										</Button>
										<Button
											variant="primary"
											onClick={handleSaveTransactions}
											disabled={!globalAccountId}
											className="px-6 shadow-md"
										>
											<FontAwesomeIcon icon={faCheck} className="mr-1" />
											登録
										</Button>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
