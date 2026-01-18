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
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

interface Rule {
	id: string;
	text: string;
	category: "entry" | "exit" | "risk" | "management";
	order: number;
}

interface RulesEditorProps {
	strategyId: string;
	initialRules: Rule[];
}

const CATEGORY_OPTIONS = [
	{ value: "entry", label: "Entry" },
	{ value: "exit", label: "Exit" },
	{ value: "risk", label: "Risk" },
	{ value: "management", label: "Management" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
	entry: "Entry Rules",
	exit: "Exit Rules",
	risk: "Risk Rules",
	management: "Management Rules",
};

const CATEGORY_COLORS: Record<string, string> = {
	entry: "text-profit",
	exit: "text-loss",
	risk: "text-breakeven",
	management: "text-accent",
};

interface SortableRuleItemProps {
	rule: Rule;
	editingId: string | null;
	editingText: string;
	deletingId: string | null;
	onStartEdit: (id: string, text: string) => void;
	onCancelEdit: () => void;
	onEditTextChange: (text: string) => void;
	onEditKeyDown: (e: React.KeyboardEvent) => void;
	onCategoryChange: (id: string, category: Rule["category"]) => void;
	onStartDelete: (id: string) => void;
	onConfirmDelete: (id: string) => void;
	onCancelDelete: () => void;
	isSaving: boolean;
	isDeleting: boolean;
}

function SortableRuleItem({
	rule,
	editingId,
	editingText,
	deletingId,
	onStartEdit,
	onCancelEdit,
	onEditTextChange,
	onEditKeyDown,
	onCategoryChange,
	onStartDelete,
	onConfirmDelete,
	onCancelDelete,
	isSaving,
	isDeleting,
}: SortableRuleItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: rule.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const isEditing = editingId === rule.id;
	const isConfirmingDelete = deletingId === rule.id;

	return (
		<div
			className={cn(
				"group flex items-center gap-2 rounded border border-white/5 bg-white/2 p-3 transition-all",
				isDragging && "z-10 border-primary/50 shadow-lg",
				isConfirmingDelete && "border-loss/30 bg-loss/5",
			)}
			data-testid={`rules-editor-item-${rule.id}`}
			ref={setNodeRef}
			style={style}
		>
			{/* Drag handle */}
			<button
				{...attributes}
				{...listeners}
				className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground"
				data-testid={`rules-editor-drag-${rule.id}`}
			>
				<GripVertical className="h-4 w-4" />
			</button>

			{/* Category selector */}
			<div className="w-28 shrink-0">
				<Select
					disabled={isSaving}
					onValueChange={(v) =>
						onCategoryChange(rule.id, v as Rule["category"])
					}
					value={rule.category}
				>
					<SelectTrigger className="h-8 font-mono text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CATEGORY_OPTIONS.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Rule text */}
			<div className="flex-1">
				{isConfirmingDelete ? (
					<div className="flex items-center justify-between">
						<span className="font-mono text-loss text-sm">
							Delete this rule?
						</span>
						<div className="flex gap-1">
							<Button
								className="h-7 font-mono text-xs"
								data-testid={`rules-editor-delete-confirm-${rule.id}`}
								disabled={isDeleting}
								onClick={() => onConfirmDelete(rule.id)}
								size="sm"
								variant="destructive"
							>
								{isDeleting ? "..." : "Delete"}
							</Button>
							<Button
								className="h-7 font-mono text-xs"
								data-testid={`rules-editor-delete-cancel-${rule.id}`}
								disabled={isDeleting}
								onClick={onCancelDelete}
								size="sm"
								variant="ghost"
							>
								Cancel
							</Button>
						</div>
					</div>
				) : isEditing ? (
					<div className="flex items-center gap-2">
						<Input
							autoFocus
							className="h-8 flex-1 font-mono text-sm"
							data-testid={`rules-editor-input-${rule.id}`}
							disabled={isSaving}
							onChange={(e) => onEditTextChange(e.target.value)}
							onKeyDown={onEditKeyDown}
							value={editingText}
						/>
						<Button
							className="h-7 w-7"
							disabled={isSaving}
							onClick={onCancelEdit}
							size="sm"
							variant="ghost"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				) : (
					<button
						className="w-full cursor-text text-left font-mono text-foreground text-sm hover:text-primary"
						data-testid={`rules-editor-text-${rule.id}`}
						onClick={() => onStartEdit(rule.id, rule.text)}
						type="button"
					>
						{rule.text || (
							<span className="text-muted-foreground italic">
								Click to edit...
							</span>
						)}
					</button>
				)}
			</div>

			{/* Delete button (visible on hover, hidden when confirming delete or editing) */}
			{!isConfirmingDelete && !isEditing && (
				<Button
					className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-loss group-hover:opacity-100"
					data-testid={`rules-editor-delete-${rule.id}`}
					onClick={() => onStartDelete(rule.id)}
					size="icon"
					variant="ghost"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
}

export function RulesEditor({ strategyId, initialRules }: RulesEditorProps) {
	const utils = api.useUtils();

	// Local state for rules (optimistic updates)
	const [rules, setRules] = useState<Rule[]>(initialRules);

	// Edit state
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingText, setEditingText] = useState("");

	// Delete confirmation state
	const [deletingId, setDeletingId] = useState<string | null>(null);

	// DnD sensors
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	// Group rules by category
	const groupedRules = useMemo(() => {
		const groups: Record<Rule["category"], Rule[]> = {
			entry: [],
			exit: [],
			risk: [],
			management: [],
		};
		for (const rule of [...rules].sort((a, b) => a.order - b.order)) {
			groups[rule.category].push(rule);
		}
		return groups;
	}, [rules]);

	// Mutations
	const addRuleMutation = api.strategies.addRule.useMutation({
		onSuccess: (newRule) => {
			if (newRule) {
				setRules((prev) => [...prev, newRule]);
			}
		},
		onError: () => {
			toast.error("Failed to add rule");
		},
		onSettled: () => {
			utils.strategies.getById.invalidate({ id: strategyId });
		},
	});

	const updateRuleMutation = api.strategies.updateRule.useMutation({
		onError: () => {
			toast.error("Failed to update rule");
		},
		onSettled: () => {
			utils.strategies.getById.invalidate({ id: strategyId });
		},
	});

	const deleteRuleMutation = api.strategies.deleteRule.useMutation({
		onSuccess: (_, { id }) => {
			setRules((prev) => prev.filter((r) => r.id !== id));
			setDeletingId(null);
		},
		onError: () => {
			toast.error("Failed to delete rule");
		},
		onSettled: () => {
			utils.strategies.getById.invalidate({ id: strategyId });
		},
	});

	const reorderRulesMutation = api.strategies.reorderRules.useMutation({
		onError: () => {
			toast.error("Failed to reorder rules");
		},
		onSettled: () => {
			utils.strategies.getById.invalidate({ id: strategyId });
		},
	});

	// Handlers
	const handleAddRule = useCallback(
		(category: Rule["category"]) => {
			addRuleMutation.mutate({
				strategyId,
				text: "",
				category,
			});
		},
		[strategyId, addRuleMutation],
	);

	const handleStartEdit = useCallback((id: string, text: string) => {
		setEditingId(id);
		setEditingText(text);
	}, []);

	const handleSaveEdit = useCallback(() => {
		if (!editingId || !editingText.trim()) {
			setEditingId(null);
			setEditingText("");
			return;
		}

		// Optimistic update
		setRules((prev) =>
			prev.map((r) => (r.id === editingId ? { ...r, text: editingText } : r)),
		);

		updateRuleMutation.mutate({ id: editingId, text: editingText });
		setEditingId(null);
		setEditingText("");
	}, [editingId, editingText, updateRuleMutation]);

	const handleCancelEdit = useCallback(() => {
		setEditingId(null);
		setEditingText("");
	}, []);

	const handleEditKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				handleSaveEdit();
			} else if (e.key === "Escape") {
				handleCancelEdit();
			}
		},
		[handleSaveEdit, handleCancelEdit],
	);

	const handleCategoryChange = useCallback(
		(id: string, category: Rule["category"]) => {
			// Optimistic update
			setRules((prev) =>
				prev.map((r) => (r.id === id ? { ...r, category } : r)),
			);

			updateRuleMutation.mutate({ id, category });
		},
		[updateRuleMutation],
	);

	const handleStartDelete = useCallback((id: string) => {
		setDeletingId(id);
	}, []);

	const handleConfirmDelete = useCallback(
		(id: string) => {
			deleteRuleMutation.mutate({ id });
		},
		[deleteRuleMutation],
	);

	const handleCancelDelete = useCallback(() => {
		setDeletingId(null);
	}, []);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;

			if (!over || active.id === over.id) return;

			const oldIndex = rules.findIndex((r) => r.id === active.id);
			const newIndex = rules.findIndex((r) => r.id === over.id);

			if (oldIndex === -1 || newIndex === -1) return;

			// Reorder locally (optimistic)
			const reordered = arrayMove(rules, oldIndex, newIndex).map((r, i) => ({
				...r,
				order: i,
			}));

			setRules(reordered);

			// Persist to server
			reorderRulesMutation.mutate({
				strategyId,
				ruleOrders: reordered.map((r) => ({ id: r.id, order: r.order })),
			});
		},
		[rules, strategyId, reorderRulesMutation],
	);

	const allRuleIds = rules.map((r) => r.id);

	return (
		<div className="space-y-6" data-testid="rules-editor">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-mono font-semibold text-sm uppercase tracking-wider">
						Strategy Rules
					</h3>
					<p className="font-mono text-muted-foreground text-xs">
						Define rules you&apos;ll check off when taking trades
					</p>
				</div>
			</div>

			<DndContext
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
				sensors={sensors}
			>
				<SortableContext
					items={allRuleIds}
					strategy={verticalListSortingStrategy}
				>
					{(["entry", "exit", "risk", "management"] as const).map(
						(category) => {
							const categoryRules = groupedRules[category];

							return (
								<div className="space-y-3" key={category}>
									<div className="flex items-center justify-between">
										<h4
											className={cn(
												"font-mono text-[11px] uppercase tracking-wider",
												CATEGORY_COLORS[category],
											)}
										>
											{CATEGORY_LABELS[category]}
										</h4>
										<Button
											className="h-7 font-mono text-muted-foreground text-xs hover:text-foreground"
											data-testid={`rules-editor-add-${category}`}
											disabled={addRuleMutation.isPending}
											onClick={() => handleAddRule(category)}
											size="sm"
											variant="ghost"
										>
											<Plus className="mr-1 h-3 w-3" />
											Add Rule
										</Button>
									</div>

									{categoryRules.length === 0 ? (
										<div className="rounded border border-white/10 border-dashed py-4 text-center">
											<p className="font-mono text-muted-foreground text-xs">
												No {category} rules yet
											</p>
										</div>
									) : (
										<div className="space-y-2">
											{categoryRules.map((rule) => (
												<SortableRuleItem
													deletingId={deletingId}
													editingId={editingId}
													editingText={editingText}
													isDeleting={
														deleteRuleMutation.isPending &&
														deleteRuleMutation.variables?.id === rule.id
													}
													isSaving={
														updateRuleMutation.isPending &&
														updateRuleMutation.variables?.id === rule.id
													}
													key={rule.id}
													onCancelDelete={handleCancelDelete}
													onCancelEdit={handleCancelEdit}
													onCategoryChange={handleCategoryChange}
													onConfirmDelete={handleConfirmDelete}
													onEditKeyDown={handleEditKeyDown}
													onEditTextChange={setEditingText}
													onStartDelete={handleStartDelete}
													onStartEdit={handleStartEdit}
													rule={rule}
												/>
											))}
										</div>
									)}
								</div>
							);
						},
					)}
				</SortableContext>
			</DndContext>
		</div>
	);
}
