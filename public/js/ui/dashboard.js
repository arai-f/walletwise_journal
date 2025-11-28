import * as utils from "../utils.js";

/**
 * ホーム画面（資産サマリー）のUI要素を保持するオブジェクト。
 * DOM要素への参照をキャッシュし、再検索のコストを避ける。
 * @type {object}
 */
const elements = {
	netWorth: utils.dom.get("dashboard-net-worth"),
	grossAssets: utils.dom.get("dashboard-gross-assets"),
	grossLiabilities: utils.dom.get("dashboard-gross-liabilities"),
};

/**
 * ホーム画面の資産サマリーカードを描画する。
 * 純資産、総資産、総負債を計算し、アニメーション付きで表示を更新する。
 * @param {object} accountBalances - 全口座の現在残高を保持するオブジェクト。
 * @param {boolean} isMasked - 金額をマスク表示するかどうかのフラグ。
 * @param {object} luts - 口座情報を含むルックアップテーブル。
 * @returns {void}
 */
export function render(accountBalances, isMasked, luts) {
	// 純資産・総資産・総負債を計算する
	const { totalAssets, totalLiabilities } = Array.from(
		luts.accounts.values()
	).reduce(
		(acc, account) => {
			if (account.isDeleted) return acc;

			const currentBalance = accountBalances[account.id] || 0;
			if (account.type === "asset") {
				acc.totalAssets += currentBalance;
			} else if (account.type === "liability") {
				acc.totalLiabilities += currentBalance;
			}
			return acc;
		},
		{ totalAssets: 0, totalLiabilities: 0 }
	);

	// 純資産 = 資産 + 負債 (負債はマイナス値で保持されているため)
	const netWorth = totalAssets + totalLiabilities;

	const format = (val) => utils.formatCurrency(val, isMasked);
	utils.updateContentWithAnimation(
		elements.netWorth,
		format(netWorth),
		"flash-update-white"
	);
	utils.updateContentWithAnimation(
		elements.grossAssets,
		format(totalAssets),
		"flash-update-white"
	);
	utils.updateContentWithAnimation(
		elements.grossLiabilities,
		format(totalLiabilities),
		"flash-update-white"
	);
}
