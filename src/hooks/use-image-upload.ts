import { useCallback } from "react";
import { toast } from "sonner";
import { ERR_VALIDATION_IMAGES_ONLY } from "@/lib/constants/errors";
import { api } from "@/trpc/react";

interface UseImageUploadOptions {
	/** Context for organizing images in S3 (e.g., "trade-notes", "journal-preview") */
	context: string;
}

interface UseImageUploadReturn {
	/** Upload an image file and return the presigned download URL for display */
	uploadImage: (file: File) => Promise<string | null>;
}

/**
 * Hook for uploading images to S3 via the generic storage endpoint.
 * Shows toast notifications with upload progress.
 *
 * @example
 * ```tsx
 * const { uploadImage } = useImageUpload({ context: "trade-notes" });
 *
 * const handleImageDrop = async (file: File) => {
 *   const url = await uploadImage(file);
 *   if (url) {
 *     // Insert image into editor
 *   }
 * };
 * ```
 */
export function useImageUpload({
	context,
}: UseImageUploadOptions): UseImageUploadReturn {
	const getUploadUrl = api.storage.getImageUploadUrl.useMutation();
	const getDownloadUrl = api.storage.getDownloadUrl.useMutation();

	const uploadImage = useCallback(
		async (file: File): Promise<string | null> => {
			// Validate file is an image
			if (!file.type.startsWith("image/")) {
				toast.error(ERR_VALIDATION_IMAGES_ONLY);
				return null;
			}

			const toastId = toast.loading("Uploading... 0%");

			try {
				// Get presigned upload URL and S3 key
				const { presignedUrl, key } = await getUploadUrl.mutateAsync({
					filename: file.name,
					mimeType: file.type,
					size: file.size,
					context,
				});

				toast.loading("Uploading... 10%", { id: toastId });

				// Upload file to S3 using XMLHttpRequest for progress tracking
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();

					xhr.upload.addEventListener("progress", (event) => {
						if (event.lengthComputable) {
							// Map progress: 10-95% for actual upload
							const percent =
								Math.round((event.loaded / event.total) * 85) + 10;
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

				// Get presigned download URL for display
				const { url } = await getDownloadUrl.mutateAsync({ key });

				toast.success("Image uploaded", { id: toastId });
				// Return presigned URL for display (will be converted to S3 key on save)
				return url;
			} catch (error) {
				console.error("Image upload failed:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Upload failed";
				toast.error(errorMessage, { id: toastId });
				return null;
			}
		},
		[context, getUploadUrl, getDownloadUrl],
	);

	return { uploadImage };
}
