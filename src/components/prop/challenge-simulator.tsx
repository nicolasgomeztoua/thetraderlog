"use client";

import { Dices, Info } from "lucide-react";
import { useMemo } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	type SimulatePropChallengeResult,
	simulatePropChallenge,
} from "@/lib/analytics/prop-compliance";
import { PASS_RATE_THRESHOLDS, SIMULATOR } from "@/lib/constants/prop";
import { cn, formatCurrency, formatPercent } from "@/lib/shared";

interface ChallengeSimulatorProps {
	/** Trade statistics from getPropCompliance */
	tradeStats: {
		totalTrades: number;
		wins: number;
		losses: number;
		winRate: number;
		avgWin: number;
		avgLoss: number;
	};
	/** Profit target in dollars */
	profitTarget: number;
	/** Max drawdown in dollars */
	maxDrawdown: number;
	/** Initial balance in dollars */
	initialBalance: number;
	className?: string;
}

const { MIN_TRADES, ITERATIONS, MAX_TRADES_PER_SIM } = SIMULATOR;

export function ChallengeSimulator({
	tradeStats,
	profitTarget,
	maxDrawdown,
	initialBalance,
	className,
}: ChallengeSimulatorProps) {
	const simulation = useMemo<SimulatePropChallengeResult | null>(() => {
		if (tradeStats.totalTrades < MIN_TRADES) return null;
		if (tradeStats.avgWin <= 0 || tradeStats.avgLoss <= 0) return null;

		return simulatePropChallenge({
			winRate: tradeStats.winRate / 100,
			avgWin: tradeStats.avgWin,
			avgLoss: tradeStats.avgLoss,
			profitTarget,
			maxDrawdown,
			initialBalance,
			maxTrades: MAX_TRADES_PER_SIM,
			iterations: ITERATIONS,
		});
	}, [tradeStats, profitTarget, maxDrawdown, initialBalance]);

	// Not enough data state
	if (!simulation) {
		return (
			<div
				className={cn(
					"rounded border border-white/5 bg-white/1 p-4",
					className,
				)}
				data-testid="challenge-simulator"
			>
				<SimulatorHeader />
				<div className="mt-4 flex h-[140px] items-center justify-center rounded border border-white/5 border-dashed bg-white/1">
					<div className="text-center">
						<Dices className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
						<p className="font-mono text-muted-foreground text-xs">
							Need more trade data
						</p>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							At least {MIN_TRADES} closed trades required
						</p>
					</div>
				</div>
			</div>
		);
	}

	const passPercent = simulation.passRate * 100;

	return (
		<div
			className={cn("rounded border border-white/5 bg-white/1 p-4", className)}
			data-testid="challenge-simulator"
		>
			<div className="flex items-start justify-between">
				<SimulatorHeader />

				{/* Pass rate — prominent display */}
				<div className="text-right" data-testid="challenge-simulator-pass-rate">
					<div
						className={cn(
							"font-bold font-mono text-3xl tabular-nums",
							passPercent >= PASS_RATE_THRESHOLDS.GOOD
								? "text-profit"
								: passPercent >= PASS_RATE_THRESHOLDS.FAIR
									? "text-breakeven"
									: "text-loss",
						)}
					>
						{passPercent.toFixed(1)}%
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						Pass Rate
					</div>
				</div>
			</div>

			{/* Outcome distribution bar */}
			<div
				className="mt-4 space-y-2"
				data-testid="challenge-simulator-distribution"
			>
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Outcome Distribution
				</div>
				<div className="relative h-10 overflow-hidden rounded border border-white/5 bg-white/2">
					{/* Pass bar (green) */}
					<div
						className="absolute inset-y-0 left-0 bg-profit/30"
						style={{ width: `${passPercent}%` }}
					/>
					{/* Fail bar (red) — remaining */}
					<div
						className="absolute inset-y-0 right-0 bg-loss/20"
						style={{ width: `${100 - passPercent}%` }}
					/>
					{/* Labels inside bars */}
					{passPercent > 15 && (
						<span className="-translate-y-1/2 absolute top-1/2 left-2 font-mono text-[10px] text-profit">
							Pass {passPercent.toFixed(0)}%
						</span>
					)}
					{100 - passPercent > 15 && (
						<span className="-translate-y-1/2 absolute top-1/2 right-2 font-mono text-[10px] text-loss">
							Fail {(100 - passPercent).toFixed(0)}%
						</span>
					)}
				</div>
			</div>

			{/* Percentile outcomes */}
			<div
				className="mt-4 space-y-2"
				data-testid="challenge-simulator-percentiles"
			>
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Simulated P&L Outcomes
				</div>
				<div className="relative h-10 rounded border border-white/5 bg-white/2">
					<div className="absolute inset-y-1 right-[5%] left-[5%] flex items-center">
						{/* 10-90 percentile range */}
						<div className="relative h-4 w-full rounded bg-muted/30">
							{/* 25-75 percentile (interquartile) */}
							{simulation.percentiles.p90 !== simulation.percentiles.p10 && (
								<div
									className="absolute top-0 h-full rounded bg-accent/30"
									style={{
										left: `${((simulation.percentiles.p25 - simulation.percentiles.p10) / (simulation.percentiles.p90 - simulation.percentiles.p10)) * 100}%`,
										width: `${((simulation.percentiles.p75 - simulation.percentiles.p25) / (simulation.percentiles.p90 - simulation.percentiles.p10)) * 100}%`,
									}}
								/>
							)}
							{/* Median marker */}
							{simulation.percentiles.p90 !== simulation.percentiles.p10 && (
								<div
									className="absolute top-0 h-full w-0.5 bg-accent"
									style={{
										left: `${((simulation.percentiles.p50 - simulation.percentiles.p10) / (simulation.percentiles.p90 - simulation.percentiles.p10)) * 100}%`,
									}}
								/>
							)}
						</div>
					</div>
				</div>
				<div className="flex justify-between px-[5%] font-mono text-[9px] text-muted-foreground">
					<span>10th: {formatCurrency(simulation.percentiles.p10)}</span>
					<span className="text-accent">
						50th: {formatCurrency(simulation.percentiles.p50)}
					</span>
					<span>90th: {formatCurrency(simulation.percentiles.p90)}</span>
				</div>
			</div>

			{/* Stats grid */}
			<div
				className="mt-4 grid grid-cols-2 gap-2"
				data-testid="challenge-simulator-stats"
			>
				<div className="rounded border border-white/5 bg-white/2 p-2">
					<div className="font-mono text-[10px] text-muted-foreground">
						Median Outcome
					</div>
					<div
						className={cn(
							"font-bold font-mono text-sm",
							simulation.medianOutcome >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{formatCurrency(simulation.medianOutcome)}
					</div>
				</div>
				<div className="rounded border border-white/5 bg-white/2 p-2">
					<div className="font-mono text-[10px] text-muted-foreground">
						Avg Trades to Pass
					</div>
					<div className="font-bold font-mono text-sm">
						{simulation.avgTradesToPass > 0
							? Math.round(simulation.avgTradesToPass)
							: "—"}
					</div>
				</div>
			</div>

			{/* Basis info */}
			<div
				className="mt-4 rounded border border-white/5 bg-white/1 p-2"
				data-testid="challenge-simulator-basis"
			>
				<div className="font-mono text-[10px] text-muted-foreground">
					Based on {tradeStats.totalTrades} trades •{" "}
					{formatPercent(tradeStats.winRate, 1).replace("+", "")} win rate •{" "}
					{formatCurrency(tradeStats.avgWin)} avg win •{" "}
					{formatCurrency(tradeStats.avgLoss)} avg loss
				</div>
			</div>

			{/* Disclaimer */}
			<p className="mt-3 font-mono text-[9px] text-muted-foreground/50">
				Simulation assumes future performance matches historical stats.{" "}
				{ITERATIONS.toLocaleString()} iterations.
			</p>
		</div>
	);
}

/** Header with icon and tooltip */
function SimulatorHeader() {
	return (
		<div className="flex items-center gap-2">
			<div className="flex h-8 w-8 items-center justify-center rounded border border-white/5 bg-white/2">
				<Dices className="h-4 w-4 text-accent" />
			</div>
			<div>
				<div className="flex items-center gap-1.5">
					<span className="font-mono text-muted-foreground text-xs">
						Challenge Simulator
					</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								aria-label="Learn about challenge simulation"
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
								<p className="text-muted-foreground text-xs">
									Runs {ITERATIONS.toLocaleString()} random simulations using
									your actual win rate and average trade size.
								</p>
							</div>
							<div>
								<span className="font-medium text-primary text-xs">How:</span>
								<p className="text-muted-foreground text-xs">
									Each simulation plays out random trades until the profit
									target is hit, max drawdown is breached, or trades run out.
								</p>
							</div>
						</TooltipContent>
					</Tooltip>
				</div>
				<div className="font-mono text-[10px] text-muted-foreground/60">
					Monte Carlo Analysis
				</div>
			</div>
		</div>
	);
}
