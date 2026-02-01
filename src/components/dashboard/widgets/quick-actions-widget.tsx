"use client";

import {
	BarChart3Icon,
	BookOpenIcon,
	EyeIcon,
	type LucideIcon,
	PlusCircleIcon,
	TargetIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	type SuggestedAction,
	useTradingContext,
} from "@/hooks/use-trading-context";
import { cn } from "@/lib/shared";
import { DashboardWidget } from "../dashboard-widget";

interface QuickAction {
	id: string;
	label: string;
	icon: LucideIcon;
	href: string;
	variant: "default" | "primary" | "secondary";
	showCondition?: (context: ReturnType<typeof useTradingContext>) => boolean;
}

// Define all possible actions
const ACTIONS: QuickAction[] = [
	{
		id: "start-journal",
		label: "Start Journal",
		icon: BookOpenIcon,
		href: "/daily-journal",
		variant: "primary",
		showCondition: (ctx) => ctx.suggestedAction === "start-journal",
	},
	{
		id: "review-trades",
		label: "Review Trades",
		icon: EyeIcon,
		href: "/journal",
		variant: "primary",
		showCondition: (ctx) =>
			ctx.suggestedAction === "review-trades" && ctx.hasOpenPositions,
	},
	{
		id: "log-trade",
		label: "Log Trade",
		icon: PlusCircleIcon,
		href: "/journal/new",
		variant: "secondary",
	},
	{
		id: "view-analytics",
		label: "Analytics",
		icon: BarChart3Icon,
		href: "/analytics",
		variant: "default",
	},
	{
		id: "view-strategies",
		label: "Strategies",
		icon: TargetIcon,
		href: "/strategies",
		variant: "default",
	},
];

// Map suggestedAction to corresponding action ID for highlighting
const SUGGESTED_ACTION_MAP: Record<SuggestedAction, string | null> = {
	"start-journal": "start-journal",
	"review-trades": "review-trades",
	"log-trade": "log-trade",
	idle: null,
};

function ActionButton({
	action,
	isPrimary,
}: {
	action: QuickAction;
	isPrimary: boolean;
}) {
	const Icon = action.icon;

	return (
		<Button
			asChild
			className={cn(
				// Base styles with touch-friendly min height (44px)
				"h-auto min-h-[44px] min-w-[44px] flex-col gap-1 py-3",
				// Mobile: horizontal pill style
				"sm:flex-col",
				isPrimary && "bg-primary/20 ring-1 ring-primary/30 hover:bg-primary/30",
			)}
			variant={isPrimary ? "default" : "ghost"}
		>
			<Link href={action.href}>
				<Icon
					className={cn(
						"h-5 w-5",
						isPrimary ? "text-primary" : "text-muted-foreground",
					)}
				/>
				<span className="font-mono text-[10px] uppercase tracking-wider">
					{action.label}
				</span>
			</Link>
		</Button>
	);
}

/**
 * Quick Actions Widget for the Command Center dashboard.
 *
 * Shows:
 * - Contextual primary action based on trading context
 * - Default actions: Log Trade, Analytics, Strategies
 * - Actions adapt to user's current state
 */
export function QuickActionsWidget() {
	const context = useTradingContext();

	// Determine which action should be highlighted as primary
	const primaryActionId = context.suggestedAction
		? SUGGESTED_ACTION_MAP[context.suggestedAction]
		: null;

	// Filter actions based on show conditions and build display list
	const actionsToShow = ACTIONS.filter((action) => {
		// If action has a showCondition, evaluate it
		if (action.showCondition) {
			return action.showCondition(context);
		}
		// Default actions (no showCondition) are always shown
		return true;
	});

	// Sort to put primary action first
	const sortedActions = [...actionsToShow].sort((a, b) => {
		if (a.id === primaryActionId) return -1;
		if (b.id === primaryActionId) return 1;
		// Then by variant: primary > secondary > default
		const variantOrder = { primary: 0, secondary: 1, default: 2 };
		return variantOrder[a.variant] - variantOrder[b.variant];
	});

	return (
		<DashboardWidget
			data-testid="widget-quick-actions"
			loading={context.isLoading}
			skeletonVariant="actions"
			title="quick-actions"
		>
			{/* Mobile: horizontal scroll, Desktop: 3-column grid */}
			<div className="-mx-4 px-4 sm:mx-0 sm:px-0">
				<div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
					{sortedActions.slice(0, 6).map((action) => (
						<div className="shrink-0 sm:shrink" key={action.id}>
							<ActionButton
								action={action}
								isPrimary={action.id === primaryActionId}
							/>
						</div>
					))}
				</div>
			</div>
		</DashboardWidget>
	);
}
