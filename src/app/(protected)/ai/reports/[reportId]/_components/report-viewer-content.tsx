"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { ReportRenderer } from "@/components/report/report-renderer";
import {
	type Section,
	type StructuredReport,
	toHeadingId,
} from "@/lib/ai/report-pipeline/report-schema";

// =============================================================================
// TYPES
// =============================================================================

interface TocItem {
	id: string;
	text: string;
	level: number;
}

interface ReportViewerContentProps {
	/** Parsed structured report */
	report: StructuredReport;
	/** Data artifacts from store_report_data tool */
	dataArtifacts: Record<string, unknown>;
}

// =============================================================================
// TABLE OF CONTENTS
// =============================================================================

function extractHeadingsFromSections(sections: Section[]): TocItem[] {
	return sections.map((section) => ({
		id: toHeadingId(section.heading),
		text: section.heading,
		level: 2,
	}));
}

function TableOfContents({
	items,
	activeId,
}: {
	items: TocItem[];
	activeId: string | null;
}) {
	if (items.length === 0) return null;

	return (
		<nav className="sticky top-8 w-56 shrink-0" data-testid="report-viewer-toc">
			<div className="border-white/5 border-l pl-4">
				<span className="mb-3 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Contents
				</span>
				<ul className="space-y-1.5">
					{items.map((item) => (
						<li key={item.id}>
							<a
								className={`block font-mono text-[10px] transition-colors hover:text-foreground ${
									activeId === item.id
										? "text-accent"
										: "text-muted-foreground/60"
								}`}
								href={`#${item.id}`}
								style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
							>
								{item.text}
							</a>
						</li>
					))}
				</ul>
			</div>
		</nav>
	);
}

// =============================================================================
// ACTIVE HEADING TRACKING
// =============================================================================

function useActiveHeading(
	headings: TocItem[],
	scrollRef: RefObject<HTMLDivElement | null>,
): string | null {
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		const root = scrollRef.current;
		if (headings.length === 0 || !root) return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id);
					}
				}
			},
			{
				root,
				rootMargin: "-80px 0px -80% 0px",
			},
		);

		for (const heading of headings) {
			const el = root.querySelector(`#${CSS.escape(heading.id)}`);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	}, [headings, scrollRef]);

	return activeId;
}

// =============================================================================
// REPORT VIEWER CONTENT
// =============================================================================

export function ReportViewerContent({
	report,
	dataArtifacts,
}: ReportViewerContentProps) {
	const headings = useMemo(
		() => extractHeadingsFromSections(report.sections),
		[report.sections],
	);
	const scrollRef = useRef<HTMLDivElement>(null);
	const activeId = useActiveHeading(headings, scrollRef);

	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			{/* Scrollable content area */}
			<div className="min-w-0 flex-1 overflow-auto" ref={scrollRef}>
				<article
					className="mx-auto max-w-4xl px-6 py-8"
					data-testid="report-viewer-content"
				>
					<ReportRenderer dataArtifacts={dataArtifacts} report={report} />
				</article>
			</div>

			{/* Table of Contents sidebar — stays in place, desktop xl+ only */}
			<div className="hidden shrink-0 py-8 pr-6 xl:block print:hidden">
				<TableOfContents activeId={activeId} items={headings} />
			</div>
		</div>
	);
}
