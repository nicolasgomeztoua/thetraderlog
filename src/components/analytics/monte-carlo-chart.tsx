import { Dices, Info, TrendingDown, TrendingUp } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency, formatPercent } from "@/lib/shared";

interface MonteCarloResult {
	hasEnoughData: boolean;
	iterations: number;
	percentiles: {
		p5: number;
		p25: number;
		p50: number;
		p75: number;
		p95: number;
	};
	probabilityOfProfit: number;
	expectedValue: number;
	standardDeviation: number;
	actualOutcome: number;
	worstDrawdown: number;
	bestPeak: number;
}

interface MonteCarloChartProps {
	data: MonteCarloResult;
	className?: string;
}

/**
 * Monte Carlo Simulation Results
 * Shows probability distribution of outcomes
 */
export function MonteCarloChart({ data, className }: MonteCarloChartProps) {
	if (!data.hasEnoughData) {
		return (
			<div className={cn("space-y-4", className)}>
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-secondary/50">
						<Dices className="h-5 w-5 text-accent" />
					</div>
					<div>
						<div className="font-mono text-muted-foreground text-xs">
							Monte Carlo Simulation
						</div>
						<div className="font-mono text-[10px] text-muted-foreground/60">
							Requires at least 10 trades
						</div>
					</div>
				</div>
				<div className="flex h-[200px] items-center justify-center rounded border border-border border-dashed bg-secondary/20">
					<div className="text-center">
						<Dices className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
						<p className="font-mono text-muted-foreground text-xs">
							Need more trade data
						</p>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							At least 10 closed trades required
						</p>
					</div>
				</div>
			</div>
		);
	}

	const { percentiles, probabilityOfProfit, actualOutcome, expectedValue } =
		data;

	// Determine if actual outcome is good relative to simulation
	const actualVsExpected = actualOutcome - expectedValue;
	const actualPercentile =
		actualOutcome <= percentiles.p5
			? 5
			: actualOutcome <= percentiles.p25
				? 25
				: actualOutcome <= percentiles.p50
					? 50
					: actualOutcome <= percentiles.p75
						? 75
						: 95;

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-secondary/50">
						<Dices className="h-5 w-5 text-accent" />
					</div>
					<div>
						<div className="flex items-center gap-1.5">
							<span className="font-mono text-muted-foreground text-xs">
								Monte Carlo
							</span>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										aria-label="Learn about Monte Carlo"
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
											Randomizes your trade order{" "}
											{data.iterations.toLocaleString()} times to show range of
											possible outcomes.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											Why:
										</span>
										<p className="text-muted-foreground text-xs">
											Your actual sequence of trades is just one path. This
											shows how lucky or unlucky you might have been.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											Key:
										</span>
										<p className="text-muted-foreground text-xs">
											If actual outcome is near median (50th), your luck was
											average. Above 75th = lucky, below 25th = unlucky.
										</p>
									</div>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="font-mono text-[10px] text-muted-foreground">
							{data.iterations.toLocaleString()} simulations
						</div>
					</div>
				</div>

				{/* Probability of Profit */}
				<div className="text-right">
					<div
						className={cn(
							"font-bold font-mono text-2xl",
							probabilityOfProfit >= 70
								? "text-profit"
								: probabilityOfProfit >= 50
									? "text-breakeven"
									: "text-loss",
						)}
					>
						{formatPercent(probabilityOfProfit, 0).replace("+", "")}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						Prob. of Profit
					</div>
				</div>
			</div>

			{/* Percentile range visualization */}
			<div className="space-y-2">
				<div className="font-mono text-[10px] text-muted-foreground">
					Outcome Distribution
				</div>
				<div className="relative h-12 rounded border border-border bg-secondary/30">
					{/* Range bar */}
					<div className="absolute inset-y-2 right-[5%] left-[5%] flex items-center">
						{/* 5-95 percentile range */}
						<div className="relative h-4 w-full rounded bg-muted/30">
							{/* 25-75 percentile (interquartile) */}
							<div
								className="absolute top-0 h-full rounded bg-accent/30"
								style={{
									left: `${((percentiles.p25 - percentiles.p5) / (percentiles.p95 - percentiles.p5)) * 100}%`,
									width: `${((percentiles.p75 - percentiles.p25) / (percentiles.p95 - percentiles.p5)) * 100}%`,
								}}
							/>
							{/* Median marker */}
							<div
								className="absolute top-0 h-full w-0.5 bg-accent"
								style={{
									left: `${((percentiles.p50 - percentiles.p5) / (percentiles.p95 - percentiles.p5)) * 100}%`,
								}}
							/>
							{/* Actual outcome marker */}
							<div
								className={cn(
									"absolute -top-1 h-6 w-1 rounded-sm",
									actualOutcome >= 0 ? "bg-profit" : "bg-loss",
								)}
								style={{
									left: `${Math.max(0, Math.min(100, ((actualOutcome - percentiles.p5) / (percentiles.p95 - percentiles.p5)) * 100))}%`,
								}}
							/>
						</div>
					</div>
				</div>
				<div className="flex justify-between px-[5%] font-mono text-[9px] text-muted-foreground">
					<span>5th: {formatCurrency(percentiles.p5)}</span>
					<span className="text-accent">
						50th: {formatCurrency(percentiles.p50)}
					</span>
					<span>95th: {formatCurrency(percentiles.p95)}</span>
				</div>
			</div>

			{/* Stats grid */}
			<div className="grid grid-cols-2 gap-2">
				<div className="rounded border border-border bg-secondary/30 p-2">
					<div className="font-mono text-[10px] text-muted-foreground">
						Your Actual
					</div>
					<div
						className={cn(
							"font-bold font-mono text-sm",
							actualOutcome >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{formatCurrency(actualOutcome)}
					</div>
					<div className="font-mono text-[9px] text-muted-foreground/60">
						{actualPercentile}th percentile
					</div>
				</div>
				<div className="rounded border border-border bg-secondary/30 p-2">
					<div className="font-mono text-[10px] text-muted-foreground">
						Expected Value
					</div>
					<div
						className={cn(
							"font-bold font-mono text-sm",
							expectedValue >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{formatCurrency(expectedValue)}
					</div>
					<div className="font-mono text-[9px] text-muted-foreground/60">
						Mean outcome
					</div>
				</div>
			</div>

			{/* Percentile breakdown */}
			<div className="overflow-hidden rounded border border-border">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-secondary/50">
							<th className="px-2 py-1.5 text-left font-mono text-[10px] text-muted-foreground">
								Percentile
							</th>
							<th className="px-2 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
								Outcome
							</th>
							<th className="px-2 py-1.5 text-left font-mono text-[10px] text-muted-foreground">
								Meaning
							</th>
						</tr>
					</thead>
					<tbody>
						<tr className="border-border border-b">
							<td className="px-2 py-1.5 font-mono text-xs">5th</td>
							<td className="px-2 py-1.5 text-right font-mono text-loss text-xs">
								{formatCurrency(percentiles.p5)}
							</td>
							<td className="px-2 py-1.5 font-mono text-[9px] text-muted-foreground">
								Worst likely
							</td>
						</tr>
						<tr className="border-border border-b">
							<td className="px-2 py-1.5 font-mono text-xs">25th</td>
							<td
								className={cn(
									"px-2 py-1.5 text-right font-mono text-xs",
									percentiles.p25 >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(percentiles.p25)}
							</td>
							<td className="px-2 py-1.5 font-mono text-[9px] text-muted-foreground">
								Unlucky
							</td>
						</tr>
						<tr className="border-border border-b bg-accent/5">
							<td className="px-2 py-1.5 font-mono text-accent text-xs">
								50th
							</td>
							<td
								className={cn(
									"px-2 py-1.5 text-right font-mono text-xs",
									percentiles.p50 >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(percentiles.p50)}
							</td>
							<td className="px-2 py-1.5 font-mono text-[9px] text-accent">
								Median
							</td>
						</tr>
						<tr className="border-border border-b">
							<td className="px-2 py-1.5 font-mono text-xs">75th</td>
							<td
								className={cn(
									"px-2 py-1.5 text-right font-mono text-xs",
									percentiles.p75 >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(percentiles.p75)}
							</td>
							<td className="px-2 py-1.5 font-mono text-[9px] text-muted-foreground">
								Lucky
							</td>
						</tr>
						<tr>
							<td className="px-2 py-1.5 font-mono text-xs">95th</td>
							<td className="px-2 py-1.5 text-right font-mono text-profit text-xs">
								{formatCurrency(percentiles.p95)}
							</td>
							<td className="px-2 py-1.5 font-mono text-[9px] text-muted-foreground">
								Best likely
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* Insight */}
			<div
				className={cn(
					"rounded border p-2",
					actualVsExpected >= 0
						? "border-profit/30 bg-profit/5"
						: "border-breakeven/30 bg-breakeven/5",
				)}
			>
				<div
					className={cn(
						"flex items-center gap-1.5 font-mono text-[10px]",
						actualVsExpected >= 0 ? "text-profit" : "text-breakeven",
					)}
				>
					{actualVsExpected >= 0 ? (
						<TrendingUp className="h-3 w-3" />
					) : (
						<TrendingDown className="h-3 w-3" />
					)}
					<span>
						Your actual result is{" "}
						{actualVsExpected >= 0
							? `${formatCurrency(actualVsExpected)} above`
							: `${formatCurrency(Math.abs(actualVsExpected))} below`}{" "}
						the expected value
					</span>
				</div>
			</div>
		</div>
	);
}
