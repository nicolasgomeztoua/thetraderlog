"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect } from "react";
import type { UploadedImage } from "./use-image-upload";

interface UseTiptapImageHandlersOptions {
	/** Tiptap editor instance */
	editor: Editor | null;
	/**
	 * Function to upload a file. May return the full {@link UploadedImage} (from
	 * useImageUpload) or just the URL string (custom journal uploader) — the
	 * handler only needs the display URL.
	 */
	uploadImage: (file: File) => Promise<UploadedImage | string | null>;
}

/**
 * Hook that provides paste/drop handlers for Tiptap editors with instant blob preview.
 *
 * Uses the pattern from journal-editor.tsx:
 * 1. Insert blob URL immediately for instant feedback
 * 2. Upload in background
 * 3. Preload final image, then replace blob URL
 * 4. On failure, remove the blob image node
 *
 * @example
 * ```tsx
 * const { uploadImage } = useImageUpload({ context: "trade-notes" });
 * useTiptapImageHandlers({ editor, uploadImage });
 * ```
 */
export function useTiptapImageHandlers({
	editor,
	uploadImage,
}: UseTiptapImageHandlersOptions): void {
	// Handle image insert with instant blob preview
	const handleImageInsert = useCallback(
		async (file: File) => {
			if (!editor || !file.type.startsWith("image/")) return;

			// Create blob URL for instant preview
			const blobUrl = URL.createObjectURL(file);

			// Insert blob URL immediately for instant feedback
			editor.chain().focus().setImage({ src: blobUrl }).run();

			// Upload in background
			const uploaded = await uploadImage(file);
			const finalUrl =
				typeof uploaded === "string" ? uploaded : (uploaded?.url ?? null);

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
		[editor, uploadImage],
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

	// A browser element only becomes a valid drop target if dragover/dragenter
	// call preventDefault. ProseMirror only does this for its own internal
	// drag-and-drop, so without this handler the drop event never fires for
	// external files and drag-to-upload silently does nothing. Guard on "Files"
	// so we don't interfere with ProseMirror's drag-to-move-text behavior.
	const handleDragOver = useCallback((event: DragEvent) => {
		const { dataTransfer } = event;
		if (!dataTransfer || !Array.from(dataTransfer.types).includes("Files")) {
			return;
		}
		event.preventDefault();
		dataTransfer.dropEffect = "copy";
	}, []);

	// Handle drop event to catch dropped images
	const handleDrop = useCallback(
		(event: DragEvent) => {
			if (!editor) return;

			// Handle file drops
			const files = event.dataTransfer?.files;
			if (!files || files.length === 0) return;

			// We are taking over this file drop — stop the browser from navigating
			// away to the dropped file, even if none of the files are images.
			event.preventDefault();

			for (const file of files) {
				if (file.type.startsWith("image/")) {
					handleImageInsert(file);
					return;
				}
			}
		},
		[editor, handleImageInsert],
	);

	// Attach paste and drag/drop event listeners to editor DOM
	useEffect(() => {
		if (!editor) return;

		const editorElement = editor.view.dom;
		editorElement.addEventListener("paste", handlePaste as EventListener);
		editorElement.addEventListener("dragover", handleDragOver as EventListener);
		editorElement.addEventListener(
			"dragenter",
			handleDragOver as EventListener,
		);
		editorElement.addEventListener("drop", handleDrop as EventListener);

		return () => {
			editorElement.removeEventListener("paste", handlePaste as EventListener);
			editorElement.removeEventListener(
				"dragover",
				handleDragOver as EventListener,
			);
			editorElement.removeEventListener(
				"dragenter",
				handleDragOver as EventListener,
			);
			editorElement.removeEventListener("drop", handleDrop as EventListener);
		};
	}, [editor, handlePaste, handleDragOver, handleDrop]);
}
