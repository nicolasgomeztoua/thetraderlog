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
	/** Skeleton variant to use when loading */
	skeletonVariant?: SkeletonVariant;
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
	skeletonVariant = "default",
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
				"border border-border/50 bg-card/50",
				"hover:border-primary/20 hover:shadow-[0_0_15px_rgba(212,255,0,0.1)]",
				"transition-all duration-300",
				className,
			)}
			data-testid={testId}
		>
			{/* Terminal window chrome header */}
			<div className="flex items-center justify-between border-border/50 border-b bg-muted/50 px-4 py-2">
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
				{loading ? <WidgetSkeleton variant={skeletonVariant} /> : children}
			</div>
		</div>
	);
}

/**
 * Skeleton variant types for different widget layouts
 */
export type SkeletonVariant =
	| "default"
	| "performance"
	| "calendar"
	| "list"
	| "status"
	| "metrics"
	| "actions";

/**
 * Loading skeleton for widget content.
 * Supports different variants for different widget types.
 */
export function WidgetSkeleton({
	variant = "default",
}: {
	variant?: SkeletonVariant;
}) {
	switch (variant) {
		case "performance":
			return <PerformanceSkeleton />;
		case "calendar":
			return <CalendarSkeleton />;
		case "list":
			return <ListSkeleton />;
		case "status":
			return <StatusSkeleton />;
		case "metrics":
			return <MetricsSkeleton />;
		case "actions":
			return <ActionsSkeleton />;
		default:
			return <DefaultSkeleton />;
	}
}

/** Default skeleton pattern */
function DefaultSkeleton() {
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

/** Performance widget skeleton (large P&L + stats row) */
function PerformanceSkeleton() {
	return (
		<div
			className="flex h-full flex-col"
			data-testid="widget-skeleton-performance"
		>
			{/* Large P&L display */}
			<div className="flex items-start justify-between">
				<div>
					<Skeleton className="h-9 w-32" />
					<Skeleton className="mt-2 h-4 w-24" />
				</div>
				{/* Win rate gauge placeholder */}
				<Skeleton className="h-12 w-12 rounded-full" />
			</div>
			{/* Stats row */}
			<div className="mt-4 flex items-center gap-4">
				<div>
					<Skeleton className="h-6 w-8" />
					<Skeleton className="mt-1 h-3 w-12" />
				</div>
				<div className="h-8 w-px bg-card/500" />
				<div>
					<Skeleton className="h-6 w-12" />
					<Skeleton className="mt-1 h-3 w-8" />
				</div>
				<div className="h-8 w-px bg-card/500" />
				<div>
					<Skeleton className="h-6 w-10" />
					<Skeleton className="mt-1 h-3 w-8" />
				</div>
			</div>
		</div>
	);
}

/** Calendar widget skeleton (7x5 grid) */
function CalendarSkeleton() {
	return (
		<div
			className="flex h-full flex-col"
			data-testid="widget-skeleton-calendar"
		>
			{/* Month navigation */}
			<div className="mb-3 flex items-center justify-between">
				<Skeleton className="h-7 w-7" />
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-7 w-7" />
			</div>
			{/* Day labels */}
			<div className="mb-1 grid grid-cols-7 gap-1">
				{[...Array(7)].map((_, i) => (
					<Skeleton className="h-3 w-full" key={`day-label-${i.toString()}`} />
				))}
			</div>
			{/* Calendar grid (5 weeks) */}
			<div className="grid grid-cols-7 gap-1">
				{[...Array(35)].map((_, i) => (
					<Skeleton
						className="aspect-square rounded"
						key={`cal-day-${i.toString()}`}
					/>
				))}
			</div>
			{/* Summary row */}
			<div className="mt-3 flex items-center justify-between border-border/50 border-t pt-3">
				<Skeleton className="h-8 w-16" />
				<Skeleton className="h-8 w-12" />
				<Skeleton className="h-8 w-14" />
			</div>
		</div>
	);
}

/** List widget skeleton (5 items) */
function ListSkeleton() {
	return (
		<div className="flex h-full flex-col" data-testid="widget-skeleton-list">
			<div className="flex-1 space-y-2">
				{[...Array(5)].map((_, i) => (
					<div
						className="flex items-center gap-2 rounded bg-muted/50 p-1.5"
						key={`list-item-${i.toString()}`}
					>
						<Skeleton className="h-5 w-5 shrink-0 rounded" />
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-4 w-14 shrink-0" />
						<Skeleton className="h-3 w-10 shrink-0" />
					</div>
				))}
			</div>
			{/* Footer stats */}
			<div className="mt-2 flex items-center justify-between border-border/50 border-t pt-2">
				<Skeleton className="h-3 w-12" />
				<div className="flex items-center gap-3">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-14" />
				</div>
			</div>
		</div>
	);
}

/** Status widget skeleton (status indicator + action button) */
function StatusSkeleton() {
	return (
		<div
			className="flex h-full flex-col justify-between"
			data-testid="widget-skeleton-status"
		>
			{/* Status indicator */}
			<div className="flex items-center gap-3">
				<Skeleton className="h-10 w-10 rounded-lg" />
				<div>
					<Skeleton className="h-4 w-24" />
					<Skeleton className="mt-1 h-3 w-16" />
				</div>
			</div>
			{/* Stats row */}
			<div className="mt-4 flex items-center gap-4">
				<div>
					<Skeleton className="h-5 w-8" />
					<Skeleton className="mt-1 h-3 w-14" />
				</div>
				<div className="h-6 w-px bg-card/500" />
				<div>
					<Skeleton className="h-5 w-12" />
					<Skeleton className="mt-1 h-3 w-16" />
				</div>
			</div>
			{/* Action button */}
			<Skeleton className="mt-4 h-9 w-full rounded" />
		</div>
	);
}

/** Metrics widget skeleton (gauges + sparkline) */
function MetricsSkeleton() {
	return (
		<div className="flex h-full flex-col" data-testid="widget-skeleton-metrics">
			{/* Metric cards row */}
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="h-6 w-16" />
					<Skeleton className="mt-1 h-3 w-20" />
				</div>
				<Skeleton className="h-12 w-12 rounded-full" />
			</div>
			{/* Sparkline */}
			<div className="mt-4 flex-1">
				<Skeleton className="h-16 w-full rounded" />
			</div>
			{/* Bottom stats */}
			<div className="mt-3 grid grid-cols-2 gap-3">
				<div>
					<Skeleton className="h-5 w-10" />
					<Skeleton className="mt-1 h-3 w-14" />
				</div>
				<div>
					<Skeleton className="h-5 w-12" />
					<Skeleton className="mt-1 h-3 w-10" />
				</div>
			</div>
		</div>
	);
}

/** Actions widget skeleton (grid of buttons) */
function ActionsSkeleton() {
	return (
		<div
			className="grid grid-cols-3 gap-2"
			data-testid="widget-skeleton-actions"
		>
			{[...Array(6)].map((_, i) => (
				<Skeleton
					className="flex h-16 flex-col items-center justify-center rounded"
					key={`action-${i.toString()}`}
				/>
			))}
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
