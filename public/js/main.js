import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { config } from "./config.js";
import { auth } from "./firebase.js";
import * as store from "./store.js";
import * as analysis from "./ui/analysis.js";
import * as balances from "./ui/balances.js";
import * as billing from "./ui/billing.js";
import * as dashboard from "./ui/dashboard.js";
import * as modal from "./ui/modal.js";
import * as transactions from "./ui/transactions.js";

const state = {
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

// --- 主要なロジック関数 ---
function handleLogin() {
	const provider = new GoogleAuthProvider();
	signInWithPopup(auth, provider).catch((err) =>
		console.error("ログインエラー", err)
	);
}

async function handleFormSubmit(form) {
	const transactionId = form.querySelector("#transaction-id").value;
	const oldTransaction = transactionId
		? store.getTransactionById(transactionId, state.transactions)
		: null;

	const typeBtn = form.querySelector('#type-selector [class*="-500"]');
	const data = {
		id: transactionId,
		type: typeBtn.dataset.type,
		date: form.querySelector("#date").value,
		amount: Number(form.querySelector("#amount").value),
		description: form.querySelector("#description").value,
		memo: form.querySelector("#memo").value,
	};

	if (data.type === "transfer") {
		data.fromAccount = form.querySelector("#transfer-from").value;
		data.toAccount = form.querySelector("#transfer-to").value;
		if (data.fromAccount === data.toAccount) {
			return alert("振替元と振替先が同じです。");
		}
	} else {
		data.category = form.querySelector("#category").value;
		data.paymentMethod = form.querySelector("#payment-method").value;
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

// --- UI描画とデータ更新 ---
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
		selectedMonth
	);
	transactions.render(filteredTransactions, state.isAmountMasked);
	analysis.render(targetTransactions, state.isAmountMasked);
	balances.render(state.accountBalances, state.isAmountMasked);
	billing.render(state.bills, state.isAmountMasked);
}

function handleMonthFilterChange() {
	renderUI();
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

async function loadData() {
	document.getElementById("loading-indicator").classList.remove("hidden");

	if (store.isLocalDevelopment) {
		state.transactions = await store.fetchLocalTransactions();
		// ローカルデータから残高を計算
		const balances = {};
		const allAccounts = [
			...config.assets, // configをどこかでインポートする必要がある
			...config.liabilities,
		];
		allAccounts.forEach((acc) => (balances[acc] = 0));
		state.transactions.forEach((t) => {
			if (t.type === "income") {
				if (balances[t.paymentMethod] !== undefined)
					balances[t.paymentMethod] += t.amount;
			} else if (t.type === "expense") {
				if (balances[t.paymentMethod] !== undefined)
					balances[t.paymentMethod] -= t.amount;
			} else if (t.type === "transfer") {
				if (balances[t.fromAccount] !== undefined)
					balances[t.fromAccount] -= t.amount;
				if (balances[t.toAccount] !== undefined)
					balances[t.toAccount] += t.amount;
			}
		});
		state.accountBalances = balances;
		settingsButton.classList.add("hidden"); // 設定メニューを隠す
	} else {
		// Firebaseモード
		state.accountBalances = await store.fetchAccountBalances();
		state.transactions = await store.fetchTransactionsForPeriod(
			state.displayPeriod
		);
		state.paidCycles = await store.fetchPaidBillCycles();
		settingsButton.classList.remove("hidden"); // 設定メニューを表示
	}

	state.bills = billing.calculateBills(state.transactions, state.paidCycles);
	populateMonthFilter(state.transactions);
	renderUI();
	document.getElementById("loading-indicator").classList.add("hidden");
}

async function setupUser(user) {
	document.getElementById("login-container").classList.add("hidden");

	// メニュー内のユーザー情報を設定
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

	// データの取得とUIの初期描画
	const savedPeriod = localStorage.getItem("displayPeriod");
	if (savedPeriod) {
		state.displayPeriod = Number(savedPeriod);
	}
	document.getElementById("display-period-selector").value =
		state.displayPeriod;

	try {
		await loadData();
	} catch (error) {
		console.error("データの読み込み中にエラーが発生しました:", error);
		alert("データの読み込みに失敗しました。コンソールを確認してください。");
	}
}

function cleanupUI() {
	document.getElementById("login-container").classList.remove("hidden");
	state.accountBalances = {};
	state.transactions = [];
	state.monthlyTransactions = [];
	document.getElementById("dashboard").innerHTML = "";
	document.getElementById("balances-grid").innerHTML = "";
	document.getElementById("billing-list").innerHTML = "";
	document.getElementById("transactions-list").innerHTML = "";
	document.getElementById("no-transactions-message").classList.add("hidden");
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

	// モジュール初期化
	modal.init({ submit: handleFormSubmit, delete: handleDeleteClick });
	analysis.init(renderUI);
	transactions.init(renderUI);
	balances.init((accountName, targetCard) => {
		balances.toggleHistoryChart(
			accountName,
			targetCard,
			state.transactions,
			state.accountBalances,
			state.isAmountMasked
		);
	});
	billing.init((data) => {
		const form = document.getElementById("transaction-form");
		form.dataset.metadata = JSON.stringify({
			closingDate: toYYYYMMDD(new Date(data.closingDate)), // 日付を文字列に
		});
		modal.openModal(null, {
			type: "transfer",
			date: data.paymentDate,
			amount: data.amount,
			fromAccount: data.defaultAccount,
			toAccount: data.cardName,
			description: `${data.cardName} (${data.closingDate}締分) 支払い`,
		});
	});

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
	setTimeout(activateMenuLink, 1000); // 初期表示時にアクティブリンクを設定

	// イベントリスナー設定
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

	// メニューのイベントリスナー
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

	// 設定モーダルのイベントリスナー
	const settingsButton = document.getElementById("settings-button");
	const closeSettingsButton = document.getElementById(
		"close-settings-modal-button"
	);
	const saveSettingsButton = document.getElementById("save-settings-button");

	settingsButton.addEventListener("click", (e) => {
		e.preventDefault();
		settingsModal.classList.remove("hidden");
		document.getElementById("menu-panel").classList.add("-translate-x-full");
		document.getElementById("menu-overlay").classList.add("hidden");
	});

	const closeSettingsModal = () => settingsModal.classList.add("hidden");
	closeSettingsButton.addEventListener("click", closeSettingsModal);
	settingsModal.addEventListener("click", (e) => {
		if (e.target === settingsModal) closeSettingsModal();
	});

	saveSettingsButton.addEventListener("click", () => {
		const period = document.getElementById("display-period-selector").value;
		localStorage.setItem("displayPeriod", period);
		state.displayPeriod = Number(period);
		closeSettingsModal();
		loadData();
	});

	// その他のイベントリスナー
	document
		.getElementById("login-button")
		.addEventListener("click", handleLogin);
	document
		.getElementById("add-transaction-button")
		.addEventListener("click", () => modal.openModal());
	document
		.getElementById("month-filter")
		.addEventListener("change", handleMonthFilterChange);
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
		// 先にローディング表示を確実に隠す
		document.getElementById("loading-indicator").classList.add("hidden");

		const isLoggedIn = !!user;
		document
			.getElementById("auth-screen")
			.classList.toggle("hidden", isLoggedIn);
		document
			.getElementById("main-content")
			.classList.toggle("hidden", !isLoggedIn);

		if (isLoggedIn) {
			setupUser(user);
		} else {
			// ログアウト状態のUIを準備する
			cleanupUI();
		}
	});
}

function toYYYYMMDD(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

initializeApp();
