"use client";

import { Plus, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	countConditions,
	createGroup,
	DEFAULT_QUERY_STATE,
	type QueryBuilderState,
	type QueryGroup as QueryGroupType,
} from "@/types/query-builder";
import { QueryGroup } from "./query-group";

// =============================================================================
// TYPES
// =============================================================================

interface FilterOption {
	id: string;
	name: string;
	color?: string;
}

interface QueryBuilderProps {
	/** Whether the modal is open */
	open: boolean;
	/** Callback when modal should close */
	onOpenChange: (open: boolean) => void;
	/** Current query state */
	query: QueryBuilderState;
	/** Callback when query is applied */
	onApply: (query: QueryBuilderState) => void;
	/** Available symbols */
	symbols?: string[];
	/** Available strategies */
	strategies?: FilterOption[];
	/** Available tags */
	tags?: FilterOption[];
	/** Available sessions */
	sessions?: FilterOption[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QueryBuilder({
	open,
	onOpenChange,
	query,
	onApply,
	symbols = [],
	strategies = [],
	tags = [],
	sessions = [],
}: QueryBuilderProps) {
	// Local state for editing
	const [localQuery, setLocalQuery] = useState<QueryBuilderState>(query);

	// Sync local state when modal opens or query changes
	useEffect(() => {
		if (open) {
			// Initialize with at least one group if empty
			if (query.groups.length === 0) {
				setLocalQuery({
					...query,
					groups: [createGroup()],
				});
			} else {
				setLocalQuery(query);
			}
		}
	}, [open, query]);

	// Update logic between groups
	const handleLogicChange = useCallback((logic: "AND" | "OR") => {
		setLocalQuery((prev) => ({
			...prev,
			logic,
		}));
	}, []);

	// Update a specific group
	const handleGroupChange = useCallback(
		(index: number, group: QueryGroupType) => {
			setLocalQuery((prev) => {
				const newGroups = [...prev.groups];
				newGroups[index] = group;
				return {
					...prev,
					groups: newGroups,
				};
			});
		},
		[],
	);

	// Remove a group
	const handleGroupRemove = useCallback((index: number) => {
		setLocalQuery((prev) => ({
			...prev,
			groups: prev.groups.filter((_, i) => i !== index),
		}));
	}, []);

	// Add a new group
	const handleAddGroup = useCallback(() => {
		setLocalQuery((prev) => ({
			...prev,
			groups: [...prev.groups, createGroup()],
		}));
	}, []);

	// Reset to defaults
	const handleReset = useCallback(() => {
		setLocalQuery({
			...DEFAULT_QUERY_STATE,
			groups: [createGroup()],
		});
	}, []);

	// Apply and close
	const handleApply = useCallback(() => {
		// Filter out empty groups
		const cleanedQuery: QueryBuilderState = {
			...localQuery,
			groups: localQuery.groups.filter((g) => g.conditions.length > 0),
		};
		onApply(cleanedQuery);
		onOpenChange(false);
	}, [localQuery, onApply, onOpenChange]);

	// Cancel and close
	const handleCancel = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	const conditionCount = countConditions(localQuery);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[90vh] max-w-3xl p-0">
				{/* Header */}
				<DialogHeader className="border-border border-b px-6 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10">
								<Sparkles className="size-5 text-primary" />
							</div>
							<div>
								<DialogTitle className="font-mono text-lg">
									Query Builder
								</DialogTitle>
								<DialogDescription className="font-mono text-xs">
									Build complex filters with AND/OR logic
								</DialogDescription>
							</div>
						</div>
						<Button
							className="h-8 font-mono text-muted-foreground text-xs"
							onClick={handleReset}
							size="sm"
							type="button"
							variant="ghost"
						>
							<RotateCcw className="mr-1.5 size-3" />
							Reset
						</Button>
					</div>
				</DialogHeader>

				{/* Query builder content */}
				<div className="px-6 py-4">
					{/* Global logic selector */}
					<div className="mb-4 flex items-center gap-2">
						<span className="font-mono text-muted-foreground text-sm">
							Match
						</span>
						<Select
							onValueChange={(v) => handleLogicChange(v as "AND" | "OR")}
							value={localQuery.logic}
						>
							<SelectTrigger className="h-8 w-20 font-mono text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem className="font-mono text-xs" value="AND">
									ALL
								</SelectItem>
								<SelectItem className="font-mono text-xs" value="OR">
									ANY
								</SelectItem>
							</SelectContent>
						</Select>
						<span className="font-mono text-muted-foreground text-sm">
							of the following groups:
						</span>
					</div>

					{/* Groups */}
					<ScrollArea className="max-h-[50vh]">
						<div className="space-y-4 pr-4">
							{localQuery.groups.map((group, index) => (
								<QueryGroup
									canRemove={localQuery.groups.length > 1}
									group={group}
									groupIndex={index}
									key={group.id}
									onChange={(g) => handleGroupChange(index, g)}
									onRemove={() => handleGroupRemove(index)}
									sessions={sessions}
									strategies={strategies}
									symbols={symbols}
									tags={tags}
								/>
							))}

							{/* Add group button */}
							<Button
								className="h-9 w-full border-dashed font-mono text-xs"
								onClick={handleAddGroup}
								type="button"
								variant="outline"
							>
								<Plus className="mr-2 size-4" />
								Add group
							</Button>
						</div>
					</ScrollArea>
				</div>

				{/* Footer */}
				<DialogFooter className="border-border border-t px-6 py-4">
					<div className="flex w-full items-center justify-between">
						<span className="font-mono text-muted-foreground text-xs">
							{conditionCount} condition{conditionCount !== 1 ? "s" : ""}
						</span>
						<div className="flex gap-2">
							<Button
								className="font-mono"
								onClick={handleCancel}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button className="font-mono" onClick={handleApply} type="button">
								Apply Query
							</Button>
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
