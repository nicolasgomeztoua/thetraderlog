"use client";

import { ShieldIcon } from "lucide-react";
import { useAccount } from "@/contexts/account-context";
import type { ComplianceStatus } from "@/lib/constants/prop";
import {
	COMPLIANCE_STATUS_COLORS,
	DRAWDOWN_TYPE_LABELS,
	isPropAccountType,
} from "@/lib/constants/prop";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";

/** Compact progress bar for prop compliance metrics */
function ComplianceBar({
	label,
	current,
	limit,
	status,
	formatValue = (v) => formatCurrency(v),
	"data-testid": testId,
}: {
	label: string;
	current: number;
	limit: number;
	status: ComplianceStatus;
	formatValue?: (value: number) => string;
	"data-testid"?: string;
}) {
	const progress = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
	const barColor =
		status === "danger"
			? "bg-loss"
			: status === "caution"
				? "bg-primary"
				: "bg-profit";

	return (
		<div data-testid={testId}>
			<div className="mb-1 flex items-center justify-between">
				<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
					{label}
				</span>
				<span
					className={cn(
						"font-mono text-[10px]",
						COMPLIANCE_STATUS_COLORS[status],
					)}
				>
					{formatValue(current)} / {formatValue(limit)}
				</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded bg-muted/300">
				<div
					className={cn(barColor, "h-full transition-all duration-300")}
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
}

/** Small circular drawdown gauge */
function DrawdownGauge({
	used,
	status,
}: {
	used: number;
	status: ComplianceStatus;
}) {
	const size = 56;
	const strokeWidth = 5;
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const percent = Math.min(Math.max(used, 0), 1);
	const offset = circumference - percent * circumference;

	const strokeColor =
		status === "danger"
			? "stroke-loss"
			: status === "caution"
				? "stroke-primary"
				: "stroke-profit";

	return (
		<div className="relative" data-testid="prop-status-drawdown-gauge">
			<svg
				aria-hidden="true"
				className="-rotate-90 transform"
				height={size}
				width={size}
			>
				<circle
					className="stroke-white/10"
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					strokeWidth={strokeWidth}
				/>
				<circle
					className={cn(strokeColor, "transition-all duration-500")}
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
			<div className="absolute inset-0 flex items-center justify-center">
				<span
					className={cn(
						"font-mono font-semibold text-sm",
						COMPLIANCE_STATUS_COLORS[status],
					)}
				>
					{Math.round(percent * 100)}%
				</span>
			</div>
		</div>
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
			className={cn("inline-block h-2 w-2 rounded-full", dotColor)}
			data-testid="prop-status-indicator"
		/>
	);
}

/**
 * Prop Challenge Status Widget for the Command Center dashboard.
 *
 * Shows compact overview of prop compliance:
 * - Drawdown gauge (current % vs max %, color-coded)
 * - Daily P&L vs daily loss limit progress bar
 * - Profit target progress bar with percentage
 * - Trading days X/Y count
 * - Days remaining countdown
 * - Overall status indicator (safe/caution/danger)
 *
 * Only renders when selected account is prop_challenge or prop_funded.
 */
export function PropStatusWidget() {
	const { selectedAccountId, selectedAccount } = useAccount();

	const isProp = isPropAccountType(selectedAccount?.accountType);

	const { data, isLoading } = api.accounts.getPropCompliance.useQuery(
		{ accountId: selectedAccountId ?? "" },
		{ enabled: isProp && !!selectedAccountId, staleTime: 30000 },
	);

	if (!isProp) return null;

	return (
		<DashboardWidget
			data-testid="widget-prop-status"
			href="/prop"
			icon={ShieldIcon}
			loading={isLoading}
			skeletonVariant="metrics"
			title="prop-compliance"
		>
			{!data ? (
				<WidgetEmptyState icon={ShieldIcon} message="No compliance data" />
			) : (
				<div className="flex h-full flex-col" data-testid="prop-status-content">
					{/* Top: Drawdown gauge + overall status */}
					<div className="flex items-center gap-3">
						<DrawdownGauge
							status={data.drawdown.status}
							used={data.drawdown.used}
						/>
						<div className="flex-1">
							<div className="flex items-center gap-1.5">
								<StatusDot status={data.overallStatus} />
								<span
									className={cn(
										"font-mono font-semibold text-xs uppercase",
										COMPLIANCE_STATUS_COLORS[data.overallStatus],
									)}
								>
									{data.overallStatus}
								</span>
							</div>
							<div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
								{DRAWDOWN_TYPE_LABELS[data.drawdown.type] ?? data.drawdown.type}{" "}
								DD: {data.drawdown.current.toFixed(1)}% / {data.drawdown.limit}%
							</div>
						</div>
					</div>

					{/* Progress bars */}
					<div className="mt-3 space-y-2 border-border/50 border-t pt-3">
						<ComplianceBar
							current={Math.abs(data.dailyLoss.todayPnl)}
							data-testid="prop-status-daily-loss"
							formatValue={(v) => formatCurrency(v)}
							label="Daily Loss"
							limit={data.dailyLoss.limit}
							status={data.dailyLoss.status}
						/>
						<ComplianceBar
							current={data.profitTarget.current}
							data-testid="prop-status-profit-target"
							formatValue={(v) => formatCurrency(v)}
							label="Profit Target"
							limit={data.profitTarget.target}
							status={data.profitTarget.status}
						/>
					</div>

					{/* Bottom stats */}
					<div className="mt-3 flex items-center justify-between border-border/50 border-t pt-2">
						<div data-testid="prop-status-trading-days">
							<div className="font-mono font-semibold text-sm">
								{data.tradingDays.daysTraded}/{data.tradingDays.minRequired}
							</div>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
								Days Traded
							</div>
						</div>
						{data.timeline.daysRemaining !== null && (
							<div
								className="text-right"
								data-testid="prop-status-days-remaining"
							>
								<div
									className={cn(
										"font-mono font-semibold text-sm",
										data.timeline.daysRemaining <= 7
											? "text-loss"
											: "text-muted-foreground",
									)}
								>
									{data.timeline.daysRemaining}d
								</div>
								<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
									Remaining
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</DashboardWidget>
	);
}
