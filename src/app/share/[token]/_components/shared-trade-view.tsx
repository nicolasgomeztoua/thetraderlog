"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ExecutionTimeline } from "@/components/trade-detail/execution-timeline";
import { TradeSummaryCard } from "@/components/trade-detail/trade-summary-card";
import { TradingViewChart } from "@/components/trade-detail/tradingview-chart";
import { useTimezone } from "@/hooks/use-timezone";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/shared";
import { calculateAllStats } from "@/lib/trades";
import type { SharedTradePayload } from "@/server/api/helpers/trade-share";
import { TRPCReactProvider } from "@/trpc/react";
import { SharedTradeNotes } from "./shared-trade-notes";

// =============================================================================
// TYPES
// =============================================================================

interface SharedTradeViewProps {
	token: string;
	trade: SharedTradePayload["trade"];
	trader: SharedTradePayload["trader"];
}

// =============================================================================
// SHARED TRADE VIEW — public, read-only
// =============================================================================

export function SharedTradeView({
	token,
	trade,
	trader,
}: SharedTradeViewProps) {
	const { formatDate, formatDateTime } = useTimezone();

	const stats =
		trade.status === "closed"
			? calculateAllStats({
					entryPrice: trade.entryPrice,
					exitPrice: trade.exitPrice,
					direction: trade.direction,
					quantity: trade.quantity,
					netPnl: trade.netPnl,
					fees: trade.fees,
					stopLoss: trade.stopLoss,
					takeProfit: trade.takeProfit,
					entryTime: trade.entryTime,
					exitTime: trade.exitTime,
					symbol: trade.symbol,
				})
			: null;

	const isLong = trade.direction === "long";
	const traderName = trader.name ?? "A TheTraderLog trader";
	const traderFirstName = trader.name?.split(" ")[0] ?? "this trader";
	const quantity = parseFloat(trade.quantity);

	return (
		// The shared trade chart (TradingViewChart) uses tRPC hooks to fetch its
		// candles through the public, token-gated `sharing.getTradeChartData`
		// endpoint. Public share routes have no tRPC provider (the protected/admin
		// layouts do), so scope one here — otherwise the chart throws
		// "Unable to find tRPC Context" and 500s the whole page.
		<TRPCReactProvider>
			<div className="min-h-screen bg-background text-foreground">
				<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
					{/* ============================================================
				    BRANDED TOP BAR
				    ============================================================ */}
					<div className="flex items-center justify-between gap-3 border-white/10 border-b pb-4">
						<div className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
							<span className="shrink-0 font-bold text-primary">TRADERLOG</span>
							<span className="hidden text-muted-foreground sm:inline">
								{"// "}
							</span>
							<span className="hidden truncate text-muted-foreground sm:inline">
								SHARED TRADE
							</span>
						</div>
						<Link
							className="shrink-0 whitespace-nowrap rounded border border-primary/30 bg-primary/5 px-3 py-1.5 font-mono text-[10px] text-primary uppercase tracking-wider transition-colors hover:bg-primary/10"
							href="/sign-up"
						>
							Start your journal
						</Link>
					</div>

					{/* ============================================================
				    TRADER IDENTITY (social proof)
				    ============================================================ */}
					<div className="mt-6 flex items-center gap-3">
						{trader.imageUrl ? (
							// biome-ignore lint/performance/noImgElement: avatar host is dynamic (Clerk CDN), not worth next/image config
							<img
								alt={traderName}
								className="size-10 rounded-full border border-white/10"
								src={trader.imageUrl}
							/>
						) : (
							<div className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-bold font-mono text-primary text-sm">
								{traderName.charAt(0).toUpperCase()}
							</div>
						)}
						<div>
							<p className="font-bold font-mono text-foreground text-sm">
								{traderName}
							</p>
							<p className="font-mono text-[10px] text-muted-foreground">
								shared this trade from their journal
							</p>
						</div>
					</div>

					{/* ============================================================
				    TRADE HEADER
				    ============================================================ */}
					<div className="mt-6 flex flex-wrap items-center gap-2">
						<span className="rounded-sm border border-border/50 bg-muted/50 px-2.5 py-1 font-bold font-mono text-base tracking-tight">
							{trade.symbol}
						</span>
						<span
							className={cn(
								"flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
								isLong
									? "border-profit/30 bg-profit/5 text-profit"
									: "border-loss/30 bg-loss/5 text-loss",
							)}
						>
							{isLong ? (
								<ArrowUpRight className="size-3" />
							) : (
								<ArrowDownRight className="size-3" />
							)}
							{trade.direction}
						</span>
						<span className="rounded-sm border border-border/50 px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							{trade.status}
						</span>
						<span className="font-mono text-[10px] text-muted-foreground">
							{formatDate(trade.entryTime)}
							{stats?.duration && (
								<span className="text-muted-foreground/50">
									{" "}
									· {stats.duration}
								</span>
							)}
						</span>
					</div>

					{/* ============================================================
				    P&L SUMMARY
				    ============================================================ */}
					<TradeSummaryCard
						className="mt-4"
						netPnl={trade.netPnl}
						risk={stats?.risk ?? null}
						rMultiple={stats?.rMultiple ?? null}
						status={trade.status}
						targetHitPercent={null}
					/>

					{/* ============================================================
				    CHART
				    ============================================================ */}
					<div className="mt-4 h-[420px] overflow-hidden rounded-sm border border-border/50 bg-muted/20 sm:h-[500px]">
						<TradingViewChart
							direction={trade.direction}
							entryTime={trade.entryTime}
							executions={trade.executions}
							exitTime={trade.exitTime}
							maePrice={trade.maePrice}
							mfePrice={trade.mfePrice}
							shareToken={token}
							status={trade.status}
							stopLoss={trade.stopLoss}
							symbol={trade.symbol}
							takeProfit={trade.takeProfit}
							tradeId={token}
							trailedStopLoss={trade.trailedStopLoss}
							wasTrailed={trade.wasTrailed ?? undefined}
						/>
					</div>

					{/* ============================================================
				    DETAILS + EXECUTIONS
				    ============================================================ */}
					<div className="mt-4 grid gap-4 md:grid-cols-2">
						{/* Trade details */}
						<section className="rounded-sm border border-border/50 bg-muted/50 p-4">
							<h2 className="mb-3 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
								Trade Details
							</h2>
							<dl className="space-y-2">
								<DetailRow
									label="Entry"
									value={`${formatNumber(parseFloat(trade.entryPrice))} · ${formatDateTime(trade.entryTime)}`}
								/>
								<DetailRow
									label="Exit"
									value={
										trade.exitPrice && trade.exitTime
											? `${formatNumber(parseFloat(trade.exitPrice))} · ${formatDateTime(trade.exitTime)}`
											: null
									}
								/>
								<DetailRow
									label="Size"
									value={`${formatNumber(quantity, Number.isInteger(quantity) ? 0 : 2)} ${quantity === 1 ? "contract" : "contracts"}`}
								/>
								<DetailRow
									label="Stop Loss"
									value={
										trade.stopLoss
											? `${formatNumber(parseFloat(trade.stopLoss))}${
													trade.wasTrailed && trade.trailedStopLoss
														? ` → ${formatNumber(parseFloat(trade.trailedStopLoss))} (trailed)`
														: ""
												}${trade.stopLossHit ? " · hit" : ""}`
											: null
									}
								/>
								<DetailRow
									label="Take Profit"
									value={
										trade.takeProfit
											? `${formatNumber(parseFloat(trade.takeProfit))}${trade.takeProfitHit ? " · hit" : ""}`
											: null
									}
								/>
								<DetailRow
									label="Points"
									value={
										stats?.points != null
											? `${stats.points >= 0 ? "+" : ""}${formatNumber(stats.points)}`
											: null
									}
								/>
								<DetailRow
									label="Ticks"
									value={
										stats?.ticks != null
											? `${stats.ticks >= 0 ? "+" : ""}${formatNumber(stats.ticks, 0)}`
											: null
									}
								/>
								<DetailRow
									label="Fees"
									value={
										trade.fees ? formatCurrency(parseFloat(trade.fees)) : null
									}
								/>
								<DetailRow
									label="ROI"
									value={stats?.roi != null ? formatPercent(stats.roi) : null}
								/>
								<DetailRow
									label="MAE"
									value={
										trade.maeAmount
											? formatCurrency(parseFloat(trade.maeAmount))
											: null
									}
								/>
								<DetailRow
									label="MFE"
									value={
										trade.mfeAmount
											? formatCurrency(parseFloat(trade.mfeAmount))
											: null
									}
								/>
							</dl>
						</section>

						{/* Executions + setup */}
						<div className="space-y-4">
							{trade.executions.length > 0 && (
								<section className="rounded-sm border border-border/50 bg-muted/50 p-4">
									<h2 className="mb-3 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
										Executions
									</h2>
									<ExecutionTimeline executions={trade.executions} />
								</section>
							)}

							{(trade.strategyName ||
								trade.setupType ||
								trade.rating != null ||
								trade.tags.length > 0) && (
								<section className="rounded-sm border border-border/50 bg-muted/50 p-4">
									<h2 className="mb-3 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
										Setup
									</h2>
									<dl className="space-y-2">
										<DetailRow label="Strategy" value={trade.strategyName} />
										<DetailRow label="Setup Type" value={trade.setupType} />
										<DetailRow
											label="Rating"
											value={trade.rating != null ? `${trade.rating}/5` : null}
										/>
									</dl>
									{trade.tags.length > 0 && (
										<div className="mt-3 flex flex-wrap gap-1.5">
											{trade.tags.map((tag) => (
												<span
													className="flex items-center gap-1.5 rounded-sm border border-border/50 bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
													key={tag.id}
												>
													<span
														className="size-1.5 rounded-full"
														style={{ backgroundColor: tag.color ?? "#6366f1" }}
													/>
													{tag.name}
												</span>
											))}
										</div>
									)}
								</section>
							)}
						</div>
					</div>

					{/* ============================================================
				    NOTES
				    ============================================================ */}
					{trade.notes && (
						<section className="mt-4 rounded-sm border border-border/50 bg-muted/50 p-4">
							<h2 className="mb-3 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
								Notes
							</h2>
							<SharedTradeNotes html={trade.notes} />
						</section>
					)}

					{/* ============================================================
				    CTA — social proof footer
				    ============================================================ */}
					<div className="relative mt-8 overflow-hidden rounded-sm border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-8 text-center">
						<div className="pointer-events-none absolute top-0 right-0 h-32 w-32 bg-gradient-to-bl from-primary/10 to-transparent blur-2xl" />
						<p className="relative font-mono text-[10px] text-primary uppercase tracking-widest">
							Journal · Review · Improve
						</p>
						<h3 className="relative mt-3 font-bold text-foreground text-xl tracking-tight sm:text-2xl">
							Track your trades like {traderFirstName}
						</h3>
						<p className="relative mx-auto mt-2 max-w-md font-mono text-muted-foreground text-xs leading-relaxed">
							TheTraderLog is the professional journal for futures traders —
							replay charts, automatic imports, and AI-powered insights.
						</p>
						<Link
							className="group relative mt-6 inline-flex items-center gap-2 rounded bg-primary px-6 py-2.5 font-mono text-primary-foreground text-xs uppercase tracking-wider transition-colors hover:bg-primary/90"
							href="/sign-up"
						>
							Start Free
							<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
						</Link>
					</div>

					{/* Footer */}
					<div className="mt-8 border-white/10 border-t pt-6 text-center">
						<p className="font-mono text-[10px] text-muted-foreground">
							Shared via{" "}
							<Link
								className="text-primary transition-colors hover:text-accent"
								href="/"
							>
								TheTraderLog
							</Link>{" "}
							— the trading journal for futures traders
						</p>
					</div>
				</div>
			</div>
		</TRPCReactProvider>
	);
}

// =============================================================================
// DETAIL ROW
// =============================================================================

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: string | null | undefined;
}) {
	if (!value) return null;

	return (
		<div className="flex items-baseline justify-between gap-4">
			<dt className="shrink-0 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
				{label}
			</dt>
			<dd className="text-right font-mono text-foreground text-xs">{value}</dd>
		</div>
	);
}
