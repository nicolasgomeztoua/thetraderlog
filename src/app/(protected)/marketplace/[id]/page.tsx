"use client";

import {
	ArrowLeft,
	Calendar,
	CheckCircle,
	Copy,
	Download,
	ExternalLink,
	Loader2,
	User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { VoteButtons } from "@/components/marketplace/vote-buttons";
import { DefaultCover } from "@/components/strategy/default-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_INSTRUMENTS, STRATEGY_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// HELPERS
// =============================================================================

function getCategoryLabel(value: string): string {
	const category = STRATEGY_CATEGORIES.find((c) => c.value === value);
	return category?.label ?? value;
}

function getInstrumentLabel(value: string): string {
	const instrument = ALL_INSTRUMENTS.find((i) => i.value === value);
	return instrument?.symbol ?? value.toUpperCase();
}

function formatDate(date: Date | string | null): string {
	if (!date) return "Unknown";
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function MarketplaceDetailSkeleton() {
	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-6 py-4 sm:py-6"
			data-testid="marketplace-detail-loading"
		>
			{/* Hero skeleton */}
			<Skeleton className="aspect-video w-full rounded-lg" />

			{/* Title bar skeleton */}
			<div className="space-y-2">
				<Skeleton className="h-8 w-2/3" />
				<div className="flex items-center gap-4">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-5 w-32" />
				</div>
			</div>

			{/* Action bar skeleton */}
			<div className="flex items-center gap-4">
				<Skeleton className="h-10 w-32" />
				<Skeleton className="h-10 w-40" />
			</div>

			{/* Stats skeleton */}
			<div className="flex gap-6">
				<Skeleton className="h-12 w-24" />
				<Skeleton className="h-12 w-24" />
				<Skeleton className="h-12 w-24" />
			</div>

			{/* Tabs skeleton */}
			<div className="space-y-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		</div>
	);
}

// =============================================================================
// NOT FOUND STATE
// =============================================================================

function NotFoundState() {
	return (
		<div
			className="mx-auto flex w-[95%] max-w-4xl flex-col items-center justify-center py-16"
			data-testid="marketplace-detail-not-found"
		>
			<div className="rounded-full bg-muted p-4">
				<ExternalLink className="size-8 text-muted-foreground" />
			</div>
			<h1 className="mt-4 font-bold font-mono text-xl">Strategy Not Found</h1>
			<p className="mt-2 text-center font-mono text-muted-foreground text-sm">
				This strategy may have been unpublished or doesn't exist.
			</p>
			<Link href="/marketplace">
				<Button className="mt-6 font-mono" variant="outline">
					<ArrowLeft className="mr-2 size-4" />
					Back to Marketplace
				</Button>
			</Link>
		</div>
	);
}

// =============================================================================
// RULE DISPLAY
// =============================================================================

interface RuleItemProps {
	rule: {
		id: string;
		text: string;
		category: "entry" | "exit" | "risk" | "management";
		order: number;
	};
}

function RuleItem({ rule }: RuleItemProps) {
	return (
		<div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
			<CheckCircle className="mt-0.5 size-4 shrink-0 text-profit" />
			<div className="flex-1 space-y-1">
				<p className="font-medium font-mono text-sm">{rule.text}</p>
				{rule.category && (
					<Badge
						className="mt-1 font-mono text-xs capitalize"
						variant="outline"
					>
						{rule.category}
					</Badge>
				)}
			</div>
		</div>
	);
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function MarketplaceDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const strategyId = params.id;

	const [isDownloading, setIsDownloading] = useState(false);

	// Fetch strategy data
	const {
		data: strategy,
		isLoading,
		error,
		refetch,
	} = api.strategies.marketplaceGetById.useQuery(
		{ strategyId },
		{
			retry: false,
		},
	);

	// Vote mutation
	const voteMutation = api.strategies.vote.useMutation({
		onSuccess: () => {
			refetch();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to vote");
		},
	});

	// Download mutation
	const downloadMutation = api.strategies.download.useMutation({
		onSuccess: (data) => {
			setIsDownloading(false);
			toast.success("Strategy added to your collection", {
				action: {
					label: "View Strategy",
					onClick: () => router.push(`/strategies/${data.id}`),
				},
			});
			refetch();
		},
		onError: (error) => {
			setIsDownloading(false);
			toast.error(error.message || "Failed to download strategy");
		},
	});

	const handleVoteChange = (
		_strategyId: string,
		voteType: "up" | "down" | null,
	) => {
		voteMutation.mutate({ strategyId, voteType });
	};

	const handleDownload = () => {
		if (strategy?.currentUserHasDownloaded) {
			// Navigate to existing copy
			router.push("/strategies");
			return;
		}
		setIsDownloading(true);
		downloadMutation.mutate({ strategyId });
	};

	// Show loading skeleton
	if (isLoading) {
		return <MarketplaceDetailSkeleton />;
	}

	// Show 404 if not found
	if (error || !strategy) {
		return <NotFoundState />;
	}

	// Parse instruments and categories
	const instruments: string[] = strategy.instruments
		? JSON.parse(strategy.instruments as string)
		: [];
	const categories: string[] = strategy.categoryTags
		? JSON.parse(strategy.categoryTags as string)
		: [];

	const strategyColor = strategy.color ?? "#d4ff00";
	const authorName = strategy.isAnonymous
		? "Anonymous"
		: (strategy.authorName ?? "Unknown");

	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-6 py-4 sm:py-6"
			data-testid="marketplace-detail-page"
		>
			{/* Back link */}
			<Link
				className="inline-flex items-center gap-1 font-mono text-muted-foreground text-sm transition-colors hover:text-foreground"
				data-testid="marketplace-detail-back"
				href="/marketplace"
			>
				<ArrowLeft className="size-4" />
				Back to Marketplace
			</Link>

			{/* Hero banner */}
			<div
				className="relative aspect-video w-full overflow-hidden rounded-lg"
				data-testid="marketplace-detail-hero"
			>
				{strategy.coverImageUrl ? (
					<Image
						alt={`${strategy.name} cover`}
						className="h-full w-full object-cover"
						fill
						priority
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
						src={strategy.coverImageUrl}
					/>
				) : (
					<DefaultCover
						categoryTag={categories[0]}
						className="h-full"
						strategyColor={strategyColor}
						strategyName={strategy.name}
					/>
				)}
				{/* Gradient overlay */}
				{strategy.coverImageUrl && (
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
				)}
			</div>

			{/* Title bar */}
			<div className="space-y-2" data-testid="marketplace-detail-title-bar">
				<h1 className="font-bold font-mono text-2xl sm:text-3xl">
					{strategy.name}
				</h1>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-muted-foreground text-sm">
					<span className="flex items-center gap-1.5">
						<User className="size-4" />
						{authorName}
					</span>
					<span className="flex items-center gap-1.5">
						<Calendar className="size-4" />
						Published {formatDate(strategy.publishedAt)}
					</span>
				</div>
			</div>

			{/* Action bar */}
			<div
				className="flex flex-wrap items-center gap-4"
				data-testid="marketplace-detail-actions"
			>
				{/* Vote buttons */}
				<VoteButtons
					currentUserVote={strategy.currentUserVote as "up" | "down" | null}
					disabled={strategy.isOwner}
					disabledReason="You cannot vote on your own strategy"
					downvotes={strategy.downvotes}
					isLoading={voteMutation.isPending}
					onVoteChange={handleVoteChange}
					strategyId={strategyId}
					upvotes={strategy.upvotes}
					variant="default"
				/>

				{/* Download button */}
				<Button
					className={cn(
						"gap-2 font-mono",
						strategy.currentUserHasDownloaded &&
							"border-profit/50 bg-profit/10 text-profit hover:bg-profit/20",
					)}
					data-testid="marketplace-detail-download"
					disabled={isDownloading || strategy.isOwner}
					onClick={handleDownload}
					variant={strategy.currentUserHasDownloaded ? "outline" : "default"}
				>
					{isDownloading ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							Adding...
						</>
					) : strategy.currentUserHasDownloaded ? (
						<>
							<CheckCircle className="size-4" />
							Downloaded
						</>
					) : strategy.isOwner ? (
						<>
							<User className="size-4" />
							Your Strategy
						</>
					) : (
						<>
							<Download className="size-4" />
							Add to My Strategies
						</>
					)}
				</Button>
			</div>

			{/* Stats row */}
			<div
				className="flex flex-wrap gap-6 rounded-lg border border-border bg-card p-4"
				data-testid="marketplace-detail-stats"
			>
				<div className="space-y-1">
					<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Net Votes
					</p>
					<p
						className={cn(
							"font-bold font-mono text-lg",
							strategy.netVotes > 0
								? "text-profit"
								: strategy.netVotes < 0
									? "text-loss"
									: "text-foreground",
						)}
					>
						{strategy.netVotes > 0 ? "+" : ""}
						{strategy.netVotes}
					</p>
				</div>
				<div className="space-y-1">
					<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Downloads
					</p>
					<p className="font-bold font-mono text-lg">
						{strategy.downloadCount}
					</p>
				</div>
				<div className="space-y-1">
					<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Copies
					</p>
					<p className="font-bold font-mono text-lg">{strategy.copiesCount}</p>
				</div>
			</div>

			{/* Tags */}
			<div
				className="flex flex-wrap gap-2"
				data-testid="marketplace-detail-tags"
			>
				{categories.map((category) => (
					<Badge
						className="font-mono text-xs"
						key={category}
						variant="secondary"
					>
						{getCategoryLabel(category)}
					</Badge>
				))}
				{instruments.map((instrument) => (
					<Badge
						className="font-mono text-xs"
						key={instrument}
						variant="outline"
					>
						{getInstrumentLabel(instrument)}
					</Badge>
				))}
			</div>

			{/* Derived from section */}
			{strategy.sourceStrategy && (
				<div
					className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3"
					data-testid="marketplace-detail-derived-from"
				>
					<Copy className="size-4 text-muted-foreground" />
					<span className="font-mono text-muted-foreground text-sm">
						Derived from
					</span>
					{strategy.sourceStrategy.isPublic ? (
						<Link
							className="font-mono text-primary text-sm hover:underline"
							href={`/marketplace/${strategy.sourceStrategy.id}`}
						>
							{strategy.sourceStrategy.name}
						</Link>
					) : (
						<span className="font-mono text-sm">
							{strategy.sourceStrategy.name}{" "}
							<span className="text-muted-foreground">(unpublished)</span>
						</span>
					)}
					<span className="font-mono text-muted-foreground text-sm">
						by {strategy.sourceStrategy.authorName}
					</span>
				</div>
			)}

			{/* Tabbed content */}
			<Tabs
				className="w-full"
				data-testid="marketplace-detail-tabs"
				defaultValue="overview"
			>
				<TabsList className="w-full justify-start">
					<TabsTrigger className="font-mono" value="overview">
						Overview
					</TabsTrigger>
					<TabsTrigger className="font-mono" value="entry-exit">
						Entry & Exit
					</TabsTrigger>
					<TabsTrigger className="font-mono" value="risk">
						Risk Management
					</TabsTrigger>
					<TabsTrigger className="font-mono" value="rules">
						Rules ({strategy.rules?.length ?? 0})
					</TabsTrigger>
				</TabsList>

				{/* Overview tab */}
				<TabsContent className="space-y-4" value="overview">
					<div className="space-y-2">
						<h3 className="font-mono font-semibold text-sm">Description</h3>
						{strategy.description ? (
							<p className="whitespace-pre-wrap font-mono text-muted-foreground text-sm">
								{strategy.description}
							</p>
						) : (
							<p className="font-mono text-muted-foreground/50 text-sm italic">
								No description provided
							</p>
						)}
					</div>
				</TabsContent>

				{/* Entry & Exit tab */}
				<TabsContent className="space-y-6" value="entry-exit">
					<div className="space-y-2">
						<h3 className="font-mono font-semibold text-sm">Entry Criteria</h3>
						{strategy.entryCriteria ? (
							<div className="rounded-lg border border-border bg-card p-4">
								<p className="whitespace-pre-wrap font-mono text-sm">
									{strategy.entryCriteria}
								</p>
							</div>
						) : (
							<p className="font-mono text-muted-foreground/50 text-sm italic">
								No entry criteria defined
							</p>
						)}
					</div>
					<div className="space-y-2">
						<h3 className="font-mono font-semibold text-sm">Exit Rules</h3>
						{strategy.exitRules ? (
							<div className="rounded-lg border border-border bg-card p-4">
								<p className="whitespace-pre-wrap font-mono text-sm">
									{strategy.exitRules}
								</p>
							</div>
						) : (
							<p className="font-mono text-muted-foreground/50 text-sm italic">
								No exit rules defined
							</p>
						)}
					</div>
				</TabsContent>

				{/* Risk Management tab */}
				<TabsContent className="space-y-4" value="risk">
					{strategy.riskParameters ? (
						<div className="grid gap-4 sm:grid-cols-2">
							{Object.entries(
								strategy.riskParameters as Record<string, unknown>,
							).map(([key, value]) => (
								<div
									className="rounded-lg border border-border bg-card p-3"
									key={key}
								>
									<p className="font-mono text-muted-foreground text-xs uppercase">
										{key.replace(/([A-Z])/g, " $1").trim()}
									</p>
									<p className="font-mono font-semibold text-sm">
										{value === null || value === undefined
											? "-"
											: String(value)}
									</p>
								</div>
							))}
						</div>
					) : (
						<p className="font-mono text-muted-foreground/50 text-sm italic">
							No risk parameters configured
						</p>
					)}
				</TabsContent>

				{/* Rules tab */}
				<TabsContent className="space-y-3" value="rules">
					{strategy.rules && strategy.rules.length > 0 ? (
						<div className="space-y-3">
							{strategy.rules.map((rule) => (
								<RuleItem key={rule.id} rule={rule} />
							))}
						</div>
					) : (
						<p className="font-mono text-muted-foreground/50 text-sm italic">
							No rules defined
						</p>
					)}
				</TabsContent>
			</Tabs>

			{/* Downloaded times */}
			<div className="border-border border-t pt-4">
				<p className="font-mono text-muted-foreground text-xs">
					Downloaded {strategy.downloadCount} time
					{strategy.downloadCount !== 1 ? "s" : ""}
				</p>
			</div>
		</div>
	);
}
