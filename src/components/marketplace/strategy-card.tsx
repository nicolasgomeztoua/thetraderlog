"use client";

import {
	ArrowBigDown,
	ArrowBigUp,
	Download,
	ShieldCheck,
	TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

export interface MarketplaceStrategyData {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
	coverImageUrl: string | null;
	instruments: string[] | null;
	categoryTags: string[] | null;
	creator: {
		id: string;
		name: string | null;
		imageUrl: string | null;
	} | null;
	stats: {
		totalTrades: number;
		winRate: number;
		profitFactor: number | null;
	} | null;
	trackRecordStatus: "limited" | "normal" | "verified";
	engagement: {
		voteScore: number;
		downloadCount: number;
	};
	hasVoted: number | null;
}

interface StrategyCardProps {
	strategy: MarketplaceStrategyData;
	currentUserId?: string;
}

// =============================================================================
// VOTE CONTROLS COMPONENT
// =============================================================================

export interface VoteControlsProps {
	strategyId: string;
	voteScore: number;
	hasVoted: number | null;
	onVoteUpdate: (newScore: number, newVote: number | null) => void;
	isOwner?: boolean;
	size?: "sm" | "md";
}

export function VoteControls({
	strategyId,
	voteScore,
	hasVoted,
	onVoteUpdate,
	isOwner = false,
	size = "sm",
}: VoteControlsProps) {
	const utils = api.useUtils();

	const voteMutation = api.marketplace.vote.useMutation({
		onMutate: async ({ vote }) => {
			// Optimistic update
			const oldScore = voteScore;
			const oldVote = hasVoted;

			// Calculate new score based on vote change
			let scoreDelta = vote;
			if (oldVote !== null) {
				// Changing vote: remove old vote, add new vote
				scoreDelta = vote - oldVote;
			}

			onVoteUpdate(oldScore + scoreDelta, vote);

			return { oldScore, oldVote };
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context) {
				onVoteUpdate(context.oldScore, context.oldVote);
			}
			toast.error(error.message || "Failed to vote");
		},
		onSettled: () => {
			// Invalidate marketplace queries to sync with server
			utils.marketplace.list.invalidate();
		},
	});

	const removeVoteMutation = api.marketplace.removeVote.useMutation({
		onMutate: async () => {
			// Optimistic update
			const oldScore = voteScore;
			const oldVote = hasVoted;

			// Remove vote: subtract old vote from score
			const newScore = oldVote !== null ? oldScore - oldVote : oldScore;
			onVoteUpdate(newScore, null);

			return { oldScore, oldVote };
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context) {
				onVoteUpdate(context.oldScore, context.oldVote);
			}
			toast.error(error.message || "Failed to remove vote");
		},
		onSettled: () => {
			utils.marketplace.list.invalidate();
		},
	});

	const handleUpvote = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (hasVoted === 1) {
			// Remove vote if already upvoted
			removeVoteMutation.mutate({ strategyId });
		} else {
			// Upvote
			voteMutation.mutate({ strategyId, vote: 1 });
		}
	};

	const handleDownvote = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (hasVoted === -1) {
			// Remove vote if already downvoted
			removeVoteMutation.mutate({ strategyId });
		} else {
			// Downvote
			voteMutation.mutate({ strategyId, vote: -1 });
		}
	};

	const isLoading = voteMutation.isPending || removeVoteMutation.isPending;
	const isDisabled = isLoading || isOwner;

	// Size variants
	const iconSize = size === "md" ? "h-6 w-6" : "h-5 w-5";
	const scoreSize = size === "md" ? "text-base" : "text-sm";

	// If owner, show disabled state with tooltip
	if (isOwner) {
		return (
			<div
				className="flex items-center gap-0.5 opacity-50"
				data-testid={`strategy-card-votes-${strategyId}`}
				title="You cannot vote on your own strategy"
			>
				{/* Upvote button (disabled) */}
				<button
					aria-label="Upvote (disabled - your strategy)"
					className="cursor-not-allowed rounded p-1 text-muted-foreground"
					data-testid={`strategy-card-upvote-${strategyId}`}
					disabled
					type="button"
				>
					<ArrowBigUp className={iconSize} />
				</button>

				{/* Vote score */}
				<span
					className={cn(
						"min-w-[2ch] text-center font-medium font-mono",
						scoreSize,
						voteScore > 0 && "text-primary",
						voteScore < 0 && "text-loss",
						voteScore === 0 && "text-muted-foreground",
					)}
					data-testid={`strategy-card-score-${strategyId}`}
				>
					{voteScore}
				</span>

				{/* Downvote button (disabled) */}
				<button
					aria-label="Downvote (disabled - your strategy)"
					className="cursor-not-allowed rounded p-1 text-muted-foreground"
					data-testid={`strategy-card-downvote-${strategyId}`}
					disabled
					type="button"
				>
					<ArrowBigDown className={iconSize} />
				</button>
			</div>
		);
	}

	return (
		<div
			className="flex items-center gap-0.5"
			data-testid={`strategy-card-votes-${strategyId}`}
		>
			{/* Upvote button */}
			<button
				aria-label="Upvote"
				className={cn(
					"rounded p-1 transition-colors hover:bg-primary/10",
					hasVoted === 1 && "text-primary",
					isDisabled && "pointer-events-none opacity-50",
				)}
				data-testid={`strategy-card-upvote-${strategyId}`}
				disabled={isDisabled}
				onClick={handleUpvote}
				type="button"
			>
				<ArrowBigUp
					className={cn(
						iconSize,
						"transition-all",
						hasVoted === 1 && "fill-primary",
					)}
				/>
			</button>

			{/* Vote score */}
			<span
				className={cn(
					"min-w-[2ch] text-center font-medium font-mono",
					scoreSize,
					voteScore > 0 && "text-primary",
					voteScore < 0 && "text-loss",
					voteScore === 0 && "text-muted-foreground",
				)}
				data-testid={`strategy-card-score-${strategyId}`}
			>
				{voteScore}
			</span>

			{/* Downvote button */}
			<button
				aria-label="Downvote"
				className={cn(
					"rounded p-1 transition-colors hover:bg-loss/10",
					hasVoted === -1 && "text-loss",
					isDisabled && "pointer-events-none opacity-50",
				)}
				data-testid={`strategy-card-downvote-${strategyId}`}
				disabled={isDisabled}
				onClick={handleDownvote}
				type="button"
			>
				<ArrowBigDown
					className={cn(
						iconSize,
						"transition-all",
						hasVoted === -1 && "fill-loss",
					)}
				/>
			</button>
		</div>
	);
}

// =============================================================================
// TRACK RECORD BADGE
// =============================================================================

function TrackRecordBadge({
	status,
}: {
	status: "limited" | "normal" | "verified";
}) {
	if (status === "normal") return null;

	if (status === "verified") {
		return (
			<div
				className="absolute top-2 right-2 flex items-center gap-1 rounded bg-profit/20 px-2 py-0.5"
				data-testid="track-record-verified"
			>
				<ShieldCheck className="h-3 w-3 text-profit" />
				<span className="font-mono text-[10px] text-profit uppercase">
					Verified
				</span>
			</div>
		);
	}

	return (
		<div
			className="absolute top-2 right-2 flex items-center gap-1 rounded bg-yellow-500/20 px-2 py-0.5"
			data-testid="track-record-limited"
		>
			<TriangleAlert className="h-3 w-3 text-yellow-500" />
			<span className="font-mono text-[10px] text-yellow-500 uppercase">
				Limited Data
			</span>
		</div>
	);
}

// =============================================================================
// MAIN STRATEGY CARD COMPONENT
// =============================================================================

export function StrategyCard({ strategy, currentUserId }: StrategyCardProps) {
	// Local state for optimistic updates
	const [voteScore, setVoteScore] = useState(strategy.engagement.voteScore);
	const [hasVoted, setHasVoted] = useState(strategy.hasVoted);

	// Determine if current user owns this strategy
	const isOwner = !!(currentUserId && strategy.creator?.id === currentUserId);

	const handleVoteUpdate = (newScore: number, newVote: number | null) => {
		setVoteScore(newScore);
		setHasVoted(newVote);
	};

	return (
		<Link
			className="group block overflow-hidden rounded border border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
			data-testid={`marketplace-strategy-card-${strategy.id}`}
			href={`/marketplace/${strategy.id}`}
		>
			{/* Cover image or gradient placeholder */}
			<div
				className="relative aspect-3/1 w-full overflow-hidden"
				data-testid={`strategy-card-cover-${strategy.id}`}
				style={{
					background: strategy.coverImageUrl
						? undefined
						: `linear-gradient(135deg, ${strategy.color ?? "#d4ff00"}20 0%, ${strategy.color ?? "#d4ff00"}05 50%, transparent 100%)`,
				}}
			>
				{strategy.coverImageUrl && (
					<Image
						alt={strategy.name}
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
						fill
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
						src={strategy.coverImageUrl}
						unoptimized
					/>
				)}

				{/* Track record badge */}
				<TrackRecordBadge status={strategy.trackRecordStatus} />
			</div>

			{/* Content */}
			<div className="p-4">
				{/* Strategy name */}
				<h3
					className="mb-1 truncate font-medium font-mono text-sm"
					data-testid={`strategy-card-name-${strategy.id}`}
				>
					{strategy.name}
				</h3>

				{/* Description (truncated) */}
				{strategy.description && (
					<p
						className="mb-3 line-clamp-2 font-mono text-muted-foreground text-xs"
						data-testid={`strategy-card-description-${strategy.id}`}
					>
						{strategy.description}
					</p>
				)}

				{/* Creator */}
				<div
					className="mb-3 flex items-center gap-2"
					data-testid={`strategy-card-creator-${strategy.id}`}
				>
					{strategy.creator ? (
						<>
							{strategy.creator.imageUrl ? (
								<Image
									alt={strategy.creator.name ?? "Creator"}
									className="rounded-full"
									height={20}
									src={strategy.creator.imageUrl}
									width={20}
								/>
							) : (
								<div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
									<span className="font-mono text-[10px] text-primary">
										{strategy.creator.name?.charAt(0).toUpperCase() ?? "?"}
									</span>
								</div>
							)}
							<span className="font-mono text-muted-foreground text-xs">
								{strategy.creator.name ?? "Anonymous"}
							</span>
						</>
					) : (
						<span className="font-mono text-muted-foreground text-xs italic">
							Anonymous
						</span>
					)}
				</div>

				{/* Stats row */}
				{strategy.stats && (
					<div
						className="mb-3 flex items-center gap-4 font-mono text-xs"
						data-testid={`strategy-card-stats-${strategy.id}`}
					>
						<span>
							<span className="text-muted-foreground">Win: </span>
							<span
								className={
									strategy.stats.winRate >= 50 ? "text-profit" : "text-loss"
								}
							>
								{strategy.stats.winRate.toFixed(1)}%
							</span>
						</span>
						<span>
							<span className="text-muted-foreground">PF: </span>
							<span
								className={
									(strategy.stats.profitFactor ?? 0) >= 1
										? "text-profit"
										: "text-loss"
								}
							>
								{strategy.stats.profitFactor === null
									? "N/A"
									: strategy.stats.profitFactor.toFixed(2)}
							</span>
						</span>
						<span className="text-muted-foreground">
							{strategy.stats.totalTrades} trades
						</span>
					</div>
				)}

				{/* Category badges */}
				{strategy.categoryTags && strategy.categoryTags.length > 0 && (
					<div
						className="mb-3 flex flex-wrap gap-1"
						data-testid={`strategy-card-categories-${strategy.id}`}
					>
						{strategy.categoryTags.slice(0, 3).map((category) => (
							<span
								className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent"
								key={category}
							>
								{category}
							</span>
						))}
						{strategy.categoryTags.length > 3 && (
							<span className="font-mono text-[10px] text-muted-foreground">
								+{strategy.categoryTags.length - 3}
							</span>
						)}
					</div>
				)}

				{/* Engagement row: votes, downloads, instruments */}
				<div className="flex items-center justify-between border-border border-t pt-3">
					<div className="flex items-center gap-3">
						{/* Vote controls */}
						<VoteControls
							hasVoted={hasVoted}
							isOwner={isOwner}
							onVoteUpdate={handleVoteUpdate}
							strategyId={strategy.id}
							voteScore={voteScore}
						/>

						{/* Download count */}
						<span
							className="flex items-center gap-1 font-mono text-muted-foreground text-xs"
							data-testid={`strategy-card-downloads-${strategy.id}`}
						>
							<Download className="h-3.5 w-3.5" />
							{strategy.engagement.downloadCount}
						</span>
					</div>

					{/* Instrument badges */}
					{strategy.instruments && strategy.instruments.length > 0 && (
						<div
							className="flex items-center gap-1"
							data-testid={`strategy-card-instruments-${strategy.id}`}
						>
							{strategy.instruments.slice(0, 2).map((instrument) => (
								<span
									className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary"
									key={instrument}
								>
									{instrument}
								</span>
							))}
							{strategy.instruments.length > 2 && (
								<span className="font-mono text-[10px] text-muted-foreground">
									+{strategy.instruments.length - 2}
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</Link>
	);
}
