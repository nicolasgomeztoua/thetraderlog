"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { STRATEGY_CATEGORIES, STRATEGY_INSTRUMENTS } from "@/lib/constants";
import { PRESET_COLORS } from "@/lib/shared";
import { api } from "@/trpc/react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Helper to compare arrays (outside component to avoid dependency issues)
function arraysEqual(a: string[], b: string[]) {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort();
	const sortedB = [...b].sort();
	return sortedA.every((val, i) => val === sortedB[i]);
}

interface StrategyEditFormProps {
	strategyId: string;
	initialName: string;
	initialDescription: string | null;
	initialColor: string | null;
	initialInstruments: string[] | null;
	initialCategoryTags: string[] | null;
}

export function StrategyEditForm({
	strategyId,
	initialName,
	initialDescription,
	initialColor,
	initialInstruments,
	initialCategoryTags,
}: StrategyEditFormProps) {
	// Form state
	const [name, setName] = useState(initialName);
	const [description, setDescription] = useState(initialDescription ?? "");
	const [color, setColor] = useState(initialColor ?? "#d4ff00");
	const [instruments, setInstruments] = useState<string[]>(
		initialInstruments ?? [],
	);
	const [categoryTags, setCategoryTags] = useState<string[]>(
		initialCategoryTags ?? [],
	);

	// Popover state
	const [instrumentsOpen, setInstrumentsOpen] = useState(false);
	const [categoriesOpen, setCategoriesOpen] = useState(false);

	// Save status state
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

	// Refs for debouncing
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSavedDataRef = useRef<{
		name: string;
		description: string;
		color: string;
		instruments: string[];
		categoryTags: string[];
	}>({
		name: initialName,
		description: initialDescription ?? "",
		color: initialColor ?? "#d4ff00",
		instruments: initialInstruments ?? [],
		categoryTags: initialCategoryTags ?? [],
	});

	// tRPC autosave mutation with optimistic updates for color
	const utils = api.useUtils();
	const previousColorRef = useRef<string | null>(null);

	const autosaveMutation = api.strategies.autosave.useMutation({
		onMutate: async (input) => {
			setSaveStatus("saving");

			// Only apply optimistic update if color is being changed
			if (input.color !== undefined) {
				// Cancel outgoing refetches to prevent overwriting optimistic update
				await utils.strategies.getById.cancel({ id: strategyId });

				// Snapshot current data for potential rollback
				const previousData = utils.strategies.getById.getData({
					id: strategyId,
				});
				previousColorRef.current = previousData?.color ?? null;

				// Optimistically update the cache with new color
				utils.strategies.getById.setData({ id: strategyId }, (old) => {
					if (!old) return old;
					return { ...old, color: input.color ?? old.color };
				});
			}
		},
		onSuccess: (data) => {
			setSaveStatus("saved");
			setLastSavedAt(data.updatedAt);
			// Update the last saved data reference
			lastSavedDataRef.current = {
				name,
				description,
				color,
				instruments,
				categoryTags,
			};
			// Clear the previous color ref on success
			previousColorRef.current = null;
		},
		onError: (_err, input) => {
			setSaveStatus("error");

			// Revert optimistic color update if color was changed
			if (input.color !== undefined && previousColorRef.current !== null) {
				utils.strategies.getById.setData({ id: strategyId }, (old) => {
					if (!old) return old;
					return { ...old, color: previousColorRef.current };
				});
				// Also revert local state
				setColor(previousColorRef.current);
			}
			previousColorRef.current = null;
		},
		onSettled: () => {
			// Invalidate strategy query to keep cache in sync
			void utils.strategies.getById.invalidate({ id: strategyId });
		},
	});

	// Debounced save function
	const debouncedSave = useCallback(
		(data: {
			name: string;
			description: string;
			color: string;
			instruments: string[];
			categoryTags: string[];
		}) => {
			// Clear existing timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			// Check if data has actually changed from last saved state
			const hasChanges =
				data.name !== lastSavedDataRef.current.name ||
				data.description !== lastSavedDataRef.current.description ||
				data.color !== lastSavedDataRef.current.color ||
				!arraysEqual(data.instruments, lastSavedDataRef.current.instruments) ||
				!arraysEqual(data.categoryTags, lastSavedDataRef.current.categoryTags);

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
					instruments: data.instruments.length > 0 ? data.instruments : null,
					categoryTags: data.categoryTags.length > 0 ? data.categoryTags : null,
				});
			}, 500);
		},
		[strategyId, autosaveMutation, saveStatus],
	);

	// Trigger debounced save when form values change
	useEffect(() => {
		debouncedSave({ name, description, color, instruments, categoryTags });
	}, [name, description, color, instruments, categoryTags, debouncedSave]);

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
		color !== lastSavedDataRef.current.color ||
		!arraysEqual(instruments, lastSavedDataRef.current.instruments) ||
		!arraysEqual(categoryTags, lastSavedDataRef.current.categoryTags);

	// Helper to toggle selection in array
	const toggleSelection = (
		item: string,
		current: string[],
		setter: React.Dispatch<React.SetStateAction<string[]>>,
	) => {
		if (current.includes(item)) {
			setter(current.filter((i) => i !== item));
		} else {
			setter([...current, item]);
		}
	};

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

			{/* Instruments Multi-Select */}
			<div className="space-y-2">
				<label
					className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider"
					htmlFor="strategy-instruments"
				>
					Instruments
				</label>
				<Popover onOpenChange={setInstrumentsOpen} open={instrumentsOpen}>
					<PopoverTrigger asChild>
						<Button
							className="h-auto min-h-10 w-full justify-between px-3 py-2 font-mono text-sm"
							data-testid="strategy-edit-form-instruments"
							id="strategy-instruments"
							variant="outline"
						>
							<div className="flex flex-wrap gap-1.5">
								{instruments.length > 0 ? (
									instruments.map((inst) => (
										<span
											className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs"
											key={inst}
										>
											{inst}
											<button
												className="hover:text-destructive"
												onClick={(e) => {
													e.stopPropagation();
													setInstruments(instruments.filter((i) => i !== inst));
												}}
												type="button"
											>
												<X className="h-3 w-3" />
											</button>
										</span>
									))
								) : (
									<span className="text-muted-foreground">
										Select instruments...
									</span>
								)}
							</div>
							<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-64 p-2">
						<div className="grid gap-1">
							{STRATEGY_INSTRUMENTS.map((inst) => (
								<button
									className="flex items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-sm hover:bg-white/5"
									key={inst}
									onClick={() =>
										toggleSelection(inst, instruments, setInstruments)
									}
									type="button"
								>
									<Checkbox
										checked={instruments.includes(inst)}
										className="pointer-events-none"
									/>
									<span>{inst}</span>
								</button>
							))}
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{/* Categories Multi-Select */}
			<div className="space-y-2">
				<label
					className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider"
					htmlFor="strategy-categories"
				>
					Categories
				</label>
				<Popover onOpenChange={setCategoriesOpen} open={categoriesOpen}>
					<PopoverTrigger asChild>
						<Button
							className="h-auto min-h-10 w-full justify-between px-3 py-2 font-mono text-sm"
							data-testid="strategy-edit-form-categories"
							id="strategy-categories"
							variant="outline"
						>
							<div className="flex flex-wrap gap-1.5">
								{categoryTags.length > 0 ? (
									categoryTags.map((cat) => (
										<span
											className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs"
											key={cat}
										>
											{cat}
											<button
												className="hover:text-destructive"
												onClick={(e) => {
													e.stopPropagation();
													setCategoryTags(
														categoryTags.filter((c) => c !== cat),
													);
												}}
												type="button"
											>
												<X className="h-3 w-3" />
											</button>
										</span>
									))
								) : (
									<span className="text-muted-foreground">
										Select categories...
									</span>
								)}
							</div>
							<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-64 p-2">
						<div className="grid gap-1">
							{STRATEGY_CATEGORIES.map((cat) => (
								<button
									className="flex items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-sm hover:bg-white/5"
									key={cat}
									onClick={() =>
										toggleSelection(cat, categoryTags, setCategoryTags)
									}
									type="button"
								>
									<Checkbox
										checked={categoryTags.includes(cat)}
										className="pointer-events-none"
									/>
									<span>{cat}</span>
								</button>
							))}
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}
