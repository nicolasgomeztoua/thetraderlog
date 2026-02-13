"use client";

import {
	CalendarHeatmap,
	DayOfWeekChart,
	DrawdownTable,
	EquityCurve,
	HourHeatmap,
	MonteCarloChart,
	MonthlyChart,
	RMultipleChart,
	SessionChart,
	SymbolDistributionChart,
	SymbolTable,
} from "@/components/analytics";
import { useReportData } from "./provider";

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
