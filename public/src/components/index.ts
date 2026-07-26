import type { IconProp } from "@fortawesome/fontawesome-svg-core";

/**
 * 取引データの型定義。
 */
export interface Transaction {
	id: string;
	date: string;
	amount: number;
	description: string;
	categoryId: string;
	fromAccountId: string;
	toAccountId?: string;
	type: "income" | "expense" | "transfer";
	memo?: string;
}

/**
 * 資産（口座）データの型定義。
 */
export interface Asset {
	id: string;
	name: string;
	balance: number;
	type: "cash" | "bank" | "credit_card" | "investment" | "other";
	memo?: string;
}

/**
 * カテゴリデータの型定義。
 */
export interface Category {
	id: string;
	name: string;
	icon: IconProp;
	type: "income" | "expense";
}

/**
 * アプリケーション設定の型定義。
 */
export interface Settings {
	displayPeriod: "month" | "year" | "all";
	aiAdvisorEnabled: boolean;
}

/**
 * 口座情報の型定義。
 */
export interface Account {
	id: string;
	name: string;
	type: "asset" | "liability";
	isDeleted?: boolean;
	icon?: string;
	order?: number;
}

/**
 * カテゴリ情報の型定義。
 */
export interface CategoryInfo {
	id: string;
	name: string;
	type: "income" | "expense";
	isDeleted?: boolean;
	order?: number;
}

/**
 * ルックアップテーブル（ルックアップデータ）の型定義。
 * コンポーネント間で共有されるカテゴリや口座のマッピングを提供する。
 */
export interface Luts {
	categories: Map<string, CategoryInfo>;
	accounts: Map<string, Account>;
}