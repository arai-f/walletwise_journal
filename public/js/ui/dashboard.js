import * as utils from "../utils.js";

/**
 * ホーム画面（資産サマリー）のUI要素を保持するオブジェクト。
 * @type {object}
 */
const elements = {
	netWorth: document.getElementById("dashboard-net-worth"),
	grossAssets: document.getElementById("dashboard-gross-assets"),
	grossLiabilities: document.getElementById("dashboard-gross-liabilities"),
};

/**
 * ホーム画面の資産サマリーカードを描画する。
 * 純資産、総資産、総負債を計算して表示する。
 * @param {object} accountBalances - 全口座の現在残高を保持するオブジェクト。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @param {object} luts - 口座情報を含むルックアップテーブル。
 */
export function render(accountBalances, isMasked, luts) {
	// 純資産・総資産・総負債を計算する
	let totalAssets = 0;
	let totalLiabilities = 0;

	for (const account of luts.accounts.values()) {
		// 削除済みの口座は集計から除外する
		if (account.isDeleted) continue;

		const currentBalance = accountBalances[account.id] || 0;
		if (account.type === "asset") {
			totalAssets += currentBalance;
		} else if (account.type === "liability") {
			totalLiabilities += currentBalance;
		}
	}
	// 純資産 = 資産 + 負債 (負債はマイナス値で保持されているため)
	const netWorth = totalAssets + totalLiabilities;

	const format = (val) => utils.formatCurrency(val, isMasked);
	elements.netWorth.textContent = format(netWorth);
	elements.grossAssets.textContent = format(totalAssets);
	elements.grossLiabilities.textContent = format(totalLiabilities);
}
