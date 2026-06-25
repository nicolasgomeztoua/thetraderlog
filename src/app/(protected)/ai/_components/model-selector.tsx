"use client";

import { FileText, Menu, MessageSquare } from "lucide-react";
import type * as React from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { AI_MODEL_OPTIONS } from "@/lib/constants/ai";

type AiMode = "chat" | "report";

interface ModelSelectorProps {
	mode: AiMode;
	onModeChange: (mode: AiMode) => void;
	onMenuClick?: () => void;
	/** Currently selected OpenRouter model ID. */
	selectedModel: string;
	/** Persist + apply a new model selection. */
	onModelChange: (model: string) => void;
	/** Lock the picker while a request is in flight. */
	modelDisabled?: boolean;
	/** Hide the model picker entirely (e.g. when the surface owns its own). */
	hideModelPicker?: boolean;
	/** Optional element pinned to the right of the header (e.g. a share button). */
	rightSlot?: React.ReactNode;
}

export function ModelSelector({
	mode,
	onModeChange,
	onMenuClick,
	selectedModel,
	onModelChange,
	modelDisabled,
	hideModelPicker,
	rightSlot,
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

			{/* Right side: model picker + optional slot (e.g. share button) */}
			<div className="ml-auto flex items-center gap-2">
				{/* Model Picker (same set for chat + reports; default differs per mode) */}
				{!hideModelPicker && (
					<div className="flex items-center gap-1.5">
						<span className="hidden font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider sm:inline">
							Model
						</span>
						<Select
							disabled={modelDisabled}
							onValueChange={onModelChange}
							value={selectedModel}
						>
							<SelectTrigger
								className="h-7 gap-1.5 border-white/10 bg-white/[0.01] font-mono text-[10px] text-foreground uppercase tracking-wider"
								data-testid="ai-model-selector"
								size="sm"
							>
								<SelectValue placeholder="Select model" />
							</SelectTrigger>
							<SelectContent align="end">
								{AI_MODEL_OPTIONS.map((m) => (
									<SelectItem
										className="font-mono text-xs"
										key={m.id}
										value={m.id}
									>
										<span className="flex flex-col">
											<span className="text-foreground">{m.label}</span>
											<span className="text-[10px] text-muted-foreground/60">
												{m.description}
											</span>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
				{rightSlot}
			</div>
		</div>
	);
}
