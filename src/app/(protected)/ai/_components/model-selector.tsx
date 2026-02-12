"use client";

import { Menu } from "lucide-react";

type AiMode = "chat" | "report";

interface ModelSelectorProps {
	mode: AiMode;
	onModeChange: (mode: AiMode) => void;
	onMenuClick?: () => void;
}

export function ModelSelector({
	mode,
	onModeChange,
	onMenuClick,
}: ModelSelectorProps) {
	return (
		<div className="flex items-center gap-2 border-border border-b px-3 py-2">
			{/* Mobile hamburger */}
			{onMenuClick && (
				<button
					className="rounded p-2 text-muted-foreground transition-colors hover:bg-white/5 sm:hidden"
					data-testid="chat-mobile-menu-button"
					onClick={onMenuClick}
					type="button"
				>
					<Menu className="h-4 w-4" />
				</button>
			)}
			{/* Mode Toggle */}
			<div
				className="flex gap-1 rounded border border-border bg-secondary p-0.5"
				data-testid="ai-mode-selector"
			>
				<button
					className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
						mode === "chat"
							? "bg-primary/10 text-primary"
							: "text-muted-foreground hover:text-foreground"
					}`}
					data-testid="ai-mode-option-chat"
					onClick={() => onModeChange("chat")}
					type="button"
				>
					Chat
				</button>
				<button
					className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
						mode === "report"
							? "bg-primary/10 text-primary"
							: "text-muted-foreground hover:text-foreground"
					}`}
					data-testid="ai-mode-option-report"
					onClick={() => onModeChange("report")}
					type="button"
				>
					Report
				</button>
			</div>
		</div>
	);
}
