"use client";

import { useState } from "react";
import { ChatInterface } from "./_components/chat-interface";
import { ReportInterface } from "./_components/report-interface";

type AiMode = "chat" | "report";

export default function AIPage() {
	const [mode, setMode] = useState<AiMode>("chat");

	return (
		<div
			className="flex h-[calc(100vh-4.5rem)] flex-col overflow-hidden"
			data-testid="ai-page"
		>
			{mode === "chat" ? (
				<ChatInterface mode={mode} onModeChange={setMode} />
			) : (
				<ReportInterface mode={mode} onModeChange={setMode} />
			)}
		</div>
	);
}
