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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MarketplaceSection } from "@/components/strategy";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface RiskParameters {
	positionSizing?: {
		method: "fixed" | "risk_percent" | "kelly";
		fixedSize?: number;
		riskPercent?: number;
		kellyFraction?: number;
	};
	maxRiskPerTrade?: {
		type: "dollars" | "percent";
		value: number;
	};
	dailyLossLimit?: {
		type: "dollars" | "percent";
		value: number;
	};
	maxConcurrentPositions?: number;
	minRiskRewardRatio?: number;
}

interface StrategyRule {
	id: string;
	text: string;
	category: string;
	order: number;
}

// =============================================================================
// RULES DISPLAY COMPONENT
// =============================================================================

function RulesDisplay({ rules }: { rules: StrategyRule[] }) {
	// Group rules by category
	const groupedRules = rules.reduce(
		(acc, rule) => {
			const category = rule.category;
			if (!acc[category]) {
				acc[category] = [];
			}
			acc[category].push(rule);
			return acc;
		},
		{} as Record<string, StrategyRule[]>,
	);

	const categoryLabels: Record<string, string> = {
		entry: "Entry Rules",
		exit: "Exit Rules",
		risk: "Risk Rules",
		management: "Management Rules",
	};

	const categoryOrder = ["entry", "exit", "risk", "management"];

	if (rules.length === 0) {
		return (
			<p className="font-mono text-muted-foreground text-sm italic">
				No rules defined
			</p>
		);
	}

	return (
		<div className="space-y-4">
			{categoryOrder.map((category) => {
				const categoryRules = groupedRules[category];
				if (!categoryRules || categoryRules.length === 0) return null;

				return (
					<div key={category}>
						<h4 className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wider">
							{categoryLabels[category] ?? category}
						</h4>
						<ul className="space-y-1.5">
							{categoryRules
								.sort((a, b) => a.order - b.order)
								.map((rule) => (
									<li
										className="flex items-start gap-2 font-mono text-sm"
										key={rule.id}
									>
										<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
										<span>{rule.text}</span>
									</li>
								))}
						</ul>
					</div>
				);
			})}
		</div>
	);
}

// =============================================================================
// RISK PARAMETERS DISPLAY
// =============================================================================

function RiskParametersDisplay({
	riskParameters,
}: {
	riskParameters: RiskParameters | null;
}) {
	if (!riskParameters) {
		return (
			<p className="font-mono text-muted-foreground text-sm italic">
				No risk parameters defined
			</p>
		);
	}

	const items: Array<{ label: string; value: string }> = [];

	// Position sizing
	if (riskParameters.positionSizing) {
		const ps = riskParameters.positionSizing;
		if (ps.method === "fixed" && ps.fixedSize !== undefined) {
			items.push({
				label: "Position Size",
				value: `${ps.fixedSize} contracts`,
			});
		} else if (ps.method === "risk_percent" && ps.riskPercent !== undefined) {
			items.push({
				label: "Position Sizing",
				value: `${ps.riskPercent}% of account risk`,
			});
		} else if (ps.method === "kelly" && ps.kellyFraction !== undefined) {
			items.push({
				label: "Position Sizing",
				value: `Kelly criterion (${ps.kellyFraction}x)`,
			});
		}
	}

	// Max risk per trade
	if (riskParameters.maxRiskPerTrade) {
		const mr = riskParameters.maxRiskPerTrade;
		items.push({
			label: "Max Risk/Trade",
			value: mr.type === "dollars" ? `$${mr.value}` : `${mr.value}%`,
		});
	}

	// Daily loss limit
	if (riskParameters.dailyLossLimit) {
		const dl = riskParameters.dailyLossLimit;
		items.push({
			label: "Daily Loss Limit",
			value: dl.type === "dollars" ? `$${dl.value}` : `${dl.value}%`,
		});
	}

	// Max concurrent positions
	if (riskParameters.maxConcurrentPositions !== undefined) {
		items.push({
			label: "Max Positions",
			value: `${riskParameters.maxConcurrentPositions}`,
		});
	}

	// Min R:R ratio
	if (riskParameters.minRiskRewardRatio !== undefined) {
		items.push({
			label: "Min R:R Ratio",
			value: `${riskParameters.minRiskRewardRatio}:1`,
		});
	}

	if (items.length === 0) {
		return (
			<p className="font-mono text-muted-foreground text-sm italic">
				No risk parameters defined
			</p>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{items.map((item) => (
				<div key={item.label}>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						{item.label}
					</div>
					<div className="mt-0.5 font-mono text-sm">{item.value}</div>
				</div>
			))}
		</div>
	);
}

export default function StrategyDetailPage() {
	const params = useParams();
	const router = useRouter();
	const strategyId = params.id as string;
	const isMobile = useIsMobile();

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [duplicateOpen, setDuplicateOpen] = useState(false);
	const [duplicateName, setDuplicateName] = useState("");

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
			setDuplicateOpen(false);
			toast.success("Strategy duplicated");
			utils.strategies.getAll.invalidate();
			router.push(`/strategies/${newStrategy.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to duplicate strategy");
		},
	});

	// Initialize duplicate name when strategy loads or dialog opens
	useEffect(() => {
		if (strategy?.name && duplicateOpen) {
			setDuplicateName(`${strategy.name} (Copy)`);
		}
	}, [strategy?.name, duplicateOpen]);

	// Loading state
	if (isLoading) {
		return (
			<div
				className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-6 sm:py-6"
				data-testid="strategy-detail-loading"
			>
				{/* Hero banner skeleton */}
				<Skeleton className="aspect-3/1 w-full rounded-lg" />
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

	const strategyColor = strategy.color ?? "#d4ff00";

	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-8 sm:py-6"
			data-testid="strategy-detail-page"
		>
			{/* Hero Banner with Cover Image */}
			<div
				className="relative aspect-3/1 w-full overflow-hidden rounded-lg"
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
						unoptimized
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
				<div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/30 to-transparent" />
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
						data-testid="strategy-detail-duplicate-button"
						onClick={() => setDuplicateOpen(true)}
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

			{/* Duplicate Strategy Dialog */}
			<Dialog onOpenChange={setDuplicateOpen} open={duplicateOpen}>
				<DialogContent
					className="mx-4 border-border bg-background sm:mx-0 sm:max-w-md"
					data-testid="strategy-duplicate-dialog"
				>
					<DialogHeader>
						<DialogTitle className="font-mono text-sm uppercase tracking-wider sm:text-base">
							Duplicate Strategy
						</DialogTitle>
						<DialogDescription className="font-mono text-muted-foreground text-xs">
							Create a copy of this strategy with a new name. The copy will
							include all rules and risk parameters.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<label
							className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="duplicate-name"
						>
							Strategy Name
						</label>
						<Input
							autoFocus
							className="mt-2 font-mono"
							data-testid="strategy-duplicate-name-input"
							id="duplicate-name"
							onChange={(e) => setDuplicateName(e.target.value)}
							onKeyDown={(e) => {
								if (
									e.key === "Enter" &&
									duplicateName.trim() &&
									!duplicateMutation.isPending
								) {
									duplicateMutation.mutate({
										id: strategyId,
										name: duplicateName.trim(),
									});
								}
							}}
							placeholder="Enter strategy name"
							value={duplicateName}
						/>
					</div>
					<DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
						<Button
							className="min-h-[44px] font-mono text-xs sm:min-h-0"
							onClick={() => setDuplicateOpen(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							className="min-h-[44px] font-mono text-xs sm:min-h-0"
							data-testid="strategy-duplicate-confirm-button"
							disabled={!duplicateName.trim() || duplicateMutation.isPending}
							onClick={() => {
								duplicateMutation.mutate({
									id: strategyId,
									name: duplicateName.trim(),
								});
							}}
							style={{
								backgroundColor: strategyColor,
								color: "#050505",
							}}
						>
							{duplicateMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Duplicate
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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

			{/* Overview Section */}
			{strategy.description && (
				<div
					className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="strategy-detail-overview"
				>
					<h2 className="mb-3 font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Description
					</h2>
					<p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
						{strategy.description}
					</p>
				</div>
			)}

			{/* Instrument and Category badges */}
			{((strategy.instruments && strategy.instruments.length > 0) ||
				(strategy.categoryTags && strategy.categoryTags.length > 0)) && (
				<div
					className="flex flex-wrap gap-2"
					data-testid="strategy-detail-badges"
				>
					{strategy.instruments?.map((instrument) => (
						<span
							className="rounded bg-primary/10 px-2 py-1 font-mono text-primary text-xs"
							key={instrument}
						>
							{instrument}
						</span>
					))}
					{strategy.categoryTags?.map((category) => (
						<span
							className="rounded bg-accent/10 px-2 py-1 font-mono text-accent text-xs"
							key={category}
						>
							{category}
						</span>
					))}
				</div>
			)}

			{/* Strategy Rules */}
			{strategy.rules && strategy.rules.length > 0 && (
				<div
					className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="strategy-detail-rules"
				>
					<h2 className="mb-4 font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Strategy Rules
					</h2>
					<RulesDisplay rules={strategy.rules as StrategyRule[]} />
				</div>
			)}

			{/* Risk Parameters */}
			{strategy.riskParameters && (
				<div
					className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="strategy-detail-risk-parameters"
				>
					<h2 className="mb-4 font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Risk Management
					</h2>
					<RiskParametersDisplay
						riskParameters={strategy.riskParameters as RiskParameters}
					/>
				</div>
			)}

			{/* Legacy Entry/Exit Criteria (if present) */}
			{(strategy.entryCriteria || strategy.exitRules) && (
				<div
					className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="strategy-detail-legacy-rules"
				>
					{strategy.entryCriteria && (
						<div className="mb-4">
							<h3 className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wider">
								Entry Criteria
							</h3>
							<p className="whitespace-pre-wrap font-mono text-sm">
								{strategy.entryCriteria}
							</p>
						</div>
					)}
					{strategy.exitRules && (
						<div>
							<h3 className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wider">
								Exit Rules
							</h3>
							<p className="whitespace-pre-wrap font-mono text-sm">
								{strategy.exitRules}
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
