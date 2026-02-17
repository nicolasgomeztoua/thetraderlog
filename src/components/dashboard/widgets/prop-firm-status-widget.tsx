"use client";

import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	LockIcon,
	ShieldAlertIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/contexts/account-context";
import { PROP_FIRM_LOCKED_PASSED } from "@/lib/constants/prop-firms";
import type { PropFirmRule, RuleStatus } from "@/lib/prop-firm/calculator";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";

/** Map rule status to color classes */
const STATUS_COLORS: Record<
	RuleStatus,
	{ text: string; bg: string; border: string }
> = {
	safe: { text: "text-profit", bg: "bg-profit", border: "border-profit/30" },
	warning: {
		text: "text-primary",
		bg: "bg-primary",
		border: "border-primary/30",
	},
	danger: { text: "text-loss", bg: "bg-loss", border: "border-loss/30" },
	violated: { text: "text-loss", bg: "bg-loss", border: "border-loss/50" },
};

/** Status badge labels */
const STATUS_LABELS: Record<RuleStatus, string> = {
	safe: "SAFE",
	warning: "WARNING",
	danger: "DANGER",
	violated: "VIOLATED",
};

/** Get the worst status from an array of rules (for overall badge) */
function getWorstStatus(rules: PropFirmRule[]): RuleStatus {
	if (rules.some((r) => r.status === "violated")) return "violated";
	if (rules.some((r) => r.status === "danger")) return "danger";
	if (rules.some((r) => r.status === "warning")) return "warning";
	return "safe";
}

/** Format rule values for display */
function formatRuleValue(rule: PropFirmRule): string {
	if (rule.type === "min_trading_days" || rule.type === "days_remaining") {
		return `${Math.round(rule.currentValue)} / ${rule.limit}`;
	}
	if (rule.type === "max_position_size") {
		return `${Math.round(rule.currentValue)} / ${rule.limit}`;
	}
	if (rule.type === "consistency") {
		return `${rule.currentValue.toFixed(1)}% / ${rule.limit}%`;
	}
	return `${formatCurrency(rule.currentValue)} / ${formatCurrency(rule.limit)}`;
}

/** Individual rule progress bar */
function RuleProgressBar({
	rule,
	testIdPrefix,
}: {
	rule: PropFirmRule;
	testIdPrefix: string;
}) {
	const colors = STATUS_COLORS[rule.status];
	const isPositiveProgress =
		rule.type === "profit_target" || rule.type === "min_trading_days";
	const clampedPercentage = Math.min(rule.percentage, 100);

	return (
		<div
			className="space-y-1"
			data-testid={`${testIdPrefix}-rule-${rule.type}`}
		>
			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					{rule.label}
				</span>
				<span className={cn("font-mono text-[10px]", colors.text)}>
					{formatRuleValue(rule)}
				</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded bg-muted/300">
				<div
					className={cn(
						"h-full transition-all duration-300",
						isPositiveProgress ? "bg-profit" : colors.bg,
					)}
					style={{ width: `${clampedPercentage}%` }}
				/>
			</div>
		</div>
	);
}

/** Overall status badge */
function StatusBadge({ status }: { status: RuleStatus }) {
	const colors = STATUS_COLORS[status];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
				colors.border,
				colors.text,
			)}
			data-testid="prop-firm-status-badge"
		>
			{status === "safe" && <CheckCircle2Icon className="h-3 w-3" />}
			{status === "warning" && <AlertTriangleIcon className="h-3 w-3" />}
			{(status === "danger" || status === "violated") && (
				<XCircleIcon className="h-3 w-3" />
			)}
			{STATUS_LABELS[status]}
		</span>
	);
}

/** Locked state display for passed/failed challenges */
function LockedState({
	reason,
	testIdPrefix,
}: {
	reason: string;
	testIdPrefix: string;
}) {
	const isPassed = reason === PROP_FIRM_LOCKED_PASSED;
	return (
		<div
			className="flex h-full flex-col items-center justify-center gap-2 py-4"
			data-testid={`${testIdPrefix}-locked`}
		>
			<LockIcon
				className={cn("h-8 w-8", isPassed ? "text-profit" : "text-loss")}
			/>
			<span
				className={cn(
					"font-mono font-semibold text-sm",
					isPassed ? "text-profit" : "text-loss",
				)}
			>
				{reason}
			</span>
		</div>
	);
}

/**
 * Prop Firm Status Dashboard Widget.
 *
 * Shows rule status for prop firm accounts with color-coded progress bars.
 * - Green (<80%): Safe
 * - Yellow (80-90%): Warning
 * - Red (90%+): Danger / Violated
 *
 * Features:
 * - Overall status badge (worst rule's status)
 * - Compact key metrics (drawdown, daily P&L, profit target)
 * - Expandable detailed view with all rules
 * - Account selector for multiple prop accounts
 * - Days remaining countdown
 * - Locked state for passed/failed challenges
 */
export function PropFirmStatusWidget() {
	const { accounts } = useAccount();
	const [expanded, setExpanded] = useState(false);

	// Filter prop accounts
	const propAccounts = accounts.filter(
		(a) =>
			a.accountType === "prop_challenge" || a.accountType === "prop_funded",
	);

	// Track selected prop account (default to first)
	const [selectedPropAccountId, setSelectedPropAccountId] = useState<
		string | null
	>(null);
	const activePropAccountId =
		selectedPropAccountId ?? propAccounts[0]?.id ?? null;

	// Fetch status for selected prop account
	const { data: status, isLoading } = api.propFirm.getStatus.useQuery(
		{ accountId: activePropAccountId ?? "" },
		{ enabled: activePropAccountId !== null, staleTime: 30000 },
	);

	// No prop accounts — show empty state
	if (propAccounts.length === 0) {
		return (
			<DashboardWidget
				data-testid="widget-prop-firm-status"
				icon={ShieldAlertIcon}
				title="prop-firm"
			>
				<div
					className="flex h-full flex-col items-center justify-center gap-3 py-4"
					data-testid="prop-firm-empty-state"
				>
					<WidgetEmptyState
						icon={ShieldAlertIcon}
						message="No prop firm accounts configured"
					/>
					<Link
						className="font-mono text-[10px] text-primary uppercase tracking-wider transition-colors hover:text-primary/80"
						data-testid="prop-firm-link-settings"
						href="/settings"
					>
						Configure in Settings →
					</Link>
				</div>
			</DashboardWidget>
		);
	}

	// Find active account info
	const activeAccount = propAccounts.find((a) => a.id === activePropAccountId);

	// Determine key metrics from rules
	const daysRule = status?.rules.find((r) => r.type === "days_remaining");

	// Compact rules: drawdown, daily loss, profit target (shown in compact view)
	const compactRuleTypes = new Set([
		"max_drawdown",
		"daily_loss",
		"profit_target",
	]);
	const compactRules =
		status?.rules.filter((r) => compactRuleTypes.has(r.type)) ?? [];
	const expandedRules =
		status?.rules.filter((r) => !compactRuleTypes.has(r.type)) ?? [];

	const overallStatus = status ? getWorstStatus(status.rules) : "safe";

	return (
		<DashboardWidget
			data-testid="widget-prop-firm-status"
			icon={ShieldAlertIcon}
			loading={isLoading}
			skeletonVariant="metrics"
			title="prop-firm"
		>
			{/* Locked state */}
			{status?.isLocked ? (
				<LockedState
					reason={status.lockedReason ?? "Locked"}
					testIdPrefix="prop-firm"
				/>
			) : (
				<div className="flex h-full flex-col">
					{/* Header: Account name + Status badge */}
					<div className="flex items-center justify-between">
						<div className="min-w-0 flex-1">
							{propAccounts.length > 1 ? (
								<select
									className="w-full truncate border-none bg-transparent font-mono text-[11px] text-foreground outline-none"
									data-testid="prop-firm-select-account"
									onChange={(e) => setSelectedPropAccountId(e.target.value)}
									value={activePropAccountId ?? ""}
								>
									{propAccounts.map((a) => (
										<option key={a.id} value={a.id}>
											{a.name}
										</option>
									))}
								</select>
							) : (
								<span
									className="font-mono text-[11px] text-foreground"
									data-testid="prop-firm-account-name"
								>
									{activeAccount?.name}
								</span>
							)}
						</div>
						{status && <StatusBadge status={overallStatus} />}
					</div>

					{/* Days remaining countdown */}
					{daysRule && (
						<div
							className={cn(
								"mt-2 flex items-center gap-1.5 font-mono text-[10px]",
								STATUS_COLORS[daysRule.status].text,
							)}
							data-testid="prop-firm-days-remaining"
						>
							<span>{Math.round(daysRule.currentValue)} days remaining</span>
							<span className="text-muted-foreground">
								/ {daysRule.limit} total
							</span>
						</div>
					)}

					{/* Compact key metrics */}
					{compactRules.length > 0 && (
						<div
							className="mt-3 space-y-2 border-border/50 border-t pt-3"
							data-testid="prop-firm-compact-rules"
						>
							{compactRules.map((rule) => (
								<RuleProgressBar
									key={rule.type}
									rule={rule}
									testIdPrefix="prop-firm"
								/>
							))}
						</div>
					)}

					{/* Expand/collapse for additional rules */}
					{expandedRules.length > 0 && (
						<>
							<button
								className="mt-2 flex items-center gap-1 font-mono text-[9px] text-muted-foreground uppercase tracking-wider transition-colors hover:text-foreground"
								data-testid="prop-firm-toggle-expand"
								onClick={() => setExpanded(!expanded)}
								type="button"
							>
								{expanded ? (
									<>
										<ChevronUpIcon className="h-3 w-3" />
										Hide Details
									</>
								) : (
									<>
										<ChevronDownIcon className="h-3 w-3" />
										Show All Rules ({expandedRules.length} more)
									</>
								)}
							</button>

							{expanded && (
								<div
									className="mt-2 space-y-2 border-border/50 border-t pt-2"
									data-testid="prop-firm-expanded-rules"
								>
									{expandedRules.map((rule) => (
										<RuleProgressBar
											key={rule.type}
											rule={rule}
											testIdPrefix="prop-firm"
										/>
									))}
								</div>
							)}
						</>
					)}
				</div>
			)}
		</DashboardWidget>
	);
}
