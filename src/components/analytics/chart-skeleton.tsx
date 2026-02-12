"use client";

export function ChartSkeleton({
	height = 300,
	className,
}: {
	height?: number;
	className?: string;
}) {
	return (
		<div
			className={`flex items-center justify-center rounded border border-border bg-card ${className ?? ""}`}
			style={{ height }}
		>
			<div className="flex flex-col items-center gap-2">
				<div className="h-6 w-6 animate-pulse rounded bg-white/5" />
				<span className="animate-pulse font-mono text-[10px] text-muted-foreground">
					Loading chart...
				</span>
			</div>
		</div>
	);
}
