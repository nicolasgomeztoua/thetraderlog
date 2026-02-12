"use client";

import { BarChart3, Check, Code2, Copy, Database, Zap } from "lucide-react";
import { useCallback, useState } from "react";
import { MessageRenderer } from "./message-renderer";

// =============================================================================
// TOOL CALL DISPLAY HELPERS
// =============================================================================

const TOOL_LABELS: Record<string, { label: string; icon: typeof Database }> = {
	run_query: { label: "Running SQL", icon: Database },
	call_analytics: { label: "Analyzing data", icon: BarChart3 },
	get_market_data: { label: "Fetching market data", icon: Zap },
	run_python: { label: "Generating chart", icon: Code2 },
};

type ParsedToolCall = {
	id: string;
	function: { name: string; arguments: string };
};

function parseToolCalls(toolCallsJson: string | null): ParsedToolCall[] {
	if (!toolCallsJson) return [];
	try {
		const parsed = JSON.parse(toolCallsJson);
		if (Array.isArray(parsed)) return parsed as ParsedToolCall[];
	} catch {
		// Invalid JSON
	}
	return [];
}

function getUniqueToolNames(toolCalls: ParsedToolCall[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const tc of toolCalls) {
		const name = tc.function?.name;
		if (name && !seen.has(name)) {
			seen.add(name);
			result.push(name);
		}
	}
	return result;
}

// =============================================================================
// CHAT MESSAGE
// =============================================================================

interface ChatMessageProps {
	message: {
		id: string;
		role: string;
		content: string;
		toolCalls?: string | null;
	};
}

export function ChatMessage({ message }: ChatMessageProps) {
	const [copied, setCopied] = useState(false);

	const toolCalls =
		message.role === "assistant"
			? parseToolCalls(message.toolCalls ?? null)
			: [];
	const toolNames = getUniqueToolNames(toolCalls);

	const handleCopy = useCallback(async () => {
		await navigator.clipboard.writeText(message.content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [message.content]);

	if (message.role === "user") {
		return (
			<div className="animate-fade-in-up">
				<div className="flex gap-2 sm:gap-3">
					<span className="mt-0.5 font-mono text-primary text-xs sm:text-sm">
						$
					</span>
					<div className="min-w-0 flex-1 border-primary/30 border-l-2 pl-3">
						<p className="break-words font-mono text-foreground text-sm">
							{message.content}
						</p>
					</div>
				</div>
			</div>
		);
	}

	// Assistant message
	return (
		<div className="animate-fade-in-up">
			<div className="group flex gap-2 sm:gap-3">
				<span className="mt-0.5 font-mono text-accent text-xs sm:text-sm">
					{"\u2192"}
				</span>
				<div className="min-w-0 flex-1 rounded border border-white/5 bg-white/[0.01] p-3 sm:p-4">
					{toolNames.length > 0 && (
						<div
							className="mb-3 flex flex-wrap gap-1.5"
							data-testid="chat-tool-indicators"
						>
							{toolNames.map((name) => {
								const tool = TOOL_LABELS[name];
								const Icon = tool?.icon ?? Zap;
								return (
									<span
										className="inline-flex items-center gap-1 rounded border border-accent/20 bg-accent/5 px-1.5 py-0.5 font-mono text-[10px] text-accent"
										data-testid={`chat-tool-badge-${name}`}
										key={name}
									>
										<Icon className="size-2.5" />
										{tool?.label ?? name}
									</span>
								);
							})}
						</div>
					)}
					<MessageRenderer content={message.content} />
					{/* Copy button in card footer */}
					<div className="mt-3 flex justify-end border-white/5 border-t pt-2 opacity-0 transition-opacity group-hover:opacity-100">
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
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// LOADING INDICATOR (exported for use in chat-interface)
// =============================================================================

export function ChatLoadingIndicator() {
	return (
		<div
			className="flex animate-fade-in-up gap-2 sm:gap-3"
			data-testid="chat-loading-indicator"
		>
			<span className="mt-0.5 font-mono text-accent text-xs sm:text-sm">
				{"\u2192"}
			</span>
			<div className="min-w-0 flex-1 rounded border border-white/5 bg-white/[0.01] p-3 sm:p-4">
				<div className="flex items-center gap-2">
					<div className="flex gap-1">
						<span
							className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60"
							style={{ animationDelay: "0ms" }}
						/>
						<span
							className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60"
							style={{ animationDelay: "150ms" }}
						/>
						<span
							className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60"
							style={{ animationDelay: "300ms" }}
						/>
					</div>
					<span className="font-mono text-muted-foreground/40 text-xs">
						Thinking...
					</span>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// PENDING MESSAGE
// =============================================================================

export function ChatPendingMessage({ content }: { content: string }) {
	return (
		<div className="animate-fade-in-up">
			<div className="flex gap-2 sm:gap-3">
				<span className="mt-0.5 font-mono text-primary text-xs sm:text-sm">
					$
				</span>
				<div className="min-w-0 flex-1 border-primary/30 border-l-2 pl-3 opacity-70">
					<p className="break-words font-mono text-foreground text-sm">
						{content}
					</p>
				</div>
			</div>
		</div>
	);
}
