import * as utils from "../utils.js";

/**
 * 残高タブのUI要素をまとめたオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	grid: utils.dom.get("balances-grid"),
};

/**
 * 残高推移チャートのChart.jsインスタンスを保持する。
 * チャートの再描画時に既存のインスタンスを破棄するために使用する。
 * @type {Chart|null}
 */
let historyChart = null;

/**
 * 残高カードがクリックされたときに呼び出されるコールバック関数。
 * 外部から注入され、クリックイベントを親コンポーネントに通知する。
 * @type {function}
 */
let onCardClickCallback = () => {};

/**
 * アプリケーションのルックアップテーブル（口座、カテゴリ情報）。
 * IDから名前やアイコンなどの情報を参照するために使用する。
 * @type {object}
 */
let appLuts = {};

/**
 * 残高モジュールを初期化する。
 * イベントリスナーを設定し、外部から渡されたコールバックとルックアップテーブルを保存する。
 * @param {function} onCardClick - 残高カードがクリックされたときに呼び出されるコールバック関数。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 */
export function init(onCardClick, luts) {
	onCardClickCallback = onCardClick;
	appLuts = luts;
	utils.dom.on(elements.grid, "click", (e) => {
		const targetCard = e.target.closest(".balance-card");
		if (targetCard) {
			onCardClickCallback(targetCard.dataset.accountId, targetCard);
		}
	});
}

/**
 * 口座残高一覧を描画する。
 * 既存のDOM要素を再利用し、値が変更された場合のみアニメーション付きで更新する。
 * @param {object} accountBalances - 口座残高オブジェクト
 * @param {boolean} isMasked - マスク表示フラグ
 */
export function render(accountBalances, isMasked) {
	const accounts = utils.sortItems(
		[...appLuts.accounts.values()].filter(
			(a) => !a.isDeleted && a.type === "asset"
		)
	);

	// 既存のカード要素をマップに退避（IDをキーにする）
	const existingCards = new Map();
	elements.grid.querySelectorAll(".balance-card").forEach((card) => {
		existingCards.set(card.dataset.accountId, card);
	});

	// ソート順に従ってDOMを再配置・更新・作成する
	accounts.forEach((account) => {
		let card = existingCards.get(account.id);
		const balance = accountBalances[account.id] || 0;
		const formattedBalance = utils.formatCurrency(balance, isMasked);
		const balanceColorClass = balance >= 0 ? "text-success" : "text-danger";

		if (card) {
			// 名前更新（変更がある場合のみ）
			const nameEl = card.querySelector("h4");
			if (nameEl.textContent !== account.name) {
				utils.dom.setText(nameEl, account.name);
			}

			// アイコン更新
			const iconEl = card.querySelector("i");
			const iconClass = `${account.icon || "fa-solid fa-wallet"} w-4 mr-2`;
			if (iconEl.className !== iconClass) {
				iconEl.className = iconClass;
			}

			// 残高更新（アニメーション適用）
			const balanceEl = card.querySelector("p");
			if (balanceEl) {
				// 色クラスの更新
				utils.dom.removeClass(balanceEl, "text-success", "text-danger");
				utils.dom.addClass(balanceEl, balanceColorClass);

				// 値が変わっていれば光らせる
				// カード背景は白なので、デフォルトの flash-update (黄色) が見やすい
				utils.updateContentWithAnimation(
					balanceEl,
					formattedBalance,
					"flash-update"
				);
			}

			// マップから削除（処理済みマーク）
			existingCards.delete(account.id);

			// DOMの並び順を強制的に同期する（appendChildは既存要素を移動させる）
			elements.grid.appendChild(card);
		} else {
			const div = document.createElement("div");
			// プレースホルダーとしてHTML文字列から要素を作成
			utils.dom.setHtml(
				div,
				`
				<div class="balance-card bg-white p-3 rounded-lg shadow-sm cursor-pointer hover-lift" data-account-id="${
					account.id
				}">
					<div class="flex items-center text-sm font-medium text-neutral-600 pointer-events-none">
						<i class="${account.icon || "fa-solid fa-wallet"} w-4 mr-2"></i>
						<h4>${account.name}</h4>
					</div>
					<p class="text-xl font-semibold text-right ${balanceColorClass} pointer-events-none">${formattedBalance}</p>
				</div>
				`
			);
			const newCard = div.firstElementChild;
			elements.grid.appendChild(newCard);
		}
	});

	// アカウント削除などで不要になったカードをDOMから削除
	existingCards.forEach((card) => card.remove());

	// チャートが表示されている場合、グリッドの最後に移動させて表示順序を維持する
	const historyContainer = utils.dom.get("balance-history-container");
	if (historyContainer) {
		elements.grid.appendChild(historyContainer);
	}
}

/**
 * クリックされた残高カードの下に残高推移チャートを表示または非表示にする。
 * 既に表示されている場合は閉じ、別のカードが開いている場合は切り替える。
 * @param {string} accountId - 対象の口座ID。
 * @param {HTMLElement} targetCard - クリックされたカードのDOM要素。
 * @param {Array<object>} periodTransactions - 表示期間内の全取引データ。
 * @param {object} currentBalances - 全口座の現在残高。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 */
export function toggleHistoryChart(
	accountId,
	targetCard,
	periodTransactions,
	currentBalances,
	isMasked
) {
	const accountName = appLuts.accounts.get(accountId)?.name || "不明な口座";

	// 既存のハイライトがあれば一旦すべて解除する
	document.querySelectorAll(".balance-card-active").forEach((card) => {
		utils.dom.removeClass(card, "balance-card-active");
	});

	const existingContainer = utils.dom.get("balance-history-container");
	if (existingContainer) {
		existingContainer.remove();
		if (historyChart) historyChart.destroy();
		// 同じカードを再度クリックしてチャートを閉じる場合は、ハイライトを付けずに終了
		if (existingContainer.dataset.parentAccount === accountName) return;
	}

	// 新しくクリックされたカードにハイライトを適用する
	utils.dom.addClass(targetCard, "balance-card-active");

	const historyData = calculateHistory(
		accountId,
		periodTransactions,
		currentBalances
	);

	let container;

	if (historyData) {
		// データがある場合：チャートコンテナを作成する
		container = document.createElement("div");
		container.id = "balance-history-container";
		container.dataset.parentAccount = accountName;
		container.dataset.parentAccountId = accountId;
		container.className =
			"col-span-2 sm:col-span-3 md:col-span-4 bg-white p-4 rounded-lg shadow-sm mt-2 h-64";
		utils.dom.setHtml(
			container,
			`<canvas id="balance-history-chart-canvas"></canvas>`
		);
	} else {
		// データがない場合：プレースホルダーコンテナを作成する
		container = document.createElement("div");
		container.id = "balance-history-container";
		container.dataset.parentAccount = accountName;
		container.dataset.parentAccountId = accountId;
		container.className =
			"col-span-2 sm:col-span-3 md:col-span-4 bg-white p-4 rounded-lg shadow-sm mt-2 h-64 flex items-center justify-center";
		utils.dom.setHtml(
			container,
			`<p class="text-neutral-600">表示できる十分な取引データがありません</p>`
		);
	}

	const parentGrid = targetCard.closest(".grid");
	parentGrid.appendChild(container);

	// チャートコンテナを作成した場合のみ、グラフを描画する
	if (historyData) {
		const ctx = document
			.getElementById("balance-history-chart-canvas")
			.getContext("2d");
		historyChart = drawHistoryChart(
			ctx,
			historyData,
			`${accountName} の残高推移`,
			isMasked
		);
	}
}

/**
 * 特定の口座について、期間内の取引履歴から日々の残高推移を計算する。
 * 現在の残高から逆算して期間開始時の残高を求め、時系列データを生成する。
 * @private
 * @param {string} accountId - 計算対象の口座ID。
 * @param {Array<object>} allPeriodTransactions - 期間内の全取引データ。
 * @param {object} currentBalances - 全口座の現在残高。
 * @returns {Array<object>|null} チャート描画用のデータ配列（{x: Date, y: number}）。データが不十分な場合はnull。
 */
function calculateHistory(accountId, allPeriodTransactions, currentBalances) {
	const relevantTxns = allPeriodTransactions
		.filter(
			(t) =>
				t.accountId === accountId ||
				t.fromAccountId === accountId ||
				t.toAccountId === accountId
		)
		.sort((a, b) => a.date.getTime() - b.date.getTime()); // 日付の昇順（古い順）でソート

	// 取引が1件以下の場合、推移を計算できないためチャートを表示しない
	if (relevantTxns.length <= 1) return null;

	const dailyBalances = {};
	let runningBalance = 0;

	// 期間開始時点の残高を、現在の残高から逆算して求める
	let startingBalance = currentBalances[accountId] || 0;
	const reversedTxns = [...relevantTxns].reverse();
	for (const t of reversedTxns) {
		if (t.type === "transfer") {
			if (t.fromAccountId === accountId) startingBalance += t.amount;
			if (t.toAccountId === accountId) startingBalance -= t.amount;
		} else if (t.accountId === accountId) {
			const sign = t.type === "income" ? -1 : 1;
			startingBalance += t.amount * sign;
		}
	}
	runningBalance = startingBalance;

	// 描画用データを作成する
	relevantTxns.forEach((t) => {
		if (t.type === "transfer") {
			if (t.fromAccountId === accountId) runningBalance -= t.amount;
			if (t.toAccountId === accountId) runningBalance += t.amount;
		} else if (t.accountId === accountId) {
			const sign = t.type === "income" ? 1 : -1;
			runningBalance += t.amount * sign;
		}
		dailyBalances[t.date.toISOString().split("T")[0]] = runningBalance;
	});

	if (relevantTxns.length === 0 && currentBalances[accountId] !== undefined) {
		dailyBalances[new Date().toISOString().split("T")[0]] =
			currentBalances[accountId];
	}

	if (Object.keys(dailyBalances).length === 0) return null;

	return Object.entries(dailyBalances)
		.map(([date, balance]) => ({ x: new Date(date), y: balance }))
		.sort((a, b) => a.x.getTime() - b.x.getTime());
}

/**
 * Chart.jsを使用して残高推移チャートを描画する。
 * 日付をX軸、残高をY軸とした階段状の折れ線グラフを表示する。
 * @private
 * @param {CanvasRenderingContext2D} ctx - 描画対象のCanvasコンテキスト。
 * @param {Array<object>} data - 描画するデータ配列。
 * @param {string} title - チャートのタイトル（ツールチップ用）。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @returns {Chart} 生成されたChartインスタンス。
 */
function drawHistoryChart(ctx, data, title, isMasked) {
	return new Chart(ctx, {
		type: "line",
		data: {
			datasets: [
				{
					label: title,
					data: data,
					borderColor: "#4F46E5",
					backgroundColor: "rgba(79, 70, 229, 0.1)",
					fill: true,
					tension: 0,
					stepped: true,
					borderWidth: 2,
					pointRadius: 0,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: (c) => `残高: ${utils.formatCurrency(c.raw.y, isMasked)}`,
					},
				},
			},
			scales: {
				x: {
					type: "time",
					time: {
						unit: "day",
						tooltipFormat: "yyyy/MM/dd",
						displayFormats: { day: "MM/dd" },
						round: "day",
					},
				},
				y: {
					ticks: {
						callback: (value) => utils.formatLargeCurrency(value, isMasked),
					},
				},
			},
		},
	});
}
