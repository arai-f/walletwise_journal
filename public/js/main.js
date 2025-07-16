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
import * as transactions from "./ui/transactions.js";

// --- グローバル変数と定数 ---
const isLocalDevelopment =
	window.location.hostname === "localhost" ||
	window.location.hostname === "127.0.0.1";
let allTransactions = [];
let monthlyTransactions = [];
let isAmountMasked = false; // 金額マスクの状態

const menuButton = document.getElementById("menu-button");
const menuPanel = document.getElementById("menu-panel");
const menuOverlay = document.getElementById("menu-overlay");
const maskToggle = document.getElementById("mask-toggle");

// --- 主要なロジック関数 ---
function handleLogin() {
	const provider = new GoogleAuthProvider();
	signInWithPopup(auth, provider).catch((err) =>
		console.error("ログインエラー", err)
	);
}

async function handleFormSubmit(form) {
	const formData = new FormData(form);
	const typeBtn = form.querySelector('#type-selector [class*="-500"]');
	const data = {
		id: formData.get("transaction-id"),
		type: typeBtn.dataset.type,
		date: formData.get("date"),
		amount: formData.get("amount"),
		description: formData.get("description"),
		memo: formData.get("memo"),
	};

	if (data.type === "transfer") {
		data.fromAccount = form.querySelector("#transfer-from").value;
		data.toAccount = form.querySelector("#transfer-to").value;
		if (data.fromAccount === data.toAccount)
			return alert("振替元と振替先が同じです。");
	} else {
		data.category = form.querySelector("#category").value;
		data.paymentMethod = form.querySelector("#payment-method").value;
	}

	try {
		await store.saveTransaction(data);
		modal.closeModal();
		if (!isLocalDevelopment) {
			allTransactions = await store.fetchAllTransactions();
			renderUI();
		}
	} catch (err) {
		console.error("保存エラー:", err);
		alert("取引の保存に失敗しました。");
	}
}

async function handleDeleteClick(transactionId) {
	if (transactionId && confirm("この取引を本当に削除しますか？")) {
		try {
			await store.deleteTransaction(transactionId);
			modal.closeModal();
			if (!isLocalDevelopment) {
				allTransactions = await store.fetchAllTransactions();
				renderUI();
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
		targetTransactions = allTransactions;
	} else {
		const [year, month] = selectedMonth.split("-").map(Number);
		targetTransactions = allTransactions.filter((t) => {
			const transactionDate = new Date(t.date);
			return (
				transactionDate.getFullYear() === year &&
				transactionDate.getMonth() + 1 === month
			);
		});
	}

	const filteredTransactions = transactions.applyFilters(targetTransactions);
	dashboard.render(targetTransactions, allTransactions, isAmountMasked);
	transactions.render(filteredTransactions, isAmountMasked);
	analysis.render(targetTransactions, isAmountMasked);
	balances.render(allTransactions, isAmountMasked);
	billing.render(allTransactions, isAmountMasked, (data) => {
		modal.openModal(null, {
			type: "transfer",
			date: data.paymentDate,
			amount: data.amount,
			fromAccount: data.defaultAccount,
			toAccount: data.cardName,
			description: `${data.cardName} (${data.closingDate}締分) 支払い`,
		});
	});
}

function subscribeForSelectedMonth() {
	if (isLocalDevelopment) return;
	const selectedMonth = document.getElementById("month-filter").value;
	if (!selectedMonth) return;
	const [year, month] = selectedMonth.split("-").map(Number);
	store.subscribeToMonthlyTransactions(year, month, (newData) => {
		monthlyTransactions = newData;
		renderUI();
	});
}

function populateMonthFilter(transactions) {
	if (
		document.getElementById("month-filter").options.length > 0 &&
		!isLocalDevelopment
	)
		return;

	const months = [
		...new Set(transactions.map((t) => t.date.toISOString().slice(0, 7))),
	];
	const currentMonth = new Date().toISOString().slice(0, 7);
	if (!months.includes(currentMonth)) months.push(currentMonth);
	months.sort().reverse();
	document.getElementById("month-filter").innerHTML = months
		.map((m) => `<option value="${m}">${m.replace("-", "年")}月</option>`)
		.join("");
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
	allTransactions = isLocalDevelopment
		? await store.fetchLocalTransactions()
		: await store.fetchAllTransactions();
	populateMonthFilter(allTransactions);

	if (isLocalDevelopment) {
		renderUI();
	} else {
		subscribeForSelectedMonth();
	}
}

function cleanupUI() {
	document.getElementById("login-container").classList.remove("hidden");
	allTransactions = [];
	monthlyTransactions = [];
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
	if (isLocalDevelopment) {
		console.warn(
			"ローカル開発モードで実行中です。データベースには接続しません。"
		);
	}

	// モジュール初期化
	modal.init({ submit: handleFormSubmit, delete: handleDeleteClick });
	transactions.init(renderUI);
	balances.init((accountName, targetCard) => {
		balances.toggleHistoryChart(
			accountName,
			targetCard,
			allTransactions,
			isAmountMasked
		);
	});
	billing.init((data) => {
		modal.openModal(null, {
			type: "transfer",
			date: data.paymentDate,
			amount: data.amount,
			fromAccount: data.defaultAccount,
			toAccount: data.cardName,
			description: `${data.cardName} (${data.closingDate}締分) 支払い`,
		});
	});
	analysis.init(renderUI);

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

	// メニューボタンのクリックで開閉を切り替える
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
		isAmountMasked = e.target.checked;
		renderUI();
	});

	document
		.getElementById("menu-logout-button")
		.addEventListener("click", (e) => {
			e.preventDefault();
			signOut(auth);
			closeMenu();
		});
	document
		.getElementById("login-button")
		.addEventListener("click", handleLogin);
	document
		.getElementById("add-transaction-button")
		.addEventListener("click", () => modal.openModal());
	document
		.getElementById("month-filter")
		.addEventListener(
			"change",
			isLocalDevelopment ? renderUI : subscribeForSelectedMonth
		);
	document
		.getElementById("transactions-list")
		.addEventListener("click", (e) => {
			const targetRow = e.target.closest("div[data-id]");
			if (targetRow) {
				const transaction = store.getTransactionById(
					targetRow.dataset.id,
					allTransactions
				);
				if (transaction) modal.openModal(transaction);
			}
		});

	// 認証状態の監視
	onAuthStateChanged(auth, (user) => {
		const isLoggedIn = !!user;
		document
			.getElementById("auth-screen")
			.classList.toggle("hidden", isLoggedIn);
		document
			.getElementById("main-content")
			.classList.toggle("hidden", !isLoggedIn);
		menuButton.classList.toggle("hidden", !isLoggedIn);
		document.getElementById("loading-indicator").classList.add("hidden");

		if (isLoggedIn) {
			setupUser(user);
		} else {
			cleanupUI();
		}
	});
}

initializeApp();
