"use client";

import { Send } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
}

export function ChatInput({
	value,
	onChange,
	onSubmit,
	disabled,
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

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
		if (!value.trim() || disabled) return;
		onSubmit();
		resetHeight();
	}, [value, disabled, onSubmit, resetHeight]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}
		},
		[handleSubmit],
	);

	return (
		<form
			className="flex items-end gap-2 sm:gap-3"
			data-testid="chat-input-form"
			onSubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<textarea
				className="max-h-[200px] min-h-[44px] flex-1 resize-none rounded border border-border bg-transparent px-3 py-2.5 font-mono text-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
				data-testid="chat-input"
				disabled={disabled}
				onChange={(e) => {
					onChange(e.target.value);
					adjustHeight();
				}}
				onKeyDown={handleKeyDown}
				placeholder="Ask about your trading data..."
				ref={textareaRef}
				rows={1}
				value={value}
			/>
			<Button
				className="min-h-[44px] min-w-[44px] self-end font-mono text-xs uppercase tracking-wider"
				data-testid="chat-send-button"
				disabled={disabled || !value.trim()}
				size="sm"
				type="submit"
			>
				<Send className="h-3.5 w-3.5" />
			</Button>
		</form>
	);
}
