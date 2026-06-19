"use client";

import {
	type ReactNode,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/mdx/markdown-components";
import { ReportDataProvider } from "@/components/mdx/provider";

// =============================================================================
// TYPES
// =============================================================================

interface TocItem {
	id: string;
	text: string;
	level: number;
}

interface ReportViewerContentProps {
	/** Raw markdown/MDX string (used for TOC extraction and markdown fallback) */
	content: string;
	/** Data artifacts from store_report_data tool */
	dataArtifacts: Record<string, unknown>;
	/** Whether MDX compilation failed on the server */
	mdxFailed: boolean;
	/** Server-compiled MDX content (from compileMDX) */
	children: ReactNode;
}

// =============================================================================
// TABLE OF CONTENTS
// =============================================================================

function extractHeadings(content: string): TocItem[] {
	const headingRegex = /^(#{1,3})\s+(.+)$/gm;
	const items: TocItem[] = [];
	let match = headingRegex.exec(content);
	while (match) {
		const level = match[1]?.length ?? 1;
		const text = match[2]?.trim() ?? "";
		const id = text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
		items.push({ id, text, level });
		match = headingRegex.exec(content);
	}
	return items;
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
	content,
	dataArtifacts,
	mdxFailed,
	children,
}: ReportViewerContentProps) {
	const headings = useMemo(() => extractHeadings(content), [content]);
	const scrollRef = useRef<HTMLDivElement>(null);
	const activeId = useActiveHeading(headings, scrollRef);

	return (
		<ReportDataProvider data={dataArtifacts}>
			<div className="flex min-h-0 min-w-0 flex-1">
				{/* Scrollable content area */}
				<div className="min-w-0 flex-1 overflow-auto" ref={scrollRef}>
					<article
						className="mx-auto max-w-4xl px-6 py-8"
						data-testid="report-viewer-content"
					>
						{!mdxFailed ? (
							children
						) : (
							<ReactMarkdown
								components={markdownComponents as never}
								remarkPlugins={[remarkGfm]}
							>
								{content}
							</ReactMarkdown>
						)}
					</article>
				</div>

				{/* Table of Contents sidebar — stays in place, desktop xl+ only */}
				<div className="hidden shrink-0 py-8 pr-6 xl:block print:hidden">
					<TableOfContents activeId={activeId} items={headings} />
				</div>
			</div>
		</ReportDataProvider>
	);
}
