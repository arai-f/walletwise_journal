import { useEffect, useMemo, useState } from "react";
import * as notification from "../services/notification.js";
import * as store from "../services/store.js";
import * as utils from "../utils.js";
import NoDataState from "./ui/NoDataState";
import Select from "./ui/Select";

/**
 * 年間の収支レポートを表示・出力するモーダルコンポーネント。
 * 指定年度の取引データを集計し、月別推移やカテゴリ別内訳を表示する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているかどうか。
 * @param {Function} props.onClose - モーダルを閉じる関数。
 * @param {object} props.luts - ルックアップテーブル（カテゴリなど）。
 * @return {JSX.Element} 収支レポートモーダルコンポーネント。
 */
const ReportModal = ({ isOpen, onClose, luts }) => {
	const currentYear = new Date().getFullYear();
	const [year, setYear] = useState(currentYear);
	const [yearData, setYearData] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [activeTab, setActiveTab] = useState("monthly");

	const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

	useEffect(() => {
		if (isOpen) {
			loadYearData(year);
		}
	}, [isOpen, year]);

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

	// キーボードショートカット (Escで閉じる)
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

	/**
	 * 指定された年の取引データを読み込む。
	 * @param {number} targetYear - 対象年。
	 */
	const loadYearData = async (targetYear) => {
		setIsLoading(true);
		try {
			const rawData = await store.fetchTransactionsByYear(targetYear);
			setYearData(rawData);
		} catch (error) {
			console.error("[ReportModal] Failed to load report data", error);
		} finally {
			setIsLoading(false);
		}
	};

	/**
	 * 年間データを集計して統計情報を算出する。
	 * 収入・支出の合計、収支、およびカテゴリ別の内訳を計算する。
	 * @return {object} 集計結果の統計情報。
	 */
	const stats = useMemo(() => {
		let income = 0;
		let expense = 0;

		// Category Analysis
		const incomeMap = new Map();
		const expenseMap = new Map();

		yearData.forEach((t) => {
			const amount = Number(t.amount);
			if (t.type === "income") {
				income += amount;
				incomeMap.set(
					t.categoryId,
					(incomeMap.get(t.categoryId) || 0) + amount
				);
			} else if (t.type === "expense") {
				expense += amount;
				expenseMap.set(
					t.categoryId,
					(expenseMap.get(t.categoryId) || 0) + amount
				);
			}
		});

		const formatCategoryStats = (map, total, defaultType) => {
			return Array.from(map.entries())
				.map(([id, val]) => {
					const cat = luts.categories.get(id);
					const type = cat?.type || defaultType;
					return {
						id,
						name: cat ? cat.name : "未分類",
						amount: val,
						percentage: total > 0 ? (val / total) * 100 : 0,
						color: type === "income" ? "bg-emerald-500" : "bg-rose-500",
						textColor: type === "income" ? "text-emerald-600" : "text-rose-600",
					};
				})
				.sort((a, b) => b.amount - a.amount);
		};

		return {
			income,
			expense,
			balance: income - expense,
			categoryBreakdown: {
				income: formatCategoryStats(incomeMap, income, "income"),
				expense: formatCategoryStats(expenseMap, expense, "expense"),
			},
		};
	}, [yearData, luts]);

	/**
	 * 年間データをCSV形式でエクスポートする。
	 * ブラウザのダウンロード機能をトリガーする。
	 */
	const handleExport = () => {
		if (yearData.length === 0) {
			notification.warn("データがありません");
			return;
		}

		const headers = ["日付", "種別", "カテゴリ", "金額", "内容", "口座"];
		const rows = yearData.map((t) => {
			const category = luts.categories.get(t.categoryId)?.name || "";
			const account = luts.accounts.get(t.accountId)?.name || "";
			const typeLabel =
				t.type === "income" ? "収入" : t.type === "expense" ? "支出" : "振替";

			return [
				utils.formatDate(t.date),
				typeLabel,
				category,
				t.amount,
				t.description,
				account,
			]
				.map((f) => `"${f}"`)
				.join(",");
		});

		const csvContent = [headers.join(","), ...rows].join("\n");
		const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
			type: "text/csv;charset=utf-8;",
		});
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `walletwise_report_${year}.csv`;
		link.click();
	};

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 modal-overlay z-50 flex justify-center items-center p-4 md:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="bg-white w-full max-h-[90vh] md:max-w-2xl rounded-2xl md:rounded-lg shadow-xl flex flex-col overflow-hidden">
				<div className="px-5 py-3 border-b border-neutral-100 shrink-0 flex justify-between items-center bg-white md:rounded-t-lg">
					<h2 className="text-lg font-bold text-neutral-900">年間レポート</h2>
					<button
						onClick={onClose}
						className="w-8 h-8 rounded-full hover:bg-neutral-100 shrink-0 flex items-center justify-center transition"
					>
						<i className="fas fa-times text-lg text-neutral-500"></i>
					</button>
				</div>

				<div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
					<div className="flex items-center gap-4">
						<Select
							value={year}
							onChange={(e) => setYear(Number(e.target.value))}
							className="w-28 bg-white border-neutral-200"
							selectClassName="text-neutral-700 py-1.5"
						>
							{yearOptions.map((y) => (
								<option key={y} value={y}>
									{y}年
								</option>
							))}
						</Select>

						{/* Tabs */}
						<div className="flex p-0.5 bg-neutral-200 rounded-lg">
							<button
								onClick={() => setActiveTab("monthly")}
								className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
									activeTab === "monthly"
										? "bg-white text-neutral-900 shadow-sm"
										: "text-neutral-500 hover:text-neutral-700"
								}`}
							>
								月別推移
							</button>
							<button
								onClick={() => setActiveTab("category")}
								className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
									activeTab === "category"
										? "bg-white text-neutral-900 shadow-sm"
										: "text-neutral-500 hover:text-neutral-700"
								}`}
							>
								カテゴリ別
							</button>
						</div>
					</div>

					<button
						onClick={handleExport}
						disabled={isLoading}
						className="px-3 py-1.5 text-xs font-bold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm flex items-center gap-2 disabled:opacity-50"
					>
						<i className="fas fa-file-csv text-white/80"></i> CSV出力
					</button>
				</div>

				<div className="grow overflow-y-auto">
					{isLoading ? (
						<div className="text-center py-10 text-neutral-500">
							読み込み中...
						</div>
					) : (
						<div className="p-5 space-y-6">
							{/* Summary Cards */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
								<div className="p-2 rounded-lg border border-neutral-100 bg-neutral-50 flex flex-col justify-center">
									<div className="text-[10px] md:text-xs text-neutral-500 mb-0.5">
										収入
									</div>
									<div className="text-lg md:text-xl font-bold text-emerald-600 tabular-nums tracking-tight truncate">
										¥{stats.income.toLocaleString()}
									</div>
								</div>
								<div className="p-2 rounded-lg border border-neutral-100 bg-neutral-50 flex flex-col justify-center">
									<div className="text-[10px] md:text-xs text-neutral-500 mb-0.5">
										支出
									</div>
									<div className="text-lg md:text-xl font-bold text-rose-600 tabular-nums tracking-tight truncate">
										¥{stats.expense.toLocaleString()}
									</div>
								</div>
								<div className="p-2 rounded-lg border border-neutral-100 bg-neutral-50 flex flex-col justify-center">
									<div className="text-[10px] md:text-xs text-neutral-500 mb-0.5">
										収支
									</div>
									<div
										className={`text-lg md:text-xl font-bold tabular-nums tracking-tight truncate ${
											stats.balance >= 0 ? "text-indigo-600" : "text-rose-600"
										}`}
									>
										¥{stats.balance.toLocaleString()}
									</div>
								</div>
							</div>

							{yearData.length > 0 ? (
								<>
									{activeTab === "monthly" && (
										<div className="border border-neutral-100 rounded-lg overflow-hidden">
											<div className="overflow-x-auto">
												<table className="w-full text-sm text-left whitespace-nowrap">
													<thead className="bg-neutral-50 text-neutral-500 font-medium border-b border-neutral-100">
														<tr>
															<th className="p-2 font-normal text-xs text-center w-12">
																月
															</th>
															<th className="p-2 font-normal text-xs text-right">
																収入
															</th>
															<th className="p-2 font-normal text-xs text-right">
																支出
															</th>
															<th className="p-2 font-normal text-xs text-right">
																差引
															</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-neutral-100">
														{Array.from({ length: 12 }, (_, i) => i + 1).map(
															(m) => {
																const monthlyTxns = yearData.filter(
																	(t) => utils.getTransactionMonth(t.date) === m
																);

																const mInc = monthlyTxns
																	.filter((t) => t.type === "income")
																	.reduce(
																		(sum, t) => sum + Number(t.amount),
																		0
																	);
																const mExp = monthlyTxns
																	.filter((t) => t.type === "expense")
																	.reduce(
																		(sum, t) => sum + Number(t.amount),
																		0
																	);

																if (mInc === 0 && mExp === 0) return null;

																return (
																	<tr key={m} className="hover:bg-neutral-50">
																		<td className="p-2 text-xs font-bold text-center text-neutral-600">
																			{m}月
																		</td>
																		<td className="p-2 text-xs md:text-sm text-right text-emerald-600 font-medium tabular-nums tracking-tight">
																			+{mInc.toLocaleString()}
																		</td>
																		<td className="p-2 text-xs md:text-sm text-right text-rose-600 font-medium tabular-nums tracking-tight">
																			-{mExp.toLocaleString()}
																		</td>
																		<td className="p-2 text-xs md:text-sm text-right font-bold text-neutral-800 tabular-nums tracking-tight">
																			{(mInc - mExp).toLocaleString()}
																		</td>
																	</tr>
																);
															}
														)}
													</tbody>
												</table>
											</div>
										</div>
									)}

									{activeTab === "category" && (
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
											{/* Income */}
											<div className="space-y-2">
												<h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
													収入詳細
												</h3>
												<div className="space-y-2">
													{stats.categoryBreakdown.income.map((cat) => (
														<div key={cat.id} className="group relative">
															<div
																className={`absolute inset-0 rounded-md opacity-10 transition-all duration-300 group-hover:opacity-20 ${cat.color}`}
																style={{ width: `${cat.percentage}%` }}
															></div>
															<div className="relative flex items-center justify-between p-1.5 rounded-md hover:bg-neutral-50 transition-colors">
																<div className="flex items-center gap-3 overflow-hidden">
																	<div
																		className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${cat.color}`}
																	></div>
																	<span className="text-sm font-medium text-neutral-700 truncate">
																		{cat.name}
																	</span>
																</div>
																<div className="flex items-center gap-3 shrink-0">
																	<span className="text-sm font-bold text-neutral-800 tabular-nums">
																		¥{cat.amount.toLocaleString()}
																	</span>
																	<span className="text-xs font-medium text-neutral-500 w-10 text-right tabular-nums">
																		{Math.round(cat.percentage)}%
																	</span>
																</div>
															</div>
														</div>
													))}
													{stats.categoryBreakdown.income.length === 0 && (
														<p className="text-sm text-neutral-400">
															データがありません
														</p>
													)}
												</div>
											</div>

											{/* Expenses */}
											<div className="space-y-2">
												<h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
													支出詳細
												</h3>
												<div className="space-y-2">
													{stats.categoryBreakdown.expense.map((cat) => (
														<div key={cat.id} className="group relative">
															<div
																className={`absolute inset-0 rounded-md opacity-10 transition-all duration-300 group-hover:opacity-20 ${cat.color}`}
																style={{ width: `${cat.percentage}%` }}
															></div>
															<div className="relative flex items-center justify-between p-1.5 rounded-md hover:bg-neutral-50 transition-colors">
																<div className="flex items-center gap-3 overflow-hidden">
																	<div
																		className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${cat.color}`}
																	></div>
																	<span className="text-sm font-medium text-neutral-700 truncate">
																		{cat.name}
																	</span>
																</div>
																<div className="flex items-center gap-3 shrink-0">
																	<span className="text-sm font-bold text-neutral-800 tabular-nums">
																		¥{cat.amount.toLocaleString()}
																	</span>
																	<span className="text-xs font-medium text-neutral-500 w-10 text-right tabular-nums">
																		{Math.round(cat.percentage)}%
																	</span>
																</div>
															</div>
														</div>
													))}
													{stats.categoryBreakdown.expense.length === 0 && (
														<p className="text-sm text-neutral-400">
															データがありません
														</p>
													)}
												</div>
											</div>
										</div>
									)}
								</>
							) : (
								<NoDataState icon="fas fa-inbox" />
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default ReportModal;
