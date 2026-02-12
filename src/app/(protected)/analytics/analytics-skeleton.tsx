import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for a chart terminal card (matching ChartTerminal component).
 * Terminal chrome header + chart title/description + content area.
 */
function ChartTerminalSkeleton({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`overflow-hidden rounded border border-border bg-card ${className ?? ""}`}
		>
			{/* Terminal header */}
			<div className="flex items-center justify-between border-border border-b bg-secondary px-3 py-2 sm:px-4">
				<div className="flex items-center gap-1.5 sm:gap-2">
					<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
				</div>
				<Skeleton className="h-3 w-24" />
				<div className="w-10 sm:w-14" />
			</div>
			{/* Chart header */}
			<div className="border-border border-b px-3 py-2 sm:px-4 sm:py-3">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="mt-1 h-3 w-48" />
			</div>
			{/* Chart content */}
			<div className="p-3 sm:p-4">{children}</div>
		</div>
	);
}

/**
 * Full-page skeleton for the analytics page, matching the layout structure.
 * Displayed during page navigation via Next.js loading.tsx convention.
 */
export function AnalyticsSkeleton() {
	return (
		<div className="space-y-4 sm:space-y-6" data-testid="analytics-skeleton">
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
				<div>
					<Skeleton className="mb-1 h-3 w-20 sm:mb-2" />
					<Skeleton className="h-8 w-32 sm:h-9" />
					<Skeleton className="mt-1 hidden h-4 w-64 sm:block" />
				</div>
				<Skeleton className="h-9 w-24" />
			</div>

			{/* Query bar skeleton */}
			<div className="rounded border border-border bg-card p-3 sm:p-4">
				<div className="flex flex-wrap items-center gap-2">
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-20" />
					<Skeleton className="h-8 w-28" />
					<Skeleton className="h-8 w-20" />
				</div>
			</div>

			{/* Tab bar skeleton */}
			<div className="rounded bg-secondary/50 p-1">
				<div className="flex gap-1">
					{["Overview", "Time", "Risk", "Symbols", "Behavior"].map((tab) => (
						<Skeleton className="h-9 flex-1 rounded sm:h-8" key={tab} />
					))}
				</div>
			</div>

			{/* Overview tab content skeleton (default visible tab) */}
			<div className="space-y-4 sm:space-y-6">
				{/* Stats grid (8 metric cards in 4 columns) */}
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 8 }, (_, i) => (
						<div
							className="rounded border border-border bg-secondary p-4"
							key={`metric-${i.toString()}`}
						>
							<Skeleton className="mb-3 h-3 w-16" />
							<Skeleton className="mb-2 h-6 w-24" />
							<Skeleton className="h-2 w-14" />
						</div>
					))}
				</div>

				{/* Charts grid (2 side-by-side + 1 full-width) */}
				<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
					<ChartTerminalSkeleton>
						<Skeleton className="h-[300px] w-full" />
					</ChartTerminalSkeleton>

					<ChartTerminalSkeleton>
						<Skeleton className="h-[300px] w-full" />
					</ChartTerminalSkeleton>

					<ChartTerminalSkeleton className="lg:col-span-2">
						<Skeleton className="h-[300px] w-full" />
					</ChartTerminalSkeleton>
				</div>
			</div>
		</div>
	);
}
