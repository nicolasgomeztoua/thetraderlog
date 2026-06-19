"use client";

import {
	CommandCenterGrid,
	GridItem,
} from "@/components/dashboard/command-center-grid";
import { AnalyticsSnapshotWidget } from "@/components/dashboard/widgets/analytics-snapshot-widget";
import { JournalExcerptsWidget } from "@/components/dashboard/widgets/journal-excerpts-widget";
import { JournalStatusWidget } from "@/components/dashboard/widgets/journal-status-widget";
import { JournalStreakWidget } from "@/components/dashboard/widgets/journal-streak-widget";
import { PnLCalendarWidget } from "@/components/dashboard/widgets/pnl-calendar-widget";
import { PropStatusWidget } from "@/components/dashboard/widgets/prop-status-widget";
import { RuleComplianceWidget } from "@/components/dashboard/widgets/rule-compliance-widget";
import { StrategiesSnapshotWidget } from "@/components/dashboard/widgets/strategies-snapshot-widget";
import { TodayPerformanceWidget } from "@/components/dashboard/widgets/today-performance-widget";
import { TradesSnapshotWidget } from "@/components/dashboard/widgets/trades-snapshot-widget";
import { useAccount } from "@/contexts/account-context";
import { isPropAccountType } from "@/lib/constants/prop";

/**
 * Command Center Dashboard - Adaptive trading dashboard
 *
 * Layout (3-column grid on desktop):
 * Row 1: [Today's Performance (wide)]
 * Row 2: [Journal Status] [P&L Calendar  ] [Analytics Snapshot]
 * Row 3: [Journal Streak] [   (large)    ] [Strategies Snapshot]
 * Row 4: [Rule Compliance]               [Recent Trades]
 * Row 5: [Prop Status Widget (wide)]  ← prop accounts only
 * Row 6: [Journal Excerpts (wide)                      ]
 */
export default function DashboardPage() {
	const { selectedAccount } = useAccount();

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<span className="mb-2 block font-mono text-primary text-xs uppercase tracking-wider">
						Command Center
					</span>
					<h1
						className="font-bold text-2xl tracking-tight sm:text-3xl"
						data-testid="dashboard-heading-overview"
					>
						Trading Dashboard
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

			{/* Command Center Grid */}
			<CommandCenterGrid>
				{/* Row 1: Today's Performance (wide) */}
				<GridItem size="md">
					<TodayPerformanceWidget />
				</GridItem>

				{/* Row 2-4 Left Column: Journal widgets + Rule Compliance */}
				<GridItem size="sm">
					<JournalStatusWidget />
				</GridItem>

				{/* Center: P&L Calendar (large - spans 2 cols x 2 rows) */}
				<GridItem size="lg">
					<PnLCalendarWidget />
				</GridItem>

				{/* Row 2-3 Right Column: Analytics + Strategies */}
				<GridItem size="sm">
					<AnalyticsSnapshotWidget />
				</GridItem>

				<GridItem size="sm">
					<JournalStreakWidget />
				</GridItem>

				<GridItem size="sm">
					<StrategiesSnapshotWidget />
				</GridItem>

				<GridItem size="sm">
					<RuleComplianceWidget />
				</GridItem>

				<GridItem size="sm">
					<TradesSnapshotWidget />
				</GridItem>

				{/* Prop Compliance Widget — only for prop accounts */}
				{isPropAccountType(selectedAccount?.accountType) && (
					<GridItem size="wide">
						<PropStatusWidget />
					</GridItem>
				)}

				{/* Bottom: Journal Excerpts (wide) */}
				<GridItem size="wide">
					<JournalExcerptsWidget />
				</GridItem>
			</CommandCenterGrid>
		</div>
	);
}
