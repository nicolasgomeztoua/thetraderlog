"use client";

import { useId } from "react";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";
import { cn, PRESET_COLORS } from "@/lib/shared";

/**
 * Form data interface matching what this section needs to edit
 */
export interface BasicInfoData {
	name: string;
	description: string | null;
	color: string;
	isActive: boolean;
}

interface BasicInfoSectionProps {
	data: BasicInfoData;
	onChange: (updates: Partial<BasicInfoData>) => void;
	/** Validation error for name field (e.g., from parent form validation) */
	nameError?: string;
}

/**
 * Basic Info Section - Edit Form
 *
 * Allows editing:
 * - Strategy name (required, min 2 chars)
 * - Description (optional)
 * - Color (preset picker)
 * - Active/Inactive toggle
 *
 * Auto-saves changes via parent onChange callback.
 */
export function BasicInfoSection({
	data,
	onChange,
	nameError,
}: BasicInfoSectionProps) {
	const toggleId = useId();
	const selectedColor = data.color ?? PRESET_COLORS[0];

	function handleNameChange(value: string | null) {
		onChange({ name: value ?? "" });
	}

	function handleDescriptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
		const value = e.target.value.trim() === "" ? null : e.target.value;
		onChange({ description: value });
	}

	function handleColorSelect(color: string) {
		onChange({ color });
	}

	function handleActiveToggle() {
		onChange({ isActive: !data.isActive });
	}

	return (
		<div
			className="space-y-6 rounded border border-white/5 bg-white/1 p-6"
			data-testid="edit-form-basic-info"
		>
			{/* Section Header */}
			<div className="flex items-center justify-between">
				<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
					Basic Information
				</h2>
				{/* Active/Inactive Toggle */}
				<div className="flex items-center gap-3">
					<label
						className="cursor-pointer font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
						htmlFor={toggleId}
					>
						{data.isActive ? "Active" : "Inactive"}
					</label>
					<button
						aria-checked={data.isActive}
						aria-label={
							data.isActive ? "Deactivate strategy" : "Activate strategy"
						}
						className={cn(
							"relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
							data.isActive ? "bg-profit" : "bg-white/20",
						)}
						data-testid="edit-form-toggle-active"
						id={toggleId}
						onClick={handleActiveToggle}
						role="switch"
						type="button"
					>
						<span
							className={cn(
								"pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
								data.isActive ? "translate-x-5" : "translate-x-0",
							)}
						/>
					</button>
				</div>
			</div>

			{/* Name Field */}
			<TextInput
				data-testid="edit-form-input-name"
				error={nameError}
				label="Strategy Name *"
				onChange={handleNameChange}
				placeholder="e.g., Trend Continuation"
				required
				value={data.name}
			/>

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
					data-testid="edit-form-textarea-description"
					defaultValue={data.description ?? ""}
					id="strategy-description"
					onBlur={handleDescriptionChange}
					placeholder="Brief description of this strategy..."
					rows={3}
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
				<div
					className="flex flex-wrap gap-2"
					data-testid="edit-form-color-picker"
				>
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
							data-testid={`edit-form-color-${color.replace("#", "")}`}
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
