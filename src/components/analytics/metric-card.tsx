import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Tooltip content explaining a metric
 */
export interface MetricTooltip {
	/** What the metric measures - one sentence */
	what: string;
	/** Why it matters to traders */
	why: string;
	/** What values indicate good/bad performance */
	benchmark: string;
}

export interface MetricCardProps {
	/** The metric title/name */
	title: string;
	/** The formatted metric value */
	value: string | number;
	/** Optional description below the value */
	description?: string;
	/** Tooltip content explaining the metric */
	tooltip: MetricTooltip;
	/** Optional icon to display */
	icon?: LucideIcon;
	/** Optional color class for the value */
	colorClass?: string;
	/** Optional class name for the container */
	className?: string;
}

/**
 * MetricCard component for displaying analytics metrics
 * Every metric includes an info tooltip explaining what it is,
 * why it matters, and what good/bad values look like.
 */
export function MetricCard({
	title,
	value,
	description,
	tooltip,
	icon: Icon,
	colorClass,
	className,
}: MetricCardProps) {
	return (
		<div
			className={cn(
				"rounded border border-border bg-card p-4 transition-all hover:border-primary/30",
				className,
			)}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						{title}
					</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								aria-label={`Learn more about ${title}`}
								className="text-muted-foreground/60 transition-colors hover:text-primary"
								type="button"
							>
								<Info className="h-3 w-3" />
							</button>
						</TooltipTrigger>
						<TooltipContent
							className="max-w-[280px] space-y-2 border border-border bg-card p-3 text-foreground"
							side="top"
						>
							<div>
								<span className="font-medium text-primary text-xs">What:</span>
								<p className="text-muted-foreground text-xs">{tooltip.what}</p>
							</div>
							<div>
								<span className="font-medium text-primary text-xs">Why:</span>
								<p className="text-muted-foreground text-xs">{tooltip.why}</p>
							</div>
							<div>
								<span className="font-medium text-primary text-xs">
									Benchmark:
								</span>
								<p className="text-muted-foreground text-xs">
									{tooltip.benchmark}
								</p>
							</div>
						</TooltipContent>
					</Tooltip>
				</div>
				{Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
			</div>
			<div
				className={cn(
					"mt-2 font-bold font-mono text-xl",
					colorClass ?? "text-foreground",
				)}
			>
				{value}
			</div>
			{description && (
				<p className="mt-1 font-mono text-[10px] text-muted-foreground">
					{description}
				</p>
			)}
		</div>
	);
}

// =============================================================================
// PRESET TOOLTIPS FOR COMMON METRICS
// =============================================================================

export const METRIC_TOOLTIPS = {
	totalPnl: {
		what: "Your total net profit or loss across all closed trades.",
		why: "The bottom line - shows if you're making or losing money overall.",
		benchmark:
			"Positive is profitable. Compare to your starting capital for % return.",
	},
	winRate: {
		what: "Percentage of trades that were profitable (wins / total decisive trades).",
		why: "Shows how often you're right, but must be paired with payoff ratio.",
		benchmark:
			"40-60% is typical for day traders. Lower is fine with high payoff ratio.",
	},
	profitFactor: {
		what: "Gross profit divided by gross loss.",
		why: "Shows how much you make for every dollar you lose.",
		benchmark:
			">1 is profitable, >1.5 is good, >2 is excellent, >3 is exceptional.",
	},
	avgTrade: {
		what: "Average profit or loss per trade (total P&L / trade count).",
		why: "Shows your edge per trade. Critical for calculating expected returns.",
		benchmark: ">$0 means positive expectancy. Higher = stronger edge.",
	},
	expectancy: {
		what: "Expected profit per trade: (Win% × Avg Win) - (Loss% × Avg Loss).",
		why: "Predicts your average profit per trade if you repeat your strategy.",
		benchmark: ">$0 is profitable. Multiply by trade count to project returns.",
	},
	payoffRatio: {
		what: "Average winning trade divided by average losing trade.",
		why: "Measures reward vs risk. Can compensate for lower win rates.",
		benchmark:
			">1 means wins are larger than losses, >2 is excellent, >3 is rare.",
	},
	sharpeRatio: {
		what: "Risk-adjusted return: average P&L divided by P&L volatility.",
		why: "Higher Sharpe = better risk-adjusted returns. Rewards consistency.",
		benchmark:
			">0.5 is decent, >1 is good, >2 is excellent, <0 means losing money.",
	},
	avgWin: {
		what: "Average profit on winning trades.",
		why: "Shows how much you capture when you're right.",
		benchmark: "Compare to avgLoss - should ideally be higher.",
	},
	avgLoss: {
		what: "Average loss on losing trades.",
		why: "Shows your typical loss size. Keep this controlled with stop losses.",
		benchmark: "Should be consistent and smaller than avgWin for good R:R.",
	},
	largestWin: {
		what: "Your biggest winning trade.",
		why: "Shows max upside. Very large wins may indicate luck or outliers.",
		benchmark:
			"Should not be >30-40% of total profit (over-reliance on one trade).",
	},
	largestLoss: {
		what: "Your biggest losing trade.",
		why: "Risk management check. Large losses can wipe out many wins.",
		benchmark:
			"Ideally close to your average loss. Big outliers indicate risk issues.",
	},
	avgRMultiple: {
		what: "Average R-Multiple: actual P&L / initial risk per trade.",
		why: "Measures profit relative to risk taken. Normalizes across position sizes.",
		benchmark: ">0 is profitable, >1R means doubling your risk on average.",
	},
	currentStreak: {
		what: "Your current consecutive win or loss streak.",
		why: "Awareness of streaks helps manage emotional state and position sizing.",
		benchmark:
			"Streaks are normal. Don't oversize after wins or revenge trade after losses.",
	},
	// Risk metrics
	maxDrawdown: {
		what: "Largest peak-to-trough decline in your equity curve.",
		why: "Shows your worst loss period. Critical for risk management and sizing.",
		benchmark:
			"<10% is excellent, 10-20% is acceptable, >30% requires strategy review.",
	},
	sortinoRatio: {
		what: "Risk-adjusted return using only downside volatility (losses).",
		why: "Better than Sharpe for trading - doesn't penalize upside volatility.",
		benchmark:
			">1 is good, >2 is excellent. Higher = better risk-adjusted returns.",
	},
	calmarRatio: {
		what: "Annualized return divided by maximum drawdown.",
		why: "Shows return per unit of drawdown risk. Rewards consistent growth.",
		benchmark: ">1 is good, >2 is excellent, >3 is exceptional.",
	},
	recoveryFactor: {
		what: "Net profit divided by maximum drawdown.",
		why: "Shows how well you recover from losses. Higher = more resilient.",
		benchmark: ">3 is good, >5 is excellent. <1 means still in drawdown.",
	},
	ulcerIndex: {
		what: "Measures both depth and duration of drawdowns (RMS of drawdowns).",
		why: "Captures the 'pain' of drawdowns - deeper and longer = worse.",
		benchmark: "<5 is excellent, 5-10 is good, >15 indicates high volatility.",
	},
	riskOfRuin: {
		what: "Probability of hitting 50% drawdown based on your stats.",
		why: "Shows long-term survival odds. Even small risks compound over time.",
		benchmark: "<1% is safe, 1-5% is acceptable, >10% requires action.",
	},
	kellyPercent: {
		what: "Optimal position size for maximum geometric growth (Kelly Criterion).",
		why: "Balances growth vs risk of ruin. Full Kelly is aggressive.",
		benchmark:
			"Most traders use Half or Quarter Kelly. >30% suggests verify with more data.",
	},
} as const;
