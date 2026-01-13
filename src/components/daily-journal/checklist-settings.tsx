"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	GripVerticalIcon,
	Loader2Icon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

interface ChecklistSettingsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface SortableItemProps {
	template: {
		id: string;
		text: string;
		isActive: boolean;
	};
	editingId: string | null;
	deletingId: string | null;
	editingText: string;
	isMutating: boolean;
	onEditingTextChange: (text: string) => void;
	onStartEdit: (id: string, text: string) => void;
	onSaveEdit: () => void;
	onCancelEdit: () => void;
	onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
	onToggleActive: (id: string, isActive: boolean) => void;
	onDelete: (id: string) => void;
	onSetDeletingId: (id: string | null) => void;
	updatePending: boolean;
	deletePending: boolean;
}

function SortableItem({
	template,
	editingId,
	deletingId,
	editingText,
	isMutating,
	onEditingTextChange,
	onStartEdit,
	onSaveEdit,
	onCancelEdit,
	onEditKeyDown,
	onToggleActive,
	onDelete,
	onSetDeletingId,
	updatePending,
	deletePending,
}: SortableItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: template.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			className={cn(
				"group flex items-center gap-2 rounded border border-white/5 bg-white/2 p-2 transition-colors",
				!template.isActive && "opacity-50",
				deletingId === template.id && "border-destructive/50 bg-destructive/10",
				isDragging && "z-10 border-primary/50 bg-white/5 shadow-lg",
			)}
			ref={setNodeRef}
			style={style}
		>
			{/* Drag handle */}
			<button
				{...attributes}
				{...listeners}
				aria-label="Drag to reorder"
				className={cn(
					"cursor-grab touch-none rounded p-0.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground",
					isDragging && "cursor-grabbing",
				)}
				disabled={isMutating}
				type="button"
			>
				<GripVerticalIcon className="size-4" />
			</button>

			{/* Active toggle */}
			<button
				aria-label={template.isActive ? "Deactivate" : "Activate"}
				className={cn(
					"size-4 shrink-0 rounded border transition-colors",
					template.isActive
						? "border-primary bg-primary"
						: "border-white/20 bg-transparent",
				)}
				disabled={isMutating}
				onClick={() => onToggleActive(template.id, template.isActive)}
				type="button"
			/>

			{/* Text or edit input */}
			{editingId === template.id ? (
				<div className="flex flex-1 gap-1">
					<Input
						autoFocus
						className="h-7 flex-1 font-mono text-sm"
						disabled={updatePending}
						onChange={(e) => onEditingTextChange(e.target.value)}
						onKeyDown={onEditKeyDown}
						value={editingText}
					/>
					<Button
						className="h-7"
						disabled={!editingText.trim() || updatePending}
						onClick={onSaveEdit}
						size="sm"
						variant="outline"
					>
						{updatePending ? (
							<Loader2Icon className="size-3 animate-spin" />
						) : (
							"Save"
						)}
					</Button>
					<Button
						className="h-7"
						disabled={updatePending}
						onClick={onCancelEdit}
						size="sm"
						variant="ghost"
					>
						Cancel
					</Button>
				</div>
			) : deletingId === template.id ? (
				<div className="flex flex-1 items-center justify-between">
					<span className="font-mono text-destructive text-sm">
						Delete this item?
					</span>
					<div className="flex gap-1">
						<Button
							className="h-7"
							disabled={deletePending}
							onClick={() => onDelete(template.id)}
							size="sm"
							variant="destructive"
						>
							{deletePending ? (
								<Loader2Icon className="size-3 animate-spin" />
							) : (
								"Delete"
							)}
						</Button>
						<Button
							className="h-7"
							disabled={deletePending}
							onClick={() => onSetDeletingId(null)}
							size="sm"
							variant="ghost"
						>
							Cancel
						</Button>
					</div>
				</div>
			) : (
				<button
					className="flex-1 cursor-pointer text-left font-mono text-sm transition-colors hover:text-primary"
					disabled={isMutating}
					onClick={() => onStartEdit(template.id, template.text)}
					type="button"
				>
					{template.text}
				</button>
			)}

			{/* Delete button (only shown when not editing/deleting) */}
			{editingId !== template.id && deletingId !== template.id && (
				<button
					aria-label="Delete"
					className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
					disabled={isMutating}
					onClick={() => onSetDeletingId(template.id)}
					type="button"
				>
					<Trash2Icon className="size-3.5" />
				</button>
			)}
		</div>
	);
}

/**
 * Modal for managing checklist templates.
 * Allows adding, editing, deleting, reordering, and toggling active status.
 */
export function ChecklistSettings({
	open,
	onOpenChange,
}: ChecklistSettingsProps) {
	const utils = api.useUtils();

	// New template input state
	const [newItemText, setNewItemText] = useState("");

	// Editing state
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingText, setEditingText] = useState("");

	// Delete confirmation state
	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Fetch templates
	const { data: templates, isLoading } =
		api.dailyJournal.getTemplates.useQuery();

	// Create template mutation
	const createTemplate = api.dailyJournal.createTemplate.useMutation({
		onSuccess: () => {
			setNewItemText("");
			utils.dailyJournal.getTemplates.invalidate();
		},
	});

	// Update template mutation
	const updateTemplate = api.dailyJournal.updateTemplate.useMutation({
		onSuccess: () => {
			setEditingId(null);
			setEditingText("");
			utils.dailyJournal.getTemplates.invalidate();
		},
	});

	// Delete template mutation
	const deleteTemplate = api.dailyJournal.deleteTemplate.useMutation({
		onSuccess: () => {
			setDeletingId(null);
			utils.dailyJournal.getTemplates.invalidate();
		},
	});

	// Reorder templates mutation with optimistic updates
	const reorderTemplates = api.dailyJournal.reorderTemplates.useMutation({
		onMutate: async ({ items }) => {
			// Cancel outgoing refetches
			await utils.dailyJournal.getTemplates.cancel();

			// Snapshot previous value
			const previousTemplates = utils.dailyJournal.getTemplates.getData();

			// Optimistically update the cache
			utils.dailyJournal.getTemplates.setData(undefined, (old) => {
				if (!old) return old;
				// Create a map of id -> new order
				const orderMap = new Map(items.map((item) => [item.id, item.order]));
				// Sort templates by new order
				return [...old].sort(
					(a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
				);
			});

			return { previousTemplates };
		},
		onError: (_err, _vars, context) => {
			// Roll back on error
			if (context?.previousTemplates) {
				utils.dailyJournal.getTemplates.setData(
					undefined,
					context.previousTemplates,
				);
			}
		},
		onSettled: () => {
			// Sync with server
			utils.dailyJournal.getTemplates.invalidate();
		},
	});

	const handleAddItem = () => {
		const trimmed = newItemText.trim();
		if (!trimmed) return;
		createTemplate.mutate({ text: trimmed });
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleAddItem();
		}
	};

	const handleStartEdit = (id: string, text: string) => {
		setEditingId(id);
		setEditingText(text);
	};

	const handleSaveEdit = () => {
		if (!editingId) return;
		const trimmed = editingText.trim();
		if (!trimmed) return;
		updateTemplate.mutate({ id: editingId, text: trimmed });
	};

	const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSaveEdit();
		} else if (e.key === "Escape") {
			setEditingId(null);
			setEditingText("");
		}
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setEditingText("");
	};

	const handleToggleActive = (id: string, isActive: boolean) => {
		updateTemplate.mutate({ id, isActive: !isActive });
	};

	const handleDelete = (id: string) => {
		deleteTemplate.mutate({ id });
	};

	// Drag and drop sensors
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || !templates || active.id === over.id) return;

		const oldIndex = templates.findIndex((t) => t.id === active.id);
		const newIndex = templates.findIndex((t) => t.id === over.id);
		const reordered = arrayMove(templates, oldIndex, newIndex);

		reorderTemplates.mutate({
			items: reordered.map((t, i) => ({ id: t.id, order: i })),
		});
	};

	const isMutating =
		createTemplate.isPending ||
		updateTemplate.isPending ||
		deleteTemplate.isPending ||
		reorderTemplates.isPending;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="font-mono text-lg">
						Checklist Settings
					</DialogTitle>
					<DialogDescription className="font-mono text-xs">
						Manage your daily checklist items. Click to edit, drag to reorder.
					</DialogDescription>
				</DialogHeader>

				{/* Add new item */}
				<div className="flex gap-2">
					<Input
						className="font-mono text-sm"
						disabled={createTemplate.isPending}
						onChange={(e) => setNewItemText(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Add new checklist item..."
						value={newItemText}
					/>
					<Button
						disabled={!newItemText.trim() || createTemplate.isPending}
						onClick={handleAddItem}
						size="icon"
						variant="outline"
					>
						{createTemplate.isPending ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<PlusIcon className="size-4" />
						)}
					</Button>
				</div>

				{/* Templates list */}
				<div className="max-h-[300px] space-y-1 overflow-y-auto">
					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
						</div>
					)}

					{!isLoading && templates?.length === 0 && (
						<div className="py-8 text-center">
							<p className="font-mono text-muted-foreground text-xs">
								No checklist items yet.
							</p>
							<p className="mt-1 font-mono text-muted-foreground/60 text-xs">
								Add your first item above.
							</p>
						</div>
					)}

					{!isLoading && templates && templates.length > 0 && (
						<DndContext
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
							sensors={sensors}
						>
							<SortableContext
								items={templates.map((t) => t.id)}
								strategy={verticalListSortingStrategy}
							>
								{templates.map((template) => (
									<SortableItem
										deletePending={deleteTemplate.isPending}
										deletingId={deletingId}
										editingId={editingId}
										editingText={editingText}
										isMutating={isMutating}
										key={template.id}
										onCancelEdit={handleCancelEdit}
										onDelete={handleDelete}
										onEditingTextChange={setEditingText}
										onEditKeyDown={handleEditKeyDown}
										onSaveEdit={handleSaveEdit}
										onSetDeletingId={setDeletingId}
										onStartEdit={handleStartEdit}
										onToggleActive={handleToggleActive}
										template={template}
										updatePending={updateTemplate.isPending}
									/>
								))}
							</SortableContext>
						</DndContext>
					)}
				</div>

				{/* Footer hint */}
				<div className="border-border border-t pt-3">
					<p className="font-mono text-[10px] text-muted-foreground/60">
						Checked items appear with strikethrough. Inactive items won&apos;t
						appear in your daily checklist.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
