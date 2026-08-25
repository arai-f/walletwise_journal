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