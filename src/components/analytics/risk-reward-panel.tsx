import { Crosshair, Info, Target, TrendingUp } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

interface RiskRewardCategory {
	range: string;
	trades: number;
	wins: number;
	winRate: number;
	totalPnl: number;
	avgPnl: number;
}

interface RiskRewardSummary {
	totalTrades: number;
	tradesWithSL: number;
	tradesWithBoth: number;
	avgRMultiple: number;
	avgPlannedRR: number;
	avgEfficiency: number;
	winRate: number;
	wins: number;
	losses: number;
}

interface RiskRewardPanelProps {
	summary: RiskRewardSummary;
	categories: RiskRewardCategory[];
	className?: string;
}

/**
 * Risk/Reward Analysis Panel
 * Shows planned vs actual R:R and performance by R:R category
 */
export function RiskRewardPanel({
	summary,
	categories,
	className,
}: RiskRewardPanelProps) {
	const hasData = summary.tradesWithSL > 0;
	const hasBothData = summary.tradesWithBoth > 0;

	// Determine efficiency rating
	const getEfficiencyRating = (eff: number) => {
		if (eff >= 80) return { label: "Excellent", color: "text-profit" };
		if (eff >= 60) return { label: "Good", color: "text-accent" };
		if (eff >= 40) return { label: "Fair", color: "text-breakeven" };
		return { label: "Poor", color: "text-loss" };
	};

	const effRating = getEfficiencyRating(summary.avgEfficiency);

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-secondary/50">
						<Crosshair className="h-5 w-5 text-accent" />
					</div>
					<div>
						<div className="flex items-center gap-1.5">
							<span className="font-mono text-muted-foreground text-xs">
								Risk/Reward Analysis
							</span>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										aria-label="Learn about Risk/Reward"
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
										<span className="font-medium text-primary text-xs">
											What:
										</span>
										<p className="text-muted-foreground text-xs">
											Compares your planned R:R (reward/risk based on TP/SL) to
											actual outcomes.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											Efficiency:
										</span>
										<p className="text-muted-foreground text-xs">
											% of planned R:R actually captured. 100% = hit TP exactly.
											Higher = better execution.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											Goal:
										</span>
										<p className="text-muted-foreground text-xs">
											Trade setups with higher R:R. Efficiency {">"} 60% is
											good.
										</p>
									</div>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="font-mono text-[10px] text-muted-foreground">
							{summary.tradesWithBoth} trades with SL + TP
						</div>
					</div>
				</div>

				{/* Trade Efficiency */}
				<div className="text-right">
					<div className={cn("font-bold font-mono text-2xl", effRating.color)}>
						{hasBothData ? `${summary.avgEfficiency.toFixed(0)}%` : "—"}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						Trade Efficiency
					</div>
				</div>
			</div>

			{/* Summary stats */}
			{hasData ? (
				<div className="grid grid-cols-3 gap-2">
					<div className="rounded border border-border bg-secondary/30 p-3 text-center">
						<div className="flex items-center justify-center gap-1">
							<TrendingUp className="h-3 w-3 text-primary" />
							<span className="font-mono text-[10px] text-muted-foreground">
								Avg R
							</span>
						</div>
						<div
							className={cn(
								"font-bold font-mono text-lg",
								summary.avgRMultiple > 0 ? "text-profit" : "text-loss",
							)}
						>
							{summary.avgRMultiple >= 0 ? "+" : ""}
							{summary.avgRMultiple.toFixed(2)}R
						</div>
					</div>
					<div className="rounded border border-border bg-secondary/30 p-3 text-center">
						<div className="flex items-center justify-center gap-1">
							<Target className="h-3 w-3 text-accent" />
							<span className="font-mono text-[10px] text-muted-foreground">
								Planned R:R
							</span>
						</div>
						<div className="font-bold font-mono text-accent text-lg">
							{hasBothData ? `${summary.avgPlannedRR.toFixed(1)}:1` : "—"}
						</div>
					</div>
					<div className="rounded border border-border bg-secondary/30 p-3 text-center">
						<div className="font-mono text-[10px] text-muted-foreground">
							Win Rate
						</div>
						<div
							className={cn(
								"font-bold font-mono text-lg",
								summary.winRate >= 50 ? "text-profit" : "text-loss",
							)}
						>
							{formatPercent(summary.winRate, 0).replace("+", "")}
						</div>
					</div>
				</div>
			) : (
				<div className="flex h-[100px] items-center justify-center rounded border border-border border-dashed bg-secondary/20">
					<div className="text-center">
						<Crosshair className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
						<p className="font-mono text-muted-foreground text-xs">
							No trades with stop loss data
						</p>
					</div>
				</div>
			)}

			{/* Performance by R:R category */}
			{hasBothData && (
				<div className="space-y-2">
					<div className="font-mono text-[10px] text-muted-foreground">
						Performance by Planned R:R
					</div>
					<div className="overflow-hidden rounded border border-border">
						<table className="w-full">
							<thead>
								<tr className="border-border border-b bg-secondary/50">
									<th className="px-3 py-2 text-left font-mono text-[10px] text-muted-foreground">
										R:R Range
									</th>
									<th className="px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">
										Trades
									</th>
									<th className="px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">
										Win %
									</th>
									<th className="px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">
										Avg P&L
									</th>
								</tr>
							</thead>
							<tbody>
								{categories.map((cat) => (
									<tr
										className="border-border border-b last:border-b-0"
										key={cat.range}
									>
										<td className="px-3 py-2 font-mono text-xs">{cat.range}</td>
										<td className="px-3 py-2 text-right font-mono text-muted-foreground text-xs">
											{cat.trades}
										</td>
										<td
											className={cn(
												"px-3 py-2 text-right font-mono text-xs",
												cat.winRate >= 50 ? "text-profit" : "text-loss",
											)}
										>
											{cat.trades > 0
												? formatPercent(cat.winRate, 0).replace("+", "")
												: "—"}
										</td>
										<td
											className={cn(
												"px-3 py-2 text-right font-mono text-xs",
												cat.avgPnl > 0
													? "text-profit"
													: cat.avgPnl < 0
														? "text-loss"
														: "text-muted-foreground",
											)}
										>
											{cat.trades > 0 ? formatCurrency(cat.avgPnl) : "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="font-mono text-[10px] text-muted-foreground/60">
						Higher R:R setups should have lower win rate but bigger wins
					</p>
				</div>
			)}
		</div>
	);
}
