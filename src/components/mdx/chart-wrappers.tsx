"use client";

import dynamic from "next/dynamic";
import { useReportData } from "./provider";

// =============================================================================
// LAZY CHART IMPORTS
//
// These analytics charts are built on `ag-charts`, which ships a property-path
// parser containing a lookbehind regex (`(?<!\\)\\'`). Lookbehind throws
// `SyntaxError: Invalid regular expression: invalid group specifier name` at
// PARSE time on iOS <= 15 Safari — before any code runs.
//
// This MDX component map is statically imported by the public `/share/[token]`
// route (`page.tsx`). Static-importing the charts pulled the ~1MB ag-charts
// bundle into that route's synchronous client chunk, so EVERY shared page —
// including trade shares that never render one of these charts — crashed on old
// Safari. Code-splitting via `next/dynamic` keeps ag-charts in an async chunk
// that only loads when a report actually renders a chart.
//
// Do NOT convert these back to static imports.
// =============================================================================

function ChartLoading() {
	return (
		<div className="my-2 h-64 w-full animate-pulse rounded-sm border border-border/50 bg-muted/30" />
	);
}

const loading = () => <ChartLoading />;

const EquityCurve = dynamic(
	() =>
		import("@/components/analytics/equity-curve").then((m) => m.EquityCurve),
	{ ssr: false, loading },
);
const MonthlyChart = dynamic(
	() =>
		import("@/components/analytics/monthly-chart").then((m) => m.MonthlyChart),
	{ ssr: false, loading },
);
const SymbolDistributionChart = dynamic(
	() =>
		import("@/components/analytics/symbol-distribution-chart").then(
			(m) => m.SymbolDistributionChart,
		),
	{ ssr: false, loading },
);
const DayOfWeekChart = dynamic(
	() =>
		import("@/components/analytics/day-of-week-chart").then(
			(m) => m.DayOfWeekChart,
		),
	{ ssr: false, loading },
);
const HourHeatmap = dynamic(
	() =>
		import("@/components/analytics/hour-heatmap").then((m) => m.HourHeatmap),
	{ ssr: false, loading },
);
const SessionChart = dynamic(
	() =>
		import("@/components/analytics/session-chart").then((m) => m.SessionChart),
	{ ssr: false, loading },
);
const RMultipleChart = dynamic(
	() =>
		import("@/components/analytics/r-multiple-chart").then(
			(m) => m.RMultipleChart,
		),
	{ ssr: false, loading },
);
const MonteCarloChart = dynamic(
	() =>
		import("@/components/analytics/monte-carlo-chart").then(
			(m) => m.MonteCarloChart,
		),
	{ ssr: false, loading },
);
const CalendarHeatmap = dynamic(
	() =>
		import("@/components/analytics/calendar-heatmap").then(
			(m) => m.CalendarHeatmap,
		),
	{ ssr: false, loading },
);
const DrawdownTable = dynamic(
	() =>
		import("@/components/analytics/drawdown-table").then(
			(m) => m.DrawdownTable,
		),
	{ ssr: false, loading },
);
const SymbolTable = dynamic(
	() =>
		import("@/components/analytics/symbol-table").then((m) => m.SymbolTable),
	{ ssr: false, loading },
);

interface DataRefProps {
	dataRef: string;
	className?: string;
}

function DataFallback({ name }: { name: string }) {
	return (
		<p className="my-2 font-mono text-muted-foreground text-xs">
			[{name}: data not available]
		</p>
	);
}

export function MdxEquityCurve({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data)) return <DataFallback name="EquityCurve" />;
	return <EquityCurve className={className} data={data} />;
}

export function MdxMonthlyChart({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data))
		return <DataFallback name="MonthlyChart" />;
	return <MonthlyChart className={className} data={data} />;
}

export function MdxSymbolDistributionChart({
	dataRef,
	className,
}: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data))
		return <DataFallback name="SymbolDistributionChart" />;
	return <SymbolDistributionChart className={className} data={data} />;
}

export function MdxDayOfWeekChart({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data))
		return <DataFallback name="DayOfWeekChart" />;
	return <DayOfWeekChart className={className} data={data as never} />;
}

export function MdxHourHeatmap({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data)) return <DataFallback name="HourHeatmap" />;
	return <HourHeatmap className={className} data={data as never} />;
}

export function MdxSessionChart({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data))
		return <DataFallback name="SessionChart" />;
	return <SessionChart className={className} data={data as never} />;
}

export function MdxRMultipleChart({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef) as
		| { buckets: unknown[]; stats: Record<string, unknown> }
		| undefined;
	if (!data || !data.buckets) return <DataFallback name="RMultipleChart" />;
	return (
		<RMultipleChart
			buckets={data.buckets as never}
			className={className}
			stats={data.stats as never}
		/>
	);
}

export function MdxMonteCarloChart({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || typeof data !== "object")
		return <DataFallback name="MonteCarloChart" />;
	return <MonteCarloChart className={className} data={data as never} />;
}

export function MdxCalendarHeatmap({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data))
		return <DataFallback name="CalendarHeatmap" />;
	return <CalendarHeatmap className={className} data={data as never} />;
}

export function MdxDrawdownTable({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data))
		return <DataFallback name="DrawdownTable" />;
	return <DrawdownTable className={className} data={data as never} />;
}

export function MdxSymbolTable({ dataRef, className }: DataRefProps) {
	const data = useReportData(dataRef);
	if (!data || !Array.isArray(data)) return <DataFallback name="SymbolTable" />;
	return <SymbolTable className={className} data={data as never} />;
}
