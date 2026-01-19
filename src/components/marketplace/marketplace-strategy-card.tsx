"use client";

import { ArrowBigDown, ArrowBigUp, Download, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryLabel, getInstrumentLabel } from "@/lib/constants";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

export interface MarketplaceStrategyData {
	id: string;
	name: string;
	color: string | null;
	coverImageUrl: string | null;
	categoryTags: string | null; // JSON array string
	instruments: string[]; // Array of instrument values
	authorName: string | null;
	isAnonymous: boolean;
	upvotes: number;
	downvotes: number;
	netVotes: number;
	downloadCount: number;
}

export type VoteType = "up" | "down" | null;

interface MarketplaceStrategyCardProps {
	/** Strategy data */
	strategy: MarketplaceStrategyData;
	/** Current user's vote on this strategy (null if not voted) */
	currentUserVote?: VoteType;
	/** Callback when user votes */
	onVote?: (strategyId: string, voteType: VoteType) => void;
	/** Additional class names */
	className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse category tags from JSON string
 */
function parseCategories(categoryTags: string | null): string[] {
	if (!categoryTags) return [];
	try {
		const parsed = JSON.parse(categoryTags);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

export function MarketplaceStrategyCardSkeleton() {
	return (
		<div
			className="overflow-hidden rounded-lg border border-border bg-card"
			data-testid="marketplace-strategy-card-skeleton"
		>
			{/* Cover image skeleton */}
			<Skeleton className="aspect-[16/7] w-full" />

			{/* Content */}
			<div className="space-y-3 p-4">
				{/* Title */}
				<Skeleton className="h-5 w-3/4" />

				{/* Author */}
				<div className="flex items-center gap-2">
					<Skeleton className="h-5 w-5 rounded-full" />
					<Skeleton className="h-4 w-24" />
				</div>

				{/* Tags */}
				<div className="flex gap-2">
					<Skeleton className="h-5 w-16 rounded" />
					<Skeleton className="h-5 w-20 rounded" />
					<Skeleton className="h-5 w-14 rounded" />
				</div>

				{/* Stats */}
				<div className="flex items-center justify-between border-border border-t pt-3">
					<div className="flex gap-3">
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-6 w-16" />
					</div>
					<Skeleton className="h-4 w-20" />
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Marketplace strategy card component.
 *
 * Features:
 * - Cover image/gradient at top (16:9 cropped to shorter aspect)
 * - Strategy name with truncation
 * - Author (username or 'Anonymous')
 * - Tags: category pills (max 2 + '+N'), instrument pills (max 3 + '+N')
 * - Stats: upvotes, downvotes, net score, download count
 * - Inline vote buttons
 * - Click to navigate to detail page
 * - Hover effect with subtle border change
 *
 * Props:
 * - strategy: Strategy data object
 * - currentUserVote: User's current vote ('up', 'down', or null)
 * - onVote: Callback when user votes
 * - className: Optional additional CSS classes
 */
export function MarketplaceStrategyCard({
	strategy,
	currentUserVote,
	onVote,
	className,
}: MarketplaceStrategyCardProps) {
	const categories = parseCategories(strategy.categoryTags);
	const color = strategy.color ?? "#d4ff00";

	// Display limits
	const MAX_CATEGORIES = 2;
	const MAX_INSTRUMENTS = 3;

	const displayCategories = categories.slice(0, MAX_CATEGORIES);
	const extraCategories = categories.length - MAX_CATEGORIES;

	const displayInstruments = strategy.instruments.slice(0, MAX_INSTRUMENTS);
	const extraInstruments = strategy.instruments.length - MAX_INSTRUMENTS;

	const handleVote = (e: React.MouseEvent, voteType: "up" | "down") => {
		e.preventDefault();
		e.stopPropagation();

		if (!onVote) return;

		// Toggle vote if clicking same type, otherwise change vote
		if (currentUserVote === voteType) {
			onVote(strategy.id, null);
		} else {
			onVote(strategy.id, voteType);
		}
	};

	return (
		<Link
			className={cn(
				"group block overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/30",
				className,
			)}
			data-testid="marketplace-strategy-card"
			href={`/marketplace/${strategy.id}`}
		>
			{/* Cover Image / Gradient */}
			<div className="relative aspect-[16/7] w-full overflow-hidden">
				{strategy.coverImageUrl ? (
					<Image
						alt={strategy.name}
						className="h-full w-full object-cover transition-transform group-hover:scale-105"
						data-testid="marketplace-card-cover-image"
						fill
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
						src={strategy.coverImageUrl}
					/>
				) : (
					/* Default gradient based on strategy color */
					<div
						className="h-full w-full"
						data-testid="marketplace-card-cover-gradient"
						style={{
							background: `linear-gradient(135deg, ${color}20 0%, ${color}05 100%)`,
						}}
					>
						{/* Strategy name centered on gradient */}
						<div className="absolute inset-0 flex items-center justify-center">
							<span
								className="px-4 text-center font-bold font-mono text-2xl uppercase tracking-wider opacity-20"
								style={{ color }}
							>
								{strategy.name}
							</span>
						</div>
					</div>
				)}

				{/* Color indicator stripe */}
				<div
					className="absolute bottom-0 left-0 h-1 w-full"
					style={{ backgroundColor: color }}
				/>
			</div>

			{/* Content */}
			<div className="space-y-3 p-4">
				{/* Strategy Name */}
				<h3
					className="truncate font-mono font-semibold text-base"
					data-testid="marketplace-card-name"
				>
					{strategy.name}
				</h3>

				{/* Author */}
				<div
					className="flex items-center gap-2"
					data-testid="marketplace-card-author"
				>
					<User className="h-4 w-4 text-muted-foreground" />
					<span className="font-mono text-muted-foreground text-xs">
						{strategy.isAnonymous || !strategy.authorName
							? "Anonymous"
							: strategy.authorName}
					</span>
				</div>

				{/* Tags Row: Categories and Instruments */}
				<div
					className="flex flex-wrap items-center gap-1.5"
					data-testid="marketplace-card-tags"
				>
					{/* Category pills */}
					{displayCategories.map((cat) => (
						<Badge
							className="bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary"
							key={cat}
							variant="secondary"
						>
							{getCategoryLabel(cat)}
						</Badge>
					))}
					{extraCategories > 0 && (
						<Badge
							className="bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary"
							variant="secondary"
						>
							+{extraCategories}
						</Badge>
					)}

					{/* Divider if we have both */}
					{displayCategories.length > 0 && displayInstruments.length > 0 && (
						<span className="text-muted-foreground/30">•</span>
					)}

					{/* Instrument pills */}
					{displayInstruments.map((inst) => (
						<Badge
							className="bg-muted px-2 py-0.5 font-mono text-[10px]"
							key={inst}
							variant="outline"
						>
							{getInstrumentLabel(inst)}
						</Badge>
					))}
					{extraInstruments > 0 && (
						<Badge
							className="bg-muted px-2 py-0.5 font-mono text-[10px]"
							variant="outline"
						>
							+{extraInstruments}
						</Badge>
					)}
				</div>

				{/* Stats Row with Vote Buttons */}
				<div
					className="flex items-center justify-between border-border border-t pt-3"
					data-testid="marketplace-card-stats"
				>
					{/* Vote buttons */}
					<div className="flex items-center gap-1">
						<Button
							className={cn(
								"h-8 gap-1 px-2 font-mono text-xs",
								currentUserVote === "up"
									? "border-profit/50 bg-profit/10 text-profit hover:bg-profit/20"
									: "text-muted-foreground hover:text-foreground",
							)}
							data-testid="marketplace-card-vote-up"
							onClick={(e) => handleVote(e, "up")}
							size="sm"
							variant="outline"
						>
							<ArrowBigUp
								className={cn(
									"h-4 w-4",
									currentUserVote === "up" && "fill-current",
								)}
							/>
							<span>{strategy.upvotes}</span>
						</Button>

						<Button
							className={cn(
								"h-8 gap-1 px-2 font-mono text-xs",
								currentUserVote === "down"
									? "border-loss/50 bg-loss/10 text-loss hover:bg-loss/20"
									: "text-muted-foreground hover:text-foreground",
							)}
							data-testid="marketplace-card-vote-down"
							onClick={(e) => handleVote(e, "down")}
							size="sm"
							variant="outline"
						>
							<ArrowBigDown
								className={cn(
									"h-4 w-4",
									currentUserVote === "down" && "fill-current",
								)}
							/>
							<span>{strategy.downvotes}</span>
						</Button>

						{/* Net score */}
						<span
							className={cn(
								"ml-1 font-mono text-xs",
								strategy.netVotes > 0
									? "text-profit"
									: strategy.netVotes < 0
										? "text-loss"
										: "text-muted-foreground",
							)}
							data-testid="marketplace-card-net-votes"
						>
							({strategy.netVotes > 0 ? "+" : ""}
							{strategy.netVotes})
						</span>
					</div>

					{/* Download count */}
					<div
						className="flex items-center gap-1 font-mono text-muted-foreground text-xs"
						data-testid="marketplace-card-downloads"
					>
						<Download className="h-3.5 w-3.5" />
						<span>{strategy.downloadCount}</span>
					</div>
				</div>
			</div>
		</Link>
	);
}
