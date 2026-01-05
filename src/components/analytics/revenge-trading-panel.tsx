"use client";

import { AlertTriangle } from "lucide-react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

interface AfterTradeStats {
	trades: number;
	wins: number;
	losses: number;
	winRate: number;
	pnl: number;
	avgPnl: number;
}

interface ConsecutiveLossStats {
	trades: number;
	wins: number;
	winRate: number;
	avgPnl: number;
}

interface RevengeTradingPanelProps {
	afterWin: AfterTradeStats;
	afterLoss: AfterTradeStats;
	afterConsecutiveLosses: {
		after1Loss: ConsecutiveLossStats;
		after2Losses: ConsecutiveLossStats;
		after3PlusLosses: ConsecutiveLossStats;
	};
	revengeIndicator: number;
	className?: string;
}

/**
 * Terminal-styled revenge trading analysis panel
 * Compares performance after wins vs after losses
 */
export function RevengeTradingPanel({
	afterWin,
	afterLoss,
	afterConsecutiveLosses,
	revengeIndicator,
	className,
}: RevengeTradingPanelProps) {
	const hasData = afterWin.trades > 0 || afterLoss.trades > 0;

	if (!hasData) {
		return (
			<div
				className={cn(
					"flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				Need at least 2 trades for revenge trading analysis
			</div>
		);
	}

	// Determine risk level based on revenge indicator
	const getRiskLevel = (indicator: number) => {
		if (indicator < 20) return { label: "Low", color: "text-profit" };
		if (indicator < 40) return { label: "Moderate", color: "text-breakeven" };
		if (indicator < 60) return { label: "Elevated", color: "text-amber-400" };
		return { label: "High", color: "text-loss" };
	};

	const riskLevel = getRiskLevel(revengeIndicator);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Revenge Trading Indicator */}
			<div className="rounded border border-border bg-secondary/20 p-4">
				<div className="flex items-center justify-between">
					<div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Revenge Trading Risk
						</div>
						<div
							className={cn(
								"mt-1 font-bold font-mono text-2xl",
								riskLevel.color,
							)}
						>
							{riskLevel.label}
						</div>
					</div>

					{/* Gauge */}
					<div className="flex items-center gap-3">
						<div className="w-32">
							<div className="relative h-2 overflow-hidden rounded-full bg-secondary">
								<div
									className={cn(
										"absolute inset-y-0 left-0 rounded-full transition-all",
										revengeIndicator < 20
											? "bg-profit"
											: revengeIndicator < 40
												? "bg-breakeven"
												: revengeIndicator < 60
													? "bg-amber-400"
													: "bg-loss",
									)}
									style={{ width: `${revengeIndicator}%` }}
								/>
							</div>
						</div>
						<span
							className={cn("font-mono text-sm tabular-nums", riskLevel.color)}
						>
							{revengeIndicator.toFixed(0)}%
						</span>
					</div>
				</div>

				{revengeIndicator >= 40 && (
					<div className="mt-3 flex items-start gap-2 rounded bg-amber-500/10 p-2 font-mono text-amber-400 text-xs">
						<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<span>
							Your win rate drops significantly after losses. Consider taking a
							break after losing trades.
						</span>
					</div>
				)}
			</div>

			{/* After Win vs After Loss Comparison */}
			<div className="grid grid-cols-2 gap-4">
				{/* After Win */}
				<div className="space-y-3 rounded border border-profit/20 bg-profit/5 p-4">
					<div className="flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-profit" />
						<span className="font-mono text-muted-foreground text-xs">
							After a WIN
						</span>
					</div>

					<div className="space-y-2">
						<div className="flex justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								Win Rate
							</span>
							<span
								className={cn(
									"font-mono text-xs tabular-nums",
									afterWin.winRate >= 50 ? "text-profit" : "text-loss",
								)}
							>
								{formatPercent(afterWin.winRate, 1).replace("+", "")}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								Avg P&L
							</span>
							<span
								className={cn(
									"font-mono text-xs tabular-nums",
									afterWin.avgPnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(afterWin.avgPnl)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								Total P&L
							</span>
							<span
								className={cn(
									"font-mono text-xs tabular-nums",
									afterWin.pnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(afterWin.pnl)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								Trades
							</span>
							<span className="font-mono text-muted-foreground text-xs tabular-nums">
								{afterWin.trades}
							</span>
						</div>
					</div>
				</div>

				{/* After Loss */}
				<div className="space-y-3 rounded border border-loss/20 bg-loss/5 p-4">
					<div className="flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-loss" />
						<span className="font-mono text-muted-foreground text-xs">
							After a LOSS
						</span>
					</div>

					<div className="space-y-2">
						<div className="flex justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								Win Rate
							</span>
							<span
								className={cn(
									"font-mono text-xs tabular-nums",
									afterLoss.winRate >= 50 ? "text-profit" : "text-loss",
								)}
							>
								{formatPercent(afterLoss.winRate, 1).replace("+", "")}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								Avg P&L
							</span>
							<span
								className={cn(
									"font-mono text-xs tabular-nums",
									afterLoss.avgPnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(afterLoss.avgPnl)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								Total P&L
							</span>
							<span
								className={cn(
									"font-mono text-xs tabular-nums",
									afterLoss.pnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(afterLoss.pnl)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-mono text-muted-foreground text-xs">
								Trades
							</span>
							<span className="font-mono text-muted-foreground text-xs tabular-nums">
								{afterLoss.trades}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* After Consecutive Losses */}
			<div className="space-y-2">
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Performance After Consecutive Losses
				</div>

				<div className="grid grid-cols-3 gap-2">
					{/* After 1 Loss */}
					<div className="rounded bg-secondary/30 p-2">
						<div className="font-mono text-muted-foreground text-xs">
							After 1 Loss
						</div>
						<div
							className={cn(
								"font-medium font-mono text-sm",
								afterConsecutiveLosses.after1Loss.avgPnl >= 0
									? "text-profit"
									: "text-loss",
							)}
						>
							{formatCurrency(afterConsecutiveLosses.after1Loss.avgPnl)}
						</div>
						<div className="font-mono text-muted-foreground/60 text-xs">
							{afterConsecutiveLosses.after1Loss.winRate.toFixed(0)}% WR /{" "}
							{afterConsecutiveLosses.after1Loss.trades}t
						</div>
					</div>

					{/* After 2 Losses */}
					<div className="rounded bg-secondary/30 p-2">
						<div className="font-mono text-muted-foreground text-xs">
							After 2 Losses
						</div>
						<div
							className={cn(
								"font-medium font-mono text-sm",
								afterConsecutiveLosses.after2Losses.avgPnl >= 0
									? "text-profit"
									: "text-loss",
							)}
						>
							{afterConsecutiveLosses.after2Losses.trades > 0
								? formatCurrency(afterConsecutiveLosses.after2Losses.avgPnl)
								: "-"}
						</div>
						<div className="font-mono text-muted-foreground/60 text-xs">
							{afterConsecutiveLosses.after2Losses.trades > 0
								? `${afterConsecutiveLosses.after2Losses.winRate.toFixed(0)}% WR / ${afterConsecutiveLosses.after2Losses.trades}t`
								: "No data"}
						</div>
					</div>

					{/* After 3+ Losses */}
					<div className="rounded bg-secondary/30 p-2">
						<div className="font-mono text-muted-foreground text-xs">
							After 3+ Losses
						</div>
						<div
							className={cn(
								"font-medium font-mono text-sm",
								afterConsecutiveLosses.after3PlusLosses.avgPnl >= 0
									? "text-profit"
									: "text-loss",
							)}
						>
							{afterConsecutiveLosses.after3PlusLosses.trades > 0
								? formatCurrency(afterConsecutiveLosses.after3PlusLosses.avgPnl)
								: "-"}
						</div>
						<div className="font-mono text-muted-foreground/60 text-xs">
							{afterConsecutiveLosses.after3PlusLosses.trades > 0
								? `${afterConsecutiveLosses.after3PlusLosses.winRate.toFixed(0)}% WR / ${afterConsecutiveLosses.after3PlusLosses.trades}t`
								: "No data"}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
