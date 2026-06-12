"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { cn } from "@/lib/shared";

// =============================================================================
// EXTENSIONS
// =============================================================================

// Read-only subset of the TradeNoteEditor extensions. Rendering through
// Tiptap's schema also strips anything outside it (scripts, handlers),
// which matters on a public page.
const VIEWER_EXTENSIONS = [
	StarterKit.configure({
		heading: { levels: [1, 2, 3] },
	}),
	Link.configure({
		openOnClick: true,
		HTMLAttributes: {
			class: "text-primary underline underline-offset-4 hover:text-primary/80",
			rel: "noopener noreferrer",
			target: "_blank",
		},
	}),
	Image.configure({
		HTMLAttributes: { class: "max-w-full h-auto rounded my-4" },
	}),
];

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Read-only renderer for trade notes (Tiptap HTML) on the public share page.
 */
export function SharedTradeNotes({
	html,
	className,
}: {
	html: string;
	className?: string;
}) {
	const editor = useEditor({
		extensions: VIEWER_EXTENSIONS,
		content: html,
		editable: false,
		immediatelyRender: false,
		editorProps: {
			attributes: {
				class: "focus:outline-none prose prose-sm prose-invert max-w-none",
			},
		},
	});

	if (!editor) return null;

	return <EditorContent className={cn(className)} editor={editor} />;
}
