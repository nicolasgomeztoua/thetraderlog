"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/shared";

/**
 * Widget size variants for the Command Center grid.
 * - sm: 1x1 (single cell)
 * - md: 2x1 (two columns wide, one row tall)
 * - lg: 2x2 (two columns wide, two rows tall)
 * - wide: 3x1 (full width on desktop, one row tall)
 */
export type WidgetSize = "sm" | "md" | "lg" | "wide";

/**
 * Maps widget size to CSS Grid column/row spans
 */
const sizeClasses: Record<WidgetSize, string> = {
	sm: "col-span-1 row-span-1",
	md: "col-span-1 md:col-span-2 row-span-1",
	lg: "col-span-1 md:col-span-2 row-span-1 md:row-span-2",
	wide: "col-span-1 md:col-span-2 lg:col-span-3 row-span-1",
};

interface CommandCenterGridProps {
	/** Grid children (widgets) */
	children: ReactNode;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Responsive grid layout for the Command Center dashboard.
 *
 * Layout:
 * - Desktop (lg): 3 columns
 * - Tablet (md): 2 columns
 * - Mobile: 1 column
 *
 * Uses CSS Grid with auto-placement for flexible widget arrangement.
 */
export function CommandCenterGrid({
	children,
	className,
}: CommandCenterGridProps) {
	return (
		<div
			className={cn(
				// Base grid
				"grid gap-4",
				// Responsive columns: 1 -> 2 -> 3
				"grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
				// Auto-rows for flexible heights (min 120px for small widgets)
				"auto-rows-fr",
				className,
			)}
			data-testid="command-center-grid"
		>
			{children}
		</div>
	);
}

interface GridItemProps {
	/** Widget size variant */
	size?: WidgetSize;
	/** Grid children */
	children: ReactNode;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Grid item wrapper that applies size-based column/row spans.
 * Wrap each widget in this component to control its grid placement.
 */
export function GridItem({ size = "sm", children, className }: GridItemProps) {
	return (
		<div className={cn(sizeClasses[size], className)} data-testid="grid-item">
			{children}
		</div>
	);
}
