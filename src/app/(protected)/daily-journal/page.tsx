"use client";

import { CheckCircleIcon, Loader2Icon, MenuIcon, PlayIcon } from "lucide-react";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
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

	// Mobile sidebar drawer state
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const isMobile = useMediaQuery("(max-width: 767px)");

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
			<div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-border border-b bg-background px-4 py-3">
				<div className="flex items-center gap-3">
					{/* Mobile menu button */}
					<Button
						className="md:hidden"
						onClick={() => setSidebarOpen(true)}
						size="icon-sm"
						variant="outline"
					>
						<MenuIcon className="size-4" />
					</Button>

					{/* Title section - stack on mobile */}
					<div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-4">
						<div>
							<span className="mb-1 block font-mono text-primary text-xs uppercase tracking-wider">
								Daily Journal
							</span>
							<h1 className="font-bold text-lg tracking-tight sm:text-2xl">
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
							<div className="sm:ml-4">
								{isStarted ? (
									<div className="mb-0.5 flex items-center gap-1.5 rounded border border-profit/20 bg-profit/5 px-2 py-1 sm:px-3 sm:py-1.5">
										<CheckCircleIcon className="h-4 w-4 text-profit" />
										<span className="font-mono text-profit text-xs sm:text-sm">
											Journal Started
										</span>
										{journal.dayStartedAt && (
											<span className="hidden font-mono text-muted-foreground text-xs sm:inline">
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
										<span className="hidden sm:inline">Start My Journal</span>
										<span className="sm:hidden">Start</span>
									</Button>
								)}
							</div>
						)}
					</div>
				</div>
				<DateNavigation date={selectedDate} onDateChange={setSelectedDate} />
			</div>

			{/* Mobile Sidebar Sheet */}
			<Sheet onOpenChange={setSidebarOpen} open={sidebarOpen}>
				<SheetContent className="w-[300px] overflow-y-auto p-0" side="left">
					<div className="px-4 pt-12 pb-4">
						{/* Calendar */}
						<div className="mb-4 rounded border border-white/5 bg-white/1 p-4">
							<CalendarSidebar
								onDateSelect={(date) => {
									setSelectedDate(date);
									setSidebarOpen(false);
								}}
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
					</div>
				</SheetContent>
			</Sheet>

			{/* Checklist Settings Modal - moved outside panels for accessibility */}
			<ChecklistSettings
				onOpenChange={setIsChecklistSettingsOpen}
				open={isChecklistSettingsOpen}
			/>

			{/* Main Content Area */}
			{isMobile ? (
				/* Mobile Layout - Editor Only */
				<div className="flex-1 overflow-y-auto p-4">
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
			) : (
				/* Desktop Layout - Resizable Panels */
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
			)}
		</div>
	);
}
