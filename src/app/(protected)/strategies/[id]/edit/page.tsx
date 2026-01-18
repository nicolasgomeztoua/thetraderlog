"use client";

import {
	AlertTriangle,
	ArrowLeft,
	Settings,
	Shield,
	Target,
	Wrench,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CoverImageUpload } from "@/components/strategy/cover-image-upload";
import { RiskParametersEditor } from "@/components/strategy/risk-parameters-editor";
import { RulesEditor } from "@/components/strategy/rules-editor";
import { StrategyEditForm } from "@/components/strategy/strategy-edit-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

	// Edit page content with tabbed layout
	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-6 py-6"
			data-testid="strategy-edit-page"
		>
			{/* Cover image upload component - full width at top */}
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

			{/* Tabbed Sections */}
			<Tabs
				className="w-full"
				data-testid="strategy-edit-tabs"
				defaultValue="overview"
			>
				<TabsList className="mb-6 grid w-full grid-cols-4 font-mono">
					<TabsTrigger
						className="flex items-center gap-2 text-xs"
						data-testid="strategy-edit-tab-overview"
						value="overview"
					>
						<Settings className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Overview</span>
					</TabsTrigger>
					<TabsTrigger
						className="flex items-center gap-2 text-xs"
						data-testid="strategy-edit-tab-rules"
						value="rules"
					>
						<Target className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Rules</span>
					</TabsTrigger>
					<TabsTrigger
						className="flex items-center gap-2 text-xs"
						data-testid="strategy-edit-tab-risk"
						value="risk"
					>
						<Shield className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Risk Management</span>
					</TabsTrigger>
					<TabsTrigger
						className="flex items-center gap-2 text-xs"
						data-testid="strategy-edit-tab-advanced"
						value="advanced"
					>
						<Wrench className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Advanced</span>
					</TabsTrigger>
				</TabsList>

				{/* Overview Tab - Description, Color, Instruments, Categories */}
				<TabsContent
					data-testid="strategy-edit-content-overview"
					value="overview"
				>
					<div className="rounded-lg border border-white/5 bg-white/2 p-6">
						<StrategyEditForm
							initialCategoryTags={strategy.categoryTags}
							initialColor={strategy.color}
							initialDescription={strategy.description}
							initialInstruments={strategy.instruments}
							initialName={strategy.name}
							strategyId={strategyId}
						/>
					</div>
				</TabsContent>

				{/* Rules Tab - Entry/Exit Rules */}
				<TabsContent data-testid="strategy-edit-content-rules" value="rules">
					<div className="rounded-lg border border-white/5 bg-white/2 p-6">
						<RulesEditor
							initialRules={strategy.rules ?? []}
							strategyId={strategyId}
						/>
					</div>
				</TabsContent>

				{/* Risk Management Tab */}
				<TabsContent data-testid="strategy-edit-content-risk" value="risk">
					<div className="rounded-lg border border-white/5 bg-white/2 p-6">
						<RiskParametersEditor
							initialRiskParameters={strategy.riskParameters}
							strategyId={strategyId}
						/>
					</div>
				</TabsContent>

				{/* Advanced Tab - Scaling Rules, Trailing Rules (future) */}
				<TabsContent
					data-testid="strategy-edit-content-advanced"
					value="advanced"
				>
					<div className="rounded-lg border border-white/5 bg-white/2 p-6">
						<div className="space-y-6">
							<div>
								<h3 className="mb-2 font-mono font-semibold text-sm uppercase tracking-wider">
									Scaling Rules
								</h3>
								<p className="font-mono text-muted-foreground text-sm">
									Position scaling rules will be available in a future update.
								</p>
								<div className="mt-4 rounded-lg border border-white/10 border-dashed p-8 text-center">
									<Wrench className="mx-auto h-8 w-8 text-muted-foreground/50" />
									<p className="mt-2 font-mono text-muted-foreground/70 text-xs">
										Coming Soon
									</p>
								</div>
							</div>

							<div className="border-white/5 border-t pt-6">
								<h3 className="mb-2 font-mono font-semibold text-sm uppercase tracking-wider">
									Trailing Rules
								</h3>
								<p className="font-mono text-muted-foreground text-sm">
									Trailing stop rules will be available in a future update.
								</p>
								<div className="mt-4 rounded-lg border border-white/10 border-dashed p-8 text-center">
									<Wrench className="mx-auto h-8 w-8 text-muted-foreground/50" />
									<p className="mt-2 font-mono text-muted-foreground/70 text-xs">
										Coming Soon
									</p>
								</div>
							</div>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
