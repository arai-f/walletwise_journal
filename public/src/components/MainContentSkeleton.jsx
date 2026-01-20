/**
 * スケルトンローディング用のUIコンポーネント。
 * データ読み込み中にプレースホルダーとして表示する。
 * @param {object} props - コンポーネントプロパティ。
 * @param {string} [props.className] - 追加のCSSクラス。
 * @returns {JSX.Element} スケルトンコンポーネント。
 */
export const Skeleton = ({ className, ...props }) => {
	return (
		<div
			className={`animate-pulse bg-slate-200 rounded ${className}`}
			{...props}
		/>
	);
};

/**
 * メインコンテンツのローディングスケルトンコンポーネント。
 * ダッシュボードの各セクションのプレースホルダーを表示する。
 * @returns {JSX.Element} メインコンテンツのスケルトンUI。
 */
export const MainContentSkeleton = () => {
	return (
		<main className="animate-fade-in pb-24 md:pb-8">
			{/* Home Section */}
			<section className="mb-8">
				<div className="flex items-center mb-4 pl-3 border-l-4 border-slate-200">
					<Skeleton className="h-7 w-32" />
				</div>

				<div className="mb-6">
					<Skeleton className="h-64 md:h-80 w-full mb-4 rounded-xl shadow-sm" />

					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
						{[...Array(4)].map((_, i) => (
							<Skeleton key={i} className="h-24 w-full rounded-xl" />
						))}
					</div>
				</div>

				<Skeleton className="h-14 w-full rounded-xl border border-slate-100" />
			</section>

			{/* Analysis Section */}
			<section className="mb-8">
				<div className="flex justify-between items-center mb-4">
					<div className="flex items-center pl-3 border-l-4 border-slate-200">
						<Skeleton className="h-7 w-32" />
					</div>
					<Skeleton className="h-8 w-32 rounded-lg" />
				</div>

				<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-75">
					<div className="flex flex-col-reverse md:flex-row gap-8 md:gap-12 items-center md:items-start">
						{/* Stats (Left on desktop) */}
						<div className="w-full md:w-5/12 flex flex-col gap-4 self-center">
							<Skeleton className="h-16 w-full rounded-lg" />
							<Skeleton className="h-16 w-full rounded-lg" />
							<div className="border-b-2 border-slate-100 mx-3 my-1"></div>
							<Skeleton className="h-12 w-full rounded-lg" />
						</div>

						{/* Chart (Right on desktop) */}
						<div className="w-full md:w-7/12 flex flex-col items-center">
							<div className="w-full flex justify-end mb-4">
								<Skeleton className="h-8 w-36 rounded-lg" />
							</div>
							<Skeleton className="h-64 w-64 rounded-full" />
						</div>
					</div>
				</div>
			</section>

			{/* Billing Section */}
			<section className="mb-6">
				<div className="flex items-center mb-4 pl-3 border-l-4 border-slate-200">
					<Skeleton className="h-7 w-48" />
				</div>
				<div className="space-y-4">
					<Skeleton className="h-24 w-full rounded-lg" />
					<Skeleton className="h-24 w-full rounded-lg" />
				</div>
			</section>

			{/* Transactions Section */}
			<section>
				<div className="flex justify-between items-center mb-4">
					<div className="flex items-center pl-3 border-l-4 border-slate-200">
						<Skeleton className="h-7 w-32" />
					</div>
					<Skeleton className="h-10 w-36 rounded-lg" />
				</div>

				<Skeleton className="h-32 md:h-20 w-full mb-4 rounded-xl shadow-sm" />

				<div className="space-y-3">
					<Skeleton className="h-8 w-24 mb-2 mt-4" />
					{[...Array(3)].map((_, i) => (
						<Skeleton key={i} className="h-20 w-full rounded-lg shadow-sm" />
					))}
					<Skeleton className="h-8 w-24 mb-2 mt-4" />
					{[...Array(2)].map((_, i) => (
						<Skeleton key={i} className="h-20 w-full rounded-lg shadow-sm" />
					))}
				</div>
			</section>
		</main>
	);
};
