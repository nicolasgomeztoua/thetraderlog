"use client";

import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";

export default function StrategyEditPage() {
	const params = useParams();
	const strategyId = params.id as string;

	const { data: strategy, isLoading } = api.strategies.getById.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId },
	);

	// Loading state
	if (isLoading) {
		return (
			<div
				className="mx-auto w-[95%] max-w-4xl space-y-6 py-6"
				data-testid="strategy-edit-loading"
			>
				{/* Header skeleton */}
				<div className="flex items-center gap-3">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-8 w-48" />
				</div>
				{/* Content skeleton */}
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
			</div>
		);
	}

	// Not found
	if (!strategy) {
		return (
			<div
				className="flex flex-col items-center justify-center px-4 py-24"
				data-testid="strategy-edit-not-found"
			>
				<AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground" />
				<h2 className="font-semibold text-xl">Strategy not found</h2>
				<p className="mb-4 text-center text-muted-foreground text-sm">
					This strategy doesn&apos;t exist or you don&apos;t have access.
				</p>
				<Button asChild className="min-h-[44px]">
					<Link href="/strategies">Back to Strategies</Link>
				</Button>
			</div>
		);
	}

	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-6 py-6"
			data-testid="strategy-edit-page"
		>
			{/* Header */}
			<div className="flex items-center gap-3">
				<Button
					asChild
					className="h-10 w-10"
					data-testid="strategy-edit-button-back"
					size="icon"
					variant="ghost"
				>
					<Link href={`/strategies/${strategyId}`}>
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div className="flex items-center gap-3">
					<div
						className="h-4 w-4 shrink-0 rounded"
						data-testid="strategy-edit-color"
						style={{ backgroundColor: strategy.color ?? "#d4ff00" }}
					/>
					<h1
						className="font-bold text-2xl tracking-tight"
						data-testid="strategy-edit-heading"
					>
						{strategy.name}
					</h1>
				</div>
			</div>

			{/* Edit form placeholder - to be implemented in US-029 */}
			<div className="flex flex-col items-center justify-center rounded border border-white/5 bg-white/2 py-16">
				<Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
				<p className="font-mono text-muted-foreground text-sm">
					Edit form coming soon...
				</p>
				<p className="font-mono text-muted-foreground/60 text-xs">
					(US-024 to US-029)
				</p>
			</div>
		</div>
	);
}
