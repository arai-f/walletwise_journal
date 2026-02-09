import {
	faBolt,
	faCamera,
	faCopy,
	faExchangeAlt,
	faImage,
	faMinusCircle,
	faPlusCircle,
	faSpinner,
	faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef } from "react";
import { useTransactionForm } from "../hooks/useTransactionForm.js";
import * as utils from "../utils.js";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";

/**
 * トランザクション（収入・支出・振替）の作成・編集を行うモーダルコンポーネント。
 * 新規作成、既存取引の編集、複製、および削除の機能を提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているかどうか。
 * @param {Function} props.onClose - モーダルを閉じる関数。
 * @param {object} [props.transaction] - 編集対象の取引データ（編集モード時に提供）。
 * @param {object} [props.prefillData] - 新規作成時の初期入力データ。
 * @param {Function} props.onSave - 保存時のコールバック。
 * @param {Function} props.onDelete - 削除時のコールバック。
 * @param {Function} [props.onScan] - レシートスキャン用のコールバック関数。
 * @param {object} props.luts - ルックアップテーブル（カテゴリ、アカウント）。
 * @returns {JSX.Element} トランザクションモーダルコンポーネント。
 */
export default function TransactionModal({
	isOpen,
	onClose,
	transaction,
	prefillData,
	onSave,
	onDelete,
	onScan,
	luts,
}) {
	const {
		formData,
		mode,
		isSubmitting,
		handleChange,
		handleAmountChange,
		handleTypeChange,
		handleSubmit,
		handleDelete,
		handleCopy,
		getSortedAccounts,
		getSortedCategories,
	} = useTransactionForm({
		isOpen,
		transaction,
		prefillData,
		onSave,
		onDelete,
		luts,
	});

	const modalRef = useRef(null);
	const fileCameraRef = useRef(null);
	const fileUploadRef = useRef(null);

	// キーボードショートカット (Escで閉じる)。
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (isOpen && e.key === "Escape") {
				onClose();
			}
		};

		if (isOpen) {
			window.addEventListener("keydown", handleKeyDown);
		}

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose]);

	// フォーカス管理（スクロール制御）。
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

	/**
	 * スキャン用の画像が選択された場合の処理。
	 */
	const handleScanFileSelect = (e) => {
		const file = e.target.files[0];
		if (file && onScan) {
			onScan(file);
		}
		e.target.value = "";
	};

	if (!isOpen) return null;

	const accounts = getSortedAccounts();
	const categories = getSortedCategories(formData.type);

	const isBalanceAdjustment =
		mode === "edit" &&
		formData.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID;

	// タイトルの決定。
	let title = "取引を追加";
	if (mode === "edit") {
		title = isBalanceAdjustment ? "残高調整（表示のみ）" : "取引を編集";
	} else if (
		mode === "prefill" ||
		mode === "copy" ||
		(mode === "create" && !transaction && prefillData)
	) {
		const isBillingPayment =
			formData.type === "transfer" &&
			formData.description &&
			formData.description.includes("支払い");
		title = isBillingPayment ? "振替の確認・登録" : "取引を追加 (コピー)";
	}

	// セグメントコントロールのスタイル。
	const getTypeBtnClass = (type) => {
		const isActive = formData.type === type;
		// アクティブ状態に応じたピル形状と背景色。
		const base =
			"flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-2 relative z-10";

		if (!isActive) {
			return `${base} text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50`;
		}

		// アクティブ時のスタイル - ソリッドな背景色。
		if (type === "expense")
			return `${base} bg-red-500 text-white shadow-lg shadow-red-500/30 transform scale-[1.02]`;
		if (type === "income")
			return `${base} bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transform scale-[1.02]`;
		if (type === "transfer")
			return `${base} bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transform scale-[1.02]`;

		return base;
	};

	return (
		<div
			className="fixed inset-0 modal-overlay z-50 flex justify-center items-center p-4 "
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-full overflow-y-auto transform transition-all border border-neutral-200"
				role="dialog"
				aria-modal="true"
				ref={modalRef}
			>
				<form className="p-4 md:p-6" onSubmit={handleSubmit}>
					<div className="flex justify-between items-center mb-6">
						<h2 className="text-xl font-bold text-neutral-900">{title}</h2>
						<button
							type="button"
							onClick={onClose}
							className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition"
							aria-label="閉じる"
						>
							<FontAwesomeIcon icon={faTimes} className="text-xl" />
						</button>
					</div>

					<div className="space-y-3 md:space-y-5">
						{!isBalanceAdjustment && (
							<div className="bg-neutral-100 p-1.5 rounded-full flex border border-neutral-100/50 relative">
								<button
									type="button"
									onClick={() => handleTypeChange("expense")}
									className={getTypeBtnClass("expense")}
								>
									<FontAwesomeIcon
										icon={faMinusCircle}
										className={
											formData.type === "expense"
												? "text-white/90"
												: "text-neutral-400"
										}
									/>
									<span>支出</span>
								</button>
								<button
									type="button"
									onClick={() => handleTypeChange("income")}
									className={getTypeBtnClass("income")}
								>
									<FontAwesomeIcon
										icon={faPlusCircle}
										className={
											formData.type === "income"
												? "text-white/90"
												: "text-neutral-400"
										}
									/>
									<span>収入</span>
								</button>
								<button
									type="button"
									onClick={() => handleTypeChange("transfer")}
									className={getTypeBtnClass("transfer")}
								>
									<FontAwesomeIcon
										icon={faExchangeAlt}
										className={
											formData.type === "transfer"
												? "text-white/90"
												: "text-neutral-400"
										}
									/>
									<span>振替</span>
								</button>
							</div>
						)}

						{!isBalanceAdjustment && onScan && mode === "create" && (
							<>
								<div className="grid grid-cols-2 gap-3 mb-2">
									<input
										type="file"
										accept="image/*"
										capture="environment"
										className="hidden"
										ref={fileCameraRef}
										onChange={handleScanFileSelect}
										name="cameraInput"
										aria-label="カメラで撮影"
									/>
									<input
										type="file"
										accept="image/*"
										className="hidden"
										ref={fileUploadRef}
										onChange={handleScanFileSelect}
										name="fileInput"
										aria-label="画像を選択"
									/>

									<button
										type="button"
										onClick={() => fileCameraRef.current.click()}
										className="flex flex-col items-center justify-center p-3 gap-2 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50 hover:bg-neutral-100 hover:border-indigo-400 hover:text-indigo-600 transition group"
									>
										<div className="w-8 h-8 rounded-full bg-white grid place-items-center shadow-sm text-indigo-500 group-hover:text-white group-hover:bg-indigo-500 transition-colors">
											<FontAwesomeIcon
												icon={faCamera}
												className="text-base leading-none"
											/>
										</div>
										<span className="text-xs font-bold text-neutral-600 group-hover:text-indigo-700">
											読み取り
										</span>
									</button>

									<button
										type="button"
										onClick={() => fileUploadRef.current.click()}
										className="flex flex-col items-center justify-center p-3 gap-2 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50 hover:bg-neutral-100 hover:border-emerald-400 hover:text-emerald-600 transition group"
									>
										<div className="w-8 h-8 rounded-full bg-white grid place-items-center shadow-sm text-emerald-500 group-hover:text-white group-hover:bg-emerald-500 transition-colors">
											<FontAwesomeIcon
												icon={faImage}
												className="text-base leading-none"
											/>
										</div>
										<span className="text-xs font-bold text-neutral-600 group-hover:text-emerald-700">
											画像選択
										</span>
									</button>
								</div>
								<div className="flex justify-center items-center gap-1.5 mb-2 opacity-70">
									<span className="text-[10px] text-neutral-400 font-medium">
										Powered by
									</span>
									<div className="flex items-center gap-1 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent text-[10px] font-bold">
										<FontAwesomeIcon
											icon={faBolt}
											className="text-[10px] text-purple-500"
										/>
										Gemini 2.5 Flash
									</div>
								</div>
							</>
						)}

						<div className="grid grid-cols-2 gap-3 md:gap-4">
							<div>
								<label
									htmlFor="transaction-date"
									className="block text-xs font-bold text-neutral-500 mb-1"
								>
									日付
								</label>
								<Input
									id="transaction-date"
									type="date"
									name="date"
									value={formData.date}
									onChange={handleChange}
									required
									disabled={isBalanceAdjustment}
									autoComplete="off"
								/>
							</div>
							<div>
								<label
									htmlFor="transaction-amount"
									className="block text-xs font-bold text-neutral-500 mb-1"
								>
									金額
								</label>
								<Input
									id="transaction-amount"
									type="tel"
									inputMode="decimal"
									name="amount"
									value={formData.amount}
									onChange={handleAmountChange}
									placeholder="0"
									required
									disabled={isBalanceAdjustment}
									startAdornment="¥"
									autoComplete="off"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3 md:gap-4">
							{formData.type !== "transfer" ? (
								<>
									<div>
										<label
											htmlFor="transaction-account"
											className="block text-xs font-bold text-neutral-500 mb-1"
										>
											支払方法
										</label>
										<Select
											id="transaction-account"
											name="accountId"
											value={formData.accountId}
											onChange={handleChange}
											disabled={isBalanceAdjustment}
										>
											{accounts.map((acc) => (
												<option key={acc.id} value={acc.id}>
													{acc.name}
												</option>
											))}
										</Select>
									</div>
									<div>
										<label
											htmlFor="transaction-category"
											className="block text-xs font-bold text-neutral-500 mb-1"
										>
											カテゴリ
										</label>
										<Select
											id="transaction-category"
											name="categoryId"
											value={formData.categoryId}
											onChange={handleChange}
											disabled={isBalanceAdjustment}
										>
											{categories.length === 0 && (
												<option value="" disabled>
													カテゴリなし
												</option>
											)}
											{categories.map((cat) => (
												<option key={cat.id} value={cat.id}>
													{cat.name}
												</option>
											))}
										</Select>
									</div>
								</>
							) : (
								<>
									<div>
										<label
											htmlFor="transaction-from-account"
											className="block text-xs font-bold text-neutral-500 mb-1"
										>
											振替元
										</label>
										<Select
											id="transaction-from-account"
											name="fromAccountId"
											value={formData.fromAccountId}
											onChange={handleChange}
											disabled={isBalanceAdjustment}
										>
											{accounts.map((acc) => (
												<option key={acc.id} value={acc.id}>
													{acc.name}
												</option>
											))}
										</Select>
									</div>
									<div>
										<label
											htmlFor="transaction-to-account"
											className="block text-xs font-bold text-neutral-500 mb-1"
										>
											振替先
										</label>
										<Select
											id="transaction-to-account"
											name="toAccountId"
											value={formData.toAccountId}
											onChange={handleChange}
											disabled={isBalanceAdjustment}
										>
											{accounts.map((acc) => (
												<option key={acc.id} value={acc.id}>
													{acc.name}
												</option>
											))}
										</Select>
									</div>
								</>
							)}
						</div>

						<div>
							<label
								htmlFor="transaction-description"
								className="block text-xs font-bold text-neutral-500 mb-1"
							>
								詳細 (任意)
							</label>
							<Input
								id="transaction-description"
								type="text"
								name="description"
								value={formData.description}
								onChange={handleChange}
								placeholder="店名や内容など"
								disabled={isBalanceAdjustment}
								autoComplete="on"
							/>
						</div>
						<div>
							<label
								htmlFor="transaction-memo"
								className="block text-xs font-bold text-neutral-500 mb-1"
							>
								メモ (任意)
							</label>
							<Input
								id="transaction-memo"
								type="text"
								name="memo"
								value={formData.memo}
								onChange={handleChange}
								placeholder="メモやタグなど"
								disabled={isBalanceAdjustment}
								autoComplete="on"
							/>
						</div>
					</div>

					<div className="flex justify-end gap-3 pt-6 mt-8 border-t border-neutral-100">
						{mode === "edit" && !isBalanceAdjustment && (
							<>
								<Button variant="danger-ghost" onClick={handleDelete}>
									削除
								</Button>
								<Button variant="secondary" onClick={handleCopy}>
									<FontAwesomeIcon icon={faCopy} />
									複製
								</Button>
							</>
						)}

						{!isBalanceAdjustment && (
							<Button
								type="submit"
								variant="primary"
								disabled={isSubmitting}
								className="px-6 py-2 shadow-md hover:shadow-lg transform active:scale-95"
							>
								{isSubmitting && (
									<FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
								)}
								保存
							</Button>
						)}
					</div>
				</form>
			</div>
		</div>
	);
}
