import { formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";

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
	btnZoomIn: document.getElementById("viewer-zoom-in"),
	btnZoomOut: document.getElementById("viewer-zoom-out"),
	btnReset: document.getElementById("viewer-reset"),

	globalAccount: document.getElementById("scan-global-account"),
	resultsList: document.getElementById("scan-results-list"),
	addRowButton: document.getElementById("add-scan-row-button"),
};

let onRegisterCallback = null;
let appLuts = null;
let currentFileUrl = null;

/**
 * 画像ビューワーの状態を管理するオブジェクト。
 * @type {object}
 */
let viewState = {
	scale: 1,
	x: 0,
	y: 0,
	isDragging: false,
	startX: 0,
	startY: 0,
	imgWidth: 0,
	imgHeight: 0,
};

/**
 * レシートスキャン確認モーダルを初期化する。
 * @param {object} handlers - イベントハンドラをまとめたオブジェクト。
 * @param {function} handlers.register - 登録ボタンクリック時の処理。
 * @param {object} luts - 口座やカテゴリのルックアップテーブル。
 */
export function init(handlers, luts) {
	onRegisterCallback = handlers.register;
	appLuts = luts;

	// Tailwind CSSのクラス(object-containなど)と競合しないよう、
	// 画像のスタイルをJavaScriptで直接制御する
	Object.assign(elements.viewerImage.style, {
		position: "absolute",
		top: "0",
		left: "0",
		width: "auto",
		height: "auto",
		maxWidth: "none",
		maxHeight: "none",
		transformOrigin: "top left", // ズームと移動の基点を左上に設定
		willChange: "transform",
	});

	const close = () => closeModal();
	elements.closeButton.addEventListener("click", close);
	elements.cancelButton.addEventListener("click", close);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) close();
	});

	elements.registerButton.addEventListener("click", handleRegister);
	elements.addRowButton.addEventListener("click", () => addTransactionRow());

	// --- ビューワー操作イベント ---
	elements.viewerContainer.addEventListener("wheel", (e) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		applyZoom(delta, e.clientX, e.clientY);
	});

	elements.viewerContainer.addEventListener("mousedown", startDrag);
	window.addEventListener("mousemove", moveDrag);
	window.addEventListener("mouseup", endDrag);

	elements.viewerContainer.addEventListener(
		"touchstart",
		(e) => {
			if (e.touches.length === 1) startDrag(e.touches[0]);
		},
		{ passive: false }
	);
	elements.viewerContainer.addEventListener(
		"touchmove",
		(e) => {
			if (e.touches.length === 1) moveDrag(e.touches[0], e);
		},
		{ passive: false }
	);
	elements.viewerContainer.addEventListener("touchend", endDrag);

	elements.btnZoomIn.addEventListener("click", () => applyZoom(1.2));
	elements.btnZoomOut.addEventListener("click", () => applyZoom(0.8));
	elements.btnReset.addEventListener("click", fitImageToContainer);

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
			e.target.value = e.target.value.replace(/[^0-9]/g, "");
		}
	});
}

/**
 * スキャン確認モーダルを開き、解析結果と画像を表示する。
 * @param {object|Array<object>} scanResult - Geminiから返された解析結果。
 * @param {File} imageFile - 解析対象となった画像ファイル。
 */
export function open(scanResult, imageFile) {
	if (currentFileUrl) URL.revokeObjectURL(currentFileUrl);
	currentFileUrl = URL.createObjectURL(imageFile);

	// 1. モーダルを表示してコンテナのサイズを確定させる
	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open");

	// 2. 画像を初期化（読み込み完了まで非表示）
	elements.viewerImage.style.opacity = "0";
	elements.viewerImage.style.transform = "translate3d(0,0,0) scale(1)";

	// 3. 画像の読み込みが完了したときの処理
	elements.viewerImage.onload = () => {
		viewState.imgWidth = elements.viewerImage.naturalWidth;
		viewState.imgHeight = elements.viewerImage.naturalHeight;

		// コンテナサイズが確定した次のフレームでフィット処理を実行する
		requestAnimationFrame(() => {
			fitImageToContainer();
			// フィット計算後に画像を表示する
			elements.viewerImage.style.opacity = "1";
		});
	};

	// 4. ソースをセットして読み込み開始
	elements.viewerImage.src = currentFileUrl;

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
}
/** @alias closeModal */
export const close = closeModal;

/**
 * モーダルが開いているかどうかを返す。
 * @returns {boolean} モーダルが開いていればtrue。
 */
export function isOpen() {
	return !elements.modal.classList.contains("hidden");
}

/**
 * 画像ビューワーのtransformスタイルを更新する。
 * @private
 */
function updateTransform() {
	// ハードウェアアクセラレーションを効かせるため translate3d を使用する
	elements.viewerImage.style.transform = `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`;
}

/**
 * 画像をビューワーコンテナにフィットさせて表示する。
 * @private
 */
function fitImageToContainer() {
	const containerRect = elements.viewerContainer.getBoundingClientRect();

	// コンテナが表示されていない、または画像サイズが未取得の場合は処理しない
	if (containerRect.width === 0 || viewState.imgWidth === 0) return;

	const padding = 20;
	const availableWidth = containerRect.width - padding;
	const availableHeight = containerRect.height - padding;

	// コンテナに収まる最大の倍率を計算する
	const scaleW = availableWidth / viewState.imgWidth;
	const scaleH = availableHeight / viewState.imgHeight;
	const scale = Math.min(scaleW, scaleH);

	viewState.scale = scale;

	// 中央に配置するための座標計算
	// (コンテナ幅 - 画像幅 * 倍率) / 2
	viewState.x = (containerRect.width - viewState.imgWidth * scale) / 2;
	viewState.y = (containerRect.height - viewState.imgHeight * scale) / 2;

	updateTransform();
}

/**
 * 画像をズームする。
 * @private
 * @param {number} factor - ズーム倍率（1.2で拡大, 0.8で縮小など）。
 * @param {number|null} [centerX=null] - ズームの中心となるX座標（マウス位置など）。
 * @param {number|null} [centerY=null] - ズームの中心となるY座標。
 */
function applyZoom(factor, centerX = null, centerY = null) {
	const oldScale = viewState.scale;
	let newScale = oldScale * factor;

	// 最小・最大ズーム制限 (0.1倍 〜 5倍)
	newScale = Math.max(0.1, Math.min(newScale, 5));

	// マウスカーソル位置を中心にズームする計算
	if (centerX !== null && centerY !== null) {
		const containerRect = elements.viewerContainer.getBoundingClientRect();
		// コンテナ内の相対座標
		const mouseX = centerX - containerRect.left;
		const mouseY = centerY - containerRect.top;

		// 現在の画像上のポイント = (マウス位置 - 画像の左上) / 倍率
		const imgX = (mouseX - viewState.x) / oldScale;
		const imgY = (mouseY - viewState.y) / oldScale;

		// 新しい左上 = マウス位置 - (画像上のポイント * 新倍率)
		viewState.x = mouseX - imgX * newScale;
		viewState.y = mouseY - imgY * newScale;
	} else {
		// ズームボタン操作時はコンテナの中心を基準にズームする
		const containerRect = elements.viewerContainer.getBoundingClientRect();
		const centerX = containerRect.width / 2;
		const centerY = containerRect.height / 2;
		const imgX = (centerX - viewState.x) / oldScale;
		const imgY = (centerY - viewState.y) / oldScale;
		viewState.x = centerX - imgX * newScale;
		viewState.y = centerY - imgY * newScale;
	}

	viewState.scale = newScale;
	updateTransform();
}

/**
 * 画像のドラッグ移動を開始する。
 * @private
 * @param {MouseEvent|TouchEvent} e - イベントオブジェクト。
 */
function startDrag(e) {
	// ビューワー内でのクリックのみ反応
	if (
		e.target !== elements.viewerContainer &&
		e.target !== elements.viewerImage
	)
		return;

	const clientX = e.clientX || e.touches[0].clientX;
	const clientY = e.clientY || e.touches[0].clientY;

	viewState.isDragging = true;
	viewState.startX = clientX - viewState.x;
	viewState.startY = clientY - viewState.y;
	elements.viewerContainer.style.cursor = "grabbing";
	e.preventDefault(); // テキスト選択や意図しないスクロールを防止
}

/**
 * ドラッグ中に画像を移動させる。
 * @private
 * @param {MouseEvent|TouchEvent} e - イベントオブジェクト。
 */
function moveDrag(e) {
	if (!viewState.isDragging) return;

	const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
	const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);

	// タッチイベントの場合はスクロール防止
	if (e.type === "touchmove") e.preventDefault();

	viewState.x = clientX - viewState.startX;
	viewState.y = clientY - viewState.startY;
	updateTransform();
}

/**
 * ドラッグ移動を終了する。
 * @private
 */
function endDrag() {
	if (viewState.isDragging) {
		viewState.isDragging = false;
		elements.viewerContainer.style.cursor = "grab";
	}
}

/**
 * 新しい取引入力行をリストに追加する。
 * @private
 * @param {object} [data={}] - 事前入力する取引データ。
 */
function addTransactionRow(data = {}) {
	const todayJST = formatInTimeZone(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
	const type = data.type || "expense";

	const row = document.createElement("div");
	row.className =
		"transaction-row bg-gray-50 rounded-lg p-3 border border-gray-200 relative transition hover:border-blue-300";

	// カテゴリのマッチング
	let initialCategoryId = "";
	if (data.category) {
		initialCategoryId = findBestCategoryMatch(data.category, type) || "";
	} else {
		const categories = getCategoriesByType(type);
		if (categories.length > 0) initialCategoryId = categories[0].id;
	}

	row.innerHTML = `
        <button type="button" class="delete-row-button absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1.5 transition">
            <i class="fas fa-times"></i>
        </button>
        
        <div class="pr-8 space-y-3">
            
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">日付</label>
                    <input type="date" class="scan-date-input w-full h-10 border-gray-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value="${
											data.date || todayJST
										}" required>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">金額</label>
                    <input type="tel" class="scan-amount-input w-full h-10 border border-gray-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0" value="${
											data.amount || ""
										}" required>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">種別</label>
                    <div class="flex bg-white rounded-md border border-gray-200 p-0.5 h-[34px]"> <button type="button" data-type="expense" class="scan-type-btn flex-1 py-1 text-xs font-bold rounded transition ${
											type === "expense"
												? "bg-red-100 text-red-600 shadow-sm"
												: "text-gray-400 hover:bg-gray-50"
										}">支出</button>
                        <button type="button" data-type="income" class="scan-type-btn flex-1 py-1 text-xs font-bold rounded transition ${
													type === "income"
														? "bg-green-100 text-green-600 shadow-sm"
														: "text-gray-400 hover:bg-gray-50"
												}">収入</button>
                    </div>
                    <input type="hidden" class="scan-type-hidden" value="${type}">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 mb-1">カテゴリ</label>
                    <select class="scan-category-select w-full border-gray-300 rounded-md p-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[34px]">
                        ${generateCategoryOptions(type, initialCategoryId)}
                    </select>
                </div>
            </div>

            <div>
                <input type="text" class="scan-desc-input w-full border-gray-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="内容・店名 (任意)" value="${
									data.description || ""
								}">
            </div>
        </div>
    `;

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
					? "bg-red-100 text-red-600 shadow-sm"
					: "bg-green-100 text-green-600 shadow-sm"
			}`;
		} else {
			btn.className = `scan-type-btn flex-1 py-1 text-xs font-bold rounded transition text-gray-400 hover:bg-gray-50`;
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
	const accounts = [...appLuts.accounts.values()]
		.filter((a) => a.type === "asset" && !a.isDeleted)
		.sort((a, b) => (a.order || 0) - (b.order || 0));

	elements.globalAccount.innerHTML = accounts
		.map((a) => `<option value="${a.id}">${a.name}</option>`)
		.join("");
}

/**
 * 指定された種別に合致するカテゴリのリストを取得する。
 * @private
 * @param {string} type - 取引種別 ('income' or 'expense')。
 * @returns {Array<object>} カテゴリオブジェクトの配列。
 */
function getCategoriesByType(type) {
	return [...appLuts.categories.values()]
		.filter((c) => !c.isDeleted && c.type === type)
		.sort((a, b) => (a.order || 0) - (b.order || 0));
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
		alert("登録する取引がありません。");
		return;
	}

	const accountId = elements.globalAccount.value;
	if (!accountId) {
		alert("支払い口座を選択してください。");
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
			row.classList.add("border-red-500"); // 未入力の行を赤枠で強調
			isValid = false;
		} else {
			row.classList.remove("border-red-500");
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
		alert("日付と金額は必須です。");
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
		alert("登録中にエラーが発生しました");
	}
}
