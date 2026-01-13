"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CheckCircle2Icon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import NextLink from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/shared";
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
	const { data: journal, isLoading } = api.dailyJournal.getByDate.useQuery(
		{ date: dateString },
		{ enabled: !!dateString },
	);

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

	// Calculate checklist compliance based on all active templates
	const compliance = useMemo(() => {
		if (!templates) return null;

		const activeTemplates = templates.filter((t) => t.isActive);
		if (activeTemplates.length === 0) return null;

		// Build map of templateId -> checked status
		const checksMap = new Map<string, boolean>();
		if (checksData?.checks) {
			for (const check of checksData.checks) {
				checksMap.set(check.templateId, check.checked);
			}
		}

		const checkedCount = activeTemplates.filter((t) =>
			checksMap.get(t.id),
		).length;
		const total = activeTemplates.length;
		const percentage = Math.round((checkedCount / total) * 100);

		return { checkedCount, total, percentage };
	}, [templates, checksData]);

	// Initialize Tiptap editor
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

	// Update editor content when journal data changes
	useEffect(() => {
		if (editor && journal && !editor.isFocused) {
			const newContent = journal.content ?? "";
			const currentContent = editor.getHTML();

			if (newContent !== currentContent) {
				editor.commands.setContent(newContent);
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
			<div
				className={cn(
					"flex min-h-[120px] items-center justify-center",
					className,
				)}
			>
				<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className={cn("space-y-3", className)}>
			{/* Header with compliance badge and link */}
			<div className="flex items-center justify-between">
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
					"rounded border border-white/10 bg-white/1",
					editable && "focus-within:border-primary/50",
				)}
			>
				<EditorContent editor={editor} />
			</div>

			{/* Save status (only when editable) */}
			{editable && saveStatus !== "idle" && (
				<div className="flex h-4 items-center justify-end">
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
