"use client";

import { MetricCard } from "@/components/analytics";
import { Callout } from "./callout";
import { ChartImage } from "./chart-image";
import {
	MdxCalendarHeatmap,
	MdxDayOfWeekChart,
	MdxDrawdownTable,
	MdxEquityCurve,
	MdxHourHeatmap,
	MdxMonteCarloChart,
	MdxMonthlyChart,
	MdxRMultipleChart,
	MdxSessionChart,
	MdxSymbolDistributionChart,
	MdxSymbolTable,
} from "./chart-wrappers";
import { DataTable } from "./data-table";
import { MetricGrid } from "./metric-grid";

/**
 * MDX component map for next-mdx-remote.
 * Maps component names used in AI-generated MDX to real React components.
 */
export const mdxComponents: Record<string, React.ComponentType<never>> = {
	// Chart components (dataRef → real analytics charts)
	EquityCurve: MdxEquityCurve as never,
	MonthlyChart: MdxMonthlyChart as never,
	SymbolDistributionChart: MdxSymbolDistributionChart as never,
	DayOfWeekChart: MdxDayOfWeekChart as never,
	HourHeatmap: MdxHourHeatmap as never,
	SessionChart: MdxSessionChart as never,
	RMultipleChart: MdxRMultipleChart as never,
	MonteCarloChart: MdxMonteCarloChart as never,
	CalendarHeatmap: MdxCalendarHeatmap as never,
	DrawdownTable: MdxDrawdownTable as never,
	SymbolTable: MdxSymbolTable as never,

	// Display components (inline props, no dataRef)
	MetricCard: MetricCard as never,
	MetricGrid: MetricGrid as never,

	// Report-specific components
	Callout: Callout as never,
	DataTable: DataTable as never,
	ChartImage: ChartImage as never,
};
