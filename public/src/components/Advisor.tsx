import {
	faChevronDown,
	faChevronRight,
	faComments,
	faPaperPlane,
	faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";
import { useAskAdvisor } from "../hooks/useAskAdvisor";
import type { AdvisorAnalysisPoint, AdvisorState } from "../types/hooks";

/**
 * Advisorコンポーネントのプロパティ。
 */
interface AdvisorProps {
	/** ユーザー設定。 */
	config: {
		general: {
			enableAiAdvisor: boolean;
		};
	};
	/** 取引データ配列。 */
	transactions: Array<{
		id: string;
		date: string;
		amount: number;
		description: string;
		categoryId: string;
		fromAccountId: string;
		toAccountId?: string;
		type: "income" | "expense" | "transfer";
		memo?: string;
	}>;
	/** カテゴリマップまたはオブジェクト。 */
	categories: Map<
		string,
		{ id: string; name: string; type: "income" | "expense" }
	>;
	/** 金額マスク状態。 */
	isMasked?: boolean;
}

/**
 * 金額マスクが有効な場合、テキスト中の金額表記（¥12,345 / 12,345円 等）をマスクする。
 * @param text - 対象テキスト。
 * @param isMasked - マスク有効フラグ。
 * @returns マスク処理後のテキスト。
 */
const applyAmountMask = (text: string, isMasked?: boolean): string => {
	if (!isMasked || !text) return text;
	return text
		.replace(/[¥￥]\s*\d[\d,]*/g, "¥***")
		.replace(/\d[\d,]*\s*円/g, "***円");
};

/**
 * テキスト内の「**太文字**」マークダウンを解析し、strongタグに変換するインラインヘルパー関数。
 * @param text - 対象のテキスト。
 * @param isMasked - 金額マスクフラグ。
 * @returns React要素の配列。
 */
const formatInlineText = (
	text: string | unknown,
	isMasked?: boolean,
): ReactNode => {
	if (typeof text !== "string") return String(text ?? "");
	const masked = applyAmountMask(text, isMasked);
	const parts = masked.split(/(\*\*.*?\*\*)/g);
	return parts.map((part, index) => {
		if (part.startsWith("**") && part.endsWith("**")) {
			return (
				<strong key={index} className="font-bold">
					{part.slice(2, -2)}
				</strong>
			);
		}
		return part;
	});
};

/**
 * チャットメッセージ内の改行および箇条書き（「- 」「・」「* 」）を解析し、
 * 視認性の高いリスト・段落要素に変換するヘルパー関数。
 * @param text - 対象のメッセージテキスト。
 * @param isMasked - 金額マスクフラグ。
 * @returns 整形されたReact要素。
 */
const formatMessageContent = (
	text: string | unknown,
	isMasked?: boolean,
): ReactNode => {
	if (typeof text !== "string") return String(text ?? "");

	const normalized = text
		.replace(/\\n/g, "\n")
		.replace(/([。！？!?\s])\s*[-・]\s+/g, "$1\n- ");

	const rawLines = normalized
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (rawLines.length === 0) return null;

	return (
		<div className="space-y-1.5">
			{rawLines.map((line, idx) => {
				const bulletMatch = line.match(/^(?:[-*・•]|\d+[.)])\s*(.+)$/);
				if (bulletMatch) {
					return (
						<div key={idx} className="flex items-start gap-2 leading-relaxed">
							<span className="text-primary font-bold select-none shrink-0 mt-0.5">
								•
							</span>
							<span className="flex-1 min-w-0 text-neutral-800">
								{formatInlineText(bulletMatch[1], isMasked)}
							</span>
						</div>
					);
				}
				return (
					<p key={idx} className="leading-relaxed text-neutral-800">
						{formatInlineText(line, isMasked)}
					</p>
				);
			})}
		</div>
	);
};

/**
 * インサイトカードの種別に応じたアイコンを返す。
 */
const getPointIcon = (type?: string) => {
	switch (type) {
		case "positive":
			return "✅";
		case "warning":
			return "⚠️";
		case "recommendation":
			return "💡";
		case "highlight":
			return "🔍";
		default:
			return "📊";
	}
};

/**
 * 家計の安定度ステータスの表示情報を返す。
 */
const getStabilityStatus = (alertLevel?: "safe" | "warning" | "danger") => {
	if (alertLevel === "danger") {
		return {
			dotClass: "bg-danger",
			textClass: "text-danger",
			label: "支出超過に注意",
		};
	}
	if (alertLevel === "warning") {
		return {
			dotClass: "bg-danger",
			textClass: "text-neutral-900",
			label: "支出ペースやや早め",
		};
	}
	return {
		dotClass: "bg-success",
		textClass: "text-success",
		label: "収支は安定しています",
	};
};

/**
 * 筆算サマリー下部等に配置する「AI文字アイコン＋安定度ステータス＋縦積み3つのインサイトカード」パネル。
 */
export function AdvisorInsightsPanel({
	advisor,
	hasTransactions,
	isMasked = false,
}: {
	advisor: AdvisorState;
	hasTransactions: boolean;
	isMasked?: boolean;
}) {
	const {
		isOpen,
		setIsOpen,
		isLoading,
		insights,
		isInsightsLoading,
		handleSelectInsight,
	} = advisor;

	const stability = getStabilityStatus(insights?.alertLevel);
	const analysisPoints: AdvisorAnalysisPoint[] = Array.isArray(
		insights?.analysisPoints,
	)
		? insights.analysisPoints.slice(0, 3)
		: [];

	return (
		<div className="mt-3 pt-3 border-t border-neutral-200 space-y-2.5">
			{/* 上段：安定度表示 ＆ 相談ボタン */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					{insights ? (
						<span
							className={`inline-flex items-center gap-1.5 text-sm font-medium truncate ${stability.textClass}`}
						>
							<span
								className={`w-2 h-2 rounded-full shrink-0 ${stability.dotClass}`}
							/>
							<span className="truncate">{stability.label}</span>
						</span>
					) : (
						<span className="text-sm font-medium text-neutral-600 truncate">
							家計トレンド分析
						</span>
					)}
				</div>

				<div className="flex items-center gap-1.5 shrink-0">
					<button
						type="button"
						onClick={() => setIsOpen(!isOpen)}
						className={`h-8 px-3 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
							isOpen
								? "bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-700"
								: "bg-primary hover:bg-primary-dark border-primary text-white shadow-sm"
						}`}
					>
						<FontAwesomeIcon icon={faComments} className="text-xs" />
						<span>{isOpen ? "相談を閉じる" : "AIに相談"}</span>
						<FontAwesomeIcon
							icon={faChevronDown}
							className={`text-xs transition-transform duration-300 ${
								isOpen ? "rotate-180" : ""
							}`}
						/>
					</button>
				</div>
			</div>

			{/* 下段：縦積み3つの見出しインサイトカード（リストアイテム仕様） */}
			{!hasTransactions ? (
				<div className="text-sm font-normal text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md p-3">
					取引を登録するとAI分析が表示されます。
				</div>
			) : isInsightsLoading && !insights ? (
				<div className="flex flex-col animate-pulse">
					<div className="h-10 bg-neutral-50 border border-neutral-200 rounded-md mb-2" />
					<div className="h-10 bg-neutral-50 border border-neutral-200 rounded-md mb-2" />
					<div className="h-10 bg-neutral-50 border border-neutral-200 rounded-md" />
				</div>
			) : (
				analysisPoints.length > 0 && (
					<div className="flex flex-col">
						{analysisPoints.map((point, idx) => (
							<button
								key={idx}
								type="button"
								onClick={() => handleSelectInsight(point)}
								disabled={isLoading}
								className="w-full text-left bg-neutral-50 hover:bg-primary-light border border-neutral-200 rounded-md p-2.5 mb-2 last:mb-0 transition-colors flex items-center justify-between gap-2 group cursor-pointer disabled:opacity-50"
							>
								<div className="flex items-center gap-2 min-w-0 flex-1">
									<span className="text-sm shrink-0">
										{getPointIcon(point.type)}
									</span>
									<span className="text-sm font-medium text-neutral-900 truncate">
										{formatInlineText(point.title, isMasked)}
									</span>
								</div>
								<FontAwesomeIcon
									icon={faChevronRight}
									className="text-xs text-neutral-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0"
								/>
							</button>
						))}
					</div>
				)
			)}
		</div>
	);
}

/**
 * 収支レポートカードの下部全幅に展開する深掘りチャットドロワー。
 * DashboardSummary の「推移チャートを表示」と同じスライドアニメーション（max-h + opacity + overflow-hidden）で開閉する。
 */
export function AdvisorChatDrawer({
	advisor,
	isMasked = false,
}: {
	advisor: AdvisorState;
	isMasked?: boolean;
	flush?: boolean;
}) {
	const {
		isOpen,
		messages,
		input,
		setInput,
		isLoading,
		chatLogRef,
		handleUserSubmit,
		suggestedQuestions,
	} = advisor;

	return (
		<div
			aria-hidden={!isOpen}
			className={`transition-all duration-500 ease-in-out overflow-hidden ${
				isOpen
					? "max-h-150 opacity-100"
					: "max-h-0 opacity-0 pointer-events-none"
			}`}
		>
			<div className="border-t border-neutral-200 bg-neutral-50 flex flex-col">
				<div
					className="overflow-y-auto p-4 space-y-3 scroll-smooth max-h-88 min-h-36"
					ref={chatLogRef}
				>
				{messages.length === 0 && !isLoading ? (
					<div className="text-center py-6 text-sm font-normal text-neutral-600">
						インサイトカードや下の質問ボタンをタップするか、自由に質問を入力してください。
					</div>
				) : (
					messages.map((msg, idx) => (
						<div
							key={idx}
							className={`flex w-full ${
								msg.role === "user" ? "justify-end" : "justify-start"
							}`}
						>
							<div
								className={
									msg.role === "user"
										? "bg-primary text-white rounded-lg rounded-tr-none px-4 py-2 text-sm font-normal shadow-sm ml-auto max-w-[85%] w-fit"
										: "bg-white border border-neutral-200 text-neutral-800 rounded-lg rounded-tl-none px-4 py-3 text-sm font-normal shadow-sm max-w-[92%]"
								}
							>
								{msg.role === "user"
									? formatInlineText(msg.text, isMasked)
									: formatMessageContent(msg.text, isMasked)}
							</div>
						</div>
					))
				)}

				{isLoading && (
					<div className="flex w-full justify-start">
						<div className="bg-white border border-neutral-200 rounded-lg rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
							<div
								className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
								style={{ animationDelay: "0s" }}
							/>
							<div
								className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
								style={{ animationDelay: "0.1s" }}
							/>
							<div
								className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
								style={{ animationDelay: "0.2s" }}
							/>
						</div>
					</div>
				)}
			</div>

			{/* 動的質問チップ ＆ 自由入力フォーム */}
			<div className="p-4 bg-white border-t border-neutral-200 rounded-b-xl">
				<div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2.5 pb-0.5">
					{suggestedQuestions.map((s, idx) => (
						<button
							key={idx}
							type="button"
							className="shrink-0 bg-neutral-50 hover:bg-primary-light border border-neutral-200 text-neutral-600 hover:text-primary px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50"
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
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.nativeEvent.isComposing) {
								handleUserSubmit();
							}
						}}
						placeholder="深掘りしたい内容を質問..."
						className="h-9 w-full border border-neutral-300 rounded-lg px-2 text-sm text-neutral-900 bg-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
						disabled={isLoading}
						autoComplete="off"
					/>
					<button
						type="button"
						onClick={() => handleUserSubmit()}
						aria-label="質問を送信"
						className="h-9 px-4 bg-primary hover:bg-primary-dark text-white font-bold shadow-sm rounded-lg text-sm flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={isLoading || !input.trim()}
					>
						<FontAwesomeIcon
							icon={isLoading ? faSpinner : faPaperPlane}
							spin={isLoading}
							className="text-xs"
						/>
					</button>
				</div>
			</div>
			</div>
		</div>
	);
}

/**
 * 単体利用時のAIアドバイザーコンポーネント。
 */
export default function Advisor({
	config,
	transactions,
	categories,
	isMasked = false,
}: AdvisorProps) {
	const advisor = useAskAdvisor(config, transactions, categories);

	if (!config?.general?.enableAiAdvisor) return null;

	return (
		<div className="mb-6 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden transition-all duration-500 fade-in">
			<div className="p-4">
				<AdvisorInsightsPanel
					advisor={advisor}
					hasTransactions={transactions.length > 0}
					isMasked={isMasked}
				/>
			</div>
			<AdvisorChatDrawer advisor={advisor} isMasked={isMasked} />
		</div>
	);
}
