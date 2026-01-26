"use client";

import { LineChart, List } from "lucide-react";

interface PlaceholderSectionProps {
	icon: React.ReactNode;
	title: string;
	filename: string;
	description: string;
}

function PlaceholderSection({
	icon,
	title,
	filename,
	description,
}: PlaceholderSectionProps) {
	return (
		<div
			className="overflow-hidden rounded border border-white/10 border-dashed opacity-60"
			data-testid={`strategy-placeholder-${title.toLowerCase().replace(/\s+/g, "-")}`}
		>
			{/* Terminal window chrome header */}
			<div className="flex items-center justify-between border-white/5 border-b border-dashed bg-white/2 px-3 py-1.5 sm:px-4 sm:py-2">
				<div className="flex items-center gap-1 sm:gap-1.5">
					<div className="h-1.5 w-1.5 rounded-full bg-loss/40 sm:h-2 sm:w-2" />
					<div className="h-1.5 w-1.5 rounded-full bg-breakeven/40 sm:h-2 sm:w-2" />
					<div className="h-1.5 w-1.5 rounded-full bg-profit/40 sm:h-2 sm:w-2" />
				</div>
				<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
					{filename}
				</span>
				<div className="w-10 sm:w-14" />
			</div>

			{/* Placeholder content */}
			<div className="flex flex-col items-center justify-center p-6 sm:p-12">
				{/* Icon container */}
				<div className="mb-3 flex h-12 w-12 items-center justify-center rounded border border-white/10 border-dashed bg-white/2 sm:mb-4 sm:h-16 sm:w-16">
					{icon}
				</div>

				{/* Title with COMING SOON badge */}
				<div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
					<span className="font-mono text-xs uppercase tracking-wider sm:text-sm">
						{title}
					</span>
					<span className="rounded bg-primary/20 px-1 py-0.5 font-mono text-[8px] text-primary uppercase tracking-wider sm:px-1.5 sm:text-[9px]">
						Coming Soon
					</span>
				</div>

				{/* Description */}
				<p className="max-w-xs text-center font-mono text-[10px] text-muted-foreground sm:text-xs">
					{description}
				</p>
			</div>
		</div>
	);
}

export function StrategyPlaceholder() {
	return (
		<div
			className="grid gap-3 sm:grid-cols-2 sm:gap-6"
			data-testid="strategy-placeholder-section"
		>
			<PlaceholderSection
				description="Track your strategy performance over time with an interactive P&L chart showing cumulative gains and drawdowns."
				filename="equity-curve.chart"
				icon={
					<LineChart className="h-6 w-6 text-muted-foreground sm:h-8 sm:w-8" />
				}
				title="Equity Curve"
			/>
			<PlaceholderSection
				description="View the most recent trades executed with this playbook, including entry/exit details and individual P&L."
				filename="recent-trades.list"
				icon={<List className="h-6 w-6 text-muted-foreground sm:h-8 sm:w-8" />}
				title="Recent Trades"
			/>
		</div>
	);
}
