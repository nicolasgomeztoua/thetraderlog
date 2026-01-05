"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	createCondition,
	type QueryCondition as QueryConditionType,
	type QueryGroup as QueryGroupType,
} from "@/types/query-builder";
import { QueryCondition } from "./query-condition";

// =============================================================================
// TYPES
// =============================================================================

interface FilterOption {
	id: string;
	name: string;
	color?: string;
}

interface QueryGroupProps {
	group: QueryGroupType;
	groupIndex: number;
	onChange: (group: QueryGroupType) => void;
	onRemove: () => void;
	/** Available symbols */
	symbols?: string[];
	/** Available strategies */
	strategies?: FilterOption[];
	/** Available tags */
	tags?: FilterOption[];
	/** Available sessions */
	sessions?: FilterOption[];
	/** Can this group be removed? */
	canRemove?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QueryGroup({
	group,
	groupIndex,
	onChange,
	onRemove,
	symbols = [],
	strategies = [],
	tags = [],
	sessions = [],
	canRemove = true,
}: QueryGroupProps) {
	// Update logic (AND/OR)
	const handleLogicChange = useCallback(
		(logic: "AND" | "OR") => {
			onChange({
				...group,
				logic,
			});
		},
		[group, onChange],
	);

	// Update a specific condition
	const handleConditionChange = useCallback(
		(index: number, condition: QueryConditionType) => {
			const newConditions = [...group.conditions];
			newConditions[index] = condition;
			onChange({
				...group,
				conditions: newConditions,
			});
		},
		[group, onChange],
	);

	// Remove a condition
	const handleConditionRemove = useCallback(
		(index: number) => {
			const newConditions = group.conditions.filter((_, i) => i !== index);
			onChange({
				...group,
				conditions: newConditions,
			});
		},
		[group, onChange],
	);

	// Add a new condition
	const handleAddCondition = useCallback(() => {
		onChange({
			...group,
			conditions: [...group.conditions, createCondition()],
		});
	}, [group, onChange]);

	return (
		<div className="rounded border border-white/10 bg-white/1">
			{/* Group header */}
			<div className="flex items-center justify-between border-border border-b px-4 py-2">
				<div className="flex items-center gap-2">
					<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Group {groupIndex + 1}
					</span>
					<span className="font-mono text-muted-foreground text-xs">-</span>
					<span className="font-mono text-muted-foreground text-xs">Match</span>
					<Select
						onValueChange={(v) => handleLogicChange(v as "AND" | "OR")}
						value={group.logic}
					>
						<SelectTrigger className="h-7 w-20 font-mono text-xs">
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
					<span className="font-mono text-muted-foreground text-xs">
						of the following:
					</span>
				</div>

				{/* Remove group button */}
				{canRemove && (
					<Button
						className="h-7 w-7 text-muted-foreground hover:text-destructive"
						onClick={onRemove}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<Trash2 className="size-4" />
					</Button>
				)}
			</div>

			{/* Conditions */}
			<div className="space-y-2 p-4">
				{group.conditions.map((condition, index) => (
					<QueryCondition
						canRemove={group.conditions.length > 1}
						condition={condition}
						key={condition.id}
						onChange={(c) => handleConditionChange(index, c)}
						onRemove={() => handleConditionRemove(index)}
						sessions={sessions}
						strategies={strategies}
						symbols={symbols}
						tags={tags}
					/>
				))}

				{/* Add condition button */}
				<Button
					className="mt-2 h-8 font-mono text-xs"
					onClick={handleAddCondition}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Plus className="mr-1 size-4" />
					Add condition
				</Button>
			</div>
		</div>
	);
}
