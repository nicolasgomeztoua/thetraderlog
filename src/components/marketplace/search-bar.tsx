"use client";

import { Search, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
	/** Current search value */
	value: string;
	/** Callback when search value changes (debounced) */
	onChange: (value: string) => void;
	/** Callback when clear button is clicked */
	onClear?: () => void;
	/** Placeholder text */
	placeholder?: string;
	/** Additional class names */
	className?: string;
}

/**
 * Search bar component for the marketplace.
 *
 * Features:
 * - Search icon on left
 * - Debounced search (300ms delay)
 * - Clear button (X) when text present
 * - Keyboard shortcut: '/' to focus (when not in input)
 * - Terminal design: dark input, chartreuse focus ring
 *
 * Props:
 * - value: Current search value
 * - onChange: Callback when search value changes (debounced)
 * - onClear: Optional callback when clear button is clicked
 * - placeholder: Optional placeholder text (default: "Search strategies... (press /)")
 * - className: Optional additional CSS classes
 */
export function SearchBar({
	value,
	onChange,
	onClear,
	placeholder = "Search strategies... (press /)",
	className,
}: SearchBarProps) {
	const [localValue, setLocalValue] = useState(value);

	// Sync with external value
	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	// Debounced search (300ms delay)
	useEffect(() => {
		const timer = setTimeout(() => {
			if (localValue !== value) {
				onChange(localValue);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [localValue, value, onChange]);

	// Keyboard shortcut: '/' to focus search (when not in input)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only trigger if not in an input/textarea
			const target = e.target as HTMLElement;
			const isInput =
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable;

			if (e.key === "/" && !isInput) {
				e.preventDefault();
				const input = document.querySelector(
					'[data-testid="marketplace-search-input"]',
				) as HTMLInputElement;
				input?.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleClear = () => {
		setLocalValue("");
		onChange("");
		onClear?.();
	};

	return (
		<div
			className={`relative w-full max-w-xl ${className ?? ""}`}
			data-testid="marketplace-search"
		>
			<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
			<Input
				className="h-11 bg-input pr-10 pl-10 font-mono placeholder:font-mono focus-visible:ring-primary"
				data-testid="marketplace-search-input"
				onChange={(e) => setLocalValue(e.target.value)}
				placeholder={placeholder}
				value={localValue}
			/>
			{localValue && (
				<button
					className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground transition-colors hover:text-foreground"
					data-testid="marketplace-search-clear"
					onClick={handleClear}
					type="button"
				>
					<XIcon className="h-4 w-4" />
				</button>
			)}
		</div>
	);
}
