"use client";

import { Save } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface SavePresetDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when dialog should close */
	onOpenChange: (open: boolean) => void;
	/** Callback when preset is saved successfully */
	onSaved?: (presetId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SavePresetDialog({
	open,
	onOpenChange,
	onSaved,
}: SavePresetDialogProps) {
	const { filters } = useAnalyticsFilterStore();
	const utils = api.useUtils();

	// Form state
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isDefault, setIsDefault] = useState(false);

	// Create mutation
	const createPreset = api.analytics.createFilterPreset.useMutation({
		onSuccess: (preset) => {
			// Invalidate presets query
			utils.analytics.getFilterPresets.invalidate();
			utils.analytics.getDefaultPreset.invalidate();

			// Reset form
			setName("");
			setDescription("");
			setIsDefault(false);

			// Close dialog
			onOpenChange(false);

			// Notify parent
			if (preset) {
				onSaved?.(preset.id);
			}
		},
	});

	// Handle save
	const handleSave = useCallback(() => {
		if (!name.trim()) return;

		// Serialize filters to JSON string
		const filtersJson = JSON.stringify({
			symbols: filters.symbols,
			dateRange: {
				start: filters.dateRange.start?.toISOString() ?? null,
				end: filters.dateRange.end?.toISOString() ?? null,
			},
			daysOfWeek: filters.daysOfWeek,
			hours: filters.hours,
			sessions: filters.sessions,
			strategies: filters.strategies,
			tags: filters.tags,
			rMultipleRange: filters.rMultipleRange,
			positionSizeRange: filters.positionSizeRange,
			outcome: filters.outcome,
			reviewed: filters.reviewed,
		});

		createPreset.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
			filters: filtersJson,
			isDefault,
		});
	}, [name, description, isDefault, filters, createPreset]);

	// Handle cancel
	const handleCancel = useCallback(() => {
		setName("");
		setDescription("");
		setIsDefault(false);
		onOpenChange(false);
	}, [onOpenChange]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10">
							<Save className="size-5 text-primary" />
						</div>
						<div>
							<DialogTitle className="font-mono text-lg">
								Save Filter Preset
							</DialogTitle>
							<DialogDescription className="font-mono text-xs">
								Save current filters as a reusable preset
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Name input */}
					<div className="space-y-2">
						<Label className="font-mono text-xs" htmlFor="preset-name">
							Name <span className="text-loss">*</span>
						</Label>
						<Input
							className="font-mono text-sm"
							id="preset-name"
							maxLength={100}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Morning Session Winners"
							value={name}
						/>
					</div>

					{/* Description input */}
					<div className="space-y-2">
						<Label className="font-mono text-xs" htmlFor="preset-description">
							Description{" "}
							<span className="text-muted-foreground">(optional)</span>
						</Label>
						<Textarea
							className="min-h-20 resize-none font-mono text-sm"
							id="preset-description"
							maxLength={500}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Describe what this preset filters for..."
							value={description}
						/>
					</div>

					{/* Default checkbox */}
					<div className="flex items-center gap-3 rounded border border-border bg-secondary/50 p-3">
						<Checkbox
							checked={isDefault}
							id="preset-default"
							onCheckedChange={(checked) => setIsDefault(checked === true)}
						/>
						<div className="flex-1">
							<Label
								className="cursor-pointer font-mono text-sm"
								htmlFor="preset-default"
							>
								Set as default
							</Label>
							<p className="font-mono text-muted-foreground text-xs">
								Auto-load this preset when visiting analytics
							</p>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						className="font-mono"
						disabled={createPreset.isPending}
						onClick={handleCancel}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						className="font-mono"
						disabled={!name.trim() || createPreset.isPending}
						onClick={handleSave}
						type="button"
					>
						{createPreset.isPending ? "Saving..." : "Save Preset"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
