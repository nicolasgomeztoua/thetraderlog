"use client";

import {
	ArrowRight,
	DoorOpen,
	LayoutGrid,
	ShieldAlert,
	Target,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/shared";

interface Rule {
	id: string;
	text: string;
	category: "entry" | "exit" | "risk" | "management";
	order: number;
}

interface StrategyRulesDisplayProps {
	rules: Rule[];
}

const CATEGORY_CONFIG: Record<
	Rule["category"],
	{ label: string; icon: typeof ArrowRight; colorClass: string }
> = {
	entry: { label: "Entry Rules", icon: Target, colorClass: "text-profit" },
	exit: { label: "Exit Rules", icon: DoorOpen, colorClass: "text-loss" },
	risk: {
		label: "Risk Rules",
		icon: ShieldAlert,
		colorClass: "text-breakeven",
	},
	management: {
		label: "Management Rules",
		icon: LayoutGrid,
		colorClass: "text-accent",
	},
};

const CATEGORY_ORDER: Rule["category"][] = [
	"entry",
	"exit",
	"risk",
	"management",
];

export function StrategyRulesDisplay({ rules }: StrategyRulesDisplayProps) {
	// Group rules by category
	const groupedRules = useMemo(() => {
		const groups: Record<Rule["category"], Rule[]> = {
			entry: [],
			exit: [],
			risk: [],
			management: [],
		};
		for (const rule of rules) {
			groups[rule.category].push(rule);
		}
		// Sort each category by order
		for (const category of CATEGORY_ORDER) {
			groups[category].sort((a, b) => a.order - b.order);
		}
		return groups;
	}, [rules]);

	// If no rules at all, show empty state
	if (rules.length === 0) {
		return (
			<div
				className="overflow-hidden rounded border border-border border-dashed"
				data-testid="strategy-rules-display-empty"
			>
				{/* Terminal window chrome */}
				<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-1.5 sm:px-4 sm:py-2">
					<div className="flex items-center gap-1 sm:gap-1.5">
						<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
						<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
						<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
					</div>
					<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
						rules — empty
					</span>
					<div className="w-10 sm:w-14" />
				</div>
				<div className="px-4 py-6 text-center sm:px-6 sm:py-8">
					<p className="font-mono text-muted-foreground text-xs sm:text-sm">
						No rules defined for this strategy
					</p>
					<p className="mt-1 font-mono text-[10px] text-muted-foreground/60 sm:text-xs">
						Add rules in the edit form below
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className="grid gap-4 sm:grid-cols-2"
			data-testid="strategy-rules-display"
		>
			{CATEGORY_ORDER.map((category) => {
				const config = CATEGORY_CONFIG[category];
				const categoryRules = groupedRules[category];
				const Icon = config.icon;

				return (
					<div
						className="overflow-hidden rounded border border-border"
						data-testid={`strategy-rules-display-${category}`}
						key={category}
					>
						{/* Terminal window chrome header */}
						<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-1.5 sm:px-4 sm:py-2">
							<div className="flex items-center gap-1 sm:gap-1.5">
								<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
								<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
								<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
							</div>
							<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
								{category}.rules
							</span>
							<div className="w-10 sm:w-14" />
						</div>

						{/* Category header with icon */}
						<div
							className={cn(
								"flex items-center justify-between border-border/50 border-b bg-muted px-3 py-2 sm:px-4 sm:py-3",
							)}
						>
							<div className="flex items-center gap-1.5 sm:gap-2">
								<Icon
									className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", config.colorClass)}
								/>
								<span
									className={cn(
										"font-mono text-[10px] uppercase tracking-wider sm:text-xs",
										config.colorClass,
									)}
								>
									{config.label}
								</span>
							</div>
							<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
								{categoryRules.length}{" "}
								{categoryRules.length === 1 ? "rule" : "rules"}
							</span>
						</div>

						{/* Rules list or empty placeholder */}
						<div className="p-3 sm:p-4">
							{categoryRules.length === 0 ? (
								<p className="py-3 text-center font-mono text-[10px] text-muted-foreground/60 sm:py-4 sm:text-xs">
									No rules defined
								</p>
							) : (
								<ul className="space-y-1.5 sm:space-y-2">
									{categoryRules.map((rule) => (
										<li
											className="flex items-start gap-2 text-xs sm:gap-3 sm:text-sm"
											data-testid={`strategy-rule-${rule.id}`}
											key={rule.id}
										>
											{/* Checkbox visual indicator (non-interactive) */}
											<div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-border sm:h-4 sm:w-4">
												<ArrowRight className="h-2 w-2 text-muted-foreground sm:h-2.5 sm:w-2.5" />
											</div>
											<span className="font-mono text-foreground/80">
												{rule.text}
											</span>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
