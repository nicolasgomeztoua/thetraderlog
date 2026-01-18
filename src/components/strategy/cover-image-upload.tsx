"use client";

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

interface CoverImageUploadProps {
	strategyId: string;
	coverImageUrl: string | null;
	strategyColor: string | null;
	onImageChange?: (url: string | null, key: string | null) => void;
}

/**
 * Cover image upload component for strategies.
 *
 * - Shows current cover image if exists, placeholder gradient if not
 * - Click opens file picker (accepts image/*)
 * - Uses strategies.getImageUploadUrl mutation for presigned URLs
 * - Shows upload progress via toast
 * - Updates strategy via strategies.update mutation on upload complete
 * - Delete button removes cover image
 * - Responsive: full-width banner aspect ratio (3:1)
 */
export function CoverImageUpload({
	strategyId,
	coverImageUrl,
	strategyColor,
	onImageChange,
}: CoverImageUploadProps) {
	const [isUploading, setIsUploading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const utils = api.useUtils();

	const getUploadUrlMutation = api.strategies.getImageUploadUrl.useMutation();
	const updateStrategyMutation = api.strategies.update.useMutation({
		onSuccess: () => {
			utils.strategies.getById.invalidate({ id: strategyId });
		},
	});

	const color = strategyColor ?? "#d4ff00";

	const handleFileSelect = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			// Validate file type
			if (!file.type.startsWith("image/")) {
				toast.error("Only image files are allowed");
				return;
			}

			// Validate file size (5MB limit)
			const maxSize = 5 * 1024 * 1024;
			if (file.size > maxSize) {
				toast.error("Image must be less than 5MB");
				return;
			}

			setIsUploading(true);
			const toastId = toast.loading("Uploading... 0%");

			try {
				// Get presigned upload URL
				const { presignedUrl, publicUrl, key } =
					await getUploadUrlMutation.mutateAsync({
						strategyId,
						filename: file.name,
						mimeType: file.type,
						size: file.size,
					});

				toast.loading("Uploading... 10%", { id: toastId });

				// Upload file to S3 using XMLHttpRequest for progress tracking
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();

					xhr.upload.addEventListener("progress", (progressEvent) => {
						if (progressEvent.lengthComputable) {
							// Map progress: 10-90% for actual upload
							const percent =
								Math.round((progressEvent.loaded / progressEvent.total) * 80) +
								10;
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

				toast.loading("Saving... 95%", { id: toastId });

				// Update strategy with new cover image URL and key
				await updateStrategyMutation.mutateAsync({
					id: strategyId,
					coverImageUrl: publicUrl,
					coverImageKey: key,
				});

				toast.success("Cover image uploaded", { id: toastId });
				onImageChange?.(publicUrl, key);
			} catch (error) {
				console.error("Cover image upload failed:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Upload failed";
				toast.error(errorMessage, { id: toastId });
			} finally {
				setIsUploading(false);
				// Reset file input
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		},
		[strategyId, getUploadUrlMutation, updateStrategyMutation, onImageChange],
	);

	const handleDelete = useCallback(async () => {
		setIsDeleting(true);
		const toastId = toast.loading("Removing cover image...");

		try {
			await updateStrategyMutation.mutateAsync({
				id: strategyId,
				coverImageUrl: null,
				coverImageKey: null,
			});

			toast.success("Cover image removed", { id: toastId });
			onImageChange?.(null, null);
		} catch (error) {
			console.error("Failed to remove cover image:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Failed to remove image";
			toast.error(errorMessage, { id: toastId });
		} finally {
			setIsDeleting(false);
		}
	}, [strategyId, updateStrategyMutation, onImageChange]);

	const handleClick = useCallback(() => {
		if (!isUploading && !isDeleting) {
			fileInputRef.current?.click();
		}
	}, [isUploading, isDeleting]);

	const isDisabled = isUploading || isDeleting;

	return (
		<div
			className="group relative aspect-[3/1] w-full overflow-hidden rounded-lg"
			data-testid="cover-image-upload"
		>
			{/* Background: cover image or gradient placeholder */}
			<div
				className={cn(
					"absolute inset-0 transition-opacity",
					isDisabled && "opacity-50",
				)}
				style={{
					background: coverImageUrl
						? `url(${coverImageUrl}) center/cover`
						: `linear-gradient(135deg, ${color}20, ${color}05)`,
				}}
			/>

			{/* Overlay gradient for better text visibility */}
			<div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

			{/* Hidden file input */}
			<input
				accept="image/*"
				className="hidden"
				data-testid="cover-image-input"
				disabled={isDisabled}
				onChange={handleFileSelect}
				ref={fileInputRef}
				type="file"
			/>

			{/* Upload overlay - shown on hover or when no image */}
			<div
				className={cn(
					"absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all",
					coverImageUrl
						? "bg-background/60 opacity-0 group-hover:opacity-100"
						: "bg-transparent",
					isDisabled && "pointer-events-none",
				)}
			>
				{isUploading ? (
					<div className="flex flex-col items-center gap-2">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
						<span className="font-mono text-muted-foreground text-sm">
							Uploading...
						</span>
					</div>
				) : (
					<>
						<Button
							className="font-mono"
							data-testid="cover-image-upload-button"
							disabled={isDisabled}
							onClick={handleClick}
							size="sm"
							variant="outline"
						>
							{coverImageUrl ? (
								<>
									<Upload className="mr-2 h-4 w-4" />
									Change Cover
								</>
							) : (
								<>
									<ImagePlus className="mr-2 h-4 w-4" />
									Add Cover Image
								</>
							)}
						</Button>

						{!coverImageUrl && (
							<p className="font-mono text-muted-foreground text-xs">
								Recommended: 1200×400px (3:1 ratio)
							</p>
						)}
					</>
				)}
			</div>

			{/* Delete button - shown when image exists and not uploading */}
			{coverImageUrl && !isUploading && (
				<Button
					className={cn(
						"absolute top-2 right-2 font-mono opacity-0 transition-opacity group-hover:opacity-100",
						isDeleting && "opacity-100",
					)}
					data-testid="cover-image-delete-button"
					disabled={isDisabled}
					onClick={handleDelete}
					size="sm"
					variant="destructive"
				>
					{isDeleting ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<Trash2 className="mr-2 h-4 w-4" />
					)}
					Remove
				</Button>
			)}
		</div>
	);
}
