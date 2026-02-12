"use client";

type AiMode = "chat" | "report";

interface ModelSelectorProps {
	mode: AiMode;
	onModeChange: (mode: AiMode) => void;
}

export function ModelSelector({ mode, onModeChange }: ModelSelectorProps) {
	return (
		<div className="flex items-center border-border border-b px-3 py-2">
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
