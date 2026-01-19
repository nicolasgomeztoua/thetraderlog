"use client";

import {
	AlertTriangleIcon,
	ClockIcon,
	RefreshCwIcon,
	XIcon,
} from "lucide-react";

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
import type {
	ConflictData,
	StrategyFormData,
} from "@/hooks/use-strategy-autosave";
import { cn, formatLocalDate } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

interface ConflictDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when dialog should close */
	onOpenChange: (open: boolean) => void;
	/** Conflict data containing server version and local changes */
	conflictData: ConflictData | null;
	/** Current local form data */
	localData: StrategyFormData;
	/** Callback when user chooses to keep local changes */
	onKeepLocal: () => void;
	/** Callback when user chooses to accept server version */
	onAcceptServer: () => void;
}

interface DiffFieldProps {
	/** Field name for display */
	label: string;
	/** Local value */
	localValue: unknown;
	/** Server value */
	serverValue: unknown;
	/** Whether this field was changed locally */
	isLocalChange: boolean;
	/** Whether this field differs from server */
	isServerChange: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format a value for display in the diff view
 */
function formatValueForDisplay(value: unknown): string {
	if (value === null || value === undefined) {
		return "(empty)";
	}
	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	if (typeof value === "number") {
		return String(value);
	}
	if (typeof value === "string") {
		if (value.trim() === "") {
			return "(empty)";
		}
		// Truncate long strings
		if (value.length > 100) {
			return `${value.substring(0, 100)}...`;
		}
		return value;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "(empty list)";
		}
		return `${value.length} item${value.length === 1 ? "" : "s"}`;
	}
	if (typeof value === "object") {
		// For objects, show a summary
		const keys = Object.keys(value);
		if (keys.length === 0) {
			return "(empty)";
		}
		return `${keys.length} field${keys.length === 1 ? "" : "s"} set`;
	}
	return String(value);
}

/**
 * Get human-readable label for a field key
 */
function getFieldLabel(key: string): string {
	const labels: Record<string, string> = {
		name: "Name",
		description: "Description",
		color: "Color",
		entryCriteria: "Entry Criteria",
		exitRules: "Exit Rules",
		riskParameters: "Risk Parameters",
		scalingRules: "Scaling Rules",
		trailingRules: "Trailing Rules",
		rules: "Rules",
		coverImageUrl: "Cover Image",
		coverImageKey: "Cover Image Key",
		instruments: "Instruments",
		categoryTags: "Categories",
		isPublic: "Published",
		isAnonymous: "Anonymous",
	};
	return (
		labels[key] ??
		key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
	);
}

/**
 * Check if two values are different
 */
function valuesAreDifferent(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) !== JSON.stringify(b);
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Single field diff display
 */
function DiffField({
	label,
	localValue,
	serverValue,
	isLocalChange,
	isServerChange,
}: DiffFieldProps) {
	const hasConflict = isLocalChange && isServerChange;

	return (
		<div
			className={cn(
				"rounded border p-3",
				hasConflict
					? "border-breakeven/50 bg-breakeven/5"
					: "border-border bg-secondary/20",
			)}
		>
			<div className="mb-2 flex items-center justify-between">
				<span className="font-medium font-mono text-sm">{label}</span>
				{hasConflict && (
					<span className="rounded bg-breakeven/20 px-1.5 py-0.5 font-mono text-breakeven text-xs">
						Conflict
					</span>
				)}
				{isLocalChange && !isServerChange && (
					<span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-primary text-xs">
						Your change
					</span>
				)}
				{isServerChange && !isLocalChange && (
					<span className="rounded bg-ice-blue/20 px-1.5 py-0.5 font-mono text-ice-blue text-xs">
						Server change
					</span>
				)}
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div>
					<div className="mb-1 font-mono text-muted-foreground text-xs">
						Your Version
					</div>
					<div
						className={cn(
							"min-h-[2rem] rounded bg-background p-2 font-mono text-xs",
							isLocalChange && "ring-1 ring-primary/50",
						)}
					>
						{formatValueForDisplay(localValue)}
					</div>
				</div>
				<div>
					<div className="mb-1 font-mono text-muted-foreground text-xs">
						Server Version
					</div>
					<div
						className={cn(
							"min-h-[2rem] rounded bg-background p-2 font-mono text-xs",
							isServerChange && "ring-1 ring-ice-blue/50",
						)}
					>
						{formatValueForDisplay(serverValue)}
					</div>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Dialog for resolving auto-save conflicts between local and server versions.
 *
 * Shows a two-column diff of changes with options to:
 * - Keep local changes (overwrite server)
 * - Accept server version (discard local)
 * - Cancel (close dialog, keep editing)
 *
 * Follows Terminal design: monospace font, dark theme, data-dense layout.
 */
export function ConflictDialog({
	open,
	onOpenChange,
	conflictData,
	localData,
	onKeepLocal,
	onAcceptServer,
}: ConflictDialogProps) {
	if (!conflictData) {
		return null;
	}

	const { serverVersion, localChanges } = conflictData;

	// Fields to skip (server-only fields not in StrategyFormData)
	const serverOnlyFields = new Set(["updatedAt", "id", "userId", "createdAt"]);

	// Get all fields from local changes (already StrategyFormData keys)
	const localChangeKeys = Object.keys(
		localChanges,
	) as (keyof StrategyFormData)[];

	// Get server fields, filtering out server-only ones
	const serverKeys = Object.keys(serverVersion).filter(
		(k) => !serverOnlyFields.has(k),
	) as (keyof StrategyFormData)[];

	// Combine all relevant fields
	const allFields = new Set<keyof StrategyFormData>([
		...localChangeKeys,
		...serverKeys,
	]);

	// Filter to only show fields that have actual differences
	const changedFields: (keyof StrategyFormData)[] = [];
	for (const field of allFields) {
		const localValue = localData[field];
		const serverValue = serverVersion[field as keyof typeof serverVersion];
		const isLocalChange = field in localChanges;
		const isServerChange = valuesAreDifferent(localValue, serverValue);

		if (isLocalChange || isServerChange) {
			changedFields.push(field);
		}
	}

	// Sort fields by importance
	const fieldOrder: (keyof StrategyFormData)[] = [
		"name",
		"description",
		"color",
		"entryCriteria",
		"exitRules",
		"riskParameters",
		"scalingRules",
		"trailingRules",
		"rules",
	];
	changedFields.sort((a, b) => {
		const aIndex = fieldOrder.indexOf(a);
		const bIndex = fieldOrder.indexOf(b);
		if (aIndex === -1 && bIndex === -1) return 0;
		if (aIndex === -1) return 1;
		if (bIndex === -1) return -1;
		return aIndex - bIndex;
	});

	// Get timestamps
	const serverTimestamp = serverVersion.updatedAt
		? formatLocalDate(
				new Date(serverVersion.updatedAt),
				"MMM d, yyyy 'at' HH:mm:ss",
			)
		: "Unknown";

	const handleKeepLocal = () => {
		onKeepLocal();
		onOpenChange(false);
	};

	const handleAcceptServer = () => {
		onAcceptServer();
		onOpenChange(false);
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-2xl" data-testid="conflict-dialog">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded bg-breakeven/10">
							<AlertTriangleIcon className="size-5 text-breakeven" />
						</div>
						<div>
							<DialogTitle
								className="font-mono text-lg"
								data-testid="conflict-dialog-title"
							>
								Changes Conflict
							</DialogTitle>
							<DialogDescription className="font-mono text-xs">
								The strategy was modified elsewhere while you were editing
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Explanation */}
					<div className="rounded border border-border bg-secondary/30 p-3">
						<p className="font-mono text-muted-foreground text-xs leading-relaxed">
							Someone (or another tab) saved changes to this strategy while you
							were editing. Review the differences below and choose which
							version to keep.
						</p>
					</div>

					{/* Timestamps */}
					<div className="flex items-center justify-between rounded bg-secondary/20 px-3 py-2">
						<div className="flex items-center gap-2">
							<ClockIcon className="size-3.5 text-muted-foreground" />
							<span className="font-mono text-muted-foreground text-xs">
								Server version saved: {serverTimestamp}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<RefreshCwIcon className="size-3.5 text-muted-foreground" />
							<span className="font-mono text-muted-foreground text-xs">
								{changedFields.length} field
								{changedFields.length === 1 ? "" : "s"} affected
							</span>
						</div>
					</div>

					{/* Diff view */}
					<ScrollArea className="max-h-[300px]">
						<div className="space-y-3 pr-4" data-testid="conflict-dialog-diff">
							{changedFields.length === 0 ? (
								<div className="flex h-24 items-center justify-center">
									<span className="font-mono text-muted-foreground text-sm">
										No visible differences to display
									</span>
								</div>
							) : (
								changedFields.map((field) => {
									const localValue = localData[field];
									const serverValue =
										serverVersion[field as keyof typeof serverVersion];
									const isLocalChange = field in localChanges;
									const isServerChange = valuesAreDifferent(
										localValue,
										serverValue,
									);

									return (
										<DiffField
											isLocalChange={isLocalChange}
											isServerChange={isServerChange}
											key={field}
											label={getFieldLabel(field)}
											localValue={localValue}
											serverValue={serverValue}
										/>
									);
								})
							)}
						</div>
					</ScrollArea>
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-row">
					<Button
						className="font-mono"
						data-testid="conflict-dialog-cancel"
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						<XIcon className="mr-2 size-4" />
						Cancel
					</Button>
					<Button
						className="font-mono"
						data-testid="conflict-dialog-accept-server"
						onClick={handleAcceptServer}
						variant="secondary"
					>
						Use Server Version
					</Button>
					<Button
						className="font-mono"
						data-testid="conflict-dialog-keep-local"
						onClick={handleKeepLocal}
					>
						Keep My Changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
