"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Conversation {
	id: string;
	title: string | null;
}

interface ChatSidebarProps {
	conversations: Conversation[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => void;
}

export function ChatSidebar({
	conversations,
	activeId,
	onSelect,
	onNew,
	onDelete,
}: ChatSidebarProps) {
	return (
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
					onClick={onNew}
					size="sm"
					variant="ghost"
				>
					+ New
				</Button>
			</div>
			<ScrollArea className="flex-1">
				<div className="p-1.5">
					{conversations.map((conv) => (
						<div
							className={`group relative w-full cursor-pointer rounded px-2 py-1.5 pr-6 text-left font-mono text-xs transition-colors ${
								activeId === conv.id
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-secondary hover:text-foreground"
							}`}
							data-testid={`chat-conversation-item-${conv.id}`}
							key={conv.id}
							onClick={() => onSelect(conv.id)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onSelect(conv.id);
								}
							}}
							role="button"
							tabIndex={0}
						>
							<span className="line-clamp-1">
								{conv.title ?? "New conversation"}
							</span>
							<button
								className="-translate-y-1/2 absolute top-1/2 right-1.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-loss group-hover:opacity-100"
								onClick={(e) => {
									e.stopPropagation();
									onDelete(conv.id);
								}}
								type="button"
							>
								<Trash2 className="size-3" />
							</button>
						</div>
					))}
					{conversations.length === 0 && (
						<p className="px-2 py-4 text-center font-mono text-[10px] text-muted-foreground">
							No conversations yet
						</p>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
