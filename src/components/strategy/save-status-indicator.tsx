"use client";

import {
	AlertCircleIcon,
	AlertTriangleIcon,
	CheckCircleIcon,
	Loader2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SaveStatus } from "@/hooks/use-strategy-autosave";
import { cn } from "@/lib/shared";

interface SaveStatusIndicatorProps {
	/** Current save status */
	status: SaveStatus;
	/** Callback when retry button is clicked (for error state) */
	onRetry?: () => void;
	/** Callback when 'View Changes' button is clicked (for conflict state) */
	onViewConflict?: () => void;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Displays the auto-save status for strategy editing.
 *
 * States:
 * - idle: hidden
 * - saving: 'Saving...' with spinner
 * - saved: 'Saved' with checkmark in text-profit, fades out after 2s
 * - error: 'Save failed' with error icon in text-loss, retry button
 * - conflict: 'Conflict detected' with warning icon, 'View Changes' button
 *
 * Follows Terminal design: monospace font, chartreuse accents.
 */
export function SaveStatusIndicator({
	status,
	onRetry,
	onViewConflict,
	className,
}: SaveStatusIndicatorProps) {
	// Track fade-out animation for saved state
	const [isVisible, setIsVisible] = useState(false);

	// Show/hide based on status
	useEffect(() => {
		if (status === "idle") {
			setIsVisible(false);
		} else {
			setIsVisible(true);
		}
	}, [status]);

	// Don't render anything when idle and not visible
	if (status === "idle" && !isVisible) {
		return null;
	}

	return (
		<div
			className={cn(
				"flex items-center gap-2 font-mono text-xs transition-opacity duration-200",
				status === "idle" && "opacity-0",
				className,
			)}
			data-testid="save-status-indicator"
		>
			{status === "saving" && (
				<div className="flex items-center gap-1.5 text-muted-foreground">
					<Loader2Icon className="size-3 animate-spin" />
					<span>Saving...</span>
				</div>
			)}

			{status === "saved" && (
				<div className="flex items-center gap-1.5 text-profit">
					<CheckCircleIcon className="size-3" />
					<span>Saved</span>
				</div>
			)}

			{status === "error" && (
				<div className="flex items-center gap-2 text-loss">
					<div className="flex items-center gap-1.5">
						<AlertCircleIcon className="size-3" />
						<span>Save failed</span>
					</div>
					{onRetry && (
						<Button
							className="h-5 px-2 text-xs"
							onClick={onRetry}
							size="sm"
							variant="ghost"
						>
							Retry
						</Button>
					)}
				</div>
			)}

			{status === "conflict" && (
				<div className="flex items-center gap-2 text-breakeven">
					<div className="flex items-center gap-1.5">
						<AlertTriangleIcon className="size-3" />
						<span>Conflict detected</span>
					</div>
					{onViewConflict && (
						<Button
							className="h-5 px-2 text-xs"
							onClick={onViewConflict}
							size="sm"
							variant="ghost"
						>
							View Changes
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
