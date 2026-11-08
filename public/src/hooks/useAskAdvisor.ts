import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	buildFallbackInsights,
	buildProactiveDigest,
	callAdvisorApi,
	getRelevantTransactions,
} from "../services/advisorService.js";
import type {
	AdvisorAnalysisPoint,
	AdvisorMessage,
	AdvisorState,
	AdvisorSuggestion,
	GetCategoryName,
	ProactiveInsights,
} from "../types/hooks.js";
import * as utils from "../utils.js";

const INSIGHTS_CACHE_KEY = "walletwise_proactive_insights_v4";
/** 1日あたりの自動インサイトAPI呼び出し上限（初回読み込み1回＋残高変化時の再分析最大1回＝計2回まで） */
const MAX_DAILY_INSIGHT_API_CALLS = 2;
/** 残高変化時の自動インサイトAPI再呼び出しクールダウン（1時間） */
const INSIGHT_API_COOLDOWN_MS = 60 * 60 * 1000;
/** 連続した取引入力・編集をまとめるデバウンス時間（5秒） */
const BALANCE_CHANGE_DEBOUNCE_MS = 5000;

const DEFAULT_SUGGESTIONS: AdvisorSuggestion[] = [
	{ label: "🍔 食費の内訳は？", text: "直近の食費の内訳を教えて" },
	{
		label: "💰 節約のアドバイス",
		text: "この家計簿を見て、節約できるポイントを具体的に教えて",
	},
	{ label: "📊 先月との比較", text: "先月と比べて支出はどう変化してる？" },
	{ label: "🏆 一番高い買い物", text: "今月一番高かった支出は何？" },
];

interface CachedInsightsPayload {
	date: string;
	balanceSignature: string;
	apiCallsToday?: number;
	lastApiAt?: number;
	insights: ProactiveInsights;
}

/**
 * AIアドバイザー機能のロジックと状態を管理するカスタムフック。
 * プロアクティブ・インサイトの生成とローカルキャッシュ管理、
 * 深掘りチャットの会話履歴、データ抽出（RAG）、API呼び出しをカプセル化する。
 * @param {Record<string, unknown>} [config] - ユーザー設定。
 * @param {unknown[]} [transactions] - 全取引データ。
 * @param {Map | Record} [categories] - カテゴリデータ。
 * @returns {AdvisorState} アドバイザーの状態と操作関数。
 */
export function useAskAdvisor(
	config?: Record<string, unknown>,
	transactions?: unknown[],
	categories?:
		| Map<string, { id: string; name: string }>
		| Record<string, { id: string; name: string }>,
): AdvisorState {
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [messages, setMessages] = useState<AdvisorMessage[]>([]);
	const [input, setInput] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const [insights, setInsights] = useState<ProactiveInsights | null>(null);
	const [isInsightsLoading, setIsInsightsLoading] = useState<boolean>(false);
	const [suggestedQuestions, setSuggestedQuestions] =
		useState<AdvisorSuggestion[]>(DEFAULT_SUGGESTIONS);
	const [analyzedBalanceSignature, setAnalyzedBalanceSignature] = useState<
		string | null
	>(null);

	const chatLogRef = useRef<HTMLDivElement | null>(null);
	const lastCheckedDateRef = useRef<string | null>(null);

	const isEnabled = Boolean(
		(config as { general?: { enableAiAdvisor?: boolean } } | undefined)?.general
			?.enableAiAdvisor,
	);

	// 自動スクロール。
	useEffect(() => {
		if (chatLogRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
		}
	}, [messages, isLoading, isOpen]);

	// カテゴリ名取得ヘルパー。
	const getCategoryName = useCallback<GetCategoryName>(
		(id) => {
			if (!categories) return "不明";
			const cat =
				categories instanceof Map
					? categories.get(id ?? "")
					: id
						? categories[id]
						: undefined;
			return cat ? cat.name : "不明";
		},
		[categories],
	);

	/**
	 * 【ベース統計データ】
	 * 常にAIに渡す「全体のコンテキスト」。フィルタリング前の全データに基づく。
	 */
	const baseStats = useMemo(() => {
		if (!transactions || transactions.length === 0) return null;

		let totalIncome = 0;
		let totalExpense = 0;
		const monthlyStats: Record<string, { income: number; expense: number }> =
			{};
		let minDate = new Date(8640000000000000);
		let maxDate = new Date(-8640000000000000);

		transactions.forEach((t: unknown) => {
			const tx = t as {
				amount?: unknown;
				date?: unknown;
				type?: string;
			};
			const amount = Number(tx.amount);
			const rawDate = tx.date;
			const date =
				rawDate instanceof Date
					? rawDate
					: rawDate &&
						  typeof (rawDate as { toDate?: unknown }).toDate === "function"
						? (rawDate as unknown as { toDate: () => Date }).toDate()
						: new Date(rawDate as string | number | Date);
			if (isNaN(date.getTime())) return;

			if (date < minDate) minDate = date;
			if (date > maxDate) maxDate = date;

			const monthStr = utils.toYYYYMM(date);
			if (!monthlyStats[monthStr])
				monthlyStats[monthStr] = { income: 0, expense: 0 };

			if (tx.type === "income") {
				totalIncome += amount;
				monthlyStats[monthStr].income += amount;
			} else if (tx.type === "expense") {
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
	 * クライアント側でのプロアクティブ定量集計ダイジェスト。
	 */
	const proactiveDigest = useMemo(() => {
		return buildProactiveDigest(transactions as never[], getCategoryName);
	}, [transactions, getCategoryName]);

	/**
	 * 現在の収支・残高状態を表すシグネチャ。
	 */
	const currentBalanceSignature = useMemo(() => {
		if (!baseStats) return "";
		return `${baseStats.count}_${Math.round(baseStats.totalIncome)}_${Math.round(baseStats.totalExpense)}`;
	}, [baseStats]);

	/**
	 * 前回インサイトを生成した時点から残高（取引合計・件数）が変化したかどうか。
	 */
	const hasBalanceChanged = Boolean(
		insights &&
			currentBalanceSignature &&
			analyzedBalanceSignature &&
			currentBalanceSignature !== analyzedBalanceSignature,
	);

	/**
	 * プロアクティブ・インサイトを生成（または日次キャッシュ／ローカル定量分析から更新）する。
	 * API呼び出し回数を保護するため、1日最大2回・最低1時間間隔の制限を設け、
	 * 制限内の残高変化時はAPIを消費せずクライアント側の定量分析で即座に最新化する。
	 */
	const fetchProactiveInsights = useCallback(
		async (forceRefresh = false): Promise<void> => {
			if (!isEnabled) return;

			if (!baseStats || !proactiveDigest) {
				setInsights(null);
				setSuggestedQuestions(DEFAULT_SUGGESTIONS);
				return;
			}

			const todayStr = utils.toYYYYMMDD(new Date());
			const now = Date.now();
			const fallback = buildFallbackInsights(proactiveDigest);

			let cachedPayload: CachedInsightsPayload | null = null;
			try {
				const rawCache = localStorage.getItem(INSIGHTS_CACHE_KEY);
				if (rawCache) {
					const parsed = JSON.parse(rawCache) as CachedInsightsPayload;
					if (parsed && parsed.date === todayStr && parsed.insights) {
						cachedPayload = parsed;
					}
				}
			} catch {
				// localStorage 読み取りエラー時は無視
			}

			// 同日キャッシュがあり、残高（取引件数・収支合計）も変わっていない場合はキャッシュをそのまま使用（API呼び出し0回）
			if (
				!forceRefresh &&
				cachedPayload &&
				cachedPayload.balanceSignature === currentBalanceSignature
			) {
				lastCheckedDateRef.current = todayStr;
				setAnalyzedBalanceSignature(currentBalanceSignature);
				setInsights(cachedPayload.insights);
				if (
					Array.isArray(cachedPayload.insights.suggestedQuestions) &&
					cachedPayload.insights.suggestedQuestions.length > 0
				) {
					setSuggestedQuestions(cachedPayload.insights.suggestedQuestions);
				}
				return;
			}

			const apiCallsToday = cachedPayload?.apiCallsToday ?? 0;
			const lastApiAt = cachedPayload?.lastApiAt ?? 0;
			const isWithinCooldown =
				lastApiAt > 0 && now - lastApiAt < INSIGHT_API_COOLDOWN_MS;
			const isQuotaReached = apiCallsToday >= MAX_DAILY_INSIGHT_API_CALLS;

			// 同日中に残高が変化したが、クールダウン中または日次自動API上限に達している場合は
			// APIを呼び出さずローカル定量分析で安定度とインサイトカードを最新化する（API呼び出し0回）
			if (!forceRefresh && cachedPayload && (isWithinCooldown || isQuotaReached)) {
				lastCheckedDateRef.current = todayStr;
				setAnalyzedBalanceSignature(currentBalanceSignature);
				setInsights(fallback);
				setSuggestedQuestions(fallback.suggestedQuestions);
				try {
					const updatedCache: CachedInsightsPayload = {
						date: todayStr,
						balanceSignature: currentBalanceSignature,
						apiCallsToday,
						lastApiAt,
						insights: fallback,
					};
					localStorage.setItem(
						INSIGHTS_CACHE_KEY,
						JSON.stringify(updatedCache),
					);
				} catch {
					// 無視
				}
				return;
			}

			lastCheckedDateRef.current = todayStr;
			setAnalyzedBalanceSignature(currentBalanceSignature);
			setIsInsightsLoading(true);

			try {
				const payload = {
					isStart: true,
					baseStats,
					proactiveDigest: {
						promptSummary: proactiveDigest.promptSummary,
						forecast: proactiveDigest.forecast,
					},
				};

				const rawResponse = await callAdvisorApi(payload);
				const response = (
					typeof rawResponse === "object" && rawResponse !== null
						? rawResponse
						: { adviceText: String(rawResponse ?? "") }
				) as Record<string, unknown>;

				const rawPoints = Array.isArray(response.analysisPoints)
					? (response.analysisPoints as AdvisorAnalysisPoint[])
					: [];

				const normalizedPoints: AdvisorAnalysisPoint[] =
					rawPoints.length > 0
						? rawPoints.slice(0, 3).map((pt, idx) => ({
								type: pt.type || fallback.analysisPoints[idx]?.type || "trend",
								title: pt.title || "注目ポイント",
								content: pt.content || "",
								followUpPrompt:
									pt.followUpPrompt ||
									fallback.analysisPoints[idx]?.followUpPrompt ||
									`「${pt.title || "この項目"}」について具体的な内訳と改善アドバイスを教えて`,
							}))
						: fallback.analysisPoints;

				const rawSuggestions = Array.isArray(response.suggestedQuestions)
					? (response.suggestedQuestions as AdvisorSuggestion[]).filter(
							(q) => q && typeof q.label === "string" && typeof q.text === "string",
						)
					: [];

				const finalSuggestions =
					rawSuggestions.length > 0
						? rawSuggestions.slice(0, 4)
						: fallback.suggestedQuestions;

				const newInsights: ProactiveInsights = {
					summaryText:
						(typeof response.adviceText === "string" &&
							response.adviceText.trim()) ||
						fallback.summaryText,
					alertLevel:
						(response.alertLevel as ProactiveInsights["alertLevel"]) ||
						fallback.alertLevel,
					forecastComment:
						(typeof response.forecastComment === "string" &&
							response.forecastComment.trim()) ||
						fallback.forecastComment,
					forecast: proactiveDigest.forecast,
					analysisPoints: normalizedPoints,
					suggestedQuestions: finalSuggestions,
					updatedAt: Date.now(),
					isFallback: false,
				};

				setInsights(newInsights);
				setSuggestedQuestions(finalSuggestions);

				try {
					const cacheData: CachedInsightsPayload = {
						date: todayStr,
						balanceSignature: currentBalanceSignature,
						apiCallsToday: apiCallsToday + 1,
						lastApiAt: Date.now(),
						insights: newInsights,
					};
					localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(cacheData));
				} catch {
					// ストレージ容量超過等は無視
				}
			} catch {
				// API上限到達やネットワークエラー時はローカル定量分析によるフォールバックを表示
				setInsights(fallback);
				setSuggestedQuestions(fallback.suggestedQuestions);
			} finally {
				setIsInsightsLoading(false);
			}
		},
		[isEnabled, baseStats, proactiveDigest, currentBalanceSignature],
	);

	// 初回読み込み時（即時）および残高変化時（5秒デバウンス）の自動更新制御
	useEffect(() => {
		if (!isEnabled) return;
		if (!proactiveDigest) {
			setInsights(null);
			return;
		}
		const todayStr = utils.toYYYYMMDD(new Date());

		// その日の初回マウント時は即座に実行（キャッシュがあればAPI呼び出し0回で即時復元）
		if (lastCheckedDateRef.current !== todayStr) {
			fetchProactiveInsights(false);
			return;
		}

		// 同日中に取引の追加・編集・削除で残高シグネチャが変わった場合：
		// 1) 安定度ステータス（alertLevel）と予測数値だけはAPIを待たずに即時反映
		const localFallback = buildFallbackInsights(proactiveDigest);
		setInsights((prev) =>
			prev
				? {
						...prev,
						alertLevel: localFallback.alertLevel,
						forecast: proactiveDigest.forecast,
					}
				: prev,
		);

		// 2) 連続入力をまとめるため5秒デバウンス後にインサイト更新（クールダウン/上限判定付き）
		if (
			currentBalanceSignature &&
			analyzedBalanceSignature &&
			currentBalanceSignature !== analyzedBalanceSignature
		) {
			const timer = setTimeout(() => {
				fetchProactiveInsights(false);
			}, BALANCE_CHANGE_DEBOUNCE_MS);
			return () => clearTimeout(timer);
		}
	}, [
		isEnabled,
		proactiveDigest,
		currentBalanceSignature,
		analyzedBalanceSignature,
		fetchProactiveInsights,
	]);

	/**
	 * 残高が変わってユーザーが明示的に更新ボタンを押した際にインサイトを再分析する。
	 */
	const refreshInsights = useCallback(async (): Promise<void> => {
		if (!hasBalanceChanged) return;
		await fetchProactiveInsights(true);
	}, [hasBalanceChanged, fetchProactiveInsights]);

	/**
	 * ユーザーメッセージ送信処理を行う。
	 * @async
	 * @param {string | null} [forcedText] - 強制的に送信するテキスト（サジェストチップ・カード深掘り用）。
	 */
	const handleUserSubmit = useCallback(
		async (forcedText?: string | null): Promise<void> => {
			const text =
				typeof forcedText === "string" ? forcedText : input.trim();
			if (!text || isLoading) return;

			const newMessages: AdvisorMessage[] = [
				...messages,
				{ role: "user", text },
			];
			setMessages(newMessages);
			if (typeof forcedText !== "string") {
				setInput("");
			}
			setIsLoading(true);

			try {
				if (!baseStats) {
					await new Promise((resolve) => setTimeout(resolve, 400));
					setMessages((prev) => [
						...prev,
						{
							role: "model",
							text: "まだ取引データが登録されていないため、分析やお答えができません。まずは取引を追加してみてください！",
							alertLevel: "safe",
						},
					]);
					return;
				}

				// ユーザーの質問に合わせてデータを動的に抽出する (RAG)。
				const relevantData = getRelevantTransactions(
					text,
					transactions as never[],
					categories,
					getCategoryName,
				);

				const payload = {
					isStart: false,
					text: text,
					history: messages.slice(-5).map((msg) => ({
						role: msg.role,
						text: msg.text,
					})),
					baseStats: baseStats,
					relevantData: relevantData,
					proactiveDigest: proactiveDigest
						? {
								promptSummary: proactiveDigest.promptSummary,
								forecast: proactiveDigest.forecast,
							}
						: undefined,
				};

				const rawResponse = await callAdvisorApi(payload);
				const response = rawResponse as unknown as Record<string, unknown>;

				const adviceText =
					(response.adviceText as string) ||
					(typeof rawResponse === "string"
						? rawResponse
						: JSON.stringify(response));

				const modelMessage: AdvisorMessage = {
					role: "model",
					text: adviceText,
					alertLevel:
						(response.alertLevel as AdvisorMessage["alertLevel"]) || "safe",
					analysisPoints: Array.isArray(response.analysisPoints)
						? (response.analysisPoints as AdvisorMessage["analysisPoints"])
						: [],
				};
				setMessages((prev) => [...prev, modelMessage]);

				// 次の深掘り質問チップが返ってきた場合は動的に更新
				if (Array.isArray(response.suggestedQuestions)) {
					const nextSuggestions = (
						response.suggestedQuestions as AdvisorSuggestion[]
					).filter(
						(q) =>
							q && typeof q.label === "string" && typeof q.text === "string",
					);
					if (nextSuggestions.length > 0) {
						setSuggestedQuestions(nextSuggestions.slice(0, 4));
					}
				}
			} catch (error) {
				setMessages((prev) => [
					...prev,
					{
						role: "model",
						text:
							error instanceof Error ? error.message : String(error),
						alertLevel: "safe",
					},
				]);
			} finally {
				setIsLoading(false);
			}
		},
		[
			input,
			isLoading,
			messages,
			baseStats,
			proactiveDigest,
			transactions,
			categories,
			getCategoryName,
		],
	);

	/**
	 * インサイトカードをタップした際にチャットドロワーを展開し、そのテーマを深掘りする。
	 */
	const handleSelectInsight = useCallback(
		async (point: AdvisorAnalysisPoint): Promise<void> => {
			setIsOpen(true);
			const promptText =
				point.followUpPrompt ||
				`「${point.title || "このインサイト"}」について、具体的な内訳や改善アクションを詳しく教えて`;
			await handleUserSubmit(promptText);
		},
		[handleUserSubmit],
	);

	return {
		isOpen,
		setIsOpen,
		messages,
		input,
		setInput,
		isLoading,
		chatLogRef: chatLogRef as MutableRefObject<HTMLDivElement | null>,
		handleUserSubmit,
		insights,
		isInsightsLoading,
		suggestedQuestions,
		refreshInsights,
		handleSelectInsight,
		hasBalanceChanged,
	};
}
