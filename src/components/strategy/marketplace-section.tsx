"use client";

import {
	ArrowUpRight,
	CheckCircle,
	ChevronDown,
	Download,
	EyeOff,
	Globe,
	Loader2,
	ShieldCheck,
	ThumbsUp,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	LIMITED_DATA_THRESHOLD,
	MIN_TRADES_TO_PUBLISH,
	STRATEGY_CATEGORIES,
	STRATEGY_INSTRUMENTS,
	VERIFIED_TRACK_RECORD_THRESHOLD,
} from "@/lib/constants";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

interface MarketplaceSectionProps {
	strategyId: string;
	strategyName: string;
	isPublic: boolean;
	isAnonymous: boolean | null;
	instruments: string[] | null;
	categoryTags: string[] | null;
	cachedStats: {
		totalTrades?: number;
		winRate?: number;
		profitFactor?: number | null;
		avgR?: number;
	} | null;
	tradeCount: number;
	strategyColor: string;
}

type TrackRecordStatus = "verified" | "normal" | "limited";

function getTrackRecordStatus(tradeCount: number): TrackRecordStatus {
	if (tradeCount >= VERIFIED_TRACK_RECORD_THRESHOLD) return "verified";
	if (tradeCount < LIMITED_DATA_THRESHOLD) return "limited";
	return "normal";
}

export function MarketplaceSection({
	strategyId,
	strategyName,
	isPublic,
	isAnonymous,
	instruments: initialInstruments,
	categoryTags: initialCategoryTags,
	cachedStats,
	tradeCount,
	strategyColor,
}: MarketplaceSectionProps) {
	const utils = api.useUtils();

	// Publish form state
	const [publishAnonymous, setPublishAnonymous] = useState(
		isAnonymous ?? false,
	);
	const [publishInstruments, setPublishInstruments] = useState<string[]>(
		initialInstruments ?? [],
	);
	const [publishCategories, setPublishCategories] = useState<string[]>(
		initialCategoryTags ?? [],
	);
	const [instrumentsOpen, setInstrumentsOpen] = useState(false);
	const [categoriesOpen, setCategoriesOpen] = useState(false);

	// Fetch vote score and download count for published strategies
	const { data: marketplaceData } = api.marketplace.getById.useQuery(
		{ id: strategyId },
		{
			enabled: isPublic,
			retry: false,
		},
	);

	// Mutations
	const publishMutation = api.strategies.publish.useMutation({
		onSuccess: () => {
			toast.success("Strategy published to marketplace");
			utils.strategies.getById.invalidate({ id: strategyId });
			utils.marketplace.getById.invalidate({ id: strategyId });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to publish strategy");
		},
	});

	const unpublishMutation = api.strategies.unpublish.useMutation({
		onSuccess: () => {
			toast.success("Strategy removed from marketplace");
			utils.strategies.getById.invalidate({ id: strategyId });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to unpublish strategy");
		},
	});

	const handlePublish = () => {
		publishMutation.mutate({
			id: strategyId,
			isAnonymous: publishAnonymous,
			instruments:
				publishInstruments.length > 0 ? publishInstruments : undefined,
			categoryTags:
				publishCategories.length > 0 ? publishCategories : undefined,
		});
	};

	const handleUnpublish = () => {
		unpublishMutation.mutate({ id: strategyId });
	};

	const toggleInstrument = (inst: string) => {
		setPublishInstruments((prev) =>
			prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst],
		);
	};

	const toggleCategory = (cat: string) => {
		setPublishCategories((prev) =>
			prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
		);
	};

	const canPublish = tradeCount >= MIN_TRADES_TO_PUBLISH;
	const progressPercent = Math.min(
		(tradeCount / MIN_TRADES_TO_PUBLISH) * 100,
		100,
	);
	const trackRecordStatus = getTrackRecordStatus(tradeCount);

	// Get marketplace stats for published strategies
	const voteScore = marketplaceData?.engagement?.voteScore ?? 0;
	const downloadCount = marketplaceData?.engagement?.downloadCount ?? 0;

	return (
		<div
			className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
			data-testid="marketplace-section"
		>
			<div className="mb-4 flex items-center gap-3">
				<Globe className="h-5 w-5 text-muted-foreground" />
				<h2 className="font-mono font-semibold text-sm uppercase tracking-wider">
					Share to Marketplace
				</h2>
			</div>

			{/* Not enough trades - disabled state */}
			{!canPublish && !isPublic && (
				<div className="space-y-4" data-testid="marketplace-section-disabled">
					<p className="font-mono text-muted-foreground text-sm">
						Complete at least {MIN_TRADES_TO_PUBLISH} trades to publish this
						strategy to the marketplace and share it with the community.
					</p>

					{/* Progress indicator */}
					<div className="space-y-2">
						<div className="flex items-center justify-between font-mono text-xs">
							<span className="text-muted-foreground">Progress</span>
							<span
								className={cn(
									tradeCount >= MIN_TRADES_TO_PUBLISH
										? "text-profit"
										: "text-muted-foreground",
								)}
							>
								{tradeCount} / {MIN_TRADES_TO_PUBLISH} trades
							</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-white/5">
							<div
								className="h-full rounded-full transition-all duration-500"
								data-testid="marketplace-progress-bar"
								style={{
									width: `${progressPercent}%`,
									backgroundColor: strategyColor,
								}}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Ready to publish - publish form */}
			{canPublish && !isPublic && (
				<div className="space-y-4" data-testid="marketplace-section-publish">
					<p className="font-mono text-muted-foreground text-sm">
						Share &quot;{strategyName}&quot; with the community. Your trading
						stats will be visible to help others evaluate the strategy.
					</p>

					{/* Anonymous toggle */}
					<div className="flex items-center justify-between rounded border border-white/5 bg-white/2 p-3">
						<div className="flex items-center gap-3">
							<EyeOff className="h-4 w-4 text-muted-foreground" />
							<div>
								<div className="font-mono text-sm">Publish anonymously</div>
								<div className="font-mono text-muted-foreground text-xs">
									Hide your identity from other users
								</div>
							</div>
						</div>
						<button
							className={cn(
								"relative h-6 w-11 rounded-full transition-colors",
								publishAnonymous ? "bg-primary" : "bg-white/10",
							)}
							data-testid="marketplace-anonymous-toggle"
							onClick={() => setPublishAnonymous(!publishAnonymous)}
							type="button"
						>
							<span
								className={cn(
									"absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform",
									publishAnonymous && "translate-x-5",
								)}
							/>
						</button>
					</div>

					{/* Instruments selection */}
					<div className="space-y-2">
						<label
							className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="marketplace-instruments"
						>
							Instruments (optional)
						</label>
						<Popover onOpenChange={setInstrumentsOpen} open={instrumentsOpen}>
							<PopoverTrigger asChild>
								<Button
									className="h-auto min-h-10 w-full justify-between px-3 py-2 font-mono text-sm"
									data-testid="marketplace-instruments-trigger"
									id="marketplace-instruments"
									variant="outline"
								>
									<span className="truncate">
										{publishInstruments.length > 0
											? publishInstruments.join(", ")
											: "Select instruments..."}
									</span>
									<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent align="start" className="w-64 p-2">
								<div className="grid max-h-64 gap-1 overflow-y-auto">
									{STRATEGY_INSTRUMENTS.map((inst) => (
										<button
											className="flex items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-sm hover:bg-white/5"
											data-testid={`marketplace-instrument-${inst}`}
											key={inst}
											onClick={() => toggleInstrument(inst)}
											type="button"
										>
											<Checkbox
												checked={publishInstruments.includes(inst)}
												className="pointer-events-none"
											/>
											<span>{inst}</span>
										</button>
									))}
								</div>
							</PopoverContent>
						</Popover>
					</div>

					{/* Categories selection */}
					<div className="space-y-2">
						<label
							className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="marketplace-categories"
						>
							Categories (optional)
						</label>
						<Popover onOpenChange={setCategoriesOpen} open={categoriesOpen}>
							<PopoverTrigger asChild>
								<Button
									className="h-auto min-h-10 w-full justify-between px-3 py-2 font-mono text-sm"
									data-testid="marketplace-categories-trigger"
									id="marketplace-categories"
									variant="outline"
								>
									<span className="truncate">
										{publishCategories.length > 0
											? publishCategories.join(", ")
											: "Select categories..."}
									</span>
									<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent align="start" className="w-64 p-2">
								<div className="grid max-h-64 gap-1 overflow-y-auto">
									{STRATEGY_CATEGORIES.map((cat) => (
										<button
											className="flex items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-sm hover:bg-white/5"
											data-testid={`marketplace-category-${cat}`}
											key={cat}
											onClick={() => toggleCategory(cat)}
											type="button"
										>
											<Checkbox
												checked={publishCategories.includes(cat)}
												className="pointer-events-none"
											/>
											<span>{cat}</span>
										</button>
									))}
								</div>
							</PopoverContent>
						</Popover>
					</div>

					{/* Publish button */}
					<Button
						className="w-full font-mono"
						data-testid="marketplace-publish-button"
						disabled={publishMutation.isPending}
						onClick={handlePublish}
						style={{
							backgroundColor: strategyColor,
							color: "#050505",
						}}
					>
						{publishMutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Publishing...
							</>
						) : (
							<>
								<Globe className="mr-2 h-4 w-4" />
								Publish to Marketplace
							</>
						)}
					</Button>
				</div>
			)}

			{/* Published state */}
			{isPublic && (
				<div className="space-y-4" data-testid="marketplace-section-published">
					{/* Published badge */}
					<div className="flex items-center gap-2">
						<div
							className="flex items-center gap-2 rounded-full px-3 py-1"
							style={{
								backgroundColor: `${strategyColor}20`,
								color: strategyColor,
							}}
						>
							<CheckCircle className="h-4 w-4" />
							<span className="font-medium font-mono text-sm">Published</span>
						</div>
						{isAnonymous && (
							<div className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
								<EyeOff className="h-3 w-3 text-muted-foreground" />
								<span className="font-mono text-muted-foreground text-xs">
									Anonymous
								</span>
							</div>
						)}
					</div>

					{/* Track record badge */}
					{trackRecordStatus === "verified" && (
						<div
							className="flex items-center gap-2 rounded border border-profit/20 bg-profit/5 px-3 py-2"
							data-testid="marketplace-verified-badge"
						>
							<ShieldCheck className="h-5 w-5 text-profit" />
							<div>
								<div className="font-medium font-mono text-profit text-sm">
									Verified Track Record
								</div>
								<div className="font-mono text-profit/70 text-xs">
									{cachedStats?.totalTrades ?? tradeCount}+ trades with
									documented results
								</div>
							</div>
						</div>
					)}

					{trackRecordStatus === "limited" && (
						<div
							className="flex items-center gap-2 rounded border border-warning/20 bg-warning/5 px-3 py-2"
							data-testid="marketplace-limited-badge"
						>
							<TrendingUp className="h-5 w-5 text-warning" />
							<div>
								<div className="font-medium font-mono text-sm text-warning">
									Limited Track Record
								</div>
								<div className="font-mono text-warning/70 text-xs">
									{cachedStats?.totalTrades ?? tradeCount} trades — results may
									not be representative
								</div>
							</div>
						</div>
					)}

					{/* Engagement stats */}
					<div className="grid grid-cols-2 gap-3">
						<div className="rounded border border-white/5 bg-white/2 p-3">
							<div className="flex items-center gap-2 text-muted-foreground">
								<ThumbsUp className="h-4 w-4" />
								<span className="font-mono text-xs uppercase tracking-wider">
									Votes
								</span>
							</div>
							<div
								className={cn(
									"mt-1 font-bold font-mono text-xl",
									voteScore > 0
										? "text-profit"
										: voteScore < 0
											? "text-loss"
											: "",
								)}
								data-testid="marketplace-vote-score"
							>
								{voteScore > 0 ? "+" : ""}
								{voteScore}
							</div>
						</div>
						<div className="rounded border border-white/5 bg-white/2 p-3">
							<div className="flex items-center gap-2 text-muted-foreground">
								<Download className="h-4 w-4" />
								<span className="font-mono text-xs uppercase tracking-wider">
									Downloads
								</span>
							</div>
							<div
								className="mt-1 font-bold font-mono text-xl"
								data-testid="marketplace-download-count"
							>
								{downloadCount}
							</div>
						</div>
					</div>

					{/* Cached stats preview */}
					{cachedStats && (
						<div className="grid grid-cols-3 gap-2">
							<div className="rounded bg-white/2 p-2 text-center">
								<div className="font-mono text-[10px] text-muted-foreground uppercase">
									Win Rate
								</div>
								<div
									className={cn(
										"font-medium font-mono text-sm",
										(cachedStats.winRate ?? 0) >= 50
											? "text-profit"
											: "text-loss",
									)}
								>
									{(cachedStats.winRate ?? 0).toFixed(0)}%
								</div>
							</div>
							<div className="rounded bg-white/2 p-2 text-center">
								<div className="font-mono text-[10px] text-muted-foreground uppercase">
									Profit Factor
								</div>
								<div
									className={cn(
										"font-medium font-mono text-sm",
										(cachedStats.profitFactor ?? 0) >= 1
											? "text-profit"
											: "text-loss",
									)}
								>
									{cachedStats.profitFactor != null
										? cachedStats.profitFactor.toFixed(2)
										: "N/A"}
								</div>
							</div>
							<div className="rounded bg-white/2 p-2 text-center">
								<div className="font-mono text-[10px] text-muted-foreground uppercase">
									Trades
								</div>
								<div className="font-medium font-mono text-sm">
									{cachedStats.totalTrades ?? 0}
								</div>
							</div>
						</div>
					)}

					{/* View on marketplace link */}
					<Link
						className="flex items-center justify-center gap-2 rounded border border-white/10 bg-white/2 p-3 font-mono text-sm transition-colors hover:bg-white/5"
						data-testid="marketplace-view-link"
						href={`/marketplace/${strategyId}`}
					>
						View on Marketplace
						<ArrowUpRight className="h-4 w-4" />
					</Link>

					{/* Unpublish button */}
					<Button
						className="w-full font-mono text-muted-foreground"
						data-testid="marketplace-unpublish-button"
						disabled={unpublishMutation.isPending}
						onClick={handleUnpublish}
						variant="ghost"
					>
						{unpublishMutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Removing...
							</>
						) : (
							"Remove from Marketplace"
						)}
					</Button>
				</div>
			)}
		</div>
	);
}
