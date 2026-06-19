"use client";

import { DoorOpen, Target } from "lucide-react";
import { cn } from "@/lib/shared";

interface StrategyCriteriaDisplayProps {
	entryCriteria: string | null;
	exitRules: string | null;
}

interface CriteriaCardProps {
	title: string;
	icon: typeof Target;
	colorClass: string;
	content: string | null;
	emptyText: string;
	filename: string;
	testId: string;
}

function CriteriaCard({
	title,
	icon: Icon,
	colorClass,
	content,
	emptyText,
	filename,
	testId,
}: CriteriaCardProps) {
	const hasContent = content && content.trim().length > 0;

	return (
		<div
			className={cn(
				"overflow-hidden rounded border",
				hasContent ? "border-border" : "border-border border-dashed",
			)}
			data-testid={testId}
		>
			{/* Terminal window chrome header */}
			<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-1.5 sm:px-4 sm:py-2">
				<div className="flex items-center gap-1 sm:gap-1.5">
					<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
					<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
					<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
				</div>
				<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
					{filename}
				</span>
				<div className="w-10 sm:w-14" />
			</div>

			{/* Section header with command prompt */}
			<div className="flex items-center gap-1.5 border-border/50 border-b bg-muted px-3 py-2 sm:gap-2 sm:px-4 sm:py-3">
				<span className={cn("font-mono text-[10px] sm:text-xs", colorClass)}>
					{">"}
				</span>
				<Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", colorClass)} />
				<span
					className={cn(
						"font-mono text-[10px] uppercase tracking-wider sm:text-xs",
						colorClass,
					)}
				>
					{title}
				</span>
			</div>

			{/* Content area */}
			<div className="p-3 sm:p-4">
				{hasContent ? (
					<div className="whitespace-pre-wrap font-mono text-foreground/80 text-xs leading-relaxed sm:text-sm">
						{content}
					</div>
				) : (
					<p className="py-3 text-center font-mono text-[10px] text-muted-foreground/60 sm:py-4 sm:text-xs">
						{emptyText}
					</p>
				)}
			</div>
		</div>
	);
}

export function StrategyCriteriaDisplay({
	entryCriteria,
	exitRules,
}: StrategyCriteriaDisplayProps) {
	return (
		<div
			className="grid gap-4 sm:grid-cols-2"
			data-testid="strategy-criteria-display"
		>
			<CriteriaCard
				colorClass="text-profit"
				content={entryCriteria}
				emptyText="Not defined"
				filename="entry.criteria"
				icon={Target}
				testId="strategy-criteria-entry"
				title="Entry Criteria"
			/>
			<CriteriaCard
				colorClass="text-loss"
				content={exitRules}
				emptyText="Not defined"
				filename="exit.rules"
				icon={DoorOpen}
				testId="strategy-criteria-exit"
				title="Exit Rules"
			/>
		</div>
	);
}
