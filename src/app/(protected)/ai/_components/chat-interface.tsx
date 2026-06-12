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
import { toast } from "sonner";

import {
	UsageLimitBanner,
	useChatLimitReached,
} from "@/components/billing/usage-limit-banner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/contexts/account-context";
import { useImageUpload } from "@/hooks/use-image-upload";
import {
	AI_CHAT_ALLOWED_IMAGE_MIME_TYPES,
	AI_CHAT_MAX_IMAGE_SIZE,
	MAX_AI_CHAT_IMAGES,
	SUGGESTED_CHAT_QUERIES,
} from "@/lib/constants/ai";
import {
	ERR_IMAGE_TYPE_UNSUPPORTED,
	ERR_TRADE_CREATE_FAILED,
	errImageTooLarge,
} from "@/lib/constants/errors";
import { getErrorMessage } from "@/lib/shared/utils";
import { api, type RouterInputs, type RouterOutputs } from "@/trpc/react";
import { ChatInput, type PendingAttachment } from "./chat-input";
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

type CreateTradeInput = RouterInputs["trades"]["create"];
type ChatAttachment = NonNullable<
	RouterOutputs["ai"]["getConversation"]["messages"][number]["attachments"]
>[number];

interface ChatInterfaceProps {
	mode: "chat" | "report";
	onModeChange: (mode: "chat" | "report") => void;
}

export function ChatInterface({ mode, onModeChange }: ChatInterfaceProps) {
	const { user } = useUser();
	const { selectedAccountId } = useAccount();
	const [activeConversationId, setActiveConversationId] = useState<
		string | null
	>(null);
	const [input, setInput] = useState("");
	const [pendingMessage, setPendingMessage] = useState<string | null>(null);
	const [lastSentAt, setLastSentAt] = useState<number>(0);
	const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
	const [pendingAttachments, setPendingAttachments] = useState<
		PendingAttachment[]
	>([]);
	// messageId -> logged tradeId, for instant non-interactive card state this session.
	const [loggedByMessageId, setLoggedByMessageId] = useState<
		Record<string, string>
	>({});
	const scrollRef = useRef<HTMLDivElement>(null);
	const chatLimitReached = useChatLimitReached();
	const { uploadImage } = useImageUpload({ context: "ai-chat" });

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
			void utils.billing.getUsage.invalidate();
			void utils.ai.getConversation.invalidate({
				conversationId: activeConversationId ?? "",
			});
			void utils.ai.listConversations.invalidate();
		},
		onError: (err) => {
			setPendingMessage(null);
			if (err.data?.code === "FORBIDDEN") {
				void utils.billing.getUsage.invalidate();
			}
		},
	});

	const deleteConversation = api.ai.deleteConversation.useMutation({
		onSuccess: () => {
			setActiveConversationId(null);
			void utils.ai.listConversations.invalidate();
		},
	});

	// Trade logging from a proposal card (confirm flow).
	const createTrade = api.trades.create.useMutation();
	const confirmUpload = api.trades.confirmUpload.useMutation();
	const markProposalLogged = api.ai.markProposalLogged.useMutation();

	// Upload pasted/dropped/picked chart images, with instant blob preview.
	const handleAddFiles = useCallback(
		async (files: File[]) => {
			const room = MAX_AI_CHAT_IMAGES - pendingAttachments.length;
			if (room <= 0) return;
			for (const file of files.slice(0, room)) {
				if (
					!AI_CHAT_ALLOWED_IMAGE_MIME_TYPES.includes(
						file.type as (typeof AI_CHAT_ALLOWED_IMAGE_MIME_TYPES)[number],
					)
				) {
					toast.error(ERR_IMAGE_TYPE_UNSUPPORTED);
					continue;
				}
				if (file.size > AI_CHAT_MAX_IMAGE_SIZE) {
					toast.error(errImageTooLarge(AI_CHAT_MAX_IMAGE_SIZE / (1024 * 1024)));
					continue;
				}
				const id = crypto.randomUUID();
				const previewUrl = URL.createObjectURL(file);
				setPendingAttachments((prev) => [
					...prev,
					{
						id,
						previewUrl,
						status: "uploading",
						mimeType: file.type,
						filename: file.name,
						size: file.size,
					},
				]);
				const uploaded = await uploadImage(file);
				setPendingAttachments((prev) =>
					prev.map((a) =>
						a.id === id
							? uploaded
								? {
										...a,
										status: "done",
										key: uploaded.key,
										previewUrl: uploaded.url,
									}
								: { ...a, status: "error" }
							: a,
					),
				);
			}
		},
		[pendingAttachments.length, uploadImage],
	);

	const removeAttachment = useCallback((id: string) => {
		setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
	}, []);

	// Confirm & Log: create the trade, attach the source chart(s), mark logged.
	const handleConfirmTrade = useCallback(
		async (
			messageId: string,
			tradeInput: CreateTradeInput,
			chartAttachments: ChatAttachment[],
		): Promise<string | null> => {
			try {
				const trade = await createTrade.mutateAsync(tradeInput);
				if (!trade) {
					toast.error(ERR_TRADE_CREATE_FAILED);
					return null;
				}
				// Attach the source chart(s) to the new trade (non-fatal on failure).
				for (const att of chartAttachments) {
					if (!att.size || att.size <= 0) continue;
					try {
						await confirmUpload.mutateAsync({
							tradeId: trade.id,
							key: att.key,
							filename: att.filename ?? "chart.png",
							mimeType: att.mimeType,
							size: att.size,
							caption: "Chart from AI chat",
						});
					} catch {
						// Trade is logged; a failed attachment shouldn't block success.
					}
				}
				try {
					await markProposalLogged.mutateAsync({
						messageId,
						tradeId: trade.id,
					});
				} catch {
					// Durable flag is best-effort; session state still guards double-log.
				}
				setLoggedByMessageId((prev) => ({ ...prev, [messageId]: trade.id }));
				void utils.ai.getConversation.invalidate({
					conversationId: activeConversationId ?? "",
				});
				toast.success("Trade logged");
				return trade.id;
			} catch (error) {
				toast.error(getErrorMessage(error, ERR_TRADE_CREATE_FAILED));
				return null;
			}
		},
		[
			createTrade,
			confirmUpload,
			markProposalLogged,
			utils,
			activeConversationId,
		],
	);

	const messageCount = conversation?.messages?.length ?? 0;

	// Auto-scroll as content grows (typewriter animation, new messages, loading indicator)
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-attach observer when conversation changes
	useEffect(() => {
		const container = scrollRef.current;
		if (!container) return;
		const content = container.firstElementChild;
		if (!content) return;

		const observer = new ResizeObserver(() => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
			if (isNearBottom) {
				container.scrollTop = scrollHeight;
			}
		});

		observer.observe(content);
		return () => observer.disconnect();
	}, [activeConversationId]);

	// Immediate scroll when new messages arrive
	// biome-ignore lint/correctness/useExhaustiveDependencies: messageCount triggers scroll on new messages
	useEffect(() => {
		requestAnimationFrame(() => {
			if (scrollRef.current) {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			}
		});
	}, [messageCount]);

	const handleSend = useCallback(
		async (content?: string) => {
			const text = (content ?? input).trim();
			const readyAttachments = pendingAttachments.flatMap((a) =>
				a.status === "done" && a.key
					? [
							{
								key: a.key,
								mimeType: a.mimeType,
								filename: a.filename,
								size: a.size,
							},
						]
					: [],
			);
			if (!text && readyAttachments.length === 0) return;

			setInput("");
			setPendingAttachments([]);
			setPendingMessage(text || "📎 Chart attached");
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
				...(selectedAccountId && { accountId: selectedAccountId }),
				...(readyAttachments.length > 0 && {
					imageAttachments: readyAttachments,
				}),
			});
		},
		[
			input,
			pendingAttachments,
			activeConversationId,
			createConversation,
			sendMessage,
			selectedAccountId,
		],
	);

	const handleNewConversation = () => {
		setActiveConversationId(null);
		setPendingMessage(null);
		setLastSentAt(0);
	};

	const messages = conversation?.messages ?? [];
	const isLoading = sendMessage.isPending || createConversation.isPending;

	// For each assistant message, the chart attachment(s) of the user message
	// directly before it — the source the proposal was extracted from.
	const chartAttachmentsByMessageId = useMemo(() => {
		const list = conversation?.messages ?? [];
		const map: Record<string, ChatAttachment[]> = {};
		for (let i = 0; i < list.length; i++) {
			const msg = list[i];
			if (msg?.role !== "assistant") continue;
			for (let j = i - 1; j >= 0; j--) {
				const prev = list[j];
				if (prev?.role === "user") {
					if (prev.attachments?.length) map[msg.id] = prev.attachments;
					break;
				}
			}
		}
		return map;
	}, [conversation?.messages]);

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

			{/* Mobile Sidebar Drawer */}
			<Sheet onOpenChange={setMobileDrawerOpen} open={mobileDrawerOpen}>
				<SheetContent className="w-72 border-white/10 bg-card p-0" side="left">
					<ChatSidebar
						activeId={activeConversationId}
						conversations={conversations?.items ?? []}
						isLoading={isConversationsLoading}
						isMobile
						onDelete={(id) => deleteConversation.mutate({ conversationId: id })}
						onNew={() => {
							handleNewConversation();
							setMobileDrawerOpen(false);
						}}
						onSelect={(id) => {
							setActiveConversationId(id);
							setLastSentAt(0);
							setTimeout(() => setMobileDrawerOpen(false), 100);
						}}
					/>
				</SheetContent>
			</Sheet>

			{/* Main Chat Area */}
			<div className="flex flex-1 flex-col overflow-hidden rounded border border-border bg-card">
				{/* Model Selector replaces terminal header */}
				<ModelSelector
					mode={mode}
					onMenuClick={() => setMobileDrawerOpen(true)}
					onModeChange={onModeChange}
				/>

				{/* Chat Content */}
				<div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
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
									suppressHydrationWarning
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
											className="rounded border border-white/10 bg-white/2 px-2.5 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
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
												className={`group rounded border border-white/5 bg-white/2 p-3 text-left transition-all ${chatLimitReached ? "pointer-events-none opacity-40" : "hover:border-primary/30 hover:bg-primary/2"}`}
												data-testid="chat-suggested-query"
												disabled={chatLimitReached}
												key={card.title}
												onClick={() =>
													!chatLimitReached && void handleSend(card.query)
												}
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
											chartAttachments={
												chartAttachmentsByMessageId[message.id] ?? []
											}
											defaultAccountId={selectedAccountId}
											isFromHistory={isFromHistory}
											isLatest={isLastAssistant}
											key={message.id}
											loggedTradeId={
												loggedByMessageId[message.id] ??
												message.loggedTradeId ??
												null
											}
											message={message}
											onConfirmTrade={handleConfirmTrade}
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
				</div>

				{/* Input */}
				<div className="border-border border-t px-4 py-3">
					<div className="mx-auto max-w-3xl">
						{chatLimitReached && (
							<div className="mb-2">
								<UsageLimitBanner type="chat" />
							</div>
						)}
						<ChatInput
							attachments={pendingAttachments}
							canAttach={pendingAttachments.length < MAX_AI_CHAT_IMAGES}
							disabled={chatLimitReached}
							isLoading={isLoading}
							onAddFiles={(files) => void handleAddFiles(files)}
							onChange={setInput}
							onRemoveAttachment={removeAttachment}
							onSubmit={() => void handleSend()}
							value={input}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
