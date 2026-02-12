"use client";

import {
	BarChart3,
	Check,
	Code2,
	Copy,
	Database,
	Loader2,
	Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
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

	return (
		<div className="group flex gap-2 sm:gap-3">
			<span className="mt-0.5 font-mono text-muted-foreground text-xs sm:text-sm">
				{message.role === "user" ? "$" : "\u2192"}
			</span>
			<div className="relative min-w-0 flex-1">
				{message.role === "assistant" && toolNames.length > 0 && (
					<div
						className="mb-1.5 flex flex-wrap gap-1"
						data-testid="chat-tool-indicators"
					>
						{toolNames.map((name) => {
							const tool = TOOL_LABELS[name];
							const Icon = tool?.icon ?? Zap;
							return (
								<span
									className="inline-flex items-center gap-1 rounded bg-[#00d4ff]/10 px-1.5 py-0.5 font-mono text-[#00d4ff] text-[10px]"
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
				{message.role === "assistant" ? (
					<MessageRenderer content={message.content} />
				) : (
					<p className="break-words font-mono text-primary text-xs sm:text-sm">
						{message.content}
					</p>
				)}
				{message.role === "assistant" && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									className="-right-8 absolute top-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
									onClick={handleCopy}
									type="button"
								>
									{copied ? (
										<Check className="size-3 text-profit" />
									) : (
										<Copy className="size-3" />
									)}
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p className="font-mono text-xs">
									{copied ? "Copied" : "Copy"}
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</div>
		</div>
	);
}

// =============================================================================
// LOADING INDICATOR (exported for use in chat-interface)
// =============================================================================

export function ChatLoadingIndicator() {
	return (
		<div className="flex gap-2 sm:gap-3" data-testid="chat-loading-indicator">
			<span className="mt-0.5 font-mono text-muted-foreground text-xs sm:text-sm">
				{"\u2192"}
			</span>
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center gap-2">
					<Loader2 className="h-3 w-3 animate-spin text-[#00d4ff] sm:h-3.5 sm:w-3.5" />
					<span className="font-mono text-muted-foreground text-xs sm:text-sm">
						Analyzing trades
						<span className="animate-blink">_</span>
					</span>
				</div>
				<div className="flex flex-wrap gap-1" data-testid="chat-loading-tools">
					<span className="inline-flex items-center gap-1 rounded bg-[#00d4ff]/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
						<Database className="size-2.5" />
						Running SQL
					</span>
					<span className="inline-flex items-center gap-1 rounded bg-[#00d4ff]/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
						<BarChart3 className="size-2.5" />
						Analyzing data
					</span>
					<span className="inline-flex items-center gap-1 rounded bg-[#00d4ff]/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
						<Code2 className="size-2.5" />
						Generating chart
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
		<div className="flex gap-2 sm:gap-3">
			<span className="mt-0.5 font-mono text-muted-foreground text-xs sm:text-sm">
				$
			</span>
			<div className="min-w-0 flex-1">
				<p className="break-words font-mono text-primary/60 text-xs sm:text-sm">
					{content}
				</p>
			</div>
		</div>
	);
}
