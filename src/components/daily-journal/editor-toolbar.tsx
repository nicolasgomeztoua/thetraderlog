"use client";

import type { Editor } from "@tiptap/react";
import {
	BoldIcon,
	Heading1Icon,
	Heading2Icon,
	Heading3Icon,
	ImageIcon,
	ItalicIcon,
	LinkIcon,
	ListIcon,
	ListOrderedIcon,
	Loader2Icon,
	StrikethroughIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/shared";

interface EditorToolbarProps {
	editor: Editor | null;
	onImageUpload?: (file: File) => Promise<string | null>;
}

interface ToolbarButtonProps {
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
	isActive?: boolean;
	disabled?: boolean;
}

// Type helper for Tiptap extension commands
// The Editor type from @tiptap/react doesn't include extension commands by default
interface EditorCommands {
	run: () => boolean;
	focus: () => EditorCommands;
	toggleBold: () => EditorCommands;
	toggleItalic: () => EditorCommands;
	toggleStrike: () => EditorCommands;
	toggleHeading: (attrs: { level: number }) => EditorCommands;
	toggleBulletList: () => EditorCommands;
	toggleOrderedList: () => EditorCommands;
	extendMarkRange: (mark: string) => EditorCommands;
	setLink: (attrs: { href: string }) => EditorCommands;
	unsetLink: () => EditorCommands;
	setImage: (attrs: { src: string }) => EditorCommands;
}

function ToolbarButton({
	icon,
	label,
	onClick,
	isActive,
	disabled,
}: ToolbarButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					aria-label={label}
					className={cn(
						"inline-flex size-8 items-center justify-center rounded transition-colors",
						"text-muted-foreground hover:bg-white/10 hover:text-foreground",
						"disabled:pointer-events-none disabled:opacity-50",
						isActive && "bg-primary/20 text-primary",
					)}
					disabled={disabled}
					onMouseDown={(e) => {
						e.preventDefault();
						onClick();
					}}
					type="button"
				>
					{icon}
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				<span className="font-mono text-xs">{label}</span>
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Toolbar for the Tiptap rich text editor.
 * Provides formatting buttons for bold, italic, strikethrough, headings, lists, links, and images.
 */
export function EditorToolbar({ editor, onImageUpload }: EditorToolbarProps) {
	const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [, forceUpdate] = useState(0);

	// Detect Mac for keyboard shortcut display
	const mod = useMemo(() => {
		if (typeof window === "undefined") return "Ctrl";
		return /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
	}, []);

	// Force re-render when editor state changes (for active states)
	useEffect(() => {
		if (!editor) return;

		const handleUpdate = () => forceUpdate((n) => n + 1);
		editor.on("transaction", handleUpdate);

		return () => {
			editor.off("transaction", handleUpdate);
		};
	}, [editor]);

	// Helper to get typed command chain
	const cmd = useCallback((): EditorCommands | null => {
		if (!editor) return null;
		return editor.chain().focus() as unknown as EditorCommands;
	}, [editor]);

	const setLink = useCallback(() => {
		const chain = cmd();
		if (!chain) return;

		const trimmedUrl = linkUrl.trim();
		const linkChain = chain.extendMarkRange("link");
		if (!trimmedUrl) {
			linkChain.unsetLink().run();
		} else {
			// Ensure URL has protocol
			const url = trimmedUrl.startsWith("http")
				? trimmedUrl
				: `https://${trimmedUrl}`;
			linkChain.setLink({ href: url }).run();
		}

		setLinkUrl("");
		setIsLinkPopoverOpen(false);
	}, [linkUrl, cmd]);

	const handleLinkKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				setLink();
			} else if (e.key === "Escape") {
				setLinkUrl("");
				setIsLinkPopoverOpen(false);
			}
		},
		[setLink],
	);

	const handleImageClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file || !onImageUpload) return;

			const chain = cmd();
			if (!chain) return;

			// Validate file type
			if (!file.type.startsWith("image/")) {
				return;
			}

			setIsUploading(true);
			try {
				const url = await onImageUpload(file);
				if (url) {
					chain.setImage({ src: url }).run();
				}
			} finally {
				setIsUploading(false);
				// Reset input so the same file can be selected again
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		},
		[onImageUpload, cmd],
	);

	const openLinkPopover = useCallback(() => {
		if (!editor) return;
		// Pre-fill with existing link if any
		const existingLink = editor.getAttributes("link").href;
		setLinkUrl(existingLink || "");
		setIsLinkPopoverOpen(true);
	}, [editor]);

	if (!editor) {
		return null;
	}

	return (
		<div className="flex items-center gap-0.5 overflow-x-auto rounded-t border border-white/10 bg-white/2 px-2 py-1.5">
			{/* Text formatting */}
			<ToolbarButton
				icon={<BoldIcon className="size-4" />}
				isActive={editor.isActive("bold")}
				label={`Bold (${mod}+B)`}
				onClick={() => cmd()?.toggleBold().run()}
			/>
			<ToolbarButton
				icon={<ItalicIcon className="size-4" />}
				isActive={editor.isActive("italic")}
				label={`Italic (${mod}+I)`}
				onClick={() => cmd()?.toggleItalic().run()}
			/>
			<ToolbarButton
				icon={<StrikethroughIcon className="size-4" />}
				isActive={editor.isActive("strike")}
				label="Strikethrough"
				onClick={() => cmd()?.toggleStrike().run()}
			/>

			<Separator className="mx-1 h-6" orientation="vertical" />

			{/* Headings */}
			<ToolbarButton
				icon={<Heading1Icon className="size-4" />}
				isActive={editor.isActive("heading", { level: 1 })}
				label="Heading 1"
				onClick={() => cmd()?.toggleHeading({ level: 1 }).run()}
			/>
			<ToolbarButton
				icon={<Heading2Icon className="size-4" />}
				isActive={editor.isActive("heading", { level: 2 })}
				label="Heading 2"
				onClick={() => cmd()?.toggleHeading({ level: 2 }).run()}
			/>
			<ToolbarButton
				icon={<Heading3Icon className="size-4" />}
				isActive={editor.isActive("heading", { level: 3 })}
				label="Heading 3"
				onClick={() => cmd()?.toggleHeading({ level: 3 }).run()}
			/>

			<Separator className="mx-1 h-6" orientation="vertical" />

			{/* Lists */}
			<ToolbarButton
				icon={<ListIcon className="size-4" />}
				isActive={editor.isActive("bulletList")}
				label="Bullet List"
				onClick={() => cmd()?.toggleBulletList().run()}
			/>
			<ToolbarButton
				icon={<ListOrderedIcon className="size-4" />}
				isActive={editor.isActive("orderedList")}
				label="Numbered List"
				onClick={() => cmd()?.toggleOrderedList().run()}
			/>

			<Separator className="mx-1 h-6" orientation="vertical" />

			{/* Link */}
			<Popover onOpenChange={setIsLinkPopoverOpen} open={isLinkPopoverOpen}>
				<PopoverTrigger asChild>
					<button
						aria-label="Insert Link"
						className={cn(
							"inline-flex size-8 items-center justify-center rounded transition-colors",
							"text-muted-foreground hover:bg-white/10 hover:text-foreground",
							editor.isActive("link") && "bg-primary/20 text-primary",
						)}
						onClick={openLinkPopover}
						type="button"
					>
						<LinkIcon className="size-4" />
					</button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-80 p-3" side="bottom">
					<div className="space-y-2">
						<label
							className="font-mono text-muted-foreground text-xs"
							htmlFor="link-url-input"
						>
							URL
						</label>
						<div className="flex gap-2">
							<Input
								autoFocus
								className="h-8 flex-1 font-mono text-sm"
								id="link-url-input"
								onChange={(e) => setLinkUrl(e.target.value)}
								onKeyDown={handleLinkKeyDown}
								placeholder="https://example.com"
								type="url"
								value={linkUrl}
							/>
							<Button
								className="h-8"
								onClick={setLink}
								size="sm"
								variant="outline"
							>
								{linkUrl.trim() ? "Apply" : "Remove"}
							</Button>
						</div>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							Leave empty to remove link. Press Enter to apply.
						</p>
					</div>
				</PopoverContent>
			</Popover>

			{/* Image upload */}
			{onImageUpload && (
				<>
					<input
						accept="image/*"
						className="hidden"
						onChange={handleFileChange}
						ref={fileInputRef}
						type="file"
					/>
					<ToolbarButton
						disabled={isUploading}
						icon={
							isUploading ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<ImageIcon className="size-4" />
							)
						}
						label="Insert Image"
						onClick={handleImageClick}
					/>
				</>
			)}
		</div>
	);
}
