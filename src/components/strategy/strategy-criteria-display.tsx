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
				hasContent ? "border-white/10" : "border-white/10 border-dashed",
			)}
			data-testid={testId}
		>
			{/* Terminal window chrome header */}
			<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2">
				<div className="flex items-center gap-1.5">
					<div className="h-2 w-2 rounded-full bg-loss/60" />
					<div className="h-2 w-2 rounded-full bg-breakeven/60" />
					<div className="h-2 w-2 rounded-full bg-profit/60" />
				</div>
				<span className="font-mono text-[10px] text-muted-foreground">
					{filename}
				</span>
				<div className="w-14" />
			</div>

			{/* Section header with command prompt */}
			<div className="flex items-center gap-2 border-white/5 border-b bg-white/2 px-4 py-3">
				<span className={cn("font-mono text-xs", colorClass)}>{">"}</span>
				<Icon className={cn("h-4 w-4", colorClass)} />
				<span
					className={cn(
						"font-mono text-xs uppercase tracking-wider",
						colorClass,
					)}
				>
					{title}
				</span>
			</div>

			{/* Content area */}
			<div className="p-4">
				{hasContent ? (
					<div className="whitespace-pre-wrap font-mono text-foreground/80 text-sm leading-relaxed">
						{content}
					</div>
				) : (
					<p className="py-4 text-center font-mono text-muted-foreground/60 text-xs">
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
