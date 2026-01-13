import { cn, formatCurrency } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

interface TradeSummaryCardProps {
	netPnl: string | null | undefined;
	rMultiple: number | null;
	targetHitPercent: number | null;
	rrRatio: number | null;
	status: "open" | "closed";
	className?: string;
}

// =============================================================================
// TRADE SUMMARY CARD
// =============================================================================

export function TradeSummaryCard({
	netPnl,
	rMultiple,
	targetHitPercent,
	rrRatio,
	status,
	className,
}: TradeSummaryCardProps) {
	const pnlValue = netPnl ? parseFloat(netPnl) : null;
	const isProfit = pnlValue !== null && pnlValue > 0;
	const isLoss = pnlValue !== null && pnlValue < 0;

	// For open trades, show different content
	if (status === "open") {
		return (
			<div
				className={cn(
					"relative overflow-hidden rounded-sm border border-white/15 bg-gradient-to-br from-white/3 to-transparent p-8",
					className,
				)}
			>
				{/* Subtle corner accent */}
				<div className="pointer-events-none absolute top-0 right-0 h-24 w-24 bg-gradient-to-bl from-primary/5 to-transparent" />

				<div className="relative grid grid-cols-3 gap-8 text-center">
					<div>
						<p className="font-mono text-3xl text-muted-foreground">—</p>
						<p className="mt-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
							Net P&L
						</p>
					</div>
					<div>
						<p className="font-mono text-3xl text-muted-foreground">—</p>
						<p className="mt-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
							R-Multiple
						</p>
					</div>
					<div>
						<p className="font-mono text-3xl">
							{rrRatio ? `1:${rrRatio.toFixed(1)}` : "—"}
						</p>
						<p className="mt-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
							R:R Ratio
						</p>
					</div>
				</div>
				<p className="relative mt-6 text-center font-mono text-muted-foreground/50 text-xs">
					Position still open
				</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-sm border p-8",
				isProfit &&
					"border-profit/25 bg-gradient-to-br from-profit/4 to-transparent",
				isLoss && "border-loss/25 bg-gradient-to-br from-loss/4 to-transparent",
				!isProfit &&
					!isLoss &&
					"border-white/15 bg-gradient-to-br from-white/3 to-transparent",
				className,
			)}
		>
			{/* Subtle corner glow */}
			<div
				className={cn(
					"pointer-events-none absolute top-0 right-0 h-32 w-32 blur-2xl",
					isProfit && "bg-profit/10",
					isLoss && "bg-loss/10",
					!isProfit && !isLoss && "bg-primary/5",
				)}
			/>

			<div className="relative grid grid-cols-3 gap-8 text-center">
				{/* Net P&L */}
				<div>
					<p
						className={cn(
							"font-bold font-mono text-4xl tracking-tight",
							isProfit && "text-profit",
							isLoss && "text-loss",
							!isProfit && !isLoss && "text-muted-foreground",
						)}
					>
						{pnlValue !== null ? (
							<>
								{pnlValue >= 0 ? "+" : ""}
								{formatCurrency(pnlValue)}
							</>
						) : (
							"—"
						)}
					</p>
					<p className="mt-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
						Net P&L
					</p>
				</div>

				{/* R-Multiple */}
				<div>
					<p
						className={cn(
							"font-mono text-3xl",
							rMultiple !== null && rMultiple >= 0 && "text-profit/80",
							rMultiple !== null && rMultiple < 0 && "text-loss/80",
							rMultiple === null && "text-muted-foreground",
						)}
					>
						{rMultiple !== null ? (
							<>
								{rMultiple >= 0 ? "+" : ""}
								{rMultiple.toFixed(2)}R
							</>
						) : (
							"—"
						)}
					</p>
					<p className="mt-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
						R-Multiple
					</p>
				</div>

				{/* Target Hit or R:R Ratio */}
				<div>
					{targetHitPercent !== null ? (
						<>
							<p className="font-mono text-3xl">
								{targetHitPercent.toFixed(0)}%
							</p>
							<p className="mt-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
								Target Hit
							</p>
						</>
					) : rrRatio !== null ? (
						<>
							<p className="font-mono text-3xl">1:{rrRatio.toFixed(1)}</p>
							<p className="mt-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
								R:R Ratio
							</p>
						</>
					) : (
						<>
							<p className="font-mono text-3xl text-muted-foreground">—</p>
							<p className="mt-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
								R:R Ratio
							</p>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
