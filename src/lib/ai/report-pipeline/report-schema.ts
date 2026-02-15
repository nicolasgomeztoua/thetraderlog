import { z } from "zod";

// =============================================================================
// CHART COMPONENT ENUM
// =============================================================================

export const ChartComponent = z.enum([
	// Chart components (require dataRef with array data)
	"EquityCurve",
	"MonthlyChart",
	"SymbolDistributionChart",
	"DayOfWeekChart",
	"HourHeatmap",
	"SessionChart",
	"RMultipleChart",
	"MonteCarloChart",
	// Display components (require dataRef)
	"CalendarHeatmap",
	"DrawdownTable",
	"SymbolTable",
	"DataTable",
]);

// =============================================================================
// CONTENT BLOCK SCHEMAS (discriminated union on "type")
// =============================================================================

const proseBlockSchema = z.object({
	type: z.literal("prose"),
	content: z.string().describe("Markdown-formatted prose content"),
});

const metricTooltipSchema = z.object({
	what: z.string().describe("What this metric measures"),
	why: z.string().describe("Why this metric matters"),
	benchmark: z.string().describe("Reference point for comparison"),
});

const metricItemSchema = z.object({
	title: z.string(),
	value: z.string(),
	tooltip: metricTooltipSchema,
	colorClass: z
		.string()
		.optional()
		.describe("Tailwind color class (e.g. text-profit, text-loss)"),
	description: z.string().optional().describe("Additional context below value"),
});

const metricsBlockSchema = z.object({
	type: z.literal("metrics"),
	items: z.array(metricItemSchema).min(1),
});

const chartBlockSchema = z.object({
	type: z.literal("chart"),
	component: ChartComponent,
	dataRef: z
		.string()
		.describe("Key referencing a dataset in the dataStore/dataArtifacts"),
});

const calloutBlockSchema = z.object({
	type: z.literal("callout"),
	calloutType: z.enum(["tip", "warning", "note", "important"]),
	content: z.string().describe("Markdown-formatted callout content"),
});

const imageBlockSchema = z.object({
	type: z.literal("image"),
	src: z.string(),
	alt: z.string(),
	caption: z.string().optional(),
});

// =============================================================================
// CONTENT BLOCK DISCRIMINATED UNION
// =============================================================================

export const contentBlockSchema = z.discriminatedUnion("type", [
	proseBlockSchema,
	metricsBlockSchema,
	chartBlockSchema,
	calloutBlockSchema,
	imageBlockSchema,
]);

// =============================================================================
// SECTION & REPORT SCHEMAS
// =============================================================================

export const sectionSchema = z.object({
	heading: z.string(),
	blocks: z.array(contentBlockSchema).min(1),
});

export const structuredReportSchema = z.object({
	executiveSummary: z
		.string()
		.describe("2-3 sentence executive summary of the report"),
	sections: z.array(sectionSchema).min(1),
	keyTakeaways: z
		.array(z.string())
		.min(1)
		.describe("Actionable recommendations for the trader"),
});

// =============================================================================
// DATA STORE ENTRY TYPE
// =============================================================================

/** Enhanced data store entry with component metadata from the gatherer phase */
export interface DataStoreEntry {
	data: unknown;
	component?: string;
	description: string;
}

export type DataStoreMap = Map<string, DataStoreEntry>;

// =============================================================================
// INFERRED TYPES
// =============================================================================

export type ChartComponentName = z.infer<typeof ChartComponent>;
export type ProseBlock = z.infer<typeof proseBlockSchema>;
export type MetricTooltip = z.infer<typeof metricTooltipSchema>;
export type MetricItem = z.infer<typeof metricItemSchema>;
export type MetricsBlock = z.infer<typeof metricsBlockSchema>;
export type ChartBlock = z.infer<typeof chartBlockSchema>;
export type CalloutBlock = z.infer<typeof calloutBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type StructuredReport = z.infer<typeof structuredReportSchema>;
