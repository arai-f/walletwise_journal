import * as utils from "../utils.js";

/**
 * ダッシュボードの資産サマリーカードを表示するコンポーネント。
 * 純資産（資産 - 負債）、総資産、総負債の3つの指標を表示する。
 * 背景にはグラデーションスタイルを適用し、メインの指標として機能する。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.accountBalances - 口座ごとの現在残高マップ。
 * @param {boolean} props.isMasked - 金額マスクフラグ。
 * @param {object} props.luts - 口座情報などを含むルックアップテーブル。
 * @return {JSX.Element} ダッシュボード資産サマリーコンポーネント。
 */
export default function DashboardSummary({ accountBalances, isMasked, luts }) {
	const safeAccounts = luts?.accounts ? luts.accounts : new Map();
	// 資産と負債の合計を計算
	const { totalAssets, totalLiabilities } = Array.from(
		safeAccounts.values()
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

	const netWorth = totalAssets + totalLiabilities;
	const format = (val) => utils.formatCurrency(val, isMasked);

	return (
		<div className="bg-linear-to-r from-primary to-violet-600 rounded-xl p-6 text-white shadow-lg fade-in">
			<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
				<div>
					<h3 className="text-white/80 text-sm font-medium mb-1">
						純資産 (資産 - 負債)
					</h3>
					<p className="text-3xl md:text-4xl font-bold tracking-tight flash-update-white">
						{format(netWorth)}
					</p>
				</div>

				<div className="flex gap-6 text-sm border-t md:border-t-0 md:border-l border-white/30 pt-4 md:pt-0 md:pl-6">
					<div>
						<span className="block text-white/60 text-xs">総資産</span>
						<span className="block font-bold text-lg flash-update-white">
							{format(totalAssets)}
						</span>
					</div>
					<div>
						<span className="block text-white/60 text-xs">総負債</span>
						<span className="block font-bold text-lg flash-update-white">
							{format(totalLiabilities)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
