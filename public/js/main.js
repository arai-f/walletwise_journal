import "@fortawesome/fontawesome-free/css/all.min.css";
import "../src/input.css";

import { deleteApp } from "firebase/app";
import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "firebase/auth";
import { deleteToken, getToken, onMessage } from "firebase/messaging";
import { config as defaultConfig } from "./config.js";
import { app, auth, firebaseConfig, messaging, vapidKey } from "./firebase.js";
import * as store from "./store.js";
import * as utils from "./utils.js";

// UI Modules
import { renderAccountBalances } from "../src/entries/accountBalances.jsx";
import { renderAdvisor } from "../src/entries/advisor.jsx";
import { renderAnalysisReport } from "../src/entries/analysisReport.jsx";
import { renderBillingList } from "../src/entries/billingList.jsx";
import { renderDashboardSummary } from "../src/entries/dashboardSummary.jsx";
import { renderHistoryChart } from "../src/entries/historyChart.jsx";
import * as modalManager from "../src/entries/modalManager.jsx";
import { renderSideMenu } from "../src/entries/sideMenu.jsx";
import * as modal from "../src/entries/transactionModal.jsx";
import * as notification from "./ui/notification.js";
import * as transactions from "./ui/transactions.js";

// 初期表示をフェードインさせる
setTimeout(() => {
	document.body.style.visibility = "visible";
	document.body.style.opacity = "1";
}, 100);

/* ==========================================================================
   State & Constants
   ========================================================================== */

/**
 * アプリケーション全体の状態を管理するオブジェクト。
 * コンポーネント間でのデータ共有や表示状態を一元管理する。
 * @type {object}
 */
const state = {
	luts: {
		accounts: new Map(),
		categories: new Map(),
	},
	config: {},
	accountBalances: {},
	transactions: [],
	monthlyStats: [], // サーバーから取得した月次統計（差分データ）
	historicalData: [], // クライアントで計算した履歴データ（純資産推移）
	isAmountMasked: false,
	pendingBillPayment: null,
	analysisMonth: "all-time",
	currentMonthFilter: "all-time",
	isSettingsOpen: false,
};

/**
 * 頻繁にアクセスするDOM要素をキャッシュするオブジェクト。
 * `cacheDomElements` 関数によって初期化される。
 * @type {object}
 */
const elements = {};

/* ==========================================================================
   Lazy Loading Modules
   ========================================================================== */

let settingsModule = null;
const loadSettings = async () => {
	if (!settingsModule) {
		settingsModule = await import("../src/entries/settings.jsx");
		settingsModule.init({
			getState: () => ({
				luts: state.luts,
				config: state.config,
				transactions: state.transactions,
				accountBalances: state.accountBalances,
			}),
			store,
			utils,
			refresh: refreshSettings,
			refreshApp: refreshSettings,
			reloadApp: () => location.reload(),
			requestNotification: handleNotificationRequest,
			disableNotification: handleNotificationDisable,
			openGuide: async () => {
				const guide = await loadGuide();
				await guide.openModal();
			},
			openTerms: async () => {
				const terms = await loadTerms();
				terms.openViewer();
			},
		});
	}
	return settingsModule;
};

const loadGuide = async () => {
	return {
		openModal: async (config) => {
			return modalManager.openGuideModal(config, handleNotificationRequest);
		},
	};
};

const loadReport = async () => {
	return {
		openModal: async () => {
			return modalManager.openReportModal(state.luts);
		},
		init: (luts) => {
			// no-op, integrated in main flow
		},
		isOpen: () => false, // Placeholder
	};
};

const loadTerms = async () => {
	return {
		openViewer: async () => {
			return modalManager.openTermsViewer();
		},
		openAgreement: async (onAgree, onDisagree) => {
			return modalManager.openTermsAgreement(onAgree, onDisagree);
		},
		close: () => {
			modalManager.closeTermsModal();
		},
		isOpen: () => false,
	};
};

let scanModule = null;
const loadScanModule = async () => {
	if (!scanModule) {
		scanModule = await import("../src/entries/scanModal.jsx");
		scanModule.init({
			getConfig: () => state.config,
			getLuts: () => state.luts,
			onSave: async (transactions) => {
				utils.dom.show(elements.loadingIndicator);
				try {
					const txns = Array.isArray(transactions)
						? transactions
						: [transactions];
					// Run in parallel
					await Promise.all(txns.map((tx) => store.saveTransaction(tx)));
					await loadData();
					notification.success(`${txns.length}件の取引を保存しました。`);
				} catch (e) {
					console.error(e);
					notification.error("保存できませんでした");
					throw e; // Propagate error so modal knows? Actually modal handled it via await.
				} finally {
					utils.dom.hide(elements.loadingIndicator);
				}
			},
		});
	}
	return scanModule;
};

/* ==========================================================================
   Helper Functions (Logic)
   ========================================================================== */

/**
 * 頻繁に使用するDOM要素を取得し、キャッシュする。
 * DOM探索のオーバーヘッドを削減するために、初期化時に実行する。
 * @returns {void}
 */
function cacheDomElements() {
	Object.assign(elements, {
		authContainer: utils.dom.get("auth-container"),
		authScreen: utils.dom.get("auth-screen"),
		mainContent: utils.dom.get("main-content"),
		loginContainer: utils.dom.get("login-container"),
		loginButton: utils.dom.get("login-button"),
		loadingIndicator: utils.dom.get("loading-indicator"),
		updateIndicator: utils.dom.get("update-indicator"),
		lastUpdatedTime: utils.dom.get("last-updated-time"),
		refreshDataButton: utils.dom.get("refresh-data-button"),
		refreshIcon: utils.dom.get("refresh-icon"),
	});
}

/**
 * 請求計算に必要な最大月数を計算する。
 * クレジットカードの支払いサイクルを考慮し、未払いの可能性がある期間をカバーする。
 * @returns {number} 必要な月数（最低3ヶ月）。
 */
const getBillingNeededMonths = () => {
	const rules = state.config.creditCardRules || {};
	let maxOffset = 0;
	for (const rule of Object.values(rules)) {
		// 締め日から支払日まで最大で paymentMonthOffset + 1ヶ月程度かかるため、余裕を持って +2 とする
		const offset = (rule.paymentMonthOffset || 0) + 2;
		if (offset > maxOffset) maxOffset = offset;
	}
	return Math.max(maxOffset, 3);
};

/**
 * 指定された月の取引のみをフィルタリングする。
 * @param {Array<object>} transactions - フィルタリング対象の取引配列。
 * @param {string} monthFilter - "YYYY-MM"形式の月、または "all-time"。
 * @returns {Array<object>} フィルタリングされた取引配列。
 */
function filterTransactionsByMonth(transactions, monthFilter) {
	if (monthFilter === "all-time") {
		return transactions;
	}
	const [year, month] = monthFilter.split("-").map(Number);
	return transactions.filter((t) => {
		const yyyymm = utils.toYYYYMM(t.date);
		const [tYear, tMonth] = yyyymm.split("-").map(Number);
		return tYear === year && tMonth === month;
	});
}

/* ==========================================================================
   UI Update Functions
   ========================================================================== */

/**
 * 最終データ取得時刻をUIに表示する。
 * ユーザーにデータの鮮度を伝え、手動更新の必要性を判断させる。
 * @returns {void}
 */
function updateLastUpdatedTime() {
	const now = new Date();
	const timeString = now.toLocaleTimeString("ja-JP", {
		hour: "2-digit",
		minute: "2-digit",
	});

	// ヘッダーの時刻を更新 (PC用)
	utils.dom.setText(elements.lastUpdatedTime, `最終取得: ${timeString}`);
	utils.dom.show(elements.lastUpdatedTime);

	// サイドメニューの時刻を更新 (モバイル用)
	utils.dom.setText("menu-last-updated", `最終取得: ${timeString}`);
}

/**
 * 取引データから年月を抽出し、期間フィルターのドロップダウン選択肢を生成・更新する。
 * 取引が存在する月のみを選択肢として表示する。
 * @param {Array<object>} transactionsData - 取引データの配列。
 * @returns {void}
 */
function populateMonthSelectors(transactionsData) {
	const months = [
		...new Set(transactionsData.map((t) => utils.toYYYYMM(t.date))),
	];
	months.sort().reverse();

	let periodLabel = "全期間";
	const displayPeriod = state.config.displayPeriod || 3;
	if (displayPeriod) {
		periodLabel = displayPeriod === 12 ? "過去1年" : `過去${displayPeriod}ヶ月`;
	}

	const optionsHtml =
		`<option value="all-time">${periodLabel}</option>` +
		months
			.map((m) => `<option value="${m}">${m.replace("-", "年")}月</option>`)
			.join("");

	transactions.updateMonthSelector(optionsHtml, state.currentMonthFilter);
}

/**
 * 現在のstateとフィルター条件に基づいて、各UIコンポーネントを描画する。
 * データの変更やフィルター操作時に呼び出され、画面全体を最新の状態に更新する。
 * @returns {void}
 */
function renderUI() {
	// 表示期間内のデータのみを抽出
	const displayMonths = state.config.displayPeriod || 3;
	const displayStartDate = utils.getStartOfMonthAgo(displayMonths);
	const visibleTransactions = state.transactions.filter(
		(t) => t.date >= displayStartDate
	);
	const listTargetTransactions = filterTransactionsByMonth(
		visibleTransactions,
		state.currentMonthFilter
	);
	const filteredTransactions = transactions.applyFilters(
		listTargetTransactions
	);
	const analysisTargetTransactions = filterTransactionsByMonth(
		visibleTransactions,
		state.analysisMonth || "all-time"
	);

	let currentNetWorth = Object.values(state.accountBalances || {}).reduce(
		(sum, val) => sum + val,
		0
	);

	const historicalData = [];
	const stats = [...state.monthlyStats];
	const currentMonth = utils.toYYYYMM(new Date());

	// 統計データに今月が含まれていない場合、プレースホルダーを適切な位置に挿入する
	// (未来のデータがある場合でも順序を崩さないようにするため)
	if (!stats.some((s) => s.month === currentMonth)) {
		const currentMonthData = {
			month: currentMonth,
			income: 0,
			expense: 0,
			netChange: 0,
		};

		// 降順（新しい順）を維持して挿入位置を探す
		const insertIndex = stats.findIndex((s) => s.month < currentMonth);
		if (insertIndex === -1) {
			// 今月より古いデータがない（空、または全て未来）場合は末尾に追加
			stats.push(currentMonthData);
		} else {
			// 今月より古いデータの直前に挿入
			stats.splice(insertIndex, 0, currentMonthData);
		}
	}

	for (const stat of stats) {
		historicalData.push({
			month: stat.month,
			netWorth: currentNetWorth,
			income: stat.income || 0,
			expense: stat.expense || 0,
			isFuture: stat.month > currentMonth,
		});
		currentNetWorth -= stat.netChange || 0;
	}

	// グラフ表示用に古い順に並べ替え
	state.historicalData = historicalData.reverse();

	let displayHistoricalData = [...state.historicalData];

	// 表示期間に合わせてフィルタリング
	const startMonthStr = utils.toYYYYMM(displayStartDate);
	displayHistoricalData = displayHistoricalData.filter(
		(d) => d.month >= startMonthStr
	);

	// 各UIモジュールの描画
	renderDashboardSummary("dashboard-total-assets", {
		accountBalances: state.accountBalances,
		isMasked: state.isAmountMasked,
		luts: state.luts,
	});
	transactions.render(filteredTransactions, state.isAmountMasked);

	const hasEnoughHistoryData =
		displayHistoricalData &&
		displayHistoricalData.length > 0 &&
		displayHistoricalData.some(
			(d) => d.netWorth !== 0 || d.income !== 0 || d.expense !== 0
		);

	renderAnalysisReport("analysis-report-root", {
		transactions: analysisTargetTransactions,
		historicalData: displayHistoricalData,
		isMasked: state.isAmountMasked,
		initialMonth: state.analysisMonth,
		availableMonths: utils.getAvailableMonths
			? utils.getAvailableMonths(state.transactions)
			: [], // Need to pass available months for dropdown
		luts: state.luts,
		onMonthFilterChange: (newMonth) => {
			state.analysisMonth = newMonth;
			renderUI();
		},
	});

	// History chart was rendered inside analysis.render previously IF hasEnoughData.
	// Now we render it directly.
	if (hasEnoughHistoryData) {
		renderHistoryChart("history-chart-container", {
			historicalData: displayHistoricalData,
			isMasked: state.isAmountMasked,
		});
		utils.dom.show(document.getElementById("history-chart-scroll-container"));
		utils.dom.hide(document.getElementById("history-chart-placeholder"));
	} else {
		// Clean up chart if needed or show placeholder
		// Note: renderHistoryChart currently mounts a React component.
		// If we don't call it, the old one might persist if we don't unmount or hide container?
		// Actually, React root persists.
		// We should probably always render renderHistoryChart but pass empty data or handle it.
		// Or toggle visibility of container as before.
		utils.dom.hide(document.getElementById("history-chart-scroll-container"));
		utils.dom.show(document.getElementById("history-chart-placeholder"));
	}

	renderAccountBalances("balances-grid", {
		accountBalances: state.accountBalances,
		isMasked: state.isAmountMasked,
		transactions: state.transactions,
		accountsMap: state.luts.accounts,
	});

	// 請求計算に必要な期間が現在の表示期間を超えているかチェック
	const neededMonths = getBillingNeededMonths();
	const currentMonths = state.config.displayPeriod || 3;
	const isDataInsufficient = neededMonths > currentMonths;

	renderBillingList("billing-list", {
		transactions: state.transactions,
		creditCardRules: state.config.creditCardRules || {},
		isMasked: state.isAmountMasked,
		luts: state.luts,
		isDataInsufficient: isDataInsufficient,
		onRecordPayment: (data) => {
			state.pendingBillPayment = {
				paymentTargetCardId: data.toAccountId,
				paymentTargetClosingDate: data.closingDateStr,
			};
			modal.openModal(null, {
				type: "transfer",
				date: data.paymentDate,
				amount: data.amount,
				fromAccountId: data.defaultAccountId,
				toAccountId: data.toAccountId,
				description: `${data.cardName} (${data.formattedClosingDate}締分) 支払い`,
			});
		},
		onOpenSettings: async () => {
			const settings = await loadSettings();
			settings.openModal();
		},
	});

	// AIアドバイザーの描画 (React)
	renderAdvisor("ai-advisor-card-container", {
		config: state.config,
		transactions: state.transactions,
		categories: state.luts.categories,
	});

	// サイドメニューの描画 (React)
	renderSideMenu("side-menu-container", {
		isVisible: true, // Main UI rendered means menu should be accessible
		user: auth.currentUser,
		isMasked: state.isAmountMasked,
		appVersion: defaultConfig.appVersion,
		lastUpdated: elements.lastUpdatedTime.textContent.replace("最終取得: ", ""),
		onMaskChange: (isMasked) => {
			state.isAmountMasked = isMasked;
			renderUI();
		},
		onLogout: () => signOut(auth),
		onOpenSettings: async () => {
			const settings = await loadSettings();
			settings.openModal();
		},
		onOpenGuide: async () => {
			const guide = await loadGuide();
			await guide.openModal();
		},
		onOpenTerms: async () => {
			const terms = await loadTerms();
			terms.openViewer();
		},
		onOpenReport: async () => {
			const report = await loadReport();
			report.openModal();
		},
	});

	// サイドメニューの描画 (React)
	renderSideMenu("side-menu-container", {
		isVisible: true, // Main UI rendered means menu should be accessible
		user: auth.currentUser,
		isMasked: state.isAmountMasked,
		appVersion: defaultConfig.appVersion,
		lastUpdated: elements.lastUpdatedTime.textContent.replace("最終取得: ", ""),
		onMaskChange: (isMasked) => {
			state.isAmountMasked = isMasked;
			renderUI();
		},
		onLogout: () => signOut(auth),
		onOpenSettings: async () => {
			const settings = await loadSettings();
			settings.openModal();
		},
		onOpenGuide: async () => {
			const guide = await loadGuide();
			await guide.openModal();
		},
		onOpenTerms: async () => {
			const terms = await loadTerms();
			terms.openViewer();
		},
		onOpenReport: async () => {
			const report = await loadReport();
			report.openModal();
		},
	});
}

/* ==========================================================================
   Data Loading Functions
   ========================================================================== */

/**
 * ユーザーの基本データ（口座、カテゴリ、設定）をFirestoreから取得し、stateを更新する。
 * @async
 * @returns {Promise<void>}
 */
async function loadLutsAndConfig() {
	const { accounts, categories, config } = await store.fetchAllUserData();

	state.luts.accounts.clear();
	for (const id in accounts) {
		state.luts.accounts.set(id, { id, ...accounts[id] });
	}

	state.luts.categories.clear();
	for (const id in categories) {
		state.luts.categories.set(id, { id, ...categories[id] });
	}

	state.config = config;
	console.debug("[Main] 設定とマスタデータを読み込みました");
}

/**
 * 取引と残高データをFirestoreから読み込み、UIを再描画する。
 * @async
 * @returns {Promise<void>}
 */
async function loadData() {
	elements.refreshIcon.classList.add("spin-animation");

	state.transactions = await store.fetchTransactionsForPeriod(
		state.config.displayPeriod || 3
	);

	state.accountBalances = await store.fetchAccountBalances();
	populateMonthSelectors(state.transactions);

	renderAdvisor("ai-advisor-card-container", {
		config: state.config,
		transactions: state.transactions,
		categories: state.luts.categories,
	});

	renderUI();

	elements.refreshIcon.classList.remove("spin-animation");
	updateLastUpdatedTime();
}

/**
 * 設定変更後の共通リフレッシュ処理を行う。
 * @async
 * @param {boolean} shouldReloadData - 取引データも再読み込みするかどうか。
 * @returns {Promise<void>}
 */
async function refreshSettings(shouldReloadData = false) {
	await loadLutsAndConfig();
	if (shouldReloadData) {
		await loadData();
	} else {
		renderAdvisor("ai-advisor-card-container", {
			config: state.config,
			transactions: state.transactions,
			categories: state.luts.categories,
		});
		renderUI();
		transactions.populateFilterDropdowns();
	}
}

/* ==========================================================================
   Event Handlers
   ========================================================================== */

/**
 * Google認証のポップアップを表示し、ログイン処理を開始する。
 * @returns {void}
 * @fires Firebase Auth - `signInWithPopup`
 */
function handleLogin() {
	const provider = new GoogleAuthProvider();
	signInWithPopup(auth, provider).catch((err) =>
		console.error("[Auth] ログインエラー:", err)
	);
}

/**
 * 取引フォームの送信を処理する。
 * 入力値の検証、確認ダイアログの表示、データの保存を行う。
 * @async
 * @param {HTMLFormElement} form - 送信されたフォーム要素。
 * @returns {Promise<void>}
 */
async function handleFormSubmit(formData) {
	// フォームデータの正規化
	let rawData = {};
	if (formData.tagName === "FORM") {
		rawData = {
			id: formData.elements["transaction-id"].value,
			type: formData.elements["type"].value,
			date: formData.elements["date"].value,
			amount: Number(formData.elements["amount"].value),
			description: formData.elements["description"].value,
			memo: formData.elements["memo"].value,
			categoryId: formData.elements["category"]?.value,
			accountId: formData.elements["payment-method"]?.value,
			fromAccountId: formData.elements["transfer-from"]?.value,
			toAccountId: formData.elements["transfer-to"]?.value,
		};
	} else {
		rawData = { ...formData, amount: Number(formData.amount) };
	}

	const transactionDate = new Date(rawData.date);
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - state.config.displayPeriod);
	startDate.setDate(1);
	startDate.setHours(0, 0, 0, 0);

	// 表示期間外の日付チェック
	if (transactionDate < startDate) {
		const isConfirmed = confirm(
			"この取引は現在の表示範囲外の日付です。\n\n保存後、この取引を見るには設定から表示期間を長くする必要があります。\nこのまま保存しますか？"
		);
		if (!isConfirmed) return;
	}

	const transactionId = rawData.id;
	const type = rawData.type;
	const amountNum = rawData.amount;

	const data = {
		id: transactionId,
		type: type,
		date: rawData.date,
		amount: amountNum,
		description: rawData.description,
		memo: rawData.memo,
	};

	// 編集時のメタデータ引き継ぎと整合性チェック
	if (transactionId) {
		const originalTransaction = store.getTransactionById(
			transactionId,
			state.transactions
		);

		if (originalTransaction) {
			if (originalTransaction.metadata) {
				data.metadata = { ...originalTransaction.metadata };
			}

			// クレジットカード支払い（メタデータ付き）の変更チェック
			if (
				type === "transfer" &&
				originalTransaction.type === "transfer" &&
				originalTransaction.metadata?.paymentTargetCardId
			) {
				const isAmountChanged = originalTransaction.amount !== amountNum;
				const isToAccountChanged =
					originalTransaction.toAccountId !== rawData.toAccountId;
				const isDateChanged =
					utils.toYYYYMMDD(originalTransaction.date) !== rawData.date;

				if (isAmountChanged || isToAccountChanged || isDateChanged) {
					const confirmMsg =
						"この振替はクレジットカードの請求支払いとして記録されています。\n" +
						"金額、日付、または振替先を変更すると、請求の「支払い済み」状態が解除される可能性があります。\n\n" +
						"変更を保存しますか？";
					if (!confirm(confirmMsg)) return;
				}
			}
		}
	}

	if (type === "transfer") {
		data.fromAccountId = rawData.fromAccountId;
		data.toAccountId = rawData.toAccountId;
	} else {
		data.categoryId = rawData.categoryId;
		data.accountId = rawData.accountId;
	}

	try {
		// 請求支払いモーダルからの振替の場合、メタデータを付与
		if (data.type === "transfer" && state.pendingBillPayment) {
			data.metadata = {
				paymentTargetCardId: state.pendingBillPayment.paymentTargetCardId,
				paymentTargetClosingDate:
					state.pendingBillPayment.paymentTargetClosingDate,
			};
			state.pendingBillPayment = null;
		}

		await store.saveTransaction(data);

		modal.closeModal();
		await loadData();
		notification.success("取引を保存しました。");
	} catch (err) {
		console.error("[Main] 保存エラー:", err);
		if (err.code === "permission-denied") {
			notification.error(
				"保存権限がありません。ログイン状態を確認してください。"
			);
		} else {
			notification.error(err.message);
		}
	}
}

/**
 * 取引の削除ボタンがクリックされた際の処理。
 * @async
 * @param {string} transactionId - 削除対象の取引ID。
 * @returns {Promise<void>}
 */
async function handleDeleteClick(transactionId) {
	if (transactionId && confirm("この取引を本当に削除しますか？")) {
		try {
			const transactionToDelete = store.getTransactionById(
				transactionId,
				state.transactions
			);
			if (transactionToDelete) {
				await store.deleteTransaction(transactionToDelete);
				modal.closeModal();
				await loadData();
				notification.success("取引を削除しました。");
			}
		} catch (err) {
			console.error("[Main] 削除エラー:", err);
			notification.error("取引の削除に失敗しました。");
		}
	}
}

/**
 * 通知の許可を要求し、FCMトークンを取得・保存する。
 * @returns {Promise<boolean>} 許可されてトークンが取得できればtrue。
 */
async function handleNotificationRequest() {
	try {
		const permission = await Notification.requestPermission();

		if (permission === "granted") {
			const registration = await navigator.serviceWorker.getRegistration("/");
			if (!registration) {
				console.error("[Notification] SW not found.");
				return false;
			}

			const token = await getToken(messaging, {
				vapidKey: vapidKey,
				serviceWorkerRegistration: registration,
			});

			if (token) {
				await store.saveFcmToken(token);
				notification.success("通知設定をオンにしました。");
				return true;
			}
		} else if (permission === "denied") {
			alert("通知がブロックされています。ブラウザの設定から許可してください。");
		}
	} catch (error) {
		console.error("[Notification] Failed:", error);
		notification.error("通知設定の保存に失敗しました。");
	}
	return false;
}

/**
 * 通知設定を解除する（FCMトークンを削除）。
 * @returns {Promise<boolean>} 解除に成功すればtrue。
 */
async function handleNotificationDisable() {
	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		if (!registration) return false;

		const token = await getToken(messaging, {
			vapidKey: vapidKey,
			serviceWorkerRegistration: registration,
		}).catch(() => null);

		if (token) {
			await store.deleteFcmToken(token);
			await deleteToken(messaging);
		}

		notification.info("この端末の通知設定をオフにしました。");
		return true;
	} catch (error) {
		console.error("[Notification] Disable failed:", error);
		notification.error("通知設定の解除に失敗しました。");
	}
	return false;
}

/* ==========================================================================
   Initialization & Setup
   ========================================================================== */

/**
 * 各UIモジュールを初期化し、依存関係を注入する。
 * @returns {void}
 */
function initializeModules() {
	modal.init(
		{
			submit: handleFormSubmit,
			delete: handleDeleteClick,
			close: () => {
				state.pendingBillPayment = null;
			},
		},
		state.luts
	);
	transactions.init({
		onUpdate: (newState) => {
			if (newState.hasOwnProperty("currentMonthFilter")) {
				state.currentMonthFilter = newState.currentMonthFilter;
			}
			renderUI();
		},
		onAddClick: () => modal.openModal(),
		onTransactionClick: (transactionId) => {
			const transaction = store.getTransactionById(
				transactionId,
				state.transactions
			);
			if (transaction) modal.openModal(transaction);
		},
		getLuts: () => state.luts,
	});
}

/**
 * ユーザー認証成功後に実行されるセットアップ処理。

/**
 * ユーザー認証成功後に実行されるセットアップ処理。
 * ユーザー情報を表示し、データの読み込みを開始してUIを構築する。
 * @async
 * @param {object} user - Firebase Authのユーザーオブジェクト。
 * @returns {Promise<void>}
 */
async function setupUser(user) {
	// UIコンテナを表示し、ローディング状態を示す
	utils.dom.hide(elements.loadingIndicator);
	utils.dom.hide(elements.authScreen);
	utils.dom.show(elements.mainContent);
	// menu.showButton(); removed (handled by React)
	utils.dom.show(elements.refreshDataButton);
	utils.dom.setText(elements.lastUpdatedTime, "データ取得中...");
	utils.dom.show(elements.lastUpdatedTime);

	// menu.updateUser(user); removed (handled by React)

	try {
		await loadLutsAndConfig();
		initializeModules();
		renderUI();

		// 初回ガイド表示
		if (state.config?.guide?.lastSeenVersion !== defaultConfig.guideVersion) {
			const guide = await loadGuide();
			guide.openModal(state.config);
		}

		await loadData();

		// 統計データが存在しない場合（初回移行時など）は自動的に再計算を実行
		const hasStats = await store.hasUserStats();
		if (!hasStats) {
			console.info(
				"[Main] 統計データが存在しないため、初期計算を実行します..."
			);
			await store.recalculateUserStats();
		}

		// リアルタイム更新の購読
		store.subscribeAccountBalances((newBalances) => {
			state.accountBalances = newBalances;
			renderDashboardSummary("dashboard-total-assets", {
				accountBalances: state.accountBalances,
				isMasked: state.isAmountMasked,
				luts: state.luts,
			});
			renderAccountBalances("balances-grid", {
				accountBalances: state.accountBalances,
				isMasked: state.isAmountMasked,
				transactions: state.transactions,
				accountsMap: state.luts.accounts,
			});
		});

		// 統計情報の購読
		store.subscribeUserStats((monthlyStats) => {
			state.monthlyStats = monthlyStats || [];
			renderUI();
		});
	} catch (error) {
		console.error("[Main] データの読み込み中にエラーが発生しました:", error);
		notification.error("データの読み込みに失敗しました。");
	}
}

/**
 * ログアウト時や認証失敗時にUIを初期状態に戻すクリーンアップ処理。
 * @returns {void}
 */
function cleanupUI() {
	store.unsubscribeAccountBalances();
	store.unsubscribeUserStats();

	renderSideMenu("side-menu-container", { isVisible: false });

	utils.dom.hide(elements.mainContent);
	utils.dom.show(elements.authScreen);
	utils.dom.show(elements.loginContainer);
	utils.dom.hide(elements.refreshDataButton);
	utils.dom.hide(elements.lastUpdatedTime);
}

/**
 * アプリケーション全体のイベントリスナーや初期設定を行う。
 * DOM読み込み完了時に実行される。
 * @returns {void}
 */
function initializeApp() {
	cacheDomElements();

	// リロード時にFirestoreの接続をクリーンアップし、"Fetch API cannot load" エラーを抑制する
	window.addEventListener("beforeunload", () => {
		deleteApp(app).catch((e) => console.debug("[App] Cleanup error:", e));
	});

	// Firebase Messaging Service Worker
	if ("serviceWorker" in navigator) {
		// 初回ロード時はリロードしないように制御
		let isControllerPresent = !!navigator.serviceWorker.controller;

		navigator.serviceWorker.addEventListener("controllerchange", () => {
			if (isControllerPresent) {
				window.location.reload();
			}
		});

		const configParams = new URLSearchParams({
			config: JSON.stringify(firebaseConfig),
			v: defaultConfig.appVersion,
		}).toString();

		navigator.serviceWorker
			.register(`/firebase-messaging-sw.js?${configParams}`)
			.then((registration) => {
				// 更新が見つかった場合、ローディング表示を更新インジケーターに切り替える
				registration.addEventListener("updatefound", () => {
					const newWorker = registration.installing;
					// 初回インストールではなく、更新の場合（controllerが存在する）のみ表示
					if (newWorker && navigator.serviceWorker.controller) {
						utils.dom.hide(elements.loadingIndicator);
						utils.dom.show(elements.updateIndicator);
					}
				});
			})
			.catch((err) => {
				console.error("[App] Service Workerの登録に失敗しました:", err);
			});
	}

	// キーボードショートカット
	document.addEventListener("keydown", (e) => {
		// 新規取引作成 (Cmd/Ctrl + N)
		if ((e.metaKey || e.ctrlKey) && e.key === "n") {
			e.preventDefault();
			if (auth.currentUser) modal.openModal();
			return;
		}
		// モーダルを閉じる (Escape)
		if (e.key === "Escape") {
			// 1. スタック管理されているモーダルがあれば最優先で閉じる
			if (modal.closeTop()) {
				return;
			}

			// 2. スタック未対応のモジュールをチェック (Fallback)
			if (guideModule && guideModule.isOpen()) {
				guideModule.closeModal();
				return;
			}
			if (termsModule && termsModule.isOpen()) {
				termsModule.close();
				return;
			}
			if (reportModule && reportModule.isOpen()) {
				reportModule.closeModal();
				return;
			}
		}
	});

	// イベントリスナー登録
	utils.dom.on(elements.loginButton, "click", handleLogin);
	utils.dom.on(elements.refreshDataButton, "click", () => {
		loadLutsAndConfig().then(loadData);
	});

	// レシートスキャンFABボタン
	const scanFab = utils.dom.get("scan-receipt-fab");
	if (scanFab) {
		utils.dom.on(scanFab, "click", async () => {
			const scan = await loadScanModule();
			scan.openModal();
		});
	}

	// 通知メッセージ受信ハンドラ
	onMessage(messaging, (payload) => {
		const { title, body } = payload.notification;

		// フォーカス中はアプリ内通知、非フォーカス時はブラウザ通知を表示
		notification.info(`${title}: ${body}`);
	});

	// 認証状態監視
	onAuthStateChanged(auth, async (user) => {
		if (user) {
			const { config } = await store.fetchAllUserData();

			if (config?.terms?.agreedVersion === defaultConfig.termsVersion) {
				utils.dom.hide(elements.authContainer);
				setupUser(user);
			} else {
				// 利用規約同意フロー
				const onAgree = async () => {
					const agreeBtn = utils.dom.get("terms-agree-btn");
					agreeBtn.disabled = true;
					agreeBtn.textContent = "保存中...";
					try {
						await store.updateConfig({
							"terms.agreedVersion": defaultConfig.termsVersion,
						});
						location.reload();
					} catch (error) {
						console.error("[Auth] 同意状況の保存に失敗しました:", error);
						notification.error(
							"同意状況の保存に失敗しました。もう一度お試しください。"
						);
						agreeBtn.disabled = false;
						agreeBtn.textContent = "同意する";
					}
				};
				const onDisagree = () => {
					signOut(auth);
					if (termsModule) termsModule.close();
				};
				const terms = await loadTerms();
				terms.openAgreement(onAgree, onDisagree);
				utils.dom.hide(elements.loadingIndicator);
				utils.dom.show(elements.authScreen);
			}
		} else {
			utils.dom.hide(elements.loadingIndicator);
			utils.dom.show(elements.loginContainer);
			utils.dom.show(elements.authContainer);
			cleanupUI();
		}
	});
}

// エントリーポイント
document.addEventListener("DOMContentLoaded", () => {
	initializeApp();
});
