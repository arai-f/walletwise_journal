import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from "./firebase.js";
import * as store from "./store.js";
import * as analysis from "./ui/analysis.js";
import * as balances from "./ui/balances.js";
import * as billing from "./ui/billing.js";
import * as dashboard from "./ui/dashboard.js";
import * as modal from "./ui/modal.js";
import * as settings from "./ui/settings.js";
import * as transactions from "./ui/transactions.js";

// import {
// 	collection,
// 	doc,
// 	FieldValue,
// 	getDoc,
// 	getDocs,
// 	query,
// 	setDoc,
// 	where,
// 	writeBatch,
// } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// import { db } from "./firebase.js";
// window.exportTools = {
// 	auth,
// 	db,
// 	collection,
// 	doc,
// 	FieldValue,
// 	getDoc,
// 	getDocs,
// 	query,
// 	setDoc,
// 	where,
// 	writeBatch,
// };
// console.log("エクスポートツールの準備ができました。");

const elements = {
	authScreen: document.getElementById("auth-screen"),
	mainContent: document.getElementById("main-content"),
	loginContainer: document.getElementById("login-container"),
	loginButton: document.getElementById("login-button"),
	loadingIndicator: document.getElementById("loading-indicator"),
	addTransactionButton: document.getElementById("add-transaction-button"),

	// メニュー
	menuButton: document.getElementById("menu-button"),
	menuPanel: document.getElementById("menu-panel"),
	menuOverlay: document.getElementById("menu-overlay"),
	menuUserAvatar: document.getElementById("menu-user-avatar"),
	menuUserPlaceholder: document.getElementById("menu-user-avatar-placeholder"),
	maskToggle: document.getElementById("mask-toggle"),
	settingsButton: document.getElementById("settings-button"),
	menuLogoutButton: document.getElementById("menu-logout-button"),

	// ダッシュボード
	dashboardTotalAssets: document.getElementById("dashboard-total-assets"),
	dashboardIncome: document.getElementById("dashboard-income"),
	dashboardExpense: document.getElementById("dashboard-expense"),
	dashboardBalance: document.getElementById("dashboard-balance"),
	// 口座残高
	balancesGrid: document.getElementById("balances-grid"),
	billingList: document.getElementById("billing-list"),
	// 分析レポート
	analysisCanvas: document.getElementById("analysis-canvas"),
	// 取引履歴
	monthFilter: document.getElementById("month-filter"),
	transactionsList: document.getElementById("transactions-list"),
	noTransactionsMessage: document.getElementById("no-transactions-message"),
};

const state = {
	luts: {
		accounts: new Map(),
		categories: new Map(),
	},
	config: {},
	accountBalances: {},
	transactions: [],
	bills: [],
	isAmountMasked: false,
};

function handleLogin() {
	const provider = new GoogleAuthProvider();
	signInWithPopup(auth, provider).catch((err) =>
		console.error("ログインエラー", err)
	);
}

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
	const data = {
		id: transactionId,
		type: type,
		date: form.querySelector("#date").value,
		amount: Number(form.querySelector("#amount").value),
		description: form.querySelector("#description").value,
		memo: form.querySelector("#memo").value,
	};

	if (type === "transfer") {
		data.fromAccountId = form.querySelector("#transfer-from").value;
		data.toAccountId = form.querySelector("#transfer-to").value;
		if (data.fromAccountId === data.toAccountId) {
			return alert("振替元と振替先が同じです。");
		}
	} else {
		data.categoryId = form.querySelector("#category").value;
		data.accountId = form.querySelector("#payment-method").value;
	}

	if (form.dataset.metadata) {
		data.metadata = JSON.parse(form.dataset.metadata);
	}

	try {
		await store.saveTransaction(data, oldTransaction);
		modal.closeModal();
		form.removeAttribute("data-metadata"); // 使用後に削除
		await loadData();
	} catch (err) {
		console.error("保存エラー:", err);
		alert("取引の保存に失敗しました。");
	}
}

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
				await loadData(); // データを再読み込み
			}
		} catch (err) {
			console.error("削除エラー:", err);
			alert("取引の削除に失敗しました。");
		}
	}
}

function renderUI() {
	if (!elements.monthFilter.value) return;

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

	dashboard.render(
		targetTransactions,
		state.accountBalances,
		state.isAmountMasked,
		elements.monthFilter.value,
		state.luts
	);
	transactions.render(filteredTransactions, state.isAmountMasked);
	analysis.render(targetTransactions, state.isAmountMasked);
	balances.render(state.accountBalances, state.isAmountMasked);
	billing.render(state.bills, state.isAmountMasked);
}

function populateMonthFilter(transactions) {
	const months = [
		...new Set(
			transactions.map((t) => new Date(t.date).toISOString().slice(0, 7))
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

async function loadLutsAndConfig() {
	const [accounts, categories, config] = await Promise.all([
		store.fetchUserAccounts(),
		store.fetchUserCategories(),
		store.fetchUserConfig(),
	]);

	state.luts.accounts.clear();
	accounts.forEach((acc) => state.luts.accounts.set(acc.id, acc));

	state.luts.categories.clear();
	categories.forEach((cat) => state.luts.categories.set(cat.id, cat));

	state.config = config;
}

async function loadData() {
	if (store.isLocalDevelopment) {
		console.warn("ローカル開発モード: JSONファイルからデータを読み込みます。");
		state.transactions = await store.fetchTransactionsForPeriod(0); // 引数は使われない
	} else {
		state.transactions = await store.fetchTransactionsForPeriod(
			state.config.displayPeriod
		);
	}

	state.accountBalances = await store.fetchAccountBalances();
	state.bills = billing.calculateBills(
		state.transactions,
		state.config.creditCardRules || {}
	);
	populateMonthFilter(state.transactions);
	renderUI();
}

function initializeModules(appState) {
	store.init(appState);
	modal.init(
		{ submit: handleFormSubmit, delete: handleDeleteClick },
		appState.luts
	);
	settings.init(
		{
			getInitialData: () => ({
				luts: appState.luts,
				config: appState.config,
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
			onUpdateDisplayPeriod: async (newPeriod) => {
				state.displayPeriod = newPeriod;
				await store.updateUserConfig({ displayPeriod: newPeriod });
				location.reload();
			},
			onAdjustBalance: async (accountId, difference) => {
				const now = new Date();
				const account = state.luts.accounts.get(accountId);
				if (!account) return;

				const transaction = {
					type: difference > 0 ? "income" : "expense",
					date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
						2,
						"0"
					)}-${String(now.getDate()).padStart(2, "0")}`,
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
				settings.render(appState.luts, appState.config);
			},
			onUpdateItem: async (itemId, itemType, updateData) => {
				await store.updateItem(itemId, itemType, updateData);
				await loadLutsAndConfig();
				transactions.populateFilterDropdowns();
				renderUI();
				settings.render(appState.luts, appState.config);
			},
			onDeleteItem: async (itemId, itemType) => {
				await store.deleteItem(itemId, itemType);
				await loadLutsAndConfig();
				renderUI();
				settings.render(appState.luts, appState.config);
			},
			onRemapCategory: async (fromCatId, toCatName) => {
				const toCategory = [...appState.luts.categories.values()].find(
					(c) => c.name === toCatName
				);
				if (!toCategory) {
					throw new Error(`振替先のカテゴリ「${toCatName}」が見つかりません。`);
				}
				// 取引を一括更新する処理
				await store.remapTransactions(fromCatId, toCategory.id);
				// ローカルの取引データも更新
				state.transactions.forEach((t) => {
					if (t.categoryId === fromCatId) t.categoryId = toCategory.id;
				});
				await loadLutsAndConfig();
				settings.render(appState.luts, appState.config);
			},
			onUpdateAccountOrder: async (orderedIds) => {
				await store.updateAccountOrder(orderedIds);
				await loadLutsAndConfig();
				renderUI();
				settings.render(appState.luts, appState.config);
			},
			onUpdateCategoryOrder: async (orderedIds) => {
				await store.updateCategoryOrder(orderedIds);
				await loadLutsAndConfig();
				renderUI();
				settings.render(appState.luts, appState.config);
			},
			onUpdateCardRule: async (cardId, ruleData) => {
				const fieldPath = `creditCardRules.${cardId}`;
				await store.updateUserConfig({ [fieldPath]: ruleData });
				await loadLutsAndConfig();
				await loadData();
				settings.render(appState.luts, appState.config);
			},
			onDeleteCardRule: async (cardId) => {
				const { FieldValue } = await import(
					"https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"
				);
				const fieldPath = `creditCardRules.${cardId}`;
				await store.updateUserConfig({ [fieldPath]: FieldValue.delete() });
				await loadLutsAndConfig();
				await loadData();
				settings.render(appState.luts, appState.config);
			},
		},
		appState.luts,
		appState.config
	);
	analysis.init(renderUI, appState.luts);
	transactions.init(renderUI, appState.luts);
	balances.init((accountId, targetCard) => {
		balances.toggleHistoryChart(
			accountId,
			targetCard,
			state.transactions,
			state.accountBalances,
			state.isAmountMasked
		);
	}, appState.luts);
	billing.init((data) => {
		const fromAccount = [...appState.luts.accounts.values()].find(
			(acc) => acc.name === data.defaultAccount
		);
		modal.openModal(null, {
			type: "transfer",
			date: data.paymentDate,
			amount: data.amount,
			fromAccountId: fromAccount?.id,
			toAccountId: data.toAccountId,
			description: `${data.cardName} (${data.closingDate}締分) 支払い`,
		});
	}, appState.luts);
}

async function setupUser(user) {
	elements.loadingIndicator.classList.remove("hidden");

	// メニュー内のユーザー情報を設定
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

	// データを読み込んで描画する
	try {
		await loadLutsAndConfig();
		initializeModules(state);
		await loadData();
	} catch (error) {
		console.error("データの読み込み中にエラーが発生しました:", error);
		alert("データの読み込みに失敗しました。コンソールを確認してください。");
	}

	elements.loadingIndicator.classList.add("hidden");
	elements.authScreen.classList.add("hidden");
	elements.mainContent.classList.remove("hidden");
	elements.menuButton.classList.remove("hidden");

	// スクロールでメニューのハイライトを更新する処理
	const header = document.querySelector("header");
	const sections = document.querySelectorAll("main > section[id]");
	const menuLinks = document.querySelectorAll(".menu-link");
	const headerHeight = header.offsetHeight;
	sections.forEach((section) => {
		section.style.scrollMarginTop = `${headerHeight}px`;
	});

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

function cleanupUI() {
	elements.mainContent.classList.add("hidden");
	elements.authScreen.classList.remove("hidden");
	elements.loginContainer.classList.remove("hidden");
	elements.dashboardTotalAssets.innerHTML = "";
	elements.dashboardIncome.innerHTML = "";
	elements.dashboardExpense.innerHTML = "";
	elements.dashboardBalance.innerHTML = "";
	elements.balancesGrid.innerHTML = "";
	elements.billingList.innerHTML = "";
	elements.transactionsList.innerHTML = "";
	elements.noTransactionsMessage.classList.add("hidden");
	elements.menuButton.classList.add("hidden"); // ★メニューボタンを隠す
	if (elements.analysisCanvas) {
		const chartInstance = Chart.getChart(elements.analysisCanvas);
		if (chartInstance) chartInstance.destroy();
	}
}

function initializeApp() {
	// メニューのイベントリスナー
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
		const isMenuOpen =
			!elements.menuPanel.classList.contains("-translate-x-full");
		if (isMenuOpen) {
			closeMenu();
		} else {
			openMenu();
		}
	});
	elements.menuOverlay.addEventListener("click", closeMenu);
	elements.menuPanel
		.querySelectorAll(".menu-link")
		.forEach((link) => link.addEventListener("click", closeMenu));
	elements.maskToggle.addEventListener("change", (e) => {
		state.isAmountMasked = e.target.checked;
		renderUI();
	});
	elements.menuLogoutButton.addEventListener("click", (e) => {
		e.preventDefault();
		signOut(auth);
		closeMenu();
	});
	elements.maskToggle.addEventListener("change", (e) => {
		state.isAmountMasked = e.target.checked;
		renderUI();
	});

	// 設定ボタンのイベントリスナー
	elements.settingsButton.addEventListener("click", (e) => {
		e.preventDefault();
		settings.openModal();
		elements.menuPanel.classList.add("-translate-x-full");
		elements.menuOverlay.classList.add("hidden");
	});

	// その他のイベントリスナー
	elements.loginButton.addEventListener("click", handleLogin);
	elements.addTransactionButton.addEventListener("click", () =>
		modal.openModal()
	);
	elements.monthFilter.addEventListener("change", renderUI);
	elements.transactionsList.addEventListener("click", (e) => {
		const targetRow = e.target.closest("div[data-id]");
		if (targetRow) {
			// 常にstate.transactions（表示期間全体のリスト）から検索する
			const transaction = store.getTransactionById(
				targetRow.dataset.id,
				state.transactions
			);
			if (transaction) {
				modal.openModal(transaction);
			} else {
				console.error("取引が見つかりません。ID:", targetRow.dataset.id);
			}
		}
	});

	// 認証状態の監視
	onAuthStateChanged(auth, (user) => {
		elements.loadingIndicator.classList.add("hidden");
		if (user) {
			setupUser(user);
		} else {
			cleanupUI();
		}
	});
}

// ページ読み込み時にアプリを初期化
document.addEventListener("DOMContentLoaded", () => {
	initializeApp();
});
