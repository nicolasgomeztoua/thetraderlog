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
import { cn } from "@/lib/shared";
import type { JournalAttachment } from "@/server/db/schema";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface AttachmentGalleryProps {
	attachments: JournalAttachment[];
	selectedDate: Date;
	className?: string;
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
// COMPONENT
// =============================================================================

/**
 * Gallery component for displaying and managing journal attachments.
 * Shows images in a grid with lightbox, and non-images with file icons.
 */
export function AttachmentGallery({
	attachments,
	selectedDate,
	className,
}: AttachmentGalleryProps) {
	const [lightboxImage, setLightboxImage] = useState<JournalAttachment | null>(
		null,
	);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const utils = api.useUtils();
	const dateString = selectedDate.toISOString().split("T")[0] ?? "";

	// Delete attachment mutation
	const deleteAttachment = api.dailyJournal.deleteAttachment.useMutation({
		onSuccess: () => {
			setDeletingId(null);
			// Invalidate journal data to refresh attachments
			utils.dailyJournal.getByDate.invalidate({ date: dateString });
		},
		onError: () => {
			setDeletingId(null);
		},
	});

	const handleDelete = useCallback(
		(id: string) => {
			deleteAttachment.mutate({ id });
		},
		[deleteAttachment],
	);

	const handleCancelDelete = useCallback(() => {
		setDeletingId(null);
	}, []);

	const handleOpenLightbox = useCallback((attachment: JournalAttachment) => {
		if (isImageType(attachment.mimeType)) {
			setLightboxImage(attachment);
		}
	}, []);

	const handleCloseLightbox = useCallback(() => {
		setLightboxImage(null);
	}, []);

	// Handle keyboard events for lightbox
	const handleLightboxKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Escape") {
				handleCloseLightbox();
			}
		},
		[handleCloseLightbox],
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
					{images.map((attachment) => (
						<div
							className="group relative aspect-square overflow-hidden rounded border border-white/5 bg-white/1"
							key={attachment.id}
						>
							{/* Image - using img because these are user-uploaded S3 images */}
							<button
								className="size-full cursor-pointer"
								onClick={() => handleOpenLightbox(attachment)}
								type="button"
							>
								{/* biome-ignore lint/performance/noImgElement: External S3 images cannot use next/image without domain config */}
								<img
									alt={attachment.filename}
									className="size-full object-cover transition-transform group-hover:scale-105"
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
											onClick={() => handleDelete(attachment.id)}
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
								/* Delete button (hover) */
								<button
									className="absolute top-1 right-1 rounded bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
									onClick={() => setDeletingId(attachment.id)}
									type="button"
								>
									<TrashIcon className="size-3 text-muted-foreground hover:text-loss" />
								</button>
							)}
						</div>
					))}
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
											onClick={() => handleDelete(attachment.id)}
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
				<div
					aria-label="Image lightbox"
					className="fixed inset-0 z-50 flex items-center justify-center bg-background/95"
					onClick={handleCloseLightbox}
					onKeyDown={handleLightboxKeyDown}
					role="dialog"
				>
					{/* Close button */}
					<button
						className="absolute top-4 right-4 rounded bg-white/10 p-2 transition-colors hover:bg-white/20"
						onClick={handleCloseLightbox}
						type="button"
					>
						<XIcon className="size-6" />
					</button>

					{/* biome-ignore lint/performance/noImgElement: External S3 images cannot use next/image without domain config */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: Click on image just prevents closing, not interactive */}
					<img
						alt={lightboxImage.filename}
						className="max-h-[90vh] max-w-[90vw] object-contain"
						onClick={(e) => e.stopPropagation()}
						src={lightboxImage.url}
					/>

					{/* Filename */}
					<div className="-translate-x-1/2 absolute bottom-4 left-1/2">
						<span className="rounded bg-white/10 px-3 py-1 font-mono text-sm">
							{lightboxImage.filename}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
