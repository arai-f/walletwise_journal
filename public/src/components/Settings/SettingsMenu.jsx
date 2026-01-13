
export default function SettingsMenu({ onNavigate, store, getState, openGuide, openTerms }) {
  const menuItems = [
    { id: 'general', title: '一般設定', icon: 'fa-cog', desc: '表示期間、通知など' },
    { id: 'assets', title: '資産口座設定', icon: 'fa-wallet', desc: '銀行口座、財布など' },
    { id: 'liabilities', title: '負債口座設定', icon: 'fa-credit-card', desc: 'クレジットカードなど' },
    { id: 'income', title: '収入カテゴリ設定', icon: 'fa-coins', desc: '給与、賞与など' },
    { id: 'expense', title: '支出カテゴリ設定', icon: 'fa-receipt', desc: '食費、交通費など' },
    { id: 'cards', title: 'カード支払い設定', icon: 'fa-money-check', desc: '引き落とし口座、締め日設定' },
    { id: 'scan', title: 'スキャン設定', icon: 'fa-camera', desc: '除外ワード、自動分類ルール' },
  ];

  return (
    <div className="p-4 space-y-2">
      {menuItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id, item.title)}
          className="w-full text-left flex items-center p-3 rounded-lg bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50 transition active:scale-[0.99] group"
        >
          <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary mr-4 group-hover:bg-primary group-hover:text-white transition-colors">
            <i className={`fas ${item.icon}`}></i>
          </div>
          <div>
            <h3 className="font-bold text-neutral-800">{item.title}</h3>
            <p className="text-xs text-neutral-500">{item.desc}</p>
          </div>
          <i className="fas fa-chevron-right ml-auto text-neutral-400"></i>
        </button>
      ))}
    </div>
  );
}
