"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/shared";
import type { WidgetSize } from "./command-center-grid";

interface DashboardWidgetProps {
	/** Widget title displayed in the header */
	title: string;
	/** Optional Lucide icon for the header */
	icon?: LucideIcon;
	/** Widget size variant for grid placement */
	size?: WidgetSize;
	/** Optional link to full page (shows View More) */
	href?: string;
	/** Whether the widget is in a loading state */
	loading?: boolean;
	/** Widget content */
	children: ReactNode;
	/** Additional CSS classes for the widget container */
	className?: string;
	/** data-testid for testing */
	"data-testid"?: string;
}

/**
 * Base dashboard widget component with Terminal window chrome styling.
 *
 * Features:
 * - Terminal-style header with traffic light dots
 * - Optional icon and View More link
 * - Loading skeleton state
 * - Hover glow effect
 */
export function DashboardWidget({
	title,
	icon: Icon,
	href,
	loading = false,
	children,
	className,
	"data-testid": testId,
}: DashboardWidgetProps) {
	return (
		<div
			className={cn(
				// Base container with Terminal styling
				"flex h-full flex-col overflow-hidden rounded",
				// Border with hover glow effect
				"border border-white/5 bg-white/1",
				"hover:border-primary/20 hover:shadow-[0_0_15px_rgba(212,255,0,0.1)]",
				"transition-all duration-300",
				className,
			)}
			data-testid={testId}
		>
			{/* Terminal window chrome header */}
			<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2">
				<div className="flex items-center gap-2">
					{/* Traffic light dots */}
					<div className="flex items-center gap-1.5">
						<div className="h-2 w-2 rounded-full bg-loss/60" />
						<div className="h-2 w-2 rounded-full bg-breakeven/60" />
						<div className="h-2 w-2 rounded-full bg-profit/60" />
					</div>
					{/* Icon and title */}
					<div className="flex items-center gap-2 pl-2">
						{Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
						<span className="font-mono text-[11px] text-muted-foreground">
							{title}
						</span>
					</div>
				</div>
				{/* View More link */}
				{href && (
					<Link
						className="group flex items-center gap-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:text-primary"
						href={href}
					>
						<span>View</span>
						<ArrowRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
					</Link>
				)}
			</div>

			{/* Content area */}
			<div className="flex-1 p-4">
				{loading ? <WidgetSkeleton /> : children}
			</div>
		</div>
	);
}

/**
 * Loading skeleton for widget content.
 * Displays a generic skeleton pattern while data is loading.
 */
function WidgetSkeleton() {
	return (
		<div className="space-y-3" data-testid="widget-skeleton">
			<Skeleton className="h-8 w-24" />
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-3/4" />
			<div className="flex gap-2 pt-2">
				<Skeleton className="h-10 w-20" />
				<Skeleton className="h-10 w-20" />
			</div>
		</div>
	);
}

/**
 * Empty state component for widgets with no data.
 */
export function WidgetEmptyState({
	message,
	icon: Icon,
}: {
	message: string;
	icon?: LucideIcon;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center py-6 text-center">
			{Icon && <Icon className="mb-2 h-8 w-8 text-muted-foreground/40" />}
			<p className="font-mono text-[11px] text-muted-foreground">{message}</p>
		</div>
	);
}
