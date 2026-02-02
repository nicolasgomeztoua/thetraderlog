import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";

interface UseTradeAttachmentUploadOptions {
	tradeId: string;
}

interface UploadProgress {
	percent: number;
	status: "idle" | "uploading" | "confirming" | "done" | "error";
}

interface UseTradeAttachmentUploadReturn {
	/** Upload a file and return the presigned download URL for display */
	uploadFile: (file: File) => Promise<string | null>;
	/** Current upload progress */
	progress: UploadProgress;
	/** Whether an upload is in progress */
	isUploading: boolean;
}

/**
 * Hook for uploading attachments to a trade via S3.
 * Shows toast notifications with upload progress.
 * Automatically invalidates trades.getById on success.
 *
 * @example
 * ```tsx
 * const { uploadFile, isUploading } = useTradeAttachmentUpload({ tradeId: "tr-xxx" });
 *
 * const handleFileDrop = async (file: File) => {
 *   const url = await uploadFile(file);
 *   if (url) {
 *     // File uploaded successfully, gallery will refresh
 *   }
 * };
 * ```
 */
export function useTradeAttachmentUpload({
	tradeId,
}: UseTradeAttachmentUploadOptions): UseTradeAttachmentUploadReturn {
	const [progress, setProgress] = useState<UploadProgress>({
		percent: 0,
		status: "idle",
	});

	const utils = api.useUtils();
	const getUploadUrl = api.trades.getUploadUrl.useMutation();
	const confirmUpload = api.trades.confirmUpload.useMutation();

	const uploadFile = useCallback(
		async (file: File): Promise<string | null> => {
			// Validate file is an image
			if (!file.type.startsWith("image/")) {
				toast.error("Only image files are allowed");
				return null;
			}

			setProgress({ percent: 0, status: "uploading" });
			const toastId = toast.loading("Uploading... 0%");

			try {
				// Get presigned upload URL and S3 key
				const { presignedUrl, key } = await getUploadUrl.mutateAsync({
					tradeId,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
				});

				setProgress({ percent: 10, status: "uploading" });
				toast.loading("Uploading... 10%", { id: toastId });

				// Upload file to S3 using XMLHttpRequest for progress tracking
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();

					xhr.upload.addEventListener("progress", (event) => {
						if (event.lengthComputable) {
							// Map progress: 10-85% for actual upload
							const percent =
								Math.round((event.loaded / event.total) * 75) + 10;
							setProgress({ percent, status: "uploading" });
							toast.loading(`Uploading... ${percent}%`, { id: toastId });
						}
					});

					xhr.addEventListener("load", () => {
						if (xhr.status >= 200 && xhr.status < 300) {
							resolve();
						} else {
							// Log detailed error info for debugging
							console.error("[S3 Upload Error]", {
								status: xhr.status,
								statusText: xhr.statusText,
								response: xhr.responseText,
								presignedUrl: presignedUrl.split("?")[0], // Log URL without signature
							});
							const errorMsg =
								xhr.status === 403
									? "Upload failed - permission denied (check S3 bucket policy)"
									: `Upload failed: ${xhr.status} ${xhr.statusText}`;
							reject(new Error(errorMsg));
						}
					});

					xhr.addEventListener("error", () => {
						// Network error (often CORS)
						console.error("[S3 Upload Network Error]", {
							readyState: xhr.readyState,
							status: xhr.status,
							presignedUrl: presignedUrl.split("?")[0],
						});
						reject(
							new Error(
								"Upload failed - network error (check CORS configuration)",
							),
						);
					});

					xhr.open("PUT", presignedUrl);
					xhr.setRequestHeader("Content-Type", file.type);
					xhr.send(file);
				});

				setProgress({ percent: 90, status: "confirming" });
				toast.loading("Processing... 90%", { id: toastId });

				// Confirm upload and create database record
				const attachment = await confirmUpload.mutateAsync({
					tradeId,
					key,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
				});

				setProgress({ percent: 100, status: "done" });

				// Invalidate trade data to refresh attachments
				await utils.trades.getById.invalidate({ id: tradeId });

				toast.success("Image uploaded", { id: toastId });

				// Reset progress after a short delay
				setTimeout(() => {
					setProgress({ percent: 0, status: "idle" });
				}, 500);

				return attachment.url;
			} catch (error) {
				console.error("File upload failed:", error);
				setProgress({ percent: 0, status: "error" });
				const errorMessage =
					error instanceof Error ? error.message : "Upload failed";
				toast.error(errorMessage, { id: toastId });
				return null;
			}
		},
		[tradeId, getUploadUrl, confirmUpload, utils.trades.getById],
	);

	return {
		uploadFile,
		progress,
		isUploading:
			progress.status === "uploading" || progress.status === "confirming",
	};
}
