"use client";

import type {
	AgCartesianChartOptions,
	AgPolarChartOptions,
} from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import {
	BehavioralMetrics,
	CalendarHeatmap,
	DayOfWeekChart,
	DrawdownTable,
	HoldingTimeChart,
	HourHeatmap,
	KellyDisplay,
	METRIC_TOOLTIPS,
	MetricCard,
	OvertradingChart,
	RevengeTradingPanel,
	RiskGauge,
	RiskRewardPanel,
	SessionChart,
	StreakChart,
	SymbolTable,
} from "@/components/analytics";
import { ChartSkeleton } from "@/components/analytics/chart-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isPropAccountType } from "@/lib/constants/prop";
import {
	formatCurrency,
	formatDate,
	formatPercent,
	getPnLColorClass,
} from "@/lib/shared";
import type { SharedAnalyticsPayload } from "@/server/api/helpers/analytics-share";

// =============================================================================
// Chart data types (mirrors the authenticated analytics page)
// =============================================================================

interface WinLossChartData {
	category: string;
	value: number;
	color: string;
}

interface PnLDistributionChartData {
	trade: number;
	pnl: number;
	color: string;
}

interface CumulativePnLChartData {
	trade: number;
	pnl: number;
	date: string;
}

// Dynamic imports for AG Charts components (code-split, client-only) — same
// modules the authenticated analytics page uses.
const EquityCurve = dynamic(
	() =>
		import("@/components/analytics/equity-curve").then((m) => m.EquityCurve),
	{ ssr: false, loading: () => <ChartSkeleton /> },
);

const MonthlyChart = dynamic(
	() =>
		import("@/components/analytics/monthly-chart").then((m) => m.MonthlyChart),
	{ ssr: false, loading: () => <ChartSkeleton /> },
);

const RMultipleChart = dynamic(
	() =>
		import("@/components/analytics/r-multiple-chart").then(
			(m) => m.RMultipleChart,
		),
	{ ssr: false, loading: () => <ChartSkeleton /> },
);

const SymbolDistributionChart = dynamic(
	() =>
		import("@/components/analytics/symbol-distribution-chart").then(
			(m) => m.SymbolDistributionChart,
		),
	{ ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

const SymbolTrendChart = dynamic(
	() =>
		import("@/components/analytics/symbol-trend-chart").then(
			(m) => m.SymbolTrendChart,
		),
	{ ssr: false, loading: () => <ChartSkeleton /> },
);

const PositionSizeChart = dynamic(
	() =>
		import("@/components/analytics/position-size-chart").then(
			(m) => m.PositionSizeChart,
		),
	{ ssr: false, loading: () => <ChartSkeleton /> },
);

type AnalyticsData = SharedAnalyticsPayload["data"];

// =============================================================================
// EMPTY STATE
// =============================================================================

function NoChartData() {
	return (
		<div className="flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs">
			No trade data available
		</div>
	);
}

// =============================================================================
// TERMINAL WRAPPER (verbatim from the authenticated analytics page)
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
			<div className="flex items-center justify-between border-border border-b bg-secondary px-3 py-2 sm:px-4">
				<div className="flex items-center gap-1.5 sm:gap-2">
					<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
				</div>
				<div className="text-center">
					<span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
						{title.toLowerCase().replace(/\s+/g, "-")}
					</span>
				</div>
				<div className="w-10 sm:w-14" />
			</div>
			<div className="border-border border-b px-3 py-2 sm:px-4 sm:py-3">
				<h3 className="font-medium text-sm">{title}</h3>
				<p className="font-mono text-[10px] text-muted-foreground">
					{description}
				</p>
			</div>
			<div className="p-3 sm:p-4">{children}</div>
		</div>
	);
}

// =============================================================================
// OVERVIEW
// =============================================================================

function StatsOverview({ overview }: { overview: AnalyticsData["overview"] }) {
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

function WinLossChart({ overview }: { overview: AnalyticsData["overview"] }) {
	const chartOptions: AgPolarChartOptions<WinLossChartData> = useMemo(
		() => ({
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
		}),
		[overview],
	);

	if (overview.totalTrades === 0) return <NoChartData />;

	return <AgCharts options={chartOptions} style={{ height: 300 }} />;
}

function PnLDistributionChart({
	closedPnl,
}: {
	closedPnl: AnalyticsData["closedPnl"];
}) {
	const chartOptions: AgCartesianChartOptions<PnLDistributionChartData> =
		useMemo(() => {
			const trades = closedPnl.map((t, i) => ({
				trade: i + 1,
				pnl: t.pnl,
				color: t.pnl >= 0 ? "#00ff88" : "#ff3b3b",
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
						line: { stroke: "#1e293b" },
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
						line: { stroke: "#1e293b" },
						gridLine: { style: [{ stroke: "#ffffff08" }] },
					},
				],
			};
		}, [closedPnl]);

	if (closedPnl.length === 0) return <NoChartData />;

	return <AgCharts options={chartOptions} style={{ height: 300 }} />;
}

function CumulativePnLChart({
	closedPnl,
}: {
	closedPnl: AnalyticsData["closedPnl"];
}) {
	const chartOptions: AgCartesianChartOptions<CumulativePnLChartData> =
		useMemo(() => {
			let cumulative = 0;
			// closedPnl is most-recent-first (matches trades.getAll); reverse for the
			// chronological cumulative curve, mirroring the authenticated page.
			const trades = [...closedPnl].reverse().map((t, i) => {
				cumulative += t.pnl;
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
						line: { stroke: "#1e293b" },
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
						line: { stroke: "#1e293b" },
						gridLine: { style: [{ stroke: "#ffffff08" }] },
					},
				],
			};
		}, [closedPnl]);

	if (closedPnl.length === 0) return <NoChartData />;

	return <AgCharts options={chartOptions} style={{ height: 300 }} />;
}

function OverviewTab({ data }: { data: AnalyticsData }) {
	return (
		<div className="space-y-4 sm:space-y-6">
			<StatsOverview overview={data.overview} />
			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Breakdown of trade outcomes"
					title="Win/Loss Distribution"
				>
					<WinLossChart overview={data.overview} />
				</ChartTerminal>
				<ChartTerminal
					description="Equity curve over time"
					title="Cumulative P&L"
				>
					<CumulativePnLChart closedPnl={data.closedPnl} />
				</ChartTerminal>
				<div className="lg:col-span-2">
					<ChartTerminal
						description="Individual trade results (last 50)"
						title="P&L by Trade"
					>
						<PnLDistributionChart closedPnl={data.closedPnl} />
					</ChartTerminal>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// TIME
// =============================================================================

function TimeTab({ data }: { data: AnalyticsData }) {
	return (
		<div className="space-y-4 sm:space-y-6">
			<ChartTerminal
				description="Daily P&L over the last year"
				title="Trading Calendar"
			>
				<CalendarHeatmap data={data.calendar} />
			</ChartTerminal>

			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Performance breakdown by weekday"
					title="Day of Week"
				>
					<DayOfWeekChart data={data.dayOfWeek} />
				</ChartTerminal>

				<ChartTerminal
					description={`Performance by entry hour (${data.timezoneAbbr})`}
					title="Hourly Performance"
				>
					<HourHeatmap data={data.hour} />
				</ChartTerminal>
			</div>

			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Performance by trading session"
					title="Trading Sessions"
				>
					<SessionChart data={data.session} />
				</ChartTerminal>

				<ChartTerminal
					description="Month-over-month performance"
					title="Monthly P&L"
				>
					<MonthlyChart data={data.monthly} />
				</ChartTerminal>
			</div>
		</div>
	);
}

// =============================================================================
// RISK
// =============================================================================

function RiskTab({
	data,
	accountType,
}: {
	data: AnalyticsData;
	accountType: SharedAnalyticsPayload["account"]["accountType"];
}) {
	const riskMetrics = data.riskMetrics;

	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

			<ChartTerminal
				description="Running profit/loss with drawdown periods highlighted"
				title="Cumulative P&L"
			>
				<EquityCurve data={data.equityCurve} />
			</ChartTerminal>

			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Distribution of trades by R-multiple"
					title="R-Multiple Distribution"
				>
					<RMultipleChart
						buckets={data.rMultiple.buckets}
						stats={data.rMultiple.stats}
					/>
				</ChartTerminal>

				<ChartTerminal
					description="Planned vs actual risk/reward"
					title="Risk/Reward Analysis"
				>
					<RiskRewardPanel
						categories={data.riskReward.categories}
						summary={data.riskReward.summary}
					/>
				</ChartTerminal>
			</div>

			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<ChartTerminal
					description={`Probability of hitting ${riskMetrics.ruinThresholdPercent.toFixed(0)}% drawdown`}
					title={
						isPropAccountType(accountType) &&
						riskMetrics.ruinThresholdSource === "account"
							? "Challenge Failure Risk"
							: "Risk of Ruin"
					}
				>
					<RiskGauge
						accountType={accountType}
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

			<ChartTerminal
				description="Performance by position size"
				title="Position Sizing Analysis"
			>
				<PositionSizeChart
					buckets={data.positionSize.buckets}
					stats={data.positionSize.stats}
				/>
			</ChartTerminal>

			<ChartTerminal
				description="Top drawdown periods sorted by depth"
				title="Drawdown History"
			>
				<DrawdownTable data={data.drawdowns} />
			</ChartTerminal>
		</div>
	);
}

// =============================================================================
// SYMBOLS
// =============================================================================

function SymbolsTab({ data }: { data: AnalyticsData }) {
	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Performance metrics for each traded symbol"
					title="Symbol Performance"
				>
					<SymbolTable data={data.symbolPerformance} />
				</ChartTerminal>

				<ChartTerminal
					description="Trade distribution across symbols"
					title="Symbol Distribution"
				>
					<SymbolDistributionChart data={data.symbolPerformance} />
				</ChartTerminal>
			</div>

			<ChartTerminal
				description="P&L trends by symbol over time"
				title="Symbol Trends"
			>
				<SymbolTrendChart
					months={data.symbolTrend.months}
					symbols={data.symbolTrend.symbols}
				/>
			</ChartTerminal>
		</div>
	);
}

// =============================================================================
// BEHAVIOR
// =============================================================================

function BehaviorTab({ data }: { data: AnalyticsData }) {
	const behavioral = data.behavioral;
	const streak = data.streak;
	const revenge = data.revenge;
	const overtrading = data.overtrading;
	const holdingTime = data.holdingTime;

	return (
		<div className="space-y-4 sm:space-y-6">
			<BehavioralMetrics
				disciplineScore={behavioral.disciplineScore}
				emotionalStateBreakdown={behavioral.emotionalStateBreakdown}
				overtradingTendency={behavioral.overtradingTendency}
				tiltScore={behavioral.tiltScore}
				totalTrades={behavioral.totalTrades}
			/>

			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Win/loss streak patterns and distribution"
					title="Streak Analysis"
				>
					<StreakChart
						currentStreak={streak.currentStreak}
						maxLossStreak={streak.maxLossStreak}
						maxWinStreak={streak.maxWinStreak}
						performanceDuringStreaks={streak.performanceDuringStreaks}
						streakDistribution={streak.streakDistribution}
					/>
				</ChartTerminal>

				<ChartTerminal
					description="Performance after wins vs after losses"
					title="Revenge Trading Analysis"
				>
					<RevengeTradingPanel
						afterConsecutiveLosses={revenge.afterConsecutiveLosses}
						afterLoss={revenge.afterLoss}
						afterWin={revenge.afterWin}
						revengeIndicator={revenge.revengeIndicator}
					/>
				</ChartTerminal>
			</div>

			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<ChartTerminal
					description="Performance by daily trade count"
					title="Overtrading Analysis"
				>
					<OvertradingChart
						byTradeCount={overtrading.byTradeCount}
						correlationScore={overtrading.correlationScore}
						optimalRange={overtrading.optimalRange}
						overtradingThreshold={overtrading.overtradingThreshold}
					/>
				</ChartTerminal>

				<ChartTerminal
					description="Performance by trade duration"
					title="Holding Time Analysis"
				>
					<HoldingTimeChart
						buckets={holdingTime.buckets}
						optimalDuration={holdingTime.optimalDuration}
						totalTrades={holdingTime.totalTrades}
					/>
				</ChartTerminal>
			</div>
		</div>
	);
}

// =============================================================================
// SHARED ANALYTICS VIEW — public, read-only mirror of the analytics dashboard
// =============================================================================

const TAB_TRIGGER_CLASS =
	"min-h-10 flex-1 px-3 font-mono text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:min-h-0 sm:px-4 sm:text-xs";

export function SharedAnalyticsView({
	payload,
}: {
	payload: SharedAnalyticsPayload;
}) {
	const { data, account, trader } = payload;
	const traderName = trader.name ?? "A TheTraderLog trader";

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
				{/* Branded top bar */}
				<div className="flex items-center justify-between gap-3 border-white/10 border-b pb-4">
					<div className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
						<span className="shrink-0 font-bold text-primary">TRADERLOG</span>
						<span className="hidden text-muted-foreground sm:inline">
							{"// "}
						</span>
						<span className="hidden truncate text-muted-foreground sm:inline">
							SHARED ANALYTICS
						</span>
					</div>
				</div>

				{/* Trader + account identity */}
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
					<div className="min-w-0">
						<p className="truncate font-bold font-mono text-foreground text-sm">
							{account.name}
						</p>
						<p className="font-mono text-[10px] text-muted-foreground">
							Shared by {traderName}
						</p>
					</div>
				</div>

				{/* Tabs */}
				<Tabs className="mt-6 space-y-4 sm:space-y-6" defaultValue="overview">
					<div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
						<TabsList className="inline-flex w-auto min-w-full bg-secondary/50 sm:w-full">
							<TabsTrigger className={TAB_TRIGGER_CLASS} value="overview">
								Overview
							</TabsTrigger>
							<TabsTrigger className={TAB_TRIGGER_CLASS} value="time">
								Time
							</TabsTrigger>
							<TabsTrigger className={TAB_TRIGGER_CLASS} value="risk">
								Risk
							</TabsTrigger>
							<TabsTrigger className={TAB_TRIGGER_CLASS} value="symbols">
								Symbols
							</TabsTrigger>
							<TabsTrigger className={TAB_TRIGGER_CLASS} value="behavior">
								Behavior
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent className="space-y-4 sm:space-y-6" value="overview">
						<OverviewTab data={data} />
					</TabsContent>
					<TabsContent className="space-y-4 sm:space-y-6" value="time">
						<TimeTab data={data} />
					</TabsContent>
					<TabsContent className="space-y-4 sm:space-y-6" value="risk">
						<RiskTab accountType={account.accountType} data={data} />
					</TabsContent>
					<TabsContent className="space-y-4 sm:space-y-6" value="symbols">
						<SymbolsTab data={data} />
					</TabsContent>
					<TabsContent className="space-y-4 sm:space-y-6" value="behavior">
						<BehaviorTab data={data} />
					</TabsContent>
				</Tabs>

				{/* Neutral footer */}
				<div className="mt-12 border-white/10 border-t pt-6 text-center">
					<p className="font-mono text-[10px] text-muted-foreground">
						Generated with{" "}
						<Link
							className="text-primary transition-colors hover:text-accent"
							href="/"
						>
							TheTraderLog
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
