"use client";

import {
	AlertCircle,
	Check,
	CheckCircle2,
	Circle,
	ClipboardCheck,
	Minus,
	X,
} from "lucide-react";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/shared";
import {
	calculateRiskCompliance,
	type RiskParameters,
	type TradeForCompliance,
} from "@/lib/strategies/risk-compliance";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface ComplianceDisplayProps {
	/** Strategy ID to fetch compliance data for */
	strategyId: string;
	/** Optional class name */
	className?: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Get compliance color class based on percentage thresholds:
 * - Green (profit) for >= 80%
 * - Yellow (breakeven) for >= 50%
 * - Red (loss) for < 50%
 */
function getComplianceColorClass(compliance: number): string {
	if (compliance >= 80) return "text-profit";
	if (compliance >= 50) return "text-breakeven";
	return "text-loss";
}

/**
 * Get background color class for compliance based on thresholds
 */
function getComplianceBgClass(compliance: number): string {
	if (compliance >= 80) return "bg-profit/10";
	if (compliance >= 50) return "bg-breakeven/10";
	return "bg-loss/10";
}

/**
 * Single rule compliance item in the breakdown
 */
function RuleComplianceItem({
	category,
	checkedCount,
	compliance,
	ruleText,
	totalTrades,
}: {
	ruleText: string;
	category: string;
	checkedCount: number;
	totalTrades: number;
	compliance: number;
}) {
	const categoryLabels: Record<string, string> = {
		entry: "Entry",
		exit: "Exit",
		risk: "Risk",
		management: "Management",
	};

	return (
		<div className="flex items-center justify-between gap-3 rounded-sm bg-white/2 px-2.5 py-1.5">
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary uppercase tracking-wider">
					{categoryLabels[category] ?? category}
				</span>
				<span className="truncate font-mono text-[11px] text-muted-foreground">
					{ruleText}
				</span>
			</div>
			<div className="flex items-center gap-2">
				<span className="font-mono text-[10px] text-muted-foreground/50 tabular-nums">
					{checkedCount}/{totalTrades}
				</span>
				<span
					className={cn(
						"font-mono text-[11px] tabular-nums",
						getComplianceColorClass(compliance),
					)}
				>
					{compliance.toFixed(0)}%
				</span>
			</div>
		</div>
	);
}

/**
 * Overall compliance badge with icon
 */
function OverallComplianceBadge({
	compliance,
	label,
}: {
	compliance: number;
	label: string;
}) {
	const isGood = compliance >= 80;

	return (
		<div
			className={cn(
				"inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] uppercase tracking-wider",
				getComplianceBgClass(compliance),
				getComplianceColorClass(compliance),
			)}
		>
			{isGood ? (
				<CheckCircle2 className="h-3.5 w-3.5" />
			) : (
				<Circle className="h-3.5 w-3.5" />
			)}
			<span>
				{label}: {compliance.toFixed(0)}%
			</span>
		</div>
	);
}

/**
 * Section header with icon
 */
function SectionHeader({
	children,
	icon: Icon,
}: {
	children: React.ReactNode;
	icon: React.ComponentType<{ className?: string }>;
}) {
	return (
		<div className="flex items-center gap-2">
			<div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/5">
				<Icon className="h-3 w-3 text-muted-foreground" />
			</div>
			<span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
				{children}
			</span>
		</div>
	);
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function ComplianceDisplaySkeleton() {
	return (
		<div
			className="space-y-4 rounded border border-white/5 bg-white/1 p-4"
			data-testid="compliance-display-loading"
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-6 w-24" />
			</div>

			{/* Manual rules section */}
			<div className="space-y-2">
				<Skeleton className="h-4 w-28" />
				<div className="space-y-1.5">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
				</div>
			</div>

			{/* Auto checks section */}
			<div className="space-y-2">
				<Skeleton className="h-4 w-24" />
				<div className="space-y-1.5">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Combined compliance display showing both manual and auto-compliance stats.
 * Shows overall compliance %, manual rules breakdown, and auto-checks breakdown.
 */
export function ComplianceDisplay({
	strategyId,
	className,
}: ComplianceDisplayProps) {
	// Fetch manual compliance via strategies.getRuleCompliance
	const { data: ruleCompliance, isLoading: isLoadingRuleCompliance } =
		api.strategies.getRuleCompliance.useQuery({ id: strategyId });

	// Fetch strategy for risk parameters (for auto-compliance)
	const { data: strategy, isLoading: isLoadingStrategy } =
		api.strategies.getById.useQuery({ id: strategyId });

	// Fetch trades for auto-compliance calculation
	const { data: tradesData, isLoading: isLoadingTrades } =
		api.trades.getAll.useQuery(
			{ strategyId, status: "closed" },
			{ enabled: !!strategyId },
		);

	const isLoading =
		isLoadingRuleCompliance || isLoadingStrategy || isLoadingTrades;

	// Calculate auto-compliance from trades
	const autoComplianceData = useMemo(() => {
		if (!strategy?.riskParameters || !tradesData?.items) {
			return null;
		}

		const riskParams: RiskParameters = {
			minRRRatio: strategy.riskParameters.minRRRatio ?? null,
			maxRiskPerTrade: strategy.riskParameters.maxRiskPerTrade ?? null,
			dailyLossLimit: strategy.riskParameters.dailyLossLimit ?? null,
			maxConcurrentPositions:
				strategy.riskParameters.maxConcurrentPositions ?? null,
			targetRMultiples: strategy.riskParameters.targetRMultiples ?? null,
		};

		// Check if any risk parameters are configured
		const hasRiskParams =
			riskParams.minRRRatio !== null ||
			riskParams.maxRiskPerTrade !== null ||
			(riskParams.targetRMultiples !== null &&
				riskParams.targetRMultiples.length > 0);

		if (!hasRiskParams) {
			return null;
		}

		// Calculate compliance for each trade
		const tradeResults = tradesData.items.map((trade) => {
			const tradeForCompliance: TradeForCompliance = {
				id: trade.id,
				symbol: trade.symbol,
				instrumentType: trade.instrumentType,
				direction: trade.direction,
				entryPrice: parseFloat(trade.entryPrice),
				exitPrice: trade.exitPrice ? parseFloat(trade.exitPrice) : null,
				stopLoss: trade.stopLoss ? parseFloat(trade.stopLoss) : null,
				takeProfit: trade.takeProfit ? parseFloat(trade.takeProfit) : null,
				quantity: parseFloat(trade.quantity),
				realizedPnl: trade.netPnl ? parseFloat(trade.netPnl) : null,
				entryTime: trade.entryTime,
				exitTime: trade.exitTime,
			};

			return calculateRiskCompliance(tradeForCompliance, riskParams);
		});

		// Aggregate per-parameter compliance
		const paramAggregates: Record<
			string,
			{ passed: number; failed: number; unable: number }
		> = {};

		for (const result of tradeResults) {
			for (const check of result.checks) {
				let agg = paramAggregates[check.param];
				if (!agg) {
					agg = { passed: 0, failed: 0, unable: 0 };
					paramAggregates[check.param] = agg;
				}
				if (check.passed === null) {
					agg.unable++;
				} else if (check.passed) {
					agg.passed++;
				} else {
					agg.failed++;
				}
			}
		}

		// Calculate overall auto compliance
		const autoChecks = Object.entries(paramAggregates).map(([param, agg]) => {
			const total = agg.passed + agg.failed;
			const compliance = total > 0 ? (agg.passed / total) * 100 : 100;
			return {
				param,
				passed: agg.passed,
				failed: agg.failed,
				unable: agg.unable,
				total,
				compliance,
			};
		});

		const totalPassed = autoChecks.reduce((sum, c) => sum + c.passed, 0);
		const totalChecked = autoChecks.reduce((sum, c) => sum + c.total, 0);
		const overallCompliance =
			totalChecked > 0 ? (totalPassed / totalChecked) * 100 : 100;

		return {
			checks: autoChecks,
			overallCompliance,
			tradeCount: tradesData.items.length,
		};
	}, [strategy, tradesData]);

	// Calculate weighted overall compliance (manual + auto)
	const overallCompliance = useMemo(() => {
		const hasManual =
			ruleCompliance?.ruleCompliance &&
			ruleCompliance.ruleCompliance.length > 0;
		const hasAuto = autoComplianceData && autoComplianceData.checks.length > 0;

		if (!hasManual && !hasAuto) {
			return null;
		}

		// Weighted average: manual compliance weighted by rule count, auto weighted by check count
		let totalWeight = 0;
		let weightedSum = 0;

		if (hasManual && ruleCompliance) {
			const manualWeight = ruleCompliance.ruleCompliance.length;
			weightedSum += ruleCompliance.avgCompliance * manualWeight;
			totalWeight += manualWeight;
		}

		if (hasAuto && autoComplianceData) {
			const autoWeight = autoComplianceData.checks.length;
			weightedSum += autoComplianceData.overallCompliance * autoWeight;
			totalWeight += autoWeight;
		}

		return totalWeight > 0 ? weightedSum / totalWeight : null;
	}, [ruleCompliance, autoComplianceData]);

	// Loading state
	if (isLoading) {
		return <ComplianceDisplaySkeleton />;
	}

	// No compliance data at all
	const hasManualRules =
		ruleCompliance?.ruleCompliance && ruleCompliance.ruleCompliance.length > 0;
	const hasAutoChecks =
		autoComplianceData && autoComplianceData.checks.length > 0;

	if (!hasManualRules && !hasAutoChecks) {
		return (
			<div
				className={cn(
					"rounded border border-white/5 bg-white/1 p-4",
					className,
				)}
				data-testid="compliance-display"
			>
				<div className="flex items-center gap-2">
					<AlertCircle className="h-4 w-4 text-muted-foreground/50" />
					<span className="font-mono text-[11px] text-muted-foreground">
						No compliance rules configured
					</span>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn("rounded border border-white/5 bg-white/1 p-4", className)}
			data-testid="compliance-display"
		>
			{/* Header with overall compliance */}
			<div
				className="flex flex-wrap items-center justify-between gap-2"
				data-testid="compliance-display-header"
			>
				<span className="font-mono text-[11px] text-muted-foreground/80 uppercase tracking-widest">
					Strategy Compliance
				</span>
				{overallCompliance !== null && (
					<OverallComplianceBadge
						compliance={overallCompliance}
						label="Overall"
					/>
				)}
			</div>

			<div className="mt-4 space-y-4">
				{/* Manual Rules Section */}
				{hasManualRules && ruleCompliance && (
					<div
						className="space-y-2"
						data-testid="compliance-display-manual-rules"
					>
						<div className="flex items-center justify-between">
							<SectionHeader icon={ClipboardCheck}>Manual Rules</SectionHeader>
							<span
								className={cn(
									"font-mono text-[10px] tabular-nums",
									getComplianceColorClass(ruleCompliance.avgCompliance),
								)}
							>
								{ruleCompliance.avgCompliance.toFixed(0)}% avg
							</span>
						</div>
						<div className="space-y-1.5">
							{ruleCompliance.ruleCompliance.map((rule) => (
								<RuleComplianceItem
									category={rule.category}
									checkedCount={rule.checkedCount}
									compliance={rule.compliance}
									key={rule.ruleId}
									ruleText={rule.ruleText}
									totalTrades={rule.totalTrades}
								/>
							))}
						</div>
						<div className="text-right font-mono text-[10px] text-muted-foreground/50">
							Based on {ruleCompliance.totalTrades} trade
							{ruleCompliance.totalTrades !== 1 ? "s" : ""}
						</div>
					</div>
				)}

				{/* Auto-Checks Section */}
				{hasAutoChecks && autoComplianceData && (
					<div
						className="space-y-2"
						data-testid="compliance-display-auto-checks"
					>
						<div className="flex items-center justify-between">
							<SectionHeader icon={CheckCircle2}>Auto-Checks</SectionHeader>
							<span
								className={cn(
									"font-mono text-[10px] tabular-nums",
									getComplianceColorClass(autoComplianceData.overallCompliance),
								)}
							>
								{autoComplianceData.overallCompliance.toFixed(0)}% avg
							</span>
						</div>
						<div className="space-y-1.5">
							{autoComplianceData.checks.map((check) => (
								<div
									className="flex items-center justify-between gap-3 rounded-sm bg-white/2 px-2.5 py-1.5"
									key={check.param}
								>
									<div className="flex items-center gap-2">
										<div
											className={cn(
												"flex h-4 w-4 items-center justify-center rounded-full",
												check.compliance >= 80
													? "bg-profit/20"
													: check.compliance >= 50
														? "bg-breakeven/20"
														: "bg-loss/20",
											)}
										>
											{check.compliance >= 80 ? (
												<Check className="h-2.5 w-2.5 text-profit" />
											) : check.compliance >= 50 ? (
												<Minus className="h-2.5 w-2.5 text-breakeven" />
											) : (
												<X className="h-2.5 w-2.5 text-loss" />
											)}
										</div>
										<span className="font-mono text-[11px] text-muted-foreground">
											{getParamLabel(check.param)}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="font-mono text-[10px] text-muted-foreground/50 tabular-nums">
													{check.passed}/{check.total}
													{check.unable > 0 && (
														<span className="text-muted-foreground/30">
															{" "}
															({check.unable} N/A)
														</span>
													)}
												</span>
											</TooltipTrigger>
											<TooltipContent side="top">
												<p className="font-mono text-xs">
													{check.passed} passed, {check.failed} failed
													{check.unable > 0 &&
														`, ${check.unable} unable to check`}
												</p>
											</TooltipContent>
										</Tooltip>
										<span
											className={cn(
												"font-mono text-[11px] tabular-nums",
												getComplianceColorClass(check.compliance),
											)}
										>
											{check.compliance.toFixed(0)}%
										</span>
									</div>
								</div>
							))}
						</div>
						<div className="text-right font-mono text-[10px] text-muted-foreground/50">
							Based on {autoComplianceData.tradeCount} trade
							{autoComplianceData.tradeCount !== 1 ? "s" : ""}
						</div>
					</div>
				)}

				{/* Explanation note */}
				<div className="mt-2 rounded border border-white/5 bg-white/2 px-3 py-2">
					<p className="font-mono text-[10px] text-muted-foreground/60">
						{hasManualRules && hasAutoChecks
							? "Manual rules require you to confirm compliance per trade. Auto-checks are calculated automatically from trade data."
							: hasManualRules
								? "Manual rules require you to confirm compliance for each trade."
								: "Auto-checks are calculated automatically from trade data (entry, stop loss, take profit, P&L)."}
					</p>
				</div>
			</div>
		</div>
	);
}

// Helper to get readable param labels
function getParamLabel(param: string): string {
	const labels: Record<string, string> = {
		minRRRatio: "Min R:R Ratio",
		maxRiskPerTrade: "Max Risk/Trade",
		dailyLossLimit: "Daily Loss Limit",
		maxConcurrentPositions: "Max Positions",
		targetRMultiples: "R Targets",
	};
	return labels[param] ?? param;
}
