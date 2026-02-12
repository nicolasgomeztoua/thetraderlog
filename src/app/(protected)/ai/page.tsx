"use client";

import { Brain, FileText, MessageSquare } from "lucide-react";
import { useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	AI_MODELS,
	AI_MODES,
	DEFAULT_CHAT_MODEL,
	DEFAULT_REPORT_MODEL,
} from "@/lib/constants/ai";
import { ChatInterface } from "./_components/chat-interface";
import { ReportInterface } from "./_components/report-interface";

type AiMode = "chat" | "report";

export default function AIPage() {
	const [mode, setMode] = useState<AiMode>("chat");
	const [model, setModel] = useState<string>(DEFAULT_CHAT_MODEL);

	const handleModeChange = (newMode: AiMode) => {
		setMode(newMode);
		// Reset model to default for the new mode
		setModel(newMode === "chat" ? DEFAULT_CHAT_MODEL : DEFAULT_REPORT_MODEL);
	};

	// Filter models available for the current mode
	const availableModels = AI_MODELS.filter(
		(m) => m.mode === mode || m.mode === "both",
	);

	return (
		<div
			className="flex h-[calc(100vh-8rem)] flex-col space-y-4"
			data-testid="ai-page"
		>
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 flex-1">
					<span className="mb-2 block font-mono text-primary text-xs uppercase tracking-wider">
						Analysis
					</span>
					<h1
						className="font-bold text-2xl tracking-tight sm:text-3xl"
						data-testid="ai-heading"
					>
						AI Insights
					</h1>
					<p className="mt-1 hidden font-mono text-muted-foreground text-sm sm:block">
						{mode === "chat"
							? "Ask questions about your trading performance"
							: "Generate deep analysis reports with charts"}
					</p>
				</div>

				{/* Controls */}
				<div className="flex items-center gap-2 sm:gap-3">
					{/* Mode Switcher */}
					<Select
						onValueChange={(v) => handleModeChange(v as AiMode)}
						value={mode}
					>
						<SelectTrigger
							className="font-mono text-xs uppercase tracking-wider"
							data-testid="ai-mode-selector"
						>
							<div className="flex items-center gap-2">
								{mode === "chat" ? (
									<MessageSquare className="size-3.5" />
								) : (
									<FileText className="size-3.5" />
								)}
								<SelectValue />
							</div>
						</SelectTrigger>
						<SelectContent>
							{AI_MODES.map((m) => (
								<SelectItem
									className="font-mono text-xs"
									data-testid={`ai-mode-option-${m.value}`}
									key={m.value}
									value={m.value}
								>
									<span className="flex items-center gap-2">
										{m.value === "chat" ? (
											<MessageSquare className="size-3.5" />
										) : (
											<FileText className="size-3.5" />
										)}
										{m.label}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Model Selector */}
					<Select onValueChange={setModel} value={model}>
						<SelectTrigger
							className="max-w-[180px] font-mono text-xs"
							data-testid="ai-model-selector"
						>
							<div className="flex items-center gap-2">
								<Brain className="size-3.5 shrink-0 text-[#00d4ff]" />
								<SelectValue />
							</div>
						</SelectTrigger>
						<SelectContent>
							{availableModels.map((m) => (
								<SelectItem
									className="font-mono text-xs"
									data-testid={`ai-model-option-${m.id.replace("/", "-")}`}
									key={m.id}
									value={m.id}
								>
									<div className="flex flex-col">
										<span>{m.name}</span>
										<span className="text-[10px] text-muted-foreground">
											{m.provider} · {m.description}
										</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Content Area */}
			<div className="min-h-0 flex-1">
				{mode === "chat" ? (
					<ChatInterface data-testid="ai-chat-interface" model={model} />
				) : (
					<ReportInterface data-testid="ai-report-interface" model={model} />
				)}
			</div>
		</div>
	);
}
