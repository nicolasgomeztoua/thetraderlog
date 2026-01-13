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

import { EditorBubbleMenu } from "@/components/daily-journal/editor-bubble-menu";
import { EditorToolbar } from "@/components/daily-journal/editor-toolbar";
import { SlashCommand } from "@/components/daily-journal/slash-command-menu";
import { toDateString } from "@/lib/shared";
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
				class: "min-h-[300px] px-4 py-3 focus:outline-none",
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

			try {
				// Get presigned upload URL
				const { presignedUrl, key } = await getUploadUrl.mutateAsync({
					date: dateString,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
				});

				// Upload file to S3
				const uploadResponse = await fetch(presignedUrl, {
					method: "PUT",
					body: file,
					headers: {
						"Content-Type": file.type,
					},
				});

				if (!uploadResponse.ok) {
					console.error("Failed to upload file to S3");
					return null;
				}

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

				return attachment.url;
			} catch (error) {
				console.error("Image upload failed:", error);
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

	// Handle image paste/drop and insert into editor
	const handleImageInsert = useCallback(
		async (file: File) => {
			if (!editor || !file.type.startsWith("image/")) return;

			const url = await handleImageUpload(file);
			if (url) {
				editor.chain().focus().setImage({ src: url }).run();
			}
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

	// Handle drop event to catch dropped images
	const handleDrop = useCallback(
		(event: DragEvent) => {
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
		[handleImageInsert],
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
			<div className="flex min-h-[300px] items-center justify-center">
				<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{/* Toolbar */}
			<EditorToolbar editor={editor} onImageUpload={handleImageUpload} />

			{/* Editor content */}
			<div className="rounded-b border border-white/10 border-t-0 bg-white/1">
				<EditorContent editor={editor} />
				{editor && <EditorBubbleMenu editor={editor} />}
			</div>

			{/* Save status indicator */}
			<div className="mt-2 flex h-5 items-center justify-end">
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
}
