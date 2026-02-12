"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// TYPES
// =============================================================================

interface Conversation {
	id: string;
	title: string | null;
	createdAt?: Date | string | null;
}

interface ChatSidebarProps {
	conversations: Conversation[];
	activeId: string | null;
	isLoading?: boolean;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => void;
}

// =============================================================================
// DATE GROUPING
// =============================================================================

type DateGroup = "Today" | "Yesterday" | "Previous 7 Days" | "Older";

function getDateGroup(date: Date | string | null | undefined): DateGroup {
	if (!date) return "Older";
	const d = typeof date === "string" ? new Date(date) : date;
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const weekAgo = new Date(today);
	weekAgo.setDate(weekAgo.getDate() - 7);

	if (d >= today) return "Today";
	if (d >= yesterday) return "Yesterday";
	if (d >= weekAgo) return "Previous 7 Days";
	return "Older";
}

function groupConversations(
	conversations: Conversation[],
): { group: DateGroup; items: Conversation[] }[] {
	const groups = new Map<DateGroup, Conversation[]>();
	const order: DateGroup[] = ["Today", "Yesterday", "Previous 7 Days", "Older"];

	for (const conv of conversations) {
		const group = getDateGroup(conv.createdAt);
		if (!groups.has(group)) groups.set(group, []);
		groups.get(group)?.push(conv);
	}

	return order
		.filter((g) => groups.has(g))
		.map((g) => ({ group: g, items: groups.get(g) ?? [] }));
}

// =============================================================================
// SIDEBAR
// =============================================================================

export function ChatSidebar({
	conversations,
	activeId,
	isLoading,
	onSelect,
	onNew,
	onDelete,
}: ChatSidebarProps) {
	const grouped = useMemo(
		() => groupConversations(conversations),
		[conversations],
	);

	return (
		<div
			className="hidden w-64 flex-col rounded border border-border bg-card sm:flex"
			data-testid="chat-sidebar"
		>
			{/* Header */}
			<div className="flex items-center justify-between border-white/5 border-b bg-white/[0.01] px-3 py-2.5">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Conversations
				</span>
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								className="rounded bg-primary/10 p-1.5 text-primary transition-colors hover:bg-primary/20"
								data-testid="chat-new-conversation-button"
								onClick={onNew}
								type="button"
							>
								<Plus className="h-3 w-3" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p className="font-mono text-xs">New chat</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			{/* Conversation List */}
			<ScrollArea className="flex-1">
				<div className="p-1.5">
					{isLoading ? (
						<div className="space-y-1">
							{Array.from({ length: 4 }).map((_, i) => (
								<div
									className="rounded px-2 py-1.5"
									key={`skeleton-${i.toString()}`}
								>
									<Skeleton className="h-4 w-full" />
									<Skeleton className="mt-1 h-3 w-2/3" />
								</div>
							))}
						</div>
					) : conversations.length === 0 ? (
						<div
							className="flex flex-col items-center py-8 text-center"
							data-testid="chat-sidebar-empty"
						>
							<MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/20" />
							<p className="font-mono text-muted-foreground/50 text-xs">
								No conversations yet
							</p>
							<p className="mt-0.5 font-mono text-[10px] text-muted-foreground/30">
								Start a new chat to begin
							</p>
						</div>
					) : (
						grouped.map(({ group, items }) => (
							<div key={group}>
								{/* Date group header */}
								<div className="sticky top-0 z-10 bg-card px-2 pt-2 pb-1">
									<span className="font-mono text-[10px] text-muted-foreground/50 uppercase">
										{group}
									</span>
								</div>

								{/* Conversations in group */}
								{items.map((conv) => (
									<button
										className={`group relative w-full cursor-pointer rounded px-2 py-1.5 pr-7 text-left font-mono text-xs transition-colors ${
											activeId === conv.id
												? "border border-primary/20 bg-primary/5 text-foreground"
												: "border border-transparent text-muted-foreground hover:bg-white/[0.02] hover:text-foreground"
										}`}
										data-testid={`chat-conversation-item-${conv.id}`}
										key={conv.id}
										onClick={() => onSelect(conv.id)}
										type="button"
									>
										<span className="line-clamp-1">
											{conv.title ?? "New conversation"}
										</span>
										{/* biome-ignore lint/a11y/useSemanticElements: nested interactive requires span with role */}
										<span
											className="-translate-y-1/2 absolute top-1/2 right-1.5 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-loss/10 hover:text-loss group-hover:opacity-100"
											data-testid={`chat-delete-${conv.id}`}
											onClick={(e) => {
												e.stopPropagation();
												onDelete(conv.id);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.stopPropagation();
													onDelete(conv.id);
												}
											}}
											role="button"
											tabIndex={0}
										>
											<Trash2 className="size-3" />
										</span>
									</button>
								))}
							</div>
						))
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
