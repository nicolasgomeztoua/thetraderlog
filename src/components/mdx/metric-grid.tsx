"use client";

import { cn } from "@/lib/shared";

interface MetricGridProps {
	children: React.ReactNode;
	className?: string;
}

export function MetricGrid({ children, className }: MetricGridProps) {
	return (
		<div
			className={cn(
				"grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4",
				className,
			)}
		>
			{children}
		</div>
	);
}
