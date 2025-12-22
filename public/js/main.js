import "@fortawesome/fontawesome-free/css/all.min.css";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import "viewerjs/dist/viewer.css";
import "../src/input.css";

// Chart.jsのコンポーネントを登録
Chart.register(...registerables);

// 初期表示をフェードインさせる
setTimeout(() => {
	document.body.style.visibility = "visible";
	document.body.style.opacity = "1";
}, 100);

import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "firebase/auth";
import { config as defaultConfig } from "./config.js";
import { auth } from "./firebase.js";
import * as store from "./store.js";
import * as advisor from "./ui/advisor.js";
import * as analysis from "./ui/analysis.js";
import * as balances from "./ui/balances.js";
import * as billing from "./ui/billing.js";
import * as dashboard from "./ui/dashboard.js";
import * as guide from "./ui/guide.js";
import * as menu from "./ui/menu.js";
import * as modal from "./ui/modal.js";
import * as notification from "./ui/notification.js";
import * as report from "./ui/report.js";
import * as scanConfirm from "./ui/scan_confirm.js";
import * as scanStart from "./ui/scan_start.js";
import * as settings from "./ui/settings.js";
import * as terms from "./ui/terms.js";
import * as transactions from "./ui/transactions.js";
import * as utils from "./utils.js";

/**
 * UI操作で使用するDOM要素の参照をまとめたオブジェクト。
 * 頻繁にアクセスする要素をキャッシュし、DOM探索のオーバーヘッドを削減する。
 * @type {object}
 */
const getElements = () => ({
	authContainer: utils.dom.get("auth-container"),
	authScreen: utils.dom.get("auth-screen"),
	mainContent: utils.dom.get("main-content"),
	loginContainer: utils.dom.get("login-container"),
	loginButton: utils.dom.get("login-button"),
	loadingIndicator: utils.dom.get("loading-indicator"),
	lastUpdatedTime: utils.dom.get("last-updated-time"),
	refreshDataButton: utils.dom.get("refresh-data-button"),
	refreshIcon: utils.dom.get("refresh-icon"),
});

/**
 * アプリケーションのフロントエンド全体で共有される状態を保持するオブジェクト。
 * コンポーネント間でのデータ共有や、表示状態の管理を一元化する。
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
	isAmountMasked: false,
	pendingBillPayment: null,
	analysisMonth: "all-time",
	currentMonthFilter: "all-time",
};

/**
 * Google認証のポップアップを表示し、ログイン処理を開始する。
 * ユーザーアクション（ボタンクリック）をトリガーとして実行される。
 * @returns {void}
 * @fires Firebase Auth - `signInWithPopup`を呼び出す。
 */
function handleLogin() {
	console.info("[Auth] ログイン処理を開始します...");
	const provider = new GoogleAuthProvider();
	signInWithPopup(auth, provider).catch((err) =>
		console.error("[Auth] ログインエラー", err)
	);
}

/**
 * 取引フォームの送信を処理する。
 * 入力値の検証、古い日付の警告、そしてstoreモジュールへの保存依頼を行う。
 * @async
 * @param {HTMLFormElement} form - 送信されたフォーム要素。
 * @returns {Promise<void>}
 */
async function handleFormSubmit(form) {
	const transactionDate = new Date(form.elements["date"].value);
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - state.config.displayPeriod);
	startDate.setDate(1);
	startDate.setHours(0, 0, 0, 0);

	if (transactionDate < startDate) {
		const isConfirmed = confirm(
			"この取引は現在の表示範囲外の日付です。\n\n保存後、この取引を見るには設定から表示期間を長くする必要があります。\nこのまま保存しますか？"
		);
		if (!isConfirmed) {
			return; // ユーザーがキャンセルしたら処理を中断
		}
	}

	const transactionId = form.elements["transaction-id"].value;
	const type = form.elements["type"].value;
	const amountNum = Number(form.elements["amount"].value);

	// 保存するデータを構築
	const data = {
		id: transactionId,
		type: type,
		date: form.elements["date"].value,
		amount: amountNum,
		description: form.elements["description"].value,
		memo: form.elements["memo"].value,
	};

	// 編集時は既存のメタデータを引き継ぐ
	if (transactionId) {
		const originalTransaction = store.getTransactionById(
			transactionId,
			state.transactions
		);

		if (originalTransaction) {
			// メタデータの引き継ぎ
			if (originalTransaction.metadata) {
				data.metadata = { ...originalTransaction.metadata };
			}

			// 警告チェック: クレジットカード支払い（メタデータ付き）の変更
			if (
				type === "transfer" &&
				originalTransaction.type === "transfer" &&
				originalTransaction.metadata &&
				originalTransaction.metadata.paymentTargetCardId
			) {
				// 金額、振替先、日付のいずれかが変更されているかチェック
				const isAmountChanged = originalTransaction.amount !== amountNum;
				const isToAccountChanged =
					originalTransaction.toAccountId !==
					form.elements["transfer-to"].value;
				// 日付は文字列比較 (YYYY-MM-DD)
				// originalTransaction.date は Date オブジェクトなので変換が必要
				const isDateChanged =
					utils.toYYYYMMDD(originalTransaction.date) !==
					form.elements["date"].value;

				if (isAmountChanged || isToAccountChanged || isDateChanged) {
					const confirmMsg =
						"この振替はクレジットカードの請求支払いとして記録されています。\n" +
						"金額、日付、または振替先を変更すると、請求の「支払い済み」状態が解除される可能性があります。\n\n" +
						"変更を保存しますか？";
					if (!confirm(confirmMsg)) {
						return; // キャンセル
					}
				}
			}
		}
	}

	if (type === "transfer") {
		data.fromAccountId = form.elements["transfer-from"].value;
		data.toAccountId = form.elements["transfer-to"].value;
	} else {
		data.categoryId = form.elements["category"].value;
		data.accountId = form.elements["payment-method"].value;
	}

	console.info("[Data] 取引データを保存します...", data);

	try {
		// もし、これが請求支払いモーダルからトリガーされた振替の場合
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
		console.error("[Data] 保存エラー:", err);
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
 * 誤操作防止のための確認ダイアログを表示し、承認後に削除を実行する。
 * @async
 * @param {string} transactionId - 削除対象の取引ID。
 * @returns {Promise<void>}
 */
async function handleDeleteClick(transactionId) {
	if (transactionId && confirm("この取引を本当に削除しますか？")) {
		console.info("[Data] 取引データを削除します...", transactionId);
		try {
			const transactionToDelete = store.getTransactionById(
				transactionId,
				state.transactions
			);
			if (transactionToDelete) {
				await store.deleteTransaction(transactionToDelete);
				modal.closeModal();
				await loadData(); // データを再読み込みしてUIを更新
				notification.success("取引を削除しました。");
			}
		} catch (err) {
			console.error("[Data] 削除エラー:", err);
			notification.error("取引の削除に失敗しました。");
		}
	}
}

/**
 * 全取引データと現在の口座残高から、月ごとの純資産、収入、支出の履歴データを計算する。
 * 現在の残高から過去に遡って計算することで、各時点での正確な資産状況を復元する。
 * @param {Array<object>} allTransactions - 全期間の取引データ。
 * @param {object} currentAccountBalances - 現在の口座残高。
 * @returns {Array<object>} 月ごとの履歴データ（{month, netWorth, income, expense}）の配列。古い順にソート済み。
 */
function calculateHistoricalData(allTransactions, currentAccountBalances) {
	// 取引がなければ計算せず空の配列を返す
	if (allTransactions.length === 0) return [];

	// 1. 初期データを準備
	const currentNetWorth = Object.values(currentAccountBalances).reduce(
		(sum, balance) => sum + balance,
		0
	);
	const monthlySummaries = utils.summarizeTransactionsByMonth(
		allTransactions,
		state.luts
	);
	const sortedMonths = Object.keys(monthlySummaries).sort().reverse();
	const today = new Date();
	const latestMonth = sortedMonths[0];

	// 2. 最新月のデータを 먼저 historicalData に追加
	const latestMonthSummary = monthlySummaries[latestMonth];
	const historicalData = [
		{
			month: latestMonth,
			netWorth: currentNetWorth, // 最新月は現在の純資産をそのまま使用
			income: latestMonthSummary.income,
			expense: latestMonthSummary.expense,
		},
	];

	// 3. 次のループの初期値となる「前月末の純資産」を計算
	let netWorthAtPrevMonthEnd;
	if (latestMonth === utils.toYYYYMM(today)) {
		// 最新月が「今月」の場合： 前月末資産 = 今日の資産 - 今月の今日までの収支
		const ytdBalance = allTransactions
			.filter((t) => utils.toYYYYMM(t.date) === latestMonth && t.date <= today)
			.reduce((balance, t) => {
				if (t.type === "income") return balance + t.amount;
				if (t.type === "expense") return balance - t.amount;
				return balance;
			}, 0);
		netWorthAtPrevMonthEnd = currentNetWorth - ytdBalance;
	} else {
		// 最新月が「前月以前」の場合： 前月末資産 = 最新月の月末資産 - 最新月の収支
		const latestMonthBalance =
			latestMonthSummary.income - latestMonthSummary.expense;
		netWorthAtPrevMonthEnd = currentNetWorth - latestMonthBalance;
	}

	// 4. 前月以前のデータをループで処理
	for (const month of sortedMonths.slice(1)) {
		const summary = monthlySummaries[month];
		historicalData.push({
			month: month,
			netWorth: netWorthAtPrevMonthEnd, // 前月末の純資産をセット
			income: summary.income,
			expense: summary.expense,
		});

		// さらに前の月の末日資産を計算
		netWorthAtPrevMonthEnd -= summary.income - summary.expense;
	}

	// 5. グラフ表示のために時系列（古い順）に並べ替えて返す
	return historicalData.reverse();
}

/**
 * 指定された月の取引のみをフィルタリングするヘルパー関数。
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

/**
 * 現在のstateとフィルター条件に基づいて、各UIコンポーネントの描画関数を呼び出す。
 * データの変更やフィルター操作があった場合に呼び出され、画面全体を最新の状態に更新する。
 * @returns {void}
 */
function renderUI() {
	// 表示期間内のデータのみを抽出
	// state.transactionsには請求計算用に多めのデータが含まれている可能性があるため
	const displayMonths = state.config.displayPeriod || 3;
	const displayStartDate = utils.getStartOfMonthAgo(displayMonths);
	const visibleTransactions = state.transactions.filter(
		(t) => t.date >= displayStartDate
	);

	// 1. 「取引履歴」セクション用のデータをフィルタリング
	const listTargetTransactions = filterTransactionsByMonth(
		visibleTransactions,
		state.currentMonthFilter
	);
	// さらにキーワードやカテゴリ等のフィルターを適用する
	const filteredTransactions = transactions.applyFilters(
		listTargetTransactions
	);

	// 2. 収支レポート用のフィルタリング
	const analysisTargetTransactions = filterTransactionsByMonth(
		visibleTransactions,
		state.analysisMonth || "all-time"
	);

	// 純資産推移グラフ用に全期間のデータを計算する
	// ここでは正確な資産推移のために、取得済みの全データ(state.transactions)を使用する
	const historicalData = calculateHistoricalData(
		state.transactions,
		state.accountBalances
	);

	// 各UIモジュールの描画関数を呼び出す
	dashboard.render(state.accountBalances, state.isAmountMasked, state.luts);
	transactions.render(filteredTransactions, state.isAmountMasked);
	analysis.render(
		analysisTargetTransactions,
		historicalData,
		state.isAmountMasked,
		state.analysisMonth
	);
	balances.render(state.accountBalances, state.isAmountMasked);

	// 請求計算に必要な期間が現在の表示期間を超えているかチェック
	const neededMonths = getBillingNeededMonths();
	const currentMonths = state.config.displayPeriod || 3;
	const isDataInsufficient = neededMonths > currentMonths;

	// 請求計算には全データ(state.transactions)を渡す
	billing.render(
		state.transactions,
		state.config.creditCardRules || {},
		state.isAmountMasked,
		state.luts,
		isDataInsufficient
	);
	advisor.render(state.config);
}

/**
 * 取引データから年月を抽出し、期間フィルターのドロップダウン選択肢を生成・更新する。
 * 取引が存在する月のみを選択肢として表示し、ユーザーが有効な期間を選択できるようにする。
 * @param {Array<object>} transactionsData - 取引データの配列。
 * @returns {void}
 */
function populateMonthSelectors(transactionsData) {
	const months = [
		...new Set(
			transactionsData.map((t) => {
				return utils.toYYYYMM(t.date);
			})
		),
	];
	months.sort().reverse();

	// 設定された表示期間に基づいて「全期間」のラベルを動的に生成する
	let periodLabel = "全期間";
	if (state.config.displayPeriod) {
		periodLabel =
			state.config.displayPeriod === 12
				? "過去1年"
				: `過去${state.config.displayPeriod}ヶ月`;
	}

	const optionsHtml =
		`<option value="all-time">${periodLabel}</option>` +
		months
			.map((m) => `<option value="${m}">${m.replace("-", "年")}月</option>`)
			.join("");

	// 1. 「取引履歴」セクションのフィルターを更新
	transactions.updateMonthSelector(optionsHtml, state.currentMonthFilter);

	// 2. 「収支レポート」セクションのフィルターを更新
	analysis.updateMonthSelector(optionsHtml, state.analysisMonth);
}

/**
 * ユーザーの基本データ（口座、カテゴリ、設定）をFirestoreから取得し、
 * stateオブジェクトを更新する。
 * アプリケーションの起動時や、設定変更後に呼び出され、最新のマスタデータをメモリ上に保持する。
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
	console.debug("[Data] 設定とマスタデータを読み込みました");
}

/**
 * 最終データ取得時刻をUIに表示する。
 * ユーザーにデータの鮮度を伝え、手動更新の必要性を判断させる。
 * @returns {void}
 */
function updateLastUpdatedTime() {
	const { lastUpdatedTime } = getElements();
	const now = new Date();
	const timeString = now.toLocaleTimeString("ja-JP", {
		hour: "2-digit",
		minute: "2-digit",
	});

	// ヘッダーの時刻を更新 (PC用)
	utils.dom.setText(lastUpdatedTime, `最終取得: ${timeString}`);
	utils.dom.show(lastUpdatedTime);

	// サイドメニューの時刻を更新 (モバイル用)
	utils.dom.setText("menu-last-updated", `最終取得: ${timeString}`);
}

/**
 * 請求計算に必要な最大月数を計算する。
 * クレジットカードの支払いサイクルを考慮し、未払いの可能性がある期間をカバーする。
 * @returns {number} 必要な月数。
 */
const getBillingNeededMonths = () => {
	const rules = state.config.creditCardRules || {};
	let maxOffset = 0;
	for (const rule of Object.values(rules)) {
		// 締め日から支払日まで最大で paymentMonthOffset + 1ヶ月程度かかる
		// 余裕を持って +2 とする
		const offset = (rule.paymentMonthOffset || 0) + 2;
		if (offset > maxOffset) maxOffset = offset;
	}
	// 最低でも3ヶ月は確保する
	return Math.max(maxOffset, 3);
};

/**
 * 必要なデータ（取引、残高）をFirestoreから読み込み、UIを再描画する。
 * データの同期を行い、画面全体を最新の状態にリフレッシュする。
 * @async
 * @returns {Promise<void>}
 */
async function loadData() {
	const { refreshIcon } = getElements();
	refreshIcon.classList.add("spin-animation");

	// 表示期間と請求計算に必要な期間のうち、長い方を採用してデータを取得する
	// const billingMonths = getBillingNeededMonths();
	// const displayMonths = state.config.displayPeriod || 3;
	// const fetchMonths = Math.max(billingMonths, displayMonths);

	// ユーザーの要望により、自動延長は行わず設定された期間のみ取得する
	// 不足がある場合はUI側で警告を出す
	state.transactions = await store.fetchTransactionsForPeriod(
		state.config.displayPeriod || 3
	);

	state.accountBalances = await store.fetchAccountBalances();
	// データを元に期間選択のプルダウンを更新する
	populateMonthSelectors(state.transactions);

	renderUI();

	refreshIcon.classList.remove("spin-animation");
	updateLastUpdatedTime();
}

/**
 * 設定変更後の共通リフレッシュ処理
 * @async
 * @param {boolean} shouldReloadData - 取引データも再読み込みするかどうか
 * @returns {Promise<void>}
 */
async function refreshSettings(shouldReloadData = false) {
	await loadLutsAndConfig();
	if (shouldReloadData) {
		await loadData();
	} else {
		renderUI();
		transactions.populateFilterDropdowns();
	}
	if (settings.isOpen()) {
		settings.render(state.luts, state.config);
	}
}

/**
 * 各UIモジュールを初期化し、コールバック関数や依存関係を注入する。
 * モジュール間の疎結合を保ちつつ、必要な連携を設定する。
 * @returns {void}
 */
function initializeModules() {
	menu.init({
		onMaskChange: (isMasked) => {
			state.isAmountMasked = isMasked;
			renderUI();
		},
		onLogout: () => signOut(auth),
		onSettingsOpen: () => settings.openModal(),
		onGuideOpen: () => guide.openModal(),
		onTermsOpen: () => terms.openViewer(),
		onReportOpen: () => report.openModal(),
	});
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
	settings.init({
		// 依存するStateやモジュールを渡す
		getState: () => ({
			luts: state.luts,
			config: state.config,
			transactions: state.transactions,
			accountBalances: state.accountBalances,
		}),
		store, // storeモジュール全体を渡す
		billing, // 支払いサイクル移行処理に必要
		utils, // utilsモジュール全体を渡す
		// main.js側のリフレッシュ処理をコールバックとして渡す
		refresh: refreshSettings,
		// 表示期間更新時の特殊なリロード処理
		reloadApp: () => location.reload(),
	});
	scanStart.init({
		onOpen: () => scanStart.openModal(),
		getConfig: () => state.config,
		getLuts: () => state.luts,
	});
	scanConfirm.init(
		{
			// 1件保存用コールバック
			registerItem: async (itemData) => {
				await store.saveTransaction(itemData);
			},
			// 全件完了後のコールバック
			onComplete: async () => {
				await loadData();
				notification.success("取引を保存しました。");
			},
		},
		state.luts
	);
	guide.init(state.config);
	terms.init();
	analysis.init({
		onUpdate: (newState) => {
			if (newState.hasOwnProperty("analysisMonth")) {
				state.analysisMonth = newState.analysisMonth;
			}
			renderUI();
		},
		getLuts: () => state.luts,
	});
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
	balances.init((accountId, targetCard) => {
		balances.toggleHistoryChart(
			accountId,
			targetCard,
			state.transactions,
			state.accountBalances,
			state.isAmountMasked
		);
	}, state.luts);
	billing.init(
		(data) => {
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
				description: `${data.cardName} (${data.closingDate}締分) 支払い`,
			});
		},
		() => settings.openModal()
	);
	report.init(state.luts);
	advisor.init();
}

/**
 * サーバー上のアプリケーションバージョンをチェックし、ローカルストレージのバージョンと異なる場合はページをリロードする。
 * @async
 * @returns {Promise<void>}
 */
async function checkAndReload() {
	try {
		const res = await fetch("/version.json?t=" + Date.now(), {
			cache: "no-store",
		});
		if (!res.ok) return;

		const { version } = await res.json();
		const serverVersion = String(version);
		const localVersion = localStorage.getItem("app_version");

		if (localVersion && localVersion !== serverVersion) {
			localStorage.setItem("walletwise_app_version", serverVersion);
			window.location.reload(true);
		} else {
			localStorage.setItem("walletwise_app_version", serverVersion);
		}
	} catch (e) {
		console.debug("[App] バージョンチェックに失敗しました:", e);
	}
}

/**
 * ユーザー認証成功後に実行されるセットアップ処理。
 * ユーザー情報を表示し、データの読み込みを開始してUIを構築する。
 * ログインフローの完了として呼び出され、アプリケーションを使用可能な状態にする。
 * @async
 * @param {object} user - Firebase Authのユーザーオブジェクト。
 * @returns {Promise<void>}
 */
async function setupUser(user) {
	console.info("[Auth] ユーザー認証完了:", user.uid);
	const {
		loadingIndicator,
		authScreen,
		mainContent,
		refreshDataButton,
		lastUpdatedTime,
	} = getElements();

	// 先にUIコンテナを表示し、ローディング状態を示す
	utils.dom.hide(loadingIndicator);
	utils.dom.hide(authScreen);
	utils.dom.show(mainContent);
	menu.showButton();
	utils.dom.show(refreshDataButton);
	utils.dom.setText(lastUpdatedTime, "データ取得中...");
	utils.dom.show(lastUpdatedTime);

	// サイドメニュー内のユーザーアバターを設定
	menu.updateUser(user);

	try {
		// 1. 基本設定を読み込む
		await loadLutsAndConfig();

		// 2. モジュールを初期化 (イベントリスナーなど)
		initializeModules();

		// 3. スケルトンUIを描画 (データはまだ空)
		renderUI();

		// 初回表示のガイドをチェック
		if (guide.shouldShowGuide()) {
			guide.openModal();
			// ガイドが表示されるので、これ以降のデータ読み込みはガイドが閉じた後の
			// リロードに任せる
			return;
		}

		// 4. 重いデータを非同期で読み込み、完了後にUIを更新
		await loadData();

		// 5. リアルタイム更新の購読を開始
		store.subscribeAccountBalances((newBalances) => {
			state.accountBalances = newBalances;
			// 残高表示に関わる部分だけ再描画
			dashboard.render(state.accountBalances, state.isAmountMasked, state.luts);
			balances.render(state.accountBalances, state.isAmountMasked);

			// 必要なら設定画面の残高調整リストも更新
			if (
				!document.getElementById("settings-modal").classList.contains("hidden")
			) {
				settings.render(state.luts, state.config);
			}
		});

		// 6. バックグラウンド処理を開始
		advisor.checkAndRunAdvisor(state.config).catch((err) => {
			console.error("[Advisor] 定期チェック中にエラーが発生しました:", err);
		});
	} catch (error) {
		console.error("[Data] データの読み込み中にエラーが発生しました:", error);
		notification.error("データの読み込みに失敗しました。");
	}

	// スクロール位置に応じてサイドメニューのハイライトを更新する処理
	const header = utils.dom.query("header");
	const sections = utils.dom.queryAll("main > section[id]");
	const menuLinks = utils.dom.queryAll(".menu-link");
	const headerHeight = header.offsetHeight;
	sections.forEach((section) => {
		section.style.scrollMarginTop = `${headerHeight + 12}px`;
	});

	// 現在表示されているセクションに応じてメニュー項目をアクティブにする
	const activateMenuLink = () => {
		const scrollPosition = window.scrollY + headerHeight;
		let activeSectionId = "";

		const adjustedScrollPosition = scrollPosition + headerHeight + 20;
		for (let i = sections.length - 1; i >= 0; i--) {
			const section = sections[i];
			if (adjustedScrollPosition >= section.offsetTop) {
				activeSectionId = section.id;
				break;
			}
		}

		menuLinks.forEach((link) => {
			const isActive = link.getAttribute("href") === `#${activeSectionId}`;
			link.classList.toggle("menu-link-active", isActive);
		});
	};
	window.addEventListener("scroll", activateMenuLink);
	activateMenuLink();
}

/**
 * ログアウト時や認証失敗時にUIを初期状態に戻すクリーンアップ処理。
 * ユーザー固有のデータを非表示にし、ログイン画面を表示する。
 * @returns {void}
 */
function cleanupUI() {
	// Firestoreのリスナーを解除
	store.unsubscribeAccountBalances();

	const {
		mainContent,
		authScreen,
		loginContainer,
		refreshDataButton,
		lastUpdatedTime,
	} = getElements();

	menu.hideButton();
	utils.dom.hide(mainContent);
	utils.dom.show(authScreen);
	utils.dom.show(loginContainer);
	utils.dom.hide(refreshDataButton);
	utils.dom.hide(lastUpdatedTime);
}

/**
 * アプリケーション全体のイベントリスナーや初期設定を行う。
 * DOM読み込み完了時に実行され、UIのインタラクションを有効化する。
 * @returns {void}
 */
function initializeApp() {
	console.info("[App] アプリケーションを初期化します...");

	// バージョンチェックと自動リロード
	checkAndReload();
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			checkAndReload();
		}
	});

	// グローバルなキーボードショートカット
	document.addEventListener("keydown", (e) => {
		// 新規取引作成 (Cmd/Ctrl + N)
		if ((e.metaKey || e.ctrlKey) && e.key === "n") {
			e.preventDefault();
			// ログイン済みの場合のみモーダルを開く
			if (auth.currentUser) {
				modal.openModal();
			}
			return;
		}
		// 各種モーダルを閉じる (Escape)
		if (e.key === "Escape") {
			if (scanConfirm.isOpen()) {
				scanConfirm.closeModal();
				return;
			}

			if (scanStart.isOpen()) {
				scanStart.closeModal(); // 解析中は内部でブロックされる
				return;
			}

			if (modal.isOpen()) {
				modal.closeModal();
				return;
			}

			if (guide.isOpen()) {
				guide.closeModal();
				return;
			}

			if (terms.isOpen()) {
				terms.close();
				return;
			}

			if (report.isOpen()) {
				report.closeModal();
				return;
			}
		}
	});

	const {
		loginButton,
		refreshDataButton,
		authContainer,
		loadingIndicator,
		loginContainer,
	} = getElements();

	// ログインボタン
	utils.dom.on(loginButton, "click", handleLogin);

	// データ更新ボタン
	utils.dom.on(refreshDataButton, "click", () => {
		loadLutsAndConfig().then(loadData);
	});

	// 認証状態の変化を監視
	onAuthStateChanged(auth, async (user) => {
		if (user) {
			// ユーザー設定（特に利用規約の同意状況）を先に確認する
			const { config } = await store.fetchAllUserData();

			if (config?.terms?.agreedVersion === defaultConfig.termsVersion) {
				// 同意済みの場合、通常通りセットアップ
				utils.dom.hide(authContainer);
				setupUser(user);
			} else {
				// 未同意の場合、規約モーダルを表示
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
					terms.close();
				};
				terms.openAgreement(onAgree, onDisagree);
				utils.dom.get("loading-indicator").classList.add("hidden");
				utils.dom.get("auth-screen").classList.remove("hidden");
			}
		} else {
			utils.dom.hide(loadingIndicator);
			utils.dom.show(loginContainer);
			utils.dom.show(authContainer);
			cleanupUI();
		}
	});
}

// DOMの読み込み完了後にアプリケーションを初期化する
document.addEventListener("DOMContentLoaded", () => {
	initializeApp();
});
