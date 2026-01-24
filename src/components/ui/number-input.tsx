import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/shared";

interface NumberInputProps {
	value: number | null;
	onChange: (value: number | null) => void;
	allowDecimals?: boolean;
	decimalPlaces?: number;
	min?: number;
	max?: number;
	placeholder?: string;
	suffix?: string;
	label?: string;
	className?: string;
	inputClassName?: string;
	disabled?: boolean;
}

function formatDisplayValue(
	value: number | null,
	decimalPlaces?: number,
): string {
	if (value === null) return "";
	if (decimalPlaces !== undefined) {
		// Format with specified decimal places, then remove trailing zeros
		const formatted = value.toFixed(decimalPlaces);
		return parseFloat(formatted).toString();
	}
	return value.toString();
}

function parseInputValue(input: string, allowDecimals: boolean): number | null {
	const trimmed = input.trim();
	if (trimmed === "" || trimmed === "-") return null;

	const num = parseFloat(trimmed);
	if (Number.isNaN(num)) return null;

	// If decimals not allowed, truncate to integer
	if (!allowDecimals) {
		return Math.trunc(num);
	}

	return num;
}

export function NumberInput({
	value,
	onChange,
	allowDecimals = true,
	decimalPlaces,
	min,
	max,
	placeholder = "—",
	suffix,
	label,
	className,
	inputClassName,
	disabled = false,
}: NumberInputProps) {
	const id = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [localValue, setLocalValue] = useState(() =>
		formatDisplayValue(value, decimalPlaces),
	);
	const [isFocused, setIsFocused] = useState(false);
	const [hasError, setHasError] = useState(false);
	const initialValueRef = useRef(value);

	// Sync with external value changes when not focused
	useEffect(() => {
		if (!isFocused) {
			setLocalValue(formatDisplayValue(value, decimalPlaces));
			initialValueRef.current = value;
			setHasError(false);
		}
	}, [value, isFocused, decimalPlaces]);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const val = e.target.value;

		// Allow empty string always
		if (val === "") {
			setLocalValue("");
			setHasError(false);
			return;
		}

		// Regex pattern: allow negative, digits, and optionally one decimal point
		const pattern = allowDecimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;

		if (pattern.test(val)) {
			setLocalValue(val);
			setHasError(false);
		}
	}

	function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
		const pastedText = e.clipboardData.getData("text");
		// Strip currency symbols, commas, and whitespace from pasted values
		const cleanedValue = pastedText.replace(/[$€£¥₹,\s]/g, "").trim();

		// Check if the cleaned value is a valid number pattern
		const pattern = allowDecimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
		if (pattern.test(cleanedValue) && cleanedValue !== "") {
			e.preventDefault();
			setLocalValue(cleanedValue);
			setHasError(false);
		}
	}

	function handleBlur() {
		setIsFocused(false);

		const parsed = parseInputValue(localValue, allowDecimals);

		// Validate min/max
		let validationError = false;
		const finalValue = parsed;

		if (parsed !== null) {
			if (min !== undefined && parsed < min) {
				validationError = true;
			}
			if (max !== undefined && parsed > max) {
				validationError = true;
			}
		}

		if (validationError) {
			setHasError(true);
			// Keep the invalid value displayed so user can see what's wrong
			return;
		}

		setHasError(false);

		// Only call onChange if value actually changed
		if (finalValue !== initialValueRef.current) {
			onChange(finalValue);
			initialValueRef.current = finalValue;
		}

		// Format display value after successful blur
		setLocalValue(formatDisplayValue(finalValue, decimalPlaces));
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			inputRef.current?.blur();
		} else if (e.key === "Escape") {
			// Restore original value and blur
			setLocalValue(formatDisplayValue(initialValueRef.current, decimalPlaces));
			setHasError(false);
			inputRef.current?.blur();
		}
	}

	function handleFocus() {
		setIsFocused(true);
	}

	return (
		<div className={cn("space-y-1.5", className)}>
			{label && (
				<label
					className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest"
					htmlFor={id}
				>
					{label}
				</label>
			)}
			<div className="relative">
				<input
					aria-invalid={hasError}
					className={cn(
						"h-9 w-full min-w-0 rounded border bg-white/2 px-3 py-1 font-mono text-base outline-none transition-all md:text-sm",
						"border-white/10 placeholder:text-muted-foreground/50",
						"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
						"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
						"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
						// Hide number input spinners (not needed since we use type="text")
						"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
						suffix && "pr-12",
						inputClassName,
					)}
					disabled={disabled}
					id={id}
					inputMode="decimal"
					onBlur={handleBlur}
					onChange={handleChange}
					onFocus={handleFocus}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					placeholder={placeholder}
					ref={inputRef}
					type="text"
					value={localValue}
				/>
				{suffix && (
					<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 font-mono text-muted-foreground/60 text-sm">
						{suffix}
					</span>
				)}
			</div>
			{hasError && (
				<p className="font-mono text-[10px] text-destructive">
					{min !== undefined && max !== undefined
						? `Value must be between ${min} and ${max}`
						: min !== undefined
							? `Value must be at least ${min}`
							: max !== undefined
								? `Value must be at most ${max}`
								: "Invalid value"}
				</p>
			)}
		</div>
	);
}
