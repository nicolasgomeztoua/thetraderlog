"use client";

import Image from "next/image";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

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
		<strong className="font-semibold text-foreground">{children}</strong>
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
			className="mb-2 ml-4 list-decimal space-y-0.5 font-mono text-muted-foreground text-xs sm:text-sm"
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
				className="rounded bg-secondary px-1 py-0.5 font-mono text-primary text-xs"
				{...props}
			>
				{children}
			</code>
		);
	},
	pre: ({ children }) => (
		<pre
			className="mb-2 overflow-x-auto rounded border border-border bg-[#0a0a0a] p-3 font-mono text-xs leading-relaxed"
			data-testid="message-code-block"
		>
			{children}
		</pre>
	),
	table: ({ children }) => (
		<div className="mb-2 overflow-x-auto" data-testid="message-table">
			<table className="w-full border-collapse font-mono text-xs">
				{children}
			</table>
		</div>
	),
	thead: ({ children }) => (
		<thead className="border-border border-b bg-secondary/50">{children}</thead>
	),
	tbody: ({ children }) => <tbody>{children}</tbody>,
	tr: ({ children }) => (
		<tr className="border-border border-b last:border-b-0">{children}</tr>
	),
	th: ({ children }) => (
		<th className="px-2 py-1.5 text-left font-semibold text-foreground text-xs uppercase tracking-wider">
			{children}
		</th>
	),
	td: ({ children }) => (
		<td className="px-2 py-1.5 text-muted-foreground">{children}</td>
	),
	a: ({ href, children }) => (
		<a
			className="text-[#00d4ff] underline underline-offset-2 hover:text-[#00d4ff]/80"
			href={href}
			rel="noopener noreferrer"
			target="_blank"
		>
			{children}
		</a>
	),
	hr: () => <hr className="my-3 border-border" />,
	blockquote: ({ children }) => (
		<blockquote className="mb-2 border-primary/50 border-l-2 pl-3 font-mono text-muted-foreground text-xs italic sm:text-sm">
			{children}
		</blockquote>
	),
	img: ({ src, alt }) => {
		if (!src || typeof src !== "string") return null;
		return (
			<span
				className="my-2 block overflow-hidden rounded border border-border"
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
