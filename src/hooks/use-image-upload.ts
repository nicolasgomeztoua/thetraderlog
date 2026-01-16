import { useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";

interface UseImageUploadOptions {
	/** Context for organizing images in S3 (e.g., "trade-notes", "journal-preview") */
	context: string;
}

interface UseImageUploadReturn {
	/** Upload an image file and return the public URL */
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

	const uploadImage = useCallback(
		async (file: File): Promise<string | null> => {
			// Validate file is an image
			if (!file.type.startsWith("image/")) {
				toast.error("Only image files are allowed");
				return null;
			}

			const toastId = toast.loading("Uploading... 0%");

			try {
				// Get presigned upload URL
				const { presignedUrl, publicUrl } = await getUploadUrl.mutateAsync({
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

				toast.success("Image uploaded", { id: toastId });
				return publicUrl;
			} catch (error) {
				console.error("Image upload failed:", error);
				toast.error("Upload failed", { id: toastId });
				return null;
			}
		},
		[context, getUploadUrl],
	);

	return { uploadImage };
}
