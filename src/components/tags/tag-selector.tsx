"use client";

import { Check, Plus, Tag, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useOptimisticState } from "@/hooks/use-debounced-mutation";
import { api } from "@/trpc/react";

const PRESET_COLORS = [
	"#d4ff00", // Electric Chartreuse (primary)
	"#00d4ff", // Ice Blue (accent)
	"#00ff88", // Profit green
	"#f59e0b", // Amber
	"#ec4899", // Pink
	"#8b5cf6", // Violet
	"#14b8a6", // Teal
	"#f97316", // Orange
	"#6366f1", // Indigo
];

function getRandomColor() {
	return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
}

interface TagSelectorProps {
	tradeId: string;
	currentTagIds: string[];
	onTagAdded?: (
		tagId: string,
		tag: { id: string; name: string; color: string | null },
	) => void;
	onTagRemoved?: (tagId: string) => void;
	onUpdate?: () => void;
}

export function TagSelector({
	tradeId,
	currentTagIds,
	onTagAdded,
	onTagRemoved,
	onUpdate,
}: TagSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [newTagName, setNewTagName] = useState("");

	const { data: tags, refetch: refetchTags } = api.tags.getAll.useQuery();

	const addTag = api.tags.addToTrade.useMutation({
		onSuccess: async () => {
			await onUpdate?.();
		},
		onError: (error, variables) => {
			// Rollback optimistic update
			onTagRemoved?.(variables.tagId);
			toast.error(error.message || "Failed to add tag");
		},
	});

	const removeTag = api.tags.removeFromTrade.useMutation({
		onSuccess: async () => {
			await onUpdate?.();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to remove tag");
		},
	});

	const createTag = api.tags.create.useMutation({
		onSuccess: (newTag) => {
			refetchTags();
			if (newTag) {
				// Optimistically add the new tag
				onTagAdded?.(newTag.id, {
					id: newTag.id,
					name: newTag.name,
					color: newTag.color,
				});
				addTag.mutate({ tradeId, tagId: newTag.id });
			}
			setNewTagName("");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create tag");
		},
	});

	const handleToggleTag = (
		tagId: string,
		isSelected: boolean,
		tag?: { id: string; name: string; color: string | null },
	) => {
		if (isSelected) {
			onTagRemoved?.(tagId);
			removeTag.mutate({ tradeId, tagId });
		} else if (tag) {
			onTagAdded?.(tagId, tag);
			addTag.mutate({ tradeId, tagId });
		}
	};

	const handleCreateAndAdd = () => {
		if (!newTagName.trim()) return;
		createTag.mutate({ name: newTagName.trim(), color: getRandomColor() });
	};

	return (
		<DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					className="h-7 px-2 font-mono text-xs"
					size="sm"
					variant="ghost"
				>
					<Tag className="h-3.5 w-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Assign Tags
				</DropdownMenuLabel>
				<DropdownMenuSeparator />

				{tags && tags.length > 0 ? (
					<div className="max-h-48 overflow-y-auto">
						{tags.map((tag) => {
							const isSelected = currentTagIds.includes(tag.id);
							return (
								<DropdownMenuItem
									className="flex items-center gap-2 font-mono text-xs"
									key={tag.id}
									onSelect={(e) => {
										e.preventDefault();
										handleToggleTag(tag.id, isSelected, tag);
									}}
								>
									<div
										className="h-3 w-3 rounded-full"
										style={{ backgroundColor: tag.color ?? "#6366f1" }}
									/>
									<span className="flex-1">{tag.name}</span>
									{isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
								</DropdownMenuItem>
							);
						})}
					</div>
				) : (
					<div className="px-2 py-3 text-center">
						<p className="font-mono text-muted-foreground text-xs">
							No tags yet
						</p>
					</div>
				)}

				<DropdownMenuSeparator />

				<div className="p-2">
					<div className="flex gap-2">
						<Input
							className="h-7 font-mono text-xs"
							onChange={(e) => setNewTagName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleCreateAndAdd();
								}
							}}
							placeholder="New tag..."
							value={newTagName}
						/>
						<Button
							className="h-7 px-2"
							disabled={!newTagName.trim() || createTag.isPending}
							onClick={handleCreateAndAdd}
							size="sm"
						>
							<Plus className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Compact tag display with inline tag selector
interface TradeTagsProps {
	tradeId: string;
	tags: Array<{
		tagId: string;
		tag: { id: string; name: string; color: string | null };
	}>;
	onUpdate?: () => void;
	maxDisplay?: number;
}

export function TradeTags({
	tradeId,
	tags,
	onUpdate,
	maxDisplay = 2,
}: TradeTagsProps) {
	// Use shared optimistic state utility
	const {
		applyUpdate: applyOptimisticUpdate,
		clearUpdates: clearOptimisticUpdates,
		updates: optimisticUpdates,
	} = useOptimisticState<{
		removed?: boolean;
		added?: boolean;
		tag?: { id: string; name: string; color: string | null };
	}>();

	const removeTag = api.tags.removeFromTrade.useMutation({
		onMutate: ({ tagId }) => {
			// Mark as optimistically removed
			applyOptimisticUpdate(tagId, { removed: true });
		},
		onError: (error) => {
			// Rollback - remove the optimistic update
			toast.error(error.message || "Failed to remove tag");
		},
		onSettled: async () => {
			await onUpdate?.();
			clearOptimisticUpdates();
		},
	});

	const handleRemoveTag = (tagId: string) => {
		removeTag.mutate({ tradeId, tagId });
	};

	const handleTagAdded = (
		tagId: string,
		tag: { id: string; name: string; color: string | null },
	) => {
		applyOptimisticUpdate(tagId, { added: true, tag });
	};

	const handleTagRemoved = (tagId: string) => {
		applyOptimisticUpdate(tagId, { removed: true });
	};

	const handleUpdate = async () => {
		await onUpdate?.();
		clearOptimisticUpdates();
	};

	// Build display tags with optimistic updates applied
	const displayTags = [
		// Existing tags, filtered by optimistic removals
		...tags.filter((t) => {
			const update = optimisticUpdates.get(t.tagId);
			return !update?.removed;
		}),
		// Optimistically added tags
		...Array.from(optimisticUpdates.entries())
			.filter(
				(
					entry,
				): entry is [
					string,
					{
						added: true;
						tag: { id: string; name: string; color: string | null };
					},
				] => {
					const [id, update] = entry;
					return Boolean(
						update.added && update.tag && !tags.find((t) => t.tagId === id),
					);
				},
			)
			.map(([id, update]) => ({
				tagId: id,
				tag: update.tag,
			})),
	];

	const currentTagIds = displayTags.map((t) => t.tagId);

	return (
		<div className="flex items-center gap-1">
			{displayTags.slice(0, maxDisplay).map((tt) => (
				<Badge
					className="group gap-1 px-1 py-0 text-[10px]"
					key={tt.tagId}
					style={{
						borderColor: tt.tag.color ?? undefined,
						color: tt.tag.color ?? undefined,
					}}
					variant="outline"
				>
					{tt.tag.name}
					<button
						className="opacity-0 transition-opacity group-hover:opacity-100"
						onClick={(e) => {
							e.stopPropagation();
							handleRemoveTag(tt.tagId);
						}}
						type="button"
					>
						<X className="h-2.5 w-2.5" />
					</button>
				</Badge>
			))}
			{displayTags.length > maxDisplay && (
				<Badge className="px-1 py-0 text-[10px]" variant="secondary">
					+{displayTags.length - maxDisplay}
				</Badge>
			)}
			<TagSelector
				currentTagIds={currentTagIds}
				onTagAdded={handleTagAdded}
				onTagRemoved={handleTagRemoved}
				onUpdate={handleUpdate}
				tradeId={tradeId}
			/>
		</div>
	);
}
