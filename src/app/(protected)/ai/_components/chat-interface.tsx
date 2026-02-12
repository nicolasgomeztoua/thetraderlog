"use client";

import { Brain } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// Show first 4 suggested queries in a 2x2 grid
const DISPLAY_QUERIES = SUGGESTED_CHAT_QUERIES.slice(0, 4);

interface ChatInterfaceProps {
	mode: "chat" | "report";
	onModeChange: (mode: "chat" | "report") => void;
}

export function ChatInterface({ mode, onModeChange }: ChatInterfaceProps) {
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

	const handleSend = useCallback(
		async (content?: string) => {
			const text = (content ?? input).trim();
			if (!text) return;

			setInput("");
			setPendingMessage(text);

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
	};

	const messages = conversation?.messages ?? [];
	const isLoading = sendMessage.isPending || createConversation.isPending;

	return (
		<div className="flex h-full gap-0 sm:gap-3" data-testid="ai-chat-interface">
			{/* Sidebar */}
			<ChatSidebar
				activeId={activeConversationId}
				conversations={conversations?.items ?? []}
				onDelete={(id) => deleteConversation.mutate({ conversationId: id })}
				onNew={handleNewConversation}
				onSelect={setActiveConversationId}
			/>

			{/* Main Chat Area */}
			<div className="flex flex-1 flex-col overflow-hidden rounded border border-border bg-card">
				{/* Model Selector replaces terminal header */}
				<ModelSelector mode={mode} onModeChange={onModeChange} />

				{/* Chat Content */}
				<ScrollArea className="flex-1" ref={scrollRef}>
					<div className="mx-auto max-w-3xl px-4 py-4">
						{messages.length === 0 && !activeConversationId ? (
							<div
								className="flex h-full min-h-[400px] flex-col items-center justify-center px-2 text-center"
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
									className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2"
									data-testid="chat-suggested-queries"
								>
									{DISPLAY_QUERIES.map((query) => (
										<button
											className="rounded border border-border bg-secondary p-3 text-left font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
											data-testid="chat-suggested-query"
											key={query}
											onClick={() => void handleSend(query)}
											type="button"
										>
											{query}
										</button>
									))}
								</div>
							</div>
						) : (
							<div className="space-y-3 sm:space-y-4">
								{messages.map((message) => (
									<ChatMessage key={message.id} message={message} />
								))}
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
							disabled={isLoading}
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
