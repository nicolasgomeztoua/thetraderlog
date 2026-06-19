"use client";

import { cn } from "@/lib/shared";

type CalloutType = "note" | "tip" | "warning" | "important";

interface CalloutProps {
	type?: CalloutType;
	title?: string;
	children: React.ReactNode;
}

const CALLOUT_STYLES: Record<
	CalloutType,
	{ border: string; icon: string; titleColor: string }
> = {
	note: {
		border: "border-blue-500/30",
		icon: "i",
		titleColor: "text-blue-400",
	},
	tip: {
		border: "border-profit/30",
		icon: "\u2713",
		titleColor: "text-profit",
	},
	warning: {
		border: "border-yellow-500/30",
		icon: "!",
		titleColor: "text-yellow-400",
	},
	important: {
		border: "border-loss/30",
		icon: "\u2217",
		titleColor: "text-loss",
	},
};

export function Callout({ type = "note", title, children }: CalloutProps) {
	const styles = CALLOUT_STYLES[type];

	return (
		<div
			className={cn(
				"my-4 rounded border-l-2 bg-white/[0.02] px-4 py-3",
				styles.border,
			)}
			data-testid={`mdx-callout-${type}`}
		>
			<div className="flex items-start gap-2">
				<span
					className={cn(
						"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/5 font-mono text-[10px]",
						styles.titleColor,
					)}
				>
					{styles.icon}
				</span>
				<div className="min-w-0 flex-1">
					{title && (
						<p
							className={cn(
								"mb-1 font-medium font-mono text-xs",
								styles.titleColor,
							)}
						>
							{title}
						</p>
					)}
					<div className="font-mono text-muted-foreground text-xs [&>p]:m-0">
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}
