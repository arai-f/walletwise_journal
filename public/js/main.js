import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { deleteField } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
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

	if (type === "transfer") {
		data.fromAccountId = form.elements["transfer-from"].value;
		data.toAccountId = form.elements["transfer-to"].value;
	} else {
		data.categoryId = form.elements["category"].value;
		data.accountId = form.elements["payment-method"].value;
	}

	console.info("[Data] 取引データを保存します...", data);

	try {
		await store.saveTransaction(data);

		// もし、これが請求支払いモーダルからトリガーされた振替の場合
		if (data.type === "transfer" && state.pendingBillPayment) {
			await store.markBillCycleAsPaid(
				state.pendingBillPayment.cardId,
				state.pendingBillPayment.closingDateStr,
				state.config.creditCardRules || {}
			);
			state.pendingBillPayment = null;
			await loadLutsAndConfig();
		}

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

	// 1. 現在の純資産を計算する
	let currentNetWorth = Object.values(currentAccountBalances).reduce(
		(sum, balance) => sum + balance,
		0
	);

	// 2. 取引を月ごと（"yyyy-MM"）にグループ化する
	const txnsByMonth = allTransactions.reduce((acc, t) => {
		const month = utils.toYYYYMM(t.date);
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
				if (t.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID)
					return acc;
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
 * データの変更やフィルター操作があった場合に呼び出され、画面全体を最新の状態に更新する。
 * @returns {void}
 */
function renderUI() {
	// 1. 「取引履歴」セクション用のデータをフィルタリングする
	let listTargetTransactions;
	if (state.currentMonthFilter === "all-time") {
		listTargetTransactions = state.transactions;
	} else {
		const [year, month] = state.currentMonthFilter.split("-").map(Number);
		listTargetTransactions = state.transactions.filter((t) => {
			const transactionDate = new Date(t.date); // stateの取引日時はDateオブジェクト
			return (
				transactionDate.getFullYear() === year &&
				transactionDate.getMonth() + 1 === month
			);
		});
	}
	// さらにキーワードやカテゴリ等のフィルターを適用する
	const filteredTransactions = transactions.applyFilters(
		listTargetTransactions
	);

	// 2. 収支レポート用のフィルタリング (analysisMonthFilter使用)
	let analysisTargetTransactions;
	const analysisMonth = state.analysisMonth || "all-time";

	if (analysisMonth === "all-time") {
		analysisTargetTransactions = state.transactions;
	} else {
		const [year, month] = analysisMonth.split("-").map(Number);
		analysisTargetTransactions = state.transactions.filter((t) => {
			const transactionDate = new Date(t.date); // stateの取引日時はDateオブジェクト
			return (
				transactionDate.getFullYear() === year &&
				transactionDate.getMonth() + 1 === month
			);
		});
	}

	// 純資産推移グラフ用に全期間のデータを計算する
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
		analysisMonth
	);
	balances.render(state.accountBalances, state.isAmountMasked);
	billing.render(
		state.transactions,
		state.config.creditCardRules || {},
		state.isAmountMasked,
		state.luts
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
 * 必要なデータ（取引、残高）をFirestoreから読み込み、UIを再描画する。
 * データの同期を行い、画面全体を最新の状態にリフレッシュする。
 * @async
 * @returns {Promise<void>}
 */
async function loadData() {
	console.info("[Data] データを読み込み中...");
	const { refreshIcon } = getElements();
	refreshIcon.classList.add("spin-animation");

	state.transactions = await store.fetchTransactionsForPeriod(
		state.config.displayPeriod
	);

	state.accountBalances = await store.fetchAccountBalances();
	// データを元に期間選択のプルダウンを更新する
	populateMonthSelectors(state.transactions);
	renderUI();

	refreshIcon.classList.remove("spin-animation");
	updateLastUpdatedTime();
	console.info("[Data] データ読み込み完了");
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
	const withRefresh =
		(fn, shouldReloadData = false) =>
		async (...args) => {
			await fn(...args);
			await refreshSettings(shouldReloadData);
		};

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
			// 一般設定（表示期間）が変更されたときの処理
			onUpdateDisplayPeriod: async (displayPeriod) => {
				// 互換性のため、ルートのdisplayPeriodとgeneral.displayPeriodの両方を更新する
				// ただし、store.updateConfigはドット記法で部分更新を行う
				await store.updateConfig({
					displayPeriod: deleteField(), // ルートのプロパティを削除（移行完了）
					"general.displayPeriod": displayPeriod,
				});

				// 表示期間の更新に伴うUI更新
				state.displayPeriod = displayPeriod;
				const periodSelector = utils.dom.get("display-period-selector");
				const selectedOption = periodSelector?.querySelector(
					`option[value="${displayPeriod}"]`
				);
				if (selectedOption) {
					// セレクタの全期間オプションの表示名を更新
					const monthFilter = utils.dom.get("month-filter");
					if (monthFilter) {
						const allTimeOption = monthFilter.querySelector(
							'option[value="all-time"]'
						);
						if (allTimeOption)
							allTimeOption.textContent = selectedOption.textContent.trim();
					}
					// 分析用も更新
					const analysisFilter = utils.dom.get("analysis-month-filter");
					if (analysisFilter) {
						const allTimeOption = analysisFilter.querySelector(
							'option[value="all-time"]'
						);
						if (allTimeOption)
							allTimeOption.textContent = selectedOption.textContent.trim();
					}
				}
				location.reload();
			},
			// AIアドバイザー設定が変更されたときの処理（即時反映）
			onUpdateAiSettings: async (isEnabled) => {
				// general.enableAiAdvisor を更新
				await store.updateConfig({
					"general.enableAiAdvisor": isEnabled,
				});

				// stateを更新
				if (!state.config.general) state.config.general = {};
				state.config.general.enableAiAdvisor = isEnabled;

				// UIを更新
				advisor.render(state.config);
				// 有効化された場合、データがなければチェックを実行する
				if (isEnabled) {
					advisor.checkAndRunAdvisor(state.config);
				}
			},
			// 残高調整が実行されたときの処理
			onAdjustBalance: async (accountId, difference) => {
				const transaction = {
					type: difference > 0 ? "income" : "expense",
					date: utils.getToday(),
					amount: Math.abs(difference),
					categoryId: utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID,
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
			onAddItem: withRefresh(async (itemData) => {
				const { type } = itemData;
				let currentCount = 0;
				if (type === "asset" || type === "liability") {
					currentCount = state.luts.accounts.size;
				} else {
					currentCount = state.luts.categories.size;
				}
				const dataToSave = { ...itemData, order: currentCount };
				await store.addItem(dataToSave);
			}),
			// 項目が更新されたときの処理
			onUpdateItem: withRefresh(store.updateItem),
			// 項目が削除されたときの処理
			onDeleteItem: withRefresh(store.deleteItem),
			// カテゴリの付け替えが実行されたときの処理
			onRemapCategory: withRefresh(async (fromCatId, toCatName) => {
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
			}),
			// 口座の並び順が更新されたときの処理
			onUpdateAccountOrder: withRefresh(store.updateAccountOrder),
			// カテゴリの並び順が更新されたときの処理
			onUpdateCategoryOrder: withRefresh(store.updateCategoryOrder),
			// クレジットカードルールが更新されたときの処理
			onUpdateCardRule: withRefresh(async (cardId, ruleData) => {
				const updatePayload = {
					creditCardRules: {
						[cardId]: ruleData,
					},
				};
				// ネストされたオブジェクトのマージ更新なので merge=true を指定
				await store.updateConfig(updatePayload, true);
			}, true),
			// クレジットカードルールが削除されたときの処理
			onDeleteCardRule: withRefresh(async (cardId) => {
				const fieldPath = `creditCardRules.${cardId}`;
				await store.updateConfig({ [fieldPath]: deleteField() });
			}, true),
			// スキャン設定が更新されたときの処理
			onUpdateScanSettings: withRefresh(async (scanSettings) => {
				await store.updateConfig({ scanSettings });
			}),
		},
		state.luts,
		state.config
	);
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
	guide.init();
	terms.init();
	analysis.init({
		onMonthFilterChange: (e) => {
			state.analysisMonth = e.target.value;
			renderUI();
		},
		luts: state.luts,
	});
	transactions.init({
		onFilterChange: renderUI,
		onMonthFilterChange: (e) => {
			state.currentMonthFilter = e.target.value;
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
		luts: state.luts,
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
	report.init(state.luts);
	advisor.init();
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
	loadingIndicator.classList.remove("hidden");

	// サイドメニュー内のユーザーアバターを設定
	menu.updateUser(user);

	// データを読み込んでUIを描画する
	try {
		await loadLutsAndConfig();
		initializeModules();
		await loadData();

		// 口座残高のリアルタイム更新を購読
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

		// AIアドバイザーの定期チェックを実行 (非同期で実行し、UI描画をブロックしない)
		advisor.checkAndRunAdvisor(state.config).catch((err) => {
			console.error("[Advisor] 定期チェック中にエラーが発生しました:", err);
		});
	} catch (error) {
		console.error("[Data] データの読み込み中にエラーが発生しました:", error);
	}

	// 認証後画面に切り替え
	utils.dom.hide(loadingIndicator);
	utils.dom.hide(authScreen);
	utils.dom.show(mainContent);
	menu.showButton();
	utils.dom.show(refreshDataButton);
	utils.dom.show(lastUpdatedTime);

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
