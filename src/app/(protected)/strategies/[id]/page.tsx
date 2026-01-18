"use client";

import {
	AlertTriangle,
	ArrowLeft,
	Copy,
	Download,
	ExternalLink,
	Loader2,
	Pencil,
	Trash2,
	User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { StrategyFormData } from "@/components/strategy";
import { MarketplaceSection, StrategyForm } from "@/components/strategy";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

export default function StrategyDetailPage() {
	const params = useParams();
	const router = useRouter();
	const strategyId = params.id as string;
	const isMobile = useIsMobile();

	const [deleteOpen, setDeleteOpen] = useState(false);

	const utils = api.useUtils();

	const { data: strategy, isLoading } = api.strategies.getById.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId },
	);

	const { data: stats } = api.strategies.getStats.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId && !!strategy },
	);

	// Fetch source strategy info if this is a downloaded strategy
	const { data: sourceStrategy } = api.marketplace.getById.useQuery(
		{ id: strategy?.sourceStrategyId ?? "" },
		{
			enabled: !!strategy?.sourceStrategyId,
		},
	);

	const updateMutation = api.strategies.update.useMutation({
		onSuccess: () => {
			toast.success("Strategy updated");
			utils.strategies.getById.invalidate({ id: strategyId });
			utils.strategies.getAll.invalidate();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update strategy");
		},
	});

	const deleteMutation = api.strategies.delete.useMutation({
		onSuccess: () => {
			toast.success("Strategy deleted");
			utils.strategies.getAll.invalidate();
			router.push("/strategies");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete strategy");
		},
	});

	const duplicateMutation = api.strategies.duplicate.useMutation({
		onSuccess: (newStrategy) => {
			toast.success("Strategy duplicated");
			utils.strategies.getAll.invalidate();
			router.push(`/strategies/${newStrategy.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to duplicate strategy");
		},
	});

	const handleSubmit = (data: StrategyFormData) => {
		updateMutation.mutate({
			id: strategyId,
			name: data.name,
			description: data.description || null,
			color: data.color,
			entryCriteria: data.entryCriteria || null,
			exitRules: data.exitRules || null,
			riskParameters: data.riskParameters,
			scalingRules: data.scalingRules,
			trailingRules: data.trailingRules,
			isActive: data.isActive,
			rules: data.rules,
		});
	};

	// Loading state
	if (isLoading) {
		return (
			<div
				className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-6 sm:py-6"
				data-testid="strategy-detail-loading"
			>
				{/* Hero banner skeleton */}
				<Skeleton className="aspect-[3/1] w-full rounded-lg" />
				<div className="flex items-center gap-2 sm:gap-3">
					<Skeleton className="h-10 w-10 rounded" />
					<Skeleton className="h-8 w-48 sm:w-64" />
				</div>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
				</div>
				<Skeleton className="h-96" />
			</div>
		);
	}

	// Not found
	if (!strategy) {
		return (
			<div
				className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
				data-testid="strategy-detail-not-found"
			>
				<AlertTriangle className="mb-4 h-10 w-10 text-muted-foreground sm:h-12 sm:w-12" />
				<h2 className="font-mono font-semibold text-lg uppercase tracking-wider sm:text-xl">
					Strategy not found
				</h2>
				<p className="mb-4 text-center font-mono text-muted-foreground text-sm sm:text-base">
					This strategy doesn&apos;t exist or you don&apos;t have access.
				</p>
				<Button asChild className="min-h-[44px] font-mono">
					<Link href="/strategies">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Strategies
					</Link>
				</Button>
			</div>
		);
	}

	// Transform rules for the form
	const formRules = strategy.rules.map((rule) => ({
		id: rule.id,
		text: rule.text,
		category: rule.category,
		order: rule.order,
	}));

	const strategyColor = strategy.color ?? "#d4ff00";

	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-8 sm:py-6"
			data-testid="strategy-detail-page"
		>
			{/* Hero Banner with Cover Image */}
			<div
				className="relative aspect-[3/1] w-full overflow-hidden rounded-lg"
				data-testid="strategy-detail-hero"
			>
				{strategy.coverImageUrl ? (
					<Image
						alt={`${strategy.name} cover`}
						className="object-cover"
						data-testid="strategy-detail-cover-image"
						fill
						sizes="(max-width: 768px) 95vw, 896px"
						src={strategy.coverImageUrl}
					/>
				) : (
					<div
						className="absolute inset-0"
						data-testid="strategy-detail-cover-placeholder"
						style={{
							background: `linear-gradient(135deg, ${strategyColor}20 0%, ${strategyColor}05 50%, transparent 100%)`,
						}}
					/>
				)}
				{/* Gradient overlay for text readability */}
				<div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
				{/* Strategy name overlay */}
				<div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
					<div className="flex items-end justify-between gap-4">
						<div className="flex items-center gap-3">
							<div
								className="h-4 w-4 shrink-0 rounded shadow-lg sm:h-5 sm:w-5"
								style={{
									backgroundColor: strategyColor,
									boxShadow: `0 0 12px ${strategyColor}40`,
								}}
							/>
							<h1
								className="font-bold font-mono text-xl tracking-tight drop-shadow-lg sm:text-3xl"
								data-testid="strategy-detail-heading"
								style={{
									textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)",
								}}
							>
								{strategy.name}
							</h1>
						</div>
					</div>
				</div>
			</div>

			{/* Downloaded from Marketplace Attribution */}
			{strategy.sourceStrategyId && (
				<div
					className="flex flex-wrap items-center gap-3 rounded border border-accent/20 bg-accent/5 p-3 sm:p-4"
					data-testid="strategy-source-attribution"
				>
					<Badge
						className="bg-accent/20 font-mono text-[10px] text-accent"
						variant="secondary"
					>
						<Download className="mr-1 h-3 w-3" />
						Downloaded from Marketplace
					</Badge>
					{sourceStrategy ? (
						<>
							<span className="font-mono text-muted-foreground text-xs">
								Original:
							</span>
							<Link
								className="flex items-center gap-1.5 font-mono text-sm transition-colors hover:text-accent"
								href={`/marketplace/${strategy.sourceStrategyId}`}
							>
								<span className="font-medium">{sourceStrategy.name}</span>
								<ExternalLink className="h-3 w-3" />
							</Link>
							{sourceStrategy.creator && (
								<>
									<span className="font-mono text-muted-foreground text-xs">
										by
									</span>
									<div className="flex items-center gap-1.5">
										{sourceStrategy.creator.imageUrl ? (
											<Image
												alt={sourceStrategy.creator.name ?? "Creator"}
												className="rounded-full"
												height={20}
												src={sourceStrategy.creator.imageUrl}
												width={20}
											/>
										) : (
											<div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20">
												<User className="h-3 w-3 text-accent" />
											</div>
										)}
										<span className="font-mono text-sm">
											{sourceStrategy.creator.name ?? "Anonymous"}
										</span>
									</div>
								</>
							)}
							{!sourceStrategy.creator && (
								<>
									<span className="font-mono text-muted-foreground text-xs">
										by
									</span>
									<div className="flex items-center gap-1.5">
										<User className="h-4 w-4 text-muted-foreground" />
										<span className="font-mono text-muted-foreground text-sm italic">
											Anonymous
										</span>
									</div>
								</>
							)}
						</>
					) : (
						<span className="font-mono text-muted-foreground text-xs italic">
							Original strategy is no longer public
						</span>
					)}
				</div>
			)}

			{/* Action Bar */}
			<div
				className="flex items-center justify-between gap-2"
				data-testid="strategy-detail-actions"
			>
				<Button
					asChild
					className="min-h-[44px] min-w-[44px] shrink-0 font-mono sm:h-8 sm:min-h-0 sm:w-auto sm:min-w-0 sm:px-3"
					size="icon"
					variant="ghost"
				>
					<Link href="/strategies">
						<ArrowLeft className="h-4 w-4 sm:mr-2" />
						<span className="hidden sm:inline">Back</span>
					</Link>
				</Button>

				<div className="flex shrink-0 items-center gap-1 sm:gap-2">
					<Button
						asChild
						className="min-h-[36px] min-w-[36px] font-mono text-xs sm:min-h-0 sm:min-w-0"
						data-testid="strategy-detail-edit-button"
						size={isMobile ? "icon" : "sm"}
						style={{
							borderColor: `${strategyColor}40`,
							color: strategyColor,
						}}
						variant="outline"
					>
						<Link href={`/strategies/${strategyId}/edit`}>
							<Pencil className="h-3.5 w-3.5 sm:mr-2 sm:h-3 sm:w-3" />
							<span className="hidden sm:inline">Edit</span>
						</Link>
					</Button>
					<Button
						className="min-h-[36px] min-w-[36px] font-mono text-xs sm:min-h-0 sm:min-w-0"
						onClick={() => duplicateMutation.mutate({ id: strategyId })}
						size={isMobile ? "icon" : "sm"}
						variant="outline"
					>
						<Copy className="h-3.5 w-3.5 sm:mr-2 sm:h-3 sm:w-3" />
						<span className="hidden sm:inline">Duplicate</span>
					</Button>
					<AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
						<AlertDialogTrigger asChild>
							<Button
								className="min-h-[36px] min-w-[36px] sm:h-8 sm:min-h-0 sm:w-8 sm:min-w-0"
								size="icon"
								variant="ghost"
							>
								<Trash2 className="h-4 w-4 text-muted-foreground transition-colors hover:text-loss" />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent className="mx-4 border-border bg-background sm:mx-0">
							<AlertDialogHeader>
								<AlertDialogTitle className="font-mono text-sm uppercase tracking-wider sm:text-base">
									Delete Strategy
								</AlertDialogTitle>
								<AlertDialogDescription className="font-mono text-xs">
									Are you sure you want to delete &quot;{strategy.name}&quot;?
									This action cannot be undone. The strategy will be removed
									from all associated trades.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
								<AlertDialogCancel className="min-h-[44px] font-mono text-xs sm:min-h-0">
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									className="min-h-[44px] bg-loss font-mono text-xs hover:bg-loss/90 sm:min-h-0"
									disabled={deleteMutation.isPending}
									onClick={(e) => {
										e.preventDefault();
										deleteMutation.mutate({ id: strategyId });
									}}
								>
									{deleteMutation.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>

			{/* Stats summary */}
			{stats && stats.totalTrades > 0 && (
				<div
					className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
					data-testid="strategy-detail-stats"
				>
					<div
						className="rounded border border-white/5 bg-white/2 p-3 sm:p-4"
						style={{ borderTopColor: `${strategyColor}30`, borderTopWidth: 2 }}
					>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Trades
						</div>
						<div className="mt-1 font-bold font-mono text-lg sm:text-2xl">
							{stats.totalTrades}
						</div>
					</div>
					<div
						className="rounded border border-white/5 bg-white/2 p-3 sm:p-4"
						style={{ borderTopColor: `${strategyColor}30`, borderTopWidth: 2 }}
					>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Win Rate
						</div>
						<div
							className={cn(
								"mt-1 font-bold font-mono text-lg sm:text-2xl",
								stats.winRate >= 50 ? "text-profit" : "text-loss",
							)}
						>
							{stats.winRate.toFixed(0)}%
						</div>
					</div>
					<div
						className="rounded border border-white/5 bg-white/2 p-3 sm:p-4"
						style={{ borderTopColor: `${strategyColor}30`, borderTopWidth: 2 }}
					>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Total P&L
						</div>
						<div
							className={cn(
								"mt-1 font-bold font-mono text-lg sm:text-2xl",
								stats.totalPnl >= 0 ? "text-profit" : "text-loss",
							)}
						>
							{stats.totalPnl >= 0 ? "+" : ""}$
							{Math.abs(stats.totalPnl).toLocaleString("en-US", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</div>
					</div>
					<div
						className="rounded border border-white/5 bg-white/2 p-3 sm:p-4"
						style={{ borderTopColor: `${strategyColor}30`, borderTopWidth: 2 }}
					>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Profit Factor
						</div>
						<div
							className={cn(
								"mt-1 font-bold font-mono text-lg sm:text-2xl",
								stats.profitFactor >= 1 ? "text-profit" : "text-loss",
							)}
						>
							{stats.profitFactor.toFixed(2)}
						</div>
					</div>
				</div>
			)}

			{/* Marketplace Section */}
			<MarketplaceSection
				cachedStats={
					strategy.cachedStats
						? (JSON.parse(strategy.cachedStats) as {
								totalTrades?: number;
								winRate?: number;
								profitFactor?: number | null;
								avgR?: number;
							})
						: null
				}
				categoryTags={strategy.categoryTags}
				instruments={strategy.instruments}
				isAnonymous={strategy.isAnonymous}
				isPublic={strategy.isPublic ?? false}
				strategyColor={strategyColor}
				strategyId={strategyId}
				strategyName={strategy.name}
				tradeCount={stats?.totalTrades ?? 0}
			/>

			{/* Form */}
			<div
				className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
				data-testid="strategy-detail-form"
			>
				<StrategyForm
					initialData={{
						name: strategy.name,
						description: strategy.description ?? "",
						color: strategy.color ?? "#d4ff00",
						entryCriteria: strategy.entryCriteria ?? "",
						exitRules: strategy.exitRules ?? "",
						riskParameters: strategy.riskParameters,
						scalingRules: strategy.scalingRules,
						trailingRules: strategy.trailingRules,
						isActive: strategy.isActive ?? true,
						rules: formRules,
					}}
					isSubmitting={updateMutation.isPending}
					onSubmit={handleSubmit}
					submitLabel="Save Changes"
				/>
			</div>
		</div>
	);
}
