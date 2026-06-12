"use client";

import { AlertTriangle, CheckCircle, TrendingDown, Zap } from "lucide-react";
import {
	EMOTIONAL_STATES,
	getDisciplineScoreLevel,
	getOvertradingLevel,
	getTiltScoreLevel,
} from "@/lib/analytics";
import { cn, formatCurrency } from "@/lib/shared";

interface EmotionalStateData {
	state: string;
	trades: number;
	pnl: number;
	avgPnl: number;
	winRate: number;
}

interface BehavioralMetricsProps {
	tiltScore: number;
	disciplineScore: number;
	overtradingTendency: number;
	emotionalStateBreakdown: EmotionalStateData[];
	totalTrades: number;
	className?: string;
}

/**
 * Terminal-styled behavioral metrics summary cards
 * Shows tilt score, discipline score, and emotional state breakdown
 */
export function BehavioralMetrics({
	tiltScore,
	disciplineScore,
	overtradingTendency,
	emotionalStateBreakdown,
	totalTrades,
	className,
}: BehavioralMetricsProps) {
	// Get levels from centralized thresholds
	const tiltLevel = getTiltScoreLevel(tiltScore);
	const disciplineLevel = getDisciplineScoreLevel(disciplineScore);
	const overtradingLevel = getOvertradingLevel(overtradingTendency);

	// Emotional state display name and color
	const getEmotionalStateDisplay = (state: string) => {
		const emotionalState =
			EMOTIONAL_STATES[state as keyof typeof EMOTIONAL_STATES];
		if (emotionalState) {
			return { label: emotionalState.label, color: emotionalState.colorClass };
		}
		return { label: state, color: "text-muted-foreground" };
	};

	if (totalTrades === 0) {
		return (
			<div
				className={cn(
					"flex h-[200px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No behavioral data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Score Cards */}
			<div className="grid grid-cols-3 gap-3">
				{/* Tilt Score */}
				<div className="rounded border border-border bg-card p-4">
					<div className="flex items-center gap-2">
						<TrendingDown className="h-4 w-4 text-muted-foreground" />
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Tilt Score
						</span>
					</div>
					<div
						className={cn(
							"mt-2 font-bold font-mono text-2xl",
							tiltLevel.colorClass,
						)}
					>
						{tiltScore}%
					</div>
					<div className="mt-1 font-mono text-[10px] text-muted-foreground">
						{tiltLevel.description}
					</div>

					{/* Visual gauge */}
					<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								tiltLevel.bgClass,
							)}
							style={{ width: `${tiltScore}%` }}
						/>
					</div>
				</div>

				{/* Discipline Score */}
				<div className="rounded border border-border bg-card p-4">
					<div className="flex items-center gap-2">
						<CheckCircle className="h-4 w-4 text-muted-foreground" />
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Discipline
						</span>
					</div>
					<div
						className={cn(
							"mt-2 font-bold font-mono text-2xl",
							disciplineLevel.colorClass,
						)}
					>
						{disciplineScore}%
					</div>
					<div className="mt-1 font-mono text-[10px] text-muted-foreground">
						{disciplineLevel.label}
					</div>

					{/* Visual gauge */}
					<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								disciplineLevel.bgClass,
							)}
							style={{ width: `${disciplineScore}%` }}
						/>
					</div>
				</div>

				{/* Overtrading Tendency */}
				<div className="rounded border border-border bg-card p-4">
					<div className="flex items-center gap-2">
						<Zap className="h-4 w-4 text-muted-foreground" />
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Overtrading
						</span>
					</div>
					<div
						className={cn(
							"mt-2 font-bold font-mono text-2xl",
							overtradingLevel.colorClass,
						)}
					>
						{overtradingTendency}%
					</div>
					<div className="mt-1 font-mono text-[10px] text-muted-foreground">
						{overtradingLevel.label}
					</div>

					{/* Visual gauge */}
					<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								overtradingLevel.bgClass,
							)}
							style={{ width: `${Math.min(100, overtradingTendency * 2)}%` }}
						/>
					</div>
				</div>
			</div>

			{/* Emotional State Breakdown */}
			{emotionalStateBreakdown.length > 0 && (
				<div className="space-y-2">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Emotional State Performance
					</div>

					<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
						{emotionalStateBreakdown
							.filter((e) => e.state !== "untracked")
							.slice(0, 4)
							.map((emotion) => {
								const display = getEmotionalStateDisplay(emotion.state);
								return (
									<div
										className="rounded border border-border bg-secondary/30 p-2"
										key={emotion.state}
									>
										<div className={cn("font-mono text-xs", display.color)}>
											{display.label}
										</div>
										<div
											className={cn(
												"font-medium font-mono text-sm",
												emotion.avgPnl >= 0 ? "text-profit" : "text-loss",
											)}
										>
											{formatCurrency(emotion.avgPnl)}
											<span className="ml-1 text-[10px] text-muted-foreground/60 uppercase">
												avg
											</span>
										</div>
										<div className="font-mono text-muted-foreground/60 text-xs">
											{emotion.trades}t / {emotion.winRate.toFixed(0)}% WR
										</div>
									</div>
								);
							})}
					</div>

					{/* Untracked trades notice */}
					{(() => {
						const untracked = emotionalStateBreakdown.find(
							(e) => e.state === "untracked",
						);
						if (untracked && untracked.trades > 0) {
							const untrackedPct = (
								(untracked.trades / totalTrades) *
								100
							).toFixed(0);
							return (
								<div className="flex items-center gap-2 font-mono text-muted-foreground/60 text-xs">
									<AlertTriangle className="h-3 w-3" />
									<span>
										{untracked.trades} trades ({untrackedPct}%) have no
										emotional state tracked
									</span>
								</div>
							);
						}
						return null;
					})()}
				</div>
			)}
		</div>
	);
}
