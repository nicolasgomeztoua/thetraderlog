import { AlertTriangle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface DrawdownPeriod {
	startDate: string;
	troughDate: string;
	recoveryDate: string | null;
	peakEquity: number;
	troughEquity: number;
	drawdownAmount: number;
	drawdownPercent: number;
	tradesInDrawdown: number;
	daysToTrough: number;
	daysToRecover: number | null;
	totalDays: number | null;
}

interface DrawdownTableProps {
	data: DrawdownPeriod[];
	className?: string;
}

/**
 * Format date string to display format
 */
function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "2-digit",
	});
}

/**
 * Format duration in days
 */
function formatDuration(days: number | null): string {
	if (days === null) return "—";
	if (days === 0) return "<1d";
	if (days === 1) return "1 day";
	return `${days} days`;
}

/**
 * Get severity class based on drawdown amount (relative to max)
 */
function getSeverityClass(amount: number, maxAmount: number): string {
	if (maxAmount === 0) return "text-muted-foreground";
	const ratio = amount / maxAmount;
	if (ratio >= 0.8) return "text-loss"; // Top 20% = severe
	if (ratio >= 0.5) return "text-orange-500"; // Top 50% = warning
	if (ratio >= 0.25) return "text-breakeven"; // Top 25% = moderate
	return "text-muted-foreground"; // Minor
}

/**
 * Terminal-styled drawdown periods table
 * Shows top drawdowns sorted by depth with recovery status
 */
export function DrawdownTable({ data, className }: DrawdownTableProps) {
	if (data.length === 0) {
		return (
			<div
				className={cn(
					"flex h-[200px] flex-col items-center justify-center gap-2 rounded border border-profit/30 bg-profit/5 font-mono text-sm",
					className,
				)}
			>
				<span className="text-profit">No Drawdowns</span>
				<span className="text-muted-foreground text-xs">
					All trades have been profitable!
				</span>
			</div>
		);
	}

	return (
		<div className={cn("space-y-3", className)}>
			{/* Summary */}
			<div className="flex items-center justify-between font-mono text-xs">
				<div className="flex items-center gap-2 text-muted-foreground">
					<AlertTriangle className="h-3.5 w-3.5 text-loss" />
					<span>
						{data.length} drawdown{data.length !== 1 ? " periods" : " period"}{" "}
						recorded
					</span>
				</div>
				{data[0] && (
					<div className="text-loss">
						Max: -{formatCurrency(data[0].drawdownAmount)}
					</div>
				)}
			</div>

			{/* Table */}
			<div className="overflow-hidden rounded border border-border">
				<div className="overflow-x-auto">
					<table className="w-full text-left font-mono text-xs">
						<thead>
							<tr className="border-border border-b bg-secondary/50 text-muted-foreground">
								<th className="whitespace-nowrap px-3 py-2 font-medium">#</th>
								<th className="whitespace-nowrap px-3 py-2 font-medium">
									Amount
								</th>
								<th className="whitespace-nowrap px-3 py-2 font-medium">
									Start
								</th>
								<th className="whitespace-nowrap px-3 py-2 font-medium">
									Trough
								</th>
								<th className="whitespace-nowrap px-3 py-2 font-medium">
									Duration
								</th>
								<th className="whitespace-nowrap px-3 py-2 font-medium">
									Recovery
								</th>
								<th className="whitespace-nowrap px-3 py-2 font-medium">
									Trades
								</th>
								<th className="whitespace-nowrap px-3 py-2 font-medium">
									Status
								</th>
							</tr>
						</thead>
						<tbody>
							{data.map((period, index) => {
								const isRecovered = period.recoveryDate !== null;
								const maxAmount = data[0]?.drawdownAmount ?? 0;
								const severityClass = getSeverityClass(
									period.drawdownAmount,
									maxAmount,
								);

								return (
									<tr
										className={cn(
											"border-border border-b transition-colors hover:bg-secondary/30",
											index === 0 && "bg-loss/5",
										)}
										key={`${period.startDate}-${period.drawdownAmount}`}
									>
										{/* Rank */}
										<td className="whitespace-nowrap px-3 py-2">
											<span
												className={cn(
													"inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
													index === 0
														? "bg-loss/20 text-loss"
														: "bg-secondary text-muted-foreground",
												)}
											>
												{index + 1}
											</span>
										</td>

										{/* Amount $ */}
										<td
											className={cn(
												"whitespace-nowrap px-3 py-2 font-medium",
												severityClass,
											)}
										>
											-{formatCurrency(period.drawdownAmount)}
										</td>

										{/* Start Date */}
										<td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
											{formatDate(period.startDate)}
										</td>

										{/* Trough Date */}
										<td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
											{formatDate(period.troughDate)}
										</td>

										{/* Duration (to trough) */}
										<td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
											{formatDuration(period.daysToTrough)}
										</td>

										{/* Recovery Time */}
										<td
											className={cn(
												"whitespace-nowrap px-3 py-2",
												isRecovered
													? "text-muted-foreground"
													: "text-breakeven",
											)}
										>
											{isRecovered
												? formatDuration(period.daysToRecover)
												: "Ongoing"}
										</td>

										{/* Trades in Drawdown */}
										<td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
											{period.tradesInDrawdown}
										</td>

										{/* Status */}
										<td className="whitespace-nowrap px-3 py-2">
											<span
												className={cn(
													"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
													isRecovered
														? "bg-profit/10 text-profit"
														: "bg-loss/10 text-loss",
												)}
											>
												{isRecovered ? "Recovered" : "Active"}
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* Footer note */}
			<div className="font-mono text-[10px] text-muted-foreground">
				Drawdowns sorted by depth · Recovery time = days from trough to new peak
			</div>
		</div>
	);
}
