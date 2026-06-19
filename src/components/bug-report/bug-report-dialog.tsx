"use client";

import { Bug, ImagePlus, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	BUG_CATEGORY_OPTIONS,
	BUG_REPORT_ALLOWED_MIME_TYPES,
	BUG_REPORT_MAX_SCREENSHOT_SIZE,
	ERR_BUG_REPORT_SUBMIT_FAILED,
} from "@/lib/constants";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";

interface BugReportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState("other");
	const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
	const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const createReport = api.bugReports.create.useMutation();
	const getUploadUrl = api.storage.getImageUploadUrl.useMutation();

	const resetForm = useCallback(() => {
		setTitle("");
		setDescription("");
		setCategory("other");
		setScreenshotFile(null);
		setScreenshotPreview(null);
	}, []);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			if (
				!BUG_REPORT_ALLOWED_MIME_TYPES.includes(
					file.type as (typeof BUG_REPORT_ALLOWED_MIME_TYPES)[number],
				)
			) {
				toast.error("Only PNG, JPEG, and WebP images are allowed");
				return;
			}
			if (file.size > BUG_REPORT_MAX_SCREENSHOT_SIZE) {
				toast.error("Screenshot must be under 5MB");
				return;
			}

			setScreenshotFile(file);
			const reader = new FileReader();
			reader.onload = (ev) => {
				setScreenshotPreview(ev.target?.result as string);
			};
			reader.readAsDataURL(file);
		},
		[],
	);

	const removeScreenshot = useCallback(() => {
		setScreenshotFile(null);
		setScreenshotPreview(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}, []);

	const handleSubmit = useCallback(async () => {
		if (!title.trim() || !description.trim()) return;
		setIsSubmitting(true);

		try {
			let screenshotKey: string | undefined;

			// Upload screenshot if provided
			if (screenshotFile) {
				const { presignedUrl, key } = await getUploadUrl.mutateAsync({
					filename: screenshotFile.name,
					mimeType: screenshotFile.type,
					size: screenshotFile.size,
					context: "bug-reports",
				});

				await fetch(presignedUrl, {
					method: "PUT",
					headers: { "Content-Type": screenshotFile.type },
					body: screenshotFile,
				});

				screenshotKey = key;
			}

			await createReport.mutateAsync({
				title: title.trim(),
				description: description.trim(),
				category: category as "ui" | "data" | "performance" | "crash" | "other",
				screenshotKey,
				pageUrl: window.location.href,
				userAgent: navigator.userAgent,
			});

			toast.success("Bug report submitted");
			resetForm();
			onOpenChange(false);
		} catch (error) {
			toast.error(getErrorMessage(error, ERR_BUG_REPORT_SUBMIT_FAILED));
		} finally {
			setIsSubmitting(false);
		}
	}, [
		title,
		description,
		category,
		screenshotFile,
		createReport,
		getUploadUrl,
		resetForm,
		onOpenChange,
	]);

	const isValid = title.trim().length > 0 && description.trim().length > 0;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
						<Bug className="size-4 text-primary" />
						Report a Bug
					</DialogTitle>
					<DialogDescription className="font-mono text-xs">
						Help us improve TheTraderLog by reporting issues you find.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					{/* Title */}
					<div className="grid gap-1.5">
						<Label
							className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="bug-title"
						>
							Title *
						</Label>
						<Input
							className="font-mono text-sm"
							id="bug-title"
							maxLength={200}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Brief summary of the issue"
							value={title}
						/>
					</div>

					{/* Description */}
					<div className="grid gap-1.5">
						<Label
							className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="bug-description"
						>
							Description *
						</Label>
						<Textarea
							className="min-h-20 resize-none font-mono text-sm"
							id="bug-description"
							maxLength={5000}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Steps to reproduce, expected vs actual behavior..."
							value={description}
						/>
					</div>

					{/* Category */}
					<div className="grid gap-1.5">
						<Label className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							What area is affected?
						</Label>
						<Select onValueChange={setCategory} value={category}>
							<SelectTrigger className="font-mono text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{BUG_CATEGORY_OPTIONS.map((opt) => (
									<SelectItem
										className="font-mono text-xs"
										key={opt.value}
										value={opt.value}
									>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Screenshot */}
					<div className="grid gap-1.5">
						<Label className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Screenshot (optional)
						</Label>
						{screenshotPreview ? (
							<div className="relative rounded-md border border-border">
								{/* biome-ignore lint/performance/noImgElement: data URL preview, not a static asset */}
								<img
									alt="Screenshot preview"
									className="max-h-32 w-full rounded-md object-contain"
									src={screenshotPreview}
								/>
								<button
									className="absolute top-1 right-1 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
									onClick={removeScreenshot}
									type="button"
								>
									<X className="size-3" />
								</button>
							</div>
						) : (
							<button
								className="flex h-20 items-center justify-center rounded-md border border-border border-dashed font-mono text-muted-foreground text-xs transition-colors hover:border-primary/50 hover:text-foreground"
								onClick={() => fileInputRef.current?.click()}
								type="button"
							>
								<ImagePlus className="mr-2 size-4" />
								Click to attach screenshot
							</button>
						)}
						<input
							accept={BUG_REPORT_ALLOWED_MIME_TYPES.join(",")}
							className="hidden"
							onChange={handleFileChange}
							ref={fileInputRef}
							type="file"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						className="font-mono text-xs uppercase tracking-wider"
						onClick={() => onOpenChange(false)}
						variant="ghost"
					>
						Cancel
					</Button>
					<Button
						className="font-mono text-xs uppercase tracking-wider"
						disabled={!isValid || isSubmitting}
						onClick={handleSubmit}
					>
						{isSubmitting ? "Submitting..." : "Submit Report"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
