"use client";

import {
	BookOpenIcon,
	CheckCircle2Icon,
	ClockIcon,
	Loader2Icon,
	PlayIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget } from "../dashboard-widget";

/**
 * Journal status states:
 * - not-started: No dayStartedAt, no content
 * - in-progress: dayStartedAt set OR has content, but checklist incomplete
 * - completed: dayStartedAt set AND checklist 100% complete
 */
type JournalStatus = "not-started" | "in-progress" | "completed";

function getJournalStatus(
	dayStartedAt: Date | null,
	content: string | null,
	checklistCompletion: number,
): JournalStatus {
	const hasStarted =
		dayStartedAt !== null || (content !== null && content.trim() !== "");

	if (!hasStarted) {
		return "not-started";
	}

	// Consider complete if checklist is 100%
	if (checklistCompletion >= 100) {
		return "completed";
	}

	return "in-progress";
}

function getWordCount(content: string | null): number {
	if (!content) return 0;
	// Strip HTML tags and count words
	const text = content.replace(/<[^>]*>/g, " ").trim();
	if (!text) return 0;
	return text.split(/\s+/).filter((word) => word.length > 0).length;
}

interface StatusConfig {
	label: string;
	icon: typeof CheckCircle2Icon;
	colorClass: string;
	bgClass: string;
}

const STATUS_CONFIG: Record<JournalStatus, StatusConfig> = {
	"not-started": {
		label: "Not Started",
		icon: ClockIcon,
		colorClass: "text-muted-foreground",
		bgClass: "bg-muted-foreground/10",
	},
	"in-progress": {
		label: "In Progress",
		icon: BookOpenIcon,
		colorClass: "text-primary",
		bgClass: "bg-primary/10",
	},
	completed: {
		label: "Completed",
		icon: CheckCircle2Icon,
		colorClass: "text-profit",
		bgClass: "bg-profit/10",
	},
};

/**
 * Journal Status Widget for the Command Center dashboard.
 *
 * Shows:
 * - Current journal status (Not Started / In Progress / Completed)
 * - Word count if started
 * - Checklist completion percentage
 * - Start/Continue Journal action button
 */
export function JournalStatusWidget() {
	const router = useRouter();
	const today = toDateString(new Date());

	// Get today's journal with trades (includes checklist items)
	const { data, isLoading } = api.dailyJournal.getWithTrades.useQuery(
		{ date: today },
		{ staleTime: 30000 },
	);

	const utils = api.useUtils();
	const startDay = api.dailyJournal.startDay.useMutation({
		onSuccess: () => {
			// Invalidate queries and navigate to journal
			utils.dailyJournal.getByDate.invalidate({ date: today });
			utils.dailyJournal.getWithTrades.invalidate({ date: today });
			router.push("/daily-journal");
		},
	});

	const handleStartJournal = () => {
		startDay.mutate({ date: today });
	};

	const handleContinueJournal = () => {
		router.push("/daily-journal");
	};

	// Calculate checklist completion
	// Combines user template checks (journal.checklistChecks) + forced items (forcedItems)
	const checklistCompletion = (() => {
		if (!data) return 0;

		const { journal, forcedItems } = data;
		const userChecks = journal?.checklistChecks ?? [];

		// Count user template checks (must have a templateId)
		const userCheckedCount = userChecks.filter(
			(check) => check.checked && check.templateId !== null,
		).length;
		const userTotalCount = userChecks.filter(
			(check) => check.templateId !== null,
		).length;

		// Count forced items
		const forcedCheckedCount = forcedItems.filter(
			(item) => item.checked,
		).length;
		const forcedTotalCount = forcedItems.length;

		const totalItems = userTotalCount + forcedTotalCount;
		const totalChecked = userCheckedCount + forcedCheckedCount;

		return totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
	})();

	const journal = data?.journal;
	const status = journal
		? getJournalStatus(
				journal.dayStartedAt,
				journal.content,
				checklistCompletion,
			)
		: "not-started";
	const wordCount = getWordCount(journal?.content ?? null);
	const config = STATUS_CONFIG[status];
	const StatusIcon = config.icon;

	const isStarting = startDay.isPending;

	return (
		<DashboardWidget
			data-testid="widget-journal-status"
			href="/daily-journal"
			icon={BookOpenIcon}
			loading={isLoading}
			skeletonVariant="status"
			title="journal-status"
		>
			<div className="flex h-full flex-col">
				{/* Status indicator */}
				<div className="flex items-center gap-3">
					<div
						className={cn(
							"flex h-10 w-10 items-center justify-center rounded-lg",
							config.bgClass,
						)}
					>
						<StatusIcon className={cn("h-5 w-5", config.colorClass)} />
					</div>
					<div>
						<div className={cn("font-mono font-semibold", config.colorClass)}>
							{config.label}
						</div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							{new Date().toLocaleDateString("en-US", {
								weekday: "long",
								month: "short",
								day: "numeric",
							})}
						</div>
					</div>
				</div>

				{/* Stats row - only show if started */}
				{status !== "not-started" && (
					<div className="mt-4 flex items-center gap-4">
						{/* Word count */}
						<div>
							<div className="font-mono font-semibold text-lg">{wordCount}</div>
							<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Words
							</div>
						</div>

						{/* Checklist completion */}
						<div className="h-8 w-px bg-white/10" />
						<div>
							<div
								className={cn(
									"font-mono font-semibold text-lg",
									checklistCompletion === 100
										? "text-profit"
										: checklistCompletion > 0
											? "text-primary"
											: "text-muted-foreground",
								)}
							>
								{checklistCompletion}%
							</div>
							<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Checklist
							</div>
						</div>
					</div>
				)}

				{/* Action button */}
				<div className="mt-auto pt-4">
					{status === "not-started" ? (
						<Button
							className="w-full font-mono"
							disabled={isStarting}
							onClick={handleStartJournal}
							size="sm"
						>
							{isStarting ? (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<PlayIcon className="mr-2 h-4 w-4" />
							)}
							Start Journal
						</Button>
					) : (
						<Button
							className="w-full font-mono"
							onClick={handleContinueJournal}
							size="sm"
							variant="outline"
						>
							<BookOpenIcon className="mr-2 h-4 w-4" />
							{status === "completed" ? "View Journal" : "Continue Journal"}
						</Button>
					)}
				</div>
			</div>
		</DashboardWidget>
	);
}
