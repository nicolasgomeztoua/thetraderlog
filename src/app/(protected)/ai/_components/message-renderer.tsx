"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import Image from "next/image";
import { memo, useCallback, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// =============================================================================
// CODE BLOCK
// =============================================================================

function CodeBlockWrapper({
	children,
	language,
}: {
	children: React.ReactNode;
	language?: string;
}) {
	const [copied, setCopied] = useState(false);
	const preRef = useRef<HTMLPreElement>(null);

	const handleCopy = useCallback(async () => {
		const text = preRef.current?.textContent ?? "";
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, []);

	return (
		<div
			className="mb-3 overflow-hidden rounded border border-white/5 bg-[#0a0a0a]"
			data-testid="message-code-block"
		>
			{/* Header bar */}
			<div className="flex items-center justify-between border-white/5 border-b bg-white/[0.02] px-3 py-1.5">
				<span className="font-mono text-[10px] text-muted-foreground/50 uppercase">
					{language ?? "code"}
				</span>
				<button
					className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
					onClick={() => void handleCopy()}
					type="button"
				>
					{copied ? (
						<>
							<Check className="size-3 text-profit" />
							<span className="text-profit">Copied</span>
						</>
					) : (
						<>
							<Copy className="size-3" />
							<span>Copy</span>
						</>
					)}
				</button>
			</div>
			{/* Code content */}
			<pre
				className="overflow-x-auto p-3 font-mono text-xs leading-relaxed"
				ref={preRef}
			>
				{children}
			</pre>
		</div>
	);
}

// =============================================================================
// MARKDOWN COMPONENTS
// =============================================================================

const markdownComponents: Components = {
	h1: ({ children }) => (
		<h1
			className="mt-4 mb-3 font-bold font-mono text-foreground text-lg first:mt-0"
			data-testid="message-heading-h1"
		>
			{children}
		</h1>
	),
	h2: ({ children }) => (
		<h2
			className="mt-3 mb-2 font-bold font-mono text-base text-foreground first:mt-0"
			data-testid="message-heading-h2"
		>
			{children}
		</h2>
	),
	h3: ({ children }) => (
		<h3
			className="mt-3 mb-2 font-mono font-semibold text-foreground text-sm first:mt-0"
			data-testid="message-heading-h3"
		>
			{children}
		</h3>
	),
	h4: ({ children }) => (
		<h4 className="mt-2 mb-1 font-mono font-semibold text-foreground text-xs first:mt-0">
			{children}
		</h4>
	),
	p: ({ children }) => (
		<p className="mb-2 font-mono text-muted-foreground text-xs leading-relaxed last:mb-0 sm:text-sm">
			{children}
		</p>
	),
	strong: ({ children }) => (
		<strong className="font-medium text-foreground">{children}</strong>
	),
	em: ({ children }) => (
		<em className="text-muted-foreground italic">{children}</em>
	),
	ul: ({ children }) => (
		<ul
			className="mb-2 ml-4 list-disc space-y-0.5 font-mono text-muted-foreground text-xs sm:text-sm"
			data-testid="message-list-unordered"
		>
			{children}
		</ul>
	),
	ol: ({ children }) => (
		<ol
			className="mb-2 ml-4 list-decimal space-y-0.5 font-mono text-muted-foreground text-xs marker:text-accent/50 sm:text-sm"
			data-testid="message-list-ordered"
		>
			{children}
		</ol>
	),
	li: ({ children }) => <li className="leading-relaxed">{children}</li>,
	code: ({ className, children, ...props }) => {
		const isBlock = className?.includes("language-");
		if (isBlock) {
			return (
				<code className={`${className ?? ""} block`} {...props}>
					{children}
				</code>
			);
		}
		return (
			<code
				className="rounded border border-white/5 bg-white/5 px-1.5 py-0.5 font-mono text-primary text-xs"
				{...props}
			>
				{children}
			</code>
		);
	},
	pre: ({ children }) => {
		// Extract language from child code element's className
		let language: string | undefined;
		if (children && typeof children === "object" && "props" in children) {
			const childClassName =
				(children.props as { className?: string })?.className ?? "";
			const match = /language-(\w+)/.exec(childClassName);
			language = match?.[1];
		}

		return <CodeBlockWrapper language={language}>{children}</CodeBlockWrapper>;
	},
	table: ({ children }) => (
		<div
			className="relative mb-3 overflow-x-auto rounded border border-white/5"
			data-testid="message-table"
		>
			<table className="w-full border-collapse font-mono text-xs">
				{children}
			</table>
		</div>
	),
	thead: ({ children }) => (
		<thead className="border-white/5 border-b bg-white/[0.02]">
			{children}
		</thead>
	),
	tbody: ({ children }) => <tbody>{children}</tbody>,
	tr: ({ children }) => (
		<tr className="border-white/[0.02] border-b transition-colors last:border-b-0 even:bg-white/[0.01] hover:bg-white/[0.03]">
			{children}
		</tr>
	),
	th: ({ children }) => (
		<th className="px-3 py-2 text-left font-mono font-semibold text-[10px] text-foreground uppercase tracking-wider">
			{children}
		</th>
	),
	td: ({ children }) => (
		<td className="px-3 py-2 text-muted-foreground">{children}</td>
	),
	a: ({ href, children }) => {
		const isExternal =
			href?.startsWith("http://") || href?.startsWith("https://");
		return (
			<a
				className="inline-flex items-center gap-0.5 text-accent underline underline-offset-2 hover:text-accent/80"
				href={href}
				rel="noopener noreferrer"
				target="_blank"
			>
				{children}
				{isExternal && <ExternalLink className="inline h-2.5 w-2.5" />}
			</a>
		);
	},
	hr: () => <hr className="my-3 border-white/5" />,
	blockquote: ({ children }) => (
		<blockquote className="mb-3 rounded-r border-accent/30 border-l-2 bg-accent/[0.02] py-2 pr-2 pl-3 font-mono text-muted-foreground text-xs sm:text-sm">
			{children}
		</blockquote>
	),
	img: ({ src, alt }) => {
		if (!src || typeof src !== "string") return null;
		return (
			<span
				className="my-2 block overflow-hidden rounded border border-white/5"
				data-testid="message-chart-image"
			>
				<Image
					alt={alt ?? "Chart"}
					className="h-auto w-full"
					height={400}
					src={src}
					unoptimized
					width={600}
				/>
			</span>
		);
	},
};

// =============================================================================
// MESSAGE RENDERER
// =============================================================================

interface MessageRendererProps {
	content: string;
}

export const MessageRenderer = memo(function MessageRenderer({
	content,
}: MessageRendererProps) {
	return (
		<div className="message-renderer min-w-0" data-testid="message-renderer">
			<ReactMarkdown
				components={markdownComponents}
				remarkPlugins={[remarkGfm]}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
});
