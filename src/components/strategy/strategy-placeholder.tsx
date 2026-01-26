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
			<div className="flex items-center justify-between border-white/5 border-b border-dashed bg-white/2 px-4 py-2">
				<div className="flex items-center gap-1.5">
					<div className="h-2 w-2 rounded-full bg-loss/40" />
					<div className="h-2 w-2 rounded-full bg-breakeven/40" />
					<div className="h-2 w-2 rounded-full bg-profit/40" />
				</div>
				<span className="font-mono text-[10px] text-muted-foreground">
					{filename}
				</span>
				<div className="w-14" />
			</div>

			{/* Placeholder content */}
			<div className="flex flex-col items-center justify-center p-8 sm:p-12">
				{/* Icon container */}
				<div className="mb-4 flex h-16 w-16 items-center justify-center rounded border border-white/10 border-dashed bg-white/2">
					{icon}
				</div>

				{/* Title with COMING SOON badge */}
				<div className="mb-2 flex items-center gap-2">
					<span className="font-mono text-sm uppercase tracking-wider">
						{title}
					</span>
					<span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] text-primary uppercase tracking-wider">
						Coming Soon
					</span>
				</div>

				{/* Description */}
				<p className="max-w-xs text-center font-mono text-muted-foreground text-xs">
					{description}
				</p>
			</div>
		</div>
	);
}

export function StrategyPlaceholder() {
	return (
		<div
			className="grid gap-4 sm:grid-cols-2 sm:gap-6"
			data-testid="strategy-placeholder-section"
		>
			<PlaceholderSection
				description="Track your strategy performance over time with an interactive P&L chart showing cumulative gains and drawdowns."
				filename="equity-curve.chart"
				icon={<LineChart className="h-8 w-8 text-muted-foreground" />}
				title="Equity Curve"
			/>
			<PlaceholderSection
				description="View the most recent trades executed with this playbook, including entry/exit details and individual P&L."
				filename="recent-trades.list"
				icon={<List className="h-8 w-8 text-muted-foreground" />}
				title="Recent Trades"
			/>
		</div>
	);
}
