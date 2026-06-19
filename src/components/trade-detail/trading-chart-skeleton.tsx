"use client";

export function TradingChartSkeleton() {
	return (
		<div className="flex h-full items-center justify-center bg-card">
			<div className="flex flex-col items-center gap-2">
				<div className="h-6 w-6 animate-pulse rounded bg-white/5" />
				<span className="animate-pulse font-mono text-[10px] text-muted-foreground">
					Loading chart...
				</span>
			</div>
		</div>
	);
}
