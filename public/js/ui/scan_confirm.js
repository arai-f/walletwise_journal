import * as utils from "../utils.js";
import * as notification from "./notification.js";

/**
 * レシートスキャン確認モーダルのUI要素をまとめたオブジェクト。
 * @type {object}
 */
const elements = {
	modal: document.getElementById("scan-confirm-modal"),
	closeButton: document.getElementById("close-scan-confirm-button"),
	cancelButton: document.getElementById("cancel-scan-button"),
	registerButton: document.getElementById("register-scan-button"),

	viewerContainer: document.getElementById("scan-viewer-container"),
	viewerImage: document.getElementById("scan-viewer-image"),
	// 自作ビューワー用のボタン参照は削除

	globalAccount: document.getElementById("scan-global-account"),
	resultsList: document.getElementById("scan-results-list"),
	addRowButton: document.getElementById("add-scan-row-button"),
};

let onRegisterCallback = null;
let appLuts = null;
let currentFileUrl = null;
let viewerInstance = null;

/**
 * レシートスキャン確認モーダルを初期化する。
 * @param {object} handlers - イベントハンドラをまとめたオブジェクト。
 * @param {function} handlers.register - 登録ボタンクリック時の処理。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 */
export function init(handlers, luts) {
	onRegisterCallback = handlers.register;
	appLuts = luts;

	const close = () => closeModal();
	elements.closeButton.addEventListener("click", close);
	elements.cancelButton.addEventListener("click", close);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) close();
	});

	elements.registerButton.addEventListener("click", () => {
		utils.withLoading(elements.registerButton, handleRegister);
	});
	elements.addRowButton.addEventListener("click", () => addTransactionRow());

	// --- 取引リスト操作イベント ---
	elements.resultsList.addEventListener("click", (e) => {
		if (e.target.closest(".delete-row-button")) {
			e.target.closest(".transaction-row").remove();
		}
		const typeBtn = e.target.closest(".scan-type-btn");
		if (typeBtn) {
			const row = typeBtn.closest(".transaction-row");
			updateRowType(row, typeBtn.dataset.type);
		}
	});
	elements.resultsList.addEventListener("input", (e) => {
		if (e.target.classList.contains("scan-amount-input")) {
			e.target.value = utils.sanitizeNumberInput(e.target.value);
		}
	});
}

/**
 * スキャン確認モーダルを開き、解析結果と画像を表示する。
 * Viewer.js を使用して画像を表示・操作可能にする。
 * @param {object|Array<object>} scanResult - Geminiから返された解析結果。
 * @param {File} imageFile - 解析対象となった画像ファイル。
 */
export function openModal(scanResult, imageFile) {
	if (currentFileUrl) URL.revokeObjectURL(currentFileUrl);
	currentFileUrl = URL.createObjectURL(imageFile);

	// 1. モーダルを表示
	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open");

	// 2. 画像ソースを設定して表示状態にする
	elements.viewerImage.src = currentFileUrl;
	elements.viewerImage.classList.remove("hidden");

	// 3. Viewer.js の初期化または更新
	if (viewerInstance) {
		viewerInstance.update(); // 画像URLが変わったため更新
	} else {
		// 初回初期化
		// @ts-ignore - ViewerはグローバルまたはCDNから読み込まれる想定
		viewerInstance = new Viewer(elements.viewerImage, {
			inline: true, // モーダル内のコンテナに埋め込む
			button: false, // 右上の閉じるボタンは非表示（モーダルの閉じるボタンを使用）
			navbar: false, // サムネイルバー非表示
			title: false, // タイトル非表示
			toolbar: {
				zoomIn: 1,
				zoomOut: 1,
				oneToOne: 1,
				reset: 1,
				rotateLeft: 1, // 回転機能（レシート向き修正用）
				rotateRight: 1,
			},
			className: "bg-neutral-900", // 背景色
		});
	}

	// フォーム部分のUIを初期化する
	populateGlobalAccountSelect();
	elements.resultsList.innerHTML = "";
	const transactions = Array.isArray(scanResult) ? scanResult : [scanResult];
	if (transactions.length > 0) {
		transactions.forEach((txn) => addTransactionRow(txn));
	} else {
		addTransactionRow();
	}
}

/**
 * スキャン確認モーダルを閉じる。
 */
export function closeModal() {
	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open");

	if (currentFileUrl) {
		URL.revokeObjectURL(currentFileUrl);
		currentFileUrl = null;
	}

	// 次回開くときのために画像をクリアしておく
	elements.viewerImage.src = "";

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
	return !elements.modal.classList.contains("hidden");
}

/**
 * 新しい取引入力行をリストに追加する。
 * @private
 * @param {object} [data={}] - 事前入力する取引データ。
 */
function addTransactionRow(data = {}) {
	const todayJST = utils.getToday();
	const type = data.type || "expense";

	const row = document.createElement("div");
	row.className =
		"transaction-row bg-neutral-50 rounded-lg p-3 border border-neutral-200 relative transition hover:border-primary";

	// カテゴリのマッチング
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
                    <label class="block text-[10px] font-bold text-neutral-500 mb-1">日付</label>
                    <input type="date" class="scan-date-input w-full h-10 border-neutral-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary" required>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-neutral-500 mb-1">金額</label>
                    <input type="tel" class="scan-amount-input w-full h-10 border border-neutral-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="0" required>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-neutral-500 mb-1">種別</label>
                    <div class="flex bg-white rounded-md border border-neutral-200 p-0.5 h-[34px]">
                        <button type="button" data-type="expense" class="scan-type-btn flex-1 py-1 text-xs font-bold rounded transition ${
													type === "expense"
														? "bg-danger-light text-danger shadow-sm"
														: "text-neutral-400 hover:bg-neutral-50"
												}">支出</button>
                        <button type="button" data-type="income" class="scan-type-btn flex-1 py-1 text-xs font-bold rounded transition ${
													type === "income"
														? "bg-success-light text-success shadow-sm"
														: "text-neutral-400 hover:bg-neutral-50"
												}">収入</button>
                    </div>
                    <input type="hidden" class="scan-type-hidden">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-neutral-500 mb-1">カテゴリ</label>
                    <select class="scan-category-select w-full border-neutral-300 rounded-md p-1.5 text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary h-[34px]">
                        ${generateCategoryOptions(type, initialCategoryId)}
                    </select>
                </div>
            </div>

            <div>
                <input type="text" class="scan-desc-input w-full border-neutral-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary" placeholder="内容・店名 (任意)">
            </div>
        </div>
    `;

	row.querySelector(".scan-date-input").value = data.date || todayJST;
	row.querySelector(".scan-amount-input").value = data.amount || "";
	row.querySelector(".scan-type-hidden").value = type;
	row.querySelector(".scan-desc-input").value = data.description || "";

	elements.resultsList.appendChild(row);
}

/**
 * 取引入力行の種別（収入/支出）を更新し、カテゴリ選択肢を再生成する。
 * @private
 * @param {HTMLElement} row - 対象の取引入力行のDOM要素。
 * @param {string} newType - 新しい取引種別 ('income' or 'expense')。
 */
function updateRowType(row, newType) {
	const hiddenInput = row.querySelector(".scan-type-hidden");
	const categorySelect = row.querySelector(".scan-category-select");
	const btns = row.querySelectorAll(".scan-type-btn");

	// 値更新
	hiddenInput.value = newType;

	// ボタンの見た目更新
	btns.forEach((btn) => {
		const isTarget = btn.dataset.type === newType;
		if (isTarget) {
			btn.className = `scan-type-btn flex-1 py-1 text-xs font-bold rounded transition ${
				newType === "expense"
					? "bg-danger-light text-danger shadow-sm"
					: "bg-success-light text-success shadow-sm"
			}`;
		} else {
			btn.className = `scan-type-btn flex-1 py-1 text-xs font-bold rounded transition text-neutral-400 hover:bg-neutral-50`;
		}
	});

	// カテゴリ選択肢の更新
	categorySelect.innerHTML = generateCategoryOptions(newType);
}

/**
 * グローバル口座選択（支払元口座）のプルダウンを生成する。
 * @private
 */
function populateGlobalAccountSelect() {
	const accounts = [...appLuts.accounts.values()].filter(
		(a) => (!a.isDeleted && a.type === "asset") || a.type === "liability"
	);

	utils.populateSelect(elements.globalAccount, accounts);
}

/**
 * 指定された種別に合致するカテゴリのリストを取得する。
 * @private
 * @param {string} type - 取引種別 ('income' or 'expense')。
 * @returns {Array<object>} カテゴリオブジェクトの配列。
 */
function getCategoriesByType(type) {
	const categories = [...appLuts.categories.values()].filter(
		(c) => !c.isDeleted && c.type === type
	);
	return utils.sortItems(categories);
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
 * 「登録」ボタンがクリックされたときの処理。入力内容を検証し、保存処理を呼び出す。
 * @private
 * @async
 */
async function handleRegister() {
	const rows = elements.resultsList.querySelectorAll(".transaction-row");
	if (rows.length === 0) {
		notification.error("登録する取引がありません。");
		return;
	}

	const accountId = elements.globalAccount.value;
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
			row.classList.add("border-danger"); // 未入力の行を赤枠で強調
			isValid = false;
		} else {
			row.classList.remove("border-danger");
			transactions.push({
				type: type,
				date: date,
				amount: Number(amountStr),
				description: desc,
				categoryId: categoryId,
				accountId: accountId, // 共通口座
				memo: "AIスキャン登録",
			});
		}
	});

	if (!isValid) {
		notification.error("日付と金額は必須です。");
		return;
	}

	try {
		// 順番に保存する (store.saveTransaction は単一取引の保存を前提としているためループで呼び出す)
		for (const txn of transactions) {
			await onRegisterCallback(txn);
		}
		closeModal();
	} catch (e) {
		console.error(e);
		notification.error("登録中にエラーが発生しました。");
	}
}
