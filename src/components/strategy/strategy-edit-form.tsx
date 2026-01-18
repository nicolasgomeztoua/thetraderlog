"use client";

import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRESET_COLORS } from "@/lib/shared";
import { api } from "@/trpc/react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface StrategyEditFormProps {
	strategyId: string;
	initialName: string;
	initialDescription: string | null;
	initialColor: string | null;
}

export function StrategyEditForm({
	strategyId,
	initialName,
	initialDescription,
	initialColor,
}: StrategyEditFormProps) {
	// Form state
	const [name, setName] = useState(initialName);
	const [description, setDescription] = useState(initialDescription ?? "");
	const [color, setColor] = useState(initialColor ?? "#d4ff00");

	// Save status state
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

	// Refs for debouncing
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSavedDataRef = useRef<{
		name: string;
		description: string;
		color: string;
	}>({
		name: initialName,
		description: initialDescription ?? "",
		color: initialColor ?? "#d4ff00",
	});

	// tRPC autosave mutation
	const utils = api.useUtils();
	const autosaveMutation = api.strategies.autosave.useMutation({
		onMutate: () => {
			setSaveStatus("saving");
		},
		onSuccess: (data) => {
			setSaveStatus("saved");
			setLastSavedAt(data.updatedAt);
			// Update the last saved data reference
			lastSavedDataRef.current = { name, description, color };
		},
		onError: () => {
			setSaveStatus("error");
		},
		onSettled: () => {
			// Invalidate strategy query to keep cache in sync
			void utils.strategies.getById.invalidate({ id: strategyId });
		},
	});

	// Debounced save function
	const debouncedSave = useCallback(
		(data: { name: string; description: string; color: string }) => {
			// Clear existing timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			// Check if data has actually changed from last saved state
			const hasChanges =
				data.name !== lastSavedDataRef.current.name ||
				data.description !== lastSavedDataRef.current.description ||
				data.color !== lastSavedDataRef.current.color;

			if (!hasChanges) {
				return;
			}

			// Show unsaved changes indicator immediately
			if (saveStatus !== "saving") {
				setSaveStatus("idle");
			}

			// Debounce the actual save
			debounceTimerRef.current = setTimeout(() => {
				// Skip if name is empty (required field)
				if (!data.name.trim()) {
					return;
				}

				autosaveMutation.mutate({
					id: strategyId,
					name: data.name,
					description: data.description || null,
					color: data.color,
				});
			}, 500);
		},
		[strategyId, autosaveMutation, saveStatus],
	);

	// Trigger debounced save when form values change
	useEffect(() => {
		debouncedSave({ name, description, color });
	}, [name, description, color, debouncedSave]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	// Format the last saved time
	const formatLastSaved = (date: Date) => {
		return date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Determine if there are unsaved changes
	const hasUnsavedChanges =
		name !== lastSavedDataRef.current.name ||
		description !== lastSavedDataRef.current.description ||
		color !== lastSavedDataRef.current.color;

	return (
		<div className="space-y-6" data-testid="strategy-edit-form">
			{/* Save Status Indicator */}
			<div
				className="flex items-center gap-2 font-mono text-xs"
				data-testid="strategy-edit-form-status"
			>
				{saveStatus === "saving" && (
					<>
						<Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
						<span className="text-muted-foreground">Saving...</span>
					</>
				)}
				{saveStatus === "saved" && !hasUnsavedChanges && lastSavedAt && (
					<>
						<Check className="h-3 w-3 text-profit" />
						<span className="text-muted-foreground">
							All changes saved at {formatLastSaved(lastSavedAt)}
						</span>
					</>
				)}
				{saveStatus === "error" && (
					<span className="text-loss">Failed to save. Please try again.</span>
				)}
				{hasUnsavedChanges && saveStatus !== "saving" && (
					<span className="text-muted-foreground/70">Unsaved changes</span>
				)}
			</div>

			{/* Name Field */}
			<div className="space-y-2">
				<label
					className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider"
					htmlFor="strategy-name"
				>
					Strategy Name *
				</label>
				<Input
					className="h-12 font-mono text-lg"
					data-testid="strategy-edit-form-name"
					id="strategy-name"
					onChange={(e) => setName(e.target.value)}
					placeholder="e.g., Trend Continuation"
					required
					value={name}
				/>
			</div>

			{/* Description Field */}
			<div className="space-y-2">
				<label
					className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider"
					htmlFor="strategy-description"
				>
					Description
				</label>
				<Textarea
					className="min-h-[120px] resize-y font-mono"
					data-testid="strategy-edit-form-description"
					id="strategy-description"
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Describe this strategy's core approach, market conditions, and key principles..."
					value={description}
				/>
			</div>

			{/* Color Picker */}
			<div className="space-y-3">
				<label
					className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider"
					htmlFor="strategy-color"
				>
					Color
				</label>
				<div
					className="flex flex-wrap gap-3"
					data-testid="strategy-edit-form-colors"
					id="strategy-color"
				>
					{PRESET_COLORS.map((presetColor) => (
						<button
							aria-label={`Select color ${presetColor}`}
							className={`h-10 w-10 rounded-lg border-2 transition-all ${
								color === presetColor
									? "scale-110 border-white shadow-lg"
									: "border-transparent hover:scale-105 hover:border-white/30"
							}`}
							data-testid={`strategy-edit-form-color-${presetColor.replace("#", "")}`}
							key={presetColor}
							onClick={() => setColor(presetColor)}
							style={{ backgroundColor: presetColor }}
							type="button"
						/>
					))}
				</div>
			</div>
		</div>
	);
}
