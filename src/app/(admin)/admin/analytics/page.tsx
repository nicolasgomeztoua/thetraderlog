"use client";

import type {
	AgCartesianChartOptions,
	AgPolarChartOptions,
} from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { AlertCircle, Crown, PieChart, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";

interface GrowthDayData {
	date: string;
	newUsers: number;
	cumulativeTotal: number;
}

interface TradingDayData {
	date: string;
	tradeCount: number;
	totalPnl: number;
	avgTradeSize: number;
}

interface TopTrader {
	userId: string;
	name: string | null;
	email: string;
	tradeCount: number;
	totalPnl: number;
}

interface BreakdownItem {
	accountType: string;
	count: number;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
	demo: "Demo",
	live: "Live",
	prop_challenge: "Challenge",
	prop_funded: "Funded",
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
	demo: "#64748b",
	live: "#d4ff00",
	prop_challenge: "#fbbf24",
	prop_funded: "#00ff88",
};

function formatCompact(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
	return value.toLocaleString();
}

function formatPnl(value: number): string {
	const prefix = value >= 0 ? "+$" : "-$";
	return `${prefix}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateShort(date: string): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

// =============================================================================
// CHARTS
// =============================================================================

function UserGrowthChart({ data }: { data: GrowthDayData[] }) {
	const chartOptions: AgCartesianChartOptions<
		GrowthDayData & { dateLabel: string }
	> = useMemo(() => {
		if (!data || data.length === 0) return { data: [] };

		return {
			background: { fill: "transparent" },
			data: data.map((d) => ({
				...d,
				dateLabel: formatDateShort(d.date),
			})),
			series: [
				{
					type: "bar" as const,
					xKey: "dateLabel",
					yKey: "newUsers",
					yName: "New Users",
					fill: "#d4ff00",
					cornerRadius: 2,
				},
				{
					type: "line" as const,
					xKey: "dateLabel",
					yKey: "cumulativeTotal",
					yName: "Cumulative Total",
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
						rotation: -45,
					},
					line: { stroke: "#1e293b" },
				},
				{
					type: "number" as const,
					position: "left" as const,
					keys: ["newUsers"],
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
					},
					line: { stroke: "#1e293b" },
					gridLine: { style: [{ stroke: "#ffffff08" }] },
				},
				{
					type: "number" as const,
					position: "right" as const,
					keys: ["cumulativeTotal"],
					label: {
						color: "#00ff88",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
					},
					line: { stroke: "#1e293b" },
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
	}, [data]);

	if (!data || data.length === 0) {
		return (
			<div className="flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs">
				No growth data available
			</div>
		);
	}

	return <AgCharts options={chartOptions} style={{ height: 300 }} />;
}

function TradingActivityChart({ data }: { data: TradingDayData[] }) {
	const chartOptions: AgCartesianChartOptions<
		TradingDayData & { dateLabel: string }
	> = useMemo(() => {
		if (!data || data.length === 0) return { data: [] };

		return {
			background: { fill: "transparent" },
			data: data.map((d) => ({
				...d,
				dateLabel: formatDateShort(d.date),
			})),
			series: [
				{
					type: "bar" as const,
					xKey: "dateLabel",
					yKey: "tradeCount",
					yName: "Trades",
					fill: "#d4ff00",
					cornerRadius: 2,
				},
				{
					type: "line" as const,
					xKey: "dateLabel",
					yKey: "totalPnl",
					yName: "Total P&L",
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
						rotation: -45,
					},
					line: { stroke: "#1e293b" },
				},
				{
					type: "number" as const,
					position: "left" as const,
					keys: ["tradeCount"],
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
					},
					line: { stroke: "#1e293b" },
					gridLine: { style: [{ stroke: "#ffffff08" }] },
				},
				{
					type: "number" as const,
					position: "right" as const,
					keys: ["totalPnl"],
					label: {
						color: "#00ff88",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						formatter: (params: { value: number }) =>
							`$${formatCompact(params.value)}`,
					},
					line: { stroke: "#1e293b" },
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
	}, [data]);

	if (!data || data.length === 0) {
		return (
			<div className="flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs">
				No trading activity data available
			</div>
		);
	}

	return <AgCharts options={chartOptions} style={{ height: 300 }} />;
}

function AccountBreakdownChart({ data }: { data: BreakdownItem[] }) {
	const chartOptions: AgPolarChartOptions<{
		category: string;
		value: number;
	}> = useMemo(() => {
		if (!data || data.length === 0) return { data: [] };

		const chartData = data.map((d) => ({
			category: ACCOUNT_TYPE_LABELS[d.accountType] ?? d.accountType,
			value: d.count,
		}));

		const fills = data.map(
			(d) => ACCOUNT_TYPE_COLORS[d.accountType] ?? "#64748b",
		);

		return {
			background: { fill: "transparent" },
			data: chartData,
			series: [
				{
					type: "donut" as const,
					angleKey: "value",
					calloutLabelKey: "category",
					sectorLabelKey: "value",
					fills,
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
	}, [data]);

	if (!data || data.length === 0) {
		return (
			<div className="flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs">
				No account data available
			</div>
		);
	}

	return <AgCharts options={chartOptions} style={{ height: 300 }} />;
}

// =============================================================================
// PAGE
// =============================================================================

export default function AdminAnalyticsPage() {
	const {
		data: growth,
		isLoading: growthLoading,
		error: growthError,
	} = api.admin.analytics.growth.useQuery();

	const {
		data: trading,
		isLoading: tradingLoading,
		error: tradingError,
	} = api.admin.analytics.tradingActivity.useQuery();

	const {
		data: topTraders,
		isLoading: tradersLoading,
		error: tradersError,
	} = api.admin.analytics.topTraders.useQuery();

	const {
		data: breakdown,
		isLoading: breakdownLoading,
		error: breakdownError,
	} = api.admin.analytics.accountBreakdown.useQuery();

	const hasError =
		growthError || tradingError || tradersError || breakdownError;

	return (
		<div>
			<h1 className="font-mono text-lg uppercase tracking-wider">
				Platform <span className="text-primary">Analytics</span>
			</h1>
			<p className="mt-2 font-mono text-muted-foreground text-xs">
				User growth, trading activity, and platform metrics
			</p>

			{hasError && (
				<div className="mt-4 flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-4 py-3 font-mono text-red-400 text-sm">
					<AlertCircle className="size-4 shrink-0" />
					<span>Failed to load some analytics data</span>
				</div>
			)}

			{/* User Growth Chart */}
			<div className="mt-6 rounded-lg border border-border bg-card p-5">
				<div className="flex items-center gap-2">
					<Users className="size-4 text-primary" />
					<h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						User Growth — Last 30 Days
					</h2>
				</div>
				<div className="mt-4">
					{growthLoading ? (
						<Skeleton className="h-[300px] w-full" />
					) : (
						<UserGrowthChart data={growth?.daily ?? []} />
					)}
				</div>
			</div>

			{/* Trading Activity Chart */}
			<div className="mt-6 rounded-lg border border-border bg-card p-5">
				<div className="flex items-center gap-2">
					<TrendingUp className="size-4 text-primary" />
					<h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Trading Activity — Last 30 Days
					</h2>
				</div>
				<div className="mt-4">
					{tradingLoading ? (
						<Skeleton className="h-[300px] w-full" />
					) : (
						<TradingActivityChart data={trading?.daily ?? []} />
					)}
				</div>
			</div>

			{/* Bottom row: Top Traders + Account Breakdown */}
			<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* Top Traders */}
				<div className="rounded-lg border border-border bg-card p-5">
					<div className="flex items-center gap-2">
						<Crown className="size-4 text-primary" />
						<h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Top 10 Traders by P&L
						</h2>
					</div>
					<div className="mt-4">
						{tradersLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 5 }).map((_, i) => (
									<Skeleton
										className="h-8 w-full"
										key={`trader-skeleton-${i.toString()}`}
									/>
								))}
							</div>
						) : !topTraders?.traders.length ? (
							<div className="flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs">
								No trade data available
							</div>
						) : (
							<div className="rounded border border-border">
								<Table>
									<TableHeader>
										<TableRow className="hover:bg-transparent">
											<TableHead className="w-10 font-mono text-xs uppercase tracking-wider">
												#
											</TableHead>
											<TableHead className="font-mono text-xs uppercase tracking-wider">
												Trader
											</TableHead>
											<TableHead className="text-right font-mono text-xs uppercase tracking-wider">
												Trades
											</TableHead>
											<TableHead className="text-right font-mono text-xs uppercase tracking-wider">
												Total P&L
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{topTraders.traders.map(
											(trader: TopTrader, index: number) => (
												<TableRow key={trader.userId}>
													<TableCell className="font-mono text-muted-foreground text-xs">
														{index + 1}
													</TableCell>
													<TableCell>
														<div>
															<span className="font-mono text-sm">
																{trader.name ?? "—"}
															</span>
															<span className="ml-2 font-mono text-muted-foreground text-xs">
																{trader.email}
															</span>
														</div>
													</TableCell>
													<TableCell className="text-right font-mono text-muted-foreground text-xs">
														{trader.tradeCount}
													</TableCell>
													<TableCell
														className={`text-right font-mono text-sm ${
															trader.totalPnl >= 0
																? "text-[#00ff88]"
																: "text-[#ff3b3b]"
														}`}
													>
														{formatPnl(trader.totalPnl)}
													</TableCell>
												</TableRow>
											),
										)}
									</TableBody>
								</Table>
							</div>
						)}
					</div>
				</div>

				{/* Account Breakdown */}
				<div className="rounded-lg border border-border bg-card p-5">
					<div className="flex items-center gap-2">
						<PieChart className="size-4 text-primary" />
						<h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Account Type Breakdown
						</h2>
					</div>
					<div className="mt-4">
						{breakdownLoading ? (
							<Skeleton className="h-[300px] w-full" />
						) : (
							<AccountBreakdownChart data={breakdown?.breakdown ?? []} />
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
