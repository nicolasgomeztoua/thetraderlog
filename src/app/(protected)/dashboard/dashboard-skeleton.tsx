import { Skeleton } from "@/components/ui/skeleton";

/**
 * Widget skeleton card matching DashboardWidget terminal chrome styling.
 * Used as placeholder in the DashboardSkeleton grid.
 */
function WidgetCardSkeleton({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded border border-border/50 bg-card/50">
			{/* Terminal window chrome header */}
			<div className="flex items-center gap-2 border-border/50 border-b bg-muted/50 px-4 py-2">
				<div className="flex items-center gap-1.5">
					<div className="h-2 w-2 rounded-full bg-loss/60" />
					<div className="h-2 w-2 rounded-full bg-breakeven/60" />
					<div className="h-2 w-2 rounded-full bg-profit/60" />
				</div>
				<Skeleton className="ml-2 h-3 w-24" />
			</div>
			{/* Content area */}
			<div className="flex-1 p-4">{children}</div>
		</div>
	);
}

/**
 * Full-page skeleton for the dashboard, matching the CommandCenterGrid layout.
 * Displayed during page navigation via Next.js loading.tsx convention.
 */
export function DashboardSkeleton() {
	return (
		<div className="space-y-6" data-testid="dashboard-skeleton">
			{/* Header */}
			<div>
				<Skeleton className="mb-2 h-3 w-28" />
				<Skeleton className="h-8 w-56" />
				<Skeleton className="mt-1 h-4 w-40" />
			</div>

			{/* Command Center Grid skeleton */}
			<div className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{/* Row 1: Today's Performance (md = 2 cols) */}
				<div className="col-span-1 row-span-1 md:col-span-2">
					<WidgetCardSkeleton>
						<div className="flex items-start justify-between">
							<div>
								<Skeleton className="h-9 w-32" />
								<Skeleton className="mt-2 h-4 w-24" />
							</div>
							<Skeleton className="h-12 w-12 rounded-full" />
						</div>
						<div className="mt-4 flex items-center gap-4">
							<Skeleton className="h-6 w-8" />
							<Skeleton className="h-6 w-12" />
							<Skeleton className="h-6 w-10" />
						</div>
					</WidgetCardSkeleton>
				</div>

				{/* Journal Status (sm) */}
				<div className="col-span-1 row-span-1">
					<WidgetCardSkeleton>
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-lg" />
							<div>
								<Skeleton className="h-4 w-24" />
								<Skeleton className="mt-1 h-3 w-16" />
							</div>
						</div>
						<Skeleton className="mt-4 h-9 w-full rounded" />
					</WidgetCardSkeleton>
				</div>

				{/* P&L Calendar (lg = 2 cols x 2 rows) */}
				<div className="col-span-1 row-span-1 md:col-span-2 md:row-span-2">
					<WidgetCardSkeleton>
						<div className="mb-3 flex items-center justify-between">
							<Skeleton className="h-7 w-7" />
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-7 w-7" />
						</div>
						<div className="grid grid-cols-7 gap-1">
							{Array.from({ length: 35 }, (_, i) => (
								<Skeleton
									className="aspect-square rounded"
									key={`cal-${i.toString()}`}
								/>
							))}
						</div>
					</WidgetCardSkeleton>
				</div>

				{/* Analytics Snapshot (sm) */}
				<div className="col-span-1 row-span-1">
					<WidgetCardSkeleton>
						<Skeleton className="h-6 w-16" />
						<Skeleton className="mt-2 h-16 w-full rounded" />
						<div className="mt-3 grid grid-cols-2 gap-3">
							<Skeleton className="h-5 w-full" />
							<Skeleton className="h-5 w-full" />
						</div>
					</WidgetCardSkeleton>
				</div>

				{/* Journal Streak (sm) */}
				<div className="col-span-1 row-span-1">
					<WidgetCardSkeleton>
						<Skeleton className="h-8 w-24" />
						<Skeleton className="mt-2 h-4 w-full" />
						<Skeleton className="mt-1 h-4 w-3/4" />
					</WidgetCardSkeleton>
				</div>

				{/* Strategies Snapshot (sm) */}
				<div className="col-span-1 row-span-1">
					<WidgetCardSkeleton>
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-5/6" />
							<Skeleton className="h-4 w-3/4" />
						</div>
					</WidgetCardSkeleton>
				</div>

				{/* Rule Compliance (sm) */}
				<div className="col-span-1 row-span-1">
					<WidgetCardSkeleton>
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-lg" />
							<div>
								<Skeleton className="h-4 w-20" />
								<Skeleton className="mt-1 h-3 w-14" />
							</div>
						</div>
					</WidgetCardSkeleton>
				</div>

				{/* Trades Snapshot (sm) */}
				<div className="col-span-1 row-span-1">
					<WidgetCardSkeleton>
						<div className="space-y-2">
							{Array.from({ length: 3 }, (_, i) => (
								<div
									className="flex items-center gap-2"
									key={`trade-${i.toString()}`}
								>
									<Skeleton className="h-4 flex-1" />
									<Skeleton className="h-4 w-14" />
								</div>
							))}
						</div>
					</WidgetCardSkeleton>
				</div>

				{/* Journal Excerpts (wide = 3 cols) */}
				<div className="col-span-1 row-span-1 md:col-span-2 lg:col-span-3">
					<WidgetCardSkeleton>
						<div className="space-y-3">
							{Array.from({ length: 3 }, (_, i) => (
								<div
									className="rounded bg-muted/50 p-3"
									key={`excerpt-${i.toString()}`}
								>
									<Skeleton className="mb-2 h-3 w-24" />
									<Skeleton className="h-4 w-full" />
									<Skeleton className="mt-1 h-4 w-2/3" />
								</div>
							))}
						</div>
					</WidgetCardSkeleton>
				</div>
			</div>
		</div>
	);
}
