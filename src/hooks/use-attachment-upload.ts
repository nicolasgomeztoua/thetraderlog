"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";

export interface AttachmentUploadResult {
	id: string;
	key: string;
	url: string;
	filename: string;
	mimeType: string;
	size: number;
}

interface UseAttachmentUploadOptions {
	/** The type of entity this attachment belongs to */
	entityType: "journal" | "trade" | "strategy";
	/** The ID of the entity this attachment belongs to */
	entityId: string;
	/** Context for embedded images (e.g., "notes"). Null for gallery attachments. */
	embeddedContext?: string;
	/** Callback when upload completes successfully */
	onSuccess?: (attachment: AttachmentUploadResult) => void;
	/** Callback when upload fails */
	onError?: (error: Error) => void;
}

interface UseAttachmentUploadReturn {
	/** Upload a file and return the attachment info */
	uploadFile: (file: File) => Promise<AttachmentUploadResult | null>;
	/** Whether an upload is currently in progress */
	isUploading: boolean;
	/** Current upload progress (0-100) */
	progress: number;
}

/**
 * Hook for uploading attachments to S3 via the unified attachments endpoint.
 * Shows toast notifications with upload progress.
 *
 * @example
 * ```tsx
 * const { uploadFile, isUploading, progress } = useAttachmentUpload({
 *   entityType: "trade",
 *   entityId: trade.id,
 *   embeddedContext: "notes",
 *   onSuccess: (attachment) => {
 *     // Insert image into editor using attachment.key
 *   },
 * });
 *
 * const handleImageDrop = async (file: File) => {
 *   const result = await uploadFile(file);
 *   if (result) {
 *     // Use result.key for embedding in content
 *   }
 * };
 * ```
 */
export function useAttachmentUpload({
	entityType,
	entityId,
	embeddedContext,
	onSuccess,
	onError,
}: UseAttachmentUploadOptions): UseAttachmentUploadReturn {
	const [isUploading, setIsUploading] = useState(false);
	const [progress, setProgress] = useState(0);

	const getUploadUrl = api.attachments.getUploadUrl.useMutation();
	const confirmUpload = api.attachments.confirmUpload.useMutation();

	const uploadFile = useCallback(
		async (file: File): Promise<AttachmentUploadResult | null> => {
			// Validate file is an image
			if (!file.type.startsWith("image/")) {
				const error = new Error("Only image files are allowed");
				toast.error(error.message);
				onError?.(error);
				return null;
			}

			// Validate file size (10MB max)
			if (file.size > 10 * 1024 * 1024) {
				const error = new Error("File size must be less than 10MB");
				toast.error(error.message);
				onError?.(error);
				return null;
			}

			setIsUploading(true);
			setProgress(0);
			const toastId = toast.loading("Uploading... 0%");

			try {
				// Get presigned upload URL and create pending attachment record
				const { presignedUrl, attachmentId } = await getUploadUrl.mutateAsync({
					entityType,
					entityId,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
					embeddedContext,
				});

				setProgress(10);
				toast.loading("Uploading... 10%", { id: toastId });

				// Upload file to S3 using XMLHttpRequest for progress tracking
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();

					xhr.upload.addEventListener("progress", (event) => {
						if (event.lengthComputable) {
							// Map progress: 10-90% for actual upload
							const percent =
								Math.round((event.loaded / event.total) * 80) + 10;
							setProgress(percent);
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

				setProgress(95);
				toast.loading("Uploading... 95%", { id: toastId });

				// Confirm upload completed
				const confirmed = await confirmUpload.mutateAsync({ attachmentId });

				setProgress(100);
				toast.success("Upload complete", { id: toastId });

				const result: AttachmentUploadResult = {
					id: confirmed.id,
					key: confirmed.key,
					url: confirmed.url,
					filename: confirmed.filename,
					mimeType: confirmed.mimeType,
					size: confirmed.size,
				};

				onSuccess?.(result);
				return result;
			} catch (error) {
				console.error("Attachment upload failed:", error);
				const err = error instanceof Error ? error : new Error("Upload failed");
				toast.error(err.message, { id: toastId });
				onError?.(err);
				return null;
			} finally {
				setIsUploading(false);
				setProgress(0);
			}
		},
		[
			entityType,
			entityId,
			embeddedContext,
			getUploadUrl,
			confirmUpload,
			onSuccess,
			onError,
		],
	);

	return { uploadFile, isUploading, progress };
}
