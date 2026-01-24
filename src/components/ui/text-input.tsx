import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/shared";

interface TextInputProps {
	value: string | null;
	onChange: (value: string | null) => void;
	placeholder?: string;
	required?: boolean;
	error?: string;
	label?: string;
	className?: string;
	inputClassName?: string;
	disabled?: boolean;
}

export function TextInput({
	value,
	onChange,
	placeholder = "—",
	required = false,
	error,
	label,
	className,
	inputClassName,
	disabled = false,
}: TextInputProps) {
	const id = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [localValue, setLocalValue] = useState(value ?? "");
	const [isFocused, setIsFocused] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const initialValueRef = useRef(value);

	// Sync with external value changes when not focused
	useEffect(() => {
		if (!isFocused) {
			setLocalValue(value ?? "");
			initialValueRef.current = value;
			setHasError(false);
			setErrorMessage(null);
		}
	}, [value, isFocused]);

	// Sync external error prop
	useEffect(() => {
		if (error) {
			setHasError(true);
			setErrorMessage(error);
		}
	}, [error]);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		setLocalValue(e.target.value);
		// Clear error on typing
		if (hasError) {
			setHasError(false);
			setErrorMessage(null);
		}
	}

	function handleBlur() {
		setIsFocused(false);

		const trimmed = localValue.trim();
		// Convert empty string to null
		const finalValue = trimmed === "" ? null : trimmed;

		// Validate required
		if (required && finalValue === null) {
			setHasError(true);
			setErrorMessage("This field is required");
			return;
		}

		setHasError(false);
		setErrorMessage(null);

		// Only call onChange if value actually changed
		if (finalValue !== initialValueRef.current) {
			onChange(finalValue);
			initialValueRef.current = finalValue;
		}

		// Update local display with trimmed value
		setLocalValue(finalValue ?? "");
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			inputRef.current?.blur();
		} else if (e.key === "Escape") {
			// Restore original value and blur
			setLocalValue(initialValueRef.current ?? "");
			setHasError(false);
			setErrorMessage(null);
			inputRef.current?.blur();
		}
	}

	function handleFocus() {
		setIsFocused(true);
	}

	const showError = hasError || !!error;
	const displayError = errorMessage || error;

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
			<input
				aria-invalid={showError}
				className={cn(
					"h-9 w-full min-w-0 rounded border bg-white/2 px-3 py-1 font-mono text-base outline-none transition-all md:text-sm",
					"border-white/10 placeholder:text-muted-foreground/50",
					"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
					"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
					"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
					inputClassName,
				)}
				disabled={disabled}
				id={id}
				onBlur={handleBlur}
				onChange={handleChange}
				onFocus={handleFocus}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				ref={inputRef}
				type="text"
				value={localValue}
			/>
			{showError && displayError && (
				<p className="font-mono text-[10px] text-destructive">{displayError}</p>
			)}
		</div>
	);
}
