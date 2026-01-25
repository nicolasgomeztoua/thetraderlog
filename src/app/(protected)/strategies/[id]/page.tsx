"use client";

import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle,
	ClipboardCheck,
	Copy,
	Edit,
	Loader2,
	MoreVertical,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { RULE_CATEGORIES } from "@/lib/constants";
import { cn, formatCurrency, getPnLColorClass } from "@/lib/shared";
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

	const { data: ruleCompliance } = api.strategies.getRuleCompliance.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId && !!strategy },
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
			toast.success("Strategy duplicated");
			utils.strategies.getAll.invalidate();
			router.push(`/strategies/${newStrategy.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to duplicate strategy");
		},
	});

	// Loading state
	if (isLoading) {
		return (
			<div
				className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-6 sm:py-6"
				data-testid="strategy-detail-loading"
			>
				<div className="flex items-center gap-3">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-8 w-48" />
				</div>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
					{["stat-1", "stat-2", "stat-3", "stat-4", "stat-5"].map((key) => (
						<Skeleton className="h-24" key={key} />
					))}
				</div>
				<Skeleton className="h-48" />
				<Skeleton className="h-64" />
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
				<h2 className="font-semibold text-lg sm:text-xl">Strategy not found</h2>
				<p className="mb-4 text-center text-muted-foreground text-sm sm:text-base">
					This strategy doesn&apos;t exist or you don&apos;t have access.
				</p>
				<Button asChild className="min-h-[44px]">
					<Link href="/strategies">Back to Strategies</Link>
				</Button>
			</div>
		);
	}

	// Group rules by category
	const rulesByCategory = RULE_CATEGORIES.map((category) => ({
		category: category.value,
		label: category.label,
		rules: strategy.rules.filter((rule) => rule.category === category.value),
	})).filter((group) => group.rules.length > 0);

	// Format helpers
	const formatProfitFactor = (pf: number | null | undefined) => {
		if (pf === null || pf === undefined) return "—";
		if (!Number.isFinite(pf)) return "∞";
		return pf.toFixed(2);
	};

	const formatWinRate = (wr: number | null | undefined) => {
		if (wr === null || wr === undefined) return "—";
		return `${wr.toFixed(0)}%`;
	};

	const getWinRateColorClass = (wr: number | null | undefined) => {
		if (wr === null || wr === undefined) return "text-muted-foreground";
		return wr >= 50 ? "text-profit" : "text-loss";
	};

	const getProfitFactorColorClass = (pf: number | null | undefined) => {
		if (pf === null || pf === undefined) return "text-muted-foreground";
		if (!Number.isFinite(pf)) return "text-profit";
		return pf >= 1 ? "text-profit" : "text-loss";
	};

	// Calculate average R
	const avgR =
		stats?.avgLoss && stats.avgLoss !== 0
			? (stats.avgPnl ?? 0) / Math.abs(stats.avgLoss)
			: null;

	const formatAvgR = (r: number | null) => {
		if (r === null) return "—";
		const sign = r >= 0 ? "+" : "";
		return `${sign}${r.toFixed(2)}R`;
	};

	const getAvgRColorClass = (r: number | null) => {
		if (r === null) return "text-muted-foreground";
		return r >= 0 ? "text-profit" : "text-loss";
	};

	// Risk parameters helpers
	const riskParams = strategy.riskParameters;

	const formatRiskValue = (
		value: { type: string; value: number } | undefined,
	) => {
		if (!value) return null;
		return value.type === "dollars"
			? `$${value.value.toLocaleString()}`
			: `${value.value}%`;
	};

	// Get compliance color class
	const getComplianceColorClass = (compliance: number) => {
		if (compliance >= 80) return "text-profit";
		if (compliance >= 50) return "text-breakeven";
		return "text-loss";
	};

	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-6 py-4 sm:space-y-8 sm:py-6"
			data-testid="strategy-detail-page"
		>
			{/* Header */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2 sm:gap-3">
					<Button
						asChild
						className="min-h-[44px] min-w-[44px] shrink-0 sm:h-8 sm:min-h-0 sm:w-8 sm:min-w-0"
						data-testid="strategy-detail-button-back"
						size="icon"
						variant="ghost"
					>
						<Link href="/strategies">
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div className="flex min-w-0 items-center gap-2 sm:gap-3">
						<div
							className="h-3 w-3 shrink-0 rounded sm:h-4 sm:w-4"
							data-testid="strategy-detail-color"
							style={{ backgroundColor: strategy.color ?? "#d4ff00" }}
						/>
						<h1
							className="truncate font-bold text-lg tracking-tight sm:text-2xl"
							data-testid="strategy-detail-heading"
						>
							{strategy.name}
						</h1>
						{!strategy.isActive && (
							<span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Inactive
							</span>
						)}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-1 sm:gap-2">
					{/* Edit Button */}
					<Button
						asChild
						className="min-h-[36px] min-w-[36px] font-mono text-xs sm:min-h-0 sm:min-w-0"
						data-testid="strategy-detail-button-edit"
						size={isMobile ? "icon" : "sm"}
						variant="outline"
					>
						<Link href={`/strategies/${strategyId}/edit`}>
							<Edit className="h-3.5 w-3.5 sm:mr-2 sm:h-3 sm:w-3" />
							<span className="hidden sm:inline">Edit</span>
						</Link>
					</Button>

					{/* Actions Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								className="min-h-[36px] min-w-[36px] sm:h-8 sm:min-h-0 sm:w-8 sm:min-w-0"
								data-testid="strategy-detail-button-actions"
								size="icon"
								variant="ghost"
							>
								<MoreVertical className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="border-white/10 bg-background"
						>
							<DropdownMenuItem
								className="gap-2 font-mono text-xs"
								data-testid="strategy-detail-action-duplicate"
								onClick={() => duplicateMutation.mutate({ id: strategyId })}
							>
								<Copy className="h-3.5 w-3.5" />
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuItem
								className="gap-2 font-mono text-loss text-xs focus:text-loss"
								data-testid="strategy-detail-action-delete"
								onClick={() => setDeleteOpen(true)}
							>
								<Trash2 className="h-3.5 w-3.5" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Description */}
			{strategy.description && (
				<p
					className="font-mono text-muted-foreground text-sm"
					data-testid="strategy-detail-description"
				>
					{strategy.description}
				</p>
			)}

			{/* Stats Row */}
			<div
				className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4"
				data-testid="strategy-detail-stats"
			>
				<StatCard
					colorClass={getWinRateColorClass(stats?.winRate)}
					label="Win Rate"
					value={formatWinRate(stats?.winRate)}
				/>
				<StatCard
					colorClass={getPnLColorClass(stats?.totalPnl ?? 0)}
					label="Total P&L"
					value={
						stats?.totalPnl !== null && stats?.totalPnl !== undefined
							? formatCurrency(stats.totalPnl)
							: "—"
					}
				/>
				<StatCard
					colorClass={getProfitFactorColorClass(stats?.profitFactor)}
					label="Profit Factor"
					value={formatProfitFactor(stats?.profitFactor)}
				/>
				<StatCard
					colorClass="text-foreground"
					label="Trades"
					value={stats?.totalTrades?.toString() ?? "0"}
				/>
				<StatCard
					colorClass={getAvgRColorClass(avgR)}
					label="Avg R"
					value={formatAvgR(avgR)}
				/>
			</div>

			{/* Compliance Section */}
			{ruleCompliance &&
				(ruleCompliance.totalTrades > 0 || strategy.rules.length > 0) && (
					<div
						className="space-y-4 rounded border border-white/5 bg-white/2 p-4 sm:p-6"
						data-testid="strategy-detail-compliance"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
									<ClipboardCheck className="h-3.5 w-3.5 text-primary" />
								</div>
								<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
									Rule Compliance
								</h2>
							</div>
							{ruleCompliance.totalTrades > 0 && (
								<div className="flex items-center gap-2">
									<span className="font-mono text-[10px] text-muted-foreground uppercase">
										Overall
									</span>
									<span
										className={cn(
											"font-bold font-mono text-lg",
											getComplianceColorClass(ruleCompliance.avgCompliance),
										)}
									>
										{ruleCompliance.avgCompliance.toFixed(0)}%
									</span>
								</div>
							)}
						</div>

						{/* Per-rule breakdown */}
						{ruleCompliance.ruleCompliance.length > 0 ? (
							<div className="space-y-2">
								{ruleCompliance.ruleCompliance.map((rule) => (
									<div
										className="flex items-center justify-between rounded bg-white/2 px-3 py-2"
										key={rule.ruleId}
									>
										<div className="flex items-center gap-2">
											<span
												className={cn(
													"h-1.5 w-1.5 rounded-full",
													rule.compliance >= 80
														? "bg-profit"
														: rule.compliance >= 50
															? "bg-breakeven"
															: "bg-loss",
												)}
											/>
											<span className="font-mono text-xs">{rule.ruleText}</span>
											<span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground uppercase">
												{rule.category}
											</span>
										</div>
										<span
											className={cn(
												"font-bold font-mono text-sm",
												getComplianceColorClass(rule.compliance),
											)}
										>
											{rule.compliance.toFixed(0)}%
										</span>
									</div>
								))}
							</div>
						) : (
							<p className="font-mono text-muted-foreground/60 text-sm italic">
								No trades to analyze compliance yet
							</p>
						)}
					</div>
				)}

			{/* Risk Parameters Section */}
			{riskParams && Object.keys(riskParams).length > 0 && (
				<div
					className="space-y-4 rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="strategy-detail-risk-params"
				>
					<div className="flex items-center gap-2">
						<div className="flex h-6 w-6 items-center justify-center rounded-full bg-profit/20">
							<CheckCircle className="h-3.5 w-3.5 text-profit" />
						</div>
						<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
							Risk Parameters
						</h2>
						<span className="rounded bg-profit/10 px-2 py-0.5 font-mono text-[9px] text-profit uppercase tracking-wider">
							Auto-Checked
						</span>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						{riskParams.minRRRatio !== undefined && (
							<RiskParamItem
								label="Min R:R Ratio"
								value={`${riskParams.minRRRatio}R`}
							/>
						)}
						{riskParams.maxRiskPerTrade && (
							<RiskParamItem
								label="Max Risk Per Trade"
								value={formatRiskValue(riskParams.maxRiskPerTrade) ?? ""}
							/>
						)}
						{riskParams.dailyLossLimit && (
							<RiskParamItem
								label="Daily Loss Limit"
								value={formatRiskValue(riskParams.dailyLossLimit) ?? ""}
							/>
						)}
						{riskParams.maxConcurrentPositions !== undefined && (
							<RiskParamItem
								label="Max Concurrent Positions"
								value={riskParams.maxConcurrentPositions.toString()}
							/>
						)}
						{riskParams.targetRMultiples &&
							riskParams.targetRMultiples.length > 0 && (
								<RiskParamItem
									label="Target R Multiples"
									value={riskParams.targetRMultiples
										.map((r: number) => `${r}R`)
										.join(", ")}
								/>
							)}
					</div>
				</div>
			)}

			{/* Rules Section */}
			{rulesByCategory.length > 0 && (
				<div
					className="space-y-4 rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="strategy-detail-rules"
				>
					<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
						Trading Rules
					</h2>

					<div className="space-y-4">
						{rulesByCategory.map((group) => (
							<div key={group.category}>
								<h3 className="mb-2 font-mono text-[10px] text-primary uppercase tracking-wider">
									{group.label}
								</h3>
								<ul className="space-y-1">
									{group.rules.map((rule) => (
										<li
											className="flex items-start gap-2 rounded bg-white/2 px-3 py-2"
											key={rule.id}
										>
											<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
											<span className="font-mono text-sm">{rule.text}</span>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Entry/Exit Criteria */}
			{(strategy.entryCriteria || strategy.exitRules) && (
				<div
					className="grid gap-4 sm:grid-cols-2"
					data-testid="strategy-detail-criteria"
				>
					{strategy.entryCriteria && (
						<div className="space-y-2 rounded border border-white/5 bg-white/2 p-4 sm:p-6">
							<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
								Entry Criteria
							</h2>
							<p className="whitespace-pre-wrap font-mono text-sm">
								{strategy.entryCriteria}
							</p>
						</div>
					)}
					{strategy.exitRules && (
						<div className="space-y-2 rounded border border-white/5 bg-white/2 p-4 sm:p-6">
							<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
								Exit Rules
							</h2>
							<p className="whitespace-pre-wrap font-mono text-sm">
								{strategy.exitRules}
							</p>
						</div>
					)}
				</div>
			)}

			{/* Delete Confirmation Dialog */}
			<AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
				<AlertDialogContent className="mx-4 border-border bg-background sm:mx-0">
					<AlertDialogHeader>
						<AlertDialogTitle className="font-mono text-sm uppercase tracking-wider sm:text-base">
							Delete Strategy
						</AlertDialogTitle>
						<AlertDialogDescription className="font-mono text-xs">
							Are you sure you want to delete &quot;{strategy.name}&quot;? This
							action cannot be undone. The strategy will be removed from all
							associated trades.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
						<AlertDialogCancel className="min-h-[44px] font-mono text-xs sm:min-h-0">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="min-h-[44px] bg-loss font-mono text-xs hover:bg-loss/90 sm:min-h-0"
							data-testid="strategy-detail-button-delete-confirm"
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
	);
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StatCardProps {
	label: string;
	value: string;
	colorClass: string;
}

function StatCard({ colorClass, label, value }: StatCardProps) {
	return (
		<div className="rounded border border-white/5 bg-white/2 p-3 sm:p-4">
			<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
				{label}
			</div>
			<div
				className={cn(
					"mt-1 font-bold font-mono text-lg sm:text-2xl",
					colorClass,
				)}
			>
				{value}
			</div>
		</div>
	);
}

interface RiskParamItemProps {
	label: string;
	value: string;
}

function RiskParamItem({ label, value }: RiskParamItemProps) {
	return (
		<div className="flex items-center justify-between rounded bg-white/2 px-3 py-2">
			<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</span>
			<span className="font-bold font-mono text-sm">{value}</span>
		</div>
	);
}
