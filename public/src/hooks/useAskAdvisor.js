import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	callAdvisorApi,
	getRelevantTransactions,
} from "../services/advisorService.js";
import * as utils from "../utils.js";

/**
 * AIアドバイザー機能のロジックと状態を管理するカスタムフック。
 * 会話の履歴、統計情報の計算、データの抽出、API呼び出しをカプセル化する。
 * @param {object} config - ユーザー設定。
 * @param {Array} transactions - 全取引データ。
 * @param {Map|object} categories - カテゴリデータ。
 * @returns {object} アドバイザーの状態と操作関数。
 */
export function useAskAdvisor(config, transactions, categories) {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const chatLogRef = useRef(null);
	const hasStartedRef = useRef(false);

	// 自動スクロール。
	useEffect(() => {
		if (chatLogRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
		}
	}, [messages, isLoading, isOpen]);

	// カテゴリ名取得ヘルパー。
	const getCategoryName = useCallback(
		(id) => {
			const cat =
				categories instanceof Map ? categories.get(id) : categories[id];
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
	 * 会話開始時の処理を行う。
	 * @async
	 */
	const startConversation = useCallback(async () => {
		if (hasStartedRef.current || messages.length > 0) return;

		hasStartedRef.current = true;
		setIsLoading(true);

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

			const payload = { isStart: true, baseStats: baseStats };
			const response = await callAdvisorApi(payload);
			setMessages([{ role: "model", text: response }]);
		} catch (e) {
			setMessages([
				{
					role: "model",
					text: e.message || "すみません、うまく起動できませんでした。",
				},
			]);
		} finally {
			setIsLoading(false);
		}
	}, [baseStats, messages.length]);

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

			try {
				if (!baseStats) {
					await new Promise((resolve) => setTimeout(resolve, 600));
					setMessages((prev) => [
						...prev,
						{
							role: "model",
							text: "まだ取引データが登録されていないため、分析やお答えができません。まずは取引を追加してみてください！",
						},
					]);
					return;
				}

				// ユーザーの質問に合わせてデータを動的に抽出する (RAG)。
				const relevantData = getRelevantTransactions(
					text,
					transactions,
					categories,
					getCategoryName,
				);

				const payload = {
					isStart: false,
					text: text,
					history: newMessages.slice(-6).map((msg) => ({
						role: msg.role,
						text: msg.text,
					})),
					baseStats: baseStats,
					relevantData: relevantData,
				};

				const response = await callAdvisorApi(payload);
				setMessages((prev) => [...prev, { role: "model", text: response }]);
			} catch (error) {
				setMessages((prev) => [
					...prev,
					{ role: "model", text: error.message },
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
		chatLogRef,
		handleUserSubmit,
	};
}
