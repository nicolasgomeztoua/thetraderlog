"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useMemo } from "react";
import { useAccount } from "@/contexts/account-context";
import { cn, toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";

// Get date range for current month (or last 30 days for more data)
function getLast30DaysRange() {
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - 30);
	return {
		startDate: toDateString(start),
		endDate: toDateString(end),
	};
}

// Circular gauge component
function ComplianceGauge({
	value,
	size = 72,
}: {
	value: number;
	size?: number;
}) {
	const strokeWidth = 6;
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const percent = Math.min(Math.max(value / 100, 0), 1);
	const offset = circumference - percent * circumference;

	// Color based on value
	const color =
		value >= 80
			? "stroke-profit"
			: value >= 50
				? "stroke-primary"
				: "stroke-loss";

	return (
		<div className="relative">
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
			{/* Center value */}
			<div className="absolute inset-0 flex items-center justify-center">
				<span
					className={cn(
						"font-mono font-semibold text-lg",
						value >= 80
							? "text-profit"
							: value >= 50
								? "text-primary"
								: "text-loss",
					)}
				>
					{Math.round(value)}%
				</span>
			</div>
		</div>
	);
}

// Category compliance bar
function CategoryBar({ label, value }: { label: string; value: number }) {
	const color =
		value >= 80 ? "bg-profit" : value >= 50 ? "bg-primary" : "bg-loss";

	return (
		<div className="flex items-center gap-2">
			<span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground uppercase">
				{label}
			</span>
			<div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10">
				<div
					className={cn(color, "h-full transition-all duration-300")}
					style={{ width: `${value}%` }}
				/>
			</div>
			<span className="w-8 text-right font-mono text-[10px] text-muted-foreground">
				{Math.round(value)}%
			</span>
		</div>
	);
}

/**
 * Rule Compliance Scorecard Widget for the Command Center dashboard.
 *
 * Shows:
 * - Overall compliance percentage with circular gauge
 * - Category breakdown (Entry, Exit, Risk, Management)
 * - Top violations list
 * - Color coding: >80% green, 50-80% yellow, <50% red
 */
export function RuleComplianceWidget() {
	const { selectedAccountId } = useAccount();
	const dateRange = useMemo(() => getLast30DaysRange(), []);

	const { data, isLoading } =
		api.strategies.getDashboardRuleCompliance.useQuery(
			{
				accountId: selectedAccountId ?? undefined,
				startDate: dateRange.startDate,
				endDate: dateRange.endDate,
			},
			{ staleTime: 60000 },
		);

	// Check if user has any strategies with rules
	const hasData = data && data.tradesWithStrategies > 0;

	return (
		<DashboardWidget
			data-testid="widget-rule-compliance"
			href="/strategies"
			icon={ShieldCheckIcon}
			loading={isLoading}
			title="rule-compliance"
		>
			{!hasData ? (
				<WidgetEmptyState
					icon={ShieldCheckIcon}
					message="No strategies with rules configured"
				/>
			) : (
				<div className="flex h-full flex-col">
					{/* Top section: Gauge and Overall */}
					<div className="flex items-center gap-4">
						<ComplianceGauge value={data.overall} />
						<div>
							<div className="font-mono text-[11px] text-muted-foreground">
								Overall Compliance
							</div>
							<div className="font-mono text-muted-foreground text-xs">
								{data.tradesWithStrategies} trade
								{data.tradesWithStrategies !== 1 && "s"} tracked
							</div>
						</div>
					</div>

					{/* Category breakdown */}
					<div className="mt-3 space-y-2 border-white/5 border-t pt-3">
						<CategoryBar label="Entry" value={data.byCategory.entry} />
						<CategoryBar label="Exit" value={data.byCategory.exit} />
						<CategoryBar label="Risk" value={data.byCategory.risk} />
						<CategoryBar label="Manage" value={data.byCategory.management} />
					</div>

					{/* Top violations */}
					{data.violations.length > 0 && (
						<div className="mt-3 border-white/5 border-t pt-2">
							<div className="mb-1 font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
								Top Violations
							</div>
							<div className="space-y-1">
								{data.violations.slice(0, 3).map((v) => (
									<div
										className="flex items-center justify-between"
										key={v.ruleId}
									>
										<span className="truncate font-mono text-[10px] text-loss">
											{v.ruleName}
										</span>
										<span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
											×{v.count}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</DashboardWidget>
	);
}
