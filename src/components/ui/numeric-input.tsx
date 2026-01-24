import * as React from "react";

import { cn } from "@/lib/shared";

export interface NumericInputProps
	extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
	/** Current numeric value (undefined for empty) */
	value: number | undefined;
	/** Called when value changes */
	onChange: (value: number | undefined) => void;
	/** Minimum allowed value */
	min?: number;
	/** Maximum allowed value */
	max?: number;
	/** Step increment for keyboard arrows */
	step?: number;
	/** Allow decimal values */
	allowDecimals?: boolean;
	/** Number of decimal places to allow (default: 2) */
	decimalPlaces?: number;
	/** Test ID for E2E testing */
	"data-testid"?: string;
}

/**
 * Numeric input component that handles empty values gracefully.
 *
 * Unlike controlled number inputs, this component:
 * - Manages string state internally for better UX
 * - Allows clearing to empty (maps to undefined, not 0)
 * - Validates numeric input on the fly
 * - Supports min/max/step constraints
 *
 * @example
 * const [value, setValue] = useState<number | undefined>(undefined);
 * <NumericInput
 *   value={value}
 *   onChange={setValue}
 *   placeholder="Enter amount"
 *   min={0}
 *   step={0.01}
 * />
 */
function NumericInput({
	value,
	onChange,
	min,
	max,
	step = 1,
	allowDecimals = true,
	decimalPlaces = 2,
	className,
	placeholder,
	"data-testid": testId,
	...props
}: NumericInputProps) {
	// Internal string state for controlled input behavior
	const [internalValue, setInternalValue] = React.useState<string>(
		value !== undefined ? String(value) : "",
	);
	// Track focus to avoid sync during editing
	const [isFocused, setIsFocused] = React.useState(false);

	// Sync internal state when external value changes (only when not focused)
	React.useEffect(() => {
		// Skip sync while user is actively editing
		if (isFocused) return;

		const externalStr = value !== undefined ? String(value) : "";
		// Only update if the parsed value is different
		// This prevents cursor jumps when user is typing
		const internalParsed = parseFloat(internalValue);
		const externalParsed = value ?? Number.NaN;
		if (
			Number.isNaN(internalParsed) !== Number.isNaN(externalParsed) ||
			(!Number.isNaN(internalParsed) && internalParsed !== externalParsed)
		) {
			setInternalValue(externalStr);
		}
	}, [value, internalValue, isFocused]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const rawValue = e.target.value;

		// Allow empty
		if (rawValue === "") {
			setInternalValue("");
			onChange(undefined);
			return;
		}

		// Allow single minus sign while typing
		if (rawValue === "-") {
			setInternalValue("-");
			return;
		}

		// Allow partial decimal input (e.g., "1." while typing "1.5")
		if (allowDecimals && rawValue.match(/^-?\d*\.$/)) {
			setInternalValue(rawValue);
			return;
		}

		// Validate numeric pattern
		const pattern = allowDecimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
		if (!pattern.test(rawValue)) {
			return;
		}

		// Limit decimal places
		if (allowDecimals) {
			const parts = rawValue.split(".");
			if (parts[1] && parts[1].length > decimalPlaces) {
				return;
			}
		}

		const parsed = parseFloat(rawValue);

		if (Number.isNaN(parsed)) {
			setInternalValue(rawValue);
			return;
		}

		// Clamp to min/max
		let clampedValue = parsed;
		if (min !== undefined && parsed < min) {
			clampedValue = min;
		}
		if (max !== undefined && parsed > max) {
			clampedValue = max;
		}

		// Only clamp on actual values, not while typing
		// This allows typing values that temporarily exceed bounds
		setInternalValue(rawValue);
		onChange(clampedValue);
	};

	const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		setIsFocused(true);
		props.onFocus?.(e);
	};

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		setIsFocused(false);

		// On blur, clean up the display value
		if (value !== undefined) {
			// Format to proper decimal places if needed
			const formatted = allowDecimals
				? String(value)
				: String(Math.round(value));
			setInternalValue(formatted);
		} else {
			setInternalValue("");
		}

		// Call original onBlur if provided
		props.onBlur?.(e);
	};

	return (
		<input
			className={cn(
				"h-9 w-full min-w-0 rounded border border-white/10 bg-white/2 px-3 py-1 text-base outline-none transition-all selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				// Hide number input spinners
				"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
				className,
			)}
			data-slot="input"
			data-testid={testId}
			inputMode={allowDecimals ? "decimal" : "numeric"}
			onBlur={handleBlur}
			onChange={handleChange}
			onFocus={handleFocus}
			placeholder={placeholder}
			step={step}
			type="text"
			value={internalValue}
			{...props}
		/>
	);
}

export { NumericInput };
