import * as store from "../store.js";
import * as utils from "../utils.js";
import * as notification from "./notification.js";

/**
 * レポートモーダルのUI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
	modal: utils.dom.get("report-modal"),
	closeButton: utils.dom.get("close-report-modal-button"),
	yearSelect: utils.dom.get("report-year-select"),
	exportButton: utils.dom.get("export-csv-button"),
	totalIncome: utils.dom.get("report-total-income"),
	totalExpense: utils.dom.get("report-total-expense"),
	totalBalance: utils.dom.get("report-total-balance"),
	detailsBody: utils.dom.get("report-details-body"),
});

/**
 * アプリケーションのルックアップテーブル（口座、カテゴリ情報）。
 * IDから名前やアイコンなどの情報を高速に参照するために使用する。
 * @type {object}
 */
let appLuts = {};

/**
 * 現在表示している年の取引データを保持する。
 * レポートの再描画やCSVエクスポート時に、再取得を行わずにデータを利用するためにキャッシュする。
 * @type {Array<object>}
 */
let currentYearData = [];

/**
 * レポートモーダルを初期化する。
 * イベントリスナーを設定し、外部から渡されたルックアップテーブルを保存する。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 * @returns {void}
 */
export function init(luts) {
	appLuts = luts;

	const { modal, yearSelect, exportButton, closeButton } = getElements();

	utils.dom.on(modal, "click", (e) => {
		if (e.target === modal) closeModal();
	});

	utils.dom.on(yearSelect, "change", async (e) => {
		await loadYearData(parseInt(e.target.value));
	});

	utils.dom.on(exportButton, "click", handleExportCSV);
	utils.dom.on(closeButton, "click", closeModal);
}

/**
 * レポートモーダルを開き、現在の年のデータを読み込む。
 * 過去5年分の選択肢を生成し、デフォルトで現在の年のデータを表示する。
 * @async
 * @returns {Promise<void>}
 */
export async function openModal() {
	const { yearSelect, modal } = getElements();
	const currentYear = new Date().getFullYear();

	let optionsHtml = "";
	for (let i = 0; i < 5; i++) {
		const y = currentYear - i;
		optionsHtml += `<option value="${y}">${y}年</option>`;
	}
	utils.dom.setHtml(yearSelect, optionsHtml);

	utils.dom.show(modal);
	utils.toggleBodyScrollLock(true);
	await loadYearData(currentYear);
}

/**
 * レポートモーダルを閉じる。
 * モーダルを非表示にし、背景のスクロールロックを解除する。
 * @returns {void}
 */
export function closeModal() {
	const { modal } = getElements();
	utils.toggleBodyScrollLock(false);
	utils.dom.hide(modal);
}

/**
 * レポートモーダルが開いているかどうかを判定する。
 * キーボードショートカットなどの制御に使用する。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	const { modal } = getElements();
	return utils.dom.isVisible(modal);
}

/**
 * 指定された年の取引データをFirestoreから読み込み、レポートを再描画する。
 * 読み込み中はUIをロックし、ユーザーの誤操作を防ぐ。
 * @private
 * @async
 * @param {number} year - 読み込む年（西暦）。
 * @fires Firestore - store.fetchTransactionsByYear を介してデータを取得する。
 * @returns {Promise<void>}
 */
async function loadYearData(year) {
	const { yearSelect, modal } = getElements();
	// ローディング中はUI操作を無効化する
	yearSelect.disabled = true;
	modal.classList.add("cursor-wait");

	try {
		currentYearData = await store.fetchTransactionsByYear(year);
		renderReport(currentYearData);
	} catch (e) {
		console.error("[Report] データの取得に失敗しました:", e);
		notification.error("データの取得に失敗しました。");
	} finally {
		yearSelect.disabled = false;
		modal.classList.remove("cursor-wait");
		// 操作完了後、フォーカスをセレクタに戻す
		yearSelect.focus();
	}
}

/**
 * 取引データを集計し、サマリーと詳細テーブルを描画する。
 * 収入・支出ごとにカテゴリ別の合計を計算し、構成比とともに表示する。
 * @private
 * @param {Array<object>} transactions - 描画対象の取引データ。
 * @returns {void}
 */
function renderReport(transactions) {
	const { totalIncome, totalExpense, totalBalance, detailsBody } =
		getElements();
	let incomeTotal = 0;
	let expenseTotal = 0;
	const incomeMap = {}; // { catId: amount }
	const expenseMap = {}; // { catId: amount }

	transactions.forEach((t) => {
		// 残高調整用の取引は集計から除外する
		if (t.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID) return;

		if (t.type === "income") {
			incomeTotal += t.amount;
			incomeMap[t.categoryId] = (incomeMap[t.categoryId] || 0) + t.amount;
		} else if (t.type === "expense") {
			expenseTotal += t.amount;
			expenseMap[t.categoryId] = (expenseMap[t.categoryId] || 0) + t.amount;
		}
	});

	// サマリー部分を更新する
	utils.dom.setText(totalIncome, utils.formatCurrency(incomeTotal));
	utils.dom.setText(totalExpense, utils.formatCurrency(expenseTotal));
	utils.dom.setText(
		totalBalance,
		utils.formatCurrency(incomeTotal - expenseTotal)
	);

	// 詳細テーブル更新
	utils.dom.setHtml(detailsBody, "");

	// 収入または支出のセクションを描画する内部関数
	const renderSection = (map, total, title, isIncome) => {
		if (Object.keys(map).length === 0) return;

		// セクション見出し行
		const sectionHeader = document.createElement("tr");
		sectionHeader.className = "bg-neutral-50 font-bold";
		sectionHeader.innerHTML = `
            <td colspan="3" class="px-3 md:px-6 py-2 text-neutral-900 border-y border-neutral-200 text-xs md:text-sm">
				${
					isIncome
						? '<i class="fas fa-plus-circle text-success mr-2"></i>'
						: '<i class="fas fa-minus-circle text-danger mr-2"></i>'
				}
				${title}
			</td>
		`;
		detailsBody.appendChild(sectionHeader);

		const sortedCatIds = Object.keys(map).sort((a, b) => map[b] - map[a]);

		sortedCatIds.forEach((catId) => {
			const cat = appLuts.categories.get(catId);
			if (!cat) return;

			const amount = map[catId];
			const ratio = total > 0 ? ((amount / total) * 100).toFixed(1) + "%" : "-";

			const tr = document.createElement("tr");
			tr.className =
				"bg-white border-b border-neutral-200 hover:bg-primary-light transition-colors";

			tr.innerHTML = `
                <td class="px-3 md:px-6 py-3 font-medium text-neutral-800 whitespace-normal wrap-break-word text-xs md:text-sm">
                    ${cat.name}
                </td>
                <td class="px-3 md:px-6 py-3 text-right font-mono text-neutral-900 whitespace-nowrap text-xs md:text-sm">
                    ${amount.toLocaleString()}
                </td>
                <td class="px-3 md:px-6 py-3 text-right text-neutral-600 text-[10px] md:text-xs whitespace-nowrap">
                    ${ratio}
                </td>
			`;
			detailsBody.appendChild(tr);
		});
	};

	// 収入、支出の順でセクションを描画する
	renderSection(incomeMap, incomeTotal, "収入の部", true);
	renderSection(expenseMap, expenseTotal, "支出の部", false);

	if (
		Object.keys(incomeMap).length === 0 &&
		Object.keys(expenseMap).length === 0
	) {
		// データがない場合のプレースホルダー
		utils.dom.setHtml(
			detailsBody,
			`<tr><td colspan="3" class="text-center py-8 text-neutral-400">データがありません</td></tr>`
		);
	}
}

/**
 * 現在表示している年のデータをCSV形式でエクスポートする。
 * データを日付順にソートし、Excelで開ける形式（BOM付き）でダウンロードさせる。
 * @private
 * @returns {void}
 */
function handleExportCSV() {
	const { yearSelect } = getElements();
	if (!currentYearData || currentYearData.length === 0) {
		return notification.error("出力するデータがありません。");
	}

	// CSV出力前に日付の昇順（古い順）に並べ替える
	const sortedTransactions = [...currentYearData].sort((a, b) => {
		return new Date(a.date) - new Date(b.date);
	});

	let csvContent = "日付,種別,カテゴリ/口座,詳細,メモ,金額\n";

	sortedTransactions.forEach((t) => {
		const date = utils.toYYYYMMDD(t.date);
		let typeLabel = "";
		let categoryOrAccount = "";
		let amount = t.amount;

		if (t.type === "income") {
			typeLabel = "収入";
			categoryOrAccount = appLuts.categories.get(t.categoryId)?.name || "不明";
		} else if (t.type === "expense") {
			typeLabel = "支出";
			categoryOrAccount = appLuts.categories.get(t.categoryId)?.name || "不明";
			// CSV上では支出をマイナス値として表現する
			amount = -Math.abs(amount);
		} else if (t.type === "transfer") {
			typeLabel = "振替";
			const from = appLuts.accounts.get(t.fromAccountId)?.name || "不明";
			const to = appLuts.accounts.get(t.toAccountId)?.name || "不明";
			categoryOrAccount = `${from} -> ${to}`;
		}

		// CSVインジェクション対策として、文字列をダブルクォートで囲み、内部のダブルクォートをエスケープする
		const escape = (str) => `"${(str || "").replace(/"/g, '""')}"`;

		const row = [
			date,
			typeLabel,
			escape(categoryOrAccount),
			escape(t.description),
			escape(t.memo),
			amount,
		].join(",");
		csvContent += row + "\n";
	});

	// BOMを付与してExcelでの文字化けを防ぐ
	const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
	const blob = new Blob([bom, csvContent], { type: "text/csv" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = `walletwise_report_${yearSelect.value}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}
