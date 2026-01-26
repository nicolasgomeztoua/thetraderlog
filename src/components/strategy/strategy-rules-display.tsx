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
				className="overflow-hidden rounded border border-white/10 border-dashed"
				data-testid="strategy-rules-display-empty"
			>
				{/* Terminal window chrome */}
				<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2">
					<div className="flex items-center gap-1.5">
						<div className="h-2 w-2 rounded-full bg-loss/60" />
						<div className="h-2 w-2 rounded-full bg-breakeven/60" />
						<div className="h-2 w-2 rounded-full bg-profit/60" />
					</div>
					<span className="font-mono text-[10px] text-muted-foreground">
						rules — empty
					</span>
					<div className="w-14" />
				</div>
				<div className="px-6 py-8 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No rules defined for this playbook
					</p>
					<p className="mt-1 font-mono text-muted-foreground/60 text-xs">
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
						className="overflow-hidden rounded border border-white/10"
						data-testid={`strategy-rules-display-${category}`}
						key={category}
					>
						{/* Terminal window chrome header */}
						<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2">
							<div className="flex items-center gap-1.5">
								<div className="h-2 w-2 rounded-full bg-loss/60" />
								<div className="h-2 w-2 rounded-full bg-breakeven/60" />
								<div className="h-2 w-2 rounded-full bg-profit/60" />
							</div>
							<span className="font-mono text-[10px] text-muted-foreground">
								{category}.rules
							</span>
							<div className="w-14" />
						</div>

						{/* Category header with icon */}
						<div
							className={cn(
								"flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-3",
							)}
						>
							<div className="flex items-center gap-2">
								<Icon className={cn("h-4 w-4", config.colorClass)} />
								<span
									className={cn(
										"font-mono text-xs uppercase tracking-wider",
										config.colorClass,
									)}
								>
									{config.label}
								</span>
							</div>
							<span className="font-mono text-[10px] text-muted-foreground">
								{categoryRules.length}{" "}
								{categoryRules.length === 1 ? "rule" : "rules"}
							</span>
						</div>

						{/* Rules list or empty placeholder */}
						<div className="p-4">
							{categoryRules.length === 0 ? (
								<p className="py-4 text-center font-mono text-muted-foreground/60 text-xs">
									No rules defined
								</p>
							) : (
								<ul className="space-y-2">
									{categoryRules.map((rule) => (
										<li
											className="flex items-start gap-3 text-sm"
											data-testid={`strategy-rule-${rule.id}`}
											key={rule.id}
										>
											{/* Checkbox visual indicator (non-interactive) */}
											<div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/20">
												<ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
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
