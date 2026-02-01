"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef } from "react";
import { extractS3KeysFromHtml } from "@/lib/storage/s3";
import { api } from "@/trpc/react";
import { useAttachmentUpload } from "./use-attachment-upload";

interface UseTiptapAttachmentsOptions {
	/** Tiptap editor instance */
	editor: Editor | null;
	/** The type of entity this attachment belongs to */
	entityType: "journal" | "trade" | "strategy";
	/** The ID of the entity this attachment belongs to */
	entityId: string;
	/** Context for embedded images (e.g., "notes") */
	embeddedContext: string;
}

interface UseTiptapAttachmentsReturn {
	/** Sync embedded images with the database (call when saving content) */
	syncEmbedded: () => Promise<{
		orphanedCount: number;
		preservedCount: number;
	}>;
	/** Whether an upload is currently in progress */
	isUploading: boolean;
	/** Current upload progress (0-100) */
	progress: number;
}

/**
 * Hook that integrates attachments with Tiptap editors.
 *
 * Features:
 * - Handles paste/drop events for images
 * - Shows instant blob preview while uploading
 * - Replaces blob URL with S3 key after upload
 * - Provides syncEmbedded function to call when saving content
 *
 * @example
 * ```tsx
 * const { syncEmbedded, isUploading } = useTiptapAttachments({
 *   editor,
 *   entityType: "trade",
 *   entityId: trade.id,
 *   embeddedContext: "notes",
 * });
 *
 * // When saving:
 * const handleSave = async () => {
 *   await syncEmbedded(); // Mark removed images as orphaned
 *   await saveTrade({ notes: editor.getHTML() });
 * };
 * ```
 */
export function useTiptapAttachments({
	editor,
	entityType,
	entityId,
	embeddedContext,
}: UseTiptapAttachmentsOptions): UseTiptapAttachmentsReturn {
	const syncEmbeddedMutation = api.attachments.syncEmbedded.useMutation();

	// Track pending uploads to avoid race conditions
	const pendingUploadsRef = useRef<Map<string, string>>(new Map());

	const { uploadFile, isUploading, progress } = useAttachmentUpload({
		entityType,
		entityId,
		embeddedContext,
		onSuccess: (attachment) => {
			// Find the blob URL for this upload and replace it
			const blobUrl = pendingUploadsRef.current.get(attachment.id);
			if (blobUrl && editor) {
				replaceBlobWithKey(editor, blobUrl, attachment.key);
				pendingUploadsRef.current.delete(attachment.id);
			}
		},
	});

	// Handle image insert with instant blob preview
	const handleImageInsert = useCallback(
		async (file: File) => {
			if (!editor || !file.type.startsWith("image/")) return;

			// Create blob URL for instant preview
			const blobUrl = URL.createObjectURL(file);

			// Insert blob URL immediately for instant feedback
			editor.chain().focus().setImage({ src: blobUrl }).run();

			// Upload in background
			const result = await uploadFile(file);

			if (result) {
				// Store mapping for the onSuccess callback
				pendingUploadsRef.current.set(result.id, blobUrl);

				// Replace blob URL with S3 key
				replaceBlobWithKey(editor, blobUrl, result.key);
			} else {
				// Upload failed - remove the blob image from editor
				removeBlobImage(editor, blobUrl);
			}

			// Clean up blob URL
			URL.revokeObjectURL(blobUrl);
		},
		[editor, uploadFile],
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
			if (!editor) return;

			// Handle file drops
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

	// Sync embedded images with database
	const syncEmbedded = useCallback(async () => {
		if (!editor) {
			return { orphanedCount: 0, preservedCount: 0 };
		}

		const html = editor.getHTML();
		const currentKeys = extractS3KeysFromHtml(html);

		const result = await syncEmbeddedMutation.mutateAsync({
			entityType,
			entityId,
			embeddedContext,
			currentKeys,
		});

		return result;
	}, [editor, entityType, entityId, embeddedContext, syncEmbeddedMutation]);

	return { syncEmbedded, isUploading, progress };
}

/**
 * Replace a blob URL with an S3 key in the editor content.
 */
function replaceBlobWithKey(
	editor: Editor,
	blobUrl: string,
	key: string,
): void {
	const { state, view } = editor;
	const { tr } = state;
	let replaced = false;

	state.doc.descendants((node, pos) => {
		if (node.type.name === "image" && node.attrs.src === blobUrl) {
			tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: key });
			replaced = true;
			return false; // Stop searching
		}
	});

	if (replaced) {
		view.dispatch(tr);
	}
}

/**
 * Remove a blob image node from the editor content.
 */
function removeBlobImage(editor: Editor, blobUrl: string): void {
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
