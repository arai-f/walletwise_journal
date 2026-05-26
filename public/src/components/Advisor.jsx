import {
	faChevronDown,
	faChevronUp,
	faPaperPlane,
	faRobot,
	faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAskAdvisor } from "../hooks/useAskAdvisor.js";

/**
 * AIアドバイザー機能に使用する提案プロンプトのリスト。
 * @constant {Array<object>}
 */
const SUGGESTIONS = [
	{ label: "🍔 食費の内訳は？", text: "直近の食費の内訳を教えて" },
	{
		label: "💰 節約のアドバイス",
		text: "この家計簿を見て、節約できるポイントを具体的に教えて",
	},
	{ label: "📊 先月との比較", text: "先月と比べて支出はどう変化してる？" },
	{ label: "🏆 一番高い買い物", text: "今年一番高かった支出は何？" },
];

/**
 * AIアドバイザーコンポーネント。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.config - ユーザー設定。
 * @param {Array} props.transactions - 取引データ配列。
 * @param {object} props.categories - カテゴリマップまたはオブジェクト。
 * @returns {JSX.Element} AIアドバイザーコンポーネント。
 */
export default function Advisor({ config, transactions, categories }) {
	const {
		isOpen,
		setIsOpen,
		messages,
		input,
		setInput,
		isLoading,
		chatLogRef,
		handleUserSubmit,
	} = useAskAdvisor(config, transactions, categories);

	if (!config?.general?.enableAiAdvisor) return null;

	if (!isOpen) {
		return (
			<div className="mb-6 fade-in">
				<div
					className="bg-white rounded-xl shadow-sm border border-neutral-100 p-3 cursor-pointer hover:shadow-md transition-all duration-300 group relative overflow-hidden flex items-center justify-between"
					onClick={() => setIsOpen(true)}
				>
					<div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

					<div className="relative z-10 flex items-center gap-3">
						<div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-indigo-200 shadow-md group-hover:scale-105 transition-transform duration-300">
							<FontAwesomeIcon icon={faRobot} className="text-sm" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
								AI Advisor
							</h3>
							<p className="text-xs text-neutral-500">
								家計の分析や節約のアドバイスをチャットで相談
							</p>
						</div>
					</div>
					<div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors z-10">
						<FontAwesomeIcon icon={faChevronDown} />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="mb-6 bg-white rounded-xl shadow-lg border border-neutral-100 overflow-hidden flex flex-col transition-all duration-300 fade-in-up">
			<div className="px-3 py-3 border-b border-neutral-100 flex justify-between items-center bg-white shrink-0 z-10">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-indigo-200 shadow-md shrink-0">
						<FontAwesomeIcon icon={faRobot} className="text-sm" />
					</div>
					<div>
						<h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
							AI Advisor
						</h3>
						<p className="text-xs text-neutral-500">
							家計の分析や節約のアドバイスをチャットで相談
						</p>
					</div>
				</div>
				<button
					onClick={() => setIsOpen(false)}
					className="w-8 h-8 rounded-full bg-neutral-50 hover:bg-neutral-100 flex items-center justify-center text-neutral-400 transition-colors"
				>
					<FontAwesomeIcon icon={faChevronUp} />
				</button>
			</div>

			<div
				className="flex flex-col grow overflow-hidden"
				style={{ height: "450px" }}
			>
				<div
					className="grow overflow-y-auto p-4 space-y-4 bg-white scroll-smooth"
					ref={chatLogRef}
					style={{ minHeight: "200px" }}
				>
					{messages.map((msg, idx) => (
						<div
							key={idx}
							className={`flex w-full ${
								msg.role === "user" ? "justify-end" : "justify-start"
							}`}
						>
							<div
								className={
									msg.role === "user"
										? "bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-sm max-w-[85%] shadow-sm"
										: "bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm max-w-[90%] font-medium leading-relaxed shadow-sm"
								}
							>
								{msg.text}
							</div>
						</div>
					))}
					{isLoading && (
						<div className="flex w-full justify-start">
							<div className="bg-neutral-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1 min-w-12">
								<div
									className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
									style={{ animationDelay: "0s" }}
								></div>
								<div
									className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
									style={{ animationDelay: "0.1s" }}
								></div>
								<div
									className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
									style={{ animationDelay: "0.2s" }}
								></div>
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
							onKeyPress={(e) => e.key === "Enter" && handleUserSubmit()}
							placeholder="例: 先月の食費は？ 一番高い買い物は？"
							className="grow bg-neutral-50 border border-neutral-200 text-neutral-800 text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder-neutral-400"
							disabled={isLoading}
							autoComplete="off"
						/>
						<button
							onClick={() => handleUserSubmit()}
							className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
								!input.trim() || isLoading
									? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
									: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95"
							}`}
							disabled={isLoading || !input.trim()}
						>
							<FontAwesomeIcon
								icon={isLoading ? faSpinner : faPaperPlane}
								spin={isLoading}
								className="text-xs"
							/>
						</button>
					</div>
					<div className="text-center mt-2">
						<p className="text-[10px] text-neutral-400">
							この機能はベータ版です。AIは不正確な情報を生成する可能性があります。
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
