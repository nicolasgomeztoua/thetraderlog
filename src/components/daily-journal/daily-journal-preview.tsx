"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CheckCircle2Icon, ExternalLinkIcon } from "lucide-react";
import NextLink from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { useImagePreloader } from "@/hooks/use-image-preloader";
import { useTiptapImageHandlers } from "@/hooks/use-tiptap-image-handlers";
import { cn } from "@/lib/shared";
import { transformHtmlToS3Keys } from "@/lib/storage/s3";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface DailyJournalPreviewProps {
	/** The date to display journal for (ISO string or Date) */
	date: string | Date;
	/** Whether the editor is editable or read-only */
	editable?: boolean;
	/** Additional class name for container */
	className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Compact journal preview for embedding in trade detail.
 * Shows journal content with optional editing and checklist compliance badge.
 */
export function DailyJournalPreview({
	date,
	editable = false,
	className,
}: DailyJournalPreviewProps) {
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
		"idle",
	);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const lastSavedContentRef = useRef<string | null>(null);

	const utils = api.useUtils();

	// Normalize date to string
	const dateString = useMemo(() => {
		if (typeof date === "string") {
			return date.split("T")[0] ?? "";
		}
		return date.toISOString().split("T")[0] ?? "";
	}, [date]);

	// Normalize date for checks query (needs full ISO string)
	const dateISOString = useMemo(() => {
		if (typeof date === "string") {
			// If it's already a date string like "2024-01-15", convert to ISO
			return new Date(date).toISOString();
		}
		return date.toISOString();
	}, [date]);

	// Fetch journal data
	const { data: journal, isLoading: isLoadingJournal } =
		api.dailyJournal.getByDate.useQuery(
			{ date: dateString },
			{ enabled: !!dateString },
		);

	// Preload images from journal content
	const { isLoading: isLoadingImages } = useImagePreloader(
		journal?.content ?? null,
	);

	// Combined loading state
	const isLoading = isLoadingJournal || isLoadingImages;

	// Fetch templates for compliance calculation
	const { data: templates } = api.dailyJournal.getTemplates.useQuery();

	// Fetch checks for the date
	const { data: checksData } = api.dailyJournal.getChecks.useQuery(
		{ date: dateISOString },
		{ enabled: !!dateString },
	);

	// Update content mutation
	const updateContent = api.dailyJournal.updateContent.useMutation({
		onSuccess: () => {
			setSaveStatus("saved");
			savedIndicatorTimeoutRef.current = setTimeout(() => {
				setSaveStatus("idle");
			}, 2000);
			utils.dailyJournal.getByDate.invalidate({ date: dateString });
		},
	});

	// Image upload mutations (only used when editable)
	const getUploadUrl = api.dailyJournal.getUploadUrl.useMutation();
	const confirmUpload = api.dailyJournal.confirmUpload.useMutation();

	// Calculate checklist compliance based on all active templates
	const compliance = useMemo(() => {
		if (!templates) return null;

		const activeTemplates = templates.filter((t) => t.isActive);
		if (activeTemplates.length === 0) return null;

		// Build map of templateId -> checked status
		const checksMap = new Map<string, boolean>();
		if (checksData?.checks) {
			for (const check of checksData.checks) {
				// Only include template-based checks (not forced items)
				if (check.templateId) {
					checksMap.set(check.templateId, check.checked);
				}
			}
		}

		const checkedCount = activeTemplates.filter((t) =>
			checksMap.get(t.id),
		).length;
		const total = activeTemplates.length;
		const percentage = Math.round((checkedCount / total) * 100);

		return { checkedCount, total, percentage };
	}, [templates, checksData]);

	// Initialize Tiptap editor (must be declared before handlers that use it)
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
			}),
			Link.configure({
				openOnClick: true,
				HTMLAttributes: {
					class:
						"text-primary underline underline-offset-4 hover:text-primary/80",
				},
			}),
			Image.configure({
				HTMLAttributes: {
					class: "max-w-full h-auto rounded my-2",
				},
			}),
			Placeholder.configure({
				placeholder: editable
					? "Write your daily journal..."
					: "No journal entry for this date",
				emptyEditorClass:
					"before:content-[attr(data-placeholder)] before:text-muted-foreground/50 before:float-left before:h-0 before:pointer-events-none",
			}),
		],
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-invert prose-sm min-h-[120px] max-w-none px-3 py-2 focus:outline-none",
					!editable && "cursor-default",
				),
			},
			editable: () => editable,
		},
		onUpdate: ({ editor }) => {
			if (!editable) return;

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

	// Handle image upload using journal-specific endpoint (creates attachment records)
	const uploadImage = useCallback(
		async (file: File): Promise<string | null> => {
			if (!editable || !journal) return null;

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

				// Invalidate to refresh attachments
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
			editable,
			journal,
			dateString,
			getUploadUrl,
			confirmUpload,
			utils.dailyJournal.getByDate,
		],
	);

	// Attach paste/drop handlers for images (only when editable)
	useTiptapImageHandlers({
		editor: editable ? editor : null,
		uploadImage,
	});

	// Update editor content when journal data changes
	useEffect(() => {
		if (editor && journal && !editor.isFocused) {
			const newContent = journal.content ?? "";
			const currentContent = editor.getHTML();

			if (newContent !== currentContent) {
				// Use emitUpdate: false to prevent triggering onUpdate (and auto-save) during load
				editor.commands.setContent(newContent, { emitUpdate: false });
				lastSavedContentRef.current = newContent;
			}
		}
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

	if (isLoading) {
		return (
			<div className={cn("flex min-h-0 flex-col", className)}>
				{/* Header skeleton */}
				<div className="flex shrink-0 items-center justify-between">
					<div className="flex items-center gap-2">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-5 w-12 rounded" />
					</div>
					<Skeleton className="h-3 w-24" />
				</div>

				{/* Editor skeleton */}
				<div className="mt-3 min-h-0 flex-1 rounded border border-white/10 bg-white/1 p-3">
					<div className="space-y-2">
						<Skeleton className="h-3 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
						{/* Image placeholder when loading images */}
						{isLoadingImages && (
							<Skeleton className="mt-2 aspect-video w-full max-w-xs" />
						)}
						<Skeleton className="h-3 w-2/3" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("flex min-h-0 flex-col", className)}>
			{/* Header with compliance badge and link */}
			<div className="flex shrink-0 items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Daily Journal
					</span>
					{compliance && (
						<div
							className={cn(
								"flex items-center gap-1 rounded px-1.5 py-0.5",
								compliance.percentage === 100
									? "bg-profit/10 text-profit"
									: compliance.percentage >= 75
										? "bg-primary/10 text-primary"
										: "bg-white/5 text-muted-foreground",
							)}
						>
							<CheckCircle2Icon className="size-3" />
							<span className="font-mono text-[10px]">
								{compliance.checkedCount}/{compliance.total}
							</span>
						</div>
					)}
				</div>

				<NextLink
					className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
					href={`/daily-journal?date=${dateString}`}
				>
					<span>Open full journal</span>
					<ExternalLinkIcon className="size-3" />
				</NextLink>
			</div>

			{/* Editor */}
			<div
				className={cn(
					"mt-3 min-h-0 flex-1 overflow-y-auto rounded border border-white/10 bg-white/1",
					editable && "focus-within:border-primary/50",
				)}
			>
				<EditorContent editor={editor} />
			</div>

			{/* Save status (only when editable) */}
			{editable && saveStatus !== "idle" && (
				<div className="mt-3 flex h-4 shrink-0 items-center justify-end">
					{saveStatus === "saving" && (
						<span className="font-mono text-[10px] text-muted-foreground">
							Saving...
						</span>
					)}
					{saveStatus === "saved" && (
						<span className="font-mono text-[10px] text-profit">Saved</span>
					)}
				</div>
			)}
		</div>
	);
}
