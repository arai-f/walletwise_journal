import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { app, db } from "../firebase.js";
import * as store from "../services/store.js";
import * as utils from "../utils.js";

/**
 * 1日あたりのAPI呼び出し制限回数。
 * @constant {number}
 */
const MAX_DAILY_CALLS = 20;

/**
 * AIアドバイザー機能に使用する提案プロンプトのリスト。
 * @constant {Array<object>}
 */
const SUGGESTIONS = [
	{ label: "🍔 食費の内訳は？", text: "直近の食費の内訳を教えて" },
	{
		label: "💰 節約のアドバイス",
		text: "この家計簿を見て、節約できるポイントを具体的に教えて",
	},
	{ label: "📊 先月との比較", text: "先月と比べて支出はどう変化してる？" },
	{ label: "🏆 一番高い買い物", text: "今年一番高かった支出は何？" },
];

/**
 * AIアドバイザーコンポーネント。
 * RAG（検索拡張生成）アプローチにより、ユーザーの質問に合わせて最適なデータを抽出し、
 * Gemini APIを使用して的確な回答を提供する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.config - ユーザー設定。
 * @param {Array} props.transactions - 取引データ配列。
 * @param {object} props.categories - カテゴリマップまたはオブジェクト。
 * @returns {JSX.Element} AIアドバイザーコンポーネント。
 */
export default function Advisor({ config, transactions, categories }) {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [model, setModel] = useState(null);
	const [usageCache, setUsageCache] = useState({ date: "", count: 0 });

	const chatLogRef = useRef(null);
	const hasStartedRef = useRef(false);

	// 自動スクロール。
	useEffect(() => {
		if (chatLogRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
		}
	}, [messages, isLoading, isOpen]);

	// Geminiモデルの初期化。
	useEffect(() => {
		async function loadModel() {
			try {
				const { getAI, getGenerativeModel, VertexAIBackend } =
					await import("firebase/ai");
				const ai = getAI(app, { backend: new VertexAIBackend() });
				const m = getGenerativeModel(ai, {
					model: "gemini-2.5-flash",
					safetySettings: [
						{
							category: "HARM_CATEGORY_HARASSMENT",
							threshold: "BLOCK_LOW_AND_ABOVE",
						},
						{
							category: "HARM_CATEGORY_HATE_SPEECH",
							threshold: "BLOCK_LOW_AND_ABOVE",
						},
						{
							category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
							threshold: "BLOCK_LOW_AND_ABOVE",
						},
						{
							category: "HARM_CATEGORY_DANGEROUS_CONTENT",
							threshold: "BLOCK_LOW_AND_ABOVE",
						},
					],
				});
				setModel(m);
			} catch (e) {
				console.error("[Advisor] Failed to load Gemini model", e);
			}
		}
		loadModel();
	}, []);

	// 利用状況のロード。
	const loadUsage = useCallback(async () => {
		const auth = getAuth();
		const user = auth.currentUser;
		if (!user) return;

		const docRef = doc(db, "user_configs", user.uid);
		try {
			const snap = await getDoc(docRef);
			let newUsage = { date: utils.toYYYYMMDD(new Date()), count: 0 };
			if (snap.exists()) {
				const data = snap.data();
				const u = data.aiAdvisorUsage;
				if (u && u.date && typeof u.count === "number") {
					newUsage = { date: u.date, count: u.count };
				}
			}
			setUsageCache(newUsage);
		} catch (e) {
			console.error("[Advisor] Failed to load usage stats:", e);
			setUsageCache({ date: utils.toYYYYMMDD(new Date()), count: 0 });
		}
	}, []);

	useEffect(() => {
		loadUsage();
	}, [loadUsage]);

	// カテゴリ名取得ヘルパー。
	const getCategoryName = useCallback(
		(id) => {
			const cat =
				categories instanceof Map ? categories.get(id) : categories[id];
			return cat ? cat.name : "不明";
		},
		[categories],
	);

	// 利用回数のインクリメント（楽観的更新）。
	const incrementCallCount = useCallback(() => {
		const auth = getAuth();
		const user = auth.currentUser;
		if (!user) return;

		const today = utils.toYYYYMMDD(new Date());
		// キャッシュが最新日付ならそれを使用、古ければリセットする。
		const currentCount = usageCache.date === today ? usageCache.count : 0;
		const newUsage = { date: today, count: currentCount + 1 };

		setUsageCache(newUsage);

		store
			.updateConfig({ aiAdvisorUsage: newUsage }, true)
			.catch((e) => console.error("[Advisor] Usage update failed:", e));
	}, [usageCache]);

	/**
	 * 【1. ベース統計データ】
	 * 常にAIに渡す「全体のコンテキスト」。フィルタリング前の全データに基づく。
	 */
	const baseStats = useMemo(() => {
		if (!transactions || transactions.length === 0) return null;

		let totalIncome = 0;
		let totalExpense = 0;
		const monthlyStats = {};
		let minDate = new Date(8640000000000000);
		let maxDate = new Date(-8640000000000000);

		transactions.forEach((t) => {
			const amount = Number(t.amount);
			const date = t.date instanceof Date ? t.date : t.date.toDate();

			if (date < minDate) minDate = date;
			if (date > maxDate) maxDate = date;

			const monthStr = utils.toYYYYMM(date);
			if (!monthlyStats[monthStr])
				monthlyStats[monthStr] = { income: 0, expense: 0 };

			if (t.type === "income") {
				totalIncome += amount;
				monthlyStats[monthStr].income += amount;
			} else if (t.type === "expense") {
				totalExpense += amount;
				monthlyStats[monthStr].expense += amount;
			}
		});

		const monthlyTrends = Object.entries(monthlyStats)
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([month, data]) => `${month}:収${data.income}/支${data.expense}`)
			.join("\n");

		return {
			period: `${utils.toYYYYMMDD(minDate)} 〜 ${utils.toYYYYMMDD(maxDate)}`,
			totalIncome,
			totalExpense,
			balance: totalIncome - totalExpense,
			monthlyTrends,
			count: transactions.length,
		};
	}, [transactions]);

	/**
	 * ユーザーの質問意図（日付、カテゴリ、種類、順序）を解析し、
	 * 最も関連性の高い取引データを抽出する。
	 * @param {string} queryText - ユーザーの質問テキスト。
	 * @returns {object} 抽出されたデータリストと説明。
	 */
	const getRelevantTransactions = useCallback(
		(queryText) => {
			if (!transactions) return { list: "", description: "データなし" };

			let filtered = [...transactions];
			const conditions = [];
			const now = new Date();
			const currentYear = now.getFullYear();
			const currentMonth = now.getMonth() + 1;

			// A. 日付解析 (相対・絶対)
			let dateFilterApplied = false;

			// "今月"
			if (queryText.includes("今月")) {
				filtered = filtered.filter((t) => {
					const d = t.date instanceof Date ? t.date : t.date.toDate();
					return (
						d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth
					);
				});
				conditions.push("今月");
				dateFilterApplied = true;
			}
			// "先月"
			else if (queryText.includes("先月")) {
				let targetYear = currentYear;
				let targetMonth = currentMonth - 1;
				if (targetMonth === 0) {
					targetMonth = 12;
					targetYear -= 1;
				}
				filtered = filtered.filter((t) => {
					const d = t.date instanceof Date ? t.date : t.date.toDate();
					return (
						d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth
					);
				});
				conditions.push("先月");
				dateFilterApplied = true;
			}
			// "今年"
			else if (queryText.includes("今年")) {
				filtered = filtered.filter((t) => {
					const d = t.date instanceof Date ? t.date : t.date.toDate();
					return d.getFullYear() === currentYear;
				});
				conditions.push("今年");
				dateFilterApplied = true;
			}
			// "去年" / "昨年"
			else if (queryText.includes("去年") || queryText.includes("昨年")) {
				filtered = filtered.filter((t) => {
					const d = t.date instanceof Date ? t.date : t.date.toDate();
					return d.getFullYear() === currentYear - 1;
				});
				conditions.push("去年");
				dateFilterApplied = true;
			}

			// 指定がない場合の "X月" (今年と仮定) / "20XX年" を処理する。
			if (!dateFilterApplied) {
				const yearMatch = queryText.match(/(\d{4})年/);
				const monthMatch = queryText.match(/(\d{1,2})月/);

				if (yearMatch) {
					const y = parseInt(yearMatch[1], 10);
					filtered = filtered.filter((t) => {
						const d = t.date instanceof Date ? t.date : t.date.toDate();
						return d.getFullYear() === y;
					});
					conditions.push(`${y}年`);
				}

				if (monthMatch) {
					const m = parseInt(monthMatch[1], 10);
					filtered = filtered.filter((t) => {
						const d = t.date instanceof Date ? t.date : t.date.toDate();
						return d.getMonth() + 1 === m;
					});
					conditions.push(`${m}月`);
				}
			}

			// B. 収支タイプ解析
			if (queryText.includes("収入")) {
				filtered = filtered.filter((t) => t.type === "income");
				conditions.push("収入のみ");
			} else if (queryText.includes("支出") || queryText.includes("出費")) {
				filtered = filtered.filter((t) => t.type === "expense");
				conditions.push("支出のみ");
			}

			// C. カテゴリ解析
			const cats =
				categories instanceof Map
					? Array.from(categories.values())
					: Object.values(categories);
			const hitCat = cats.find((c) => queryText.includes(c.name));

			if (hitCat) {
				// ID検索 (簡易的に名前から再検索)。
				let targetCatId = null;
				if (categories instanceof Map) {
					for (const [id, c] of categories.entries()) {
						if (c.name === hitCat.name) {
							targetCatId = id;
							break;
						}
					}
				} else {
					for (const [id, c] of Object.entries(categories)) {
						if (c.name === hitCat.name) {
							targetCatId = id;
							break;
						}
					}
				}

				if (targetCatId) {
					filtered = filtered.filter((t) => t.categoryId === targetCatId);
					conditions.push(`カテゴリ「${hitCat.name}」`);
				}
			}

			// --- D. ソートと制限 ---
			// "高い", "最大", "一番" などがあれば金額順 (降順)
			const isHighAmountQuery =
				queryText.includes("高い") ||
				queryText.includes("高額") ||
				queryText.includes("最大") ||
				queryText.includes("一番");

			if (isHighAmountQuery) {
				filtered.sort((a, b) => b.amount - a.amount);
				conditions.push("金額が高い順");
			} else {
				// デフォルトは日付順 (新しい順)
				filtered.sort((a, b) => b.date - a.date);
				if (conditions.length === 0) conditions.push("直近の取引");
			}

			// 抽出データの簡易集計を行う。
			const totalAmount = filtered.reduce(
				(sum, t) => sum + Number(t.amount),
				0,
			);
			const categoryTotals = {};
			filtered.forEach((t) => {
				const catName = getCategoryName(t.categoryId);
				categoryTotals[catName] =
					(categoryTotals[catName] || 0) + Number(t.amount);
			});
			const topCategories = Object.entries(categoryTotals)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([name, amount]) => `${name}: ${amount}円`)
				.join(", ");

			// リスト生成 (最大70件)
			const sliced = filtered.slice(0, 70);
			const listStr = sliced
				.map((t) => {
					const amount = Number(t.amount);
					const catName = getCategoryName(t.categoryId);
					const dateShort = utils
						.toYYYYMMDD(t.date)
						.substring(5)
						.replace("-", "/");
					const desc = t.description || t.memo || "";
					return `${dateShort}|${
						t.type === "income" ? "(収)" : ""
					}${catName}|${amount}|${desc}`;
				})
				.join("\n");

			return {
				list: listStr,
				description: conditions.join(" かつ "),
				count: filtered.length,
				isPartial: filtered.length > 70,
				stats: {
					totalAmount,
					topCategories,
				},
			};
		},
		[transactions, categories, getCategoryName],
	);

	const callGemini = useCallback(
		async (prompt) => {
			try {
				if (!model) throw new Error("Model not loaded");
				const result = await model.generateContent(prompt);
				const response = await result.response;
				return response.text().trim();
			} catch (error) {
				console.error("[Advisor] Gemini Error:", error);
				throw error;
			}
		},
		[model],
	);

	/**
	 * 会話開始時の処理を行う。
	 * @async
	 */
	const startConversation = useCallback(async () => {
		if (hasStartedRef.current || messages.length > 0) return;

		hasStartedRef.current = true;
		setIsLoading(true);

		const today = utils.toYYYYMMDD(new Date());
		if (usageCache.date === today && usageCache.count >= MAX_DAILY_CALLS) {
			setMessages([
				{
					role: "model",
					text: "本日のAI利用回数制限に達しました。また明日お話ししましょう！",
				},
			]);
			setIsLoading(false);
			return;
		}

		try {
			if (!baseStats) {
				setMessages([
					{
						role: "model",
						text: "データがまだないようですね。取引を入力すると分析できるようになります！",
					},
				]);
				return;
			}

			const prompt = `あなたは親しみやすいファイナンシャルプランナーです。
            以下の家計簿データの全体像を分析し、ユーザーに最初の挨拶を行ってください。
            
            【全体データ概要】
            期間: ${baseStats.period}
            全体収支: 収入 ${baseStats.totalIncome} / 支出 ${baseStats.totalExpense} (残高 ${baseStats.balance})
            
            【要件】
            - 現在の季節感に触れつつ、親しみやすく挨拶。
            - 家計の全体的な状態（黒字/赤字など）に一言触れる。
            - 150文字以内で簡潔に。Markdown禁止。
            `;

			const response = await callGemini(prompt);
			setMessages([{ role: "model", text: response }]);
			incrementCallCount();
		} catch (e) {
			console.error("[Advisor] Start Conversation Error:", e);
			setMessages([
				{ role: "model", text: "すみません、うまく起動できませんでした。" },
			]);
		} finally {
			setIsLoading(false);
		}
	}, [baseStats, callGemini, incrementCallCount, messages.length, usageCache]);

	/**
	 * ユーザーメッセージ送信処理を行う。
	 * @async
	 * @param {string} [forcedText=null] - 強制的に送信するテキスト（サジェストボタン用）。
	 */
	const handleUserSubmit = useCallback(
		async (forcedText = null) => {
			const text = forcedText || input.trim();
			if (!text || isLoading) return;

			const newMessages = [...messages, { role: "user", text }];
			setMessages(newMessages);
			setInput("");
			setIsLoading(true);

			const today = utils.toYYYYMMDD(new Date());
			if (usageCache.date === today && usageCache.count >= MAX_DAILY_CALLS) {
				setMessages((prev) => [
					...prev,
					{
						role: "model",
						text: `申し訳ありません、本日の利用回数制限（${MAX_DAILY_CALLS}回）に達しました。`,
					},
				]);
				setIsLoading(false);
				return;
			}

			try {
				if (!baseStats) throw new Error("No Data");

				// ユーザーの質問に合わせてデータを動的に抽出する (RAG)。
				const relevantData = getRelevantTransactions(text);

				const systemContext = `
            【役割】
            あなたはユーザー専属のFP「WalletWise AI」です。
            ユーザーの家計簿データに基づき、親しみやすく、かつ的確なアドバイスを行います。
            
            【全体の統計情報 (マクロ視点)】
            期間: ${baseStats.period}
            全体収支: 収入 ${baseStats.totalIncome} / 支出 ${baseStats.totalExpense} (残高 ${baseStats.balance})
            月次推移:
            ${baseStats.monthlyTrends}
            
            【参照用・取引詳細リスト (ミクロ視点)】
            ユーザーの質問「${text}」に基づいて抽出・集計されたデータ:
            抽出条件: **${relevantData.description}**
            該当件数: ${relevantData.count}件
            合計金額: ${relevantData.stats.totalAmount}円
            主な内訳: ${relevantData.stats.topCategories || "特になし"}
            
            [詳細リスト (最大70件)]
            ${relevantData.list || "(データなし)"}
            
            【回答ガイドライン】
            1. **共感と分析**: 単に数字を並べるだけでなく、「使いすぎですね」「よく抑えられていますね」といった感想や分析を交えてください。
            2. **根拠の明示**: 「合計で〇〇円使っており、特に〇〇（カテゴリ）が大きいです」のように、データに基づいて話してください。
            3. **自然な会話**: 堅苦しい敬語は避け、丁寧ですが親しみやすい「です・ます」調で話してください。
            4. **形式**: 日本語、300文字以内。Markdown禁止。
            `;

				let prompt = systemContext + "\n\n【会話履歴】\n";
				newMessages.slice(-6).forEach((msg) => {
					const roleLabel = msg.role === "user" ? "User" : "AI";
					prompt += `${roleLabel}: ${msg.text}\n`;
				});
				prompt += `\nUser: ${text}\nAI:`;

				const response = await callGemini(prompt);
				setMessages((prev) => [...prev, { role: "model", text: response }]);
				incrementCallCount();
			} catch (error) {
				console.error("[Advisor] User Submit Error:", error);
				let errorMsg = "エラーが発生しました。もう一度お試しください。";
				if (
					error.message &&
					(error.message === "SafetyBlock" || error.message.includes("SAFETY"))
				) {
					errorMsg =
						"申し訳ありませんが、その内容にはお答えできません。（安全フィルターによりブロックされました）";
				}
				setMessages((prev) => [...prev, { role: "model", text: errorMsg }]);
			} finally {
				setIsLoading(false);
			}
		},
		[
			input,
			isLoading,
			messages,
			baseStats,
			getRelevantTransactions,
			callGemini,
			incrementCallCount,
			usageCache,
		],
	);

	useEffect(() => {
		if (isOpen && messages.length === 0 && model) {
			startConversation();
		}
	}, [isOpen, model, messages.length, startConversation]);

	if (!config?.general?.enableAiAdvisor) return null;

	return (
		<div
			className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col transition-all duration-300"
			style={{ maxHeight: isOpen ? "600px" : "none" }}
		>
			<div
				className="px-4 py-3 border-b border-neutral-100 flex justify-between items-center cursor-pointer bg-neutral-50/80 hover:bg-neutral-100 transition-colors shrink-0 z-10"
				onClick={() => setIsOpen(!isOpen)}
			>
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shrink-0">
						<i className="fa-solid fa-robot text-xs"></i>
					</div>
					<div>
						<h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
							AI Advisor
							<span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100">
								BETA
							</span>
						</h3>
					</div>
				</div>
				<i
					className={`fas fa-chevron-down text-neutral-400 transition-transform duration-300 ${
						!isOpen ? "-rotate-90" : ""
					}`}
				></i>
			</div>

			{isOpen && (
				<div
					className="flex flex-col grow overflow-hidden"
					style={{ height: "400px" }}
				>
					<div
						className="grow overflow-y-auto p-4 space-y-4 bg-white scroll-smooth"
						ref={chatLogRef}
						style={{ minHeight: "200px" }}
					>
						{messages.map((msg, idx) => (
							<div
								key={idx}
								className={`flex w-full ${
									msg.role === "user" ? "justify-end" : "justify-start"
								}`}
							>
								<div
									className={
										msg.role === "user"
											? "bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-sm max-w-[85%] shadow-sm"
											: "bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm max-w-[90%] font-medium leading-relaxed shadow-sm"
									}
								>
									{msg.text}
								</div>
							</div>
						))}
						{isLoading && (
							<div className="flex w-full justify-start">
								<div className="bg-neutral-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1 min-w-12">
									<div
										className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
										style={{ animationDelay: "0s" }}
									></div>
									<div
										className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
										style={{ animationDelay: "0.1s" }}
									></div>
									<div
										className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
										style={{ animationDelay: "0.2s" }}
									></div>
								</div>
							</div>
						)}
					</div>

					<div className="p-3 bg-white border-t border-neutral-100 shrink-0 z-10">
						<div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
							{SUGGESTIONS.map((s, idx) => (
								<button
									key={idx}
									className="shrink-0 bg-neutral-50 border border-neutral-200 text-neutral-600 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95"
									onClick={() => handleUserSubmit(s.text)}
									disabled={isLoading}
								>
									{s.label}
								</button>
							))}
						</div>

						<div className="relative flex items-center gap-2">
							<input
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyPress={(e) => e.key === "Enter" && handleUserSubmit()}
								placeholder="例: 先月の食費は？ 一番高い買い物は？"
								className="grow bg-neutral-50 border border-neutral-200 text-neutral-800 text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder-neutral-400"
								disabled={isLoading}
							/>
							<button
								onClick={() => handleUserSubmit()}
								className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
								disabled={isLoading || !input.trim()}
							>
								<i className="fas fa-paper-plane text-sm"></i>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
