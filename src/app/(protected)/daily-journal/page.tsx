"use client";

import { CheckCircleIcon, Loader2Icon, PlayIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AttachmentGallery } from "@/components/daily-journal/attachment-gallery";
import { AttachmentUpload } from "@/components/daily-journal/attachment-upload";
import { CalendarSidebar } from "@/components/daily-journal/calendar-sidebar";
import { ChecklistSettings } from "@/components/daily-journal/checklist-settings";
import { DailyChecklist } from "@/components/daily-journal/daily-checklist";
import { DateNavigation } from "@/components/daily-journal/date-navigation";
import { JournalEditor } from "@/components/daily-journal/journal-editor";
import { TradesSummary } from "@/components/daily-journal/trades-summary";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";

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
	const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

	// Panel sizes from localStorage [left, right]
	const [panelSizes, setPanelSizes] = useState<number[]>([30, 70]);

	// Checklist settings modal state
	const [isChecklistSettingsOpen, setIsChecklistSettingsOpen] = useState(false);

	// Date string for API queries - preserves the calendar date as clicked
	const dateString = toDateString(selectedDate);
	const todayString = toDateString(new Date());
	const isToday = dateString === todayString;

	const { data: journal } = api.dailyJournal.getByDate.useQuery(
		{ date: dateString },
		{ enabled: !!dateString },
	);

	const utils = api.useUtils();
	const startDay = api.dailyJournal.startDay.useMutation({
		onSuccess: () => {
			utils.dailyJournal.getByDate.invalidate({ date: dateString });
		},
	});

	const handleStartJournal = () => {
		startDay.mutate({ date: dateString });
	};

	const isStarted = journal?.dayStartedAt !== null;
	const isStarting = startDay.isPending;

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
				<div className="flex items-end gap-4">
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
					{/* Start My Journal button - only show for today */}
					{isToday && journal && (
						<div className="ml-4">
							{isStarted ? (
								<div className="mb-0.5 flex items-center gap-1.5 rounded border border-profit/20 bg-profit/5 px-3 py-1.5">
									<CheckCircleIcon className="h-4 w-4 text-profit" />
									<span className="font-mono text-profit text-sm">
										Journal Started
									</span>
									{journal.dayStartedAt && (
										<span className="font-mono text-muted-foreground text-xs">
											{new Date(journal.dayStartedAt).toLocaleTimeString(
												"en-US",
												{ hour: "numeric", minute: "2-digit" },
											)}
										</span>
									)}
								</div>
							) : (
								<Button
									className="font-mono"
									disabled={isStarting}
									onClick={handleStartJournal}
									size="sm"
								>
									{isStarting ? (
										<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<PlayIcon className="mr-2 h-4 w-4" />
									)}
									Start My Journal
								</Button>
							)}
						</div>
					)}
				</div>
				<DateNavigation date={selectedDate} onDateChange={setSelectedDate} />
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
						{/* Calendar */}
						<div className="mb-4 rounded border border-white/5 bg-white/1 p-4">
							<CalendarSidebar
								onDateSelect={setSelectedDate}
								selectedDate={selectedDate}
							/>
						</div>

						{/* Checklist */}
						<div className="mb-4 rounded border border-white/5 bg-white/1 p-4">
							<DailyChecklist
								onOpenSettings={() => setIsChecklistSettingsOpen(true)}
								selectedDate={selectedDate}
							/>
						</div>

						{/* Trades Summary */}
						<div className="rounded border border-white/5 bg-white/1 p-4">
							<TradesSummary selectedDate={selectedDate} />
						</div>

						{/* Checklist Settings Modal */}
						<ChecklistSettings
							onOpenChange={setIsChecklistSettingsOpen}
							open={isChecklistSettingsOpen}
						/>
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
						{/* Journal Editor */}
						<div className="mb-4 rounded border border-white/5 bg-white/1 p-4">
							<span className="mb-3 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Journal Entry
							</span>
							<JournalEditor key={dateString} selectedDate={selectedDate} />
						</div>

						{/* Attachments */}
						<div className="rounded border border-white/5 bg-white/1 p-4">
							<AttachmentUpload
								journalId={journal?.id}
								selectedDate={selectedDate}
							/>
							{/* Gallery */}
							{journal?.attachments && journal.attachments.length > 0 && (
								<AttachmentGallery
									attachments={journal.attachments}
									className="mt-4 border-white/5 border-t pt-4"
									selectedDate={selectedDate}
								/>
							)}
						</div>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
