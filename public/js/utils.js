import {
	formatInTimeZone,
	toDate,
	zonedTimeToUtc,
} from "https://esm.sh/date-fns-tz@2.0.1";
import {
	endOfDay,
	startOfMonth,
	subMonths,
} from "https://esm.sh/date-fns@2.30.0";

/**
 * 日本時間のタイムゾーン識別子。
 * 日付操作時に一貫して日本時間を使用するために定義する。
 * @type {string}
 */
const TIMEZONE = "Asia/Tokyo";

/**
 * 金額マスク表示用のラベル。
 * プライバシー保護モード時に、実際の金額の代わりに表示される文字列。
 * @type {string}
 */
export const MASKED_LABEL = "¥ *****";

/**
 * システムによる残高調整用カテゴリID。
 * ユーザーが手動で選択することはなく、残高調整機能によって自動生成される取引に使用される。
 * @type {string}
 */
export const SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID =
	"SYSTEM_BALANCE_ADJUSTMENT";

/**
 * アプリのテーマカラー定義。
 * Chart.jsなどのJS側で描画するUIコンポーネントの色を一元管理し、デザインの一貫性を保つ。
 * @type {object}
 */
export const THEME_COLORS = {
	primary: "#4f46e5",
	primaryLight: "#eef2ff",
	primaryRing: "rgba(79, 70, 229, 0.2)",

	success: "#16a34a",
	successLight: "#dcfce7",

	danger: "#dc2626",
	dangerLight: "#fee2e2",

	neutral: {
		text: "#374151",
		subtext: "#6b7280",
		border: "#e5e7eb",
		grid: "#e5e7eb",
		bg: "#f9fafb",
	},
};

/**
 * HTMLエスケープを行う。
 * ユーザー入力をDOMに挿入する際のXSS脆弱性を防ぐために、特殊文字を安全な形式に変換する。
 * @param {string} str - エスケープ対象の文字列。
 * @returns {string} エスケープされた安全な文字列。入力がfalsyな場合は空文字を返す。
 */
export function escapeHtml(str) {
	if (!str) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Dateオブジェクトを日本時間基準の 'yyyy-MM-dd' 形式の文字列に変換する。
 * タイムゾーンを考慮し、日付のズレを防ぐために使用する。
 * @param {Date} date - 変換するDateオブジェクト。
 * @returns {string} 'yyyy-MM-dd' 形式の文字列。
 */
export function toYYYYMMDD(date) {
	return formatInTimeZone(date, "Asia/Tokyo", "yyyy-MM-dd");
}

/**
 * Dateオブジェクトを日本時間基準の 'yyyy-MM' 形式の文字列に変換する。
 * @param {Date} date
 * @returns {string}
 */
export function toYYYYMM(date) {
	return formatInTimeZone(date, TIMEZONE, "yyyy-MM");
}

/**
 * Dateオブジェクトを 'yyyy年M月d日(曜日)' 形式の文字列に変換する。
 * @param {Date} date
 * @returns {string}
 */
export function formatDateWithWeekday(date) {
	return new Date(date).toLocaleDateString("ja-JP", {
		year: "numeric",
		month: "long",
		day: "numeric",
		weekday: "short",
	});
}

/**
 * 現在の日付を日本時間基準の 'yyyy-MM-dd' 形式の文字列で取得する。
 * 新規取引のデフォルト日付などに使用する。
 * @returns {string} 日本時間基準の今日の日付文字列。
 */
export function getToday() {
	return toYYYYMMDD(toDate(new Date(), { timeZone: TIMEZONE }));
}

/**
 * 指定された月数前の月の開始日時（日本時間）をUTCに変換して取得する。
 * Firestoreのクエリで使用する。
 * @param {number} months - 戻る月数。
 * @returns {Date} UTCのDateオブジェクト。
 */
export function getStartOfMonthAgo(months) {
	const nowInTokyo = toDate(new Date(), { timeZone: TIMEZONE });
	const startDate = startOfMonth(subMonths(nowInTokyo, months));
	return zonedTimeToUtc(startDate, TIMEZONE);
}

/**
 * 今日の終了日時（日本時間）をUTCに変換して取得する。
 * Firestoreのクエリで使用する。
 * @returns {Date} UTCのDateオブジェクト。
 */
export function getEndOfToday() {
	const nowInTokyo = toDate(new Date(), { timeZone: TIMEZONE });
	const endDate = endOfDay(nowInTokyo);
	return zonedTimeToUtc(endDate, TIMEZONE);
}

/**
 * 指定された年の開始日時（日本時間）をUTCに変換して取得する。
 * @param {number} year
 * @returns {Date}
 */
export function getStartOfYear(year) {
	const startDate = new Date(year, 0, 1);
	return zonedTimeToUtc(startDate, TIMEZONE);
}

/**
 * 指定された年の終了日時（日本時間）をUTCに変換して取得する。
 * @param {number} year
 * @returns {Date}
 */
export function getEndOfYear(year) {
	const endDate = new Date(year, 11, 31, 23, 59, 59);
	return zonedTimeToUtc(endDate, TIMEZONE);
}

/**
 * 日付オブジェクトを日本時間として解釈し、UTCのDateオブジェクト（Timestamp保存用）に変換する。
 * @param {Date} date
 * @returns {Date}
 */
export function toUtcDate(date) {
	return zonedTimeToUtc(date, TIMEZONE);
}

/**
 * 通貨フォーマッターのインスタンスをキャッシュする。
 */
const currencyFormatter = new Intl.NumberFormat("ja-JP", {
	style: "currency",
	currency: "JPY",
});

/**
 * 短縮数値フォーマッターのインスタンスをキャッシュする。
 */
const compactFormatter = new Intl.NumberFormat("ja-JP", {
	notation: "compact",
});

/**
 * 数値を日本円の通貨形式の文字列にフォーマットする。
 * Intl.NumberFormatを使用して、ロケールに基づいた正しいフォーマットを行う。
 * @param {number} amount - フォーマットする金額。
 * @param {boolean} [isMasked=false] - 金額をマスク表示するかどうか。
 * @returns {string} フォーマットされた通貨文字列、またはマスク文字列。
 */
export const formatCurrency = (amount, isMasked = false) => {
	if (isMasked) return MASKED_LABEL;
	return currencyFormatter.format(amount);
};

/**
 * グラフ軸向けに数値を短縮フォーマットする（例: 10,000 -> 1万）。
 * スペースの限られたグラフ領域で数値を表示するために、Intl.NumberFormatを使用して短縮表記を生成する。
 * @param {number} value - フォーマットする数値。
 * @param {boolean} [isMasked=false] - 数値をマスク表示するかどうか。
 * @returns {string} 短縮フォーマットされた文字列、またはマスク文字列。
 */
export const formatLargeCurrency = (value, isMasked = false) => {
	if (isMasked) return "¥***";
	if (value === 0) return "0";

	// Intl.NumberFormatを使って "1万" などの短縮表記を標準機能で行う
	return compactFormatter.format(value);
};

/**
 * 文字列からハッシュ化されたHEXカラーコードを生成する。
 * カテゴリや口座のアイコン背景色など、一貫した色を自動生成するために使用する。
 * @param {string} str - 入力文字列。
 * @returns {string} HEXカラーコード（例: "#a3f12b"）。
 */
export function stringToColor(str) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	let color = "#";
	for (let i = 0; i < 3; i++) {
		const value = (hash >> (i * 8)) & 0xff;
		color += ("00" + value.toString(16)).slice(-2);
	}
	return color;
}

/**
 * 関数の実行を遅延させ、連続した呼び出しを間引くデバウンス関数。
 * 検索ボックスの入力イベントなど、頻繁に発生するイベントの処理回数を減らすために使用する。
 * @param {Function} func - 実行する関数。
 * @param {number} wait - 遅延時間（ミリ秒）。
 * @returns {Function} デバウンスされた関数。
 */
export function debounce(func, wait) {
	let timeout;
	return function (...args) {
		const context = this;
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(context, args), wait);
	};
}

/**
 * DOM要素の取得と操作を安全に行うためのヘルパーオブジェクト。
 * 要素が存在しない場合でもエラーにならず、静かに無視するメソッドを提供する。
 */
export const dom = {
	/**
	 * IDから要素を取得する。
	 * @param {string} id - 要素のID。
	 * @returns {HTMLElement|null} 取得した要素、またはnull。
	 */
	get: (id) => document.getElementById(id),

	/**
	 * CSSセレクタに一致する最初の要素を取得する。
	 * @param {string} selector - CSSセレクタ。
	 * @returns {HTMLElement|null} 取得した要素、またはnull。
	 */
	query: (selector) => document.querySelector(selector),

	/**
	 * CSSセレクタに一致するすべての要素を取得する。
	 * @param {string} selector - CSSセレクタ。
	 * @returns {NodeList} 取得した要素のリスト。
	 */
	queryAll: (selector) => document.querySelectorAll(selector),

	/**
	 * 要素にイベントリスナーを追加する。要素が存在しない場合は何もしない。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 * @param {string} event - イベント名。
	 * @param {function} handler - イベントハンドラ。
	 */
	on: (target, event, handler) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		if (el) el.addEventListener(event, handler);
	},

	/**
	 * 要素のテキストコンテンツを設定する。要素が存在しない場合は何もしない。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 * @param {string} text - 設定するテキスト。
	 */
	setText: (target, text) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		if (el) el.textContent = text;
	},

	/**
	 * 要素のHTMLコンテンツを設定する。要素が存在しない場合は何もしない。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 * @param {string} html - 設定するHTML文字列。
	 */
	setHtml: (target, html) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		if (el) el.innerHTML = html;
	},

	/**
	 * 要素を表示する（hiddenクラスを削除）。要素が存在しない場合は何もしない。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 */
	show: (target) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		if (el) el.classList.remove("hidden");
	},

	/**
	 * 要素を非表示にする（hiddenクラスを追加）。要素が存在しない場合は何もしない。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 */
	hide: (target) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		if (el) el.classList.add("hidden");
	},

	/**
	 * 要素の表示/非表示を切り替える。要素が存在しない場合は何もしない。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 * @param {boolean} [force] - trueなら表示、falseなら非表示。省略時はトグル。
	 */
	toggle: (target, force) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		if (el) {
			if (force === undefined) {
				el.classList.toggle("hidden");
			} else {
				el.classList.toggle("hidden", !force);
			}
		}
	},

	/**
	 * 要素にクラスを追加する。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 * @param {...string} classes - 追加するクラス名。
	 */
	addClass: (target, ...classes) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		if (el) el.classList.add(...classes);
	},

	/**
	 * 要素からクラスを削除する。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 * @param {...string} classes - 削除するクラス名。
	 */
	removeClass: (target, ...classes) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		if (el) el.classList.remove(...classes);
	},

	/**
	 * 要素が表示されているか（hiddenクラスがないか）を判定する。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 * @returns {boolean} 表示されていればtrue、非表示または要素が存在しなければfalse。
	 */
	isVisible: (target) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		return el ? !el.classList.contains("hidden") : false;
	},

	/**
	 * input要素の値を取得する。要素が存在しない場合は空文字を返す。
	 * @param {HTMLElement|string} target - 対象の要素またはID。
	 * @returns {string} 値。
	 */
	value: (target) => {
		const el =
			typeof target === "string" ? document.getElementById(target) : target;
		return el ? el.value : "";
	},
};

/**
 * アイテムの配列を特定のルールでソートする。
 * 口座（資産優先）、ユーザー設定順、名前順の優先度で並べ替え、リスト表示の順序を統一する。
 * @param {Array} items - ソート対象のアイテム配列。
 * @returns {Array} ソートされた新しいアイテム配列。
 */
export function sortItems(items) {
	return [...items].sort((a, b) => {
		// 1. 種類でソート (assetが先)
		if (a.type !== b.type) {
			// assetがあれば優先、それ以外は後
			if (a.type === "asset") return -1;
			if (b.type === "asset") return 1;
		}
		// 2. ユーザー設定順 (order)
		const orderA = a.order ?? Infinity;
		const orderB = b.order ?? Infinity;
		if (orderA !== orderB) {
			return orderA - orderB;
		}
		// 3. 名前順
		return a.name.localeCompare(b.name);
	});
}

/**
 * select要素にオプションを生成して設定する。
 * ソート済みのアイテムリストからHTMLオプションタグを生成し、ドロップダウンメニューを構築する。
 * @param {HTMLSelectElement} selectEl - 対象のselect要素。
 * @param {Array} items - オプションの元となるアイテム配列。各アイテムは{id, name}を持つ。
 * @param {string|null} [defaultLabel=null] - 先頭に追加するデフォルトオプションのラベル。nullの場合は追加しない。
 */
export function populateSelect(selectEl, items, defaultLabel = null) {
	const sorted = sortItems(items);
	let html = defaultLabel ? `<option value="all">${defaultLabel}</option>` : "";
	html += sorted
		.map((item) => `<option value="${item.id}">${item.name}</option>`)
		.join("");
	selectEl.innerHTML = html;
}

/**
 * 数値入力から数値以外の文字を除去する。
 * ユーザーが誤って入力した文字を取り除き、有効な数値形式（整数または小数）のみを保持する。
 * @param {string} value - 入力された文字列。
 * @returns {string} 数値と小数点のみを含む文字列。
 */
export function sanitizeNumberInput(value) {
	let sanitized = value.replace(/[^0-9.]/g, "");
	const parts = sanitized.split(".");
	if (parts.length > 2) {
		sanitized = parts[0] + "." + parts.slice(1).join("");
	}
	return sanitized;
}

/**
 * ボタンをローディング状態にして非同期処理を実行し、連打を防止するラッパー関数。
 * 処理中はボタンを無効化し、スピナーを表示してユーザーにフィードバックを与える。
 * @param {HTMLElement} button - 対象のボタン要素。
 * @param {Function} asyncFunction - 実行する非同期関数。
 */
export async function withLoading(button, asyncFunction) {
	if (button.disabled) return; // 処理中なら何もしない

	const originalHtml = button.innerHTML;
	// ボタン幅が変わってガタつくのを防ぐため、幅を固定する
	const originalWidth = button.style.width;
	button.style.width = `${button.offsetWidth}px`;

	try {
		button.disabled = true;
		// スピナーを表示（Tailwindのクラスを利用）
		button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
		button.classList.add("opacity-50", "cursor-not-allowed");

		await asyncFunction();
	} catch (error) {
		// エラーは呼び出し元で処理させるが、ここではボタンの復帰を保証する
		throw error;
	} finally {
		button.disabled = false;
		button.innerHTML = originalHtml;
		button.style.width = originalWidth;
		button.classList.remove("opacity-50", "cursor-not-allowed");
	}
}

/**
 * 要素のテキストを更新し、値が変更されていた場合にアニメーションを実行する。
 * データの更新を視覚的に強調し、ユーザーの注意を引くために使用する。
 * @param {HTMLElement} element - 更新対象のDOM要素
 * @param {string} newText - 新しいテキスト
 * @param {string} [animationClass="flash-update"] - 適用するアニメーションクラス名
 */
export function updateContentWithAnimation(
	element,
	newText,
	animationClass = "flash-update"
) {
	if (!element) return;

	// 現在の表示内容と比較
	if (element.textContent !== newText) {
		element.textContent = newText;

		// アニメーションをリセットして再生
		element.classList.remove(animationClass);
		void element.offsetWidth; // リフロー強制
		element.classList.add(animationClass);
	}
}
