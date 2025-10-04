import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { FieldValue } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth } from "./firebase.js";
import * as store from "./store.js";
import * as analysis from "./ui/analysis.js";
import * as balances from "./ui/balances.js";
import * as billing from "./ui/billing.js";
import * as dashboard from "./ui/dashboard.js";
import * as modal from "./ui/modal.js";
import * as settings from "./ui/settings.js";
import * as transactions from "./ui/transactions.js";

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

	// 通知バナー
	notificationBanner: document.getElementById("notification-banner"),
	notificationMessage: document.getElementById("notification-message"),

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

	// ガイドモーダル
	guideModal: document.getElementById("guide-modal"),
	guideContentContainer: document.getElementById("guide-content-container"),
	openGuideButton: document.getElementById("guide-button"),
	closeGuideButton: document.getElementById("close-guide-modal-button"),
};

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

let notificationTimeout;

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
			return showNotification("振替元と振替先が同じです。");
		}
	} else {
		data.categoryId = form.querySelector("#category").value;
		data.accountId = form.querySelector("#payment-method").value;
	}

	try {
		await store.saveTransaction(data, oldTransaction);

		// もし、これが支払い記録のための振替だったら...
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
		showNotification("取引を保存しました。", "success");
	} catch (err) {
		console.error("保存エラー:", err);
		if (err.code === "unavailable") {
			showNotification(
				"オフラインのため保存できません。接続を確認してください。"
			);
		} else {
			showNotification("エラーが発生しました。取引の保存に失敗しました。");
		}
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
				showNotification("取引を削除しました。", "success");
			}
		} catch (err) {
			console.error("削除エラー:", err);
			showNotification("取引の削除に失敗しました。");
		}
	}
}

function calculateHistoricalData(allTransactions, currentAccountBalances) {
	// 取引がなければ空の配列を返す
	if (allTransactions.length === 0) return [];

	// 1. 現在の純資産を計算
	let currentNetWorth = Object.values(currentAccountBalances).reduce(
		(sum, balance) => sum + balance,
		0
	);

	// 2. 取引を月ごとにグループ化
	const txnsByMonth = allTransactions.reduce((acc, t) => {
		const month = t.date.toISOString().slice(0, 7); // "YYYY-MM"形式
		if (!acc[month]) acc[month] = [];
		acc[month].push(t);
		return acc;
	}, {});

	// 3. 月ごとの収入と支出を集計
	const monthlySummaries = {};
	for (const month in txnsByMonth) {
		monthlySummaries[month] = txnsByMonth[month].reduce(
			(acc, t) => {
				// 集計から調整・設定用の取引を除外
				if (t.categoryId === "SYSTEM_BALANCE_ADJUSTMENT") return acc;
				if (t.type === "income") acc.income += t.amount;
				if (t.type === "expense") acc.expense += t.amount;
				return acc;
			},
			{ income: 0, expense: 0 }
		);
	}

	// 4. 最新の月から過去にさかのぼって各月の純資産を計算
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
		// 今月の収支を差し引いて、前月の純資産を計算
		runningNetWorth -= summary.income - summary.expense;
	}

	// グラフ表示のために古い順に並べ替えて返す
	return historicalData.reverse();
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

	const historicalData = calculateHistoricalData(
		state.transactions,
		state.accountBalances
	);

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

function updateLastUpdatedTime() {
	const now = new Date();
	const timeString = now.toLocaleTimeString("ja-JP", {
		hour: "2-digit",
		minute: "2-digit",
	});
	elements.lastUpdatedTime.textContent = `最終取得: ${timeString}`;
}

async function loadData() {
	elements.refreshIcon.classList.add("spin-animation");

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
				settings.render(state.luts, state.config);
			},
			onUpdateItem: async (itemId, itemType, updateData) => {
				await store.updateItem(itemId, itemType, updateData);
				await loadLutsAndConfig();
				renderUI();
				transactions.populateFilterDropdowns();
				settings.render(state.luts, state.config);
			},
			onDeleteItem: async (itemId, itemType) => {
				await store.deleteItem(itemId, itemType);
				await loadLutsAndConfig();
				renderUI();
				settings.render(state.luts, state.config);
			},
			onRemapCategory: async (fromCatId, toCatName) => {
				const toCategory = [...state.luts.categories.values()].find(
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
				settings.render(state.luts, state.config);
			},
			onUpdateAccountOrder: async (orderedIds) => {
				await store.updateAccountOrder(orderedIds);
				await loadLutsAndConfig();
				renderUI();
				settings.render(state.luts, state.config);
			},
			onUpdateCategoryOrder: async (orderedIds) => {
				await store.updateCategoryOrder(orderedIds);
				await loadLutsAndConfig();
				renderUI();
				settings.render(state.luts, state.config);
			},
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
		initializeModules();
		await loadData();
	} catch (error) {
		console.error("データの読み込み中にエラーが発生しました:", error);
	}

	elements.loadingIndicator.classList.add("hidden");
	elements.authScreen.classList.add("hidden");
	elements.mainContent.classList.remove("hidden");
	elements.menuButton.classList.remove("hidden");
	elements.refreshDataButton.classList.remove("hidden");
	elements.lastUpdatedTime.classList.remove("hidden");

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
	elements.menuButton.classList.add("hidden");
	elements.refreshDataButton.classList.add("hidden");
	elements.lastUpdatedTime.classList.add("hidden");
	if (elements.analysisCanvas) {
		const chartInstance = Chart.getChart(elements.analysisCanvas);
		if (chartInstance) chartInstance.destroy();
	}
}

function initializeApp() {
	// Service Workerの廃止
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.getRegistrations().then((registrations) => {
			if (registrations.length === 0) return;
			for (let registration of registrations) {
				registration.unregister();
			}
		});
	}

	// リフレッシュボタンのイベントリスナー
	elements.refreshDataButton.addEventListener("click", () => {
		if (store.isLocalDevelopment) return;
		// LUT（口座マスタなど）も含めて、すべてのデータを再取得する
		loadLutsAndConfig().then(loadData);
	});

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
	elements.menuPanel.querySelectorAll(".menu-link").forEach((link) =>
		link.addEventListener("click", (e) => {
			e.preventDefault(); // ★ preventDefault を追加
			closeMenu();
			// スムーズスクロールのために、href属性を使って遷移
			const targetId = link.getAttribute("href");
			const targetElement = document.querySelector(targetId);
			if (targetElement) {
				targetElement.scrollIntoView({ behavior: "smooth" });
			}
		})
	);
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

	let isGuideLoaded = false;
	const openGuide = async () => {
		// まだ読み込んでいなければ、guide.htmlをフェッチする
		if (!isGuideLoaded) {
			try {
				const response = await fetch("./guide.html");
				if (!response.ok) throw new Error("ガイドの読み込みに失敗しました。");
				const html = await response.text();
				elements.guideContentContainer.innerHTML = html;
				isGuideLoaded = true;
			} catch (error) {
				elements.guideContentContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
			}
		}
		elements.guideModal.classList.remove("hidden");
		document.body.classList.add("modal-open");
		closeMenu();
	};
	const closeGuide = () => {
		elements.guideModal.classList.add("hidden");
		document.body.classList.remove("modal-open");
	};

	// ガイドモーダルのイベントリスナー
	elements.openGuideButton.addEventListener("click", (e) => {
		e.preventDefault(); // <a>タグのデフォルト動作（ページ遷移）をキャンセル
		openGuide();
	});
	elements.closeGuideButton.addEventListener("click", closeGuide);
	elements.guideModal.addEventListener("click", (e) => {
		if (e.target === elements.guideModal) closeGuide();
	});
	document.addEventListener("keydown", (e) => {
		if (
			e.key === "Escape" &&
			!elements.guideModal.classList.contains("hidden")
		) {
			closeGuide();
		}
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
		if (user) {
			// ログインしている場合
			elements.authContainer.classList.add("hidden");
			setupUser(user);
		} else {
			// ログアウトしている場合
			elements.loadingIndicator.classList.add("hidden");
			elements.loginContainer.classList.remove("hidden");
			elements.authContainer.classList.remove("hidden");
			cleanupUI();
		}
	});
}

// ページ読み込み時にアプリを初期化
document.addEventListener("DOMContentLoaded", () => {
	initializeApp();
});
