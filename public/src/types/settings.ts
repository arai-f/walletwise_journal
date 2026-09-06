/**
 * 設定関連コンポーネントで共有する型定義。
 * 元データ (`store.js` 等) はJavaScript実装のため、ここではTypeScriptで扱いやすい
 * インターフェースを定義する。
 */

/**
 * 設定画面の種類を表す識別子。
 */
export type SettingsViewId =
	| "general"
	| "accounts"
	| "categories"
	| "cards"
	| "scan";

/**
 * 口座・カテゴリ・取引などで共通して使われるアイテム種別。
 * 'asset' / 'liability' は口座、'income' / 'expense' はカテゴリを示す。
 */
export type ItemType = "asset" | "liability" | "income" | "expense";

/**
 * `ListSettings` 等で利用される項目の最小単位。
 * `id` を含む点に注意（ストアで `Map` 化される際に注入される）。
 */
export interface BaseItem {
	/** 項目のID。 */
	id: string;
	/** 項目の表示名。 */
	name: string;
	/** 項目の種類。 */
	type: ItemType;
	/** 並び順。小さいほど上に表示される。 */
	order?: number;
	/** 論理削除フラグ。trueなら一覧から非表示。 */
	isDeleted?: boolean;
}

/**
 * 口座情報を表すインターフェース。
 */
export interface Account extends BaseItem {
	/** 表示用アイコンのクラス名。 */
	icon?: string;
}

/**
 * カテゴリ情報を表すインターフェース。
 */
export interface Category extends BaseItem {
	// 現状 `BaseItem` と同じ構造。将来の拡張に備え 별型として定義。
	type: "income" | "expense";
}

/**
 * `getState` の戻り値のうち、本コンポーネント群が利用する部分。
 */
export interface AppState {
	/** 口座IDをキー、口座情報を値とするマップ。 */
	luts: {
		accounts: Map<string, Account>;
		categories: Map<string, Category>;
	};
	/** アカウントIDをキー、現在の残高を値とするオブジェクト。 */
	accountBalances?: Record<string, number>;
	/** ユーザー設定。 */
	config?: AppConfig;
	/** アプリバージョン。 */
	appVersion?: string;
}

/**
 * `config` ドキュメントのルートに格納される設定オブジェクト。
 * `Record<string, unknown>` 互換のため、インデックスシグネチャを含む。
 */
export interface AppConfig {
	/** クレジットカードの支払いルール。 */
	creditCardRules?: CreditCardRulesMap;
	/** 後方互換のために残されているルートレベルの表示期間（月数）。 */
	displayPeriod?: number;
	/** 新形式の表示期間・AI設定などをまとめたオブジェクト。 */
	general?: GeneralConfig;
	/** OCRスキャン時の除外キーワードと自動分類ルール。 */
	scanSettings?: ScanSettingsConfig;
	/** 利用規約の同意情報。 */
	terms?: TermsConfig;
	/** ガイドの閲覧状態情報。 */
	guide?: GuideConfig;
	/** Firestore に保存されている未知のフィールドを許容する。 */
	[key: string]: unknown;
}

/**
 * 一般設定（中カテゴリ）。表示期間、AIアドバイザー設定を含む。
 */
export interface GeneralConfig {
	/** 表示期間（月数）。 */
	displayPeriod?: number;
	/** AIアドバイザー（月次分析）を有効化するかどうか。 */
	enableAiAdvisor?: boolean;
}

/**
 * 利用規約の同意情報。
 */
export interface TermsConfig {
	/** 同意済み利用規約バージョン。 */
	agreedVersion?: string;
}

/**
 * ガイドの閲覧状態情報。
 */
export interface GuideConfig {
	/** 最後に閲覧したガイドのバージョン。 */
	lastSeenVersion?: string;
}

/**
 * クレジットカードルールをカードIDで引けるマップ。
 */
export type CreditCardRulesMap = Record<string, CreditCardRule>;

/**
 * クレジットカード1枚分の支払いルール。
 */
export interface CreditCardRule {
	/** 締め日（1〜31）。 */
	closingDay: number;
	/** 支払日（1〜31）。 */
	paymentDay: number;
	/** 支払月のオフセット（1=翌月, 2=翌々月, 3=3ヶ月後）。 */
	paymentMonthOffset: number;
	/** 引き落としに利用する資産口座のID。 */
	defaultPaymentAccountId: string;
}

/**
 * スキャン設定本体。
 */
export interface ScanSettingsConfig {
	/** APIキー。 */
	apiKey?: string;
	/** OCR結果から除外するキーワードの配列。 */
	excludeKeywords?: string[];
	/** キーワードから自動分類するルールの配列。 */
	categoryRules?: ScanCategoryRule[];
	[key: string]: unknown;
}

/**
 * OCR結果の自動分類ルール。
 */
export interface ScanCategoryRule {
	/** 反応するキーワード。 */
	keyword: string;
	/** 紐付けるカテゴリID。 */
	categoryId: string;
}

/**
 * `activeForm` の取り得る値。
 * - `null` = 何も開いていない
 * - `'addKeyword'` / `'addRule'` = 新規追加フォーム表示中
 * - `'editRule:<keyword>'` = 既存ルール編集中
 */
export type ActiveForm = null | "addKeyword" | "addRule" | `editRule:${string}`;

/**
 * アプリケーション全体の再描画関数。
 * @param force - 強制リロードを行うかどうか。
 * @returns 通常はPromise<void>。
 */
export type RefreshApp = (force?: boolean) => Promise<void> | void;

/**
 * 現在のアプリケーション状態を取得する関数。
 */
export type GetState = () => AppState;

/**
 * `IconPicker` のアイコン選択時に呼ばれるコールバック。
 */
export type IconSelectHandler = (iconClassName: string) => void;
