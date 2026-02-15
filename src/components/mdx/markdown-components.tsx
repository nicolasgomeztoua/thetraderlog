/**
 * Terminal-styled markdown components for ReactMarkdown rendering.
 * No hooks — pure styled elements.
 */

import { toHeadingId } from "@/lib/ai/report-pipeline/report-schema";

function headingId(children: React.ReactNode): string {
	return toHeadingId(
		typeof children === "string" ? children : String(children ?? ""),
	);
}

export const markdownComponents = {
	h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h1
			className="mt-8 mb-4 font-bold font-mono text-foreground text-xl first:mt-0"
			id={headingId(children)}
			{...props}
		>
			{children}
		</h1>
	),
	h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h2
			className="mt-6 mb-3 font-bold font-mono text-foreground text-lg first:mt-0"
			id={headingId(children)}
			{...props}
		>
			{children}
		</h2>
	),
	h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h3
			className="mt-4 mb-2 font-mono font-semibold text-base text-foreground first:mt-0"
			id={headingId(children)}
			{...props}
		>
			{children}
		</h3>
	),
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
