"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AlertCircleIcon, CheckCircleIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EditorBubbleMenu } from "@/components/daily-journal/editor-bubble-menu";
import { EditorToolbar } from "@/components/daily-journal/editor-toolbar";
import { SlashCommand } from "@/components/daily-journal/slash-command-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useImagePreloader } from "@/hooks/use-image-preloader";
import { toDateString } from "@/lib/shared";
import { transformHtmlToS3Keys } from "@/lib/storage/s3-utils";
import { api } from "@/trpc/react";

interface JournalEditorProps {
	selectedDate: Date;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const EDITOR_EXTENSIONS = [
	StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
	Link.configure({
		openOnClick: false,
		HTMLAttributes: {
			class: "text-primary underline underline-offset-4 hover:text-primary/80",
		},
	}),
	Image.configure({
		HTMLAttributes: { class: "max-w-full h-auto rounded my-4" },
	}),
	TaskList.configure({ HTMLAttributes: { class: "not-prose" } }),
	TaskItem.configure({ nested: true }),
	SlashCommand,
	Placeholder.configure({
		placeholder: "Write something, or type '/' for commands...",
		emptyEditorClass:
			"before:content-[attr(data-placeholder)] before:text-muted-foreground/50 before:float-left before:h-0 before:pointer-events-none",
	}),
];

/**
 * Rich text editor for daily journal entries.
 * Auto-saves content with 500ms debounce.
 */
export function JournalEditor({ selectedDate }: JournalEditorProps) {
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const lastSavedContentRef = useRef<string | null>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);

	// Date string for API calls - preserves the calendar date as clicked
	const dateString = toDateString(selectedDate);

	// Fetch journal data for selected date
	const { data: journal, isLoading: isLoadingJournal } =
		api.dailyJournal.getByDate.useQuery(
			{ date: dateString },
			{
				enabled: !!dateString,
				// Ensure fresh data when switching dates
				staleTime: 0,
			},
		);

	// Preload images from journal content
	const { isLoading: isLoadingImages } = useImagePreloader(
		journal?.content ?? null,
	);

	// Combined loading state - journal data and images
	const isLoading = isLoadingJournal || isLoadingImages;

	// Update content mutation
	const updateContent = api.dailyJournal.updateContent.useMutation({
		onSuccess: () => {
			setSaveStatus("saved");
			// Clear saved status after 2 seconds
			savedIndicatorTimeoutRef.current = setTimeout(() => {
				setSaveStatus("idle");
			}, 2000);
			// Note: No invalidation needed - we just saved, no need to refetch
		},
		onError: () => {
			setSaveStatus("error");
		},
	});

	// Get upload URL for images
	const getUploadUrl = api.dailyJournal.getUploadUrl.useMutation();
	const confirmUpload = api.dailyJournal.confirmUpload.useMutation();

	// Initialize Tiptap editor
	const editor = useEditor({
		extensions: EDITOR_EXTENSIONS,
		editorProps: {
			attributes: {
				class: "h-full px-4 py-3 focus:outline-none",
			},
			handleKeyDown: (_view, event) => {
				// Capture Cmd/Ctrl+B before it bubbles to app
				if ((event.metaKey || event.ctrlKey) && event.key === "b") {
					event.stopPropagation();
				}
				return false;
			},
		},
		onUpdate: ({ editor }) => {
			// Debounced auto-save
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			debounceTimerRef.current = setTimeout(() => {
				// Get content at save time (not capture time) to ensure we have latest
				const rawContent = editor.getHTML();

				// Don't save while blob URLs are present (upload in progress)
				if (rawContent.includes("blob:")) {
					return;
				}

				// Transform presigned URLs to S3 keys before saving
				// This handles images dragged from gallery (presigned URLs) and pasted images (S3 keys)
				const content = transformHtmlToS3Keys(rawContent) ?? rawContent;

				// Don't save if content hasn't changed
				if (content === lastSavedContentRef.current) {
					return;
				}

				setSaveStatus("saving");
				lastSavedContentRef.current = content;
				updateContent.mutate({
					date: dateString,
					content: content === "<p></p>" ? null : content,
				});
			}, 500);
		},
		immediatelyRender: false,
	});

	// Load content when journal data arrives (key prop handles date changes)
	useEffect(() => {
		if (!editor || !journal) return;
		const content = journal.content ?? "";
		// Use emitUpdate: false to prevent triggering onUpdate (and auto-save) during load
		editor.commands.setContent(content, { emitUpdate: false });
		lastSavedContentRef.current = content || "<p></p>";
	}, [editor, journal]);

	// Cleanup timers on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
			if (savedIndicatorTimeoutRef.current) {
				clearTimeout(savedIndicatorTimeoutRef.current);
			}
		};
	}, []);

	// Handle image upload for toolbar and paste/drop
	const handleImageUpload = useCallback(
		async (file: File): Promise<string | null> => {
			if (!journal) return null;

			const toastId = toast.loading("Uploading... 0%");

			try {
				// Get presigned upload URL
				const { presignedUrl, key } = await getUploadUrl.mutateAsync({
					date: dateString,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
				});

				toast.loading("Uploading... 10%", { id: toastId });

				// Upload file to S3 using XMLHttpRequest for progress tracking
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();

					xhr.upload.addEventListener("progress", (event) => {
						if (event.lengthComputable) {
							// Map progress: 10-90% for actual upload
							const percent =
								Math.round((event.loaded / event.total) * 80) + 10;
							toast.loading(`Uploading... ${percent}%`, { id: toastId });
						}
					});

					xhr.addEventListener("load", () => {
						if (xhr.status >= 200 && xhr.status < 300) {
							resolve();
						} else {
							reject(new Error(`Upload failed with status ${xhr.status}`));
						}
					});

					xhr.addEventListener("error", () => {
						reject(new Error("Upload failed"));
					});

					xhr.open("PUT", presignedUrl);
					xhr.setRequestHeader("Content-Type", file.type);
					xhr.send(file);
				});

				toast.loading("Processing... 95%", { id: toastId });

				// Confirm upload and get download URL
				const attachment = await confirmUpload.mutateAsync({
					journalId: journal.id,
					key,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
				});

				// Don't invalidate here - it would reset the editor content before
				// the blob URL is replaced with the final URL. The autosave will
				// handle persisting the content with the new image.

				toast.success("Image uploaded", { id: toastId });
				// Return presigned URL for display (will be converted to S3 key on save)
				return attachment.url;
			} catch (error) {
				console.error("Image upload failed:", error);
				toast.error("Upload failed", { id: toastId });
				return null;
			}
		},
		[journal, dateString, getUploadUrl, confirmUpload],
	);

	// Handle image paste/drop and insert into editor with instant preview
	const handleImageInsert = useCallback(
		async (file: File) => {
			if (!editor || !file.type.startsWith("image/")) return;

			// Create blob URL for instant preview
			const blobUrl = URL.createObjectURL(file);

			// Insert blob URL immediately for instant feedback
			editor.chain().focus().setImage({ src: blobUrl }).run();

			// Upload in background
			const finalUrl = await handleImageUpload(file);

			if (finalUrl) {
				// Preload the final image before swapping
				const img = new window.Image();
				img.src = finalUrl;
				await new Promise<void>((resolve) => {
					img.onload = () => resolve();
					img.onerror = () => resolve(); // Continue even if preload fails
				});

				// Find and replace blob URL with final URL in editor content
				const { state, view } = editor;
				const { tr } = state;
				let replaced = false;

				state.doc.descendants((node, pos) => {
					if (node.type.name === "image" && node.attrs.src === blobUrl) {
						tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: finalUrl });
						replaced = true;
						return false; // Stop searching
					}
				});

				if (replaced) {
					view.dispatch(tr);
				}
			} else {
				// Upload failed - remove the blob image from editor
				const { state, view } = editor;
				const { tr } = state;
				let nodePos = -1;

				state.doc.descendants((node, pos) => {
					if (node.type.name === "image" && node.attrs.src === blobUrl) {
						nodePos = pos;
						return false;
					}
				});

				if (nodePos >= 0) {
					tr.delete(nodePos, nodePos + 1);
					view.dispatch(tr);
				}
			}

			// Clean up blob URL
			URL.revokeObjectURL(blobUrl);
		},
		[editor, handleImageUpload],
	);

	// Handle paste event to catch clipboard images
	const handlePaste = useCallback(
		(event: ClipboardEvent) => {
			const items = event.clipboardData?.items;
			if (!items) return;

			for (const item of items) {
				if (item.type.startsWith("image/")) {
					event.preventDefault();
					const file = item.getAsFile();
					if (file) {
						handleImageInsert(file);
					}
					return;
				}
			}
		},
		[handleImageInsert],
	);

	// Handle drop event to catch dropped images (both new files and existing attachments)
	const handleDrop = useCallback(
		(event: DragEvent) => {
			if (!editor) return;

			// Check if this is an existing attachment being dragged from the gallery
			const attachmentData = event.dataTransfer?.getData(
				"application/x-attachment",
			);
			if (attachmentData) {
				try {
					const { url, isAttachment } = JSON.parse(attachmentData);
					if (isAttachment && url) {
						event.preventDefault();
						// Insert presigned URL for display (will be converted to S3 key on save)
						editor.chain().focus().setImage({ src: url }).run();
						return;
					}
				} catch {
					// Not valid attachment data, continue with file handling
				}
			}

			// Handle new file drops
			const files = event.dataTransfer?.files;
			if (!files || files.length === 0) return;

			for (const file of files) {
				if (file.type.startsWith("image/")) {
					event.preventDefault();
					handleImageInsert(file);
					return;
				}
			}
		},
		[editor, handleImageInsert],
	);

	// Attach paste and drop event listeners to editor DOM
	useEffect(() => {
		if (!editor) return;

		const editorElement = editor.view.dom;
		editorElement.addEventListener("paste", handlePaste as EventListener);
		editorElement.addEventListener("drop", handleDrop as EventListener);

		return () => {
			editorElement.removeEventListener("paste", handlePaste as EventListener);
			editorElement.removeEventListener("drop", handleDrop as EventListener);
		};
	}, [editor, handlePaste, handleDrop]);

	// Listen for slash command image insert event
	useEffect(() => {
		const handleInsertImageCommand = () => {
			imageInputRef.current?.click();
		};

		window.addEventListener(
			"journal-editor:insert-image",
			handleInsertImageCommand,
		);

		return () => {
			window.removeEventListener(
				"journal-editor:insert-image",
				handleInsertImageCommand,
			);
		};
	}, []);

	// Handle file input change for slash command image upload
	const handleFileInputChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (file) {
				handleImageInsert(file);
			}
			// Reset input so the same file can be selected again
			event.target.value = "";
		},
		[handleImageInsert],
	);

	// Show loading skeleton until journal data AND images are loaded
	if (isLoading || !journal) {
		return (
			<div className="flex min-h-0 flex-1 flex-col">
				{/* Toolbar skeleton */}
				<Skeleton className="h-10 w-full rounded-b-none" />

				{/* Editor skeleton */}
				<div className="flex min-h-0 flex-1 flex-col rounded-b border border-border border-t-0 bg-muted/30 p-4">
					<div className="space-y-3">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-4 w-1/2" />
						<Skeleton className="h-4 w-5/6" />
						{/* Image placeholder skeleton */}
						{isLoadingImages && (
							<Skeleton className="mt-4 aspect-video w-full max-w-md" />
						)}
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-4 w-4/5" />
					</div>
				</div>

				{/* Status indicator placeholder */}
				<div className="mt-2 h-5 shrink-0" />
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* Toolbar */}
			<EditorToolbar editor={editor} onImageUpload={handleImageUpload} />

			{/* Editor content */}
			<div className="flex min-h-0 flex-1 flex-col rounded-b border border-border border-t-0 bg-muted/30">
				<EditorContent
					className="min-h-0 flex-1 overflow-y-auto"
					editor={editor}
				/>
				{editor && <EditorBubbleMenu editor={editor} />}
			</div>

			{/* Save status indicator */}
			<div className="mt-2 flex h-5 shrink-0 items-center justify-end">
				{saveStatus === "saving" && (
					<div className="flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
						<Loader2Icon className="size-3 animate-spin" />
						<span>Saving...</span>
					</div>
				)}
				{saveStatus === "saved" && (
					<div className="flex items-center gap-1.5 font-mono text-profit text-xs">
						<CheckCircleIcon className="size-3" />
						<span>Saved</span>
					</div>
				)}
				{saveStatus === "error" && (
					<div className="flex items-center gap-1.5 font-mono text-loss text-xs">
						<AlertCircleIcon className="size-3" />
						<span>Failed to save</span>
					</div>
				)}
			</div>

			{/* Hidden file input for slash command image upload */}
			<input
				accept="image/*"
				className="hidden"
				onChange={handleFileInputChange}
				ref={imageInputRef}
				type="file"
			/>
		</div>
	);
}
