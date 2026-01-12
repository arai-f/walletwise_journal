import * as utils from "../utils.js";
import * as notification from "./notification.js";

/**
 * レシートスキャン確認モーダルのUI要素を取得するヘルパー関数。
 * 常に最新のDOM要素を取得するために使用する。
 * @returns {Object<string, HTMLElement>}
 */
const getElements = () => ({
	modal: utils.dom.get("scan-confirm-modal"),
	closeButton: utils.dom.get("close-scan-confirm-button"),
	cancelButton: utils.dom.get("cancel-scan-button"),
	registerButton: utils.dom.get("register-scan-button"),

	viewerContainer: utils.dom.get("scan-viewer-container"),
	viewerImage: utils.dom.get("scan-viewer-image"),
	// 自作ビューワー用のボタン参照は削除

	globalAccount: utils.dom.get("scan-global-account"),
	resultsList: utils.dom.get("scan-results-list"),
	addRowButton: utils.dom.get("add-scan-row-button"),
});

/**
 * ロジックハンドラを保持するオブジェクト。
 * @type {object}
 */
let logicHandlers = {};

/**
 * アプリケーションのルックアップテーブル（口座、カテゴリ情報）。
 * @type {object|null}
 */
let appLuts = null;

/**
 * 現在表示中の画像のオブジェクトURL。
 * @type {string|null}
 */
let currentFileUrl = null;

/**
 * Viewer.jsのインスタンス。
 * @type {object|null}
 */
let viewerInstance = null;

/**
 * レシートスキャン確認モーダルを初期化する。
 * イベントリスナーの設定や、外部ハンドラの登録を行う。
 * @param {object} handlers - 保存処理などを委譲するイベントハンドラオブジェクト。
 * @param {object} luts - 口座やカテゴリ情報を参照するためのルックアップテーブル。
 * @returns {void}
 */
export function init(handlers, luts) {
	logicHandlers = handlers;
	appLuts = luts;

	const {
		closeButton,
		cancelButton,
		modal,
		registerButton,
		addRowButton,
		resultsList,
	} = getElements();

	const close = () => closeModal();
	utils.dom.on(closeButton, "click", close);
	utils.dom.on(cancelButton, "click", close);
	utils.dom.on(modal, "click", (e) => {
		if (e.target === modal) close();
	});

	utils.dom.on(registerButton, "click", () => {
		utils.withLoading(registerButton, handleRegister);
	});
	utils.dom.on(addRowButton, "click", () => addTransactionRow());

	// --- 取引リスト操作イベント ---
	utils.dom.on(resultsList, "click", (e) => {
		if (e.target.closest(".delete-row-button")) {
			e.target.closest(".transaction-row").remove();
		}
		const typeBtn = e.target.closest(".scan-type-btn");
		if (typeBtn) {
			const row = typeBtn.closest(".transaction-row");
			updateRowType(row, typeBtn.dataset.type);
		}
	});
	utils.dom.on(resultsList, "input", (e) => {
		if (e.target.classList.contains("scan-amount-input")) {
			e.target.value = utils.sanitizeNumberInput(e.target.value);
		}
	});
}

/**
 * スキャン確認モーダルを開き、解析結果と画像を表示する。
 * Viewer.js を初期化し、ユーザーが画像を拡大・回転して確認できるようにする。
 * @param {object|Array<object>} scanResult - Gemini APIから返された解析結果オブジェクト（またはその配列）。
 * @param {File} imageFile - 解析対象となった画像ファイルオブジェクト。
 * @returns {void}
 */
export async function openModal(scanResult, imageFile) {
	const { modal, viewerImage, resultsList } = getElements();
	if (currentFileUrl) URL.revokeObjectURL(currentFileUrl);
	currentFileUrl = URL.createObjectURL(imageFile);

	// 1. モーダルを表示する
	utils.dom.show(modal);
	utils.toggleBodyScrollLock(true);

	// 2. 画像ソースを設定して表示状態にする
	viewerImage.src = currentFileUrl;
	utils.dom.show(viewerImage);

	// 3. Viewer.js の初期化または更新を行う
	if (viewerInstance) {
		viewerInstance.update(); // 画像URLが変わったため更新する
	} else {
		// 初回初期化を行う
		const { default: Viewer } = await import("viewerjs");
		await import("viewerjs/dist/viewer.css");

		viewerInstance = new Viewer(viewerImage, {
			inline: true, // モーダル内のコンテナに埋め込む
			button: false, // 右上の閉じるボタンは非表示にする（モーダルの閉じるボタンを使用）
			navbar: false, // サムネイルバーを非表示にする
			title: false, // タイトルを非表示にする
			toolbar: {
				zoomIn: 1,
				zoomOut: 1,
				oneToOne: 1,
				reset: 1,
				rotateLeft: 1, // 回転機能（レシート向き修正用）
				rotateRight: 1,
			},
			className: "bg-neutral-900", // 背景色を設定
		});
	}

	// フォーム部分のUIを初期化する
	populateGlobalAccountSelect();
	utils.dom.setHtml(resultsList, "");
	const transactions = Array.isArray(scanResult) ? scanResult : [scanResult];
	if (transactions.length > 0) {
		transactions.forEach((txn) => addTransactionRow(txn));
	} else {
		addTransactionRow();
	}
}

/**
 * スキャン確認モーダルを閉じる。
 * 状態をリセットし、メモリリークを防ぐためにオブジェクトURLを解放する。
 * @returns {void}
 */
export function closeModal() {
	const { modal, viewerImage } = getElements();
	utils.toggleBodyScrollLock(false);
	utils.dom.hide(modal);

	if (currentFileUrl) {
		URL.revokeObjectURL(currentFileUrl);
		currentFileUrl = null;
	}

	// 次回開くときのために画像をクリアしておく
	viewerImage.src = "";

	// Viewerインスタンスを破棄する
	if (viewerInstance) {
		viewerInstance.destroy();
		viewerInstance = null;
	}
}

/**
 * モーダルが開いているかどうかを返す。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	const { modal } = getElements();
	return utils.dom.isVisible(modal);
}

/**
 * 新しい取引入力行をリストに追加する。
 * ユーザーがスキャン結果を編集したり、手動で取引を追加したりするための行を生成する。
 * @private
 * @param {object} [data={}] - 事前入力する取引データ。スキャン結果などが渡される。
 * @returns {void}
 */
function addTransactionRow(data = {}) {
	const { resultsList } = getElements();
	const todayJST = utils.toYYYYMMDD(new Date());
	const type = data.type || "expense";

	const row = document.createElement("div");
	row.className =
		"transaction-row bg-neutral-50 rounded-lg p-3 border border-neutral-200 relative transition hover:border-primary";

	// カテゴリのマッチングを行う
	let initialCategoryId = "";
	if (data.category) {
		initialCategoryId = findBestCategoryMatch(data.category, type) || "";
	} else {
		const categories = getCategoriesByType(type);
		if (categories.length > 0) initialCategoryId = categories[0].id;
	}

	row.innerHTML = `
        <button type="button" class="delete-row-button absolute top-2 right-2 text-neutral-400 hover:text-danger p-1.5 transition">
            <i class="fas fa-times"></i>
        </button>
        
        <div class="pr-8 space-y-3">
            
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-neutral-600 mb-1">日付</label>
                    <ww-input type="date" class="scan-date-input" required></ww-input>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-neutral-600 mb-1">金額</label>
                    <ww-input type="tel" class="scan-amount-input" placeholder="0" required></ww-input>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-neutral-600 mb-1">種別</label>
                    <div class="flex bg-white rounded-lg border border-neutral-200 p-0.5 h-9">
                        <button type="button" data-type="expense" class="scan-type-btn flex-1 py-1 text-xs font-bold rounded transition ${
													type === "expense"
														? "bg-danger-light text-danger shadow-sm"
														: "text-neutral-600 hover:bg-neutral-50"
												}">支出</button>
                        <button type="button" data-type="income" class="scan-type-btn flex-1 py-1 text-xs font-bold rounded transition ${
													type === "income"
														? "bg-success-light text-success shadow-sm"
														: "text-neutral-600 hover:bg-neutral-50"
												}">収入</button>
                    </div>
                    <input type="hidden" class="scan-type-hidden">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-neutral-600 mb-1">カテゴリ</label>
                    <ww-select class="scan-category-select">
                        ${generateCategoryOptions(type, initialCategoryId)}
                    </ww-select>
                </div>
            </div>

            <div>
                <ww-input type="text" class="scan-desc-input" placeholder="内容・店名 (任意)"></ww-input>
            </div>
        </div>
    `;

	row.querySelector(".scan-date-input").value = data.date || todayJST;
	row.querySelector(".scan-amount-input").value = data.amount || "";
	row.querySelector(".scan-type-hidden").value = type;
	row.querySelector(".scan-desc-input").value = data.description || "";

	resultsList.appendChild(row);
}

/**
 * 取引入力行の種別（収入/支出）を更新し、カテゴリ選択肢を再生成する。
 * @private
 * @param {HTMLElement} row - 対象の取引入力行のDOM要素。
 * @param {string} newType - 新しい取引種別 ('income' or 'expense')。
 * @returns {void}
 */
function updateRowType(row, newType) {
	const hiddenInput = row.querySelector(".scan-type-hidden");
	const categorySelect = row.querySelector(".scan-category-select");
	const btns = row.querySelectorAll(".scan-type-btn");

	// 値を更新する
	hiddenInput.value = newType;

	// ボタンの見た目を更新する
	btns.forEach((btn) => {
		const isTarget = btn.dataset.type === newType;
		if (isTarget) {
			btn.className = `scan-type-btn flex-1 py-1 text-xs font-bold rounded transition ${
				newType === "expense"
					? "bg-danger-light text-danger shadow-sm"
					: "bg-success-light text-success shadow-sm"
			}`;
		} else {
			btn.className = `scan-type-btn flex-1 py-1 text-xs font-bold rounded transition text-neutral-600 hover:bg-neutral-50`;
		}
	});

	// カテゴリ選択肢を更新する
	utils.dom.setHtml(categorySelect, generateCategoryOptions(newType));
}

/**
 * グローバル口座選択（支払元口座）のプルダウンを生成する。
 * 資産口座と負債口座のみを選択肢として表示する。
 * @private
 * @returns {void}
 */
function populateGlobalAccountSelect() {
	const { globalAccount } = getElements();
	const accounts = [...appLuts.accounts.values()].filter(
		(a) => (!a.isDeleted && a.type === "asset") || a.type === "liability"
	);

	utils.populateSelect(globalAccount, accounts);
}

/**
 * 指定された種別に合致するカテゴリのリストを取得する。
 * 削除されたカテゴリは除外する。
 * @private
 * @param {string} type - 取引種別 ('income' or 'expense')。
 * @returns {Array<object>} カテゴリオブジェクトの配列。
 */
function getCategoriesByType(type) {
	const categories = utils.sortItems(
		[...appLuts.categories.values()].filter(
			(c) => !c.isDeleted && c.type === type
		)
	);
	return categories;
}

/**
 * 指定された種別のカテゴリ選択肢（HTMLのoptionタグ）を生成する。
 * @private
 * @param {string} type - 取引種別 ('income' or 'expense')。
 * @param {string|null} [selectedId=null] - 事前に選択状態にするカテゴリID。
 * @returns {string} 生成されたHTML文字列。
 */
function generateCategoryOptions(type, selectedId = null) {
	const categories = getCategoriesByType(type);
	return categories
		.map(
			(c) =>
				`<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${
					c.name
				}</option>`
		)
		.join("");
}

/**
 * AIが推測したカテゴリ名に最も近いカテゴリIDを見つける。
 * 完全一致、または部分一致で検索し、見つからない場合はリストの先頭を返す。
 * @private
 * @param {string} aiCategoryText - AIが推測したカテゴリ名。
 * @param {string} type - 取引種別 ('income' or 'expense')。
 * @returns {string|null} 最も一致するカテゴリID。見つからない場合はnull。
 */
function findBestCategoryMatch(aiCategoryText, type) {
	const categories = getCategoriesByType(type);
	const text = aiCategoryText.toLowerCase();
	let match = categories.find((c) => c.name === text);
	if (match) return match.id;
	match = categories.find(
		(c) => c.name.includes(text) || text.includes(c.name)
	);
	if (match) return match.id;
	return categories.length > 0 ? categories[0].id : null;
}

/**
 * 「登録」ボタンがクリックされたときの処理。
 * 入力内容を検証し、有効な取引データを保存処理に渡す。
 * @private
 * @async
 * @returns {Promise<void>}
 */
async function handleRegister() {
	const { resultsList, globalAccount } = getElements();
	const rows = resultsList.querySelectorAll(".transaction-row");
	if (rows.length === 0) {
		notification.error("登録する取引がありません。");
		return;
	}

	const accountId = globalAccount.value;
	if (!accountId) {
		notification.error("支払い口座を選択してください。");
		return;
	}

	const transactions = [];
	let isValid = true;

	rows.forEach((row) => {
		const date = row.querySelector(".scan-date-input").value;
		const amountStr = row.querySelector(".scan-amount-input").value;
		const type = row.querySelector(".scan-type-hidden").value;
		const categoryId = row.querySelector(".scan-category-select").value;
		const desc = row.querySelector(".scan-desc-input").value;

		if (!date || !amountStr) {
			utils.dom.addClass(row, "border-danger"); // 未入力の行を赤枠で強調する
			isValid = false;
		} else {
			utils.dom.removeClass(row, "border-danger");
			transactions.push({
				type: type,
				date: date,
				amount: Number(amountStr),
				description: desc,
				categoryId: categoryId,
				accountId: accountId, // 共通口座を使用する
				memo: "AIスキャン登録",
			});
		}
	});

	if (!isValid) {
		notification.error("日付と金額は必須です。");
		return;
	}

	try {
		// 1件ずつ保存する（UIリロードはしない）
		for (const txn of transactions) {
			await logicHandlers.registerItem(txn);
		}

		// モーダルを閉じてから、データリロードと通知を行う
		closeModal();
		if (logicHandlers.onComplete) {
			await logicHandlers.onComplete();
		}
	} catch (e) {
		console.error("[Scan] 登録中にエラーが発生しました:", e);
		notification.error("登録中にエラーが発生しました。");
	}
}
