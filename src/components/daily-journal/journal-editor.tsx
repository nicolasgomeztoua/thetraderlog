"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AlertCircleIcon, CheckCircleIcon, Loader2Icon } from "lucide-react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { EditorBubbleMenu } from "@/components/daily-journal/editor-bubble-menu";
import { EditorToolbar } from "@/components/daily-journal/editor-toolbar";
import { SlashCommand } from "@/components/daily-journal/slash-command-menu";
import { toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";

interface JournalEditorProps {
	selectedDate: Date;
}

export interface JournalEditorHandle {
	/** Remove all images with the given URL from the editor */
	removeImageByUrl: (url: string) => void;
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
export const JournalEditor = forwardRef<
	JournalEditorHandle,
	JournalEditorProps
>(function JournalEditor({ selectedDate }, ref) {
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const lastSavedContentRef = useRef<string | null>(null);

	const utils = api.useUtils();

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

			const content = editor.getHTML();

			// Don't save if content hasn't changed
			if (content === lastSavedContentRef.current) {
				return;
			}

			debounceTimerRef.current = setTimeout(() => {
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

	// Expose imperative handle for parent to remove images
	useImperativeHandle(
		ref,
		() => ({
			removeImageByUrl: (url: string) => {
				if (!editor) return;

				const { state, view } = editor;
				const { tr } = state;
				const nodesToRemove: number[] = [];

				// Find all images with this URL
				state.doc.descendants((node, pos) => {
					if (node.type.name === "image" && node.attrs.src === url) {
						nodesToRemove.push(pos);
					}
				});

				// Remove from end to start to preserve positions
				nodesToRemove.reverse().forEach((pos) => {
					tr.delete(pos, pos + 1);
				});

				if (nodesToRemove.length > 0) {
					view.dispatch(tr);
				}
			},
		}),
		[editor],
	);

	// Load content when journal data arrives (key prop handles date changes)
	useEffect(() => {
		if (!editor || !journal) return;
		const content = journal.content ?? "";
		editor.commands.setContent(content);
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

				// Invalidate attachments
				utils.dailyJournal.getByDate.invalidate({ date: dateString });

				toast.success("Image uploaded", { id: toastId });
				return attachment.url;
			} catch (error) {
				console.error("Image upload failed:", error);
				toast.error("Upload failed", { id: toastId });
				return null;
			}
		},
		[
			journal,
			dateString,
			getUploadUrl,
			confirmUpload,
			utils.dailyJournal.getByDate,
		],
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
						// Insert directly without re-uploading
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

	// Show loading until journal data arrives (key prop causes remount, so we wait for fresh data)
	if (isLoadingJournal || !journal) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* Toolbar */}
			<EditorToolbar editor={editor} onImageUpload={handleImageUpload} />

			{/* Editor content */}
			<div className="flex min-h-0 flex-1 flex-col rounded-b border border-white/10 border-t-0 bg-white/1">
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
		</div>
	);
});
