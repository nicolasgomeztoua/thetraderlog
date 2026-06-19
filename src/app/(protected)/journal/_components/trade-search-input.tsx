"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface TradeSearchInputProps {
	/** Stable callback fired with the debounced value (300ms). */
	onDebouncedChange: (value: string) => void;
	placeholder?: string;
}

/**
 * Search box that owns its own input state and 300ms debounce. Keystrokes
 * re-render only this small component instead of the whole journal page; the
 * parent is notified at most once per debounce window via onDebouncedChange.
 *
 * To clear it, remount with a changed `key` (the parent does this on
 * "clear filters").
 */
export function TradeSearchInput({
	onDebouncedChange,
	placeholder = "Search symbol, setup, notes...",
}: TradeSearchInputProps) {
	const [value, setValue] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => {
			onDebouncedChange(value);
		}, 300);
		return () => clearTimeout(timer);
	}, [value, onDebouncedChange]);

	return (
		<div className="relative flex-1">
			<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
			<Input
				className="pl-9 font-mono text-xs"
				onChange={(e) => setValue(e.target.value)}
				placeholder={placeholder}
				value={value}
			/>
		</div>
	);
}
