"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/shared";

interface ComplianceBadgeProps {
	compliance: number;
	size?: "sm" | "md" | "lg";
	showIcon?: boolean;
}

export function ComplianceBadge({
	compliance,
	size = "sm",
	showIcon = true,
}: ComplianceBadgeProps) {
	const isGood = compliance >= 80;
	const isMedium = compliance >= 50 && compliance < 80;

	const sizeClasses = {
		sm: "text-[10px] px-1.5 py-0.5 gap-1",
		md: "text-xs px-2 py-1 gap-1.5",
		lg: "text-sm px-3 py-1.5 gap-2",
	};

	const iconSizes = {
		sm: "h-3 w-3",
		md: "h-3.5 w-3.5",
		lg: "h-4 w-4",
	};

	return (
		<div
			className={cn(
				"inline-flex items-center rounded font-mono uppercase tracking-wider",
				sizeClasses[size],
				isGood && "bg-profit/10 text-profit",
				isMedium && "bg-breakeven/10 text-breakeven",
				!isGood && !isMedium && "bg-loss/10 text-loss",
			)}
		>
			{showIcon &&
				(isGood ? (
					<CheckCircle2 className={iconSizes[size]} />
				) : (
					<Circle className={iconSizes[size]} />
				))}
			<span>{compliance.toFixed(0)}%</span>
		</div>
	);
}
