"use client";

import {
	BookOpenIcon,
	CheckCircle2Icon,
	Loader2Icon,
	PlayIcon,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/contexts/account-context";
import {
	cn,
	formatCurrency,
	getPnLColorClass,
	toDateString,
} from "@/lib/shared";
import { api } from "@/trpc/react";

// Circular progress component for gauges
function CircularProgress({
	value,
	max = 100,
	size = 80,
	strokeWidth = 8,
	color = "stroke-primary",
	bgColor = "stroke-white/10",
}: {
	value: number;
	max?: number;
	size?: number;
	strokeWidth?: number;
	color?: string;
	bgColor?: string;
}) {
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const percent = Math.min(Math.max(value / max, 0), 1);
	const offset = circumference - percent * circumference;

	return (
		<svg
			aria-hidden="true"
			className="-rotate-90 transform"
			height={size}
			width={size}
		>
			<title>Progress indicator</title>
			<circle
				className={bgColor}
				cx={size / 2}
				cy={size / 2}
				fill="none"
				r={radius}
				strokeWidth={strokeWidth}
			/>
			<circle
				className={cn(color, "transition-all duration-500")}
				cx={size / 2}
				cy={size / 2}
				fill="none"
				r={radius}
				strokeDasharray={circumference}
				strokeDashoffset={offset}
				strokeLinecap="round"
				strokeWidth={strokeWidth}
			/>
		</svg>
	);
}

// Mini bar for win/loss visualization
function WinLossBar({
	wins,
	losses,
	breakevens,
}: {
	wins: number;
	losses: number;
	breakevens: number;
}) {
	const total = wins + losses + breakevens;
	if (total === 0) return null;

	const winPercent = (wins / total) * 100;
	const bePercent = (breakevens / total) * 100;
	const lossPercent = (losses / total) * 100;

	return (
		<div className="flex h-2 w-full overflow-hidden rounded bg-white/5">
			<div
				className="bg-profit transition-all"
				style={{ width: `${winPercent}%` }}
			/>
			<div
				className="bg-breakeven transition-all"
				style={{ width: `${bePercent}%` }}
			/>
			<div
				className="bg-loss transition-all"
				style={{ width: `${lossPercent}%` }}
			/>
		</div>
	);
}

function StatCard({
	title,
	value,
	subtitle,
	icon: Icon,
	gauge,
	trend,
}: {
	title: string;
	value: string | number;
	subtitle?: string;
	icon?: React.ComponentType<{ className?: string }>;
	gauge?: { value: number; max: number; color: string };
	trend?: "up" | "down" | "neutral";
}) {
	return (
		<div className="rounded border border-border bg-card p-4 transition-all hover:border-primary/30">
			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					{title}
				</span>
				{Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
			</div>
			<div className="mt-2 flex items-center justify-between">
				<div>
					<div
						className={cn(
							"font-bold font-mono text-xl",
							trend === "up" && "text-profit",
							trend === "down" && "text-loss",
						)}
					>
						{value}
					</div>
					{subtitle && (
						<p className="mt-1 font-mono text-[10px] text-muted-foreground">
							{subtitle}
						</p>
					)}
				</div>
				{gauge && (
					<div className="relative flex items-center justify-center">
						<CircularProgress
							color={gauge.color}
							max={gauge.max}
							size={48}
							strokeWidth={5}
							value={gauge.value}
						/>
						<div className="absolute inset-0 flex items-center justify-center">
							<span className="font-mono font-semibold text-[10px]">
								{Math.round(gauge.value)}%
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function StatsGrid() {
	const { selectedAccountId } = useAccount();
	const { data: stats, isLoading } = api.trades.getStats.useQuery({
		accountId: selectedAccountId ?? undefined,
	});

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
				{[...Array(5)].map((_, i) => (
					<div
						className="rounded border border-border bg-secondary p-4"
						key={`skeleton-card-${i.toString()}`}
					>
						<Skeleton className="mb-3 h-3 w-16" />
						<Skeleton className="mb-2 h-6 w-20" />
						<Skeleton className="h-2 w-12" />
					</div>
				))}
			</div>
		);
	}

	if (!stats) return null;

	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
			<StatCard
				icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown}
				subtitle={`${stats.totalTrades} trades`}
				title="Net P&L"
				trend={stats.totalPnl >= 0 ? "up" : "down"}
				value={formatCurrency(stats.totalPnl)}
			/>
			<StatCard
				gauge={{
					value: stats.winRate,
					max: 100,
					color: stats.winRate >= 50 ? "stroke-profit" : "stroke-loss",
				}}
				subtitle={`${stats.wins}W · ${stats.losses}L · ${stats.breakevens}BE`}
				title="Win Rate"
				value={`${stats.winRate.toFixed(1)}%`}
			/>
			<StatCard
				gauge={{
					value: Math.min(stats.profitFactor * 33.33, 100),
					max: 100,
					color: stats.profitFactor >= 1 ? "stroke-profit" : "stroke-loss",
				}}
				subtitle="Gross P / Gross L"
				title="Profit Factor"
				value={
					stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)
				}
			/>
			<StatCard
				icon={TrendingUp}
				subtitle="Per winning trade"
				title="Avg Win"
				trend="up"
				value={formatCurrency(stats.avgWin)}
			/>
			<StatCard
				icon={TrendingDown}
				subtitle="Per losing trade"
				title="Avg Loss"
				trend="down"
				value={formatCurrency(stats.avgLoss)}
			/>
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

function PerformanceSummary() {
	const { selectedAccountId } = useAccount();
	const { data: stats } = api.trades.getStats.useQuery({
		accountId: selectedAccountId ?? undefined,
	});

	if (!stats || stats.totalTrades === 0) return null;

	return (
		<div className="overflow-hidden rounded border border-border bg-card">
			{/* Terminal header */}
			<div className="flex items-center justify-between border-border border-b bg-secondary/50 px-4 py-2">
				<div className="flex items-center gap-2">
					<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
					<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
					<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
				</div>
				<span className="font-mono text-[10px] text-muted-foreground">
					performance-summary
				</span>
				<div className="w-14" />
			</div>

			{/* Content */}
			<div className="space-y-4 p-4">
				{/* Win/Loss Distribution */}
				<div>
					<div className="mb-2 flex items-center justify-between">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Win/Loss Distribution
						</span>
						<div className="flex items-center gap-3 font-mono text-[10px]">
							<span className="flex items-center gap-1">
								<div className="h-2 w-2 rounded-full bg-profit" />
								{stats.wins}W
							</span>
							<span className="flex items-center gap-1">
								<div className="h-2 w-2 rounded-full bg-breakeven" />
								{stats.breakevens}BE
							</span>
							<span className="flex items-center gap-1">
								<div className="h-2 w-2 rounded-full bg-loss" />
								{stats.losses}L
							</span>
						</div>
					</div>
					<WinLossBar
						breakevens={stats.breakevens}
						losses={stats.losses}
						wins={stats.wins}
					/>
				</div>

				{/* Key Metrics */}
				<div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
					<div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Gross Profit
						</div>
						<div className="mt-1 font-bold font-mono text-lg text-profit">
							{formatCurrency(stats.grossProfit)}
						</div>
					</div>
					<div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Gross Loss
						</div>
						<div className="mt-1 font-bold font-mono text-lg text-loss">
							{formatCurrency(stats.grossLoss)}
						</div>
					</div>
				</div>

				{/* Expectancy */}
				<div className="border-border border-t pt-3">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Expectancy
						</span>
						<span
							className={cn(
								"font-bold font-mono",
								stats.totalTrades > 0
									? getPnLColorClass(stats.totalPnl / stats.totalTrades)
									: "text-muted-foreground",
							)}
						>
							{stats.totalTrades > 0
								? formatCurrency(stats.totalPnl / stats.totalTrades)
								: "-"}
							<span className="ml-1 font-normal text-muted-foreground text-xs">
								/trade
							</span>
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function DashboardPage() {
	const { selectedAccount } = useAccount();

	return (
		<div className="space-y-6">
			{/* Start Journal Hero */}
			<StartJournalHero />

			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<span className="mb-2 block font-mono text-primary text-xs uppercase tracking-wider">
						Dashboard
					</span>
					<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
						Trading Overview
					</h1>
					{selectedAccount && (
						<p className="mt-1 font-mono text-muted-foreground text-sm">
							{selectedAccount.name}
							{selectedAccount.broker && (
								<span className="text-muted-foreground/70">
									{" "}
									· {selectedAccount.broker}
								</span>
							)}
						</p>
					)}
				</div>
			</div>

			{/* Stats Row */}
			<StatsGrid />

			{/* Performance Summary */}
			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
				<PerformanceSummary />
			</div>
		</div>
	);
}
