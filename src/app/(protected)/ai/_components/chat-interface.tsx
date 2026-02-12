"use client";

import {
	BarChart3,
	Brain,
	Code2,
	Database,
	Loader2,
	Send,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SUGGESTED_CHAT_QUERIES } from "@/lib/constants/ai";
import { api } from "@/trpc/react";
import { MessageRenderer } from "./message-renderer";

// =============================================================================
// TOOL CALL DISPLAY HELPERS
// =============================================================================

/** Map tool names to user-friendly labels and icons */
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

/** Parse tool calls JSON from an assistant message */
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

/** Get unique tool names from tool calls */
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
// CHAT INTERFACE
// =============================================================================

interface ChatInterfaceProps {
	model: string;
	"data-testid"?: string;
}

export function ChatInterface({ model, ...props }: ChatInterfaceProps) {
	const [activeConversationId, setActiveConversationId] = useState<
		string | null
	>(null);
	const [input, setInput] = useState("");
	const [pendingMessage, setPendingMessage] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const utils = api.useUtils();

	// Fetch conversations
	const { data: conversations } = api.ai.listConversations.useQuery({
		limit: 20,
	});

	// Fetch active conversation messages
	const { data: conversation } = api.ai.getConversation.useQuery(
		{ conversationId: activeConversationId ?? "" },
		{ enabled: !!activeConversationId },
	);

	// Mutations
	const createConversation = api.ai.createConversation.useMutation({
		onSuccess: (data) => {
			setActiveConversationId(data.id);
			void utils.ai.listConversations.invalidate();
		},
	});

	const sendMessage = api.ai.sendMessage.useMutation({
		onSuccess: () => {
			setPendingMessage(null);
			void utils.ai.getConversation.invalidate({
				conversationId: activeConversationId ?? "",
			});
			void utils.ai.listConversations.invalidate();
		},
		onError: () => {
			setPendingMessage(null);
		},
	});

	const deleteConversation = api.ai.deleteConversation.useMutation({
		onSuccess: () => {
			setActiveConversationId(null);
			void utils.ai.listConversations.invalidate();
		},
	});

	const messageCount = conversation?.messages?.length ?? 0;

	// Auto-scroll to bottom on new messages or when pending message changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: messageCount and pendingMessage trigger scroll on new messages
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messageCount, pendingMessage]);

	const handleSend = useCallback(async () => {
		const content = input.trim();
		if (!content) return;

		setInput("");
		setPendingMessage(content);

		// Create conversation if needed
		let conversationId = activeConversationId;
		if (!conversationId) {
			const newConversation = await createConversation.mutateAsync({
				mode: "chat",
				model,
			});
			conversationId = newConversation.id;
		}

		sendMessage.mutate({
			conversationId,
			content,
		});
	}, [input, activeConversationId, model, createConversation, sendMessage]);

	const handleSuggestedQuery = (query: string) => {
		setInput(query);
	};

	const handleNewConversation = () => {
		setActiveConversationId(null);
		setPendingMessage(null);
	};

	const messages = conversation?.messages ?? [];
	const isLoading = sendMessage.isPending || createConversation.isPending;

	return (
		<div
			className="flex h-full gap-0 sm:gap-3"
			data-testid={props["data-testid"]}
		>
			{/* Sidebar - Conversation List */}
			<div
				className="hidden w-56 flex-col rounded border border-border bg-card sm:flex"
				data-testid="chat-sidebar"
			>
				<div className="flex items-center justify-between border-border border-b px-3 py-2">
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Conversations
					</span>
					<Button
						className="h-6 px-2 font-mono text-[10px] text-primary uppercase tracking-wider"
						data-testid="chat-new-conversation-button"
						onClick={handleNewConversation}
						size="sm"
						variant="ghost"
					>
						+ New
					</Button>
				</div>
				<ScrollArea className="flex-1">
					<div className="p-1.5">
						{conversations?.items.map((conv) => (
							<button
								className={`w-full rounded px-2 py-1.5 text-left font-mono text-xs transition-colors ${
									activeConversationId === conv.id
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-secondary hover:text-foreground"
								}`}
								data-testid={`chat-conversation-item-${conv.id}`}
								key={conv.id}
								onClick={() => setActiveConversationId(conv.id)}
								type="button"
							>
								<span className="line-clamp-1">
									{conv.title ?? "New conversation"}
								</span>
							</button>
						))}
						{(!conversations?.items || conversations.items.length === 0) && (
							<p className="px-2 py-4 text-center font-mono text-[10px] text-muted-foreground">
								No conversations yet
							</p>
						)}
					</div>
				</ScrollArea>
			</div>

			{/* Main Chat Area */}
			<div className="flex flex-1 flex-col overflow-hidden rounded border border-border bg-card">
				{/* Terminal header */}
				<div className="flex items-center justify-between border-border border-b bg-secondary px-3 py-2 sm:px-4">
					<div className="flex items-center gap-1.5 sm:gap-2">
						<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
						<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
						<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
					</div>
					<span className="hidden font-mono text-[10px] text-muted-foreground sm:block">
						ai-chat-terminal
					</span>
					{activeConversationId && (
						<Button
							className="h-6 px-2 font-mono text-[10px] text-muted-foreground hover:text-loss"
							data-testid="chat-delete-button"
							onClick={() => {
								if (activeConversationId) {
									deleteConversation.mutate({
										conversationId: activeConversationId,
									});
								}
							}}
							size="sm"
							variant="ghost"
						>
							Delete
						</Button>
					)}
					{!activeConversationId && <div className="hidden w-14 sm:block" />}
				</div>

				{/* Chat Content */}
				<ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollRef}>
					{messages.length === 0 && !activeConversationId ? (
						<div
							className="flex h-full flex-col items-center justify-center px-2 text-center"
							data-testid="chat-empty-state"
						>
							<div className="mb-4 flex h-12 w-12 items-center justify-center rounded border border-border bg-secondary sm:h-16 sm:w-16">
								<Brain className="h-6 w-6 text-[#00d4ff] sm:h-8 sm:w-8" />
							</div>
							<h2 className="mb-2 font-semibold text-lg sm:text-xl">
								Query your trading data
							</h2>
							<p className="mb-4 max-w-md font-mono text-muted-foreground text-xs sm:mb-6">
								I can analyze your trades and provide insights on win rates,
								setups, timing, and more using real-time queries.
							</p>
							<div
								className="flex flex-wrap justify-center gap-1.5 sm:gap-2"
								data-testid="chat-suggested-queries"
							>
								{SUGGESTED_CHAT_QUERIES.map((query) => (
									<button
										className="min-h-[36px] rounded border border-border bg-secondary px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary sm:min-h-0 sm:px-3"
										data-testid="chat-suggested-query"
										key={query}
										onClick={() => handleSuggestedQuery(query)}
										type="button"
									>
										{query}
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="space-y-3 sm:space-y-4">
							{messages.map((message) => {
								const toolCalls =
									message.role === "assistant"
										? parseToolCalls(message.toolCalls)
										: [];
								const toolNames = getUniqueToolNames(toolCalls);

								return (
									<div className="flex gap-2 sm:gap-3" key={message.id}>
										<span className="mt-0.5 font-mono text-muted-foreground text-xs sm:text-sm">
											{message.role === "user" ? "$" : "\u2192"}
										</span>
										<div className="min-w-0 flex-1">
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
										</div>
									</div>
								);
							})}
							{/* Optimistic pending user message */}
							{pendingMessage && (
								<div className="flex gap-2 sm:gap-3">
									<span className="mt-0.5 font-mono text-muted-foreground text-xs sm:text-sm">
										$
									</span>
									<div className="min-w-0 flex-1">
										<p className="break-words font-mono text-primary/60 text-xs sm:text-sm">
											{pendingMessage}
										</p>
									</div>
								</div>
							)}
							{isLoading && (
								<div
									className="flex gap-2 sm:gap-3"
									data-testid="chat-loading-indicator"
								>
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
										<div
											className="flex flex-wrap gap-1"
											data-testid="chat-loading-tools"
										>
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
							)}
						</div>
					)}
				</ScrollArea>

				{/* Input */}
				<div className="border-border border-t bg-secondary p-3 sm:p-4">
					<form
						className="flex gap-2 sm:gap-3"
						data-testid="chat-input-form"
						onSubmit={(e) => {
							e.preventDefault();
							void handleSend();
						}}
					>
						<span className="mt-2.5 font-mono text-muted-foreground text-xs sm:mt-2 sm:text-sm">
							$
						</span>
						<Input
							className="min-h-[44px] flex-1 border-border bg-transparent font-mono text-sm"
							data-testid="chat-input"
							disabled={isLoading}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Ask about your trading data..."
							value={input}
						/>
						<Button
							className="min-h-[44px] min-w-[44px] font-mono text-xs uppercase tracking-wider"
							data-testid="chat-send-button"
							disabled={isLoading || !input.trim()}
							size="sm"
							type="submit"
						>
							<Send className="h-3.5 w-3.5" />
						</Button>
					</form>
				</div>
			</div>
		</div>
	);
}
