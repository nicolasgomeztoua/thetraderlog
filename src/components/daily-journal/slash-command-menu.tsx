"use client";

import type { Editor, Range } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import {
	CheckSquareIcon,
	CodeIcon,
	Heading1Icon,
	Heading2Icon,
	Heading3Icon,
	ListIcon,
	ListOrderedIcon,
	MinusIcon,
	QuoteIcon,
	TextIcon,
} from "lucide-react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import tippy, { type Instance as TippyInstance } from "tippy.js";

import { cn } from "@/lib/shared";

interface CommandItem {
	title: string;
	description: string;
	icon: React.ReactNode;
	command: (editor: Editor, range: Range) => void;
}

// Helper to check if we're inside a list and need to exit first
function runCommand(
	editor: Editor,
	range: Range,
	content: Record<string, unknown>,
) {
	const { from } = range;
	const $from = editor.state.doc.resolve(from);

	// Check if we're inside a list (taskList, bulletList, orderedList)
	let inList = false;
	for (let d = $from.depth; d > 0; d--) {
		const node = $from.node(d);
		if (
			node.type.name === "taskList" ||
			node.type.name === "bulletList" ||
			node.type.name === "orderedList"
		) {
			inList = true;
			break;
		}
	}

	if (inList) {
		// Delete the slash command text, lift out of list, then set the new block type
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.liftListItem("listItem")
			.liftListItem("taskItem")
			.insertContent(content)
			.run();
	} else {
		editor.chain().focus().insertContentAt(range, content).run();
	}
}

const COMMANDS: CommandItem[] = [
	{
		title: "Text",
		description: "Plain paragraph",
		icon: <TextIcon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, { type: "paragraph" });
		},
	},
	{
		title: "Heading 1",
		description: "Large heading",
		icon: <Heading1Icon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, { type: "heading", attrs: { level: 1 } });
		},
	},
	{
		title: "Heading 2",
		description: "Medium heading",
		icon: <Heading2Icon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, { type: "heading", attrs: { level: 2 } });
		},
	},
	{
		title: "Heading 3",
		description: "Small heading",
		icon: <Heading3Icon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, { type: "heading", attrs: { level: 3 } });
		},
	},
	{
		title: "To-do List",
		description: "Track tasks",
		icon: <CheckSquareIcon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, {
				type: "taskList",
				content: [{ type: "taskItem", content: [{ type: "paragraph" }] }],
			});
		},
	},
	{
		title: "Bullet List",
		description: "Simple list",
		icon: <ListIcon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, {
				type: "bulletList",
				content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
			});
		},
	},
	{
		title: "Numbered List",
		description: "Ordered list",
		icon: <ListOrderedIcon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, {
				type: "orderedList",
				content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
			});
		},
	},
	{
		title: "Quote",
		description: "Blockquote",
		icon: <QuoteIcon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, {
				type: "blockquote",
				content: [{ type: "paragraph" }],
			});
		},
	},
	{
		title: "Code",
		description: "Code block",
		icon: <CodeIcon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, { type: "codeBlock" });
		},
	},
	{
		title: "Divider",
		description: "Separator line",
		icon: <MinusIcon className="size-4" />,
		command: (editor, range) => {
			runCommand(editor, range, { type: "horizontalRule" });
		},
	},
];

interface CommandListProps {
	items: CommandItem[];
	command: (item: CommandItem) => void;
}

export interface CommandListRef {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const CommandList = forwardRef<CommandListRef, CommandListProps>(
	({ items, command }, ref) => {
		const [selectedIndex, setSelectedIndex] = useState(0);
		const containerRef = useRef<HTMLDivElement>(null);

		const selectItem = useCallback(
			(index: number) => {
				const item = items[index];
				if (item) {
					command(item);
				}
			},
			[items, command],
		);

		// Reset selection when filtered items change
		// biome-ignore lint/correctness/useExhaustiveDependencies: need to reset on items change
		useEffect(() => {
			setSelectedIndex(0);
		}, [items]);

		// Scroll selected item into view
		useEffect(() => {
			const container = containerRef.current;
			if (!container) return;

			const selectedButton = container.children[selectedIndex] as HTMLElement;
			if (selectedButton) {
				selectedButton.scrollIntoView({ block: "nearest" });
			}
		}, [selectedIndex]);

		useImperativeHandle(
			ref,
			() => ({
				onKeyDown: ({ event }) => {
					if (event.key === "ArrowUp") {
						event.preventDefault();
						setSelectedIndex((prev) =>
							prev === 0 ? items.length - 1 : prev - 1,
						);
						return true;
					}
					if (event.key === "ArrowDown") {
						event.preventDefault();
						setSelectedIndex((prev) =>
							prev === items.length - 1 ? 0 : prev + 1,
						);
						return true;
					}
					if (event.key === "Enter") {
						event.preventDefault();
						selectItem(selectedIndex);
						return true;
					}
					return false;
				},
			}),
			[items.length, selectedIndex, selectItem],
		);

		if (items.length === 0) {
			return (
				<div className="rounded-lg border border-white/10 bg-card p-3 shadow-xl">
					<span className="font-mono text-muted-foreground text-sm">
						No results
					</span>
				</div>
			);
		}

		return (
			<div
				className="flex max-h-80 w-52 flex-col gap-0.5 overflow-y-auto rounded-lg border border-white/10 bg-card p-1 shadow-xl"
				ref={containerRef}
			>
				{items.map((item, index) => (
					<button
						className={cn(
							"flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors",
							"hover:bg-white/5",
							index === selectedIndex && "bg-primary/10",
						)}
						key={item.title}
						onMouseDown={(e) => {
							e.preventDefault();
							selectItem(index);
						}}
						type="button"
					>
						<div
							className={cn(
								"flex size-7 shrink-0 items-center justify-center rounded bg-white/5",
								index === selectedIndex && "bg-primary/20 text-primary",
							)}
						>
							{item.icon}
						</div>
						<div className="min-w-0 flex-1">
							<div
								className={cn(
									"font-mono text-sm",
									index === selectedIndex ? "text-primary" : "text-foreground",
								)}
							>
								{item.title}
							</div>
							<div className="truncate font-mono text-[10px] text-muted-foreground">
								{item.description}
							</div>
						</div>
					</button>
				))}
			</div>
		);
	},
);

CommandList.displayName = "CommandList";

// Suggestion configuration
const suggestionConfig: Omit<SuggestionOptions<CommandItem>, "editor"> = {
	char: "/",
	command: ({ editor, range, props }) => {
		props.command(editor, range);
	},
	items: ({ query }) => {
		return COMMANDS.filter((item) =>
			item.title.toLowerCase().includes(query.toLowerCase()),
		);
	},
	render: () => {
		let component: ReactRenderer<CommandListRef> | null = null;
		let popup: TippyInstance | null = null;

		return {
			onStart: (props) => {
				component = new ReactRenderer(CommandList, {
					props: {
						items: props.items,
						command: (item: CommandItem) => {
							props.command(item);
						},
					},
					editor: props.editor,
				});

				if (!props.clientRect) return;

				popup = tippy(document.body, {
					getReferenceClientRect: props.clientRect as () => DOMRect,
					appendTo: () => document.body,
					content: component.element,
					showOnCreate: true,
					interactive: true,
					trigger: "manual",
					placement: "bottom-start",
					animation: "shift-away",
					duration: [200, 150],
				});
			},
			onUpdate: (props) => {
				component?.updateProps({
					items: props.items,
					command: (item: CommandItem) => {
						props.command(item);
					},
				});

				if (props.clientRect && popup) {
					popup.setProps({
						getReferenceClientRect: props.clientRect as () => DOMRect,
					});
				}
			},
			onKeyDown: (props) => {
				if (props.event.key === "Escape") {
					popup?.hide();
					return true;
				}
				return component?.ref?.onKeyDown(props) ?? false;
			},
			onExit: () => {
				popup?.destroy();
				component?.destroy();
			},
		};
	},
};

// Export the extension
export const SlashCommand = Extension.create({
	name: "slashCommand",
	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				...suggestionConfig,
			}),
		];
	},
});
