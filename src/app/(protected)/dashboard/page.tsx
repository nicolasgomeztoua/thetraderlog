"use client";

import {
	ArrowRightIcon,
	BookOpenIcon,
	CheckCircle2Icon,
	ClockIcon,
	FlameIcon,
	Loader2Icon,
	PlayIcon,
	PlusIcon,
	TrendingUpIcon,
	UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EVENT_IMPACT_COLORS } from "@/lib/constants";
import {
	formatDateInTimezone,
	formatPnL,
	getPnLColorClass,
	toDateString,
} from "@/lib/shared";
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

// Today's snapshot - quick summary of today's trading activity
function TodaysSnapshot() {
	const today = toDateString(new Date());

	const { data, isLoading } = api.dailyJournal.getWithTrades.useQuery(
		{ date: today },
		{ staleTime: 30000 },
	);

	if (isLoading) {
		return (
			<div className="rounded border border-border bg-card p-3">
				<Skeleton className="h-5 w-48" />
			</div>
		);
	}

	const trades = data?.trades ?? [];
	const tradeCount = trades.length;

	// Calculate total P&L from trades
	const totalPnL = trades.reduce((sum, trade) => {
		const pnl = trade.netPnl ? parseFloat(trade.netPnl) : 0;
		return sum + pnl;
	}, 0);

	if (tradeCount === 0) {
		return (
			<div className="rounded border border-border bg-card p-3">
				<span className="font-mono text-muted-foreground text-sm">
					No trades today
				</span>
			</div>
		);
	}

	return (
		<div className="rounded border border-border bg-card p-3">
			<span className="font-mono text-sm">
				<span className="text-muted-foreground">Today:</span>{" "}
				<span className="text-foreground">
					{tradeCount} {tradeCount === 1 ? "trade" : "trades"}
				</span>
				<span className="text-muted-foreground">,</span>{" "}
				<span className={getPnLColorClass(totalPnL)}>
					{formatPnL(totalPnL)}
				</span>
			</span>
		</div>
	);
}

// Economic Calendar Widget - displays today's economic events
function EconomicCalendarWidget() {
	const { data: events, isLoading } =
		api.economicCalendar.getTodayEvents.useQuery(
			undefined,
			{ staleTime: 60000 }, // 1 minute stale time
		);

	// Filter to show only high-impact events by default, show up to 5
	const displayedEvents = events?.slice(0, 5) ?? [];

	if (isLoading) {
		return (
			<div className="rounded border border-border bg-card">
				<div className="flex items-center justify-between border-border border-b p-3">
					<div className="flex items-center gap-2">
						<ClockIcon className="h-4 w-4 text-muted-foreground" />
						<span className="font-mono text-sm">Economic Calendar</span>
					</div>
				</div>
				<div className="space-y-3 p-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton className="h-5 w-full" key={`skeleton-${i.toString()}`} />
					))}
				</div>
			</div>
		);
	}

	if (displayedEvents.length === 0) {
		return (
			<div className="rounded border border-border bg-card">
				<div className="flex items-center justify-between border-border border-b p-3">
					<div className="flex items-center gap-2">
						<ClockIcon className="h-4 w-4 text-muted-foreground" />
						<span className="font-mono text-sm">Economic Calendar</span>
					</div>
				</div>
				<div className="p-3">
					<span className="font-mono text-muted-foreground text-sm">
						No high-impact events today
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded border border-border bg-card">
			<div className="flex items-center justify-between border-border border-b p-3">
				<div className="flex items-center gap-2">
					<ClockIcon className="h-4 w-4 text-muted-foreground" />
					<span className="font-mono text-sm">Economic Calendar</span>
				</div>
			</div>
			<div className="divide-y divide-border">
				{displayedEvents.map((event) => {
					const impactColors =
						EVENT_IMPACT_COLORS[event.impact] ?? EVENT_IMPACT_COLORS.low;
					const eventTime = new Date(event.eventTime);
					const timeStr = eventTime.toLocaleTimeString("en-US", {
						hour: "numeric",
						minute: "2-digit",
						hour12: true,
					});

					return (
						<div className="flex items-center gap-3 p-3" key={event.id}>
							{/* Currency badge */}
							<span
								className={`rounded px-1.5 py-0.5 font-mono text-xs ${impactColors.bg} ${impactColors.text}`}
							>
								{event.currency}
							</span>
							{/* Event name */}
							<span className="flex-1 truncate font-mono text-sm">
								{event.name}
							</span>
							{/* Time */}
							<span className="font-mono text-muted-foreground text-xs">
								{timeStr}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// Recent Trades Widget - displays recent trades with quick navigation
function RecentTradesWidget() {
	const { data: trades, isLoading } = api.trades.getRecent.useQuery(
		{ limit: 5 },
		{ staleTime: 30000 },
	);

	if (isLoading) {
		return (
			<div className="rounded border border-border bg-card">
				<div className="flex items-center justify-between border-border border-b p-3">
					<div className="flex items-center gap-2">
						<TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
						<span className="font-mono text-sm">Recent Trades</span>
					</div>
				</div>
				<div className="space-y-3 p-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton className="h-8 w-full" key={`skeleton-${i.toString()}`} />
					))}
				</div>
			</div>
		);
	}

	if (!trades || trades.length === 0) {
		return (
			<div className="rounded border border-border bg-card">
				<div className="flex items-center justify-between border-border border-b p-3">
					<div className="flex items-center gap-2">
						<TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
						<span className="font-mono text-sm">Recent Trades</span>
					</div>
				</div>
				<div className="p-3">
					<p className="font-mono text-muted-foreground text-sm">
						No trades yet.{" "}
						<Link className="text-primary hover:underline" href="/trade/new">
							Log your first trade
						</Link>
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded border border-border bg-card">
			<div className="flex items-center justify-between border-border border-b p-3">
				<div className="flex items-center gap-2">
					<TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
					<span className="font-mono text-sm">Recent Trades</span>
				</div>
				<Link
					className="flex items-center gap-1 font-mono text-primary text-xs hover:underline"
					href="/journal"
				>
					View All
					<ArrowRightIcon className="h-3 w-3" />
				</Link>
			</div>
			<div className="divide-y divide-border">
				{trades.map((trade) => {
					const pnl = trade.netPnl ? parseFloat(trade.netPnl) : 0;
					const isLong = trade.direction === "long";

					return (
						<Link
							className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50"
							href={`/journal/${trade.id}`}
							key={trade.id}
						>
							{/* Direction badge */}
							<span
								className={`rounded px-1.5 py-0.5 font-mono text-xs ${
									isLong ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"
								}`}
							>
								{isLong ? "LONG" : "SHORT"}
							</span>
							{/* Symbol */}
							<span className="font-medium font-mono text-sm">
								{trade.symbol}
							</span>
							{/* Date */}
							<span className="flex-1 font-mono text-muted-foreground text-xs">
								{formatDateInTimezone(trade.entryTime, "UTC", {
									format: "MMM d",
								})}
							</span>
							{/* P&L */}
							<span className={`font-mono text-sm ${getPnLColorClass(pnl)}`}>
								{formatPnL(pnl)}
							</span>
						</Link>
					);
				})}
			</div>
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

			{/* Today's Snapshot */}
			<TodaysSnapshot />

			{/* Two-column grid: Economic Calendar + Recent Trades */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				<EconomicCalendarWidget />
				<RecentTradesWidget />
			</div>
		</div>
	);
}
