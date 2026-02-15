"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MetricCard } from "@/components/analytics/metric-card";
import { Callout } from "@/components/mdx/callout";
import { ChartImage } from "@/components/mdx/chart-image";
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
} from "@/components/mdx/chart-wrappers";
import { DataTable } from "@/components/mdx/data-table";
import { markdownComponents } from "@/components/mdx/markdown-components";
import { MetricGrid } from "@/components/mdx/metric-grid";
import { ReportDataProvider } from "@/components/mdx/provider";
import {
	type CalloutBlock,
	type ChartBlock,
	type ChartComponentName,
	type ContentBlock,
	type ImageBlock,
	type MetricsBlock,
	type ProseBlock,
	type Section,
	type StructuredReport,
	toHeadingId,
} from "@/lib/ai/report-pipeline/report-schema";

// =============================================================================
// CHART COMPONENT MAP
// =============================================================================

const CHART_COMPONENTS: Record<
	ChartComponentName,
	React.ComponentType<{ dataRef: string; className?: string }>
> = {
	EquityCurve: MdxEquityCurve,
	MonthlyChart: MdxMonthlyChart,
	SymbolDistributionChart: MdxSymbolDistributionChart,
	DayOfWeekChart: MdxDayOfWeekChart,
	HourHeatmap: MdxHourHeatmap,
	SessionChart: MdxSessionChart,
	RMultipleChart: MdxRMultipleChart,
	MonteCarloChart: MdxMonteCarloChart,
	CalendarHeatmap: MdxCalendarHeatmap,
	DrawdownTable: MdxDrawdownTable,
	SymbolTable: MdxSymbolTable,
	DataTable: DataTable as React.ComponentType<{
		dataRef: string;
		className?: string;
	}>,
};

/** Derive a stable key from a content block's fields */
function blockKey(headingId: string, block: ContentBlock): string {
	switch (block.type) {
		case "prose":
			return `${headingId}-prose-${block.content.slice(0, 40)}`;
		case "metrics":
			return `${headingId}-metrics-${block.items.map((m) => m.title).join(",")}`;
		case "chart":
			return `${headingId}-chart-${block.component}-${block.dataRef}`;
		case "callout":
			return `${headingId}-callout-${block.calloutType}-${block.content.slice(0, 40)}`;
		case "image":
			return `${headingId}-image-${block.src}`;
	}
}

// =============================================================================
// BLOCK RENDERERS
// =============================================================================

function ProseBlockRenderer({ block }: { block: ProseBlock }) {
	return (
		<div data-testid="report-block-prose">
			<ReactMarkdown
				components={markdownComponents as never}
				remarkPlugins={[remarkGfm]}
			>
				{block.content}
			</ReactMarkdown>
		</div>
	);
}

function MetricsBlockRenderer({ block }: { block: MetricsBlock }) {
	return (
		<div data-testid="report-block-metrics">
			<MetricGrid>
				{block.items.map((item) => (
					<MetricCard
						colorClass={item.colorClass}
						description={item.description}
						key={item.title}
						title={item.title}
						tooltip={item.tooltip}
						value={item.value}
					/>
				))}
			</MetricGrid>
		</div>
	);
}

function ChartBlockRenderer({ block }: { block: ChartBlock }) {
	const Component = CHART_COMPONENTS[block.component];
	if (!Component) {
		return (
			<p
				className="my-2 font-mono text-muted-foreground text-xs"
				data-testid="report-block-chart-unknown"
			>
				[Unknown chart component: {block.component}]
			</p>
		);
	}
	return (
		<div data-testid={`report-block-chart-${block.component}`}>
			<Component dataRef={block.dataRef} />
		</div>
	);
}

function CalloutBlockRenderer({ block }: { block: CalloutBlock }) {
	return (
		<div data-testid={`report-block-callout-${block.calloutType}`}>
			<Callout type={block.calloutType}>
				<ReactMarkdown
					components={markdownComponents as never}
					remarkPlugins={[remarkGfm]}
				>
					{block.content}
				</ReactMarkdown>
			</Callout>
		</div>
	);
}

function ImageBlockRenderer({ block }: { block: ImageBlock }) {
	return (
		<div data-testid="report-block-image">
			<ChartImage alt={block.alt} caption={block.caption} src={block.src} />
		</div>
	);
}

// =============================================================================
// BLOCK RENDERER (DISPATCHER)
// =============================================================================

function BlockRenderer({ block }: { block: ContentBlock }) {
	switch (block.type) {
		case "prose":
			return <ProseBlockRenderer block={block} />;
		case "metrics":
			return <MetricsBlockRenderer block={block} />;
		case "chart":
			return <ChartBlockRenderer block={block} />;
		case "callout":
			return <CalloutBlockRenderer block={block} />;
		case "image":
			return <ImageBlockRenderer block={block} />;
	}
}

// =============================================================================
// SECTION RENDERER
// =============================================================================

function SectionRenderer({ section }: { section: Section }) {
	const headingId = toHeadingId(section.heading);
	return (
		<section data-testid={`report-section-${headingId}`}>
			<h2
				className="mt-6 mb-3 font-bold font-mono text-foreground text-lg first:mt-0"
				id={headingId}
			>
				{section.heading}
			</h2>
			{section.blocks.map((block) => (
				<BlockRenderer block={block} key={blockKey(headingId, block)} />
			))}
		</section>
	);
}

// =============================================================================
// REPORT RENDERER
// =============================================================================

interface ReportRendererProps {
	report: StructuredReport;
	dataArtifacts: Record<string, unknown>;
}

export function ReportRenderer({ report, dataArtifacts }: ReportRendererProps) {
	return (
		<ReportDataProvider data={dataArtifacts}>
			<div data-testid="report-renderer">
				{/* Executive Summary */}
				<div data-testid="report-executive-summary">
					<ReactMarkdown
						components={markdownComponents as never}
						remarkPlugins={[remarkGfm]}
					>
						{report.executiveSummary}
					</ReactMarkdown>
				</div>

				{/* Sections */}
				{report.sections.map((section) => (
					<SectionRenderer
						key={toHeadingId(section.heading)}
						section={section}
					/>
				))}

				{/* Key Takeaways */}
				<div data-testid="report-key-takeaways">
					<h2 className="mt-6 mb-3 font-bold font-mono text-foreground text-lg">
						Key Takeaways
					</h2>
					<ol className="mb-3 ml-4 list-decimal space-y-2 font-mono text-muted-foreground text-sm marker:text-accent/50">
						{report.keyTakeaways.map((takeaway) => (
							<li className="leading-relaxed" key={takeaway}>
								<ReactMarkdown
									components={{
										p: ({ children }) => <span>{children}</span>,
										strong: ({ children }) => (
											<strong className="font-medium text-foreground">
												{children}
											</strong>
										),
										em: ({ children }) => (
											<em className="text-muted-foreground italic">
												{children}
											</em>
										),
									}}
									remarkPlugins={[remarkGfm]}
								>
									{takeaway}
								</ReactMarkdown>
							</li>
						))}
					</ol>
				</div>
			</div>
		</ReportDataProvider>
	);
}
