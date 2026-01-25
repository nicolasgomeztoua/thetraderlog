"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Check, Loader2 } from "lucide-react";

interface SaveStatusIndicatorProps {
	/** Whether a save is currently in progress */
	isSaving: boolean;
	/** When the last successful save occurred */
	lastSavedAt: Date | null;
	/** Error message from the last failed save */
	error: string | null;
}

/**
 * Displays the auto-save status with different visual states.
 *
 * States:
 * - Saving: Yellow pulsing dot + "Saving..."
 * - Saved: Green dot + "All changes saved" + relative time
 * - Error: Red dot + error message
 * - Idle: Nothing shown (when lastSavedAt is null and not saving)
 *
 * @example
 * ```tsx
 * const { isSaving, lastSavedAt, error } = useAutoSave({ ... });
 *
 * <SaveStatusIndicator
 *   isSaving={isSaving}
 *   lastSavedAt={lastSavedAt}
 *   error={error}
 * />
 * ```
 */
export function SaveStatusIndicator({
	error,
	isSaving,
	lastSavedAt,
}: SaveStatusIndicatorProps) {
	// Saving state - yellow pulsing indicator
	if (isSaving) {
		return (
			<div
				className="flex items-center gap-2"
				data-testid="save-status-indicator"
			>
				<div className="relative flex h-4 w-4 items-center justify-center">
					<Loader2 className="h-3 w-3 animate-spin text-breakeven" />
				</div>
				<span className="font-mono text-[10px] text-breakeven uppercase tracking-wider">
					Saving...
				</span>
			</div>
		);
	}

	// Error state - red indicator with message
	if (error) {
		return (
			<div
				className="flex items-center gap-2"
				data-testid="save-status-indicator"
			>
				<div className="flex h-4 w-4 items-center justify-center rounded-full bg-loss/20">
					<AlertCircle className="h-2.5 w-2.5 text-loss" />
				</div>
				<span className="max-w-[200px] truncate font-mono text-[10px] text-loss uppercase tracking-wider">
					{error}
				</span>
			</div>
		);
	}

	// Saved state - green indicator with relative time
	if (lastSavedAt) {
		const relativeTime = formatDistanceToNow(lastSavedAt, { addSuffix: true });

		return (
			<div
				className="flex items-center gap-2"
				data-testid="save-status-indicator"
			>
				<div className="flex h-4 w-4 items-center justify-center rounded-full bg-profit/20">
					<Check className="h-2.5 w-2.5 text-profit" />
				</div>
				<span className="font-mono text-[10px] text-profit uppercase tracking-wider">
					All changes saved
				</span>
				<span className="font-mono text-[10px] text-muted-foreground">
					{relativeTime}
				</span>
			</div>
		);
	}

	// Idle state - nothing shown
	return null;
}
