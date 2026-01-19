"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/shared";

export interface NullableNumberInputProps {
	/** Current value - null represents empty/unset */
	value: number | null;
	/** Callback when value changes (after validation on blur) */
	onChange: (value: number | null) => void;
	/** Placeholder text when input is empty */
	placeholder?: string;
	/** Minimum allowed value */
	min?: number;
	/** Maximum allowed value */
	max?: number;
	/** Step increment for keyboard navigation */
	step?: number | string;
	/** Label used for error toast context (e.g., "Fixed Size") */
	label?: string;
	/** Additional className */
	className?: string;
	/** Input ID for label association */
	id?: string;
	/** Disabled state */
	disabled?: boolean;
	/** data-testid for testing */
	"data-testid"?: string;
}

/**
 * A number input component that properly handles edge cases:
 * - Allows typing 0 without it being cleared
 * - Allows negative numbers
 * - Allows completely empty input (represents null)
 * - Validates and converts to number on blur (not on every keystroke)
 *
 * Uses internal string state while typing for intuitive editing.
 */
export function NullableNumberInput({
	value,
	onChange,
	placeholder,
	min,
	max,
	step,
	label,
	className,
	id,
	disabled,
	"data-testid": testId,
}: NullableNumberInputProps) {
	// Internal string state for typing - allows intermediate states like "" or "-" or "."
	const [inputValue, setInputValue] = useState<string>(
		value !== null ? String(value) : "",
	);

	// Track the last valid value for reverting on error
	const lastValidValueRef = useRef<number | null>(value);

	// Sync internal state when external value changes (e.g., from form reset)
	// Only sync if the external value actually changed from what we're tracking
	const lastExternalValueRef = useRef<number | null>(value);
	if (value !== lastExternalValueRef.current) {
		lastExternalValueRef.current = value;
		lastValidValueRef.current = value;
		setInputValue(value !== null ? String(value) : "");
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		// Allow any input while typing - validation happens on blur
		setInputValue(e.target.value);
	};

	const handleBlur = () => {
		const trimmed = inputValue.trim();

		// Empty input = null (clearing the field)
		if (trimmed === "") {
			lastValidValueRef.current = null;
			onChange(null);
			return;
		}

		// Try to parse as number
		const parsed = Number(trimmed);

		// Check if it's a valid number
		if (Number.isNaN(parsed)) {
			toast.error(
				label ? `${label}: Invalid number` : "Please enter a valid number",
			);
			// Revert to last valid value
			setInputValue(
				lastValidValueRef.current !== null
					? String(lastValidValueRef.current)
					: "",
			);
			return;
		}

		// Check min constraint
		if (min !== undefined && parsed < min) {
			toast.error(
				label
					? `${label}: Must be at least ${min}`
					: `Value must be at least ${min}`,
			);
			// Revert to last valid value
			setInputValue(
				lastValidValueRef.current !== null
					? String(lastValidValueRef.current)
					: "",
			);
			return;
		}

		// Check max constraint
		if (max !== undefined && parsed > max) {
			toast.error(
				label
					? `${label}: Must be at most ${max}`
					: `Value must be at most ${max}`,
			);
			// Revert to last valid value
			setInputValue(
				lastValidValueRef.current !== null
					? String(lastValidValueRef.current)
					: "",
			);
			return;
		}

		// Valid number - update
		lastValidValueRef.current = parsed;
		// Normalize the displayed value (e.g., "00" -> "0", ".5" -> "0.5")
		setInputValue(String(parsed));
		onChange(parsed);
	};

	return (
		<input
			className={cn(
				"h-9 w-full min-w-0 rounded border border-white/10 bg-white/2 px-3 py-1 font-mono text-base outline-none transition-all selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				// Hide number input spinners
				"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
				className,
			)}
			data-slot="input"
			data-testid={testId}
			disabled={disabled}
			id={id}
			inputMode="decimal"
			onBlur={handleBlur}
			onChange={handleChange}
			placeholder={placeholder}
			step={step}
			type="text"
			value={inputValue}
		/>
	);
}
