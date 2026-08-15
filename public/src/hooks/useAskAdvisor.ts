import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	callAdvisorApi,
	getRelevantTransactions,
} from "../services/advisorService.js";
import type { AdvisorMessage, AdvisorState, GetCategoryName } from "../types/hooks.js";
import * as utils from "../utils.js";

/**
 * `useAskAdvisor` の引数型。
 * 旧実装の3引数呼び出しに合わせるため、個別引数として受け取る。
 */
export type UseAskAdvisorParams = {
	/** ユーザー設定。 */
	config?: Record<string, unknown>;
	/** 全取引データ。 */
	transactions?: unknown[];
	/** カテゴリデータ。 */
	categories?:
		| Map<string, { id: string; name: string }>
		| Record<string, { id: string; name: string }>;
};

/**
 * AIアドバイザー機能のロジックと状態を管理するカスタムフック。
 * 会話の履歴、統計情報の計算、データの抽出、API呼び出しをカプセル化する。
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

	const chatLogRef = useRef<HTMLDivElement | null>(null);
	const hasStartedRef = useRef<boolean>(false);

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
		const monthlyStats: Record<
			string,
			{ income: number; expense: number }
		> = {};
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
						  typeof (rawDate as { toDate?: unknown }).toDate ===
								"function"
						? (
								rawDate as unknown as { toDate: () => Date }
							).toDate()
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
			.map(
				([month, data]) =>
					`${month}:収${data.income}/支${data.expense}`,
			)
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
	 * 会話開始時の処理を行う。
	 * @async
	 */
	const startConversation = useCallback(async (): Promise<void> => {
		if (hasStartedRef.current || messages.length > 0) return;

		hasStartedRef.current = true;
		setIsLoading(true);

		try {
			if (!baseStats) {
				setMessages([
					{
						role: "model",
						text: "データがまだないようですね。取引を入力すると分析できるようになります！",
						alertLevel: "safe",
					},
				]);
				return;
			}

			const payload = {
				isStart: true,
				baseStats: baseStats,
			};
			const rawResponse = await callAdvisorApi(payload);
			const response = rawResponse as unknown as Record<
				string,
				unknown
			>;

			const adviceText =
				(response.adviceText as string) ||
				(typeof rawResponse === "string"
					? rawResponse
					: JSON.stringify(response));

			// レスポンスから構造化データを抽出
			const message: AdvisorMessage = {
				role: "model",
				text: adviceText,
				alertLevel:
					(response.alertLevel as AdvisorMessage["alertLevel"]) ||
					"safe",
				analysisPoints: Array.isArray(response.analysisPoints)
					? (response.analysisPoints as AdvisorMessage["analysisPoints"])
					: [],
			};
			setMessages([message]);
		} catch (e) {
			setMessages([
				{
					role: "model",
					text:
						(e instanceof Error ? e.message : "") ||
						"すみません、うまく起動できませんでした。",
					alertLevel: "safe",
				},
			]);
		} finally {
			setIsLoading(false);
		}
	}, [baseStats, messages.length]);

	/**
	 * ユーザーメッセージ送信処理を行う。
	 * @async
	 * @param {string | null} [forcedText] - 強制的に送信するテキスト（サジェストボタン用）。
	 */
	const handleUserSubmit = useCallback(
		async (forcedText?: string | null): Promise<void> => {
			// React Eventオブジェクトが誤って渡ってきた場合を防ぎ、純粋な文字列のみ利用する
			const text =
				typeof forcedText === "string" ? forcedText : input.trim();
			if (!text || isLoading) return;

			const newMessages: AdvisorMessage[] = [
				...messages,
				{ role: "user", text },
			];
			setMessages(newMessages);
			setInput("");
			setIsLoading(true);

			try {
				if (!baseStats) {
					await new Promise((resolve) => setTimeout(resolve, 600));
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
					// 新しい入力はCloud Functions側で末尾に結合されるため、historyには含めない
					history: messages.slice(-5).map((msg) => ({
						role: msg.role,
						text: msg.text,
					})),
					baseStats: baseStats,
					relevantData: relevantData,
				};

				const rawResponse = await callAdvisorApi(payload);
				const response = rawResponse as unknown as Record<
					string,
					unknown
				>;

				const adviceText =
					(response.adviceText as string) ||
					(typeof rawResponse === "string"
						? rawResponse
						: JSON.stringify(response));

				// レスポンスから構造化データを抽出
				const modelMessage: AdvisorMessage = {
					role: "model",
					text: adviceText,
					alertLevel:
						(response.alertLevel as AdvisorMessage["alertLevel"]) ||
						"safe",
					analysisPoints: Array.isArray(response.analysisPoints)
						? (response.analysisPoints as AdvisorMessage["analysisPoints"])
						: [],
				};
				setMessages((prev) => [...prev, modelMessage]);
			} catch (error) {
				setMessages((prev) => [
					...prev,
					{
						role: "model",
						text:
							error instanceof Error
								? error.message
								: String(error),
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
			transactions,
			categories,
			getCategoryName,
		],
	);

	useEffect(() => {
		if (isOpen && messages.length === 0) {
			startConversation();
		}
	}, [isOpen, messages.length, startConversation]);

	return {
		isOpen,
		setIsOpen,
		messages,
		input,
		setInput,
		isLoading,
		chatLogRef: chatLogRef as MutableRefObject<HTMLDivElement | null>,
		handleUserSubmit,
	};
}
