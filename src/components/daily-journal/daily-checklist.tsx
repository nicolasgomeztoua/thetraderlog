"use client";

import { format } from "date-fns";
import { Loader2Icon, SettingsIcon } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/shared";
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

	// Fetch templates (all active templates for the user)
	const { data: templates, isLoading: isLoadingTemplates } =
		api.dailyJournal.getTemplates.useQuery();

	// Fetch checks for the selected date
	const { data: checksData, isLoading: isLoadingChecks } =
		api.dailyJournal.getChecks.useQuery({
			date: selectedDate.toISOString(),
		});

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
								journalId: old.journalId,
								templateId: newData.templateId,
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
		onError: (_err, _newData, context) => {
			// Rollback on error
			if (context?.previousData) {
				utils.dailyJournal.getChecks.setData(
					{ date: selectedDate.toISOString() },
					context.previousData,
				);
			}
		},
		onSettled: () => {
			// Refetch to ensure consistency
			utils.dailyJournal.getChecks.invalidate({
				date: selectedDate.toISOString(),
			});
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
			map.set(check.templateId, check.checked);
		}
		return map;
	}, [checksData?.checks]);

	// Calculate compliance percentage
	const compliance = useMemo(() => {
		if (activeTemplates.length === 0) return null;

		const checkedCount = activeTemplates.filter((t) =>
			checksMap.get(t.id),
		).length;

		return {
			checked: checkedCount,
			total: activeTemplates.length,
			percentage: Math.round((checkedCount / activeTemplates.length) * 100),
		};
	}, [activeTemplates, checksMap]);

	const handleToggle = (templateId: string) => {
		toggleCheck.mutate({
			date: selectedDate.toISOString(),
			templateId,
		});
	};

	const isLoading = isLoadingTemplates || isLoadingChecks;

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

			{/* Empty state */}
			{!isLoading && activeTemplates.length === 0 && (
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

			{/* Checklist items */}
			{!isLoading && activeTemplates.length > 0 && (
				<div className="space-y-2">
					{activeTemplates.map((template) => {
						const isChecked = checksMap.get(template.id) ?? false;
						const checkboxId = `checklist-${template.id}`;

						return (
							<div
								className={cn(
									"flex cursor-pointer items-center gap-2 rounded p-1.5 transition-colors",
									"hover:bg-white/2",
									isChecked && "opacity-75",
								)}
								key={template.id}
							>
								<Checkbox
									checked={isChecked}
									disabled={toggleCheck.isPending}
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
					<div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
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
					{format(selectedDate, "EEEE, MMM d, yyyy")}
				</span>
			</div>
		</div>
	);
}
