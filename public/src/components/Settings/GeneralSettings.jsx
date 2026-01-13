import { deleteField } from "firebase/firestore";
import { useEffect, useState } from 'react';

export default function GeneralSettings({ store, getState, reloadApp, requestNotification, disableNotification }) {
    const [displayPeriod, setDisplayPeriod] = useState(3);
    const [enableAi, setEnableAi] = useState(false);
    const [enableNotification, setEnableNotification] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const state = getState();
        const config = state.config || {};
        setDisplayPeriod(config.general?.displayPeriod || config.displayPeriod || 3);
        setEnableAi(config.general?.enableAiAdvisor || false);
        
        async function checkNotification() {
           const isRegistered = await store.isDeviceRegisteredForNotifications();
           setEnableNotification(isRegistered);
        }
        checkNotification();
    }, [getState, store]);

    const handleSaveDisplayPeriod = async () => {
        setLoading(true);
        try {
            const newPeriod = Number(displayPeriod);
            await store.updateConfig({
                displayPeriod: deleteField(), 
                "general.displayPeriod": newPeriod,
            });
            reloadApp();
        } catch(e) {
            console.error(e);
            alert("保存に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleAiToggle = async (e) => {
        const isEnabled = e.target.checked;
        try {
            await store.updateConfig({
                "general.enableAiAdvisor": isEnabled,
            });
             const state = getState();
             if (!state.config.general) state.config.general = {};
             state.config.general.enableAiAdvisor = isEnabled;
             
             setEnableAi(isEnabled);
             reloadApp();
        } catch (error) {
            console.error(error);
            alert("設定の更新に失敗しました。");
             setEnableAi(!isEnabled);
        }
    };

    const handleNotificationToggle = async (e) => {
        const isChecked = e.target.checked;
        let result = false;
        try {
             if (isChecked) {
                result = await requestNotification();
            } else {
                const disabled = await disableNotification();
                result = !disabled;
            }
            setEnableNotification(result);
        } catch(e) {
            console.error(e);
        }
    }

    return (
        <div className="p-4 space-y-6">
            <section className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                <h3 className="font-bold text-neutral-800 mb-4 border-l-4 border-primary pl-3">表示設定</h3>
                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-neutral-700">デフォルトの表示月数</label>
                     <div className="flex gap-2">
                        <select 
                            value={displayPeriod} 
                            onChange={(e) => setDisplayPeriod(e.target.value)}
                            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-neutral-700 focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                            <option value="1">1ヶ月</option>
                            <option value="3">3ヶ月</option>
                            <option value="6">6ヶ月</option>
                            <option value="12">12ヶ月</option>
                        </select>
                        <button 
                            onClick={handleSaveDisplayPeriod}
                            disabled={loading}
                            className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg transition shrink-0 flex items-center gap-2"
                        >
                           {loading && <i className="fas fa-spinner fa-spin"></i>}
                           保存
                        </button>
                    </div>
                    <p className="text-xs text-neutral-500">
                        トップページやグラフで一度に読み込む期間を設定します。<br/>
                        期間が長いほど読み込みに時間がかかる場合があります。
                    </p>
                </div>
            </section>

             <section className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                <h3 className="font-bold text-neutral-800 mb-4 border-l-4 border-primary pl-3">AIアドバイザー</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-neutral-900">AIアドバイザーを有効にする</p>
                        <p className="text-xs text-neutral-500 mt-1">
                            月ごとの収支状況を分析し、アドバイスを表示します。<br/>
                            (Google Gemini APIを使用)
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={enableAi} onChange={handleAiToggle} className="sr-only peer" />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>
            </section>

            <section className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                <h3 className="font-bold text-neutral-800 mb-4 border-l-4 border-primary pl-3">通知設定</h3>
                <div className="flex items-center justify-between">
                    <div>
                         <p className="font-medium text-neutral-900">支払予定の通知</p>
                        <p className="text-xs text-neutral-500 mt-1">
                            クレジットカードの引き落とし日や入金予定日の前日に通知を受け取ります。
                        </p>
                    </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={enableNotification} onChange={handleNotificationToggle} className="sr-only peer" />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>
            </section>
        </div>
    );
}
