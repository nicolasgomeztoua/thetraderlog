"use client";

import { Loader2Icon, LockIcon, SettingsIcon, ZapIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ERR_CHECKLIST_UPDATE_FAILED } from "@/lib/constants/errors";
import { cn, formatLocalDate, toDateString } from "@/lib/shared";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";

interface DailyChecklistProps {
	selectedDate: Date;
	onOpenSettings: () => void;
	className?: string;
}

/**
 * Daily checklist component that shows checklist items for the selected date.
 * Allows toggling checks with optimistic updates and shows compliance percentage.
 */
export function DailyChecklist({
	selectedDate,
	onOpenSettings,
	className,
}: DailyChecklistProps) {
	const utils = api.useUtils();
	const dateString = toDateString(selectedDate);

	// Fetch templates (all active templates for the user)
	const { data: templates, isLoading: isLoadingTemplates } =
		api.dailyJournal.getTemplates.useQuery();

	// Fetch checks for the selected date
	const { data: checksData, isLoading: isLoadingChecks } =
		api.dailyJournal.getChecks.useQuery({
			date: selectedDate.toISOString(),
		});

	// Fetch forced items from getWithTrades
	const { data: journalData, isLoading: isLoadingJournal } =
		api.dailyJournal.getWithTrades.useQuery({ date: dateString });

	// Toggle check mutation with optimistic updates
	const toggleCheck = api.dailyJournal.toggleCheck.useMutation({
		onMutate: async (newData) => {
			// Cancel outgoing refetches
			await utils.dailyJournal.getChecks.cancel({
				date: selectedDate.toISOString(),
			});

			// Snapshot current value
			const previousData = utils.dailyJournal.getChecks.getData({
				date: selectedDate.toISOString(),
			});

			// Optimistically update
			utils.dailyJournal.getChecks.setData(
				{ date: selectedDate.toISOString() },
				(old) => {
					if (!old) return old;

					const existingCheckIndex = old.checks.findIndex(
						(c) => c.templateId === newData.templateId,
					);

					if (existingCheckIndex >= 0) {
						// Toggle existing check
						const newChecks = [...old.checks];
						const existingCheck = newChecks[existingCheckIndex];
						if (existingCheck) {
							newChecks[existingCheckIndex] = {
								...existingCheck,
								checked: !existingCheck.checked,
								checkedAt: existingCheck.checked ? null : new Date(),
							};
						}
						return { ...old, checks: newChecks };
					}

					// Add new check (was unchecked, now checked)
					// Find template to include in the optimistic update
					const template = templates?.find((t) => t.id === newData.templateId);

					// If we can't find the template, don't optimistically update
					// Let the actual mutation result handle it
					if (!template) {
						return old;
					}

					return {
						...old,
						checks: [
							...old.checks,
							{
								id: `temp-${Date.now()}`, // Temporary ID for optimistic update
								journalId: old.journalId,
								templateId: newData.templateId,
								forcedItemId: null, // Template-based check, not a forced item
								checked: true,
								checkedAt: new Date(),
								template,
							},
						],
					};
				},
			);

			return { previousData };
		},
		onError: (error, _newData, context) => {
			// Rollback on error
			if (context?.previousData) {
				utils.dailyJournal.getChecks.setData(
					{ date: selectedDate.toISOString() },
					context.previousData,
				);
			}
			toast.error(getErrorMessage(error, ERR_CHECKLIST_UPDATE_FAILED));
		},
	});

	// Filter to only active templates
	const activeTemplates = useMemo(() => {
		return templates?.filter((t) => t.isActive) ?? [];
	}, [templates]);

	// Create a map of templateId -> checked status
	const checksMap = useMemo(() => {
		const map = new Map<string, boolean>();
		if (!checksData?.checks) return map;
		for (const check of checksData.checks) {
			// Only include template-based checks (not forced items)
			if (check.templateId) {
				map.set(check.templateId, check.checked);
			}
		}
		return map;
	}, [checksData?.checks]);

	// Extract forced items from journal data
	const forcedItems = journalData?.forcedItems ?? [];

	// Calculate compliance percentage (including forced items)
	const compliance = useMemo(() => {
		const totalItems = activeTemplates.length + forcedItems.length;
		if (totalItems === 0) return null;

		const templateCheckedCount = activeTemplates.filter((t) =>
			checksMap.get(t.id),
		).length;
		const forcedCheckedCount = forcedItems.filter(
			(item) => item.checked,
		).length;
		const totalChecked = templateCheckedCount + forcedCheckedCount;

		return {
			checked: totalChecked,
			total: totalItems,
			percentage: Math.round((totalChecked / totalItems) * 100),
		};
	}, [activeTemplates, checksMap, forcedItems]);

	// Toggle forced check mutation
	const toggleForcedCheck = api.dailyJournal.toggleForcedCheck.useMutation({
		onMutate: async (newData) => {
			await utils.dailyJournal.getWithTrades.cancel({ date: dateString });
			const previousData = utils.dailyJournal.getWithTrades.getData({
				date: dateString,
			});

			utils.dailyJournal.getWithTrades.setData({ date: dateString }, (old) => {
				if (!old) return old;
				return {
					...old,
					forcedItems: old.forcedItems.map((item) =>
						item.id === newData.itemId
							? { ...item, checked: !item.checked }
							: item,
					),
				};
			});

			return { previousData };
		},
		onError: (error, _newData, context) => {
			if (context?.previousData) {
				utils.dailyJournal.getWithTrades.setData(
					{ date: dateString },
					context.previousData,
				);
			}
			toast.error(getErrorMessage(error, ERR_CHECKLIST_UPDATE_FAILED));
		},
	});

	const handleToggle = (templateId: string) => {
		toggleCheck.mutate({
			date: selectedDate.toISOString(),
			templateId,
		});
	};

	const handleToggleForcedItem = (itemId: string, autoChecked: boolean) => {
		// Don't allow toggling auto-checked items
		if (autoChecked) return;

		toggleForcedCheck.mutate({
			date: dateString,
			itemId,
		});
	};

	const isLoading = isLoadingTemplates || isLoadingChecks || isLoadingJournal;

	return (
		<div className={cn("space-y-3", className)}>
			{/* Header with settings gear */}
			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Daily Checklist
				</span>
				<Button
					aria-label="Checklist settings"
					className="text-muted-foreground hover:text-foreground"
					onClick={onOpenSettings}
					size="icon-sm"
					variant="ghost"
				>
					<SettingsIcon className="size-3.5" />
				</Button>
			</div>

			{/* Loading state */}
			{isLoading && (
				<div className="flex items-center justify-center py-4">
					<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
				</div>
			)}

			{/* Empty state - only show if no forced items AND no templates */}
			{!isLoading &&
				activeTemplates.length === 0 &&
				forcedItems.length === 0 && (
					<div className="py-4 text-center">
						<p className="font-mono text-muted-foreground text-xs">
							No checklist items yet
						</p>
						<button
							className="mt-1 font-mono text-primary text-xs hover:underline"
							onClick={onOpenSettings}
							type="button"
						>
							Add your first item
						</button>
					</div>
				)}

			{/* Forced items (system-level) */}
			{!isLoading && forcedItems.length > 0 && (
				<div className="space-y-2">
					{forcedItems.map((item) => {
						const checkboxId = `forced-${item.id}`;
						const isAutoChecked = item.autoChecked;

						return (
							<div
								className={cn(
									"flex items-center gap-2 rounded p-1.5 transition-colors",
									"border border-primary/20 bg-primary/5",
									!isAutoChecked && "cursor-pointer hover:bg-primary/10",
									item.checked && "opacity-75",
								)}
								key={item.id}
							>
								<Checkbox
									checked={item.checked}
									disabled={isAutoChecked}
									id={checkboxId}
									onCheckedChange={() =>
										handleToggleForcedItem(item.id, isAutoChecked)
									}
								/>
								<label
									className={cn(
										"flex-1 font-mono text-sm",
										!isAutoChecked && "cursor-pointer",
										item.checked && "text-muted-foreground line-through",
									)}
									htmlFor={checkboxId}
								>
									{item.text}
								</label>
								{isAutoChecked ? (
									<Tooltip>
										<TooltipTrigger asChild>
											<ZapIcon className="h-3 w-3 text-primary" />
										</TooltipTrigger>
										<TooltipContent>
											<p className="font-mono text-xs">
												Auto-checked based on trade data
											</p>
										</TooltipContent>
									</Tooltip>
								) : (
									<Tooltip>
										<TooltipTrigger asChild>
											<LockIcon className="h-3 w-3 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p className="font-mono text-xs">System requirement</p>
										</TooltipContent>
									</Tooltip>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* User template items */}
			{!isLoading && activeTemplates.length > 0 && (
				<div className="space-y-2">
					{activeTemplates.map((template) => {
						const isChecked = checksMap.get(template.id) ?? false;
						const checkboxId = `checklist-${template.id}`;

						return (
							<div
								className={cn(
									"flex cursor-pointer items-center gap-2 rounded p-1.5 transition-colors",
									"hover:bg-muted/50",
									isChecked && "opacity-75",
								)}
								key={template.id}
							>
								<Checkbox
									checked={isChecked}
									id={checkboxId}
									onCheckedChange={() => handleToggle(template.id)}
								/>
								<label
									className={cn(
										"cursor-pointer font-mono text-sm",
										isChecked && "text-muted-foreground line-through",
									)}
									htmlFor={checkboxId}
								>
									{template.text}
								</label>
							</div>
						);
					})}
				</div>
			)}

			{/* Compliance indicator */}
			{!isLoading && compliance && (
				<div className="border-border border-t pt-3">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Compliance
						</span>
						<span
							className={cn(
								"font-mono text-sm",
								compliance.percentage === 100 && "text-profit",
								compliance.percentage >= 75 &&
									compliance.percentage < 100 &&
									"text-primary",
								compliance.percentage < 75 && "text-muted-foreground",
							)}
						>
							{compliance.checked}/{compliance.total} ({compliance.percentage}%)
						</span>
					</div>

					{/* Progress bar */}
					<div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								"h-full transition-all duration-300",
								compliance.percentage === 100 && "bg-profit",
								compliance.percentage >= 75 &&
									compliance.percentage < 100 &&
									"bg-primary",
								compliance.percentage < 75 && "bg-muted-foreground",
							)}
							style={{ width: `${compliance.percentage}%` }}
						/>
					</div>
				</div>
			)}

			{/* Date indicator for context */}
			<div className="pt-2 text-center">
				<span className="font-mono text-[10px] text-muted-foreground/60">
					{formatLocalDate(selectedDate, "EEEE, MMM d, yyyy")}
				</span>
			</div>
		</div>
	);
}
