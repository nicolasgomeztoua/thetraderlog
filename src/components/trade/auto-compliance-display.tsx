"use client";

import { AlertCircle, Check, Minus, X } from "lucide-react";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/shared";
import {
	type ComplianceCheck,
	calculateRiskCompliance,
	type RiskParameters,
	type TradeForCompliance,
} from "@/lib/strategies/risk-compliance";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface AutoComplianceDisplayProps {
	trade: {
		id: string;
		symbol: string;
		instrumentType: "futures" | "forex";
		direction: "long" | "short";
		entryPrice: string;
		exitPrice: string | null;
		stopLoss: string | null;
		takeProfit: string | null;
		quantity: string;
		netPnl: string | null;
		strategyId: string | null;
		entryTime: Date | string;
		exitTime: Date | string | null;
	};
	accountBalance?: number;
	className?: string;
}

// =============================================================================
// COMPLIANCE CHECK ITEM
// =============================================================================

function ComplianceCheckItem({ check }: { check: ComplianceCheck }) {
	const getStatusIcon = () => {
		if (check.passed === null) {
			return (
				<div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/20">
					<Minus className="h-2.5 w-2.5 text-muted-foreground" />
				</div>
			);
		}
		if (check.passed) {
			return (
				<div className="flex h-4 w-4 items-center justify-center rounded-full bg-profit/20">
					<Check className="h-2.5 w-2.5 text-profit" />
				</div>
			);
		}
		return (
			<div className="flex h-4 w-4 items-center justify-center rounded-full bg-loss/20">
				<X className="h-2.5 w-2.5 text-loss" />
			</div>
		);
	};

	const getParamLabel = (param: string) => {
		const labels: Record<string, string> = {
			minRRRatio: "Min R:R Ratio",
			maxRiskPerTrade: "Max Risk/Trade",
			dailyLossLimit: "Daily Loss Limit",
			maxConcurrentPositions: "Max Positions",
			targetRMultiples: "R Targets",
		};
		return labels[param] ?? param;
	};

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className="flex items-center justify-between gap-3 rounded-sm bg-white/2 px-2.5 py-1.5">
					<div className="flex items-center gap-2">
						{getStatusIcon()}
						<span className="font-mono text-[11px] text-muted-foreground">
							{getParamLabel(check.param)}
						</span>
					</div>
					<span
						className={cn(
							"font-mono text-[11px] tabular-nums",
							check.passed === null && "text-muted-foreground",
							check.passed === true && "text-profit",
							check.passed === false && "text-loss",
						)}
					>
						{check.actual !== null ? check.actual : "—"}
						{check.limit !== null && check.passed !== null && (
							<span className="text-muted-foreground/50"> / {check.limit}</span>
						)}
					</span>
				</div>
			</TooltipTrigger>
			<TooltipContent className="max-w-[250px]" side="top">
				<p className="font-mono text-xs">{check.note}</p>
			</TooltipContent>
		</Tooltip>
	);
}

// =============================================================================
// TARGETS HIT DISPLAY
// =============================================================================

function TargetsHitDisplay({ targetsHit }: { targetsHit: number[] }) {
	if (targetsHit.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 rounded-sm bg-profit/5 px-2.5 py-1.5">
			<Check className="h-3.5 w-3.5 text-profit" />
			<span className="font-mono text-[11px] text-profit">
				Hit {targetsHit.map((t) => `${t}R`).join(", ")}{" "}
				{targetsHit.length === 1 ? "target" : "targets"}
			</span>
		</div>
	);
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function ComplianceSkeleton() {
	return (
		<div className="space-y-2">
			<Skeleton className="h-4 w-24" />
			<div className="space-y-1.5">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
			</div>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AutoComplianceDisplay({
	trade,
	accountBalance,
	className,
}: AutoComplianceDisplayProps) {
	// Fetch strategy to get risk parameters
	const { data: strategy, isLoading } = api.strategies.getById.useQuery(
		{ id: trade.strategyId ?? "" },
		{ enabled: !!trade.strategyId },
	);

	// Calculate compliance
	const complianceResult = useMemo(() => {
		if (!strategy?.riskParameters) {
			return null;
		}

		// Convert trade to compliance format
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

		// Build risk parameters
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

		return calculateRiskCompliance(
			tradeForCompliance,
			riskParams,
			accountBalance,
		);
	}, [strategy, trade, accountBalance]);

	// No strategy assigned
	if (!trade.strategyId) {
		return null;
	}

	// Loading
	if (isLoading) {
		return (
			<div className={cn("space-y-3", className)}>
				<ComplianceSkeleton />
			</div>
		);
	}

	// No risk parameters configured
	if (!complianceResult || complianceResult.checks.length === 0) {
		return (
			<div className={cn("space-y-3", className)}>
				<div className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
					Auto-Compliance
				</div>
				<div className="flex items-center gap-2 rounded-sm bg-white/2 px-2.5 py-2">
					<AlertCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
					<span className="font-mono text-[11px] text-muted-foreground">
						No risk parameters configured
					</span>
				</div>
			</div>
		);
	}

	// Calculate overall status
	const validChecks = complianceResult.checks.filter((c) => c.passed !== null);
	const passedChecks = validChecks.filter((c) => c.passed === true);
	const overallPassed =
		validChecks.length > 0 && passedChecks.length === validChecks.length;
	const overallFailed = validChecks.length > 0 && passedChecks.length === 0;

	return (
		<div className={cn("space-y-3", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
					Auto-Compliance
				</span>
				<span
					className={cn(
						"font-mono text-[11px] tabular-nums",
						overallPassed && "text-profit",
						overallFailed && "text-loss",
						!overallPassed && !overallFailed && "text-breakeven",
					)}
				>
					{complianceResult.overallCompliance}%
				</span>
			</div>

			{/* Compliance checks */}
			<div className="space-y-1.5">
				{complianceResult.checks.map((check) => (
					<ComplianceCheckItem check={check} key={check.param} />
				))}
			</div>

			{/* Targets hit */}
			{complianceResult.targetsHit.length > 0 && (
				<TargetsHitDisplay targetsHit={complianceResult.targetsHit} />
			)}
		</div>
	);
}
