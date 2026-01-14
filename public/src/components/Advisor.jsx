import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from 'react';
import { app, db } from "../firebase.js";
import * as store from "../services/store.js";
import * as utils from "../utils.js";

/**
 * 1日あたりのAPI呼び出し制限回数。
 * @type {number}
 */
const MAX_DAILY_CALLS = 20;

/**
 * ユーザーに提示する提案チップのリスト。
 * @type {Array<{label: string, text: string}>}
 */
const SUGGESTIONS = [
    { label: "🍔 食費の内訳は？", text: "直近の食費の内訳を教えて" },
    {
        label: "💰 節約のアドバイス",
        text: "この家計簿を見て、節約できるポイントを具体的に教えて",
    },
    { label: "📊 先月との比較", text: "先月と比べて支出はどう変化してる？" },
    { label: "🔮 来月の予測", text: "今のペースだと来月はどうなりそう？" },
];

/**
 * AIアドバイザーコンポーネント。
 * 家計簿データを分析し、Gemini APIを使用してユーザーとチャットを行う。
 * 
 * @component
 * @param {object} props
 * @param {object} props.config - アプリケーション設定オブジェクト。
 * @param {Array<object>} props.transactions - 現在のコンテキストにおける取引データの配列。
 * @param {Map<string, object>|Object<string, object>} props.categories - カテゴリデータのMapまたはObject。
 * @returns {JSX.Element|null} Configで無効化されている場合はnullを返す。
 */
export default function Advisor({ config, transactions, categories }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [model, setModel] = useState(null);
    const [usageCache, setUsageCache] = useState({ date: "", count: 0 });
    const [isUsageLoaded, setIsUsageLoaded] = useState(false);
    
    // チャットログの自動スクロール用Ref
    const chatLogRef = useRef(null);
    // 初回起動の重複防止用Ref
    const hasStartedRef = useRef(false);

    /**
     * メッセージ更新時にチャットログを最下部へスクロールする。
     */
    useEffect(() => {
        if (chatLogRef.current) {
            chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
        }
    }, [messages, isLoading, isOpen]);

    /**
     * Geminiモデルを非同期で初期化する。
     * firebase/ai モジールを動的インポートする。
     */
    useEffect(() => {
        async function loadModel() {
            try {
                const { getAI, getGenerativeModel, VertexAIBackend } = await import(
                    "firebase/ai"
                );
                const ai = getAI(app, { backend: new VertexAIBackend() });
                const m = getGenerativeModel(ai, {
                    model: "gemini-2.5-flash",
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_LOW_AND_ABOVE",
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_LOW_AND_ABOVE",
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_LOW_AND_ABOVE",
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_LOW_AND_ABOVE",
                        },
                    ],
                });
                setModel(m);
            } catch (e) {
                console.error("Failed to load Gemini model", e);
            }
        }
        loadModel();
    }, []);

    /**
     * FirestoreからAPI利用状況を読み込む。
     * @async
     * @returns {Promise<void>}
     */
    const loadUsage = useCallback(async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const docRef = doc(db, "user_configs", user.uid);
        try {
            const snap = await getDoc(docRef);
            let newUsage = { date: utils.toYYYYMMDD(new Date()), count: 0 };
            
            if (snap.exists()) {
                const data = snap.data();
                const u = data.aiAdvisorUsage;
                if (u && u.date && typeof u.count === "number") {
                    newUsage = { date: u.date, count: u.count };
                }
            }
            setUsageCache(newUsage);
            setIsUsageLoaded(true);
        } catch (e) {
            console.error("[Advisor] Failed to load usage stats:", e);
            setUsageCache({ date: utils.toYYYYMMDD(new Date()), count: 0 });
            setIsUsageLoaded(true);
        }
    }, []);

    // コンポーネントマウント時に利用状況をロード
    useEffect(() => {
        loadUsage();
    }, [loadUsage]);

    /**
     * 本日のAPI呼び出し回数が制限内かどうかを確認する。
     * キャッシュが古い場合はFirestoreから再取得して同期する。
     * @async
     * @returns {Promise<boolean>} 制限内であればtrue。
     */
    const checkRateLimit = useCallback(async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return false;

        const today = utils.toYYYYMMDD(new Date());
        let currentUsage = usageCache;

        // キャッシュが未ロードまたは日付不一致の場合、Firestoreから最新を取得
        if (!isUsageLoaded || currentUsage.date !== today) {
             const docRef = doc(db, "user_configs", user.uid);
             const snap = await getDoc(docRef);
             let fetchedUsage = { date: today, count: 0 };
             if(snap.exists()) {
                 const data = snap.data();
                 if(data.aiAdvisorUsage && data.aiAdvisorUsage.date) {
                     fetchedUsage = data.aiAdvisorUsage;
                 }
             }
             currentUsage = fetchedUsage;
        }

        // 取得後も日付が古い場合はリセットして更新
        if (currentUsage.date !== today) {
            currentUsage = { date: today, count: 0 };
            store.updateConfig({ aiAdvisorUsage: currentUsage }, true).catch(console.error);
        }
        
        setUsageCache(currentUsage);
        return currentUsage.count < MAX_DAILY_CALLS;
    }, [usageCache, isUsageLoaded]);

    /**
     * API呼び出し回数をインクリメントし、Firestoreへ保存する。
     * @async
     * @returns {Promise<void>}
     */
    const incrementCallCount = useCallback(async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const today = utils.toYYYYMMDD(new Date());
        let currentUsage = {...usageCache};

        // 日付が変わっていればリセット、そうでなければカウントアップ
        // note: checkRateLimitで同期済みの前提だが、念のため再確認
        if (currentUsage.date !== today) {
            currentUsage = { date: today, count: 1 };
        } else {
            currentUsage.count = (currentUsage.count || 0) + 1;
        }

        setUsageCache(currentUsage);
        await store.updateConfig({ aiAdvisorUsage: currentUsage }, true);
    }, [usageCache]);

    /**
     * 取引データを集計し、AIプロンプト用のサマリーデータを生成する。
     * @returns {object|null} サマリー情報。データがない場合はnull。
     */
    const prepareSummaryData = useCallback(() => {
        if (!transactions || transactions.length === 0) return null;

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryTotals = {};
        const monthlyStats = {}; 
        let transactionsList = "";

        transactions.forEach((t) => {
            const amount = Number(t.amount);
            const dateStr = utils.toYYYYMMDD(t.date);
            const monthStr = dateStr.substring(0, 7); 
            // categoriesはMapまたはObjectの可能性があるため両対応
            const cat = categories instanceof Map ? categories.get(t.categoryId) : categories[t.categoryId];
            const catName = cat ? cat.name : "不明";

            if (!monthlyStats[monthStr]) {
                monthlyStats[monthStr] = { income: 0, expense: 0 };
            }

            if (t.type === "income") {
                totalIncome += amount;
                monthlyStats[monthStr].income += amount;
            } else if (t.type === "expense") {
                totalExpense += amount;
                categoryTotals[catName] = (categoryTotals[catName] || 0) + amount;
                monthlyStats[monthStr].expense += amount;
            }
        });

        const recentMonths = Object.keys(monthlyStats)
            .sort()
            .reverse()
            .slice(0, 3)
            .reduce((obj, key) => {
                obj[key] = monthlyStats[key];
                return obj;
            }, {});

        const sortedTransactions = [...transactions]
            .sort((a, b) => b.date - a.date)
            .slice(0, 50);

        sortedTransactions.forEach((t) => {
            const amount = Number(t.amount);
            // categories対応
            const cat = categories instanceof Map ? categories.get(t.categoryId) : categories[t.categoryId];
            const catName = cat ? cat.name : "不明";
            const dateStr = utils.toYYYYMMDD(t.date);
            const dateShort = dateStr.substring(5).replace("-", "/");
            const desc = t.description || t.memo || "";
            // トークン節約のためフォーマットを簡略化
            transactionsList += `${dateShort}|${t.type === "income" ? "(収)" : ""}${catName}|${amount}|${desc}\n`;
        });

        const sortedCategories = Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, amount]) => ({ name, amount }));

        return {
            overview: {
                period: "表示期間（直近データ）",
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense,
                topExpenses: sortedCategories,
                recentMonths,
            },
            transactionsList: transactionsList,
        };
    }, [transactions, categories]);

    /**
     * Gemini APIを呼び出し、テキストを生成する。
     * @async
     * @param {string} prompt - 入力プロンプト。
     * @returns {Promise<string>} 生成されたテキスト。
     * @throws {Error} モデル未ロード時やAPIエラー時にスローされる。
     */
    const callGemini = useCallback(async (prompt) => {
        try {
            if(!model) throw new Error("Model not loaded");
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.error("[Advisor] Gemini APIエラー:", error);
            throw error;
        }
    }, [model]);

    /**
     * 会話を開始する（初回のみ）。
     * 分析結果に基づいて挨拶メッセージを生成する。
     * @async
     * @returns {Promise<void>}
     */
    const startConversation = useCallback(async () => {
        if (hasStartedRef.current || messages.length > 0) return;
        
        hasStartedRef.current = true;
        setIsLoading(true);

        const canCall = await checkRateLimit();
        if(!canCall) {
             setMessages([{ role: "model", text: "本日のAI利用回数制限に達しました。また明日お話ししましょう！" }]);
             setIsLoading(false);
             return;
        }

        try {
            const summary = prepareSummaryData();
            if (!summary) {
                setMessages([{ role: "model", text: "データがまだないようですね。取引を入力すると分析できるようになります！" }]);
                setIsLoading(false);
                return;
            }

            const prompt = `あなたは親しみやすいファイナンシャルプランナーです。
            以下の家計簿データ（現在表示中の期間）を分析し、ユーザーに最初の挨拶を行ってください。
            
            【データ概要】
            ${JSON.stringify(summary.overview)}
            
            【要件】
            - 現在の時刻や季節などに触れ、親しみやすい口調で挨拶をする。
            - 収支の全体感（黒字/赤字）を一言で伝える。
            - 比較可能なデータがあれば変化に触れる。
            - 150文字以内で簡潔に。
            - 太字や箇条書きなどのMarkdown記法は使わず、プレーンテキストで出力する。
            `;

            const response = await callGemini(prompt);
            setMessages([{ role: "model", text: response }]);
            await incrementCallCount();

        } catch (e) {
            console.error("[Advisor] 起動エラー:", e);
            setMessages([{ role: "model", text: "すみません、うまく起動できませんでした。" }]);
        } finally {
            setIsLoading(false);
        }
    }, [checkRateLimit, prepareSummaryData, callGemini, incrementCallCount, messages.length]); 

    /**
     * アクション：ユーザーからのメッセージ送信を処理する。
     * @async
     * @param {string|null} [forcedText=null] - 提案チップ等から入力されたテキスト。省略時は入力欄の値を使用。
     * @returns {Promise<void>}
     */
    const handleUserSubmit = async (forcedText = null) => {
        const text = forcedText || input.trim();
        if (!text || isLoading) return;

        // Optimistic UI update
        const newMessages = [...messages, { role: "user", text }];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        const canCall = await checkRateLimit();
        if (!canCall) {
            setMessages(prev => [...prev, { role: "model", text: `申し訳ありません、本日の利用回数制限（${MAX_DAILY_CALLS}回）に達しました。` }]);
            setIsLoading(false);
            return;
        }

        try {
            const data = prepareSummaryData();
            const summaryPart = data ? JSON.stringify(data.overview) : "データなし";
            const listPart = data ? data.transactionsList : "";

            const systemContext = `
            【役割】
            あなたはユーザー専属のFP「WalletWise AI」です。
            提供された家計簿データ（ユーザーが表示中の期間）を元に、分析・アドバイス・質問への回答を行います。
            
            【家計簿データ】
            サマリー: ${summaryPart}
            
            【直近の取引リスト (日付|カテゴリ|金額|詳細)】
            ${listPart}
            
            【重要】
            - データは「現在表示期間内の全データ」です。
            - 「先月との比較」などはサマリー内の "recentMonths" を参照してください。
            - リストにない古い取引の詳細は「データなし」と回答してください。
            
            【回答要件】
            - 日本語、200文字以内、親しみやすい口調。Markdown禁止。
            `;

            let prompt = systemContext + "\n\n【これまでの会話】\n";
            newMessages.slice(-6).forEach((msg) => {
                const roleLabel = msg.role === "user" ? "User" : "AI";
                prompt += `${roleLabel}: ${msg.text}\n`;
            });
            prompt += `\nUser: ${text}\nAI:`;

            const responseText = await callGemini(prompt);
            setMessages(prev => [...prev, { role: "model", text: responseText }]);
            await incrementCallCount();

        } catch (error) {
            console.error("[Advisor] チャットエラー:", error);
            let errorMsg = "エラーが発生しました。もう一度お試しください。";
            if (error.message && (error.message === "SafetyBlock" || error.message.includes("SAFETY"))) {
                errorMsg = "申し訳ありませんが、その内容にはお答えできません。（安全フィルターによりブロックされました）";
            }
            setMessages(prev => [...prev, { role: "model", text: errorMsg }]);
        } finally {
            setIsLoading(false);
        }
    };

    // 初期化エフェクト：モデルがロードされ、パネルが開かれたら会話を開始する
    useEffect(() => {
        if (isOpen && messages.length === 0 && model) {
            startConversation();
        }
    }, [isOpen, model, messages.length, startConversation]);

    if (!config?.general?.enableAiAdvisor) return null;

    return (
        <div className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col transition-all duration-300" style={{ maxHeight: isOpen ? '600px' : 'none' }}>
            {/* Header */}
            <div 
                className="px-4 py-3 border-b border-neutral-100 flex justify-between items-center cursor-pointer bg-neutral-50/80 hover:bg-neutral-100 transition-colors shrink-0 z-10"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shrink-0">
                        <i className="fa-solid fa-robot text-xs"></i>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                            AI Advisor
                            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100">BETA</span>
                        </h3>
                    </div>
                </div>
                <i className={`fas fa-chevron-down text-neutral-400 transition-transform duration-300 ${!isOpen ? '-rotate-90' : ''}`}></i>
            </div>

            {/* Content (Chat Log & Input) */}
            {isOpen && (
                <div className="flex flex-col grow overflow-hidden" style={{ height: '400px' }}>
                    <div 
                        className="grow overflow-y-auto p-4 space-y-4 bg-white scroll-smooth" 
                        ref={chatLogRef}
                        style={{ minHeight: '200px' }}
                    >
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={
                                    msg.role === 'user' 
                                    ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-sm max-w-[85%] shadow-sm"
                                    : "bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm max-w-[90%] font-medium leading-relaxed shadow-sm"
                                }>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex w-full justify-start">
                                <div className="bg-neutral-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1 min-w-12">
                                    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 bg-white border-t border-neutral-100 shrink-0 z-10">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
                            {SUGGESTIONS.map((s, idx) => (
                                <button
                                    key={idx}
                                    className="shrink-0 bg-neutral-50 border border-neutral-200 text-neutral-600 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95"
                                    onClick={() => handleUserSubmit(s.text)}
                                    disabled={isLoading}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative flex items-center gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleUserSubmit()}
                                placeholder="例: 食費を減らすには？"
                                className="grow bg-neutral-50 border border-neutral-200 text-neutral-800 text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder-neutral-400"
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => handleUserSubmit()}
                                className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                disabled={isLoading || !input.trim()}
                            >
                                <i className="fas fa-paper-plane text-sm"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
