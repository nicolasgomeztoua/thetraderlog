"use client";

import { ImagePlus, Loader2, Send, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/** A chart image attached to the next chat message (mirrors chat-interface state). */
export interface PendingAttachment {
	id: string;
	previewUrl: string;
	status: "uploading" | "done" | "error";
	key?: string;
	mimeType: string;
	filename: string;
	size: number;
}

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onStop?: () => void;
	disabled?: boolean;
	isLoading?: boolean;
	/** Images queued for the next message. */
	attachments?: PendingAttachment[];
	/** Add image files (paste/drop/file-picker). */
	onAddFiles?: (files: File[]) => void;
	/** Remove a queued attachment by id. */
	onRemoveAttachment?: (id: string) => void;
	/** Whether more images can be attached (under the per-message cap). */
	canAttach?: boolean;
}

const CHAR_WARN_THRESHOLD = 500;
const CHAR_DANGER_THRESHOLD = 4000;

function extractImageFiles(items: DataTransferItemList | null): File[] {
	if (!items) return [];
	const files: File[] = [];
	for (const item of Array.from(items)) {
		if (item.kind === "file" && item.type.startsWith("image/")) {
			const file = item.getAsFile();
			if (file) files.push(file);
		}
	}
	return files;
}

export function ChatInput({
	value,
	onChange,
	onSubmit,
	onStop,
	disabled,
	isLoading,
	attachments = [],
	onAddFiles,
	onRemoveAttachment,
	canAttach = true,
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isFocused, setIsFocused] = useState(false);
	const [isDragging, setIsDragging] = useState(false);

	const hasUploading = attachments.some((a) => a.status === "uploading");
	const hasReadyAttachment = attachments.some((a) => a.status === "done");
	const canSubmit =
		(value.trim().length > 0 || hasReadyAttachment) && !hasUploading;

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
		if (!canSubmit || disabled || isLoading) return;
		onSubmit();
		resetHeight();
	}, [canSubmit, disabled, isLoading, onSubmit, resetHeight]);

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

	const handlePaste = useCallback(
		(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
			if (!onAddFiles || !canAttach) return;
			const images = extractImageFiles(e.clipboardData.items);
			if (images.length > 0) {
				// Keep default text-paste behavior only when there's no image.
				e.preventDefault();
				onAddFiles(images);
			}
		},
		[onAddFiles, canAttach],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			if (!onAddFiles || !canAttach) return;
			const images = extractImageFiles(e.dataTransfer.items);
			if (images.length > 0) onAddFiles(images);
		},
		[onAddFiles, canAttach],
	);

	const handleFilePick = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files ? Array.from(e.target.files) : [];
			if (files.length > 0) onAddFiles?.(files);
			// Reset so the same file can be re-selected later.
			e.target.value = "";
		},
		[onAddFiles],
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
			{/* Attachment thumbnail chips */}
			{attachments.length > 0 && (
				<div
					className="mb-1.5 flex flex-wrap gap-1.5"
					data-testid="chat-attachment-chips"
				>
					{attachments.map((att) => (
						<div
							className="group relative h-14 w-14 overflow-hidden rounded border border-accent/30 bg-white/[0.02]"
							key={att.id}
							title={att.filename}
						>
							{/* biome-ignore lint/performance/noImgElement: transient blob/presigned preview */}
							<img
								alt={att.filename}
								className={`h-full w-full object-cover ${att.status === "error" ? "opacity-40" : ""}`}
								src={att.previewUrl}
							/>
							{att.status === "uploading" && (
								<div className="absolute inset-0 flex items-center justify-center bg-background/60">
									<Loader2 className="h-4 w-4 animate-spin text-accent" />
								</div>
							)}
							{att.status === "error" && (
								<div className="absolute inset-0 flex items-center justify-center bg-loss/20">
									<X className="h-4 w-4 text-loss" />
								</div>
							)}
							<button
								aria-label="Remove image"
								className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
								onClick={() => onRemoveAttachment?.(att.id)}
								type="button"
							>
								<X className="h-2.5 w-2.5" />
							</button>
						</div>
					))}
				</div>
			)}

			<form
				className={`flex items-end gap-0 rounded border p-1.5 transition-colors ${
					isDragging
						? "border-accent/60 bg-accent/5"
						: isLoading
							? "animate-pulse border-accent/30"
							: isFocused
								? "border-primary/40 bg-white/[0.02]"
								: "border-white/10 bg-white/[0.02]"
				}`}
				data-testid="chat-input-form"
				onDragLeave={() => setIsDragging(false)}
				onDragOver={(e) => {
					e.preventDefault();
					if (onAddFiles && canAttach) setIsDragging(true);
				}}
				onDrop={handleDrop}
				onSubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				{/* Attach image button */}
				<button
					aria-label="Attach chart screenshot"
					className="flex items-center justify-center rounded p-2 text-muted-foreground transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
					data-testid="chat-attach-button"
					disabled={disabled || !canAttach}
					onClick={() => fileInputRef.current?.click()}
					type="button"
				>
					<ImagePlus className="h-3.5 w-3.5" />
				</button>
				<input
					accept="image/png,image/jpeg,image/webp"
					className="hidden"
					multiple
					onChange={handleFilePick}
					ref={fileInputRef}
					type="file"
				/>

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
					onPaste={handlePaste}
					placeholder="Ask about your trades, or paste a chart to log a trade..."
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
						disabled={disabled || !canSubmit}
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
