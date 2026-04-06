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

// =============================================================================
// DATA NORMALIZERS
// =============================================================================

/**
 * Unwraps common AI wrapping patterns where the tool returns
 * { data: [...] } or { results: [...] } instead of a bare array.
 */
function normalizeToArray(raw: unknown): unknown[] | null {
	if (Array.isArray(raw)) return raw;
	if (typeof raw === "object" && raw !== null) {
		// Try common wrapper keys
		for (const key of ["data", "results", "rows", "items", "bars", "records"]) {
			const nested = (raw as Record<string, unknown>)[key];
			if (Array.isArray(nested)) return nested;
		}
		// If there's exactly one key and it's an array, use it
		const keys = Object.keys(raw);
		if (keys.length === 1) {
			const firstKey = keys[0] ?? "";
			const val = (raw as Record<string, unknown>)[firstKey];
			if (Array.isArray(val)) return val;
		}
	}
	return null;
}

/**
 * Validates that the value is a non-array object.
 */
function normalizeToObject(raw: unknown): Record<string, unknown> | null {
	if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
		return raw as Record<string, unknown>;
	}
	return null;
}

// =============================================================================
// DATA FALLBACK
// =============================================================================

function DataFallback({ name, data }: { name: string; data?: unknown }) {
	// No data at all — completely missing refId
	if (data === undefined || data === null) {
		return (
			<p className="my-2 font-mono text-muted-foreground text-xs">
				[{name}: data not available]
			</p>
		);
	}

	// Data exists but wrong shape — try to render as a basic table
	const rows = normalizeToArray(data);
	if (
		rows &&
		rows.length > 0 &&
		typeof rows[0] === "object" &&
		rows[0] !== null
	) {
		const columns = Object.keys(rows[0] as Record<string, unknown>).slice(0, 6);
		return (
			<div className="my-2 overflow-x-auto rounded border border-yellow-500/20 bg-yellow-500/5 p-2">
				<p className="mb-1 font-mono text-xs text-yellow-500/70">
					[{name}: showing raw data (unexpected format)]
				</p>
				<table className="w-full">
					<thead>
						<tr>
							{columns.map((c) => (
								<th
									className="px-2 py-1 text-left font-mono text-[10px] text-muted-foreground"
									key={c}
								>
									{c}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{(rows as Record<string, unknown>[]).slice(0, 10).map((row) => (
							<tr key={String(row[columns[0] ?? ""] ?? Math.random())}>
								{columns.map((c) => (
									<td className="px-2 py-1 font-mono text-xs" key={c}>
										{String(row[c] ?? "")}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
				{rows.length > 10 && (
					<p className="mt-1 font-mono text-[10px] text-muted-foreground">
						...and {rows.length - 10} more rows
					</p>
				)}
			</div>
		);
	}

	// Data exists but is a primitive or unrecognizable shape
	return (
		<div className="my-2 rounded border border-yellow-500/20 bg-yellow-500/5 p-2">
			<p className="font-mono text-xs text-yellow-500/70">
				[{name}: data has unexpected format]
			</p>
			<pre className="mt-1 max-h-32 overflow-auto font-mono text-[10px] text-muted-foreground">
				{JSON.stringify(data, null, 2).slice(0, 500)}
			</pre>
		</div>
	);
}

// =============================================================================
// CHART WRAPPERS
// =============================================================================

export function MdxEquityCurve({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="EquityCurve" />;
	return <EquityCurve className={className} data={data as never} />;
}

export function MdxMonthlyChart({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="MonthlyChart" />;
	return <MonthlyChart className={className} data={data as never} />;
}

export function MdxSymbolDistributionChart({
	dataRef,
	className,
}: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="SymbolDistributionChart" />;
	return <SymbolDistributionChart className={className} data={data as never} />;
}

export function MdxDayOfWeekChart({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="DayOfWeekChart" />;
	return <DayOfWeekChart className={className} data={data as never} />;
}

export function MdxHourHeatmap({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="HourHeatmap" />;
	return <HourHeatmap className={className} data={data as never} />;
}

export function MdxSessionChart({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="SessionChart" />;
	return <SessionChart className={className} data={data as never} />;
}

export function MdxRMultipleChart({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const obj = normalizeToObject(raw);
	if (!obj || !Array.isArray(obj.buckets))
		return <DataFallback data={raw} name="RMultipleChart" />;
	return (
		<RMultipleChart
			buckets={obj.buckets as never}
			className={className}
			stats={obj.stats as never}
		/>
	);
}

export function MdxMonteCarloChart({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const obj = normalizeToObject(raw);
	if (!obj) return <DataFallback data={raw} name="MonteCarloChart" />;
	return <MonteCarloChart className={className} data={obj as never} />;
}

export function MdxCalendarHeatmap({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="CalendarHeatmap" />;
	return <CalendarHeatmap className={className} data={data as never} />;
}

export function MdxDrawdownTable({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="DrawdownTable" />;
	return <DrawdownTable className={className} data={data as never} />;
}

export function MdxSymbolTable({ dataRef, className }: DataRefProps) {
	const raw = useReportData(dataRef);
	const data = normalizeToArray(raw);
	if (!data || data.length === 0)
		return <DataFallback data={raw} name="SymbolTable" />;
	return <SymbolTable className={className} data={data as never} />;
}
