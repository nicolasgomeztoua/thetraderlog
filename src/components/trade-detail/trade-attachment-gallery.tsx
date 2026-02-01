"use client";

import {
	FileIcon,
	FileTextIcon,
	Loader2Icon,
	TrashIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/shared";
import type { TradeAttachment } from "@/server/db/schema";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface TradeAttachmentGalleryProps {
	attachments: TradeAttachment[];
	tradeId: string;
	className?: string;
	/** Called when an attachment is deleted, with the URL of the deleted attachment */
	onAttachmentDeleted?: (url: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function isImageType(mimeType: string): boolean {
	return mimeType.startsWith("image/");
}

function getFileIcon(mimeType: string) {
	if (mimeType === "application/pdf") {
		return FileTextIcon;
	}
	return FileIcon;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// LIGHTBOX COMPONENT
// =============================================================================

interface LightboxProps {
	attachment: TradeAttachment;
	onClose: () => void;
}

function LightboxWithSkeleton({ attachment, onClose }: LightboxProps) {
	const [isLoaded, setIsLoaded] = useState(false);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		},
		[onClose],
	);

	return (
		<div
			aria-label="Image lightbox"
			className="fixed inset-0 z-50 flex items-center justify-center bg-background/95"
			onClick={onClose}
			onKeyDown={handleKeyDown}
			role="dialog"
		>
			{/* Close button */}
			<button
				className="absolute top-4 right-4 rounded bg-white/10 p-2 transition-colors hover:bg-white/20"
				onClick={onClose}
				type="button"
			>
				<XIcon className="size-6" />
			</button>

			{/* Loading skeleton */}
			{!isLoaded && (
				<Skeleton className="aspect-video max-h-[90vh] w-[80vw] max-w-[90vw]" />
			)}

			{/* biome-ignore lint/performance/noImgElement: External S3 images cannot use next/image without domain config */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Click on image just prevents closing, not interactive */}
			<img
				alt={attachment.filename}
				className={cn(
					"max-h-[90vh] max-w-[90vw] object-contain transition-opacity",
					isLoaded ? "opacity-100" : "absolute opacity-0",
				)}
				onClick={(e) => e.stopPropagation()}
				onLoad={() => setIsLoaded(true)}
				src={attachment.url}
			/>

			{/* Filename */}
			<div className="-translate-x-1/2 absolute bottom-4 left-1/2">
				<span className="rounded bg-white/10 px-3 py-1 font-mono text-sm">
					{attachment.filename}
				</span>
			</div>
		</div>
	);
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Gallery component for displaying and managing trade attachments.
 * Shows images in a grid with lightbox, and non-images with file icons.
 */
export function TradeAttachmentGallery({
	attachments,
	tradeId,
	className,
	onAttachmentDeleted,
}: TradeAttachmentGalleryProps) {
	const [lightboxImage, setLightboxImage] = useState<TradeAttachment | null>(
		null,
	);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

	// Track when an image finishes loading
	const handleImageLoad = useCallback((id: string) => {
		setLoadedImages((prev) => new Set(prev).add(id));
	}, []);

	const utils = api.useUtils();

	// Delete attachment mutation
	const deleteAttachment = api.trades.deleteAttachment.useMutation({
		onSuccess: () => {
			setDeletingId(null);
			// Invalidate trade data to refresh attachments
			utils.trades.getById.invalidate({ id: tradeId });
		},
		onError: () => {
			setDeletingId(null);
		},
	});

	const handleDelete = useCallback(
		(attachment: TradeAttachment) => {
			deleteAttachment.mutate(
				{ id: attachment.id },
				{
					onSuccess: () => {
						// Notify parent so editor can remove the image
						onAttachmentDeleted?.(attachment.url);
					},
				},
			);
		},
		[deleteAttachment, onAttachmentDeleted],
	);

	const handleCancelDelete = useCallback(() => {
		setDeletingId(null);
	}, []);

	const handleOpenLightbox = useCallback((attachment: TradeAttachment) => {
		if (isImageType(attachment.mimeType)) {
			setLightboxImage(attachment);
		}
	}, []);

	const handleCloseLightbox = useCallback(() => {
		setLightboxImage(null);
	}, []);

	// Handle drag start for dragging images to editor
	const handleDragStart = useCallback(
		(event: React.DragEvent, attachment: TradeAttachment) => {
			// Set URL for native drag behavior
			event.dataTransfer.setData("text/uri-list", attachment.url);
			// Set custom data - use presigned URL for display (will be converted to S3 key on save)
			event.dataTransfer.setData(
				"application/x-attachment",
				JSON.stringify({ url: attachment.url, isAttachment: true }),
			);
			event.dataTransfer.effectAllowed = "copy";
		},
		[],
	);

	if (attachments.length === 0) {
		return null;
	}

	const images = attachments.filter((a) => isImageType(a.mimeType));
	const files = attachments.filter((a) => !isImageType(a.mimeType));

	return (
		<div className={cn("space-y-4", className)}>
			{/* Images grid */}
			{images.length > 0 && (
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
					{images.map((attachment) => {
						const isImageLoaded = loadedImages.has(attachment.id);

						return (
							<div
								className="group relative aspect-square cursor-grab overflow-hidden rounded border border-white/5 bg-white/1 active:cursor-grabbing"
								draggable
								key={attachment.id}
								onDragStart={(e) => handleDragStart(e, attachment)}
								role="img"
							>
								{/* Loading skeleton */}
								{!isImageLoaded && (
									<Skeleton className="absolute inset-0 size-full rounded-none" />
								)}

								{/* Image - using img because these are user-uploaded S3 images */}
								<button
									className="size-full cursor-pointer"
									onClick={() => handleOpenLightbox(attachment)}
									type="button"
								>
									{/* biome-ignore lint/performance/noImgElement: External S3 images cannot use next/image without domain config */}
									<img
										alt={attachment.filename}
										className={cn(
											"pointer-events-none size-full object-cover transition-all group-hover:scale-105",
											!isImageLoaded && "opacity-0",
										)}
										onLoad={() => handleImageLoad(attachment.id)}
										src={attachment.url}
									/>
								</button>

								{/* Delete confirmation overlay */}
								{deletingId === attachment.id ? (
									<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90">
										<span className="font-mono text-destructive text-xs">
											Delete?
										</span>
										<div className="flex gap-1">
											<Button
												disabled={deleteAttachment.isPending}
												onClick={() => handleDelete(attachment)}
												size="sm"
												variant="destructive"
											>
												{deleteAttachment.isPending ? (
													<Loader2Icon className="size-3 animate-spin" />
												) : (
													"Delete"
												)}
											</Button>
											<Button
												onClick={handleCancelDelete}
												size="sm"
												variant="ghost"
											>
												Cancel
											</Button>
										</div>
									</div>
								) : (
									/* Delete button (hover) - only show when image is loaded */
									isImageLoaded && (
										<button
											className="absolute top-1 right-1 rounded bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
											onClick={() => setDeletingId(attachment.id)}
											type="button"
										>
											<TrashIcon className="size-3 text-muted-foreground hover:text-loss" />
										</button>
									)
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Non-image files list */}
			{files.length > 0 && (
				<div className="space-y-1">
					{files.map((attachment) => {
						const FileIconComponent = getFileIcon(attachment.mimeType);

						return (
							<div
								className="group flex items-center gap-3 rounded border border-white/5 bg-white/1 p-2"
								key={attachment.id}
							>
								{/* Icon */}
								<FileIconComponent className="size-8 shrink-0 text-muted-foreground" />

								{/* File info */}
								<div className="min-w-0 flex-1">
									<a
										className="block truncate font-mono text-foreground text-sm hover:text-primary hover:underline"
										href={attachment.url}
										rel="noopener noreferrer"
										target="_blank"
									>
										{attachment.filename}
									</a>
									<span className="font-mono text-[10px] text-muted-foreground">
										{formatFileSize(attachment.size)}
									</span>
								</div>

								{/* Delete */}
								{deletingId === attachment.id ? (
									<div className="flex items-center gap-1">
										<Button
											disabled={deleteAttachment.isPending}
											onClick={() => handleDelete(attachment)}
											size="icon-sm"
											variant="destructive"
										>
											{deleteAttachment.isPending ? (
												<Loader2Icon className="size-3 animate-spin" />
											) : (
												<TrashIcon className="size-3" />
											)}
										</Button>
										<Button
											onClick={handleCancelDelete}
											size="icon-sm"
											variant="ghost"
										>
											<XIcon className="size-3" />
										</Button>
									</div>
								) : (
									<button
										className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
										onClick={() => setDeletingId(attachment.id)}
										type="button"
									>
										<TrashIcon className="size-4 text-muted-foreground hover:text-loss" />
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Lightbox */}
			{lightboxImage && (
				<LightboxWithSkeleton
					attachment={lightboxImage}
					onClose={handleCloseLightbox}
				/>
			)}
		</div>
	);
}
