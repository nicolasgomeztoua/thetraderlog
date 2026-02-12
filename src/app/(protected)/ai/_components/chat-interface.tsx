"use client";

import { useUser } from "@clerk/nextjs";
import {
	ArrowRight,
	BarChart3,
	Database,
	Sparkles,
	TrendingUp,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SUGGESTED_CHAT_QUERIES } from "@/lib/constants/ai";
import { api } from "@/trpc/react";
import { ChatInput } from "./chat-input";
import {
	ChatLoadingIndicator,
	ChatMessage,
	ChatPendingMessage,
} from "./chat-message";
import { ChatSidebar } from "./chat-sidebar";
import { ModelSelector } from "./model-selector";

// Suggested queries for the empty state — mapped from SUGGESTED_CHAT_QUERIES
const SUGGESTED_QUERY_CARDS: {
	icon: typeof TrendingUp;
	title: string;
	description: string;
	query: string;
}[] = [
	{
		icon: TrendingUp,
		title: "Win rate analysis",
		description: "Compare my performance across different time periods",
		query: SUGGESTED_CHAT_QUERIES[0] ?? "What's my win rate this month?",
	},
	{
		icon: BarChart3,
		title: "Session breakdown",
		description: "Which trading sessions are most profitable?",
		query:
			SUGGESTED_CHAT_QUERIES[1] ?? "Which trading session is most profitable?",
	},
	{
		icon: Database,
		title: "Symbol performance",
		description: "Show my best and worst performing instruments",
		query:
			SUGGESTED_CHAT_QUERIES[2] ??
			"Show me my best and worst performing symbols",
	},
	{
		icon: Zap,
		title: "Overtrading detection",
		description: "Am I taking too many trades on losing days?",
		query: SUGGESTED_CHAT_QUERIES[3] ?? "Am I overtrading on losing days?",
	},
];

const CAPABILITY_PILLS = [
	"SQL Queries",
	"Pattern Analysis",
	"Market Data",
	"Chart Generation",
];

function getTimeGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

interface ChatInterfaceProps {
	mode: "chat" | "report";
	onModeChange: (mode: "chat" | "report") => void;
}

export function ChatInterface({ mode, onModeChange }: ChatInterfaceProps) {
	const { user } = useUser();
	const [activeConversationId, setActiveConversationId] = useState<
		string | null
	>(null);
	const [input, setInput] = useState("");
	const [pendingMessage, setPendingMessage] = useState<string | null>(null);
	const [lastSentAt, setLastSentAt] = useState<number>(0);
	const scrollRef = useRef<HTMLDivElement>(null);

	const greeting = useMemo(() => {
		const timeGreeting = getTimeGreeting();
		const name = user?.firstName;
		return name ? `${timeGreeting}, ${name}` : timeGreeting;
	}, [user?.firstName]);

	const utils = api.useUtils();

	// Fetch conversations
	const { data: conversations, isLoading: isConversationsLoading } =
		api.ai.listConversations.useQuery({
			limit: 20,
		});

	// Fetch active conversation messages
	const { data: conversation, isLoading: isConversationLoading } =
		api.ai.getConversation.useQuery(
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

	const handleSend = useCallback(
		async (content?: string) => {
			const text = (content ?? input).trim();
			if (!text) return;

			setInput("");
			setPendingMessage(text);
			setLastSentAt(Date.now());

			// Create conversation if needed
			let conversationId = activeConversationId;
			if (!conversationId) {
				const newConversation = await createConversation.mutateAsync({
					mode: "chat",
				});
				conversationId = newConversation.id;
			}

			sendMessage.mutate({
				conversationId,
				content: text,
			});
		},
		[input, activeConversationId, createConversation, sendMessage],
	);

	const handleNewConversation = () => {
		setActiveConversationId(null);
		setPendingMessage(null);
		setLastSentAt(0);
	};

	const messages = conversation?.messages ?? [];
	const isLoading = sendMessage.isPending || createConversation.isPending;

	return (
		<div className="flex h-full gap-0 sm:gap-3" data-testid="ai-chat-interface">
			{/* Sidebar */}
			<ChatSidebar
				activeId={activeConversationId}
				conversations={conversations?.items ?? []}
				isLoading={isConversationsLoading}
				onDelete={(id) => deleteConversation.mutate({ conversationId: id })}
				onNew={handleNewConversation}
				onSelect={(id) => {
					setActiveConversationId(id);
					setLastSentAt(0);
				}}
			/>

			{/* Main Chat Area */}
			<div className="flex flex-1 flex-col overflow-hidden rounded border border-border bg-card">
				{/* Model Selector replaces terminal header */}
				<ModelSelector mode={mode} onModeChange={onModeChange} />

				{/* Chat Content */}
				<ScrollArea className="flex-1" ref={scrollRef}>
					<div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
						{isConversationLoading && activeConversationId ? (
							<div className="space-y-3 sm:space-y-4">
								<div className="flex justify-start">
									<div className="max-w-[80%] space-y-2 rounded bg-secondary p-3">
										<Skeleton className="h-3 w-48" />
										<Skeleton className="h-3 w-64" />
										<Skeleton className="h-3 w-40" />
									</div>
								</div>
								<div className="flex justify-end">
									<div className="max-w-[80%] space-y-2 rounded bg-primary/10 p-3">
										<Skeleton className="h-3 w-48" />
										<Skeleton className="h-3 w-32" />
									</div>
								</div>
								<div className="flex justify-start">
									<div className="max-w-[80%] space-y-2 rounded bg-secondary p-3">
										<Skeleton className="h-3 w-48" />
										<Skeleton className="h-3 w-64" />
										<Skeleton className="h-3 w-40" />
									</div>
								</div>
							</div>
						) : messages.length === 0 && !activeConversationId ? (
							<div
								className="flex h-full min-h-[400px] flex-col items-center justify-center px-2 text-center"
								data-testid="chat-empty-state"
							>
								{/* Icon */}
								<div
									className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent/20 bg-accent/5 sm:h-14 sm:w-14"
									style={{ animationDelay: "0ms" }}
								>
									<Sparkles className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
								</div>

								{/* Time-aware greeting */}
								<h2
									className="mb-1.5 font-bold text-foreground text-xl tracking-tight sm:text-2xl"
									data-testid="chat-empty-greeting"
									style={{ animationDelay: "100ms" }}
								>
									{greeting}
								</h2>

								{/* Subtitle */}
								<p
									className="mb-4 max-w-md font-mono text-muted-foreground text-sm"
									style={{ animationDelay: "100ms" }}
								>
									Ask questions about your trades, analyze patterns, and get
									insights
								</p>

								{/* Capability pills */}
								<div
									className="mb-6 flex flex-wrap justify-center gap-2"
									data-testid="chat-capability-pills"
									style={{ animationDelay: "200ms" }}
								>
									{CAPABILITY_PILLS.map((pill) => (
										<span
											className="rounded border border-white/10 bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
											key={pill}
										>
											{pill}
										</span>
									))}
								</div>

								{/* Suggested query cards */}
								<div
									className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2"
									data-testid="chat-suggested-queries"
									style={{ animationDelay: "300ms" }}
								>
									{SUGGESTED_QUERY_CARDS.map((card) => {
										const Icon = card.icon;
										return (
											<button
												className="group rounded border border-white/5 bg-white/[0.02] p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.02]"
												data-testid="chat-suggested-query"
												key={card.title}
												onClick={() => void handleSend(card.query)}
												type="button"
											>
												<div className="flex items-start gap-2.5">
													<Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
													<div className="min-w-0 flex-1">
														<div className="flex items-center justify-between">
															<span className="font-mono text-foreground text-xs">
																{card.title}
															</span>
															<ArrowRight className="-translate-x-1 h-3 w-3 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100" />
														</div>
														<p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
															{card.description}
														</p>
													</div>
												</div>
											</button>
										);
									})}
								</div>

								{/* Keyboard shortcut hint */}
								<p
									className="mt-4 font-mono text-[10px] text-muted-foreground/30"
									style={{ animationDelay: "300ms" }}
								>
									Press{" "}
									<kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5">
										/
									</kbd>{" "}
									to focus input
								</p>
							</div>
						) : (
							<div className="space-y-4 sm:space-y-5">
								{messages.map((message, index) => {
									const isLastAssistant =
										message.role === "assistant" &&
										index === messages.length - 1;
									// Messages are "from history" if loaded without a recent send action
									const isFromHistory = lastSentAt === 0;
									return (
										<ChatMessage
											isFromHistory={isFromHistory}
											isLatest={isLastAssistant}
											key={message.id}
											message={message}
										/>
									);
								})}
								{pendingMessage && (
									<ChatPendingMessage content={pendingMessage} />
								)}
								{isLoading && <ChatLoadingIndicator />}
							</div>
						)}
					</div>
				</ScrollArea>

				{/* Input */}
				<div className="border-border border-t px-4 py-3">
					<div className="mx-auto max-w-3xl">
						<ChatInput
							isLoading={isLoading}
							onChange={setInput}
							onSubmit={() => void handleSend()}
							value={input}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
