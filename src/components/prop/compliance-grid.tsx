"use client";

import type { ComplianceStatus } from "@/lib/constants/prop";
import {
	COMPLIANCE_STATUS_COLORS,
	DRAWDOWN_TYPE_LABELS,
} from "@/lib/constants/prop";
import { cn, formatCurrency } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

interface ComplianceData {
	drawdown: {
		current: number;
		limit: number;
		used: number;
		remaining: number;
		type: string;
		status: ComplianceStatus;
	};
	dailyLoss: {
		todayPnl: number;
		limit: number;
		used: number;
		remaining: number;
		status: ComplianceStatus;
	};
	profitTarget: {
		current: number;
		target: number;
		progress: number;
		status: ComplianceStatus;
	};
	consistency: {
		maxDayPercent: number;
		limit: number;
		isCompliant: boolean;
	};
}

// =============================================================================
// SHARED HELPERS
// =============================================================================

function StatusDot({ status }: { status: ComplianceStatus }) {
	const dotColor =
		status === "danger"
			? "bg-loss"
			: status === "caution"
				? "bg-primary"
				: "bg-profit";

	return <span className={cn("inline-block h-2 w-2 rounded-full", dotColor)} />;
}

function ComplianceCardShell({
	children,
	"data-testid": testId,
}: {
	children: React.ReactNode;
	"data-testid"?: string;
}) {
	return (
		<div
			className="rounded border border-white/5 bg-white/1 p-4 transition-all hover:border-white/10"
			data-testid={testId}
		>
			{children}
		</div>
	);
}

// =============================================================================
// DRAWDOWN GAUGE (circular)
// =============================================================================

function DrawdownGauge({
	used,
	status,
}: {
	used: number;
	status: ComplianceStatus;
}) {
	const size = 80;
	const strokeWidth = 7;
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
		<div className="relative" data-testid="compliance-drawdown-gauge">
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
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span
					className={cn(
						"font-mono font-semibold text-lg",
						COMPLIANCE_STATUS_COLORS[status],
					)}
				>
					{Math.round(percent * 100)}%
				</span>
				<span className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider">
					Used
				</span>
			</div>
		</div>
	);
}

// =============================================================================
// PROGRESS BAR
// =============================================================================

function MetricProgressBar({
	percent,
	status,
}: {
	percent: number;
	status: ComplianceStatus;
}) {
	const clamped = Math.min(Math.max(percent, 0), 100);
	const barColor =
		status === "danger"
			? "bg-loss"
			: status === "caution"
				? "bg-primary"
				: "bg-profit";

	return (
		<div className="h-1.5 overflow-hidden rounded bg-white/5">
			<div
				className={cn(barColor, "h-full transition-all duration-300")}
				style={{ width: `${clamped}%` }}
			/>
		</div>
	);
}

// =============================================================================
// CARD 1: MAX DRAWDOWN
// =============================================================================

function MaxDrawdownCard({
	drawdown,
}: {
	drawdown: ComplianceData["drawdown"];
}) {
	return (
		<ComplianceCardShell data-testid="compliance-card-drawdown">
			<div className="mb-3 flex items-center gap-2">
				<StatusDot status={drawdown.status} />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Max Drawdown
				</span>
				<span className="ml-auto font-mono text-[10px] text-muted-foreground">
					{DRAWDOWN_TYPE_LABELS[drawdown.type] ?? drawdown.type}
				</span>
			</div>

			<div className="flex items-center gap-4">
				<DrawdownGauge status={drawdown.status} used={drawdown.used} />
				<div className="flex-1 space-y-1.5">
					<div className="flex items-baseline justify-between">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Current
						</span>
						<span
							className={cn(
								"font-mono font-semibold text-sm",
								COMPLIANCE_STATUS_COLORS[drawdown.status],
							)}
						>
							{drawdown.current.toFixed(2)}%
						</span>
					</div>
					<div className="flex items-baseline justify-between">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Limit
						</span>
						<span className="font-mono text-muted-foreground text-sm">
							{drawdown.limit.toFixed(2)}%
						</span>
					</div>
					<div className="flex items-baseline justify-between">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Remaining
						</span>
						<span className="font-mono text-muted-foreground text-sm">
							{drawdown.remaining.toFixed(2)}%
						</span>
					</div>
				</div>
			</div>
		</ComplianceCardShell>
	);
}

// =============================================================================
// CARD 2: DAILY LOSS
// =============================================================================

function DailyLossCard({
	dailyLoss,
}: {
	dailyLoss: ComplianceData["dailyLoss"];
}) {
	const usedPercent = dailyLoss.limit > 0 ? dailyLoss.used * 100 : 0;

	return (
		<ComplianceCardShell data-testid="compliance-card-daily-loss">
			<div className="mb-3 flex items-center gap-2">
				<StatusDot status={dailyLoss.status} />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Daily Loss
				</span>
			</div>

			<div className="mb-3 flex items-baseline justify-between">
				<span
					className={cn(
						"font-mono font-semibold text-2xl",
						COMPLIANCE_STATUS_COLORS[dailyLoss.status],
					)}
				>
					{formatCurrency(Math.abs(dailyLoss.todayPnl))}
				</span>
				<span className="font-mono text-muted-foreground text-sm">
					/ {formatCurrency(dailyLoss.limit)}
				</span>
			</div>

			<MetricProgressBar percent={usedPercent} status={dailyLoss.status} />

			<div className="mt-2 flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground">
					{Math.round(usedPercent)}% used
				</span>
				<span className="font-mono text-[10px] text-muted-foreground">
					{formatCurrency(dailyLoss.remaining)} remaining
				</span>
			</div>
		</ComplianceCardShell>
	);
}

// =============================================================================
// CARD 3: PROFIT TARGET
// =============================================================================

function ProfitTargetCard({
	profitTarget,
}: {
	profitTarget: ComplianceData["profitTarget"];
}) {
	const progressPercent = Math.min(profitTarget.progress * 100, 100);

	return (
		<ComplianceCardShell data-testid="compliance-card-profit-target">
			<div className="mb-3 flex items-center gap-2">
				<StatusDot status={profitTarget.status} />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Profit Target
				</span>
			</div>

			<div className="mb-3 flex items-baseline justify-between">
				<span
					className={cn(
						"font-mono font-semibold text-2xl",
						COMPLIANCE_STATUS_COLORS[profitTarget.status],
					)}
				>
					{formatCurrency(profitTarget.current)}
				</span>
				<span className="font-mono text-muted-foreground text-sm">
					/ {formatCurrency(profitTarget.target)}
				</span>
			</div>

			<MetricProgressBar
				percent={progressPercent}
				status={profitTarget.status}
			/>

			<div className="mt-2 flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground">
					{progressPercent.toFixed(1)}% complete
				</span>
				<span className="font-mono text-[10px] text-muted-foreground">
					{formatCurrency(
						Math.max(profitTarget.target - profitTarget.current, 0),
					)}{" "}
					to go
				</span>
			</div>
		</ComplianceCardShell>
	);
}

// =============================================================================
// CARD 4: CONSISTENCY RULE
// =============================================================================

function ConsistencyCard({
	consistency,
}: {
	consistency: ComplianceData["consistency"];
}) {
	const status: ComplianceStatus = consistency.isCompliant ? "safe" : "danger";

	// Show how close the max day is to the consistency limit
	const usedPercent =
		consistency.limit > 0
			? Math.min((consistency.maxDayPercent / consistency.limit) * 100, 100)
			: 0;

	return (
		<ComplianceCardShell data-testid="compliance-card-consistency">
			<div className="mb-3 flex items-center gap-2">
				<StatusDot status={status} />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Consistency Rule
				</span>
			</div>

			<div className="mb-3 flex items-baseline justify-between">
				<span
					className={cn(
						"font-mono font-semibold text-2xl",
						COMPLIANCE_STATUS_COLORS[status],
					)}
				>
					{consistency.maxDayPercent.toFixed(1)}%
				</span>
				<span className="font-mono text-muted-foreground text-sm">
					/ {consistency.limit}% max
				</span>
			</div>

			<MetricProgressBar percent={usedPercent} status={status} />

			<div className="mt-2 flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground">
					Best day as % of profit
				</span>
				<span
					className={cn(
						"font-mono text-[10px]",
						COMPLIANCE_STATUS_COLORS[status],
					)}
				>
					{consistency.isCompliant ? "Compliant" : "Non-compliant"}
				</span>
			</div>
		</ComplianceCardShell>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * 4-card responsive grid showing all compliance metrics.
 * - Max Drawdown (circular gauge)
 * - Daily Loss (progress bar with dollar amounts)
 * - Profit Target (progress bar with percentage)
 * - Consistency Rule (max day % vs limit)
 */
export function ComplianceGrid({ data }: { data: ComplianceData }) {
	return (
		<div className="grid gap-4 sm:grid-cols-2" data-testid="compliance-grid">
			<MaxDrawdownCard drawdown={data.drawdown} />
			<DailyLossCard dailyLoss={data.dailyLoss} />
			<ProfitTargetCard profitTarget={data.profitTarget} />
			<ConsistencyCard consistency={data.consistency} />
		</div>
	);
}
