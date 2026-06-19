"use client";

import { FileText, Menu, MessageSquare } from "lucide-react";

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
		<div className="flex items-center gap-2 border-white/5 border-b px-3 py-2 sm:px-4">
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
				className="flex rounded border border-white/10 bg-white/[0.01] p-0.5"
				data-testid="ai-mode-selector"
			>
				<button
					className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
						mode === "chat"
							? "bg-primary/10 text-primary"
							: "text-muted-foreground hover:bg-white/[0.02] hover:text-foreground"
					}`}
					data-testid="ai-mode-option-chat"
					onClick={() => onModeChange("chat")}
					type="button"
				>
					<MessageSquare className="h-3 w-3" />
					Chat
				</button>
				<button
					className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
						mode === "report"
							? "bg-primary/10 text-primary"
							: "text-muted-foreground hover:bg-white/[0.02] hover:text-foreground"
					}`}
					data-testid="ai-mode-option-report"
					onClick={() => onModeChange("report")}
					type="button"
				>
					<FileText className="h-3 w-3" />
					Reports
				</button>
			</div>
		</div>
	);
}
