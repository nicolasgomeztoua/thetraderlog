"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { aggregateBars } from "@/lib/market-data";
import { cn, STALE_TIME_MEDIUM } from "@/lib/shared";
import type { Execution } from "@/lib/trades/running-pnl";
import { generateRunningPnlSeries } from "@/lib/trades/running-pnl";
import { useChartPreferencesStore } from "@/stores/chart-preferences-store";
import { api } from "@/trpc/react";
import { RunningPnlChart } from "./running-pnl-chart";

// =============================================================================
// TYPES
// =============================================================================

interface RunningPnlTabProps {
	symbol: string;
	direction: "long" | "short";
	instrumentType: "futures" | "forex";
	entryPrice: string | null;
	entryTime: Date | string | null;
	exitTime?: Date | string | null;
	quantity?: string | null;
	executions?: Array<{
		id: string;
		executionType: "entry" | "exit" | "scale_in" | "scale_out";
		executedAt: Date | string;
		price: string;
		quantity: string;
		realizedPnl?: string | null;
	}>;
	className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Running P&L tab content that fetches bar data and renders the P&L chart.
 * Uses the same data fetching pattern as TradeReplay.
 */
export function RunningPnlTab({
	symbol,
	direction,
	instrumentType,
	entryPrice,
	entryTime,
	exitTime,
	quantity,
	executions = [],
	className,
}: RunningPnlTabProps) {
	// Get interval preference from store (same as replay)
	const interval = useChartPreferencesStore((s) => s.interval);

	// Fetch chart data using same endpoint as replay
	const {
		data: rawChartData,
		isLoading,
		error,
	} = api.marketData.getFullDayChartData.useQuery(
		{
			symbol,
			entryTime: entryTime
				? new Date(entryTime).toISOString()
				: new Date().toISOString(),
			exitTime: exitTime ? new Date(exitTime).toISOString() : undefined,
		},
		{
			enabled: !!entryTime,
			staleTime: STALE_TIME_MEDIUM,
			refetchOnWindowFocus: false,
		},
	);

	// Aggregate bars to selected interval (matching replay behavior)
	const chartBars = useMemo(() => {
		if (!rawChartData?.bars?.length) return [];

		return interval === "1min"
			? rawChartData.bars
			: aggregateBars(rawChartData.bars, interval);
	}, [rawChartData, interval]);

	// Build executions array with synthetic entry (matching replay pattern)
	const allExecutions: Execution[] = useMemo(() => {
		const execs: Execution[] = [];

		// Add synthetic entry execution from trade data
		if (entryTime && entryPrice) {
			execs.push({
				id: "entry-synthetic",
				executionType: "entry",
				price: entryPrice,
				quantity: quantity ?? "1",
				executedAt: entryTime,
				realizedPnl: null,
			});
		}

		// Add other executions (scale_in, scale_out, exit)
		execs.push(
			...executions.map((exec) => ({
				id: exec.id,
				executionType: exec.executionType,
				price: exec.price,
				quantity: exec.quantity,
				executedAt: exec.executedAt,
				realizedPnl: exec.realizedPnl,
			})),
		);

		return execs;
	}, [executions, entryTime, entryPrice, quantity]);

	// Generate running P&L series
	const pnlData = useMemo(() => {
		if (chartBars.length === 0 || allExecutions.length === 0) {
			return [];
		}

		return generateRunningPnlSeries({
			bars: chartBars,
			executions: allExecutions,
			direction,
			symbol,
			instrumentType,
		});
	}, [chartBars, allExecutions, direction, symbol, instrumentType]);

	// Handle no entry time state
	if (!entryTime) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center",
					className,
				)}
			>
				<AlertCircle className="mb-2 h-6 w-6 text-muted-foreground opacity-50" />
				<p className="font-mono text-muted-foreground text-sm">
					Entry time required
				</p>
			</div>
		);
	}

	// Loading state
	if (isLoading) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center",
					className,
				)}
			>
				<Loader2 className="mb-2 h-6 w-6 animate-spin text-muted-foreground" />
				<p className="font-mono text-muted-foreground text-xs">
					Loading P&L data...
				</p>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center",
					className,
				)}
			>
				<AlertCircle className="mb-2 h-6 w-6 text-loss opacity-50" />
				<p className="font-mono text-muted-foreground text-sm">
					Failed to load chart data
				</p>
				<p className="mt-1 font-mono text-[11px] text-muted-foreground/50">
					{error.message}
				</p>
			</div>
		);
	}

	// No data state
	if (chartBars.length === 0 || pnlData.length === 0) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center",
					className,
				)}
			>
				<AlertCircle className="mb-2 h-6 w-6 text-muted-foreground opacity-50" />
				<p className="font-mono text-muted-foreground text-sm">
					No P&L data available
				</p>
				<p className="mt-1 font-mono text-[11px] text-muted-foreground/50">
					Market data may not be available for this symbol
				</p>
			</div>
		);
	}

	return (
		<RunningPnlChart
			className={cn("h-full", className)}
			data={pnlData}
			direction={direction}
			executions={allExecutions}
			instrumentType={instrumentType}
			symbol={symbol}
		/>
	);
}
