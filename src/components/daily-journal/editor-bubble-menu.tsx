"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
	BoldIcon,
	CodeIcon,
	ItalicIcon,
	LinkIcon,
	StrikethroughIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/shared";

interface EditorBubbleMenuProps {
	editor: Editor;
}

interface MenuButtonProps {
	icon: React.ReactNode;
	onClick: () => void;
	isActive?: boolean;
	label: string;
}

function MenuButton({ icon, onClick, isActive, label }: MenuButtonProps) {
	return (
		<button
			aria-label={label}
			className={cn(
				"inline-flex size-8 items-center justify-center rounded transition-colors",
				"text-foreground/80 hover:bg-white/10 hover:text-foreground",
				isActive && "bg-primary/20 text-primary",
			)}
			onClick={onClick}
			type="button"
		>
			{icon}
		</button>
	);
}

/**
 * Bubble menu that appears when text is selected.
 * Provides quick access to inline formatting options.
 */
export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
	const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");

	const setLink = useCallback(() => {
		const trimmedUrl = linkUrl.trim();

		if (!trimmedUrl) {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
		} else {
			const url = trimmedUrl.startsWith("http")
				? trimmedUrl
				: `https://${trimmedUrl}`;
			editor
				.chain()
				.focus()
				.extendMarkRange("link")
				.setLink({ href: url })
				.run();
		}

		setLinkUrl("");
		setIsLinkPopoverOpen(false);
	}, [editor, linkUrl]);

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

	const openLinkPopover = useCallback(() => {
		const existingLink = editor.getAttributes("link").href;
		setLinkUrl(existingLink || "");
		setIsLinkPopoverOpen(true);
	}, [editor]);

	return (
		<BubbleMenu
			className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-card p-1 shadow-lg"
			editor={editor}
		>
			<MenuButton
				icon={<BoldIcon className="size-4" />}
				isActive={editor.isActive("bold")}
				label="Bold"
				onClick={() => editor.chain().focus().toggleBold().run()}
			/>
			<MenuButton
				icon={<ItalicIcon className="size-4" />}
				isActive={editor.isActive("italic")}
				label="Italic"
				onClick={() => editor.chain().focus().toggleItalic().run()}
			/>
			<MenuButton
				icon={<StrikethroughIcon className="size-4" />}
				isActive={editor.isActive("strike")}
				label="Strikethrough"
				onClick={() => editor.chain().focus().toggleStrike().run()}
			/>
			<MenuButton
				icon={<CodeIcon className="size-4" />}
				isActive={editor.isActive("code")}
				label="Code"
				onClick={() => editor.chain().focus().toggleCode().run()}
			/>

			<div className="mx-1 h-5 w-px bg-white/10" />

			<Popover onOpenChange={setIsLinkPopoverOpen} open={isLinkPopoverOpen}>
				<PopoverTrigger asChild>
					<button
						aria-label="Link"
						className={cn(
							"inline-flex size-8 items-center justify-center rounded transition-colors",
							"text-foreground/80 hover:bg-white/10 hover:text-foreground",
							editor.isActive("link") && "bg-primary/20 text-primary",
						)}
						onClick={openLinkPopover}
						type="button"
					>
						<LinkIcon className="size-4" />
					</button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-72 p-2" side="bottom">
					<div className="flex gap-2">
						<Input
							autoFocus
							className="h-8 flex-1 font-mono text-sm"
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
				</PopoverContent>
			</Popover>
		</BubbleMenu>
	);
}
