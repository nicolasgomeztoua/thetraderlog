"use client";

import { ArrowBigDown, ArrowBigUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

export type VoteType = "up" | "down" | null;

export interface VoteButtonsProps {
	/** Strategy ID for identifying the vote target */
	strategyId: string;
	/** Current upvote count */
	upvotes: number;
	/** Current downvote count */
	downvotes: number;
	/** Current user's vote (null if not voted) */
	currentUserVote?: VoteType;
	/** Whether the vote buttons are disabled (e.g., user's own strategy) */
	disabled?: boolean;
	/** Reason for disabled state (shown in tooltip) */
	disabledReason?: string;
	/** Whether a vote mutation is in progress */
	isLoading?: boolean;
	/** Callback when user changes their vote */
	onVoteChange?: (strategyId: string, voteType: VoteType) => void;
	/** Size variant: 'compact' for cards, 'default' for detail page */
	variant?: "compact" | "default";
	/** Additional class names */
	className?: string;
}

// =============================================================================
// VOTE BUTTONS COMPONENT
// =============================================================================

/**
 * Vote buttons component for marketplace strategies.
 *
 * Features:
 * - Horizontal layout: Upvote | score | Downvote
 * - Upvote: ArrowBigUp icon, chartreuse/profit when active
 * - Downvote: ArrowBigDown icon, loss red when active
 * - Score display: net votes (upvotes - downvotes)
 * - Click active vote removes it
 * - Click inactive vote sets it (removes opposite)
 * - Optimistic updates with rollback on error (handled by parent)
 * - Disabled state with tooltip for own strategies
 * - Loading state with spinner while mutation pending
 * - Compact variant for cards, default variant for detail page
 *
 * Props:
 * - strategyId: Strategy identifier
 * - upvotes: Current upvote count
 * - downvotes: Current downvote count
 * - currentUserVote: User's current vote ('up', 'down', or null)
 * - disabled: Whether buttons are disabled
 * - disabledReason: Tooltip text when disabled
 * - isLoading: Whether a mutation is pending
 * - onVoteChange: Callback when user votes
 * - variant: 'compact' or 'default'
 * - className: Additional CSS classes
 */
export function VoteButtons({
	strategyId,
	upvotes,
	downvotes,
	currentUserVote,
	disabled = false,
	disabledReason = "You cannot vote on this strategy",
	isLoading = false,
	onVoteChange,
	variant = "default",
	className,
}: VoteButtonsProps) {
	// Optimistic state for immediate UI feedback
	const [optimisticVote, setOptimisticVote] = useState<VoteType | undefined>(
		undefined,
	);

	const effectiveVote =
		optimisticVote !== undefined ? optimisticVote : currentUserVote;
	const netVotes = upvotes - downvotes;

	// Size classes based on variant
	const buttonSize = variant === "compact" ? "h-7 px-1.5" : "h-9 px-2";
	const iconSize = variant === "compact" ? "h-4 w-4" : "h-5 w-5";
	const textSize = variant === "compact" ? "text-xs" : "text-sm";

	const handleVote = (voteType: "up" | "down") => {
		if (disabled || isLoading || !onVoteChange) return;

		// Optimistic update
		const newVote = effectiveVote === voteType ? null : voteType;
		setOptimisticVote(newVote);

		// Trigger callback
		onVoteChange(strategyId, newVote);

		// Clear optimistic state after a delay (parent will update actual state)
		setTimeout(() => {
			setOptimisticVote(undefined);
		}, 500);
	};

	const upvoteButton = (
		<Button
			className={cn(
				buttonSize,
				"gap-1 font-mono",
				textSize,
				effectiveVote === "up"
					? "border-profit/50 bg-profit/10 text-profit hover:bg-profit/20"
					: "text-muted-foreground hover:text-foreground",
				disabled && "cursor-not-allowed opacity-50",
			)}
			data-testid="vote-button-up"
			disabled={disabled || isLoading}
			onClick={() => handleVote("up")}
			size="sm"
			variant="outline"
		>
			{isLoading && effectiveVote === "up" ? (
				<Loader2 className={cn(iconSize, "animate-spin")} />
			) : (
				<ArrowBigUp
					className={cn(iconSize, effectiveVote === "up" && "fill-current")}
				/>
			)}
			<span>{upvotes}</span>
		</Button>
	);

	const downvoteButton = (
		<Button
			className={cn(
				buttonSize,
				"gap-1 font-mono",
				textSize,
				effectiveVote === "down"
					? "border-loss/50 bg-loss/10 text-loss hover:bg-loss/20"
					: "text-muted-foreground hover:text-foreground",
				disabled && "cursor-not-allowed opacity-50",
			)}
			data-testid="vote-button-down"
			disabled={disabled || isLoading}
			onClick={() => handleVote("down")}
			size="sm"
			variant="outline"
		>
			{isLoading && effectiveVote === "down" ? (
				<Loader2 className={cn(iconSize, "animate-spin")} />
			) : (
				<ArrowBigDown
					className={cn(iconSize, effectiveVote === "down" && "fill-current")}
				/>
			)}
			<span>{downvotes}</span>
		</Button>
	);

	const content = (
		<div className={cn("flex items-center gap-1.5", className)}>
			{/* Upvote button */}
			{upvoteButton}

			{/* Net score */}
			<span
				className={cn(
					"min-w-[2rem] text-center font-mono",
					textSize,
					netVotes > 0
						? "text-profit"
						: netVotes < 0
							? "text-loss"
							: "text-muted-foreground",
				)}
				data-testid="vote-net-score"
			>
				{netVotes > 0 ? "+" : ""}
				{netVotes}
			</span>

			{/* Downvote button */}
			{downvoteButton}
		</div>
	);

	// Wrap in tooltip if disabled
	if (disabled) {
		return (
			<TooltipProvider delayDuration={200}>
				<Tooltip>
					<TooltipTrigger asChild>
						<div>{content}</div>
					</TooltipTrigger>
					<TooltipContent className="font-mono text-xs">
						{disabledReason}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return content;
}
