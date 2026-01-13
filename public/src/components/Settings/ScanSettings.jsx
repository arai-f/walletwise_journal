import { useEffect, useState } from 'react';

export default function ScanSettings({ store, getState, refreshApp }) {
    const [scanSettings, setScanSettings] = useState({ excludeKeywords: [], categoryRules: [] });
    const [categories, setCategories] = useState([]);
    
    // Add Forms state
    const [showAddKeyword, setShowAddKeyword] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    
    const [showAddRule, setShowAddRule] = useState(false);
    const [newRuleKeyword, setNewRuleKeyword] = useState('');
    const [newRuleCategory, setNewRuleCategory] = useState('');
    const [editingRuleKeyword, setEditingRuleKeyword] = useState(null); // original keyword if editing

    useEffect(() => {
        loadData();
    }, [getState]);

    const loadData = () => {
        const state = getState();
        const config = state.config || {};
        setScanSettings(config.scanSettings || { excludeKeywords: [], categoryRules: [] });
        setCategories([...state.luts.categories.values()].filter(c => !c.isDeleted));
    };

    const saveSettings = async (newSettings) => {
        try {
            await store.updateConfig({ scanSettings: newSettings });
            await refreshApp();
            setScanSettings(newSettings); 
        } catch(e) {
            console.error(e);
            alert("保存に失敗しました");
        }
    };
    
    // -- Exclude Keywords Logic --
    const handleAddKeyword = async () => {
        const word = newKeyword.trim();
        if(!word) return alert("キーワードを入力してください");
        if((scanSettings.excludeKeywords || []).includes(word)) return alert("既に登録されています");
        
        const newKeywords = [...(scanSettings.excludeKeywords || []), word];
        await saveSettings({ ...scanSettings, excludeKeywords: newKeywords });
        setNewKeyword('');
        setShowAddKeyword(false);
    };
    
    const handleDeleteKeyword = async (word) => {
        if(!confirm(`「${word}」を削除しますか？`)) return;
        const newKeywords = (scanSettings.excludeKeywords || []).filter(w => w !== word);
        await saveSettings({ ...scanSettings, excludeKeywords: newKeywords });
    };

    // -- Category Rules Logic --
    const handleEditRule = (rule) => {
        setNewRuleKeyword(rule.keyword);
        setNewRuleCategory(rule.categoryId);
        setEditingRuleKeyword(rule.keyword);
        setShowAddRule(true);
    };

    const handleAddRuleStart = () => {
        setNewRuleKeyword('');
        setNewRuleCategory('');
        setEditingRuleKeyword(null);
        setShowAddRule(true);
    };

    const handleSaveRule = async () => {
        const word = newRuleKeyword.trim();
        if(!word) return alert("キーワードを入力してください");
        if(!newRuleCategory) return alert("カテゴリを選択してください");

        const rules = scanSettings.categoryRules || [];
        // Check duplicate
        const existing = rules.find(r => r.keyword === word);
        if(existing && (!editingRuleKeyword || editingRuleKeyword !== word)) {
             return alert("このキーワードのルールは既に存在します");
        }

        let newRules;
        if (editingRuleKeyword) {
            newRules = rules.map(r => r.keyword === editingRuleKeyword ? { keyword: word, categoryId: newRuleCategory } : r);
        } else {
            newRules = [...rules, { keyword: word, categoryId: newRuleCategory }];
        }
        
        await saveSettings({ ...scanSettings, categoryRules: newRules });
        setShowAddRule(false);
    };

    const handleDeleteRule = async (word) => {
         if(!confirm(`キーワード「${word}」のルールを削除しますか？`)) return;
         const newRules = (scanSettings.categoryRules || []).filter(r => r.keyword !== word);
         await saveSettings({ ...scanSettings, categoryRules: newRules });
    };

    const incomeCategories = categories.filter(c => c.type === 'income');
    const expenseCategories = categories.filter(c => c.type === 'expense');

    return (
        <div className="p-4 space-y-8">
            
            {/* Exclude Keywords */}
            <section>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-neutral-800 border-l-4 border-primary pl-3">スキャン除外キーワード</h3>
                     <button 
                        onClick={() => setShowAddKeyword(true)}
                        className="text-primary hover:text-primary-dark font-medium text-sm flex items-center gap-1"
                     >
                         <i className="fas fa-plus"></i> 追加
                     </button>
                 </div>
                 
                 {showAddKeyword && (
                     <div className="flex items-center gap-2 p-2 rounded-md bg-neutral-100 mb-4 animate-fade-in">
                         <input 
                            type="text" 
                            className="grow border-neutral-300 rounded px-2 h-9 text-sm" 
                            placeholder="除外するキーワード" 
                            value={newKeyword}
                            onChange={e => setNewKeyword(e.target.value)}
                         />
                         <button onClick={handleAddKeyword} className="text-success p-1"><i className="fas fa-check"></i></button>
                         <button onClick={() => setShowAddKeyword(false)} className="text-danger p-1"><i className="fas fa-times"></i></button>
                     </div>
                 )}
                 
                 <div className="space-y-2">
                     {(scanSettings.excludeKeywords || []).map(word => (
                         <div key={word} className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-200">
                             <span className="font-medium text-neutral-900">{word}</span>
                             <button onClick={() => handleDeleteKeyword(word)} className="text-danger hover:bg-white p-2 rounded"><i className="fas fa-trash-alt"></i></button>
                         </div>
                     ))}
                     {(scanSettings.excludeKeywords || []).length === 0 && !showAddKeyword && (
                        <p className="text-sm text-neutral-400 text-center py-2">設定なし</p>
                     )}
                 </div>
            </section>

            {/* Category Rules */}
            <section>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-neutral-800 border-l-4 border-primary pl-3">自動分類ルール</h3>
                     <button 
                        onClick={handleAddRuleStart}
                        className="text-primary hover:text-primary-dark font-medium text-sm flex items-center gap-1"
                     >
                         <i className="fas fa-plus"></i> 追加
                     </button>
                 </div>
                 
                 {showAddRule && (
                     <div className="bg-primary-light p-4 rounded-md border border-primary-ring mb-4 text-sm animate-fade-in space-y-3">
                         <h4 className="font-bold text-neutral-900 mb-1">{editingRuleKeyword ? 'ルールを編集' : '新しいルールを追加'}</h4>
                         <div className="grid grid-cols-12 items-center gap-2">
                             <label className="col-span-4 font-semibold text-neutral-800">キーワード</label>
                             <div className="col-span-8">
                                 <input 
                                    type="text" 
                                    className="w-full border-neutral-300 rounded px-2 h-9"
                                    placeholder="例: スーパー, コンビニ"
                                    value={newRuleKeyword}
                                    onChange={e => setNewRuleKeyword(e.target.value)}
                                 />
                             </div>
                         </div>
                         <div className="grid grid-cols-12 items-center gap-2">
                             <label className="col-span-4 font-semibold text-neutral-800">分類先</label>
                             <div className="col-span-8">
                                 <select 
                                    className="w-full border-neutral-300 rounded px-2 h-9 bg-white"
                                    value={newRuleCategory}
                                    onChange={e => setNewRuleCategory(e.target.value)}
                                 >
                                     <option value="">カテゴリを選択</option>
                                     <optgroup label="支出">
                                         {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                     </optgroup>
                                     <optgroup label="収入">
                                         {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                     </optgroup>
                                 </select>
                             </div>
                         </div>
                         <div className="flex justify-end gap-2 pt-2">
                              <button onClick={() => setShowAddRule(false)} className="bg-white border text-neutral-700 px-3 py-1.5 rounded text-xs hover:bg-neutral-50">キャンセル</button>
                              <button onClick={handleSaveRule} className="bg-primary text-white px-3 py-1.5 rounded text-xs hover:bg-primary-dark">保存</button>
                         </div>
                     </div>
                 )}
                 
                 <div className="space-y-2">
                     {(scanSettings.categoryRules || []).map(rule => {
                         const cat = categories.find(c => c.id === rule.categoryId);
                         return (
                             <div key={rule.keyword} className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-200">
                                 <div className="flex items-center gap-3 overflow-hidden">
                                     <span className="font-medium text-neutral-900">"{rule.keyword}"</span>
                                     <i className="fas fa-arrow-right text-neutral-400 text-xs"></i>
                                     <span className="text-sm text-neutral-600 truncate">{cat ? cat.name : "不明なカテゴリ"}</span>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0">
                                     <button onClick={() => handleEditRule(rule)} className="text-primary hover:bg-white p-2 rounded"><i className="fas fa-pen"></i></button>
                                     <button onClick={() => handleDeleteRule(rule.keyword)} className="text-danger hover:bg-white p-2 rounded"><i className="fas fa-trash-alt"></i></button>
                                 </div>
                             </div>
                         )
                     })}
                     {(scanSettings.categoryRules || []).length === 0 && !showAddRule && (
                        <p className="text-sm text-neutral-400 text-center py-2">設定なし</p>
                     )}
                 </div>
            </section>
        </div>
    );
}
