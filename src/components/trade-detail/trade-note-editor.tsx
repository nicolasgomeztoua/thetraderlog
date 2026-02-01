"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef } from "react";

import { useImageUpload } from "@/hooks/use-image-upload";
import { useTiptapImageHandlers } from "@/hooks/use-tiptap-image-handlers";
import { cn } from "@/lib/shared";
import { transformHtmlToS3Keys } from "@/lib/storage/s3";

// =============================================================================
// TYPES
// =============================================================================

interface TradeNoteEditorProps {
	/** Current note content (HTML string or null) */
	value: string | null;
	/** Callback when content changes */
	onChange: (value: string | null) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// EXTENSIONS
// =============================================================================

const EDITOR_EXTENSIONS = [
	StarterKit.configure({
		heading: { levels: [1, 2, 3] },
	}),
	Link.configure({
		openOnClick: false,
		HTMLAttributes: {
			class: "text-primary underline underline-offset-4 hover:text-primary/80",
		},
	}),
	Image.configure({
		HTMLAttributes: { class: "max-w-full h-auto rounded my-4" },
	}),
	Placeholder.configure({
		placeholder: "Add notes about this trade... (paste images with Ctrl+V)",
		emptyEditorClass:
			"before:content-[attr(data-placeholder)] before:text-muted-foreground/50 before:float-left before:h-0 before:pointer-events-none",
	}),
];

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Minimal rich text editor for trade notes.
 * Supports paste/drop images, auto-saves on blur or after 500ms debounce.
 * No toolbar - uses formatting via keyboard shortcuts.
 */
export function TradeNoteEditor({
	value,
	onChange,
	className,
}: TradeNoteEditorProps) {
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSavedContentRef = useRef<string | null>(null);
	const isInitializedRef = useRef(false);

	// Image upload hook
	const { uploadImage } = useImageUpload({ context: "trade-notes" });

	// Initialize Tiptap editor
	const editor = useEditor({
		extensions: EDITOR_EXTENSIONS,
		editorProps: {
			attributes: {
				class:
					"min-h-[120px] px-3 py-2 focus:outline-none prose prose-sm prose-invert max-w-none",
			},
		},
		onUpdate: ({ editor }) => {
			// Debounced auto-save
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			debounceTimerRef.current = setTimeout(() => {
				// Get content at save time to ensure we have latest
				const rawContent = editor.getHTML();

				// Don't save while blob URLs are present (upload in progress)
				if (rawContent.includes("blob:")) {
					return;
				}

				// Transform presigned URLs to S3 keys before saving
				const content = transformHtmlToS3Keys(rawContent) ?? rawContent;

				// Don't save if content hasn't changed from last save
				if (content === lastSavedContentRef.current) {
					return;
				}

				lastSavedContentRef.current = content;
				// Convert empty editor to null
				const normalizedContent = content === "<p></p>" ? null : content;
				onChange(normalizedContent);
			}, 500);
		},
		onBlur: ({ editor }) => {
			// Save immediately on blur (cancel pending debounce)
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}

			const rawContent = editor.getHTML();

			// Don't save while blob URLs are present (upload in progress)
			if (rawContent.includes("blob:")) {
				return;
			}

			// Transform presigned URLs to S3 keys before saving
			const content = transformHtmlToS3Keys(rawContent) ?? rawContent;

			// Don't save if content hasn't changed from last save
			if (content === lastSavedContentRef.current) {
				return;
			}

			lastSavedContentRef.current = content;
			// Convert empty editor to null
			const normalizedContent = content === "<p></p>" ? null : content;
			onChange(normalizedContent);
		},
		immediatelyRender: false,
	});

	// Attach image paste/drop handlers
	useTiptapImageHandlers({ editor, uploadImage });

	// Load initial content when editor is ready
	useEffect(() => {
		if (!editor || isInitializedRef.current) return;

		// Set initial content
		const content = value ?? "";
		editor.commands.setContent(content);
		lastSavedContentRef.current = content || "<p></p>";
		isInitializedRef.current = true;
	}, [editor, value]);

	// Reset editor when value changes externally (e.g., switching trades)
	const handleExternalValueChange = useCallback(
		(newValue: string | null) => {
			if (!editor) return;

			const currentContent = editor.getHTML();
			const normalizedCurrent =
				currentContent === "<p></p>" ? null : currentContent;
			const normalizedNew = newValue ?? null;

			// Only update if the external value is different from current editor content
			// This prevents cursor jumping when the user is typing
			if (normalizedCurrent !== normalizedNew) {
				editor.commands.setContent(newValue ?? "");
				lastSavedContentRef.current = newValue ?? "<p></p>";
			}
		},
		[editor],
	);

	// Watch for external value changes (but not from our own updates)
	useEffect(() => {
		// Skip if this is from our own update
		if (lastSavedContentRef.current === value) return;
		if (lastSavedContentRef.current === "<p></p>" && value === null) return;

		handleExternalValueChange(value);
	}, [value, handleExternalValueChange]);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	return (
		<div
			className={cn(
				"flex min-h-0 flex-col rounded border border-white/10 bg-white/1 transition-colors focus-within:border-primary/50",
				className,
			)}
		>
			<EditorContent className="min-h-0 flex-1 overflow-y-auto" editor={editor} />
		</div>
	);
}
