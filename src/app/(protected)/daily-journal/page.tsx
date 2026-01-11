"use client";

import { useEffect, useState } from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";

// =============================================================================
// LOCAL STORAGE KEY
// =============================================================================

const PANEL_SIZE_KEY = "daily-journal-panel-sizes";

function getStoredSizes(): number[] {
	if (typeof window === "undefined") return [30, 70];
	try {
		const stored = localStorage.getItem(PANEL_SIZE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed) && parsed.length === 2) {
				return parsed as number[];
			}
		}
	} catch {
		// Ignore parsing errors
	}
	return [30, 70];
}

function saveSizes(sizes: number[]) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(sizes));
	} catch {
		// Ignore storage errors
	}
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DailyJournalPage() {
	// Selected date state
	// setSelectedDate will be used by DateNavigation and CalendarSidebar components (US-022, US-023)
	const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
	void setSelectedDate; // Mark as used - will be passed to child components

	// Panel sizes from localStorage [left, right]
	const [panelSizes, setPanelSizes] = useState<number[]>([30, 70]);

	useEffect(() => {
		setPanelSizes(getStoredSizes());
	}, []);

	const handleLayoutChange = (sizes: number[]) => {
		setPanelSizes(sizes);
		saveSizes(sizes);
	};

	return (
		<div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
			{/* Header */}
			<div className="flex shrink-0 items-center justify-between border-border border-b bg-background px-4 py-3">
				<div>
					<span className="mb-1 block font-mono text-primary text-xs uppercase tracking-wider">
						Daily Journal
					</span>
					<h1 className="font-bold text-2xl tracking-tight">
						{selectedDate.toLocaleDateString("en-US", {
							weekday: "long",
							month: "long",
							day: "numeric",
							year: "numeric",
						})}
					</h1>
				</div>
			</div>

			{/* Resizable Panels */}
			<ResizablePanelGroup
				className="h-full min-h-0 flex-1"
				direction="horizontal"
				onLayout={handleLayoutChange}
			>
				{/* LEFT PANEL - Calendar and Checklist (30%) */}
				<ResizablePanel
					className="min-w-0 overflow-hidden border-border border-r"
					defaultSize={panelSizes[0]}
					maxSize={50}
					minSize={15}
				>
					<div className="h-full overflow-y-auto p-4">
						{/* Calendar placeholder */}
						<div className="mb-4 rounded border border-white/5 bg-white/[0.01] p-4">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Calendar
							</span>
							<div className="mt-2 font-mono text-muted-foreground text-xs">
								Calendar component will go here
							</div>
						</div>

						{/* Checklist placeholder */}
						<div className="rounded border border-white/5 bg-white/[0.01] p-4">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Daily Checklist
							</span>
							<div className="mt-2 font-mono text-muted-foreground text-xs">
								Checklist component will go here
							</div>
						</div>
					</div>
				</ResizablePanel>

				<ResizableHandle withHandle />

				{/* RIGHT PANEL - Editor and Attachments (70%) */}
				<ResizablePanel
					className="min-w-0 overflow-hidden"
					defaultSize={panelSizes[1]}
					minSize={30}
				>
					<div className="h-full overflow-y-auto p-4">
						{/* Editor placeholder */}
						<div className="mb-4 rounded border border-white/5 bg-white/[0.01] p-4">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Journal Editor
							</span>
							<div className="mt-2 min-h-[200px] font-mono text-muted-foreground text-xs">
								Rich text editor will go here
							</div>
						</div>

						{/* Attachments placeholder */}
						<div className="rounded border border-white/5 bg-white/[0.01] p-4">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Attachments
							</span>
							<div className="mt-2 font-mono text-muted-foreground text-xs">
								Attachment upload and gallery will go here
							</div>
						</div>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
