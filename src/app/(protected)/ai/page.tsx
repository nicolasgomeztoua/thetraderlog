"use client";

import { useState } from "react";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { FEATURE_AI_CHAT, FEATURE_AI_REPORTS } from "@/lib/constants/billing";
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
				<UpgradePrompt feature={FEATURE_AI_CHAT}>
					<ChatInterface mode={mode} onModeChange={setMode} />
				</UpgradePrompt>
			) : (
				<UpgradePrompt feature={FEATURE_AI_REPORTS}>
					<ReportInterface mode={mode} onModeChange={setMode} />
				</UpgradePrompt>
			)}
		</div>
	);
}
