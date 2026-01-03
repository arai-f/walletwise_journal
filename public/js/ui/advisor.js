import { getGenerativeModel, vertexAI } from "../firebase.js";
import * as utils from "../utils.js";

/**
 * AIアドバイザー機能（チャットボット版）。
 * データ分析（先月比較など）に対応し、ステータス表示をチャット内に統合する。
 * @module ui/advisor
 */
const model = getGenerativeModel(vertexAI, {
	model: "gemini-2.5-flash",
	safetySettings: [
		{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
		{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
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

/**
 * ユーザーに提示する提案チップのリスト。
 * クリックすることで定型文を送信できる。
 * @type {Array<{label: string, text: string}>}
 */
const SUGGESTIONS = [
	{ label: "🍔 食費の内訳は？", text: "直近の食費の内訳を教えて" },
	{
		label: "💰 節約のアドバイス",
		text: "この家計簿を見て、節約できるポイントを具体的に教えて",
	},
	{ label: "📊 先月との比較", text: "先月と比べて支出はどう変化してる？" },
	{ label: "🔮 来月の予測", text: "今のペースだと来月はどうなりそう？" },
];

/**
 * チャット入力中インジケーターの要素ID。
 * @type {string}
 */
const TYPING_INDICATOR_ID = "advisor-typing-indicator";

/**
 * 既に初期化済みかどうかのフラグ。
 * 多重登録を防ぐために使用される。
 * @type {boolean}
 */
let isInitialized = false;

/**
 * 解析中かどうかのフラグ。
 * 解析実行中に多重で解析を開始したり、UI操作を受け付けたりするのを防ぐ。
 * @type {boolean}
 */
let isAnalyzing = false;

/**
 * 会話開始中かどうかのフラグ。
 * 初回起動時の会話開始処理の多重実行を防ぐために使用される。
 * @type {boolean}
 */
let isStarting = false;

/**
 * チャット履歴の配列
 * @type {Array<{role: 'user'|'model', parts: Array<{text: string}>}>}
 */
let chatHistory = [];

/**
 * 共有される取引データ
 * @type {Array<object>}
 */
let sharedTransactions = [];

/**
 * 共有されるカテゴリデータ
 * @type {Object<string, object>}
 */
let sharedCategories = {};

/**
 * UI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
	card: utils.dom.get("ai-advisor-card"),
	header: utils.dom.get("advisor-header"),
	content: utils.dom.get("advisor-content"),
	toggleIcon: utils.dom.get("advisor-toggle-icon"),
	chatLog: utils.dom.get("advisor-chat-log"),
	suggestions: utils.dom.get("advisor-suggestions"),
	input: utils.dom.get("advisor-input"),
	sendButton: utils.dom.get("advisor-send-button"),
});

/**
 * 初期化処理。イベントリスナーを設定する。
 * 提案チップを描画し、UIイベントをバインドする。
 * 多重登録を防ぐため、一度だけ実行されるように制御する。
 * @returns {void}
 */
export function init() {
	if (isInitialized) return;

	const { header, input, sendButton } = getElements();

	if (header) {
		header.addEventListener("click", () => toggleAdvisor());
	}

	if (sendButton) {
		sendButton.addEventListener("click", () => handleUserSubmit());
	}

	if (input) {
		input.addEventListener("keypress", (e) => {
			if (e.key === "Enter") handleUserSubmit();
		});
		input.addEventListener("input", () => {
			sendButton.disabled = !input.value.trim() || isAnalyzing;
		});
	}

	renderSuggestionChips();
	isInitialized = true;
}

/**
 * 設定に基づいてAIアドバイザーの表示状態を更新する。
 * 機能が無効化されている場合は非表示にする。
 * @param {object} config - アプリケーション設定オブジェクト。
 * @returns {void}
 */
export function render(config) {
	const { card } = getElements();

	if (!config || !config.general?.enableAiAdvisor) {
		if (card) card.classList.add("hidden");
		return;
	}

	if (card) card.classList.remove("hidden");

	localStorage.removeItem("walletwise_advisor_expanded");
	toggleAdvisor(false);
}

/**
 * 取引データとカテゴリデータを共有変数に設定する。
 * これにより、チャット処理関数が最新のデータにアクセスできるようになる。
 * @param {Array<object>} transactions - 取引データの配列。
 * @param {Object<string, object>} categories - カテゴリデータのマッピングオブジェクト。
 * @returns {void}
 */
export function setContext(transactions, categories) {
	sharedTransactions = transactions || [];
	sharedCategories = categories || {};
}

/**
 * 会話を開始し、初期分析結果に基づいた挨拶を表示する。
 * 履歴がない場合のみ実行され、直近のデータを分析してユーザーに話しかける。
 * @async
 * @returns {Promise<void>}
 * @fires VertexAI - Gemini APIを呼び出す。
 */
async function startConversation() {
	if (chatHistory.length > 0 || isAnalyzing || isStarting) return;

	isStarting = true;
	const { chatLog } = getElements();
	if (chatLog) chatLog.innerHTML = "";

	chatHistory = [];

	// 初回はインジケーターを表示して待機
	showTypingIndicator();
	setLoadingState(true);

	try {
		const summary = await prepareSummaryData();
		if (!summary) {
			removeTypingIndicator();
			appendMessage(
				"model",
				"データがまだないようですね。取引を入力すると分析できるようになります！"
			);
			setLoadingState(false);
			isStarting = false;
			return;
		}

		const prompt = `あなたは親しみやすいファイナンシャルプランナーです。
        以下の家計簿データ（現在表示中の期間）を分析し、ユーザーに最初の挨拶を行ってください。
        
        【データ概要】
        ${JSON.stringify(summary.overview)}
        
        【要件】
        - 「こんにちは！」で始める。
        - 収支の全体感（黒字/赤字）を一言で伝える。
        - 比較可能なデータがあれば変化に触れる。
        - 150文字以内で簡潔に。
        - 太字や箇条書きなどのMarkdown記法は使わず、プレーンテキストで出力する。
        `;

		const response = await callGemini(prompt);
		removeTypingIndicator();
		appendMessage("model", response);
		chatHistory.push({ role: "model", parts: [{ text: response }] });
	} catch (e) {
		console.error(e);
		removeTypingIndicator();
		appendMessage("model", "すみません、うまく起動できませんでした。");
	} finally {
		setLoadingState(false);
		isStarting = false;
	}
}

/**
 * ユーザーの入力を処理し、AIからの応答を取得して表示する。
 * 入力内容をチャットログに追加し、Gemini APIを呼び出して回答を生成する。
 * @async
 * @param {string|null} [forcedText=null] - 提案チップなどから直接入力させるテキスト。nullの場合は入力欄の値を使用する。
 * @returns {Promise<void>}
 * @fires VertexAI - Gemini APIを呼び出す。
 */
async function handleUserSubmit(forcedText = null) {
	const { input } = getElements();
	const text = forcedText || input?.value.trim();

	if (!text || isAnalyzing) return;

	if (input) input.value = "";
	appendMessage("user", text);

	// AIの入力中表示を開始
	showTypingIndicator();
	setLoadingState(true);

	try {
		const data = await prepareSummaryData();

		const systemContext = `
        【役割】
        あなたはユーザー専属のFP「WalletWise AI」です。
        提供された家計簿データ（ユーザーが表示中の期間）を元に、分析・アドバイス・質問への回答を行います。
        
        【家計簿サマリー】
        ${JSON.stringify(data.overview, null, 2)}
        
        【取引詳細リスト (日付 | カテゴリ | 金額 | 詳細)】
        ${data.transactionsList}
        
        【重要：データ範囲について】
        提供されているデータは「現在表示期間内の全データ」です。
        ユーザーが画面上で「食費のみ」などに絞り込んでいる場合でも、あなたは**ここにある全データを元に**回答してください。
        
        【対応方針】
        - ユーザーから「食費の内訳は？」や「先月と比較して？」と聞かれたら、上記の取引詳細リストから計算して答えてください。
          ※リストにない期間のデータについては「現在表示されているデータには含まれていません」と答えてください。
        - アプリの操作はできません。
        - 設定変更は「設定画面」へ案内してください。
        
        【回答要件】
        - 日本語で、200文字以内で簡潔に。
        - 親しみやすい口調（「です・ます」調）で。
		- 太字や箇条書きなどのMarkdown記法は使用せず、プレーンテキストのみで出力する。
        `;

		let prompt = systemContext + "\n\n【これまでの会話】\n";
		chatHistory.slice(-6).forEach((msg) => {
			const roleLabel = msg.role === "user" ? "User" : "AI";
			prompt += `${roleLabel}: ${msg.parts[0].text}\n`;
		});
		prompt += `\nUser: ${text}\nAI:`;

		const responseText = await callGemini(prompt);

		if (!responseText) {
			throw new Error("SafetyBlock");
		}

		removeTypingIndicator();
		appendMessage("model", responseText);
		chatHistory.push({ role: "user", parts: [{ text: text }] });
		chatHistory.push({ role: "model", parts: [{ text: responseText }] });
	} catch (error) {
		console.error("[Chat Error] ", error);
		removeTypingIndicator();

		if (error.message === "SafetyBlock" || error.message.includes("SAFETY")) {
			appendMessage(
				"model",
				"申し訳ありませんが、その内容にはお答えできません。（安全フィルターによりブロックされました）"
			);
		} else {
			appendMessage("model", "エラーが発生しました。もう一度お試しください。");
		}
	} finally {
		setLoadingState(false);
	}
}

/**
 * チャットログ内に「入力中...」のアニメーションを表示する。
 * AIが応答生成中であることをユーザーに示す。
 * @returns {void}
 */
function showTypingIndicator() {
	const { chatLog } = getElements();
	if (!chatLog) return;

	// 既にある場合は何もしない
	if (document.getElementById(TYPING_INDICATOR_ID)) return;

	const wrapper = document.createElement("div");
	wrapper.id = TYPING_INDICATOR_ID;
	wrapper.className = "flex w-full justify-start";

	// アニメーションするドット
	const bubble = document.createElement("div");
	bubble.className =
		"bg-neutral-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1 min-w-[3rem]";
	bubble.innerHTML = `
        <div class="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
        <div class="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
        <div class="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
    `;

	wrapper.appendChild(bubble);
	chatLog.appendChild(wrapper);
	scrollToBottom();
}

/**
 * 「入力中...」のアニメーションを削除する。
 * @returns {void}
 */
function removeTypingIndicator() {
	const indicator = document.getElementById(TYPING_INDICATOR_ID);
	if (indicator) {
		indicator.remove();
	}
}

/**
 * チャットログにメッセージを追加する。
 * モデルからの応答の場合はタイプライター風のアニメーションを適用する。
 * @param {'user'|'model'} role - メッセージの送信者。
 * @param {string} text - メッセージ本文。
 * @returns {void}
 */
function appendMessage(role, text) {
	const { chatLog } = getElements();
	if (!chatLog) return;

	const wrapper = document.createElement("div");
	wrapper.className = `flex w-full ${
		role === "user" ? "justify-end" : "justify-start"
	}`;

	const bubble = document.createElement("div");
	if (role === "user") {
		bubble.className =
			"bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-sm max-w-[85%] shadow-sm";
	} else {
		bubble.className =
			"bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm max-w-[90%] font-medium leading-relaxed shadow-sm";
	}

	wrapper.appendChild(bubble);
	chatLog.appendChild(wrapper);

	if (role === "model") {
		typeWriter(bubble, text, () => scrollToBottom());
	} else {
		bubble.textContent = text;
		scrollToBottom();
	}
}

/**
 * テキストをタイプライター風に1文字ずつ表示する。
 * @param {HTMLElement} element - テキストを表示する要素。
 * @param {string} text - 表示するテキスト全文。
 * @param {function} [onUpdate] - 文字が追加されるたびに呼ばれるコールバック（スクロール用）。
 * @returns {void}
 */
function typeWriter(element, text, onUpdate) {
	element.textContent = "";
	let i = 0;
	const speed = 20;

	const cursor = document.createElement("span");
	cursor.className =
		"inline-block w-2 h-4 bg-indigo-500 ml-1 align-middle animate-pulse";

	function type() {
		if (i < text.length) {
			element.textContent = text.substring(0, i + 1);
			element.appendChild(cursor);
			i++;
			if (onUpdate) onUpdate();
			setTimeout(type, speed);
		} else {
			if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
		}
	}
	type();
}

/**
 * チャットログを最下部までスクロールする。
 * @returns {void}
 */
function scrollToBottom() {
	const { chatLog } = getElements();
	if (chatLog) {
		chatLog.scrollTop = chatLog.scrollHeight;
	}
}

/**
 * UIのローディング状態（入力不可など）を切り替える。
 * @param {boolean} isLoading - ローディング中かどうか。
 * @returns {void}
 */
function setLoadingState(isLoading) {
	const { input, sendButton } = getElements();
	isAnalyzing = isLoading;

	if (input) {
		input.disabled = isLoading;
		if (!isLoading) input.focus();
	}
	if (sendButton) {
		sendButton.disabled = isLoading || (input && !input.value.trim());
		sendButton.innerHTML = isLoading
			? '<i class="fas fa-spinner fa-spin text-sm"></i>'
			: '<i class="fas fa-paper-plane text-sm"></i>';
	}
}

/**
 * 提案チップ（サジェストボタン）を描画する。
 * @returns {void}
 */
function renderSuggestionChips() {
	const { suggestions } = getElements();
	if (!suggestions) return;

	suggestions.innerHTML = "";
	SUGGESTIONS.forEach((item) => {
		const btn = document.createElement("button");
		btn.className =
			"flex-shrink-0 bg-neutral-50 border border-neutral-200 text-neutral-600 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95";
		btn.textContent = item.label;
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			if (isAnalyzing) return;
			handleUserSubmit(item.text);
		});
		suggestions.appendChild(btn);
	});
}

/**
 * Vertex AI Gemini APIを呼び出し、テキスト生成を行う。
 * 安全性フィルターによるブロックをハンドリングする。
 * @async
 * @param {string} prompt - 生成に使用するプロンプト。
 * @returns {Promise<string>} 生成されたテキスト。
 * @throws {Error} APIエラーまたは安全性ブロック時にエラーを投げる。
 */
async function callGemini(prompt) {
	try {
		const result = await model.generateContent(prompt);
		const response = await result.response;
		if (response.promptFeedback && response.promptFeedback.blockReason) {
			throw new Error("SafetyBlock: " + response.promptFeedback.blockReason);
		}
		return response.text().trim();
	} catch (error) {
		console.error("[Chat Error] Gemini API Error:", error);
		throw error;
	}
}

/**
 * 直近の取引データを取得し、プロンプト用のサマリー情報を生成する。
 * @async
 * @returns {Promise<object|null>} サマリー情報と取引リストを含むオブジェクト。データがない場合はnull。
 * @fires Firestore - 取引データとカテゴリデータを取得する。
 */
async function prepareSummaryData() {
	const transactions = sharedTransactions;
	const categories = sharedCategories;

	if (transactions.length === 0) return null;

	let totalIncome = 0;
	let totalExpense = 0;
	const categoryTotals = {};
	let transactionsList = "";

	// 直近300件の取引を日付降順で処理
	const sortedTransactions = [...transactions]
		.sort((a, b) => b.date - a.date)
		.slice(0, 300);

	sortedTransactions.forEach((t) => {
		const amount = Number(t.amount);
		const cat = categories.get(t.categoryId);
		const catName = cat ? cat.name : "不明";

		if (t.type === "income") {
			totalIncome += amount;
		} else if (t.type === "expense") {
			totalExpense += amount;
			categoryTotals[catName] = (categoryTotals[catName] || 0) + amount;
		}
		const desc = t.description || t.memo || "";
		transactionsList += `${t.date} | ${
			t.type === "income" ? "(収)" : ""
		}${catName} | ${amount} | ${desc}\n`;
	});

	const sortedCategories = Object.entries(categoryTotals)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5)
		.map(([name, amount]) => ({ name, amount }));

	return {
		overview: {
			period: "直近2ヶ月",
			totalIncome,
			totalExpense,
			balance: totalIncome - totalExpense,
			topExpenses: sortedCategories,
		},
		transactionsList: transactionsList,
	};
}

/**
 * AIアドバイザーパネルの表示/非表示を切り替える。
 * 表示時には必要に応じて会話を開始する。
 * @param {boolean|null} [forceState=null] - 強制的に表示(true)または非表示(false)にする。nullの場合はトグル。
 * @returns {void}
 */
function toggleAdvisor(forceState = null) {
	const { content, toggleIcon } = getElements();
	if (!content || !toggleIcon) return;

	const isHidden = content.classList.contains("hidden");
	const shouldOpen = forceState !== null ? forceState : isHidden;

	if (shouldOpen) {
		content.classList.remove("hidden");
		toggleIcon.classList.remove("-rotate-90");

		if (chatHistory.length === 0) {
			startConversation();
		}
	} else {
		content.classList.add("hidden");
		toggleIcon.classList.add("-rotate-90");
	}
}
