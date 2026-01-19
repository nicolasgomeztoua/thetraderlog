"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/shared";

export interface NumberInputProps
	extends Omit<
		React.InputHTMLAttributes<HTMLInputElement>,
		"value" | "onChange" | "type"
	> {
	/** The controlled value. Can be number, null (for optional empty), or undefined */
	value: number | null | undefined;
	/** Called when the value changes. Returns number or null (for empty optional fields) */
	onChange: (value: number | null) => void;
	/** Minimum allowed value */
	min?: number;
	/** Maximum allowed value */
	max?: number;
	/** Step increment for arrow keys */
	step?: number;
	/** Decimal precision for rounding (e.g., 2 for two decimal places) */
	precision?: number;
	/** Whether the field is required (prevents null on empty) */
	required?: boolean;
	/** Text prefix displayed inside the input (e.g., "$") */
	prefix?: string;
	/** Text suffix displayed inside the input (e.g., "%") */
	suffix?: string;
}

/**
 * NumberInput - A controlled number input that correctly handles:
 * - Zero values (stored as 0, not undefined)
 * - Empty states (null for optional, validation error for required)
 * - Intermediate typing states ("0.", "-", ".") without errors
 * - Paste with currency symbol stripping
 * - Min/max validation on blur
 */
const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
	(
		{
			value,
			onChange,
			min,
			max,
			step = 1,
			precision,
			required = false,
			prefix,
			suffix,
			className,
			placeholder,
			disabled,
			onBlur,
			onFocus,
			...props
		},
		ref,
	) => {
		// Track whether the input is focused
		const [isFocused, setIsFocused] = useState(false);
		// Local string state for typing
		const [localValue, setLocalValue] = useState<string>(() =>
			formatValue(value, precision),
		);
		// Track if user has modified the input
		const hasModifiedRef = useRef(false);

		// Sync external value to local state ONLY when not focused
		useEffect(() => {
			if (!isFocused) {
				setLocalValue(formatValue(value, precision));
			}
		}, [value, precision, isFocused]);

		const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
			setIsFocused(true);
			hasModifiedRef.current = false;
			onFocus?.(e);
		};

		const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
			setIsFocused(false);

			// Parse and validate the final value
			const trimmed = localValue.trim();

			// Empty input
			if (trimmed === "" || trimmed === "-" || trimmed === ".") {
				if (required) {
					toast.error("This field is required");
					// Keep the previous value
					setLocalValue(formatValue(value, precision));
				} else {
					onChange(null);
					setLocalValue("");
				}
				onBlur?.(e);
				return;
			}

			const parsed = Number.parseFloat(trimmed);

			if (Number.isNaN(parsed)) {
				toast.error("Please enter a valid number");
				setLocalValue(formatValue(value, precision));
				onBlur?.(e);
				return;
			}

			// Validate min/max
			if (min !== undefined && parsed < min) {
				toast.error(`Value must be at least ${min}`);
				const clamped = min;
				onChange(roundToPrecision(clamped, precision));
				setLocalValue(formatValue(clamped, precision));
				onBlur?.(e);
				return;
			}

			if (max !== undefined && parsed > max) {
				toast.error(`Value must be at most ${max}`);
				const clamped = max;
				onChange(roundToPrecision(clamped, precision));
				setLocalValue(formatValue(clamped, precision));
				onBlur?.(e);
				return;
			}

			// Apply precision and update
			const rounded = roundToPrecision(parsed, precision);
			onChange(rounded);
			setLocalValue(formatValue(rounded, precision));
			onBlur?.(e);
		};

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			hasModifiedRef.current = true;
			const raw = e.target.value;

			// Allow intermediate typing states
			if (isValidIntermediateValue(raw)) {
				setLocalValue(raw);
				return;
			}

			// Try to parse and update immediately for valid numbers
			const parsed = Number.parseFloat(raw);
			if (!Number.isNaN(parsed)) {
				setLocalValue(raw);
				// Update parent with current value (will be validated on blur)
				onChange(roundToPrecision(parsed, precision));
			}
		};

		const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
			const pasted = e.clipboardData.getData("text");

			// Strip common currency symbols and formatting
			const cleaned = pasted
				.replace(/[$€£¥₹,\s]/g, "")
				.replace(/^\((.+)\)$/, "-$1"); // Handle (123) as negative

			// If cleaning changed the value, prevent default and insert cleaned
			if (cleaned !== pasted) {
				e.preventDefault();
				const input = e.currentTarget;
				const start = input.selectionStart ?? 0;
				const end = input.selectionEnd ?? 0;
				const newValue =
					localValue.slice(0, start) + cleaned + localValue.slice(end);
				setLocalValue(newValue);

				// Trigger change handling
				const parsed = Number.parseFloat(newValue);
				if (!Number.isNaN(parsed)) {
					onChange(roundToPrecision(parsed, precision));
				}

				// Set cursor position after paste
				requestAnimationFrame(() => {
					input.setSelectionRange(
						start + cleaned.length,
						start + cleaned.length,
					);
				});
			}
		};

		const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
			// Arrow key increments
			if (e.key === "ArrowUp" || e.key === "ArrowDown") {
				e.preventDefault();
				const current = Number.parseFloat(localValue) || 0;
				const delta = e.key === "ArrowUp" ? step : -step;
				let newValue = current + delta;

				// Clamp to min/max
				if (min !== undefined && newValue < min) newValue = min;
				if (max !== undefined && newValue > max) newValue = max;

				const rounded = roundToPrecision(newValue, precision);
				setLocalValue(formatValue(rounded, precision));
				onChange(rounded);
			}
		};

		return (
			<div className="relative">
				{prefix && (
					<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 font-mono text-muted-foreground text-sm">
						{prefix}
					</span>
				)}
				<input
					className={cn(
						"h-9 w-full min-w-0 rounded border border-white/10 bg-white/2 px-3 py-1 text-base outline-none transition-all selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
						"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
						"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
						prefix && "pl-7",
						suffix && "pr-7",
						className,
					)}
					disabled={disabled}
					inputMode="decimal"
					onBlur={handleBlur}
					onChange={handleChange}
					onFocus={handleFocus}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					placeholder={placeholder}
					ref={ref}
					type="text"
					value={localValue}
					{...props}
				/>
				{suffix && (
					<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 font-mono text-muted-foreground text-sm">
						{suffix}
					</span>
				)}
			</div>
		);
	},
);

NumberInput.displayName = "NumberInput";

/**
 * Check if a string is a valid intermediate value during typing
 * (e.g., "-", ".", "0.", "-0.") that shouldn't be validated yet
 */
function isValidIntermediateValue(value: string): boolean {
	if (value === "" || value === "-" || value === ".") return true;
	// Allow values ending with "." like "0." or "-5."
	if (/^-?\d*\.$/.test(value)) return true;
	// Allow "-0" at the start of typing a negative decimal
	if (value === "-0") return true;
	return false;
}

/**
 * Format a number value to string for display
 */
function formatValue(
	value: number | null | undefined,
	precision?: number,
): string {
	if (value === null || value === undefined) return "";
	if (precision !== undefined) {
		return value.toFixed(precision);
	}
	return String(value);
}

/**
 * Round a number to the specified precision
 */
function roundToPrecision(value: number, precision?: number): number {
	if (precision === undefined) return value;
	const multiplier = 10 ** precision;
	return Math.round(value * multiplier) / multiplier;
}

export { NumberInput };
