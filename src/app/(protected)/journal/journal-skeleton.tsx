import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton row for the trades table (desktop view).
 */
function TradeRowSkeleton() {
	return (
		<div className="flex items-center gap-4 border-border border-b px-4 py-3">
			{/* Checkbox */}
			<Skeleton className="h-4 w-4 shrink-0 rounded" />
			{/* Symbol */}
			<Skeleton className="h-4 w-14" />
			{/* Side */}
			<Skeleton className="h-4 w-10" />
			{/* Entry */}
			<div className="flex flex-col gap-1">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-3 w-24" />
			</div>
			{/* Exit */}
			<div className="flex flex-col gap-1">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-3 w-24" />
			</div>
			{/* Size */}
			<Skeleton className="h-4 w-10" />
			{/* P&L */}
			<Skeleton className="h-4 w-16" />
			{/* Result */}
			<Skeleton className="h-4 w-10" />
			{/* Rating */}
			<Skeleton className="h-4 w-20" />
			{/* Reviewed */}
			<Skeleton className="h-4 w-4 rounded-full" />
			{/* Actions */}
			<Skeleton className="ml-auto h-4 w-8" />
		</div>
	);
}

/**
 * Full-page skeleton for the journal (trade log) page.
 * Matches the layout: header, tabs, search/filter, and table rows.
 * Displayed during page navigation via Next.js loading.tsx convention.
 */
export function JournalSkeleton() {
	return (
		<div className="space-y-4 sm:space-y-6" data-testid="journal-skeleton">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<Skeleton className="mb-2 h-3 w-28" />
					<Skeleton className="h-8 w-24 sm:h-9" />
					<Skeleton className="mt-1 h-4 w-36" />
				</div>
				{/* Column config button (desktop) */}
				<Skeleton className="hidden h-9 w-28 sm:block" />
			</div>

			{/* Tab bar skeleton */}
			<div className="inline-flex rounded border border-border bg-secondary p-1">
				<Skeleton className="h-8 w-24 rounded" />
				<Skeleton className="ml-1 h-8 w-20 rounded" />
			</div>

			{/* Search bar */}
			<div className="flex gap-2">
				<Skeleton className="h-10 flex-1" />
			</div>

			{/* Filter panel skeleton (desktop) */}
			<div className="hidden sm:block">
				<div className="rounded border border-border bg-card p-4">
					<div className="flex flex-wrap items-center gap-2">
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-8 w-16" />
					</div>
				</div>
			</div>

			{/* Trades table skeleton */}
			<div className="overflow-hidden rounded border border-border bg-card">
				{/* Table header */}
				<div className="flex items-center gap-4 border-border border-b bg-card px-4 py-2">
					<Skeleton className="h-3 w-4" />
					<Skeleton className="h-3 w-14" />
					<Skeleton className="h-3 w-8" />
					<Skeleton className="h-3 w-10" />
					<Skeleton className="h-3 w-10" />
					<Skeleton className="h-3 w-8" />
					<Skeleton className="h-3 w-10" />
					<Skeleton className="h-3 w-12" />
					<Skeleton className="h-3 w-12" />
					<Skeleton className="h-3 w-14" />
					<Skeleton className="ml-auto h-3 w-10" />
				</div>
				{/* Table rows */}
				{Array.from({ length: 8 }, (_, i) => (
					<TradeRowSkeleton key={`row-${i.toString()}`} />
				))}
			</div>
		</div>
	);
}
