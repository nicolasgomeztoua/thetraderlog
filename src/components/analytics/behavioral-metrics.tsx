"use client";

import { AlertTriangle, CheckCircle, TrendingDown, Zap } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

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
	// Score color helpers
	const getTiltColor = (score: number) => {
		if (score < 30) return "text-profit";
		if (score < 50) return "text-breakeven";
		if (score < 70) return "text-amber-400";
		return "text-loss";
	};

	const getDisciplineColor = (score: number) => {
		if (score >= 80) return "text-profit";
		if (score >= 60) return "text-breakeven";
		if (score >= 40) return "text-amber-400";
		return "text-loss";
	};

	const getOvertradingColor = (score: number) => {
		if (score < 10) return "text-profit";
		if (score < 20) return "text-breakeven";
		if (score < 30) return "text-amber-400";
		return "text-loss";
	};

	// Emotional state display name and color
	const getEmotionalStateDisplay = (state: string) => {
		const displays: Record<string, { label: string; color: string }> = {
			confident: { label: "Confident", color: "text-profit" },
			fearful: { label: "Fearful", color: "text-amber-400" },
			greedy: { label: "Greedy", color: "text-loss" },
			neutral: { label: "Neutral", color: "text-muted-foreground" },
			frustrated: { label: "Frustrated", color: "text-loss" },
			excited: { label: "Excited", color: "text-amber-400" },
			anxious: { label: "Anxious", color: "text-amber-400" },
			untracked: { label: "Untracked", color: "text-muted-foreground/60" },
		};
		return displays[state] || { label: state, color: "text-muted-foreground" };
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
							getTiltColor(tiltScore),
						)}
					>
						{tiltScore}%
					</div>
					<div className="mt-1 font-mono text-[10px] text-muted-foreground">
						{tiltScore < 30
							? "Excellent composure"
							: tiltScore < 50
								? "Generally stable"
								: tiltScore < 70
									? "Some tilt patterns"
									: "High tilt risk"}
					</div>

					{/* Visual gauge */}
					<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								tiltScore < 30
									? "bg-profit"
									: tiltScore < 50
										? "bg-breakeven"
										: tiltScore < 70
											? "bg-amber-400"
											: "bg-loss",
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
							getDisciplineColor(disciplineScore),
						)}
					>
						{disciplineScore}%
					</div>
					<div className="mt-1 font-mono text-[10px] text-muted-foreground">
						{disciplineScore >= 80
							? "Highly disciplined"
							: disciplineScore >= 60
								? "Good discipline"
								: disciplineScore >= 40
									? "Room for improvement"
									: "Low strategy adherence"}
					</div>

					{/* Visual gauge */}
					<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								disciplineScore >= 80
									? "bg-profit"
									: disciplineScore >= 60
										? "bg-breakeven"
										: disciplineScore >= 40
											? "bg-amber-400"
											: "bg-loss",
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
							getOvertradingColor(overtradingTendency),
						)}
					>
						{overtradingTendency}%
					</div>
					<div className="mt-1 font-mono text-[10px] text-muted-foreground">
						{overtradingTendency < 10
							? "Consistent volume"
							: overtradingTendency < 20
								? "Occasional spikes"
								: overtradingTendency < 30
									? "Frequent overtrading"
									: "High overtrading risk"}
					</div>

					{/* Visual gauge */}
					<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								overtradingTendency < 10
									? "bg-profit"
									: overtradingTendency < 20
										? "bg-breakeven"
										: overtradingTendency < 30
											? "bg-amber-400"
											: "bg-loss",
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
