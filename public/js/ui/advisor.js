import { getGenerativeModel, vertexAI } from "../firebase.js";
import * as store from "../store.js";
import * as utils from "../utils.js";

/**
 * AIアドバイザー機能を提供するモジュール。
 * 取引履歴を分析し、Geminiを使用してアドバイスを生成する。
 * @module ui/advisor
 */
const model = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });

/**
 * UI要素のキャッシュ
 * @type {Object<string, HTMLElement>}
 */
const elements = {
	card: document.getElementById("ai-advisor-card"),
	message: document.getElementById("advisor-message"),
	date: document.getElementById("advisor-date"),
	refreshButton: document.getElementById("advisor-refresh-button"),
};

/**
 * 初期化処理。イベントリスナーを設定する。
 * @returns {void}
 */
export function init() {
	if (elements.refreshButton) {
		elements.refreshButton.addEventListener("click", async () => {
			const btn = elements.refreshButton;
			const originalContent = btn.innerHTML;
			try {
				btn.disabled = true;
				btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
				await updateAdvice(true); // 強制更新
			} catch (error) {
				console.error("Advice update failed:", error);
				alert("アドバイスの更新に失敗しました。");
			} finally {
				btn.disabled = false;
				btn.innerHTML = originalContent;
			}
		});
	}
}

/**
 * アドバイスを表示する。
 * 保存されたアドバイスがあればそれを表示し、古ければ（または無ければ）新規生成を試みるか検討する。
 * ここでは自動更新は行わず、表示のみを行う。自動更新ロジックは呼び出し元で制御する想定。
 * @param {object} config - ユーザー設定オブジェクト（aiAdvisorデータを含む）
 * @returns {void}
 */
export function render(config) {
	// 設定で無効になっている場合は非表示にする
	if (!config || !config.general?.enableAiAdvisor) {
		elements.card.classList.add("hidden");
		return;
	}

	const adviceData = config?.general?.aiAdvisor;

	if (adviceData && adviceData.message) {
		// メッセージ保持設定がOFFで、かつ分析から一定時間（例えば24時間）経過している場合は表示しない？
		// いや、ユーザー体験としてはいきなり消えるのは不親切なので、
		// 「保持しない」設定の場合は、アプリ起動時のrenderでは表示しない（checkAndRunAdvisorで新規生成された場合のみ表示される）
		// という挙動にするのが自然か。
		// ここではシンプルに、データがあれば表示する。制御は呼び出し元（main.js）やcheckAndRunAdvisorに任せる。

		// ただし、keepAiMessagesが明示的にfalseの場合は表示しない
		if (config.general.keepAiMessages === false) {
			// ただし、ついさっき生成されたばかり（例えばセッション内）なら表示したいが、
			// ここは永続化されたconfigを見ているので、セッション状態は持っていない。
			// 簡易的に「最終更新から1時間以内なら表示」などのロジックを入れるか、
			// あるいはmain.js側で制御するか。
			// 今回は「keepAiMessages: false」なら、起動時のrenderでは非表示（カード自体は出すがメッセージは空、または案内文）にする。
			elements.card.classList.remove("hidden");
			elements.message.textContent =
				"「分析を更新」ボタンを押すと、最新のアドバイスを表示します。";
			elements.date.textContent = "";
			return;
		}

		elements.card.classList.remove("hidden");
		elements.message.textContent = adviceData.message;

		if (adviceData.lastAnalyzedAt) {
			// Firestore Timestamp or Date object
			const date = adviceData.lastAnalyzedAt.toDate
				? adviceData.lastAnalyzedAt.toDate()
				: new Date(adviceData.lastAnalyzedAt);
			elements.date.textContent = utils.formatDate(date) + " 更新";
		}
	} else {
		// データがない場合は、初回分析を促す表示にするか、非表示のままにする
		// ここでは「分析を更新」ボタンを押してもらうためにカードを表示する
		elements.card.classList.remove("hidden");
		elements.message.textContent =
			"取引履歴を分析して、家計のアドバイスを表示します。「分析を更新」ボタンを押してください。";
		elements.date.textContent = "";
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
	if (!config || !config.general?.enableAiAdvisor) return;

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
		try {
			// UI上の更新ボタンをローディング状態にする（もし表示されていれば）
			if (elements.refreshButton) {
				elements.refreshButton.innerHTML =
					'<i class="fas fa-spinner fa-spin"></i> 自動更新中...';
				elements.refreshButton.disabled = true;
			}

			await updateAdvice();
		} catch (error) {
			console.error("[AI Advisor] 自動更新に失敗しました:", error);
		} finally {
			if (elements.refreshButton) {
				elements.refreshButton.innerHTML =
					'<i class="fas fa-sync-alt"></i> 分析を更新';
				elements.refreshButton.disabled = false;
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
		elements.message.textContent =
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
	elements.message.textContent = advice;
	elements.date.textContent = utils.formatDate(new Date()) + " 更新";
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
		const result = await model.generateContent(prompt);
		const response = await result.response;
		return response.text().trim();
	} catch (error) {
		console.error("Gemini API Error:", error);
		throw new Error("AIによる分析に失敗しました。");
	}
}
