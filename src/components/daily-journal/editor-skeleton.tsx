"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the JournalEditor component.
 * Matches the editor layout: toolbar + content area + status indicator.
 */
export function EditorSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* Toolbar skeleton */}
			<Skeleton className="h-10 w-full rounded-b-none" />

			{/* Editor skeleton */}
			<div className="flex min-h-0 flex-1 flex-col rounded-b border border-border border-t-0 bg-muted/30 p-4">
				<div className="space-y-3">
					<Skeleton className="h-4 w-3/4" />
					<Skeleton className="h-4 w-1/2" />
					<Skeleton className="h-4 w-5/6" />
					<Skeleton className="h-4 w-2/3" />
					<Skeleton className="h-4 w-4/5" />
				</div>
			</div>

			{/* Status indicator placeholder */}
			<div className="mt-2 h-5 shrink-0" />
		</div>
	);
}
