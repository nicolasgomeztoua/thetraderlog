"use client";

import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/mdx/components";
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
	content: string;
	dataArtifacts: Record<string, unknown>;
}

// =============================================================================
// MDX SERIALIZATION (client-side, dynamic import to avoid SSR issues)
// =============================================================================

async function serializeMdx(
	source: string,
): Promise<MDXRemoteSerializeResult | null> {
	try {
		const { serialize } = await import("next-mdx-remote/serialize");
		const mdxSource = await serialize(source, {
			mdxOptions: {
				remarkPlugins: [remarkGfm],
			},
		});
		return mdxSource;
	} catch {
		return null;
	}
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
		<nav
			className="sticky top-20 hidden w-56 shrink-0 xl:block"
			data-testid="report-viewer-toc"
		>
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
// MARKDOWN FALLBACK COMPONENTS (Terminal styled, mirrors message-renderer.tsx)
// =============================================================================

const markdownComponents = {
	h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
		const text =
			typeof children === "string" ? children : String(children ?? "");
		const id = text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
		return (
			<h1
				className="mt-8 mb-4 font-bold font-mono text-foreground text-xl first:mt-0"
				id={id}
				{...props}
			>
				{children}
			</h1>
		);
	},
	h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
		const text =
			typeof children === "string" ? children : String(children ?? "");
		const id = text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
		return (
			<h2
				className="mt-6 mb-3 font-bold font-mono text-foreground text-lg first:mt-0"
				id={id}
				{...props}
			>
				{children}
			</h2>
		);
	},
	h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
		const text =
			typeof children === "string" ? children : String(children ?? "");
		const id = text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
		return (
			<h3
				className="mt-4 mb-2 font-mono font-semibold text-base text-foreground first:mt-0"
				id={id}
				{...props}
			>
				{children}
			</h3>
		);
	},
	p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
		<p
			className="mb-3 font-mono text-muted-foreground text-sm leading-relaxed last:mb-0"
			{...props}
		>
			{children}
		</p>
	),
	strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
		<strong className="font-medium text-foreground" {...props}>
			{children}
		</strong>
	),
	em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
		<em className="text-muted-foreground italic" {...props}>
			{children}
		</em>
	),
	ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
		<ul
			className="mb-3 ml-4 list-disc space-y-1 font-mono text-muted-foreground text-sm"
			{...props}
		>
			{children}
		</ul>
	),
	ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
		<ol
			className="mb-3 ml-4 list-decimal space-y-1 font-mono text-muted-foreground text-sm marker:text-accent/50"
			{...props}
		>
			{children}
		</ol>
	),
	li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
		<li className="leading-relaxed" {...props}>
			{children}
		</li>
	),
	table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
		<div className="relative mb-4 overflow-x-auto rounded border border-white/5">
			<table className="w-full border-collapse font-mono text-xs" {...props}>
				{children}
			</table>
		</div>
	),
	thead: ({
		children,
		...props
	}: React.HTMLAttributes<HTMLTableSectionElement>) => (
		<thead className="border-white/5 border-b bg-white/[0.02]" {...props}>
			{children}
		</thead>
	),
	tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
		<tr
			className="border-white/[0.02] border-b transition-colors last:border-b-0 even:bg-white/[0.01] hover:bg-white/[0.03]"
			{...props}
		>
			{children}
		</tr>
	),
	th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
		<th
			className="px-3 py-2 text-left font-mono font-semibold text-[10px] text-foreground uppercase tracking-wider"
			{...props}
		>
			{children}
		</th>
	),
	td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
		<td className="px-3 py-2 text-muted-foreground" {...props}>
			{children}
		</td>
	),
	hr: () => <hr className="my-6 border-white/5" />,
	blockquote: ({
		children,
		...props
	}: React.HTMLAttributes<HTMLQuoteElement>) => (
		<blockquote
			className="mb-4 rounded-r border-accent/30 border-l-2 bg-accent/[0.02] py-2 pr-2 pl-3 font-mono text-muted-foreground text-sm"
			{...props}
		>
			{children}
		</blockquote>
	),
};

// =============================================================================
// ACTIVE HEADING TRACKING
// =============================================================================

function useActiveHeading(headings: TocItem[]): string | null {
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		if (headings.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id);
					}
				}
			},
			{ rootMargin: "-80px 0px -80% 0px" },
		);

		for (const heading of headings) {
			const el = document.getElementById(heading.id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	}, [headings]);

	return activeId;
}

// =============================================================================
// REPORT VIEWER CONTENT
// =============================================================================

export function ReportViewerContent({
	content,
	dataArtifacts,
}: ReportViewerContentProps) {
	const [mdxSource, setMdxSource] = useState<MDXRemoteSerializeResult | null>(
		null,
	);
	const [mdxFailed, setMdxFailed] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	const headings = useMemo(() => extractHeadings(content), [content]);
	const activeId = useActiveHeading(headings);

	// Serialize MDX on mount
	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);

		serializeMdx(content).then((result) => {
			if (cancelled) return;
			if (result) {
				setMdxSource(result);
			} else {
				setMdxFailed(true);
			}
			setIsLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [content]);

	// Merge base markdown components with MDX custom components (charts, tables, etc.)
	const allMdxComponents = useMemo(
		() => ({ ...markdownComponents, ...mdxComponents }),
		[],
	);

	if (isLoading) {
		return (
			<div
				className="flex flex-1 items-center justify-center"
				data-testid="report-viewer-loading"
			>
				<div className="flex flex-col items-center gap-3">
					<div className="size-6 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
					<span className="font-mono text-[10px] text-muted-foreground">
						Rendering report...
					</span>
				</div>
			</div>
		);
	}

	return (
		<ReportDataProvider data={dataArtifacts}>
			<div className="flex min-h-0 flex-1 overflow-auto">
				{/* Main content area */}
				<article
					className="mx-auto max-w-4xl flex-1 px-6 py-8"
					data-testid="report-viewer-content"
				>
					{mdxSource && !mdxFailed ? (
						<MDXRemote {...mdxSource} components={allMdxComponents as never} />
					) : (
						<ReactMarkdown
							components={markdownComponents as never}
							remarkPlugins={[remarkGfm]}
						>
							{content}
						</ReactMarkdown>
					)}
				</article>

				{/* Table of Contents sidebar — desktop xl+ only */}
				<div className="hidden shrink-0 py-8 pr-6 xl:block print:hidden">
					<TableOfContents activeId={activeId} items={headings} />
				</div>
			</div>
		</ReportDataProvider>
	);
}
