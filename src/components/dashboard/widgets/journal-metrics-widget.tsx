"use client";

import { FileTextIcon } from "lucide-react";
import { useMemo } from "react";
import { useAccount } from "@/contexts/account-context";
import { cn, toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget } from "../dashboard-widget";

// Get date range for last 30 days
function getLast30DaysRange() {
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - 30);
	return {
		startDate: toDateString(start),
		endDate: toDateString(end),
	};
}

// Simple sparkline component
function Sparkline({
	data,
	height = 32,
	width = 100,
}: {
	data: number[];
	height?: number;
	width?: number;
}) {
	if (data.length === 0) return null;

	const max = Math.max(...data, 1);
	const min = 0;
	const range = max - min;

	const points = data
		.map((val, i) => {
			const x = (i / Math.max(data.length - 1, 1)) * width;
			const y = height - ((val - min) / range) * height;
			return `${x},${y}`;
		})
		.join(" ");

	return (
		<svg
			aria-hidden="true"
			className="overflow-visible"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			width={width}
		>
			<polyline
				className="fill-none stroke-primary"
				points={points}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
			/>
		</svg>
	);
}

// Mini donut chart component
function MiniDonut({
	segments,
	size = 48,
}: {
	segments: Array<{ value: number; color: string }>;
	size?: number;
}) {
	const total = segments.reduce((sum, s) => sum + s.value, 0);
	if (total === 0) return null;

	const strokeWidth = 6;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const center = size / 2;

	let currentOffset = 0;
	const arcs = segments.map((segment, idx) => {
		const percentage = segment.value / total;
		const strokeDasharray = `${percentage * circumference} ${circumference}`;
		const strokeDashoffset = -currentOffset;
		currentOffset += percentage * circumference;

		return (
			<circle
				className={segment.color}
				cx={center}
				cy={center}
				fill="none"
				key={`segment-${idx}-${segment.value}`}
				r={radius}
				strokeDasharray={strokeDasharray}
				strokeDashoffset={strokeDashoffset}
				strokeLinecap="round"
				strokeWidth={strokeWidth}
				transform={`rotate(-90 ${center} ${center})`}
			/>
		);
	});

	return (
		<svg aria-hidden="true" height={size} width={size}>
			{/* Background circle */}
			<circle
				className="stroke-white/10"
				cx={center}
				cy={center}
				fill="none"
				r={radius}
				strokeWidth={strokeWidth}
			/>
			{arcs}
		</svg>
	);
}

const EMOTIONAL_STATE_COLORS: Record<
	string,
	{ stroke: string; label: string }
> = {
	confident: { stroke: "stroke-profit", label: "Confident" },
	fearful: { stroke: "stroke-loss", label: "Fearful" },
	greedy: { stroke: "stroke-[#ff9500]", label: "Greedy" },
	neutral: { stroke: "stroke-muted-foreground", label: "Neutral" },
	frustrated: { stroke: "stroke-[#ff5555]", label: "Frustrated" },
	excited: { stroke: "stroke-[#55ff55]", label: "Excited" },
	anxious: { stroke: "stroke-[#ffaa00]", label: "Anxious" },
	untracked: { stroke: "stroke-white/20", label: "Not Tracked" },
};

/**
 * Journal Metrics Widget for the Command Center dashboard.
 *
 * Shows:
 * - Journal completion rate for last 30 days
 * - Average word count
 * - Sparkline of journal lengths
 * - Emotional state distribution (from trades)
 */
export function JournalMetricsWidget() {
	const { selectedAccountId } = useAccount();
	const dateRange = useMemo(() => getLast30DaysRange(), []);

	// Get journal adjacency data for completion and word counts
	const { data: journalData, isLoading: journalLoading } =
		api.dailyJournal.getJournalAdjacency.useQuery(
			{
				accountId: selectedAccountId ?? undefined,
				startDate: dateRange.startDate,
				endDate: dateRange.endDate,
			},
			{ staleTime: 60000 },
		);

	// Get behavioral patterns for emotional state breakdown
	const { data: behaviorData, isLoading: behaviorLoading } =
		api.analytics.getBehavioralPatterns.useQuery(
			{ accountId: selectedAccountId ?? undefined },
			{ staleTime: 60000 },
		);

	const isLoading = journalLoading || behaviorLoading;

	// Calculate journal metrics
	const metrics = useMemo(() => {
		if (!journalData) {
			return {
				completionRate: 0,
				avgWordCount: 0,
				wordCounts: [] as number[],
				tradingDays: 0,
				journaledDays: 0,
			};
		}

		const today = toDateString(new Date());
		const tradingDays = journalData.filter(
			(d) => d.hasTrades && d.date <= today,
		);
		const journaledDays = tradingDays.filter((d) => d.hasJournal);

		const completionRate =
			tradingDays.length > 0
				? Math.round((journaledDays.length / tradingDays.length) * 100)
				: 0;

		// Calculate average word count from journals with content
		const journalsWithContent = journalData.filter(
			(d) => d.journalWordCount > 0,
		);
		const avgWordCount =
			journalsWithContent.length > 0
				? Math.round(
						journalsWithContent.reduce(
							(sum, d) => sum + d.journalWordCount,
							0,
						) / journalsWithContent.length,
					)
				: 0;

		// Get word counts for sparkline (most recent 30 days, including zeros)
		const wordCounts = journalData
			.filter((d) => d.date <= today)
			.sort((a, b) => a.date.localeCompare(b.date))
			.slice(-30)
			.map((d) => d.journalWordCount);

		return {
			completionRate,
			avgWordCount,
			wordCounts,
			tradingDays: tradingDays.length,
			journaledDays: journaledDays.length,
		};
	}, [journalData]);

	// Prepare emotional state data for donut
	const emotionalData = useMemo(() => {
		if (!behaviorData?.emotionalStateBreakdown) return [];

		return behaviorData.emotionalStateBreakdown
			.slice(0, 4) // Top 4 states
			.map((state) => ({
				value: state.trades,
				color: EMOTIONAL_STATE_COLORS[state.state]?.stroke ?? "stroke-white/20",
				label: EMOTIONAL_STATE_COLORS[state.state]?.label ?? state.state,
			}));
	}, [behaviorData]);

	const topEmotionalState = emotionalData[0];

	return (
		<DashboardWidget
			data-testid="widget-journal-metrics"
			href="/daily-journal"
			icon={FileTextIcon}
			loading={isLoading}
			skeletonVariant="metrics"
			title="journal-metrics"
		>
			<div className="flex h-full flex-col gap-3">
				{/* Top row: Completion rate and Avg word count */}
				<div className="flex items-start justify-between">
					<div>
						<div
							className={cn(
								"font-mono font-semibold text-2xl",
								metrics.completionRate >= 80
									? "text-profit"
									: metrics.completionRate >= 50
										? "text-primary"
										: "text-muted-foreground",
							)}
						>
							{metrics.completionRate}%
						</div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Completion
						</div>
					</div>

					<div className="text-right">
						<div className="font-mono font-semibold text-lg">
							{metrics.avgWordCount}
						</div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Avg Words
						</div>
					</div>
				</div>

				{/* Sparkline */}
				<div className="flex-1">
					<div className="mb-1 font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
						Journal length (30d)
					</div>
					<Sparkline data={metrics.wordCounts} height={28} width={140} />
				</div>

				{/* Bottom row: Emotional state donut */}
				<div className="flex items-center gap-3 border-white/5 border-t pt-3">
					{emotionalData.length > 0 ? (
						<>
							<MiniDonut
								segments={emotionalData.map((e) => ({
									value: e.value,
									color: e.color,
								}))}
								size={40}
							/>
							<div>
								<div className="font-mono text-xs">
									{topEmotionalState?.label ?? "No data"}
								</div>
								<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Top Emotion
								</div>
							</div>
						</>
					) : (
						<div className="font-mono text-[11px] text-muted-foreground">
							No emotional data tracked
						</div>
					)}
				</div>
			</div>
		</DashboardWidget>
	);
}
