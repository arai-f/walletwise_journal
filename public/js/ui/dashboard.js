import * as utils from "../utils.js";

/**
 * ホーム画面（資産サマリー）のUI要素を保持するオブジェクト。
 * @type {object}
 */
const elements = {
	totalAssets: document.getElementById("dashboard-total-assets"),
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

	// HTMLを描画する
	const format = (val) => utils.formatCurrency(val, isMasked);

	elements.totalAssets.innerHTML = `
        <div class="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-6 text-white shadow-lg">
            <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h3 class="text-indigo-100 text-sm font-medium mb-1">純資産 (資産 - 負債)</h3>
                    <p class="text-3xl md:text-4xl font-bold tracking-tight">${format(
											netWorth
										)}</p>
                </div>
                
                <div class="flex gap-6 text-sm border-t md:border-t-0 md:border-l border-indigo-400/30 pt-4 md:pt-0 md:pl-6">
                    <div>
                        <span class="block text-indigo-200 text-xs">総資産</span>
                        <span class="block font-bold text-lg">${format(
													totalAssets
												)}</span>
                    </div>
                    <div>
                        <span class="block text-indigo-200 text-xs">総負債</span>
                        <span class="block font-bold text-lg">${format(
													totalLiabilities
												)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
