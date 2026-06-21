"use client";

import {
	BanknoteIcon,
	CalendarClockIcon,
	CheckIcon,
	InfoIcon,
	TrophyIcon,
	XIcon,
} from "lucide-react";
import type { PayoutEligibilityResult } from "@/lib/analytics/prop-compliance";
import { PAYOUT_CYCLE_TYPE } from "@/lib/constants/prop";
import { cn, formatCurrency } from "@/lib/shared";

// =============================================================================
// PAYOUT READINESS PANEL (funded accounts)
// Surfaces computePayoutEligibility: winning days, buffer/safety-net, cycle
// timer, windowed consistency, caps, and the capped, split-adjusted estimate.
// =============================================================================

interface PayoutReadinessPanelProps {
	payout: PayoutEligibilityResult;
}

/** A single pass/fail requirement row. */
function CheckRow({
	met,
	icon,
	label,
	value,
	hint,
}: {
	met: boolean;
	icon: React.ReactNode;
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div
			className="flex items-center gap-3 rounded border border-white/5 bg-white/1 px-3 py-2.5"
			data-testid="payout-check-row"
		>
			<span
				className={cn(
					"flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
					met ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
				)}
			>
				{met ? (
					<CheckIcon className="h-3 w-3" />
				) : (
					<XIcon className="h-3 w-3" />
				)}
			</span>
			<span className="text-muted-foreground/70">{icon}</span>
			<div className="min-w-0 flex-1">
				<p className="font-mono text-xs">{label}</p>
				{hint && (
					<p className="font-mono text-[10px] text-muted-foreground/60">
						{hint}
					</p>
				)}
			</div>
			<span
				className={cn(
					"shrink-0 font-mono text-xs",
					met ? "text-foreground" : "text-loss",
				)}
			>
				{value}
			</span>
		</div>
	);
}

export function PayoutReadinessPanel({ payout }: PayoutReadinessPanelProps) {
	const {
		eligible,
		winningDays,
		buffer,
		cycle,
		consistency,
		cap,
		splitPct,
		minWithdrawal,
		minWithdrawalMet,
		estimatedGross,
		estimatedNet,
		blockers,
		manualChecks,
	} = payout;

	const cycleLabel =
		cycle.type === PAYOUT_CYCLE_TYPE.WINNING_DAYS
			? "Winning days"
			: cycle.type === PAYOUT_CYCLE_TYPE.HOURS
				? "Hours in cycle"
				: "Days in cycle";

	return (
		<div
			className="rounded border border-white/5 bg-white/1 p-4"
			data-testid="payout-readiness-panel"
		>
			{/* Header */}
			<div className="mb-4 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<BanknoteIcon className="h-4 w-4 text-primary" />
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Payout Readiness
					</span>
				</div>
				<span
					className={cn(
						"inline-flex items-center rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
						eligible
							? "bg-profit/10 text-profit"
							: "bg-primary/10 text-primary",
					)}
					data-testid="payout-eligible-badge"
				>
					{eligible ? "Ready" : "Not yet eligible"}
				</span>
			</div>

			{/* Requirement checklist */}
			<div className="grid gap-2 sm:grid-cols-2">
				<CheckRow
					hint={
						winningDays.required > 0
							? `${winningDays.required} required`
							: "No requirement"
					}
					icon={<TrophyIcon className="h-3.5 w-3.5" />}
					label="Winning days"
					met={
						winningDays.required <= 0 ||
						winningDays.count >= winningDays.required
					}
					value={
						winningDays.required > 0
							? `${winningDays.count}/${winningDays.required}`
							: `${winningDays.count}`
					}
				/>
				<CheckRow
					hint={`Withdrawable ${formatCurrency(buffer.withdrawableProfit)}`}
					icon={<BanknoteIcon className="h-3.5 w-3.5" />}
					label="Buffer cleared"
					met={buffer.cleared}
					value={
						buffer.cleared
							? formatCurrency(buffer.withdrawableProfit)
							: `Floor ${formatCurrency(buffer.floor)}`
					}
				/>
				<CheckRow
					hint={
						cycle.nextEligibleAt
							? `Eligible ${cycle.nextEligibleAt.toLocaleDateString("en-US")}`
							: cycle.ready
								? "Cycle complete"
								: undefined
					}
					icon={<CalendarClockIcon className="h-3.5 w-3.5" />}
					label={cycleLabel}
					met={cycle.ready}
					value={`${cycle.elapsed}/${cycle.required}`}
				/>
				{consistency && (
					<CheckRow
						hint={`Best day ${consistency.currentRatio.toFixed(0)}% of total (max ${consistency.threshold}%)`}
						icon={<InfoIcon className="h-3.5 w-3.5" />}
						label="Payout consistency"
						met={consistency.compliant}
						value={
							consistency.compliant
								? "OK"
								: `+${formatCurrency(consistency.extraProfitNeeded)}`
						}
					/>
				)}
				<CheckRow
					hint={minWithdrawal > 0 ? formatCurrency(minWithdrawal) : "None"}
					icon={<BanknoteIcon className="h-3.5 w-3.5" />}
					label="Minimum withdrawal"
					met={minWithdrawalMet}
					value={minWithdrawalMet ? "Met" : "Below min"}
				/>
				{cap.capAmount != null && (
					<CheckRow
						hint={
							cap.lifetimeReached
								? "Lifetime payout limit reached"
								: `Capped at ${formatCurrency(cap.capAmount)} this payout`
						}
						icon={<InfoIcon className="h-3.5 w-3.5" />}
						label="Payout cap"
						met={!cap.lifetimeReached}
						value={formatCurrency(cap.capAmount)}
					/>
				)}
			</div>

			{/* Estimate */}
			<div className="mt-4 flex items-end justify-between rounded border border-white/5 bg-white/2 px-4 py-3">
				<div>
					<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Estimated payout
					</p>
					<p className="font-mono text-[10px] text-muted-foreground/60">
						{formatCurrency(estimatedGross)} gross × {splitPct}% split
					</p>
				</div>
				<span
					className={cn(
						"font-mono font-semibold text-lg",
						estimatedNet > 0 ? "text-profit" : "text-muted-foreground",
					)}
					data-testid="payout-estimate"
				>
					{formatCurrency(estimatedNet)}
				</span>
			</div>

			{/* Blockers */}
			{blockers.length > 0 && (
				<div className="mt-3" data-testid="payout-blockers">
					<p className="mb-1.5 font-mono text-[10px] text-loss uppercase tracking-wider">
						Blocking payout
					</p>
					<ul className="space-y-1">
						{blockers.map((b) => (
							<li
								className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
								key={b}
							>
								<XIcon className="h-3 w-3 shrink-0 text-loss" />
								{b}
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Manual checks (needs live data) */}
			{manualChecks.length > 0 && (
				<div className="mt-3" data-testid="payout-manual-checks">
					<p className="mb-1.5 font-mono text-[10px] text-primary uppercase tracking-wider">
						Verify manually (needs live data)
					</p>
					<ul className="space-y-1">
						{manualChecks.map((m) => (
							<li
								className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground/70"
								key={m}
							>
								<InfoIcon className="h-3 w-3 shrink-0 text-primary/70" />
								{m}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
