import { formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";

const elements = {
	modal: document.getElementById("scan-confirm-modal"),
	closeButton: document.getElementById("close-scan-confirm-button"),
	cancelButton: document.getElementById("cancel-scan-button"),
	registerButton: document.getElementById("register-scan-button"),

	// ★修正: ビューワー要素
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

// ★ビューワーの状態管理
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

export function init(handlers, luts) {
	onRegisterCallback = handlers.register;
	appLuts = luts;

	// --- ★追加: 画像のスタイルをJSで強制的に修正 (CSS競合の回避) ---
	// HTML側のクラス(object-containなど)を無効化し、手動制御用スタイルを適用
	Object.assign(elements.viewerImage.style, {
		position: "absolute",
		top: "0",
		left: "0",
		width: "auto",
		height: "auto",
		maxWidth: "none",
		maxHeight: "none",
		transformOrigin: "top left", // 左上基準でズーム/移動
		willChange: "transform",
	});
	// --- ここまで ---

	const close = () => closeModal();
	elements.closeButton.addEventListener("click", close);
	elements.cancelButton.addEventListener("click", close);
	elements.modal.addEventListener("click", (e) => {
		if (e.target === elements.modal) close();
	});

	elements.registerButton.addEventListener("click", handleRegister);
	elements.addRowButton.addEventListener("click", () => addTransactionRow());

	// ビューワー操作イベント
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

	// リスト操作
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

export function open(scanResult, imageFile) {
	if (currentFileUrl) URL.revokeObjectURL(currentFileUrl);
	currentFileUrl = URL.createObjectURL(imageFile);

	// 1. まずモーダルを表示する (これでコンテナのサイズが確定する)
	elements.modal.classList.remove("hidden");
	document.body.classList.add("modal-open");

	// 2. 画像を初期化 (透明にしておく)
	elements.viewerImage.style.opacity = "0";
	elements.viewerImage.style.transform = "translate3d(0,0,0) scale(1)";

	// 3. 画像読み込み設定
	elements.viewerImage.onload = () => {
		viewState.imgWidth = elements.viewerImage.naturalWidth;
		viewState.imgHeight = elements.viewerImage.naturalHeight;

		// コンテナサイズが正しく取得できるタイミングでフィットさせる
		requestAnimationFrame(() => {
			fitImageToContainer();
			// 計算後に表示
			elements.viewerImage.style.opacity = "1";
		});
	};

	// 4. ソースをセットして読み込み開始
	elements.viewerImage.src = currentFileUrl;

	// その他のUI初期化
	populateGlobalAccountSelect();
	elements.resultsList.innerHTML = "";
	const transactions = Array.isArray(scanResult) ? scanResult : [scanResult];
	if (transactions.length > 0) {
		transactions.forEach((txn) => addTransactionRow(txn));
	} else {
		addTransactionRow();
	}
}

export function closeModal() {
	elements.modal.classList.add("hidden");
	document.body.classList.remove("modal-open");
	if (currentFileUrl) {
		URL.revokeObjectURL(currentFileUrl);
		currentFileUrl = null;
	}
}
export const close = closeModal;
export function isOpen() {
	return !elements.modal.classList.contains("hidden");
}

// --- ビューワー制御ロジック ---

function updateTransform() {
	// transform: translate(x, y) scale(s)
	// 画質劣化を防ぐため、CSSではなくJSで transform を管理
	elements.viewerImage.style.transform = `translate3d(${viewState.x}px, ${viewState.y}px, 0) scale(${viewState.scale})`;
}

function fitImageToContainer() {
	const containerRect = elements.viewerContainer.getBoundingClientRect();

	// コンテナが表示されていない、または画像サイズが未取得の場合は処理しない
	if (containerRect.width === 0 || viewState.imgWidth === 0) return;

	const padding = 20;
	const availableWidth = containerRect.width - padding;
	const availableHeight = containerRect.height - padding;

	// 収まる倍率を計算
	const scaleW = availableWidth / viewState.imgWidth;
	const scaleH = availableHeight / viewState.imgHeight;
	const scale = Math.min(scaleW, scaleH); // 小さい方に合わせる

	viewState.scale = scale;

	// 中央に配置するための座標計算
	// (コンテナ幅 - 画像幅 * 倍率) / 2
	viewState.x = (containerRect.width - viewState.imgWidth * scale) / 2;
	viewState.y = (containerRect.height - viewState.imgHeight * scale) / 2;

	updateTransform();
}

function applyZoom(factor, centerX = null, centerY = null) {
	const oldScale = viewState.scale;
	let newScale = oldScale * factor;

	// 最小・最大ズーム制限 (0.1倍 〜 5倍)
	newScale = Math.max(0.1, Math.min(newScale, 5));

	// マウス位置を中心にズームする計算
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
		// 中心ズーム (ボタン操作時)
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

// ドラッグ処理
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
	e.preventDefault(); // テキスト選択などを防止
}

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

function endDrag() {
	if (viewState.isDragging) {
		viewState.isDragging = false;
		elements.viewerContainer.style.cursor = "grab";
	}
}

// --- 行生成・操作ロジック ---

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
                    <input type="tel" class="scan-amount-input w-full h-10 border border-gray-300 rounded-md p-1.5 text-sm font-bold text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0" value="${
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

function populateGlobalAccountSelect() {
	const accounts = [...appLuts.accounts.values()]
		.filter((a) => a.type === "asset" && !a.isDeleted)
		.sort((a, b) => (a.order || 0) - (b.order || 0));

	elements.globalAccount.innerHTML = accounts
		.map((a) => `<option value="${a.id}">${a.name}</option>`)
		.join("");
}

function getCategoriesByType(type) {
	return [...appLuts.categories.values()]
		.filter((c) => !c.isDeleted && c.type === type)
		.sort((a, b) => (a.order || 0) - (b.order || 0));
}

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
			row.classList.add("border-red-500"); // エラー強調
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
				memo: "レシートスキャン登録",
			});
		}
	});

	if (!isValid) {
		alert("日付と金額は必須です。");
		return;
	}

	try {
		// 順番に保存 (store.saveTransaction は単一処理前提のためループで呼ぶ)
		for (const txn of transactions) {
			await onRegisterCallback(txn);
		}
		closeModal();
	} catch (e) {
		console.error(e);
		alert("登録中にエラーが発生しました");
	}
}

// --- ビューワー制御 (既存のまま) ---
function openViewer(url) {
	elements.viewerImg.src = url;
	resetZoom();
	elements.viewerModal.classList.remove("hidden");
}
function closeViewer() {
	elements.viewerModal.classList.add("hidden");
	setTimeout(() => {
		elements.viewerImg.src = "";
	}, 200);
}
function resetZoom() {
	const img = elements.viewerImg;
	const container = elements.viewerContainer;
	img.className =
		"max-w-full max-h-full object-contain shadow-2xl transition-all duration-200";
	container.classList.remove("cursor-zoom-out");
	container.classList.add("cursor-zoom-in");
	container.scrollTo(0, 0);
}
function toggleZoom() {
	const img = elements.viewerImg;
	const container = elements.viewerContainer;
	const isFitted = img.classList.contains("max-w-full");
	if (isFitted) {
		img.className =
			"max-w-none max-h-none w-[150%] md:w-auto object-none shadow-2xl transition-all duration-200";
		container.classList.remove("cursor-zoom-in");
		container.classList.add("cursor-zoom-out");
	} else {
		resetZoom();
	}
}
