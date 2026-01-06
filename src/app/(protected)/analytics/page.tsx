"use client";

import { AgCharts } from "ag-charts-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AnalyticsQueryBar,
	BehavioralMetrics,
	CalendarHeatmap,
	DayOfWeekChart,
	DrawdownTable,
	EquityCurve,
	ExportButton,
	HoldingTimeChart,
	HourHeatmap,
	KellyDisplay,
	ManagePresetsDialog,
	METRIC_TOOLTIPS,
	MetricCard,
	MonthlyChart,
	OvertradingChart,
	PositionSizeChart,
	RevengeTradingPanel,
	RiskGauge,
	RiskRewardPanel,
	RMultipleChart,
	SessionChart,
	StreakChart,
	SymbolDistributionChart,
	SymbolTable,
	SymbolTrendChart,
} from "@/components/analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "@/contexts/account-context";
import { useTimezone } from "@/hooks/use-timezone";
import {
	formatCurrency,
	formatDate,
	formatPercent,
	getPnLColorClass,
} from "@/lib/shared";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";
import { api } from "@/trpc/react";
import type { AnalyticsFilters } from "@/types/analytics-filters";

// =============================================================================
// FILTER CONVERSION HELPER
// Converts Zustand store filters to API input format
// =============================================================================

function useApiFilters() {
	const { filters } = useAnalyticsFilterStore();

	return useMemo(() => {
		// Convert store filters to API format
		return {
			symbols: filters.symbols.length > 0 ? filters.symbols : undefined,
			dateRange:
				filters.dateRange.start || filters.dateRange.end
					? {
							start: filters.dateRange.start?.toISOString() ?? null,
							end: filters.dateRange.end?.toISOString() ?? null,
						}
					: undefined,
			daysOfWeek:
				filters.daysOfWeek.length > 0 ? filters.daysOfWeek : undefined,
			hours: filters.hours.length > 0 ? filters.hours : undefined,
			sessions: filters.sessions.length > 0 ? filters.sessions : undefined,
			strategies:
				filters.strategies.length > 0 ? filters.strategies : undefined,
			tags: filters.tags.length > 0 ? filters.tags : undefined,
			rMultipleRange:
				filters.rMultipleRange.min !== null ||
				filters.rMultipleRange.max !== null
					? filters.rMultipleRange
					: undefined,
			positionSizeRange:
				filters.positionSizeRange.min !== null ||
				filters.positionSizeRange.max !== null
					? filters.positionSizeRange
					: undefined,
			outcome: filters.outcome !== "all" ? filters.outcome : undefined,
			reviewed: filters.reviewed !== "all" ? filters.reviewed : undefined,
		};
	}, [filters]);
}

// =============================================================================
// OVERVIEW TAB
// =============================================================================

function StatsOverview() {
	const { selectedAccountId } = useAccount();
	const apiFilters = useApiFilters();
	const { data: overview, isLoading } = api.analytics.getOverview.useQuery({
		accountId: selectedAccountId,
		filters: apiFilters,
	});

	if (isLoading) {
		return (
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{[...Array(8)].map((_, i) => (
					<div
						className="rounded border border-border bg-secondary p-4"
						key={`skeleton-stat-${i.toString()}`}
					>
						<Skeleton className="mb-3 h-3 w-16" />
						<Skeleton className="mb-2 h-6 w-24" />
						<Skeleton className="h-2 w-14" />
					</div>
				))}
			</div>
		);
	}

	if (!overview) return null;

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{/* Row 1: Core metrics */}
			<MetricCard
				colorClass={getPnLColorClass(overview.totalPnl)}
				description={`${overview.totalTrades} closed trades`}
				title="Total P&L"
				tooltip={METRIC_TOOLTIPS.totalPnl}
				value={formatCurrency(overview.totalPnl)}
			/>
			<MetricCard
				colorClass={overview.winRate >= 50 ? "text-profit" : "text-loss"}
				description={`${overview.wins}W / ${overview.losses}L`}
				title="Win Rate"
				tooltip={METRIC_TOOLTIPS.winRate}
				value={formatPercent(overview.winRate, 1).replace("+", "")}
			/>
			<MetricCard
				colorClass={overview.profitFactor >= 1 ? "text-profit" : "text-loss"}
				description="Gross profit / loss"
				title="Profit Factor"
				tooltip={METRIC_TOOLTIPS.profitFactor}
				value={
					overview.profitFactor === Infinity
						? "∞"
						: overview.profitFactor.toFixed(2)
				}
			/>
			<MetricCard
				colorClass={getPnLColorClass(overview.avgPnl)}
				description={`Avg win: ${formatCurrency(overview.avgWin)}`}
				title="Avg Trade"
				tooltip={METRIC_TOOLTIPS.avgTrade}
				value={formatCurrency(overview.avgPnl)}
			/>

			{/* Row 2: Advanced metrics */}
			<MetricCard
				colorClass={getPnLColorClass(overview.expectancy)}
				description="Expected profit per trade"
				title="Expectancy"
				tooltip={METRIC_TOOLTIPS.expectancy}
				value={formatCurrency(overview.expectancy)}
			/>
			<MetricCard
				colorClass={overview.payoffRatio >= 1 ? "text-profit" : "text-loss"}
				description="Avg win / avg loss"
				title="Payoff Ratio"
				tooltip={METRIC_TOOLTIPS.payoffRatio}
				value={
					overview.payoffRatio === Infinity
						? "∞"
						: overview.payoffRatio.toFixed(2)
				}
			/>
			<MetricCard
				colorClass={
					overview.sharpeRatio >= 1
						? "text-profit"
						: overview.sharpeRatio >= 0
							? "text-breakeven"
							: "text-loss"
				}
				description="Risk-adjusted return"
				title="Sharpe Ratio"
				tooltip={METRIC_TOOLTIPS.sharpeRatio}
				value={overview.sharpeRatio.toFixed(2)}
			/>
			<MetricCard
				colorClass={
					overview.currentStreakType === "win"
						? "text-profit"
						: overview.currentStreakType === "loss"
							? "text-loss"
							: "text-muted-foreground"
				}
				description={
					overview.currentStreakType === "win"
						? "Consecutive wins"
						: overview.currentStreakType === "loss"
							? "Consecutive losses"
							: "No active streak"
				}
				title="Current Streak"
				tooltip={METRIC_TOOLTIPS.currentStreak}
				value={
					overview.currentStreakType === "none"
						? "—"
						: `${overview.currentStreak}${overview.currentStreakType === "win" ? "W" : "L"}`
				}
			/>
		</div>
	);
}

// =============================================================================
// CHARTS
// =============================================================================

function WinLossChart() {
	const { selectedAccountId } = useAccount();
	const apiFilters = useApiFilters();
	const { data: overview, isLoading } = api.analytics.getOverview.useQuery({
		accountId: selectedAccountId,
		filters: apiFilters,
	});

	const chartOptions = useMemo(() => {
		if (!overview) return {};

		return {
			background: { fill: "transparent" },
			data: [
				{ category: "Wins", value: overview.wins, color: "#00ff88" },
				{ category: "Losses", value: overview.losses, color: "#ff3b3b" },
				{ category: "Breakeven", value: overview.breakevens, color: "#fbbf24" },
			],
			series: [
				{
					type: "donut" as const,
					angleKey: "value",
					calloutLabelKey: "category",
					sectorLabelKey: "value",
					fills: ["#00ff88", "#ff3b3b", "#fbbf24"],
					innerRadiusRatio: 0.6,
				},
			],
			legend: {
				position: "bottom" as const,
				item: {
					label: {
						color: "#94a3b8",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 10,
					},
				},
			},
		};
	}, [overview]);

	if (isLoading) {
		return <Skeleton className="h-[300px] w-full" />;
	}

	if (!overview || overview.totalTrades === 0) {
		return (
			<div className="flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs">
				No trade data available
			</div>
		);
	}

	// biome-ignore lint/suspicious/noExplicitAny: ag-charts has complex typing
	return <AgCharts options={chartOptions as any} style={{ height: 300 }} />;
}

function PnLDistributionChart() {
	const { selectedAccountId } = useAccount();
	const { data, isLoading } = api.trades.getAll.useQuery({
		status: "closed",
		accountId: selectedAccountId ?? undefined,
		limit: 100,
	});

	const chartOptions = useMemo(() => {
		if (!data?.items) return {};

		const trades = data.items
			.filter((t) => t.netPnl)
			.map((t, i) => ({
				trade: i + 1,
				pnl: parseFloat(t.netPnl ?? "0"),
				color: parseFloat(t.netPnl ?? "0") >= 0 ? "#00ff88" : "#ff3b3b",
			}));

		return {
			background: { fill: "transparent" },
			data: trades.slice(0, 50),
			series: [
				{
					type: "bar" as const,
					xKey: "trade",
					yKey: "pnl",
					fill: "#00ff88",
					cornerRadius: 2,
					formatter: (params: { datum: { pnl: number } }) => ({
						fill: params.datum.pnl >= 0 ? "#00ff88" : "#ff3b3b",
					}),
				},
			],
			axes: [
				{
					type: "category" as const,
					position: "bottom" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
					},
					line: { color: "#1e293b" },
				},
				{
					type: "number" as const,
					position: "left" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						formatter: (params: { value: number }) => `$${params.value}`,
					},
					line: { color: "#1e293b" },
					gridLine: { style: [{ stroke: "#ffffff08" }] },
				},
			],
		};
	}, [data]);

	if (isLoading) {
		return <Skeleton className="h-[300px] w-full" />;
	}

	if (!data?.items || data.items.length === 0) {
		return (
			<div className="flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs">
				No trade data available
			</div>
		);
	}

	// biome-ignore lint/suspicious/noExplicitAny: ag-charts has complex typing
	return <AgCharts options={chartOptions as any} style={{ height: 300 }} />;
}

function CumulativePnLChart() {
	const { selectedAccountId } = useAccount();
	const { data, isLoading } = api.trades.getAll.useQuery({
		status: "closed",
		accountId: selectedAccountId ?? undefined,
		limit: 100,
	});

	const chartOptions = useMemo(() => {
		if (!data?.items) return {};

		let cumulative = 0;
		const trades = data.items
			.filter((t) => t.netPnl)
			.reverse()
			.map((t, i) => {
				cumulative += parseFloat(t.netPnl ?? "0");
				return {
					trade: i + 1,
					pnl: cumulative,
					date: t.exitTime ? formatDate(t.exitTime) : "",
				};
			});

		return {
			background: { fill: "transparent" },
			data: trades,
			series: [
				{
					type: "area" as const,
					xKey: "trade",
					yKey: "pnl",
					fill: "#00ff8820",
					stroke: "#00ff88",
					strokeWidth: 2,
					marker: { enabled: false },
				},
			],
			axes: [
				{
					type: "category" as const,
					position: "bottom" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
					},
					line: { color: "#1e293b" },
				},
				{
					type: "number" as const,
					position: "left" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						formatter: (params: { value: number }) => `$${params.value}`,
					},
					line: { color: "#1e293b" },
					gridLine: { style: [{ stroke: "#ffffff08" }] },
				},
			],
		};
	}, [data]);

	if (isLoading) {
		return <Skeleton className="h-[300px] w-full" />;
	}

	if (!data?.items || data.items.length === 0) {
		return (
			<div className="flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs">
				No trade data available
			</div>
		);
	}

	// biome-ignore lint/suspicious/noExplicitAny: ag-charts has complex typing
	return <AgCharts options={chartOptions as any} style={{ height: 300 }} />;
}

// =============================================================================
// TERMINAL WRAPPER
// =============================================================================

function ChartTerminal({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<div className="overflow-hidden rounded border border-border bg-card">
			{/* Terminal header */}
			<div className="flex items-center justify-between border-border border-b bg-secondary px-4 py-2">
				<div className="flex items-center gap-2">
					<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
					<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
					<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
				</div>
				<div className="text-center">
					<span className="font-mono text-[10px] text-muted-foreground">
						{title.toLowerCase().replace(/\s+/g, "-")}
					</span>
				</div>
				<div className="w-14" />
			</div>
			{/* Chart header */}
			<div className="border-border border-b px-4 py-3">
				<h3 className="font-medium text-sm">{title}</h3>
				<p className="font-mono text-[10px] text-muted-foreground">
					{description}
				</p>
			</div>
			{/* Chart content */}
			<div className="p-4">{children}</div>
		</div>
	);
}

// =============================================================================
// TIME TAB
// =============================================================================

function TimeTab() {
	const { timezoneAbbr } = useTimezone();
	const { selectedAccountId } = useAccount();
	const apiFilters = useApiFilters();

	const { data: calendarData, isLoading: calendarLoading } =
		api.analytics.getCalendarData.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: dayOfWeekData, isLoading: dowLoading } =
		api.analytics.getPerformanceByDayOfWeek.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: hourData, isLoading: hourLoading } =
		api.analytics.getPerformanceByHour.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: sessionData, isLoading: sessionLoading } =
		api.analytics.getPerformanceBySession.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: monthlyData, isLoading: monthlyLoading } =
		api.analytics.getPerformanceByMonth.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});

	const isLoading =
		calendarLoading ||
		dowLoading ||
		hourLoading ||
		sessionLoading ||
		monthlyLoading;

	if (isLoading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-[200px] w-full" />
				<div className="grid gap-6 lg:grid-cols-2">
					<Skeleton className="h-[300px] w-full" />
					<Skeleton className="h-[300px] w-full" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Calendar Heatmap */}
			<ChartTerminal
				description="Daily P&L over the last year"
				title="Trading Calendar"
			>
				<CalendarHeatmap data={calendarData ?? []} />
			</ChartTerminal>

			{/* Day of Week & Hour Analysis */}
			<div className="grid gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Performance breakdown by weekday"
					title="Day of Week"
				>
					<DayOfWeekChart data={dayOfWeekData ?? []} />
				</ChartTerminal>

				<ChartTerminal
					description={`Performance by entry hour (${timezoneAbbr})`}
					title="Hourly Performance"
				>
					<HourHeatmap data={hourData ?? []} />
				</ChartTerminal>
			</div>

			{/* Session & Monthly Analysis */}
			<div className="grid gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Performance by trading session"
					title="Trading Sessions"
				>
					<SessionChart data={sessionData ?? []} />
				</ChartTerminal>

				<ChartTerminal
					description="Month-over-month performance"
					title="Monthly P&L"
				>
					<MonthlyChart data={monthlyData ?? []} />
				</ChartTerminal>
			</div>
		</div>
	);
}

// =============================================================================
// RISK TAB
// =============================================================================

function RiskTab() {
	const { selectedAccountId } = useAccount();
	const apiFilters = useApiFilters();

	const { data: riskMetrics, isLoading: riskLoading } =
		api.analytics.getRiskMetrics.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: equityCurve, isLoading: equityLoading } =
		api.analytics.getEquityCurve.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: drawdowns, isLoading: drawdownsLoading } =
		api.analytics.getDrawdownHistory.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: rMultipleData, isLoading: rMultipleLoading } =
		api.analytics.getRMultipleDistribution.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: riskRewardData, isLoading: riskRewardLoading } =
		api.analytics.getRiskRewardAnalysis.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: positionSizeData, isLoading: positionSizeLoading } =
		api.analytics.getPositionSizeAnalysis.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});

	const isLoading =
		riskLoading ||
		equityLoading ||
		drawdownsLoading ||
		rMultipleLoading ||
		riskRewardLoading ||
		positionSizeLoading;

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[...Array(8)].map((_, i) => (
						<div
							className="rounded border border-border bg-secondary p-4"
							key={`skeleton-risk-${i.toString()}`}
						>
							<Skeleton className="mb-3 h-3 w-16" />
							<Skeleton className="mb-2 h-6 w-24" />
							<Skeleton className="h-2 w-14" />
						</div>
					))}
				</div>
				<Skeleton className="h-[300px] w-full" />
				<div className="grid gap-6 lg:grid-cols-2">
					<Skeleton className="h-[300px] w-full" />
					<Skeleton className="h-[300px] w-full" />
				</div>
				<Skeleton className="h-[250px] w-full" />
			</div>
		);
	}

	if (!riskMetrics) {
		return (
			<div className="flex h-[400px] items-center justify-center font-mono text-muted-foreground text-xs">
				No risk data available
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Risk metrics cards */}
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<MetricCard
					colorClass="text-loss"
					description={`Peak P&L: ${formatCurrency(riskMetrics.peakPnl)}`}
					title="Max Drawdown"
					tooltip={METRIC_TOOLTIPS.maxDrawdown}
					value={`-${formatCurrency(riskMetrics.maxDrawdown)}`}
				/>
				<MetricCard
					colorClass={
						riskMetrics.currentDrawdown > 0 ? "text-loss" : "text-profit"
					}
					description={
						riskMetrics.currentDrawdown > 0
							? "Currently in drawdown"
							: "At P&L peak"
					}
					title="Current DD"
					tooltip={METRIC_TOOLTIPS.maxDrawdown}
					value={
						riskMetrics.currentDrawdown > 0
							? `-${formatCurrency(riskMetrics.currentDrawdown)}`
							: "$0"
					}
				/>
				<MetricCard
					colorClass={
						riskMetrics.sortinoRatio >= 1
							? "text-profit"
							: riskMetrics.sortinoRatio >= 0
								? "text-breakeven"
								: "text-loss"
					}
					description="Downside risk-adjusted"
					title="Sortino Ratio"
					tooltip={METRIC_TOOLTIPS.sortinoRatio}
					value={
						riskMetrics.sortinoRatio === Infinity
							? "∞"
							: riskMetrics.sortinoRatio.toFixed(2)
					}
				/>
				<MetricCard
					colorClass={
						riskMetrics.calmarRatio >= 1
							? "text-profit"
							: riskMetrics.calmarRatio >= 0
								? "text-breakeven"
								: "text-loss"
					}
					description="Return / max DD"
					title="Calmar Ratio"
					tooltip={METRIC_TOOLTIPS.calmarRatio}
					value={
						riskMetrics.calmarRatio === Infinity
							? "∞"
							: riskMetrics.calmarRatio.toFixed(2)
					}
				/>

				{/* Row 2 */}
				<MetricCard
					colorClass={
						riskMetrics.recoveryFactor >= 1 ? "text-profit" : "text-breakeven"
					}
					description="Net profit / max DD"
					title="Recovery Factor"
					tooltip={METRIC_TOOLTIPS.recoveryFactor}
					value={
						riskMetrics.recoveryFactor === Infinity
							? "∞"
							: riskMetrics.recoveryFactor.toFixed(2)
					}
				/>
				<MetricCard
					colorClass={
						riskMetrics.ulcerIndex < 5
							? "text-profit"
							: riskMetrics.ulcerIndex < 15
								? "text-breakeven"
								: "text-loss"
					}
					description="Drawdown depth × duration"
					title="Ulcer Index"
					tooltip={METRIC_TOOLTIPS.ulcerIndex}
					value={riskMetrics.ulcerIndex.toFixed(2)}
				/>
				<MetricCard
					colorClass="text-muted-foreground"
					description={`${riskMetrics.numberOfDrawdowns} periods recorded`}
					title="Drawdowns"
					tooltip={METRIC_TOOLTIPS.maxDrawdown}
					value={riskMetrics.numberOfDrawdowns.toString()}
				/>
				<MetricCard
					colorClass={
						riskMetrics.percentTimeInDrawdown < 30
							? "text-profit"
							: riskMetrics.percentTimeInDrawdown < 60
								? "text-breakeven"
								: "text-loss"
					}
					description="Trades in drawdown"
					title="Time in DD"
					tooltip={METRIC_TOOLTIPS.maxDrawdown}
					value={`${formatPercent(riskMetrics.percentTimeInDrawdown, 0).replace("+", "")}`}
				/>
			</div>

			{/* Cumulative P&L Curve */}
			<ChartTerminal
				description="Running profit/loss with drawdown periods highlighted"
				title="Cumulative P&L"
			>
				<EquityCurve data={equityCurve ?? []} />
			</ChartTerminal>

			{/* R-Multiple Distribution + Risk/Reward Analysis - side by side */}
			<div className="grid gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Distribution of trades by R-multiple"
					title="R-Multiple Distribution"
				>
					<RMultipleChart
						buckets={rMultipleData?.buckets ?? []}
						stats={
							rMultipleData?.stats ?? {
								totalTrades: 0,
								tradesWithR: 0,
								avgRMultiple: 0,
								avgWinR: 0,
								avgLossR: 0,
								maxR: 0,
								minR: 0,
							}
						}
					/>
				</ChartTerminal>

				<ChartTerminal
					description="Planned vs actual risk/reward"
					title="Risk/Reward Analysis"
				>
					<RiskRewardPanel
						categories={riskRewardData?.categories ?? []}
						summary={
							riskRewardData?.summary ?? {
								totalTrades: 0,
								tradesWithSL: 0,
								tradesWithBoth: 0,
								avgRMultiple: 0,
								avgPlannedRR: 0,
								avgEfficiency: 0,
								winRate: 0,
								wins: 0,
								losses: 0,
							}
						}
					/>
				</ChartTerminal>
			</div>

			{/* Risk of Ruin and Kelly - side by side */}
			<div className="grid gap-6 lg:grid-cols-2">
				<ChartTerminal
					description={`Probability of hitting ${riskMetrics.ruinThresholdPercent.toFixed(0)}% drawdown`}
					title="Risk of Ruin"
				>
					<RiskGauge
						riskOfRuin={riskMetrics.riskOfRuin}
						riskPerTradePercent={riskMetrics.riskPerTradePercent}
						riskPerTradeSource={riskMetrics.riskPerTradeSource}
						ruinThresholdPercent={riskMetrics.ruinThresholdPercent}
						ruinThresholdSource={riskMetrics.ruinThresholdSource}
					/>
				</ChartTerminal>

				<ChartTerminal
					description="Optimal position size based on your edge"
					title="Kelly Criterion"
				>
					<KellyDisplay
						avgLoss={riskMetrics.avgLoss}
						avgWin={riskMetrics.avgWin}
						halfKellyPercent={riskMetrics.halfKellyPercent}
						kellyPercent={riskMetrics.kellyPercent}
						winRate={riskMetrics.winRate}
					/>
				</ChartTerminal>
			</div>

			{/* Position Sizing Analysis */}
			<ChartTerminal
				description="Performance by position size"
				title="Position Sizing Analysis"
			>
				<PositionSizeChart
					buckets={positionSizeData?.buckets ?? []}
					stats={
						positionSizeData?.stats ?? {
							totalTrades: 0,
							avgSize: 0,
							minSize: 0,
							maxSize: 0,
						}
					}
				/>
			</ChartTerminal>

			{/* Drawdown History Table */}
			<ChartTerminal
				description="Top drawdown periods sorted by depth"
				title="Drawdown History"
			>
				<DrawdownTable data={drawdowns ?? []} />
			</ChartTerminal>
		</div>
	);
}

// =============================================================================
// SYMBOLS TAB
// =============================================================================

function SymbolsTab() {
	const { selectedAccountId } = useAccount();
	const apiFilters = useApiFilters();

	const { data: symbolData, isLoading: symbolLoading } =
		api.analytics.getPerformanceBySymbol.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: trendData, isLoading: trendLoading } =
		api.analytics.getSymbolTrend.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});

	const isLoading = symbolLoading || trendLoading;

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="grid gap-6 lg:grid-cols-2">
					<Skeleton className="h-[400px] w-full" />
					<Skeleton className="h-[400px] w-full" />
				</div>
				<Skeleton className="h-[400px] w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Top row: Table and Distribution */}
			<div className="grid gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Performance metrics for each traded symbol"
					title="Symbol Performance"
				>
					<SymbolTable data={symbolData ?? []} />
				</ChartTerminal>

				<ChartTerminal
					description="Trade distribution across symbols"
					title="Symbol Distribution"
				>
					<SymbolDistributionChart data={symbolData ?? []} />
				</ChartTerminal>
			</div>

			{/* Trend Chart - full width */}
			<ChartTerminal
				description="P&L trends by symbol over time"
				title="Symbol Trends"
			>
				<SymbolTrendChart
					months={trendData?.months ?? []}
					symbols={trendData?.symbols ?? []}
				/>
			</ChartTerminal>
		</div>
	);
}

// =============================================================================
// BEHAVIOR TAB
// =============================================================================

function BehaviorTab() {
	const { selectedAccountId } = useAccount();
	const apiFilters = useApiFilters();

	const { data: streakData, isLoading: streakLoading } =
		api.analytics.getStreakAnalysis.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: revengeData, isLoading: revengeLoading } =
		api.analytics.getRevengeTrading.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: overtradingData, isLoading: overtradingLoading } =
		api.analytics.getOvertradingAnalysis.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: holdingTimeData, isLoading: holdingTimeLoading } =
		api.analytics.getHoldingTimeAnalysis.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});
	const { data: behavioralData, isLoading: behavioralLoading } =
		api.analytics.getBehavioralPatterns.useQuery({
			accountId: selectedAccountId,
			filters: apiFilters,
		});

	const isLoading =
		streakLoading ||
		revengeLoading ||
		overtradingLoading ||
		holdingTimeLoading ||
		behavioralLoading;

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="grid gap-3 sm:grid-cols-3">
					{[...Array(3)].map((_, i) => (
						<div
							className="rounded border border-border bg-secondary p-4"
							key={`skeleton-behavior-${i.toString()}`}
						>
							<Skeleton className="mb-3 h-3 w-16" />
							<Skeleton className="mb-2 h-6 w-24" />
							<Skeleton className="h-2 w-14" />
						</div>
					))}
				</div>
				<div className="grid gap-6 lg:grid-cols-2">
					<Skeleton className="h-[400px] w-full" />
					<Skeleton className="h-[400px] w-full" />
				</div>
				<div className="grid gap-6 lg:grid-cols-2">
					<Skeleton className="h-[400px] w-full" />
					<Skeleton className="h-[400px] w-full" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Behavioral Metrics Summary */}
			<BehavioralMetrics
				disciplineScore={behavioralData?.disciplineScore ?? 100}
				emotionalStateBreakdown={behavioralData?.emotionalStateBreakdown ?? []}
				overtradingTendency={behavioralData?.overtradingTendency ?? 0}
				tiltScore={behavioralData?.tiltScore ?? 0}
				totalTrades={behavioralData?.totalTrades ?? 0}
			/>

			{/* Streak and Revenge Trading Analysis */}
			<div className="grid gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Win/loss streak patterns and distribution"
					title="Streak Analysis"
				>
					<StreakChart
						currentStreak={
							streakData?.currentStreak ?? { type: "none", count: 0 }
						}
						maxLossStreak={streakData?.maxLossStreak ?? 0}
						maxWinStreak={streakData?.maxWinStreak ?? 0}
						performanceDuringStreaks={
							streakData?.performanceDuringStreaks ?? {
								duringWinStreak: { trades: 0, pnl: 0, avgPnl: 0 },
								duringLossStreak: { trades: 0, pnl: 0, avgPnl: 0 },
								noStreak: { trades: 0, pnl: 0, avgPnl: 0 },
							}
						}
						streakDistribution={
							streakData?.streakDistribution ?? { wins: [], losses: [] }
						}
					/>
				</ChartTerminal>

				<ChartTerminal
					description="Performance after wins vs after losses"
					title="Revenge Trading Analysis"
				>
					<RevengeTradingPanel
						afterConsecutiveLosses={
							revengeData?.afterConsecutiveLosses ?? {
								after1Loss: { trades: 0, wins: 0, winRate: 0, avgPnl: 0 },
								after2Losses: { trades: 0, wins: 0, winRate: 0, avgPnl: 0 },
								after3PlusLosses: { trades: 0, wins: 0, winRate: 0, avgPnl: 0 },
							}
						}
						afterLoss={
							revengeData?.afterLoss ?? {
								trades: 0,
								wins: 0,
								losses: 0,
								winRate: 0,
								pnl: 0,
								avgPnl: 0,
							}
						}
						afterWin={
							revengeData?.afterWin ?? {
								trades: 0,
								wins: 0,
								losses: 0,
								winRate: 0,
								pnl: 0,
								avgPnl: 0,
							}
						}
						revengeIndicator={revengeData?.revengeIndicator ?? 0}
					/>
				</ChartTerminal>
			</div>

			{/* Overtrading and Holding Time Analysis */}
			<div className="grid gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Performance by daily trade count"
					title="Overtrading Analysis"
				>
					<OvertradingChart
						byTradeCount={overtradingData?.byTradeCount ?? []}
						correlationScore={overtradingData?.correlationScore ?? 0}
						optimalRange={overtradingData?.optimalRange ?? { min: 1, max: 3 }}
						overtradingThreshold={overtradingData?.overtradingThreshold ?? 5}
					/>
				</ChartTerminal>

				<ChartTerminal
					description="Performance by trade duration"
					title="Holding Time Analysis"
				>
					<HoldingTimeChart
						buckets={holdingTimeData?.buckets ?? []}
						optimalDuration={holdingTimeData?.optimalDuration ?? null}
						totalTrades={holdingTimeData?.totalTrades ?? 0}
					/>
				</ChartTerminal>
			</div>
		</div>
	);
}

// =============================================================================
// MAIN PAGE
// =============================================================================

// =============================================================================
// HELPER: Parse filters from preset JSON
// =============================================================================

function parseFiltersFromJson(filtersJson: string): Partial<AnalyticsFilters> {
	try {
		const parsed = JSON.parse(filtersJson);
		return {
			symbols: parsed.symbols ?? [],
			dateRange: {
				start: parsed.dateRange?.start
					? new Date(parsed.dateRange.start)
					: null,
				end: parsed.dateRange?.end ? new Date(parsed.dateRange.end) : null,
			},
			daysOfWeek: parsed.daysOfWeek ?? [],
			hours: parsed.hours ?? [],
			sessions: parsed.sessions ?? [],
			strategies: parsed.strategies ?? [],
			tags: parsed.tags ?? [],
			rMultipleRange: parsed.rMultipleRange ?? { min: null, max: null },
			positionSizeRange: parsed.positionSizeRange ?? { min: null, max: null },
			outcome: parsed.outcome ?? "all",
			reviewed: parsed.reviewed ?? "all",
			advancedQuery: parsed.advancedQuery ?? null,
		};
	} catch {
		return {};
	}
}

// Default trading sessions
const DEFAULT_SESSIONS = [
	{ id: "asia", name: "Asia" },
	{ id: "london", name: "London" },
	{ id: "new_york", name: "New York" },
];

export default function AnalyticsPage() {
	// Manage presets dialog state
	const [managePresetsOpen, setManagePresetsOpen] = useState(false);

	// Get selected account
	const { selectedAccountId } = useAccount();

	// Track if we've already auto-loaded a preset (to prevent re-applying on every render)
	const hasAutoLoadedPreset = useRef(false);

	// Get store functions
	const { activePresetId, setActivePresetId, setFilters } =
		useAnalyticsFilterStore();

	// Fetch default preset for auto-load
	const { data: defaultPreset } = api.analytics.getDefaultPreset.useQuery();

	// Auto-load default preset on mount (only once)
	useEffect(() => {
		if (
			defaultPreset &&
			!hasAutoLoadedPreset.current &&
			activePresetId === null
		) {
			const filters = parseFiltersFromJson(defaultPreset.filters);
			setFilters(filters);
			setActivePresetId(defaultPreset.id);
			hasAutoLoadedPreset.current = true;
		}
	}, [defaultPreset, activePresetId, setFilters, setActivePresetId]);

	// Handle preset deletion (clear active preset if it was deleted)
	const handlePresetDeleted = useCallback(
		(presetId: string) => {
			if (activePresetId === presetId) {
				setActivePresetId(null);
			}
		},
		[activePresetId, setActivePresetId],
	);

	// Fetch filter options data
	const { data: strategies, isLoading: strategiesLoading } =
		api.strategies.getSimpleList.useQuery();
	const { data: tags, isLoading: tagsLoading } = api.tags.getAll.useQuery();
	const { data: symbolData } = api.analytics.getPerformanceBySymbol.useQuery({
		accountId: null,
	});

	// Extract unique symbols from symbol performance data
	const uniqueSymbols = useMemo(() => {
		if (!symbolData) return [];
		return symbolData.map((s) => s.symbol);
	}, [symbolData]);

	// Transform data for filter panel
	const strategyOptions = useMemo(() => {
		if (!strategies) return [];
		return strategies.map((s) => ({
			id: s.id,
			name: s.name,
			color: s.color ?? undefined,
		}));
	}, [strategies]);

	const tagOptions = useMemo(() => {
		if (!tags) return [];
		return tags.map((t) => ({
			id: t.id,
			name: t.name,
			color: t.color ?? undefined,
		}));
	}, [tags]);

	const isFilterDataLoading = strategiesLoading || tagsLoading;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<span className="mb-2 block font-mono text-primary text-xs uppercase tracking-wider">
						Performance
					</span>
					<h1 className="font-bold text-3xl tracking-tight">Analytics</h1>
					<p className="mt-1 font-mono text-muted-foreground text-sm">
						Analyze your trading performance with professional metrics
					</p>
				</div>
				<ExportButton />
			</div>

			{/* Analytics Query Terminal */}
			<AnalyticsQueryBar
				accountId={selectedAccountId}
				isLoading={isFilterDataLoading}
				sessions={DEFAULT_SESSIONS}
				strategies={strategyOptions}
				symbols={uniqueSymbols}
				tags={tagOptions}
			/>

			{/* Manage Presets Dialog */}
			<ManagePresetsDialog
				activePresetId={activePresetId}
				onOpenChange={setManagePresetsOpen}
				onPresetDeleted={handlePresetDeleted}
				open={managePresetsOpen}
			/>

			{/* Tab Navigation */}
			<Tabs className="space-y-6" defaultValue="overview">
				<TabsList className="bg-secondary/50">
					<TabsTrigger
						className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
						value="overview"
					>
						Overview
					</TabsTrigger>
					<TabsTrigger
						className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
						value="time"
					>
						Time
					</TabsTrigger>
					<TabsTrigger
						className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
						value="risk"
					>
						Risk
					</TabsTrigger>
					<TabsTrigger
						className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
						value="symbols"
					>
						Symbols
					</TabsTrigger>
					<TabsTrigger
						className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
						value="behavior"
					>
						Behavior
					</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent className="space-y-6" value="overview">
					{/* Stats Overview */}
					<StatsOverview />

					{/* Charts */}
					<div className="grid gap-6 lg:grid-cols-2">
						<ChartTerminal
							description="Breakdown of trade outcomes"
							title="Win/Loss Distribution"
						>
							<WinLossChart />
						</ChartTerminal>

						<ChartTerminal
							description="Equity curve over time"
							title="Cumulative P&L"
						>
							<CumulativePnLChart />
						</ChartTerminal>

						<div className="lg:col-span-2">
							<ChartTerminal
								description="Individual trade results (last 50)"
								title="P&L by Trade"
							>
								<PnLDistributionChart />
							</ChartTerminal>
						</div>
					</div>
				</TabsContent>

				{/* Time Tab */}
				<TabsContent className="space-y-6" value="time">
					<TimeTab />
				</TabsContent>

				{/* Risk Tab */}
				<TabsContent className="space-y-6" value="risk">
					<RiskTab />
				</TabsContent>

				{/* Symbols Tab */}
				<TabsContent className="space-y-6" value="symbols">
					<SymbolsTab />
				</TabsContent>

				{/* Behavior Tab */}
				<TabsContent className="space-y-6" value="behavior">
					<BehaviorTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}
