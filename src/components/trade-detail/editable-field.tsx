import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatValue(val: string | number | null | undefined): string {
	if (val === null || val === undefined || val === "") return "";
	if (typeof val === "number") {
		// Format numbers cleanly - remove trailing zeros after decimal
		const formatted = val.toFixed(8);
		return parseFloat(formatted).toString();
	}
	// For string numbers, clean them up
	const num = parseFloat(String(val));
	if (!Number.isNaN(num)) {
		return parseFloat(num.toFixed(8)).toString();
	}
	return String(val);
}

// =============================================================================
// EDITABLE FIELD - Always-visible input with focus glow
// =============================================================================

interface EditableFieldProps {
	value: string | number | null | undefined;
	onChange: (value: string) => void;
	label?: string;
	placeholder?: string;
	prefix?: string;
	suffix?: string;
	type?: "text" | "number";
	align?: "left" | "right";
	className?: string;
	inputClassName?: string;
	disabled?: boolean;
}

export function EditableField({
	value,
	onChange,
	label,
	placeholder = "—",
	prefix,
	suffix,
	type = "text",
	align = "left",
	className,
	inputClassName,
	disabled = false,
}: EditableFieldProps) {
	const id = useId();
	const [localValue, setLocalValue] = useState(() => formatValue(value));
	const [isFocused, setIsFocused] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const initialValueRef = useRef(formatValue(value));

	// Sync with external value changes
	useEffect(() => {
		if (!isFocused) {
			setLocalValue(formatValue(value));
			initialValueRef.current = formatValue(value);
		}
	}, [value, isFocused]);

	function handleBlur() {
		setIsFocused(false);
		const trimmed = localValue.trim();
		if (trimmed !== initialValueRef.current) {
			onChange(trimmed);
			initialValueRef.current = trimmed;
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			inputRef.current?.blur();
		} else if (e.key === "Escape") {
			setLocalValue(initialValueRef.current);
			inputRef.current?.blur();
		}
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const val = e.target.value;
		if (type === "number") {
			// Allow empty, numbers, one decimal point, and negative
			if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
				setLocalValue(val);
			}
		} else {
			setLocalValue(val);
		}
	}

	function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
		if (type !== "number") return;

		const pastedText = e.clipboardData.getData("text");
		// Strip currency symbols, commas, and whitespace from pasted values
		const cleanedValue = pastedText.replace(/[$€£¥₹,\s]/g, "").trim();

		// Check if the cleaned value is a valid number
		if (/^-?\d*\.?\d*$/.test(cleanedValue) && cleanedValue !== "") {
			e.preventDefault();
			setLocalValue(cleanedValue);
		}
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
				{prefix && (
					<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 font-mono text-muted-foreground/60 text-sm">
						{prefix}
					</span>
				)}
				<input
					className={cn(
						"h-10 w-full rounded-sm border px-3 font-mono text-sm transition-all",
						"border-white/10 bg-white/[0.03] placeholder:text-muted-foreground/40",
						"hover:border-white/20 hover:bg-white/[0.05]",
						"focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-primary/30",
						"disabled:cursor-not-allowed disabled:opacity-50",
						align === "right" && "text-right",
						prefix && "pl-8",
						suffix && "pr-10",
						inputClassName,
					)}
					disabled={disabled}
					id={id}
					inputMode={type === "number" ? "decimal" : "text"}
					onBlur={handleBlur}
					onChange={handleChange}
					onFocus={() => setIsFocused(true)}
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
		</div>
	);
}

// =============================================================================
// EDITABLE TEXTAREA - For notes and longer text
// =============================================================================

interface EditableTextareaProps {
	value: string | null | undefined;
	onChange: (value: string) => void;
	label?: string;
	placeholder?: string;
	className?: string;
	rows?: number;
}

export function EditableTextarea({
	value,
	onChange,
	label,
	placeholder = "Click to add notes...",
	className,
	rows = 4,
}: EditableTextareaProps) {
	const id = useId();
	const [localValue, setLocalValue] = useState(value ?? "");
	const [isFocused, setIsFocused] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const initialValueRef = useRef(value ?? "");

	useEffect(() => {
		if (!isFocused) {
			setLocalValue(value ?? "");
			initialValueRef.current = value ?? "";
		}
	}, [value, isFocused]);

	function handleBlur() {
		setIsFocused(false);
		if (localValue !== initialValueRef.current) {
			onChange(localValue);
			initialValueRef.current = localValue;
		}
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
			<textarea
				className={cn(
					"w-full resize-none rounded-sm border px-3 py-3 font-mono text-sm transition-all",
					"border-white/10 bg-white/[0.03] placeholder:text-muted-foreground/40",
					"hover:border-white/20 hover:bg-white/[0.05]",
					"focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-primary/30",
				)}
				id={id}
				onBlur={handleBlur}
				onChange={(e) => setLocalValue(e.target.value)}
				onFocus={() => setIsFocused(true)}
				placeholder={placeholder}
				ref={textareaRef}
				rows={rows}
				value={localValue}
			/>
		</div>
	);
}

// =============================================================================
// EDITABLE SELECT - Dropdown that looks like an input
// =============================================================================

interface EditableSelectProps {
	value: string | null | undefined;
	onChange: (value: string) => void;
	options: { value: string; label: string; color?: string }[];
	label?: string;
	placeholder?: string;
	className?: string;
	allowClear?: boolean;
}

export function EditableSelect({
	value,
	onChange,
	options,
	label,
	placeholder = "Select...",
	className,
	allowClear = true,
}: EditableSelectProps) {
	const id = useId();
	const selectedOption = options.find((o) => o.value === value);

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
			<select
				className={cn(
					"h-10 w-full cursor-pointer appearance-none rounded-sm border px-3 pr-8 font-mono text-sm transition-all",
					"border-white/10 bg-white/[0.03]",
					"hover:border-white/20 hover:bg-white/[0.05]",
					"focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-primary/30",
					!value && "text-muted-foreground/40",
					selectedOption?.color,
				)}
				id={id}
				onChange={(e) => onChange(e.target.value)}
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
					backgroundRepeat: "no-repeat",
					backgroundPosition: "right 0.75rem center",
				}}
				value={value ?? ""}
			>
				{allowClear && <option value="">{placeholder}</option>}
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	);
}
