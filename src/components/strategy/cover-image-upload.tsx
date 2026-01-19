"use client";

import { Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	COVER_IMAGE_ACCEPTED_TYPES,
	COVER_IMAGE_MAX_SIZE_BYTES,
	COVER_IMAGE_MAX_SIZE_MB,
} from "@/lib/constants";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

interface CoverImageUploadProps {
	/** Strategy ID for upload endpoint */
	strategyId: string;
	/** Current cover image URL (null if no image) */
	currentImageUrl: string | null;
	/** Callback when image changes (uploaded or deleted) */
	onImageChange: (url: string | null) => void;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Cover image upload component for strategy visual identity.
 *
 * Features:
 * - 16:9 aspect ratio container
 * - Drag-and-drop support with hover highlight
 * - Click to open file picker
 * - File validation: max 5MB, accepted types
 * - Upload progress bar during upload
 * - Displays uploaded image filling container
 * - Hover overlay with 'Change Image' text
 * - Delete button (X icon) in top-right on hover
 * - Toast notifications for validation/upload failures
 *
 * Terminal design: dark theme, chartreuse accents.
 */
export function CoverImageUpload({
	strategyId,
	currentImageUrl,
	onImageChange,
	className,
}: CoverImageUploadProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// tRPC mutations
	const getUploadUrl = api.strategies.getCoverImageUploadUrl.useMutation();
	const confirmCoverImage = api.strategies.confirmCoverImage.useMutation();
	const deleteCoverImage = api.strategies.deleteCoverImage.useMutation();

	/**
	 * Validate file before upload
	 */
	const validateFile = useCallback((file: File): string | null => {
		// Check file size
		if (file.size > COVER_IMAGE_MAX_SIZE_BYTES) {
			return `File is too large. Maximum size is ${COVER_IMAGE_MAX_SIZE_MB}MB`;
		}

		// Check mime type
		const acceptedTypes: readonly string[] = COVER_IMAGE_ACCEPTED_TYPES;
		if (!acceptedTypes.includes(file.type)) {
			return "Invalid file type. Accepted types: JPEG, PNG, WebP, GIF";
		}

		return null;
	}, []);

	/**
	 * Handle file upload
	 */
	const handleUpload = useCallback(
		async (file: File) => {
			// Validate file
			const validationError = validateFile(file);
			if (validationError) {
				toast.error(validationError);
				return;
			}

			setIsUploading(true);
			setUploadProgress(0);

			try {
				// Get presigned URL
				setUploadProgress(5);
				const { presignedUrl, key, publicUrl } = await getUploadUrl.mutateAsync(
					{
						strategyId,
						filename: file.name,
						mimeType: file.type,
						size: file.size,
					},
				);

				setUploadProgress(10);

				// Upload to S3 with progress tracking
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();

					xhr.upload.addEventListener("progress", (event) => {
						if (event.lengthComputable) {
							// Map progress: 10-90% for actual upload
							const percent =
								Math.round((event.loaded / event.total) * 80) + 10;
							setUploadProgress(percent);
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

				setUploadProgress(95);

				// Confirm the upload (updates strategy in DB)
				await confirmCoverImage.mutateAsync({
					strategyId,
					key,
					url: publicUrl,
				});

				setUploadProgress(100);
				toast.success("Cover image uploaded");
				onImageChange(publicUrl);
			} catch (error) {
				console.error("Cover image upload failed:", error);
				toast.error("Failed to upload cover image");
			} finally {
				setIsUploading(false);
				setUploadProgress(0);
			}
		},
		[strategyId, validateFile, getUploadUrl, confirmCoverImage, onImageChange],
	);

	/**
	 * Handle delete
	 */
	const handleDelete = useCallback(async () => {
		try {
			await deleteCoverImage.mutateAsync({ strategyId });
			toast.success("Cover image removed");
			onImageChange(null);
		} catch (error) {
			console.error("Failed to delete cover image:", error);
			toast.error("Failed to remove cover image");
		}
	}, [strategyId, deleteCoverImage, onImageChange]);

	/**
	 * Handle file input change
	 */
	const handleFileSelect = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (file) {
				handleUpload(file);
			}
			// Reset input so same file can be selected again
			event.target.value = "";
		},
		[handleUpload],
	);

	/**
	 * Handle click on upload zone
	 */
	const handleClick = useCallback(() => {
		if (!isUploading) {
			fileInputRef.current?.click();
		}
	}, [isUploading]);

	/**
	 * Handle drag events
	 */
	const handleDragEnter = useCallback((event: React.DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((event: React.DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		// Only set false if we're leaving the main container
		const relatedTarget = event.relatedTarget as Node | null;
		if (!event.currentTarget.contains(relatedTarget)) {
			setIsDragging(false);
		}
	}, []);

	const handleDragOver = useCallback((event: React.DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
	}, []);

	const handleDrop = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault();
			event.stopPropagation();
			setIsDragging(false);

			const file = event.dataTransfer.files?.[0];
			if (file) {
				handleUpload(file);
			}
		},
		[handleUpload],
	);

	/**
	 * Strip currency symbols and other common characters when pasting
	 */
	const acceptedExtensions = ".jpg,.jpeg,.png,.webp,.gif";

	return (
		<div className={cn("w-full", className)}>
			{/* Hidden file input */}
			<input
				accept={acceptedExtensions}
				className="hidden"
				data-testid="cover-upload-input"
				onChange={handleFileSelect}
				ref={fileInputRef}
				type="file"
			/>

			{/* Upload zone / Image display - using div with role="button" for drag-and-drop support */}
			{/* biome-ignore lint/a11y/useSemanticElements: div needed for drag-and-drop, button doesn't support onDragEnter/onDrop properly */}
			<div
				className={cn(
					"group relative aspect-video w-full overflow-hidden rounded-lg border-2 transition-all",
					currentImageUrl
						? "border-transparent"
						: "border-muted-foreground/30 border-dashed",
					isDragging && "border-primary bg-primary/5",
					!isUploading &&
						!currentImageUrl &&
						"cursor-pointer hover:border-primary/50",
					!isUploading && currentImageUrl && "cursor-pointer",
				)}
				data-testid="cover-upload-zone"
				onClick={handleClick}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleClick();
					}
				}}
				role="button"
				tabIndex={0}
			>
				{/* Empty state */}
				{!currentImageUrl && !isUploading && (
					<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
						<div
							className={cn(
								"rounded-full p-3 transition-colors",
								isDragging ? "bg-primary/20" : "bg-muted",
							)}
						>
							<UploadIcon
								className={cn(
									"size-6 transition-colors",
									isDragging ? "text-primary" : "text-muted-foreground",
								)}
							/>
						</div>
						<div className="space-y-1">
							<p
								className={cn(
									"font-medium font-mono text-sm transition-colors",
									isDragging ? "text-primary" : "text-foreground",
								)}
							>
								{isDragging ? "Drop image here" : "Add Cover Image"}
							</p>
							<p className="font-mono text-muted-foreground text-xs">
								Drag & drop or click to upload
							</p>
							<p className="font-mono text-muted-foreground/70 text-xs">
								Max {COVER_IMAGE_MAX_SIZE_MB}MB • JPEG, PNG, WebP, GIF
							</p>
						</div>
					</div>
				)}

				{/* Uploading state */}
				{isUploading && (
					<div className="flex h-full flex-col items-center justify-center gap-4 p-6">
						<Loader2Icon className="size-8 animate-spin text-primary" />
						<div className="w-full max-w-xs space-y-2">
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
								<div
									className="h-full bg-primary transition-all duration-200"
									style={{ width: `${uploadProgress}%` }}
								/>
							</div>
							<p className="text-center font-mono text-muted-foreground text-xs">
								Uploading... {uploadProgress}%
							</p>
						</div>
					</div>
				)}

				{/* Image display */}
				{currentImageUrl && !isUploading && (
					<>
						<Image
							alt="Strategy cover image"
							className="h-full w-full object-cover"
							data-testid="cover-image"
							fill
							sizes="(max-width: 768px) 100vw, 50vw"
							src={currentImageUrl}
						/>

						{/* Hover overlay */}
						<div
							className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
							data-testid="cover-change-overlay"
						>
							<div className="flex flex-col items-center gap-2">
								<UploadIcon className="size-6 text-white" />
								<span className="font-mono text-sm text-white">
									Change Image
								</span>
							</div>
						</div>

						{/* Delete button */}
						<Button
							className="absolute top-2 right-2 size-8 rounded-full bg-black/60 p-0 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
							data-testid="cover-delete-button"
							onClick={(e) => {
								e.stopPropagation();
								handleDelete();
							}}
							size="icon"
							type="button"
							variant="ghost"
						>
							<XIcon className="size-4 text-white" />
							<span className="sr-only">Remove cover image</span>
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
