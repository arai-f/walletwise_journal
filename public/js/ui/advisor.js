import { getGenerativeModel, vertexAI } from "../firebase.js";
import * as store from "../store.js";
import * as utils from "../utils.js";

/**
 * AIアドバイザー機能を提供するモジュール。
 * 取引履歴を分析し、Geminiを使用してアドバイスを生成する。
 * @module ui/advisor
 */
const model = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });

let isInitialized = false;
let isAnalyzing = false;

/**
 * UI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
	card: document.getElementById("ai-advisor-card"),
	header: document.getElementById("advisor-header"),
	content: document.getElementById("advisor-content"),
	toggleIcon: document.getElementById("advisor-toggle-icon"),
	message: document.getElementById("advisor-message"),
	date: document.getElementById("advisor-date"),
	refreshButton: document.getElementById("advisor-refresh-button"),
});

/**
 * 初期化処理。イベントリスナーを設定する。
 * 多重登録を防ぐため、一度だけ実行されるように制御する。
 * @returns {void}
 */
export function init() {
	if (isInitialized) return;

	const { refreshButton, header } = getElements();

	// 折りたたみ機能のイベントリスナー
	if (header) {
		header.addEventListener("click", () => {
			toggleAdvisor();
		});
	}

	if (refreshButton) {
		refreshButton.addEventListener("click", async (e) => {
			// 親要素へのイベント伝播を止める（ヘッダー内にある場合など）
			e.stopPropagation();

			if (isAnalyzing) return;

			const els = getElements();
			const btn = els.refreshButton;

			try {
				isAnalyzing = true;
				if (btn) {
					btn.disabled = true;
					btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
				}
				await updateAdvice(true); // 強制更新
			} catch (error) {
				console.error("Advice update failed:", error);
				alert("アドバイスの更新に失敗しました。");
			} finally {
				isAnalyzing = false;
				// ボタンの状態を再取得して復帰させる
				const currentBtn = getElements().refreshButton;
				if (currentBtn) {
					currentBtn.disabled = false;
					currentBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 分析を更新';
				}
			}
		});
	}

	isInitialized = true;
}

/**
 * アドバイザーカードの折りたたみ状態を切り替える
 * @param {boolean|null} forceState - 強制的に設定する状態 (true: 開く, false: 閉じる, null: トグル)
 */
function toggleAdvisor(forceState = null) {
	const { content, toggleIcon } = getElements();
	if (!content || !toggleIcon) return;

	const isHidden = content.classList.contains("hidden");
	// forceStateが指定されていればそれに従う、なければ現在の状態を反転させる
	// forceState: true (開く) -> hiddenを削除
	// forceState: false (閉じる) -> hiddenを追加
	const shouldOpen = forceState !== null ? forceState : isHidden;

	if (shouldOpen) {
		// 開く
		content.classList.remove("hidden");
		toggleIcon.classList.remove("-rotate-90");
		localStorage.setItem("walletwise_advisor_expanded", "true");
	} else {
		// 閉じる
		content.classList.add("hidden");
		toggleIcon.classList.add("-rotate-90");
		localStorage.setItem("walletwise_advisor_expanded", "false");
	}
}

/**
 * アドバイスを表示する。
 * 保存されたアドバイスがあればそれを表示し、古ければ（または無ければ）新規生成を試みるか検討する。
 * @param {object} config - ユーザー設定オブジェクト（aiAdvisorデータを含む）
 * @returns {void}
 */
export function render(config) {
	const elements = getElements();

	// 設定で無効になっている場合は非表示にする
	if (!config || !config.general?.enableAiAdvisor) {
		if (elements.card) elements.card.classList.add("hidden");
		return;
	}

	const adviceData = config?.general?.aiAdvisor;

	if (elements.card) elements.card.classList.remove("hidden");

	// 折りたたみ状態の復元
	// デフォルトは「開く」(localStorageに値がない場合も含む)
	const savedState = localStorage.getItem("walletwise_advisor_expanded");
	const shouldBeExpanded = savedState !== "false";
	toggleAdvisor(shouldBeExpanded);

	if (adviceData && adviceData.message) {
		// keepAiMessagesが明示的にfalseの場合は表示しない
		if (config.general.keepAiMessages === false) {
			if (elements.message)
				elements.message.textContent =
					"「分析を更新」ボタンを押すと、最新のアドバイスを表示します。";
			if (elements.date) elements.date.textContent = "";
			return;
		}

		if (elements.message) elements.message.textContent = adviceData.message;

		if (adviceData.lastAnalyzedAt && elements.date) {
			// Firestore Timestamp or Date object
			const date = adviceData.lastAnalyzedAt.toDate
				? adviceData.lastAnalyzedAt.toDate()
				: new Date(adviceData.lastAnalyzedAt);
			elements.date.textContent = utils.formatDate(date) + " 更新";
		}
	} else {
		// データがない場合
		if (elements.message)
			elements.message.textContent =
				"取引履歴を分析して、家計のアドバイスを表示します。「分析を更新」ボタンを押してください。";
		if (elements.date) elements.date.textContent = "";
	}
}

/**
 * 定期的にアドバイスを更新する必要があるかチェックし、必要なら実行する。
 * @async
 * @param {object} config - ユーザー設定
 * @returns {Promise<void>}
 */
export async function checkAndRunAdvisor(config) {
	if (!config || !config.general?.enableAiAdvisor) return;
	if (isAnalyzing) return;

	const lastAnalyzedAt = config.general.aiAdvisor?.lastAnalyzedAt;
	const now = new Date();

	let shouldRun = false;

	if (!lastAnalyzedAt) {
		// 初回実行
		shouldRun = true;
	} else {
		// 前回実行から30日以上経過しているかチェック
		const lastDate = lastAnalyzedAt.toDate
			? lastAnalyzedAt.toDate()
			: new Date(lastAnalyzedAt);
		const diffTime = Math.abs(now - lastDate);
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays >= 30) {
			shouldRun = true;
		}
	}

	if (shouldRun) {
		console.info("[AI Advisor] 定期チェックを実行します...");
		const { refreshButton } = getElements();

		try {
			isAnalyzing = true;
			// UI上の更新ボタンをローディング状態にする（もし表示されていれば）
			if (refreshButton) {
				refreshButton.innerHTML =
					'<i class="fas fa-spinner fa-spin"></i> 自動更新中...';
				refreshButton.disabled = true;
			}

			await updateAdvice();
		} catch (error) {
			console.error("[AI Advisor] 自動更新に失敗しました:", error);
		} finally {
			isAnalyzing = false;
			const currentBtn = getElements().refreshButton;
			if (currentBtn) {
				currentBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 分析を更新';
				currentBtn.disabled = false;
			}
		}
	}
}

/**
 * アドバイスを新規生成して保存・表示する。
 * @param {boolean} force - 強制的に再生成するかどうか
 * @returns {Promise<void>}
 */
export async function updateAdvice(force = false) {
	// 1. データの取得 (過去1ヶ月分)
	const transactions = await store.fetchTransactionsForPeriod(1);
	const { categories } = await store.fetchAllUserData();

	if (transactions.length === 0) {
		const { message } = getElements();
		if (message)
			message.textContent =
				"分析に必要な取引データがありません。まずは取引を入力してください。";
		return;
	}

	// 2. データの集計
	const summary = summarizeTransactions(transactions, categories);

	// 3. Geminiによる生成
	const advice = await generateAdviceFromGemini(summary);

	// 4. 保存
	await store.saveAiAdvice(advice);

	// 5. 表示更新 (storeから再取得せず直接更新)
	const { message, date } = getElements();
	if (message) message.textContent = advice;
	if (date) date.textContent = utils.formatDate(new Date()) + " 更新";
}

/**
 * 取引データをAI分析用に集計する。
 * @param {Array<object>} transactions - 取引データの配列
 * @param {object} categories - カテゴリIDをキー、カテゴリ情報を値とするオブジェクト
 * @returns {object} 集計結果のオブジェクト
 */
function summarizeTransactions(transactions, categories) {
	let totalIncome = 0;
	let totalExpense = 0;
	const categoryTotals = {};

	transactions.forEach((t) => {
		const amount = Number(t.amount);
		if (t.type === "income") {
			totalIncome += amount;
		} else if (t.type === "expense") {
			totalExpense += amount;
			const catName = categories[t.categoryId]?.name || "不明";
			categoryTotals[catName] = (categoryTotals[catName] || 0) + amount;
		}
	});

	// カテゴリ別支出の降順ソート
	const sortedCategories = Object.entries(categoryTotals)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5) // Top 5
		.map(([name, amount]) => ({ name, amount }));

	return {
		period: "直近1ヶ月",
		totalIncome,
		totalExpense,
		balance: totalIncome - totalExpense,
		topExpenses: sortedCategories,
		transactionCount: transactions.length,
	};
}

/**
 * Gemini APIを呼び出してアドバイスを生成する。
 * @param {object} summary - 集計結果のオブジェクト
 * @returns {Promise<string>} 生成されたアドバイスのテキスト
 */
async function generateAdviceFromGemini(summary) {
	const prompt = `
    あなたはプロのファイナンシャルプランナーです。
    以下の家計簿データ（直近1ヶ月の収支）を分析し、ユーザーに対するアドバイスを日本語で作成してください。

    【データ】
    ${JSON.stringify(summary, null, 2)}

    【要件】
    1. 全体的な収支バランス（黒字か赤字か）についてコメントしてください。
    2. 支出の傾向（特に金額の大きいカテゴリ）について、改善点や気づきがあれば指摘してください。
    3. 順調であれば、その点を具体的に褒めてください。
    4. 150文字〜200文字程度で、簡潔かつ親しみやすい口調（「です・ます」調）でまとめてください。
    5. マークダウンやJSON形式ではなく、プレーンテキストで出力してください。
    `;

	try {
		// 30秒のタイムアウトを設定
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error("Request timed out")), 30000)
		);

		const result = await Promise.race([
			model.generateContent(prompt),
			timeoutPromise,
		]);

		const response = await result.response;
		return response.text().trim();
	} catch (error) {
		console.error("Gemini API Error:", error);
		throw new Error("AIによる分析に失敗しました。");
	}
}
