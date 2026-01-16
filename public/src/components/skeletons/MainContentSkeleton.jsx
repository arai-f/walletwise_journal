import { Skeleton } from "../ui/Skeleton.jsx";

export const MainContentSkeleton = () => {
	return (
		<main className="animate-fade-in">
			{/* 資産一覧セクション */}
			<section className="mb-8">
				{/* H2 title */}
				<div className="flex items-center mb-4 pl-3 border-l-4 border-slate-200">
					<Skeleton className="h-7 w-32" />
				</div>

				{/* DashboardSummary */}
				<Skeleton className="h-44 w-full mb-6 rounded-xl" />

				{/* Advisor */}
				<Skeleton className="h-24 w-full mb-6 rounded-xl border border-slate-100" />

				{/* AccountBalances Grid */}
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-24 w-full rounded-xl" />
					))}
				</div>
			</section>

			{/* 資産推移セクション */}
			<section className="mb-8">
				<div className="flex items-center mb-4 pl-3 border-l-4 border-slate-200">
					<Skeleton className="h-7 w-32" />
				</div>
				<div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
					<Skeleton className="h-64 w-full" />
				</div>
			</section>

			{/* 分析レポートセクション */}
			<section className="mb-8">
				<div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
					<div className="flex justify-between items-center mb-6">
						<Skeleton className="h-8 w-40" />
						<Skeleton className="h-8 w-32" />
					</div>
					<div className="grid grid-cols-2 gap-4 mb-6">
						<Skeleton className="h-24 w-full rounded-lg" />
						<Skeleton className="h-24 w-full rounded-lg" />
					</div>
					<Skeleton className="h-48 w-full rounded-lg" />
				</div>
			</section>

			{/* 次回のカード支払い予定セクション */}
			<section className="mb-6">
				<div className="flex items-center mb-4 pl-3 border-l-4 border-slate-200">
					<Skeleton className="h-7 w-48" />
				</div>
				<div className="space-y-4">
					<Skeleton className="h-20 w-full rounded-lg" />
					<Skeleton className="h-20 w-full rounded-lg" />
				</div>
			</section>

			{/* 取引履歴セクション */}
			<section>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center pl-3 border-l-4 border-slate-200">
						<Skeleton className="h-7 w-32" />
					</div>
					<Skeleton className="h-8 w-8 rounded-full" />
				</div>
				<Skeleton className="h-12 w-full mb-4 rounded-lg" />{" "}
				{/* Month selector */}
				<div className="space-y-2">
					{[...Array(5)].map((_, i) => (
						<Skeleton key={i} className="h-16 w-full rounded-lg" />
					))}
				</div>
			</section>
		</main>
	);
};
