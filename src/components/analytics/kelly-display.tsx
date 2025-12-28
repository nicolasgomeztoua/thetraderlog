import { Calculator, Info, TrendingUp } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatPercent } from "@/lib/utils";

interface KellyDisplayProps {
	/** Full Kelly percentage (0-100) */
	kellyPercent: number;
	/** Half Kelly percentage (commonly used) */
	halfKellyPercent: number;
	/** Win rate used in calculation */
	winRate: number;
	/** Average win amount */
	avgWin: number;
	/** Average loss amount */
	avgLoss: number;
	className?: string;
}

/**
 * Get Kelly recommendation info
 */
function getKellyInfo(kelly: number): {
	recommendation: string;
	color: string;
	description: string;
} {
	if (kelly <= 0) {
		return {
			recommendation: "No Edge",
			color: "text-loss",
			description:
				"Your strategy shows no mathematical edge. Review your approach.",
		};
	}
	if (kelly <= 5) {
		return {
			recommendation: "Conservative",
			color: "text-muted-foreground",
			description:
				"Small edge detected. Use small position sizes until strategy matures.",
		};
	}
	if (kelly <= 15) {
		return {
			recommendation: "Moderate Edge",
			color: "text-accent",
			description:
				"Solid edge. Half Kelly (shown) is typically recommended for real trading.",
		};
	}
	if (kelly <= 30) {
		return {
			recommendation: "Strong Edge",
			color: "text-profit",
			description:
				"Excellent metrics! Consider Half or Quarter Kelly for safety.",
		};
	}
	return {
		recommendation: "Very High",
		color: "text-profit",
		description:
			"Exceptional metrics. Verify with more data - consider Quarter Kelly.",
	};
}

/**
 * Kelly Criterion display with position sizing recommendations
 * Shows optimal bet size based on edge and payoff ratio
 */
export function KellyDisplay({
	kellyPercent,
	halfKellyPercent,
	winRate,
	avgWin,
	avgLoss,
	className,
}: KellyDisplayProps) {
	const kellyInfo = getKellyInfo(kellyPercent);
	const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
	const quarterKelly = kellyPercent / 4;

	return (
		<div className={cn("space-y-4", className)}>
			{/* Main Kelly display */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-secondary/50">
						<Calculator className="h-5 w-5 text-primary" />
					</div>
					<div>
						<div className="flex items-center gap-1.5">
							<span className="font-mono text-muted-foreground text-xs">
								Kelly Criterion
							</span>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										aria-label="Learn about Kelly Criterion"
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
											Optimal position size for maximum geometric growth of
											capital.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											Why:
										</span>
										<p className="text-muted-foreground text-xs">
											Balances growth vs risk of ruin. Higher edge = larger
											optimal size.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											Usage:
										</span>
										<p className="text-muted-foreground text-xs">
											Most traders use Half or Quarter Kelly for safety. Full
											Kelly is aggressive.
										</p>
									</div>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className={cn("font-mono text-xs", kellyInfo.color)}>
							{kellyInfo.recommendation}
						</div>
					</div>
				</div>

				{/* Full Kelly value */}
				<div className="text-right">
					<div className={cn("font-bold font-mono text-2xl", kellyInfo.color)}>
						{kellyPercent <= 0
							? "0%"
							: formatPercent(kellyPercent, 1).replace("+", "")}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						Full Kelly
					</div>
				</div>
			</div>

			{/* Recommended sizes */}
			<div className="grid grid-cols-3 gap-2">
				<div className="rounded border border-border bg-secondary/30 p-3 text-center">
					<div className="font-mono text-[10px] text-muted-foreground">
						Full
					</div>
					<div className="font-bold font-mono text-muted-foreground text-sm">
						{formatPercent(kellyPercent, 1).replace("+", "")}
					</div>
					<div className="font-mono text-[9px] text-muted-foreground/60">
						Aggressive
					</div>
				</div>
				<div className="rounded border border-primary/30 bg-primary/5 p-3 text-center">
					<div className="font-mono text-[10px] text-primary">Half ★</div>
					<div className="font-bold font-mono text-primary text-sm">
						{formatPercent(halfKellyPercent, 1).replace("+", "")}
					</div>
					<div className="font-mono text-[9px] text-primary/70">
						Recommended
					</div>
				</div>
				<div className="rounded border border-border bg-secondary/30 p-3 text-center">
					<div className="font-mono text-[10px] text-muted-foreground">
						Quarter
					</div>
					<div className="font-bold font-mono text-muted-foreground text-sm">
						{formatPercent(quarterKelly, 1).replace("+", "")}
					</div>
					<div className="font-mono text-[9px] text-muted-foreground/60">
						Conservative
					</div>
				</div>
			</div>

			{/* Input metrics */}
			<div className="rounded border border-border bg-secondary/20 p-3">
				<div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
					<TrendingUp className="h-3 w-3" />
					<span>Based on your metrics</span>
				</div>
				<div className="grid grid-cols-3 gap-4 font-mono text-xs">
					<div>
						<div className="text-muted-foreground">Win Rate</div>
						<div
							className={
								winRate >= 50 ? "text-profit" : "text-muted-foreground"
							}
						>
							{formatPercent(winRate, 1).replace("+", "")}
						</div>
					</div>
					<div>
						<div className="text-muted-foreground">Payoff Ratio</div>
						<div
							className={
								payoffRatio >= 1 ? "text-profit" : "text-muted-foreground"
							}
						>
							{payoffRatio.toFixed(2)}
						</div>
					</div>
					<div>
						<div className="text-muted-foreground">Edge</div>
						<div className={kellyPercent > 0 ? "text-profit" : "text-loss"}>
							{kellyPercent > 0 ? "Positive" : "None"}
						</div>
					</div>
				</div>
			</div>

			{/* Description */}
			<p className="font-mono text-[10px] text-muted-foreground">
				{kellyInfo.description}
			</p>
		</div>
	);
}
