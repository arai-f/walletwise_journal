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

// --- ↓↓↓ このブロックを一時的にmain.jsの末尾に追加してください ↓↓↓ ---
import {
	collection,
	doc,
	getDoc,
	getDocs,
	query,
	where,
	writeBatch,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "./firebase.js";

window.migrationTools = {
	auth,
	db,
	doc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
	writeBatch,
};
console.log(
	"データエクスポートツールの準備ができました。コンソールから exportAllData() を実行してください。"
);
// --- ↑↑↑ ここまで ---

const state = {
	luts: {
		accounts: new Map(),
		categories: new Map(),
	},
	config: {},
	accountBalances: {},
	transactions: [],
	bills: [],
	paidCycles: {},
	isAmountMasked: false,
	displayPeriod: 3,
};

const menuButton = document.getElementById("menu-button");
const menuPanel = document.getElementById("menu-panel");
const menuOverlay = document.getElementById("menu-overlay");
const maskToggle = document.getElementById("mask-toggle");
const settingsModal = document.getElementById("settings-modal");
const settingsButton = document.getElementById("settings-button");

function handleLogin() {
	const provider = new GoogleAuthProvider();
	signInWithPopup(auth, provider).catch((err) =>
		console.error("ログインエラー", err)
	);
}

async function handleFormSubmit(form) {
	const transactionDate = new Date(form.querySelector("#date").value);
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - state.displayPeriod);
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
	const selectedMonth = document.getElementById("month-filter").value;
	if (!selectedMonth) return;

	let targetTransactions;
	if (selectedMonth === "all-time") {
		targetTransactions = state.transactions;
	} else {
		const [year, month] = selectedMonth.split("-").map(Number);
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
		selectedMonth,
		state.luts
	);
	transactions.render(filteredTransactions, state.isAmountMasked);
	analysis.render(targetTransactions, state.isAmountMasked);
	balances.render(state.accountBalances, state.isAmountMasked, state.config);
	billing.render(state.bills, state.isAmountMasked, state.config);
}

function populateMonthFilter(transactions) {
	const filterEl = document.getElementById("month-filter");
	const months = [
		...new Set(
			transactions.map((t) => new Date(t.date).toISOString().slice(0, 7))
		),
	];
	months.sort().reverse();
	filterEl.innerHTML =
		'<option value="all-time">全期間</option>' +
		months
			.map((m) => `<option value="${m}">${m.replace("-", "年")}月</option>`)
			.join("");
	filterEl.value = "all-time";
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
	document.getElementById("loading-indicator").classList.remove("hidden");

	if (store.isLocalDevelopment) {
		console.warn("ローカル開発モード: JSONファイルからデータを読み込みます。");
		state.transactions = await store.fetchTransactionsForPeriod(0); // 引数は使われない
	} else {
		state.transactions = await store.fetchTransactionsForPeriod(
			state.displayPeriod
		);
	}

	state.accountBalances = await store.fetchAccountBalances();
	state.paidCycles = await store.fetchPaidBillCycles();
	state.bills = billing.calculateBills(state.transactions, state.paidCycles);
	populateMonthFilter(state.transactions);
	renderUI();
	document.getElementById("loading-indicator").classList.add("hidden");
}

function initializeModules(appState) {
	store.init(appState);
	modal.init(
		{ submit: handleFormSubmit, delete: handleDeleteClick },
		appState.luts
	);
	settings.init(
		{
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
					systemCategories: state.config.systemCategories || [],
				};
			},
			onAdjustBalance: async (accountName, difference) => {
				const now = new Date();
				const transaction = {
					type: difference > 0 ? "income" : "expense",
					date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
						2,
						"0"
					)}-${String(now.getDate()).padStart(2, "0")}`,
					amount: Math.abs(difference),
					category: "残高調整",
					paymentMethod: accountName,
					description: "残高のズレを実績値に調整",
					memo: `調整前の残高: ¥${(
						state.accountBalances[accountName] || 0
					).toLocaleString()}`,
				};

				// 取引を保存し、データを再読み込み
				await store.saveTransaction(transaction, state.config);
				await loadData();
			},
			onAddItem: async (itemData) => {
				await store.addItem(itemData);
				await loadLutsAndConfig();
				settings.render();
			},
			onDeleteItem: async (itemId, itemType) => {
				// isDeletedフラグを立てる処理
				await store.deleteItem(itemId, itemType);
				await loadLutsAndConfig();
				settings.render();
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
				settings.render();
			},
			onUpdateItem: async (itemId, updateData) => {
				await store.updateItem(itemId, "account", updateData);
				await loadLutsAndConfig();
				settings.render();
			},
			onUpdateOrder: async (orderedIds) => {
				await store.updateAccountOrder(orderedIds);
				await loadLutsAndConfig();
				renderUI();
				settings.render();
			},
			onUpdateCategoryOrder: async (orderedIds) => {
				await store.updateCategoryOrder(orderedIds);
				await loadLutsAndConfig();
				renderUI();
				settings.render();
			},
		},
		appState.luts
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
	billing.init(
		(data) => {
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
		},
		appState.luts,
		appState.config
	);
}

async function setupUser(user) {
	// 1. 先にメインコンテンツエリアを表示する
	document.getElementById("auth-screen").classList.add("hidden");
	document.getElementById("main-content").classList.remove("hidden");
	document.getElementById("menu-button").classList.remove("hidden");

	// 2. メニュー内のユーザー情報を設定
	const menuUserAvatar = document.getElementById("menu-user-avatar");
	const menuUserPlaceholder = document.getElementById(
		"menu-user-avatar-placeholder"
	);

	if (user.photoURL) {
		menuUserAvatar.src = user.photoURL;
		menuUserAvatar.classList.remove("hidden");
		menuUserPlaceholder.classList.add("hidden");
	} else {
		menuUserAvatar.classList.add("hidden");
		menuUserPlaceholder.classList.remove("hidden");
	}

	// 3. ユーザーの設定を取得
	await loadLutsAndConfig();
	initializeModules(state);

	// 4. 表示期間の設定を読み込み
	if (state.config.displayPeriod) {
		state.displayPeriod = state.config.displayPeriod;
	}
	document.getElementById("display-period-selector").value =
		state.displayPeriod;

	// 5. データを読み込んで描画する
	try {
		await loadData();

		// スクロールでメニューのハイライトを更新する処理
		const header = document.querySelector("header");
		const sections = document.querySelectorAll("main > section[id]");
		const menuLinks = document.querySelectorAll(".menu-link");

		// ヘッダーの高さ分だけスクロール位置を調整する
		const headerHeight = header.offsetHeight;
		sections.forEach((section) => {
			section.style.scrollMarginTop = `${headerHeight}px`;
		});

		const activateMenuLink = () => {
			const scrollPosition = window.scrollY + headerHeight;
			let activeSectionId = "";

			// 通常のスクロール時
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
		// 初期表示時にアクティブリンクを設定
		activateMenuLink();
	} catch (error) {
		console.error("データの読み込み中にエラーが発生しました:", error);
		alert("データの読み込みに失敗しました。コンソールを確認してください。");
	}
}

function cleanupUI() {
	document.getElementById("main-content").classList.add("hidden");
	document.getElementById("auth-screen").classList.remove("hidden");
	document.getElementById("login-container").classList.remove("hidden");
	document.getElementById("dashboard-total-assets").innerHTML = "";
	document.getElementById("dashboard-income").innerHTML = "";
	document.getElementById("dashboard-expense").innerHTML = "";
	document.getElementById("dashboard-balance").innerHTML = "";
	document.getElementById("balances-grid").innerHTML = "";
	document.getElementById("billing-list").innerHTML = "";
	document.getElementById("transactions-list").innerHTML = "";
	document.getElementById("no-transactions-message").classList.add("hidden");
	menuButton.classList.add("hidden"); // ★メニューボタンを隠す
	const analysisCanvas = document.getElementById("analysis-chart");
	if (analysisCanvas) {
		const chartInstance = Chart.getChart(analysisCanvas);
		if (chartInstance) chartInstance.destroy();
	}
}

// --- アプリケーション初期化 ---
function initializeApp() {
	if (store.isLocalDevelopment) {
		console.warn(
			"ローカル開発モードで実行中です。データベースには接続しません。"
		);
	}

	// メニューのイベントリスナー
	const openMenu = () => {
		menuPanel.classList.remove("-translate-x-full");
		menuOverlay.classList.remove("hidden");
		document.body.classList.add("overflow-hidden");
	};
	const closeMenu = () => {
		menuPanel.classList.add("-translate-x-full");
		menuOverlay.classList.add("hidden");
		document.body.classList.remove("overflow-hidden");
	};

	menuButton.addEventListener("click", () => {
		const isMenuOpen = !menuPanel.classList.contains("-translate-x-full");
		if (isMenuOpen) {
			closeMenu();
		} else {
			openMenu();
		}
	});
	menuOverlay.addEventListener("click", closeMenu);
	menuPanel
		.querySelectorAll(".menu-link")
		.forEach((link) => link.addEventListener("click", closeMenu));
	maskToggle.addEventListener("change", (e) => {
		state.isAmountMasked = e.target.checked;
		renderUI();
	});
	document
		.getElementById("menu-logout-button")
		.addEventListener("click", (e) => {
			e.preventDefault();
			signOut(auth);
			closeMenu();
		});
	document.getElementById("mask-toggle").addEventListener("change", (e) => {
		state.isAmountMasked = e.target.checked;
		renderUI();
	});

	// 設定ボタンのイベントリスナー
	settingsButton.addEventListener("click", (e) => {
		e.preventDefault();
		settings.openModal();
		menuPanel.classList.add("-translate-x-full");
		menuOverlay.classList.add("hidden");
	});

	// その他のイベントリスナー
	document
		.getElementById("login-button")
		.addEventListener("click", handleLogin);
	document
		.getElementById("add-transaction-button")
		.addEventListener("click", () => modal.openModal());
	document.getElementById("month-filter").addEventListener("change", renderUI);
	document
		.getElementById("transactions-list")
		.addEventListener("click", (e) => {
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
		document.getElementById("loading-indicator").classList.add("hidden");
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
