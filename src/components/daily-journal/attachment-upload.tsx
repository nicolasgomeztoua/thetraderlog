"use client";

import { Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn, toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLOWED_FILE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];

// =============================================================================
// TYPES
// =============================================================================

interface AttachmentUploadProps {
	journalId: string | undefined;
	selectedDate: Date;
	onUploadComplete?: () => void;
	className?: string;
}

interface UploadingFile {
	id: string;
	file: File;
	progress: number;
	error: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Attachment upload component with drag-and-drop support.
 * Handles file validation, S3 upload, and database record creation.
 */
export function AttachmentUpload({
	journalId,
	selectedDate,
	onUploadComplete,
	className,
}: AttachmentUploadProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const utils = api.useUtils();

	// Date string for API calls - preserves the calendar date as clicked
	const dateString = toDateString(selectedDate);

	// Get upload URL mutation
	const getUploadUrl = api.dailyJournal.getUploadUrl.useMutation();

	// Confirm upload mutation
	const confirmUpload = api.dailyJournal.confirmUpload.useMutation({
		onSuccess: () => {
			// Invalidate journal data to refresh attachments
			utils.dailyJournal.getByDate.invalidate({ date: dateString });
			onUploadComplete?.();
		},
	});

	/**
	 * Validate a file before upload
	 */
	const validateFile = useCallback((file: File): string | null => {
		// Check file type
		if (!ALLOWED_FILE_TYPES.includes(file.type)) {
			return `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
		}

		// Check file size
		if (file.size > MAX_FILE_SIZE) {
			return `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`;
		}

		return null;
	}, []);

	/**
	 * Upload a single file to S3 and confirm in database
	 */
	const uploadFile = useCallback(
		async (file: File, uploadId: string) => {
			if (!journalId) {
				setUploadingFiles((prev) =>
					prev.map((f) =>
						f.id === uploadId
							? { ...f, error: "No journal found. Please try again." }
							: f,
					),
				);
				return;
			}

			try {
				// Get presigned upload URL
				const { presignedUrl, key } = await getUploadUrl.mutateAsync({
					date: dateString,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
				});

				// Update progress
				setUploadingFiles((prev) =>
					prev.map((f) => (f.id === uploadId ? { ...f, progress: 30 } : f)),
				);

				// Upload to S3 using XMLHttpRequest for progress tracking
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();

					xhr.upload.addEventListener("progress", (event) => {
						if (event.lengthComputable) {
							const progress =
								Math.round((event.loaded / event.total) * 60) + 30;
							setUploadingFiles((prev) =>
								prev.map((f) => (f.id === uploadId ? { ...f, progress } : f)),
							);
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

				// Update progress
				setUploadingFiles((prev) =>
					prev.map((f) => (f.id === uploadId ? { ...f, progress: 95 } : f)),
				);

				// Confirm upload in database
				await confirmUpload.mutateAsync({
					journalId,
					key,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
				});

				// Remove from uploading files (success)
				setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Upload failed";
				setUploadingFiles((prev) =>
					prev.map((f) => (f.id === uploadId ? { ...f, error: message } : f)),
				);
			}
		},
		[journalId, dateString, getUploadUrl, confirmUpload],
	);

	/**
	 * Process files for upload
	 */
	const processFiles = useCallback(
		(files: FileList | File[]) => {
			const fileArray = Array.from(files);

			for (const file of fileArray) {
				const error = validateFile(file);
				const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

				if (error) {
					setUploadingFiles((prev) => [
						...prev,
						{ id: uploadId, file, progress: 0, error },
					]);
				} else {
					setUploadingFiles((prev) => [
						...prev,
						{ id: uploadId, file, progress: 0, error: null },
					]);
					uploadFile(file, uploadId);
				}
			}
		},
		[validateFile, uploadFile],
	);

	/**
	 * Handle file input change
	 */
	const handleFileChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const files = event.target.files;
			if (files && files.length > 0) {
				processFiles(files);
			}
			// Reset input
			event.target.value = "";
		},
		[processFiles],
	);

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
		// Only set dragging to false if we're leaving the drop zone entirely
		if (!event.currentTarget.contains(event.relatedTarget as Node)) {
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

			const files = event.dataTransfer.files;
			if (files && files.length > 0) {
				processFiles(files);
			}
		},
		[processFiles],
	);

	/**
	 * Remove a file from the uploading list
	 */
	const handleRemoveFile = useCallback((uploadId: string) => {
		setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
	}, []);

	/**
	 * Retry a failed upload
	 */
	const handleRetry = useCallback(
		(uploadId: string) => {
			const fileToRetry = uploadingFiles.find((f) => f.id === uploadId);
			if (fileToRetry) {
				setUploadingFiles((prev) =>
					prev.map((f) =>
						f.id === uploadId ? { ...f, progress: 0, error: null } : f,
					),
				);
				uploadFile(fileToRetry.file, uploadId);
			}
		},
		[uploadingFiles, uploadFile],
	);

	const hasUploadingFiles = uploadingFiles.length > 0;

	return (
		<div className={cn("space-y-3", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Attachments
				</span>
			</div>

			{/* Drop zone - using section for accessibility */}
			<section
				aria-label="Drop files here or click to browse"
				className={cn(
					"relative rounded border-2 border-dashed transition-colors",
					isDragging
						? "border-primary bg-primary/5"
						: "border-white/10 hover:border-white/20",
					!journalId && "pointer-events-none opacity-50",
				)}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				<div className="flex flex-col items-center justify-center px-6 py-8">
					<UploadCloudIcon
						className={cn(
							"mb-3 size-8",
							isDragging ? "text-primary" : "text-muted-foreground",
						)}
					/>
					<p className="mb-1 font-mono text-sm">
						{isDragging ? (
							<span className="text-primary">Drop files here</span>
						) : (
							<span>
								Drag and drop files here, or{" "}
								<button
									className="text-primary hover:underline"
									disabled={!journalId}
									onClick={() => fileInputRef.current?.click()}
									type="button"
								>
									browse
								</button>
							</span>
						)}
					</p>
					<p className="font-mono text-[10px] text-muted-foreground">
						{ALLOWED_EXTENSIONS.join(", ")} - Max {MAX_FILE_SIZE / 1024 / 1024}
						MB
					</p>
				</div>

				{/* Hidden file input */}
				<input
					accept={ALLOWED_FILE_TYPES.join(",")}
					className="hidden"
					disabled={!journalId}
					multiple
					onChange={handleFileChange}
					ref={fileInputRef}
					type="file"
				/>
			</section>

			{/* Upload progress list */}
			{hasUploadingFiles && (
				<div className="space-y-2">
					{uploadingFiles.map((upload) => (
						<div
							className="flex items-center gap-3 rounded border border-white/5 bg-white/1 p-2"
							key={upload.id}
						>
							{/* File info */}
							<div className="min-w-0 flex-1">
								<p className="truncate font-mono text-xs">{upload.file.name}</p>
								{upload.error ? (
									<p className="font-mono text-[10px] text-loss">
										{upload.error}
									</p>
								) : (
									<div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
										<div
											className="h-full bg-primary transition-all duration-300"
											style={{ width: `${upload.progress}%` }}
										/>
									</div>
								)}
							</div>

							{/* Actions */}
							<div className="flex items-center gap-1">
								{upload.error ? (
									<>
										<Button
											className="text-primary"
											onClick={() => handleRetry(upload.id)}
											size="icon-sm"
											variant="ghost"
										>
											<span className="font-mono text-xs">Retry</span>
										</Button>
										<Button
											className="text-muted-foreground hover:text-loss"
											onClick={() => handleRemoveFile(upload.id)}
											size="icon-sm"
											variant="ghost"
										>
											<XIcon className="size-3" />
										</Button>
									</>
								) : upload.progress < 100 ? (
									<Loader2Icon className="size-4 animate-spin text-primary" />
								) : null}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
