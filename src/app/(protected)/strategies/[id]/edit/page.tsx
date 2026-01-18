"use client";

import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CoverImageUpload } from "@/components/strategy/cover-image-upload";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";

export default function StrategyEditPage() {
	const params = useParams();
	const router = useRouter();
	const strategyId = params.id as string;

	const {
		data: strategy,
		isLoading,
		isError,
	} = api.strategies.getById.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId },
	);

	// Redirect to strategy list if not owner (strategy not found means either doesn't exist or not owner)
	useEffect(() => {
		if (!isLoading && !strategy && !isError) {
			router.push("/strategies");
		}
	}, [isLoading, strategy, isError, router]);

	// Loading state
	if (isLoading) {
		return (
			<div
				className="mx-auto w-[95%] max-w-4xl space-y-6 py-6"
				data-testid="strategy-edit-loading"
			>
				{/* Cover image skeleton */}
				<Skeleton className="aspect-[3/1] w-full rounded-lg" />

				{/* Header skeleton */}
				<div className="flex items-center gap-3">
					<Skeleton className="h-10 w-10 rounded" />
					<Skeleton className="h-10 w-64" />
				</div>

				{/* Tabs skeleton */}
				<div className="flex gap-4">
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-8 w-24" />
				</div>

				{/* Content skeleton */}
				<div className="space-y-4">
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-12 w-48" />
				</div>
			</div>
		);
	}

	// Not found / No access - show 404 page
	if (!strategy) {
		return (
			<div
				className="flex flex-col items-center justify-center px-4 py-24"
				data-testid="strategy-edit-not-found"
			>
				<AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground" />
				<h2 className="font-mono font-semibold text-lg uppercase tracking-wider">
					Strategy not found
				</h2>
				<p className="mb-4 text-center font-mono text-muted-foreground text-sm">
					This strategy doesn&apos;t exist or you don&apos;t have access.
				</p>
				<Button asChild className="font-mono">
					<Link href="/strategies">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Strategies
					</Link>
				</Button>
			</div>
		);
	}

	// Edit page content - placeholder for subsequent stories
	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-6 py-6"
			data-testid="strategy-edit-page"
		>
			{/* Cover image upload component */}
			<CoverImageUpload
				coverImageUrl={strategy.coverImageUrl}
				strategyColor={strategy.color}
				strategyId={strategyId}
			/>

			{/* Header with back link and strategy name */}
			<div className="flex items-center gap-3">
				<Button
					asChild
					className="h-10 w-10 shrink-0 font-mono"
					data-testid="strategy-edit-back"
					size="icon"
					variant="ghost"
				>
					<Link href={`/strategies/${strategyId}`}>
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div className="flex min-w-0 items-center gap-3">
					<div
						className="h-4 w-4 shrink-0 rounded"
						style={{ backgroundColor: strategy.color ?? "#d4ff00" }}
					/>
					<h1
						className="truncate font-bold font-mono text-2xl tracking-tight"
						data-testid="strategy-edit-heading"
					>
						Edit: {strategy.name}
					</h1>
				</div>
			</div>

			{/* Placeholder content - will be replaced by US-020, US-021, US-022, US-023 */}
			<div className="rounded border border-white/5 bg-white/2 p-6">
				<div className="flex items-center gap-3 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" />
					<span className="font-mono text-sm">
						Edit form components coming in subsequent stories...
					</span>
				</div>
			</div>
		</div>
	);
}
