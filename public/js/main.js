import { formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";
import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { FieldValue } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { auth } from "./firebase.js";
import * as store from "./store.js";
import * as analysis from "./ui/analysis.js";
import * as balances from "./ui/balances.js";
import * as billing from "./ui/billing.js";
import * as dashboard from "./ui/dashboard.js";
import * as guide from "./ui/guide.js";
import * as modal from "./ui/modal.js";
import * as scanConfirm from "./ui/scan_confirm.js";
import * as scanStart from "./ui/scan_start.js";
import * as settings from "./ui/settings.js";
import * as transactions from "./ui/transactions.js";

/**
 * UI操作で使用するDOM要素の参照をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	authContainer: document.getElementById("auth-container"),
	authScreen: document.getElementById("auth-screen"),
	mainContent: document.getElementById("main-content"),
	loginContainer: document.getElementById("login-container"),
	loginButton: document.getElementById("login-button"),
	loadingIndicator: document.getElementById("loading-indicator"),
	lastUpdatedTime: document.getElementById("last-updated-time"),
	refreshDataButton: document.getElementById("refresh-data-button"),
	refreshIcon: document.getElementById("refresh-icon"),
	addTransactionButton: document.getElementById("add-transaction-button"),
	menuButton: document.getElementById("menu-button"),
	menuPanel: document.getElementById("menu-panel"),
	menuOverlay: document.getElementById("menu-overlay"),
	menuUserAvatar: document.getElementById("menu-user-avatar"),
	menuUserPlaceholder: document.getElementById("menu-user-avatar-placeholder"),
	maskToggle: document.getElementById("mask-toggle"),
	menuLogoutButton: document.getElementById("menu-logout-button"),
	settingsButton: document.getElementById("settings-button"),
	openGuideButton: document.getElementById("guide-button"),
	transactionsList: document.getElementById("transactions-list"),
	monthFilter: document.getElementById("month-filter"),
	notificationBanner: document.getElementById("notification-banner"),
	notificationMessage: document.getElementById("notification-message"),
	scanFab: document.getElementById("scan-receipt-fab"),
};

/**
 * アプリケーションのフロントエンド全体で共有される状態を保持するオブジェクト。
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
};

/**
 * 通知バナーの表示を制御するためのタイマーID。
 * @type {number}
 */
let notificationTimeout;

/**
 * 画面上部に通知バナーを表示する。
 * @param {string} message - 表示するメッセージ。
 * @param {string} [type="error"] - 通知の種類 ('error' または 'success')。
 * @returns {void}
 */
function showNotification(message, type = "error") {
	clearTimeout(notificationTimeout);
	elements.notificationMessage.textContent = message;

	elements.notificationBanner.className = `fixed top-0 left-0 right-0 p-4 z-[60] text-center text-white transition-transform duration-300`;
	elements.notificationBanner.classList.add(
		type === "error" ? "bg-red-500" : "bg-green-600"
	);

	elements.notificationBanner.classList.remove("hidden");
	elements.notificationBanner.classList.remove("-translate-y-full");

	notificationTimeout = setTimeout(() => {
		elements.notificationBanner.classList.add("-translate-y-full");
	}, 3000);
}

/**
 * Google認証のポップアップを表示し、ログイン処理を開始する。
 * @returns {void}
 * @fires Firebase Auth - `signInWithPopup`を呼び出す。
 */
function handleLogin() {
	const provider = new GoogleAuthProvider();
	signInWithPopup(auth, provider).catch((err) =>
		console.error("ログインエラー", err)
	);
}

/**
 * 取引フォームの送信を処理する。
 * 入力値を検証し、storeモジュール経由でデータを保存する。
 * @async
 * @param {HTMLFormElement} form - 送信されたフォーム要素。
 * @returns {Promise<void>}
 */
async function handleFormSubmit(form) {
	const transactionDate = new Date(form.querySelector("#date").value);
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

	const transactionId = form.querySelector("#transaction-id").value;
	const oldTransaction = transactionId
		? store.getTransactionById(transactionId, state.transactions)
		: null;

	const typeBtn = form.querySelector('#type-selector [class*="-500"]');
	const type = typeBtn.dataset.type;
	const amountStr = form.querySelector("#amount").value;
	const amountNum = Number(amountStr);

	// 入力値の検証
	if (!amountStr || isNaN(amountNum) || amountNum <= 0) {
		return showNotification("金額は0より大きい半角数字で入力してください。");
	}
	if (!form.querySelector("#date").value) {
		return showNotification("日付が入力されていません。");
	}

	// 保存するデータを構築
	const data = {
		id: transactionId,
		type: type,
		date: form.querySelector("#date").value,
		amount: amountNum,
		description: form.querySelector("#description").value,
		memo: form.querySelector("#memo").value,
	};

	if (type === "transfer") {
		data.fromAccountId = form.querySelector("#transfer-from").value;
		data.toAccountId = form.querySelector("#transfer-to").value;
		if (data.fromAccountId === data.toAccountId) {
			return showNotification("振替元と振替先が同じです。");
		}
	} else {
		data.categoryId = form.querySelector("#category").value;
		data.accountId = form.querySelector("#payment-method").value;
	}

	try {
		await store.saveTransaction(data, oldTransaction);

		// もし、これが請求支払いモーダルからトリガーされた振替の場合
		if (data.type === "transfer" && state.pendingBillPayment) {
			// 支払い済みサイクルとして記録する
			await store.markBillCycleAsPaid(
				state.pendingBillPayment.cardId,
				state.pendingBillPayment.closingDateStr,
				state.config.creditCardRules || {}
			);
			state.pendingBillPayment = null; // 処理後にクリア
			await loadLutsAndConfig();
		}

		modal.closeModal();
		await loadData();
		console.log("[Firestore Write] 取引データを保存");
		showNotification("取引を保存しました。", "success");
	} catch (err) {
		console.error("保存エラー:", err);
		if (err.code === "permission-denied") {
			showNotification(
				"保存に失敗しました。入力データが正しくない可能性があります。"
			);
		} else {
			showNotification("エラーが発生しました。取引の保存に失敗しました。");
		}
	}
}

/**
 * 取引の削除ボタンがクリックされた際の処理。
 * 確認ダイアログを表示し、承認されればstore経由で取引を削除する。
 * @async
 * @param {string} transactionId - 削除対象の取引ID。
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
				await loadData(); // データを再読み込みしてUIを更新
				showNotification("取引を削除しました。", "success");
			}
		} catch (err) {
			console.error("削除エラー:", err);
			showNotification("取引の削除に失敗しました。");
		}
	}
}

/**
 * 全取引データと現在の口座残高から、月ごとの純資産、収入、支出の履歴データを計算する。
 * ダッシュボードの純資産推移グラフで使用される。
 * @param {Array<object>} allTransactions - 全期間の取引データ。
 * @param {object} currentAccountBalances - 現在の口座残高。
 * @returns {Array<object>} 月ごとの履歴データ（{month, netWorth, income, expense}）の配列。古い順にソート済み。
 */
function calculateHistoricalData(allTransactions, currentAccountBalances) {
	// 取引がなければ計算せず空の配列を返す
	if (allTransactions.length === 0) return [];

	// 1. 現在の純資産を計算する
	let currentNetWorth = Object.values(currentAccountBalances).reduce(
		(sum, balance) => sum + balance,
		0
	);

	// 2. 取引を月ごと（"yyyy-MM"）にグループ化する
	const txnsByMonth = allTransactions.reduce((acc, t) => {
		const month = formatInTimeZone(t.date, "Asia/Tokyo", "yyyy-MM");
		if (!acc[month]) acc[month] = [];
		acc[month].push(t);
		return acc;
	}, {});

	// 3. 月ごとの収入と支出を集計する
	const monthlySummaries = {};
	for (const month in txnsByMonth) {
		monthlySummaries[month] = txnsByMonth[month].reduce(
			(acc, t) => {
				// 集計から残高調整用のシステム取引を除外する
				if (t.categoryId === "SYSTEM_BALANCE_ADJUSTMENT") return acc;
				if (t.type === "income") acc.income += t.amount;
				if (t.type === "expense") acc.expense += t.amount;
				return acc;
			},
			{ income: 0, expense: 0 }
		);
	}

	// 4. 最新の月から過去にさかのぼり、各月の純資産を逆算する
	const sortedMonths = Object.keys(monthlySummaries).sort().reverse();
	let runningNetWorth = currentNetWorth;
	const historicalData = [];

	for (const month of sortedMonths) {
		const summary = monthlySummaries[month];
		historicalData.push({
			month: month,
			netWorth: runningNetWorth,
			income: summary.income,
			expense: summary.expense,
		});
		// 当月の収支を差し引いて、前月末時点の純資産を計算する
		runningNetWorth -= summary.income - summary.expense;
	}

	// グラフ表示のために時系列（古い順）に並べ替えて返す
	return historicalData.reverse();
}

/**
 * 現在のstateとフィルター条件に基づいて、各UIコンポーネントの描画関数を呼び出す。
 * @returns {void}
 */
function renderUI() {
	if (!elements.monthFilter.value) return; // フィルターが初期化されていない場合は何もしない

	let targetTransactions;
	if (elements.monthFilter.value === "all-time") {
		targetTransactions = state.transactions;
	} else {
		const [year, month] = elements.monthFilter.value.split("-").map(Number);
		targetTransactions = state.transactions.filter((t) => {
			const transactionDate = new Date(t.date);
			return (
				transactionDate.getFullYear() === year &&
				transactionDate.getMonth() + 1 === month
			);
		});
	}
	const filteredTransactions = transactions.applyFilters(targetTransactions);

	// 純資産推移グラフ用のデータを計算
	const historicalData = calculateHistoricalData(
		state.transactions,
		state.accountBalances
	);

	// 各UIモジュールの描画関数を呼び出す
	dashboard.render(
		targetTransactions,
		historicalData,
		state.accountBalances,
		state.isAmountMasked,
		elements.monthFilter.value,
		state.luts
	);
	transactions.render(filteredTransactions, state.isAmountMasked);
	analysis.render(targetTransactions, state.isAmountMasked);
	balances.render(state.accountBalances, state.isAmountMasked);
	billing.render(
		state.transactions,
		state.config.creditCardRules || {},
		state.isAmountMasked,
		state.luts
	);
}

/**
 * 取引データから年月を抽出し、月間フィルターのドロップダウンを生成する。
 * @param {Array<object>} transactions - 取引データの配列。
 * @returns {void}
 */
function populateMonthFilter(transactions) {
	const months = [
		...new Set(
			transactions.map((t) => {
				return formatInTimeZone(t.date, "Asia/Tokyo", "yyyy-MM");
			})
		),
	];
	months.sort().reverse();
	elements.monthFilter.innerHTML =
		'<option value="all-time">全期間</option>' +
		months
			.map((m) => `<option value="${m}">${m.replace("-", "年")}月</option>`)
			.join("");
	elements.monthFilter.value = "all-time";
}

/**
 * ユーザーの基本データ（口座、カテゴリ、設定）をFirestoreから取得し、
 * stateオブジェクトを更新する。
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
}

/**
 * 最終データ取得時刻をUIに表示する。
 * @returns {void}
 */
function updateLastUpdatedTime() {
	const now = new Date();
	const timeString = now.toLocaleTimeString("ja-JP", {
		hour: "2-digit",
		minute: "2-digit",
	});
	elements.lastUpdatedTime.textContent = `最終取得: ${timeString}`;
}

/**
 * 必要なデータ（取引、残高）をFirestoreから読み込み、UIを再描画する。
 * @async
 * @returns {Promise<void>}
 */
async function loadData() {
	elements.refreshIcon.classList.add("spin-animation");

	// ローカル開発モードではJSONから、それ以外はFirestoreからデータを取得
	if (store.isLocalDevelopment) {
		console.info("ローカル開発モード: JSONファイルからデータを読み込みます。");
		state.transactions = await store.fetchTransactionsForPeriod(0); // 引数は使われない
	} else {
		state.transactions = await store.fetchTransactionsForPeriod(
			state.config.displayPeriod
		);
	}

	state.accountBalances = await store.fetchAccountBalances();
	populateMonthFilter(state.transactions);
	renderUI();

	elements.refreshIcon.classList.remove("spin-animation");
	updateLastUpdatedTime();
}

/**
 * レシートスキャン結果の登録処理。
 * @async
 * @param {object} data - スキャンされ、確認・修正された取引データ。
 * @returns {Promise<void>}
 */
async function handleScanRegister(data) {
	// バリデーションはstore.saveTransactionに任せる
	await store.saveTransaction(data);
	await loadData(); // 画面を更新
	showNotification("レシートを登録しました！", "success");
}

/**
 * 各UIモジュールを初期化し、コールバック関数や依存関係を注入する。
 * @returns {void}
 */
function initializeModules() {
	store.init(state);
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
	// 設定モーダルの初期化とコールバック設定
	settings.init(
		{
			getInitialData: () => ({
				luts: state.luts,
				config: state.config,
			}),
			getInitialDisplayPeriod: () => {
				return state.config.displayPeriod;
			},
			getUsedItems: () => {
				const usedAccounts = new Set();
				const usedCategories = new Set();
				state.transactions.forEach((t) => {
					if (t.type === "transfer") {
						usedAccounts.add(t.fromAccount);
						usedAccounts.add(t.toAccount);
					} else {
						if (t.paymentMethod) usedAccounts.add(t.paymentMethod);
						if (t.category) usedCategories.add(t.category);
					}
				});
				return {
					accounts: [...usedAccounts],
					categories: [...usedCategories],
					accountBalances: state.accountBalances,
				};
			},
			// 表示期間が変更されたときの処理
			onUpdateDisplayPeriod: async (newPeriod) => {
				state.displayPeriod = newPeriod;
				await store.updateUserConfig({ displayPeriod: newPeriod });
				const periodSelector = document.getElementById(
					"display-period-selector"
				);
				const selectedOption = periodSelector.querySelector(
					`option[value="${newPeriod}"]`
				);
				if (selectedOption) {
					const monthFilter = document.getElementById("month-filter");
					const allTimeOption = monthFilter.querySelector(
						'option[value="all-time"]'
					);
					if (allTimeOption) {
						allTimeOption.textContent = selectedOption.textContent.trim();
					}
				}
				location.reload();
			},
			// 残高調整が実行されたときの処理
			onAdjustBalance: async (accountId, difference) => {
				const account = state.luts.accounts.get(accountId);
				if (!account) return;

				const nowInTokyoStr = formatInTimeZone(
					new Date(),
					"Asia/Tokyo",
					"yyyy-MM-dd"
				);
				const transaction = {
					type: difference > 0 ? "income" : "expense",
					date: nowInTokyoStr,
					amount: Math.abs(difference),
					categoryId: "SYSTEM_BALANCE_ADJUSTMENT",
					accountId: accountId,
					description: "残高のズレを実績値に調整",
					memo: `調整前の残高: ¥${(
						state.accountBalances[accountId] || 0
					).toLocaleString()}`,
				};

				await store.saveTransaction(transaction);
				await loadData();
			},
			// 項目（口座・カテゴリ）が追加されたときの処理
			onAddItem: async (itemData) => {
				const { type } = itemData;
				let currentCount = 0;
				if (type === "asset" || type === "liability") {
					currentCount = state.luts.accounts.size;
				} else {
					currentCount = state.luts.categories.size;
				}
				const dataToSave = { ...itemData, order: currentCount };
				await store.addItem(dataToSave);
				await loadLutsAndConfig();
				renderUI();
				settings.render(state.luts, state.config);
			},
			// 項目が更新されたときの処理
			onUpdateItem: async (itemId, itemType, updateData) => {
				await store.updateItem(itemId, itemType, updateData);
				await loadLutsAndConfig();
				renderUI();
				transactions.populateFilterDropdowns();
				settings.render(state.luts, state.config);
			},
			// 項目が削除されたときの処理
			onDeleteItem: async (itemId, itemType) => {
				await store.deleteItem(itemId, itemType);
				await loadLutsAndConfig();
				renderUI();
				settings.render(state.luts, state.config);
			},
			// カテゴリの付け替えが実行されたときの処理
			onRemapCategory: async (fromCatId, toCatName) => {
				const toCategory = [...state.luts.categories.values()].find(
					(c) => c.name === toCatName
				);
				if (!toCategory) {
					throw new Error(`振替先のカテゴリ「${toCatName}」が見つかりません。`);
				}
				// Firestore上の取引を一括更新する
				await store.remapTransactions(fromCatId, toCategory.id);
				// ローカルのstateも更新して即時反映
				state.transactions.forEach((t) => {
					if (t.categoryId === fromCatId) t.categoryId = toCategory.id;
				});
				await loadLutsAndConfig();
				settings.render(state.luts, state.config);
			},
			// 口座の並び順が更新されたときの処理
			onUpdateAccountOrder: async (orderedIds) => {
				await store.updateAccountOrder(orderedIds);
				await loadLutsAndConfig();
				renderUI();
				settings.render(state.luts, state.config);
			},
			// カテゴリの並び順が更新されたときの処理
			onUpdateCategoryOrder: async (orderedIds) => {
				await store.updateCategoryOrder(orderedIds);
				await loadLutsAndConfig();
				renderUI();
				settings.render(state.luts, state.config);
			},
			// クレジットカードルールが更新されたときの処理
			onUpdateCardRule: async (cardId, ruleData) => {
				const updatePayload = {
					creditCardRules: {
						[cardId]: ruleData,
					},
				};
				await store.updateUserConfig(updatePayload);
				await loadLutsAndConfig();
				await loadData();
				settings.render(state.luts, state.config);
			},
			// クレジットカードルールが削除されたときの処理
			onDeleteCardRule: async (cardId) => {
				const fieldPath = `creditCardRules.${cardId}`;
				await store.updateUserConfig({ [fieldPath]: FieldValue.delete() });
				await loadLutsAndConfig();
				await loadData();
				settings.render(state.luts, state.config);
			},
		},
		state.luts,
		state.config
	);
	// 各UIモジュールの初期化
	scanStart.init();
	scanConfirm.init(
		{
			register: handleScanRegister,
		},
		state.luts
	);
	guide.init();
	analysis.init(renderUI, state.luts);
	transactions.init(renderUI, state.luts);
	balances.init((accountId, targetCard) => {
		balances.toggleHistoryChart(
			accountId,
			targetCard,
			state.transactions,
			state.accountBalances,
			state.isAmountMasked
		);
	}, state.luts);
	// 請求リストの「支払う」ボタンが押されたときの処理
	billing.init((data) => {
		state.pendingBillPayment = {
			cardId: data.toAccountId,
			closingDateStr: data.closingDateStr,
		};
		modal.openModal(null, {
			type: "transfer",
			date: data.paymentDate,
			amount: data.amount,
			fromAccountId: data.defaultAccountId,
			toAccountId: data.toAccountId,
			description: `${data.cardName} (${data.closingDate}締分) 支払い`,
		});
	});
}

/**
 * ユーザー認証成功後に実行されるセットアップ処理。
 * ユーザー情報を表示し、データの読み込みを開始してUIを構築する。
 * @async
 * @param {object} user - Firebase Authのユーザーオブジェクト。
 */
async function setupUser(user) {
	elements.loadingIndicator.classList.remove("hidden");

	// サイドメニュー内のユーザーアバターを設定
	const menuUserAvatar = elements.menuUserAvatar;
	const menuUserPlaceholder = elements.menuUserPlaceholder;

	if (user.photoURL) {
		menuUserAvatar.src = user.photoURL;
		menuUserAvatar.classList.remove("hidden");
		menuUserPlaceholder.classList.add("hidden");
	} else {
		menuUserAvatar.classList.add("hidden");
		menuUserPlaceholder.classList.remove("hidden");
	}

	// データを読み込んでUIを描画する
	try {
		await loadLutsAndConfig();
		initializeModules();
		await loadData();
	} catch (error) {
		console.error("データの読み込み中にエラーが発生しました:", error);
	}

	// 認証後画面に切り替え
	elements.loadingIndicator.classList.add("hidden");
	elements.authScreen.classList.add("hidden");
	elements.mainContent.classList.remove("hidden");
	elements.menuButton.classList.remove("hidden");
	elements.refreshDataButton.classList.remove("invisible");
	elements.lastUpdatedTime.classList.remove("invisible");

	// スクロール位置に応じてサイドメニューのハイライトを更新する処理
	const header = document.querySelector("header");
	const sections = document.querySelectorAll("main > section[id]");
	const menuLinks = document.querySelectorAll(".menu-link");
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
 * @returns {void}
 */
function cleanupUI() {
	elements.mainContent.classList.add("hidden");
	elements.authScreen.classList.remove("hidden");
	elements.loginContainer.classList.remove("hidden");
	elements.menuButton.classList.add("hidden");
	elements.refreshDataButton.classList.add("invisible");
	elements.lastUpdatedTime.classList.add("invisible");
	if (elements.analysisCanvas) {
		const chartInstance = Chart.getChart(elements.analysisCanvas);
		if (chartInstance) chartInstance.destroy();
	}
}

/**
 * アプリケーション全体のイベントリスナーや初期設定を行う。
 * @returns {void}
 */
function initializeApp() {
	// ==========================================================================
	// 1. サイドメニューの制御
	// ==========================================================================
	const openMenu = () => {
		elements.menuPanel.classList.remove("-translate-x-full");
		elements.menuOverlay.classList.remove("hidden");
		document.body.classList.add("overflow-hidden");
	};
	const closeMenu = () => {
		elements.menuPanel.classList.add("-translate-x-full");
		elements.menuOverlay.classList.add("hidden");
		document.body.classList.remove("overflow-hidden");
	};

	elements.menuButton.addEventListener("click", () => {
		elements.menuPanel.classList.contains("-translate-x-full")
			? openMenu()
			: closeMenu();
	});
	elements.menuOverlay.addEventListener("click", closeMenu);

	// メニュー内のリンククリックで、該当セクションへスクロールしメニューを閉じる
	elements.menuPanel.querySelectorAll(".menu-link").forEach((link) =>
		link.addEventListener("click", (e) => {
			e.preventDefault();
			closeMenu();
			const targetId = link.getAttribute("href");
			if (targetId.startsWith("#")) {
				const targetElement = document.querySelector(targetId);
				if (targetElement) targetElement.scrollIntoView({ behavior: "smooth" });
			}
		})
	);

	// ==========================================================================
	// 2. メニュー項目からの機能呼び出し
	// ==========================================================================
	// 設定
	elements.settingsButton.addEventListener("click", (e) => {
		e.preventDefault();
		settings.openModal();
		closeMenu();
	});

	// ガイド
	elements.openGuideButton.addEventListener("click", (e) => {
		e.preventDefault();
		guide.open();
		closeMenu();
	});

	// ログアウト
	elements.menuLogoutButton.addEventListener("click", (e) => {
		e.preventDefault();
		signOut(auth);
		closeMenu();
	});

	// レシートスキャン
	if (elements.scanFab) {
		// カメラボタンクリック -> 開始モーダルを開く
		elements.scanFab.addEventListener("click", () => {
			scanStart.open();
		});
	}

	// ==========================================================================
	// 3. グローバルキーボードショートカット
	// ==========================================================================
	document.addEventListener("keydown", (e) => {
		// 新規取引作成 (Cmd/Ctrl + N)
		if ((e.metaKey || e.ctrlKey) && e.key === "n") {
			e.preventDefault();
			modal.openModal();
			return;
		}
		// 各種モーダルを閉じる (Escape)
		if (e.key === "Escape") {
			// 優先度順に閉じる処理を実行
			if (scanConfirm.isOpen()) {
				scanConfirm.close();
				return;
			}

			// スキャン開始モーダル
			if (scanStart.isOpen()) {
				scanStart.close(); // 解析中は内部でブロックされる
				return;
			}

			// 3. 取引追加モーダル
			if (
				modal.modalElement &&
				!modal.modalElement.classList.contains("hidden")
			) {
				modal.closeModal();
				return;
			}
			// ガイドモーダル
			if (guide.isOpen()) {
				guide.close();
				return;
			}
		}
	});

	// ==========================================================================
	// 4. その他のUIイベントリスナー
	// ==========================================================================
	elements.loginButton.addEventListener("click", handleLogin);
	elements.addTransactionButton.addEventListener("click", () =>
		modal.openModal()
	);
	elements.refreshDataButton.addEventListener("click", () => {
		if (store.isLocalDevelopment) return;
		loadLutsAndConfig().then(loadData);
	});
	elements.maskToggle.addEventListener("change", (e) => {
		state.isAmountMasked = e.target.checked;
		renderUI();
	});
	elements.monthFilter.addEventListener("change", renderUI);

	// 取引リストの項目クリックで編集モーダルを開く（イベント委任）
	elements.transactionsList.addEventListener("click", (e) => {
		const targetRow = e.target.closest("div[data-id]");
		if (targetRow) {
			const transaction = store.getTransactionById(
				targetRow.dataset.id,
				state.transactions
			);
			if (transaction) modal.openModal(transaction);
		}
	});

	// ==========================================================================
	// 5. Firebase認証状態の監視を開始
	// ==========================================================================
	onAuthStateChanged(auth, (user) => {
		if (user) {
			elements.authContainer.classList.add("hidden");
			setupUser(user); // 認証後セットアップ処理を開始
		} else {
			elements.loadingIndicator.classList.add("hidden");
			elements.loginContainer.classList.remove("hidden");
			elements.authContainer.classList.remove("hidden");
			cleanupUI();
		}
	});
}

// DOMの読み込み完了後にアプリケーションを初期化する
document.addEventListener("DOMContentLoaded", () => {
	initializeApp();
});
