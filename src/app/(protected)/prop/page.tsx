"use client";

import { ShieldIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChallengeHistory } from "@/components/prop/challenge-history";
import { ComplianceGrid } from "@/components/prop/compliance-grid";
import { DrawdownChart } from "@/components/prop/drawdown-chart";
import { TradingDaysTimeline } from "@/components/prop/trading-days-timeline";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/contexts/account-context";
import type { ComplianceStatus } from "@/lib/constants/prop";
import {
	CHALLENGE_STATUS_LABELS,
	COMPLIANCE_STATUS_COLORS,
	isPropAccountType,
} from "@/lib/constants/prop";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

export default function PropPage() {
	const { accounts, selectedAccountId, setSelectedAccountId } = useAccount();

	// Filter to prop accounts only
	const propAccounts = useMemo(
		() => accounts.filter((a) => isPropAccountType(a.accountType)),
		[accounts],
	);

	// Local selected prop account ID
	const [propAccountId, setPropAccountId] = useState<string | null>(null);

	// Auto-select first prop account if current selection is not a prop account
	useEffect(() => {
		if (propAccounts.length === 0) return;

		// If the globally selected account is a prop account, use it
		const globalIsProp = propAccounts.some((a) => a.id === selectedAccountId);
		if (globalIsProp && selectedAccountId) {
			setPropAccountId(selectedAccountId);
			return;
		}

		// Otherwise, select the first prop account
		if (!propAccountId || !propAccounts.some((a) => a.id === propAccountId)) {
			setPropAccountId(propAccounts[0]?.id ?? null);
		}
	}, [propAccounts, selectedAccountId, propAccountId]);

	const selectedPropAccount = propAccounts.find((a) => a.id === propAccountId);

	const { data, isLoading } = api.accounts.getPropCompliance.useQuery(
		{ accountId: propAccountId ?? "" },
		{ enabled: !!propAccountId, staleTime: 30000 },
	);

	// Handle account change
	function handleAccountChange(accountId: string) {
		setPropAccountId(accountId);
		setSelectedAccountId(accountId);
	}

	// Empty state — no prop accounts
	if (propAccounts.length === 0) {
		return (
			<div className="space-y-6" data-testid="prop-page">
				<PropPageHeader />
				<div
					className="flex flex-col items-center justify-center rounded border border-white/5 bg-white/1 py-20"
					data-testid="prop-empty-state"
				>
					<ShieldIcon className="mb-4 h-10 w-10 text-muted-foreground/50" />
					<p className="font-mono text-muted-foreground text-sm">
						No prop accounts found
					</p>
					<p className="mt-1 font-mono text-muted-foreground/60 text-xs">
						Create a prop challenge or funded account in Settings to get started
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6" data-testid="prop-page">
			{/* Header with account selector */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<PropPageHeader />

				<div
					className="flex items-center gap-3"
					data-testid="prop-account-controls"
				>
					{/* Account selector */}
					<Select
						onValueChange={handleAccountChange}
						value={propAccountId ?? undefined}
					>
						<SelectTrigger
							className="w-[220px] border-white/10 bg-white/2 font-mono text-xs"
							data-testid="prop-account-selector"
						>
							<SelectValue placeholder="Select account" />
						</SelectTrigger>
						<SelectContent>
							{propAccounts.map((account) => (
								<SelectItem
									className="font-mono text-xs"
									key={account.id}
									value={account.id}
								>
									{account.name}
									{account.accountType === "prop_funded" && (
										<span className="ml-1 text-muted-foreground">(Funded)</span>
									)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Challenge status badge */}
					{selectedPropAccount?.challengeStatus && (
						<ChallengeStatusBadge
							status={selectedPropAccount.challengeStatus}
						/>
					)}
				</div>
			</div>

			{/* Phase indicator for funded accounts */}
			{selectedPropAccount?.linkedAccountId && (
				<div
					className="flex items-center gap-2 rounded border border-white/5 bg-white/1 px-4 py-2"
					data-testid="prop-phase-indicator"
				>
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Journey
					</span>
					<span className="font-mono text-muted-foreground text-xs">
						Challenge
					</span>
					<span className="font-mono text-primary text-xs">→</span>
					<span className="font-mono text-profit text-xs">Funded</span>
				</div>
			)}

			{/* Loading state */}
			{isLoading && <PropPageSkeleton />}

			{/* Data loaded — compliance content */}
			{!isLoading && data && (
				<div className="space-y-6" data-testid="prop-compliance-content">
					{/* Compliance summary bar */}
					<div className="rounded border border-white/5 bg-white/1 p-4">
						<div className="flex items-center gap-3">
							<StatusDot status={data.overallStatus} />
							<div>
								<span
									className={cn(
										"font-mono font-semibold text-sm uppercase",
										COMPLIANCE_STATUS_COLORS[data.overallStatus],
									)}
									data-testid="prop-overall-status"
								>
									{data.overallStatus}
								</span>
								<p className="font-mono text-[10px] text-muted-foreground">
									Overall compliance status for {data.account.name}
								</p>
							</div>
							<div className="ml-auto text-right">
								<div className="font-mono font-semibold text-sm">
									$
									{data.account.currentBalance.toLocaleString("en-US", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</div>
								<p className="font-mono text-[10px] text-muted-foreground">
									Current Balance
								</p>
							</div>
						</div>
					</div>

					{/* Compliance Grid — 4 metric cards */}
					<ComplianceGrid data={data} />

					{/* Drawdown chart + Trading days — 2-column on desktop */}
					<div className="grid gap-6 lg:grid-cols-2">
						<DrawdownChart
							dailyLossLimit={
								data.drawdown.limit > 0
									? (data.dailyLoss.limit / data.account.initialBalance) * 100
									: 0
							}
							equityCurve={data.drawdown.equityCurve}
							initialBalance={data.account.initialBalance}
							maxDrawdownPercent={data.drawdown.limit}
						/>
						<TradingDaysTimeline
							timeline={data.timeline}
							tradingDays={data.tradingDays}
						/>
					</div>

					{/* Challenge History */}
					<ChallengeHistory
						onSelectAccount={handleAccountChange}
						selectedAccountId={propAccountId}
					/>
				</div>
			)}

			{/* No data state */}
			{!isLoading && !data && propAccountId && (
				<div
					className="flex flex-col items-center justify-center rounded border border-white/5 bg-white/1 py-16"
					data-testid="prop-no-data"
				>
					<ShieldIcon className="mb-3 h-8 w-8 text-muted-foreground/50" />
					<p className="font-mono text-muted-foreground text-sm">
						No compliance data available
					</p>
				</div>
			)}
		</div>
	);
}

/** Page header — reused across empty/loaded states */
function PropPageHeader() {
	return (
		<div>
			<span
				className="mb-1 block font-mono text-[10px] text-primary uppercase tracking-wider sm:mb-2 sm:text-xs"
				data-testid="prop-section-label"
			>
				Compliance
			</span>
			<h1
				className="font-bold text-2xl tracking-tight sm:text-3xl"
				data-testid="prop-heading"
			>
				Prop Compliance
			</h1>
			<p className="mt-1 hidden font-mono text-muted-foreground text-sm sm:block">
				Track your challenge progress, drawdown limits, and compliance metrics
			</p>
		</div>
	);
}

/** Challenge status badge */
function ChallengeStatusBadge({
	status,
}: {
	status: "active" | "passed" | "failed";
}) {
	const defaultColors = { text: "text-primary", bg: "bg-primary/10" };
	const colorMap: Record<string, { text: string; bg: string }> = {
		active: defaultColors,
		passed: { text: "text-profit", bg: "bg-profit/10" },
		failed: { text: "text-loss", bg: "bg-loss/10" },
	};

	const colors = colorMap[status] ?? defaultColors;

	return (
		<span
			className={cn(
				"inline-flex items-center rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
				colors.text,
				colors.bg,
			)}
			data-testid="prop-challenge-status-badge"
		>
			{CHALLENGE_STATUS_LABELS[status] ?? status}
		</span>
	);
}

/** Status indicator dot */
function StatusDot({ status }: { status: ComplianceStatus }) {
	const dotColor =
		status === "danger"
			? "bg-loss"
			: status === "caution"
				? "bg-primary"
				: "bg-profit";

	return (
		<span
			className={cn("inline-block h-2.5 w-2.5 rounded-full", dotColor)}
			data-testid="prop-status-dot"
		/>
	);
}

/** Loading skeleton for prop page */
function PropPageSkeleton() {
	return (
		<div className="space-y-6" data-testid="prop-loading-skeleton">
			{/* Summary bar skeleton */}
			<div className="rounded border border-white/5 bg-white/1 p-4">
				<div className="flex items-center gap-3">
					<Skeleton className="h-3 w-3 rounded-full" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-3 w-40" />
					</div>
					<div className="space-y-2 text-right">
						<Skeleton className="ml-auto h-4 w-24" />
						<Skeleton className="ml-auto h-3 w-16" />
					</div>
				</div>
			</div>

			{/* Grid skeleton — 4 metric cards */}
			<div className="grid gap-4 sm:grid-cols-2">
				{[...Array(4)].map((_, i) => (
					<div
						className="rounded border border-white/5 bg-white/1 p-4"
						key={`prop-skeleton-${i.toString()}`}
					>
						<Skeleton className="mb-3 h-3 w-24" />
						<Skeleton className="mb-2 h-8 w-16" />
						<Skeleton className="h-2 w-full" />
					</div>
				))}
			</div>

			{/* Chart + timeline skeleton — 2 columns on desktop */}
			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded border border-white/5 bg-white/1 p-4">
					<Skeleton className="mb-3 h-3 w-32" />
					<Skeleton className="h-[200px] w-full" />
				</div>
				<div className="rounded border border-white/5 bg-white/1 p-4">
					<Skeleton className="mb-3 h-3 w-28" />
					<Skeleton className="mb-4 h-4 w-full" />
					<Skeleton className="h-[160px] w-full" />
				</div>
			</div>

			{/* Challenge history skeleton */}
			<div className="rounded border border-white/5 bg-white/1 p-4">
				<Skeleton className="mb-4 h-3 w-36" />
				<div className="space-y-3">
					{[...Array(3)].map((_, i) => (
						<div
							className="flex items-center gap-3"
							key={`prop-history-skeleton-${i.toString()}`}
						>
							<Skeleton className="h-3 w-3 rounded-full" />
							<Skeleton className="h-4 w-40" />
							<Skeleton className="ml-auto h-3 w-20" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
