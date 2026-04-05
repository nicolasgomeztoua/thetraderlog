"use client";

import { Send, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onStop?: () => void;
	disabled?: boolean;
	isLoading?: boolean;
}

const CHAR_WARN_THRESHOLD = 500;
const CHAR_DANGER_THRESHOLD = 4000;

export function ChatInput({
	value,
	onChange,
	onSubmit,
	onStop,
	disabled,
	isLoading,
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isFocused, setIsFocused] = useState(false);

	const adjustHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
	}, []);

	const resetHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
	}, []);

	const handleSubmit = useCallback(() => {
		if (!value.trim() || disabled || isLoading) return;
		onSubmit();
		resetHeight();
	}, [value, disabled, isLoading, onSubmit, resetHeight]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			// Enter to send (without Shift)
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}
			// Cmd/Ctrl+Enter as alternative send
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleSubmit();
			}
		},
		[handleSubmit],
	);

	// Auto-focus on mount and when loading finishes
	useEffect(() => {
		if (!isLoading) {
			textareaRef.current?.focus();
		}
	}, [isLoading]);

	// Global / shortcut to focus input
	useEffect(() => {
		const handleGlobalKey = (e: KeyboardEvent) => {
			if (
				e.key === "/" &&
				!e.metaKey &&
				!e.ctrlKey &&
				document.activeElement !== textareaRef.current
			) {
				e.preventDefault();
				textareaRef.current?.focus();
			}
		};

		window.addEventListener("keydown", handleGlobalKey);
		return () => window.removeEventListener("keydown", handleGlobalKey);
	}, []);

	const showCharCount = value.length > CHAR_WARN_THRESHOLD;
	const isOverLimit = value.length > CHAR_DANGER_THRESHOLD;

	return (
		<div>
			<form
				className={`flex items-end gap-0 rounded border p-1.5 transition-colors ${
					isLoading
						? "animate-pulse border-accent/30"
						: isFocused
							? "border-primary/40 bg-white/[0.02]"
							: "border-white/10 bg-white/[0.02]"
				}`}
				data-testid="chat-input-form"
				onSubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<textarea
					className="max-h-[200px] min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 font-mono text-sm transition-[height] duration-150 placeholder:text-muted-foreground/40 focus:outline-none"
					data-testid="chat-input"
					disabled={disabled}
					onBlur={() => setIsFocused(false)}
					onChange={(e) => {
						onChange(e.target.value);
						adjustHeight();
					}}
					onFocus={() => setIsFocused(true)}
					onKeyDown={handleKeyDown}
					placeholder="Ask about your trading data..."
					ref={textareaRef}
					rows={1}
					value={value}
				/>
				{isLoading ? (
					<button
						className="flex items-center justify-center rounded bg-loss/10 p-2 text-loss transition-colors hover:bg-loss/20"
						data-testid="chat-stop-button"
						onClick={onStop}
						type="button"
					>
						<Square className="h-3.5 w-3.5" />
					</button>
				) : (
					<button
						className="flex items-center justify-center rounded bg-primary/10 p-2 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-30"
						data-testid="chat-send-button"
						disabled={disabled || !value.trim()}
						type="submit"
					>
						<Send className="h-3.5 w-3.5" />
					</button>
				)}
			</form>

			{/* Footer: keyboard hint + character count */}
			<div className="mt-1.5 flex items-center justify-between px-1">
				<span className="hidden font-mono text-[10px] text-muted-foreground/40 sm:inline">
					Enter to send, Shift+Enter for new line
				</span>
				{showCharCount && (
					<span
						className={`font-mono text-[10px] ${isOverLimit ? "text-loss/40" : "text-muted-foreground/40"}`}
						data-testid="chat-char-count"
					>
						{value.length.toLocaleString()}
					</span>
				)}
			</div>
		</div>
	);
}
