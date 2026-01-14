import * as utils from '../utils.js';

/**
 * ダッシュボードの資産サマリーカードを表示するコンポーネント。
 * 純資産、総資産、総負債を表示する。
 */
export default function DashboardSummary({
    accountBalances,
    isMasked,
    luts // Lookup tables containing account info
}) {
    // Calculate Net Worth, Total Assets, Total Liabilities
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

    const netWorth = totalAssets + totalLiabilities;
    
    // Helper to format currency
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
