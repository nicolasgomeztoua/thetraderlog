"use client";

import { useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn, PRESET_COLORS } from "@/lib/shared";
import { useWizard } from "./wizard-container";

/**
 * Step 1 - Basics
 *
 * Captures strategy identity:
 * - Name (required, min 2 characters)
 * - Description (optional)
 * - Color (preset picker)
 */
export function StepBasics() {
	const { data, updateData, setCanProceed } = useWizard();
	const nameInputRef = useRef<HTMLInputElement>(null);

	// Default color if not set
	const selectedColor = data.color ?? PRESET_COLORS[0];

	// Auto-focus name input on mount
	useEffect(() => {
		nameInputRef.current?.focus();
	}, []);

	// Validate step: name required, min 2 characters
	useEffect(() => {
		const name = data.name?.trim() ?? "";
		setCanProceed(name.length >= 2);
	}, [data.name, setCanProceed]);

	function handleNameChange(value: string | null) {
		updateData({ name: value ?? "" });
	}

	function handleDescriptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
		updateData({ description: e.target.value });
	}

	function handleColorSelect(color: string) {
		updateData({ color });
	}

	return (
		<div className="space-y-6" data-testid="wizard-step-basics">
			{/* Name Field */}
			<div className="space-y-1.5">
				<label
					className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest"
					htmlFor="strategy-name"
				>
					Strategy Name *
				</label>
				<input
					aria-invalid={
						data.name !== undefined &&
						(data.name?.trim().length ?? 0) < 2 &&
						(data.name?.trim().length ?? 0) > 0
					}
					className={cn(
						"h-9 w-full min-w-0 rounded border bg-white/2 px-3 py-1 font-mono text-base outline-none transition-all md:text-sm",
						"border-white/10 placeholder:text-muted-foreground/50",
						"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
						"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
					)}
					data-testid="wizard-input-name"
					id="strategy-name"
					onChange={(e) => handleNameChange(e.target.value || null)}
					placeholder="e.g., Trend Continuation"
					ref={nameInputRef}
					type="text"
					value={data.name ?? ""}
				/>
				{data.name !== undefined &&
					(data.name?.trim().length ?? 0) > 0 &&
					(data.name?.trim().length ?? 0) < 2 && (
						<p className="font-mono text-[10px] text-destructive">
							Name must be at least 2 characters
						</p>
					)}
			</div>

			{/* Description Field */}
			<div className="space-y-1.5">
				<label
					className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest"
					htmlFor="strategy-description"
				>
					Description
				</label>
				<Textarea
					className={cn(
						"w-full font-mono text-base md:text-sm",
						"border-white/10 bg-white/2 placeholder:text-muted-foreground/50",
						"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
					)}
					data-testid="wizard-textarea-description"
					id="strategy-description"
					onChange={handleDescriptionChange}
					placeholder="Brief description of this strategy..."
					rows={3}
					value={data.description ?? ""}
				/>
				<p className="font-mono text-[10px] text-muted-foreground/60">
					Optional. Describe the core idea or market conditions for this
					strategy.
				</p>
			</div>

			{/* Color Picker */}
			<div className="space-y-2">
				<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
					Color
				</span>
				<div className="flex flex-wrap gap-2" data-testid="wizard-color-picker">
					{PRESET_COLORS.map((color) => (
						<button
							aria-label={`Select color ${color}`}
							aria-pressed={selectedColor === color}
							className={cn(
								"h-9 w-9 rounded border-2 transition-all sm:h-8 sm:w-8",
								selectedColor === color
									? "scale-110 border-white"
									: "border-transparent hover:border-white/30",
							)}
							data-testid={`wizard-color-${color.replace("#", "")}`}
							key={color}
							onClick={() => handleColorSelect(color)}
							style={{ backgroundColor: color }}
							type="button"
						/>
					))}
				</div>
				<p className="font-mono text-[10px] text-muted-foreground/60">
					This color helps identify the strategy in charts and lists.
				</p>
			</div>
		</div>
	);
}
