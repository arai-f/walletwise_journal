import { useEffect, useMemo, useState } from "react";
import * as notification from "../entries/notificationManager.jsx";
import * as store from "../services/store.js";
import * as utils from "../utils.js";
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

		const formatCategoryStats = (map, total) => {
			return Array.from(map.entries())
				.map(([id, val]) => {
					const cat = luts.categories.get(id);
					return {
						id,
						name: cat ? cat.name : "未分類",
						amount: val,
						percentage: total > 0 ? (val / total) * 100 : 0,
						color: cat?.type === "income" ? "bg-emerald-500" : "bg-rose-500",
						textColor:
							cat?.type === "income" ? "text-emerald-600" : "text-rose-600",
					};
				})
				.sort((a, b) => b.amount - a.amount);
		};

		return {
			income,
			expense,
			balance: income - expense,
			categoryBreakdown: {
				income: formatCategoryStats(incomeMap, income),
				expense: formatCategoryStats(expenseMap, expense),
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
			<div className="bg-white w-full h-[90vh] md:max-w-3xl md:max-h-[90vh] rounded-2xl md:rounded-lg shadow-xl flex flex-col overflow-hidden">
				<div className="p-4 border-b border-neutral-200 shrink-0 flex justify-between items-center md:rounded-t-lg">
					<h2 className="text-xl font-bold text-neutral-900">収支レポート</h2>
					<button
						onClick={onClose}
						className="w-8 h-8 rounded-full hover:bg-neutral-100 shrink-0 p-1 flex items-center justify-center transition"
					>
						<i className="fas fa-times text-2xl text-neutral-500"></i>
					</button>
				</div>

				<div className="p-4 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-center gap-4">
					<div className="flex items-center gap-4">
						<Select
							value={year}
							onChange={(e) => setYear(Number(e.target.value))}
							className="w-28"
							selectClassName="font-bold text-neutral-700"
						>
							{yearOptions.map((y) => (
								<option key={y} value={y}>
									{y}年
								</option>
							))}
						</Select>

						{/* Tabs */}
						<div className="flex p-1 bg-neutral-200 rounded-lg">
							<button
								onClick={() => setActiveTab("monthly")}
								className={`px-3 py-1 text-xs font-bold rounded-md transition ${
									activeTab === "monthly"
										? "bg-white text-neutral-800 shadow-sm"
										: "text-neutral-500 hover:text-neutral-700"
								}`}
							>
								月別推移
							</button>
							<button
								onClick={() => setActiveTab("category")}
								className={`px-3 py-1 text-xs font-bold rounded-md transition ${
									activeTab === "category"
										? "bg-white text-neutral-800 shadow-sm"
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
						className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1 disabled:opacity-50"
					>
						<i className="fas fa-file-csv"></i> CSV出力
					</button>
				</div>

				<div className="grow overflow-y-auto p-6">
					{isLoading ? (
						<div className="text-center py-10 text-neutral-500">
							読み込み中...
						</div>
					) : (
						<div className="space-y-6">
							{/* Summary Cards */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
									<div className="text-emerald-600 text-xs font-bold mb-1">
										収入
									</div>
									<div className="text-2xl font-bold text-neutral-800">
										¥{stats.income.toLocaleString()}
									</div>
								</div>
								<div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
									<div className="text-rose-600 text-xs font-bold mb-1">
										支出
									</div>
									<div className="text-2xl font-bold text-neutral-800">
										¥{stats.expense.toLocaleString()}
									</div>
								</div>
								<div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
									<div className="text-indigo-600 text-xs font-bold mb-1">
										収支
									</div>
									<div
										className={`text-2xl font-bold ${
											stats.balance >= 0 ? "text-neutral-800" : "text-red-500"
										}`}
									>
										¥{stats.balance.toLocaleString()}
									</div>
								</div>
							</div>

							{yearData.length > 0 ? (
								<>
									{activeTab === "monthly" && (
										<div className="border border-neutral-200 rounded-lg overflow-hidden">
											<table className="w-full text-sm text-left">
												<thead className="bg-neutral-50 text-neutral-500 font-medium border-b border-neutral-200">
													<tr>
														<th className="p-3">月</th>
														<th className="p-3">収入</th>
														<th className="p-3">支出</th>
														<th className="p-3">差引</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-neutral-100">
													{Array.from({ length: 12 }, (_, i) => i + 1).map(
														(m) => {
															const monthlyTxns = yearData.filter(
																(t) => new Date(t.date).getMonth() + 1 === m
															);

															const mInc = monthlyTxns
																.filter((t) => t.type === "income")
																.reduce((sum, t) => sum + Number(t.amount), 0);
															const mExp = monthlyTxns
																.filter((t) => t.type === "expense")
																.reduce((sum, t) => sum + Number(t.amount), 0);

															if (mInc === 0 && mExp === 0) return null;

															return (
																<tr key={m}>
																	<td className="p-3 font-bold">{m}月</td>
																	<td className="p-3 text-emerald-600">
																		+{mInc.toLocaleString()}
																	</td>
																	<td className="p-3 text-rose-600">
																		-{mExp.toLocaleString()}
																	</td>
																	<td className="p-3 font-bold">
																		{(mInc - mExp).toLocaleString()}
																	</td>
																</tr>
															);
														}
													)}
												</tbody>
											</table>
										</div>
									)}

									{activeTab === "category" && (
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											{/* Expenses */}
											<div className="space-y-4">
												<h3 className="font-bold text-neutral-700 flex items-center">
													<i className="fas fa-minus-circle text-rose-500 mr-2"></i>
													支出内訳
												</h3>
												<div className="space-y-3">
													{stats.categoryBreakdown.expense.map((cat) => (
														<div key={cat.id}>
															<div className="flex justify-between text-sm mb-1">
																<span className="font-medium text-neutral-700">
																	{cat.name}
																</span>
																<span className="font-bold text-neutral-900">
																	¥{cat.amount.toLocaleString()} (
																	{Math.round(cat.percentage)}%)
																</span>
															</div>
															<div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
																<div
																	className={`h-full ${cat.color}`}
																	style={{ width: `${cat.percentage}%` }}
																></div>
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

											{/* Income */}
											<div className="space-y-4">
												<h3 className="font-bold text-neutral-700 flex items-center">
													<i className="fas fa-plus-circle text-emerald-500 mr-2"></i>
													収入内訳
												</h3>
												<div className="space-y-3">
													{stats.categoryBreakdown.income.map((cat) => (
														<div key={cat.id}>
															<div className="flex justify-between text-sm mb-1">
																<span className="font-medium text-neutral-700">
																	{cat.name}
																</span>
																<span className="font-bold text-neutral-900">
																	¥{cat.amount.toLocaleString()} (
																	{Math.round(cat.percentage)}%)
																</span>
															</div>
															<div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
																<div
																	className={`h-full ${cat.color}`}
																	style={{ width: `${cat.percentage}%` }}
																></div>
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
										</div>
									)}
								</>
							) : (
								<p className="text-neutral-400 text-center">
									データがありません
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default ReportModal;
