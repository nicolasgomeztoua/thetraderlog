"use client";

import {
	BookOpenIcon,
	CheckCircle2Icon,
	FlameIcon,
	Loader2Icon,
	PlayIcon,
	PlusIcon,
	UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";

// Journaling streak component with flame icon
function JournalingStreak() {
	const { data: streakData, isLoading } = api.dailyJournal.getStreak.useQuery();

	if (isLoading) {
		return <Skeleton className="h-6 w-20" />;
	}

	const streak = streakData?.streak ?? 0;

	return (
		<div className="flex items-center gap-2">
			<FlameIcon
				className={`h-5 w-5 ${streak > 0 ? "text-breakeven" : "text-muted-foreground"}`}
			/>
			<span className="font-mono text-sm">
				<span
					className={streak > 0 ? "text-breakeven" : "text-muted-foreground"}
				>
					{streak}
				</span>
				<span className="ml-1 text-muted-foreground">
					{streak === 1 ? "day" : "days"}
				</span>
			</span>
		</div>
	);
}

// Quick actions bar with Log Trade and Import CSV buttons
function QuickActionsBar() {
	return (
		<div className="flex items-center gap-3">
			<Button asChild className="font-mono" size="sm">
				<Link href="/trade/new">
					<PlusIcon className="mr-2 h-4 w-4" />
					Log Trade
				</Link>
			</Button>
			<Button asChild className="font-mono" size="sm" variant="outline">
				<Link href="/import">
					<UploadIcon className="mr-2 h-4 w-4" />
					Import CSV
				</Link>
			</Button>
		</div>
	);
}

function StartJournalHero() {
	const router = useRouter();
	const today = toDateString(new Date());

	const { data: journal, isLoading } = api.dailyJournal.getByDate.useQuery(
		{ date: today },
		{ staleTime: 30000 },
	);

	const utils = api.useUtils();
	const startDay = api.dailyJournal.startDay.useMutation({
		onSuccess: () => {
			// Invalidate all relevant queries so checklist shows forced items immediately
			utils.dailyJournal.getByDate.invalidate({ date: today });
			utils.dailyJournal.getWithTrades.invalidate({ date: today });
			router.push("/daily-journal");
		},
	});

	const handleStartJournal = () => {
		startDay.mutate({ date: today });
	};

	const isStarted = journal?.dayStartedAt !== null;
	const isStarting = startDay.isPending;

	if (isLoading) {
		return (
			<div className="rounded border border-border bg-card p-4 sm:p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<Skeleton className="mb-2 h-4 w-32" />
						<Skeleton className="h-6 w-48" />
					</div>
					<Skeleton className="h-10 w-full sm:w-40" />
				</div>
			</div>
		);
	}

	return (
		<div className="rounded border border-primary/30 bg-linear-to-r from-primary/5 to-transparent p-4 sm:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						{new Date().toLocaleDateString("en-US", {
							weekday: "long",
							month: "long",
							day: "numeric",
						})}
					</span>
					{isStarted ? (
						<div className="mt-1 flex items-center gap-2">
							<CheckCircle2Icon className="h-5 w-5 text-profit" />
							<span className="font-mono font-semibold text-lg">
								Journal Started
							</span>
							<span className="font-mono text-muted-foreground text-xs">
								{journal?.dayStartedAt &&
									new Date(journal.dayStartedAt).toLocaleTimeString("en-US", {
										hour: "numeric",
										minute: "2-digit",
									})}
							</span>
						</div>
					) : (
						<p className="mt-1 font-mono text-lg">
							Ready to start your trading day?
						</p>
					)}
				</div>
				{isStarted ? (
					<Button
						className="w-full font-mono sm:w-auto"
						onClick={() => router.push("/daily-journal")}
						variant="outline"
					>
						<BookOpenIcon className="mr-2 h-4 w-4" />
						<span className="sm:hidden">Journal</span>
						<span className="hidden sm:inline">Open Journal</span>
					</Button>
				) : (
					<Button
						className="w-full font-mono sm:w-auto"
						disabled={isStarting}
						onClick={handleStartJournal}
					>
						{isStarting ? (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<PlayIcon className="mr-2 h-4 w-4" />
						)}
						<span className="sm:hidden">Start</span>
						<span className="hidden sm:inline">Start My Journal</span>
					</Button>
				)}
			</div>
		</div>
	);
}

export default function DashboardPage() {
	return (
		<div className="space-y-6">
			{/* Start Journal Hero */}
			<StartJournalHero />

			{/* Header with Command Center label, Dashboard title, streak, and quick actions */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<span className="mb-2 block font-mono text-primary text-xs uppercase tracking-wider">
						Command Center
					</span>
					<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
						Dashboard
					</h1>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
					<JournalingStreak />
					<QuickActionsBar />
				</div>
			</div>
		</div>
	);
}
