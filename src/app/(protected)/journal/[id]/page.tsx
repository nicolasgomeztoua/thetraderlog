"use client";

import {
	AlertTriangle,
	BarChart3,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	Import,
	Loader2,
	Menu,
	Settings,
	Share2,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ContentPanel, StatsPanel } from "@/components/trade-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedMutation } from "@/hooks/use-debounced-mutation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTimezone } from "@/hooks/use-timezone";
import {
	ERR_RATING_UPDATE_FAILED,
	ERR_REVIEW_UPDATE_FAILED,
	ERR_TRADE_CLOSE_FAILED,
	ERR_TRADE_DELETE_FAILED,
	ERR_TRADE_UPDATE_FAILED,
	ERR_VALIDATION_PNL_REQUIRED_SHORT,
} from "@/lib/constants/errors";
import { cn, formatDate } from "@/lib/shared";
import { getErrorMessage } from "@/lib/shared/utils";
import { calculateAllStats } from "@/lib/trades";
import { api } from "@/trpc/react";

// =============================================================================
// LOCAL STORAGE KEY
// =============================================================================

const PANEL_SIZE_KEY = "trade-detail-panel-sizes";

function getStoredSizes(): number[] {
	if (typeof window === "undefined") return [30, 70];
	try {
		const stored = localStorage.getItem(PANEL_SIZE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed) && parsed.length === 2) {
				return parsed as number[];
			}
		}
	} catch {
		// Ignore parsing errors
	}
	return [30, 70];
}

function saveSizes(sizes: number[]) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(sizes));
	} catch {
		// Ignore storage errors
	}
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TradeDetailPage() {
	return (
		<Suspense>
			<TradeDetailPageContent />
		</Suspense>
	);
}

function TradeDetailPageContent() {
	const params = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const initialTab = searchParams.get("tab") ?? undefined;
	const tradeId = params.id as string;
	const { timezone } = useTimezone();
	const isMobile = useIsMobile();

	const [isClosing, setIsClosing] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isStatsOpen, setIsStatsOpen] = useState(false);
	const [closeData, setCloseData] = useState({
		exitPrice: "",
		exitDate: new Date().toISOString().split("T")[0],
		exitTime: new Date().toTimeString().slice(0, 5),
		fees: "",
		realizedPnl: "",
	});

	// Panel sizes from localStorage [left, right]
	const [panelSizes, setPanelSizes] = useState<number[]>([30, 70]);

	useEffect(() => {
		setPanelSizes(getStoredSizes());
	}, []);

	const handleLayoutChange = (sizes: number[]) => {
		setPanelSizes(sizes);
		saveSizes(sizes);
	};

	const utils = api.useUtils();

	const { data: trade, isLoading } = api.trades.getById.useQuery(
		{ id: tradeId },
		{ enabled: !!tradeId },
	);

	// Adjacent trades for navigation (filtered by same account)
	const { data: adjacentTrades } = api.trades.getAll.useQuery(
		{ limit: 100, accountId: trade?.accountId },
		{ enabled: !!trade },
	);

	const currentIndex =
		adjacentTrades?.items.findIndex((t) => t.id === tradeId) ?? -1;
	const prevTrade =
		currentIndex > 0 ? adjacentTrades?.items[currentIndex - 1] : null;
	const nextTrade =
		currentIndex >= 0 && adjacentTrades?.items[currentIndex + 1]
			? adjacentTrades.items[currentIndex + 1]
			: null;

	// Optimistic update helper
	type TradeData = typeof trade;
	const optimisticUpdate = useCallback(
		(updates: Partial<NonNullable<TradeData>>) => {
			utils.trades.getById.setData({ id: tradeId }, (old) => {
				if (!old) return old;
				return { ...old, ...updates };
			});
		},
		[tradeId, utils.trades.getById],
	);

	// Mutations
	const updateTrade = api.trades.update.useMutation({
		onMutate: async (newData) => {
			await utils.trades.getById.cancel({ id: tradeId });
			const previousTrade = utils.trades.getById.getData({ id: tradeId });
			optimisticUpdate(newData as Partial<NonNullable<TradeData>>);
			return { previousTrade };
		},
		onSuccess: () => {
			// Invalidate to refetch with presigned URLs (notes are saved with S3 keys,
			// server transforms them to presigned URLs on read)
			utils.trades.getById.invalidate({ id: tradeId });
			// Invalidate rule checks since trade fields (like wasTrailed) affect rule relevance
			utils.strategies.getTradeRuleChecks.invalidate({ tradeId });
		},
		onError: (error, _newData, context) => {
			if (context?.previousTrade) {
				utils.trades.getById.setData({ id: tradeId }, context.previousTrade);
			}
			toast.error(getErrorMessage(error, ERR_TRADE_UPDATE_FAILED));
		},
	});

	const updateRatingMutation = api.trades.updateRating.useMutation({
		onError: () => {
			toast.error(ERR_RATING_UPDATE_FAILED);
		},
	});

	const [pendingRating, setPendingRating] = useState<number | null>(null);

	const { trigger: updateRating } = useDebouncedMutation({
		mutationFn: (rating: number) => {
			updateRatingMutation.mutate({ id: tradeId, rating });
			setPendingRating(null);
		},
		onOptimisticUpdate: (rating) => {
			setPendingRating(rating);
			optimisticUpdate({ rating });
		},
		delay: 300,
	});

	const markReviewed = api.trades.markReviewed.useMutation({
		onMutate: async ({ isReviewed }) => {
			await utils.trades.getById.cancel({ id: tradeId });
			const previousTrade = utils.trades.getById.getData({ id: tradeId });
			optimisticUpdate({ isReviewed });
			return { previousTrade };
		},
		onError: (_error, _newData, context) => {
			if (context?.previousTrade) {
				utils.trades.getById.setData({ id: tradeId }, context.previousTrade);
			}
			toast.error(ERR_REVIEW_UPDATE_FAILED);
		},
	});

	const closeTrade = api.trades.close.useMutation({
		onSuccess: () => {
			toast.success("Trade closed");
			setIsClosing(false);
			utils.trades.getById.invalidate({ id: tradeId });
			utils.trades.getAll.invalidate();
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_TRADE_CLOSE_FAILED));
		},
	});

	const deleteTrade = api.trades.delete.useMutation({
		onSuccess: () => {
			toast.success("Trade deleted");
			utils.trades.getAll.invalidate();
			utils.trades.getDeleted.invalidate();
			router.push("/journal");
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_TRADE_DELETE_FAILED));
		},
	});

	// Field update handler
	const updateField = useCallback(
		(field: string, value: string | number | boolean | null) => {
			updateTrade.mutate({
				id: tradeId,
				[field]: value === "" ? undefined : value,
			});
		},
		[tradeId, updateTrade],
	);

	const handleCloseTrade = () => {
		if (!closeData.realizedPnl) {
			toast.error(ERR_VALIDATION_PNL_REQUIRED_SHORT);
			return;
		}
		const exitTime = new Date(
			`${closeData.exitDate}T${closeData.exitTime}`,
		).toISOString();
		closeTrade.mutate({
			id: tradeId,
			exitPrice: closeData.exitPrice,
			exitTime,
			fees: closeData.fees || undefined,
			realizedPnl: closeData.realizedPnl,
		});
	};

	// Calculate stats using the new helper
	const stats = trade
		? calculateAllStats({
				entryPrice: trade.entryPrice,
				exitPrice: trade.exitPrice,
				direction: trade.direction,
				quantity: trade.quantity,
				netPnl: trade.netPnl,
				fees: trade.fees,
				stopLoss: trade.stopLoss,
				takeProfit: trade.takeProfit,
				entryTime: trade.entryTime,
				exitTime: trade.exitTime,
				symbol: trade.symbol,
			})
		: null;

	// Loading state
	if (isLoading) {
		return (
			<div className="flex h-[calc(100vh-4rem)] flex-col">
				<div className="flex items-center justify-between border-border border-b px-3 py-2 sm:px-4 sm:py-3">
					<Skeleton className="h-8 w-32 sm:w-48" />
					<Skeleton className="h-8 w-20 sm:w-32" />
				</div>
				<div className="flex flex-1">
					<div className="hidden w-[30%] border-border border-r p-4 md:block">
						<Skeleton className="h-full" />
					</div>
					<div className="flex-1 p-4">
						<Skeleton className="h-full" />
					</div>
				</div>
			</div>
		);
	}

	// Not found
	if (!trade) {
		return (
			<div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
				<AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground" />
				<h2 className="font-semibold text-xl">Trade not found</h2>
				<p className="mb-4 text-muted-foreground">
					This trade doesn&apos;t exist or you don&apos;t have access.
				</p>
				<Button asChild>
					<Link href="/journal">Back to Journal</Link>
				</Button>
			</div>
		);
	}

	const isImported = trade.importSource === "csv";

	return (
		<div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
			{/* ================================================================
			    HEADER BAR
			    ================================================================ */}
			<div className="flex shrink-0 items-center justify-between border-border border-b bg-background px-2 py-2 sm:px-4">
				{/* Left: Menu + Nav + Symbol */}
				<div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
					{/* Menu button - back to journal */}
					<Button
						asChild
						className="h-8 w-8 shrink-0"
						size="icon"
						variant="ghost"
					>
						<Link href="/journal">
							<Menu className="h-4 w-4" />
						</Link>
					</Button>

					{/* Prev/Next navigation */}
					<div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
						{prevTrade ? (
							<Button asChild className="h-7 w-7" size="icon" variant="ghost">
								<Link href={`/journal/${prevTrade.id}`}>
									<ChevronLeft className="h-4 w-4" />
								</Link>
							</Button>
						) : (
							<Button className="h-7 w-7" disabled size="icon" variant="ghost">
								<ChevronLeft className="h-4 w-4" />
							</Button>
						)}
						{nextTrade ? (
							<Button asChild className="h-7 w-7" size="icon" variant="ghost">
								<Link href={`/journal/${nextTrade.id}`}>
									<ChevronRight className="h-4 w-4" />
								</Link>
							</Button>
						) : (
							<Button className="h-7 w-7" disabled size="icon" variant="ghost">
								<ChevronRight className="h-4 w-4" />
							</Button>
						)}
					</div>

					{/* Symbol & Date */}
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
							<span className="font-bold font-mono text-base tracking-tight sm:text-lg">
								{trade.symbol}
							</span>
							<Badge
								className={cn(
									"font-mono text-[9px] uppercase",
									trade.direction === "long"
										? "border-profit/30 text-profit"
										: "border-loss/30 text-loss",
								)}
								variant="outline"
							>
								{trade.direction}
							</Badge>
							<Badge
								className="hidden font-mono text-[9px] uppercase sm:inline-flex"
								variant={trade.status === "open" ? "secondary" : "outline"}
							>
								{trade.status === "open" ? (
									<Clock className="mr-1 h-2.5 w-2.5" />
								) : (
									<Check className="mr-1 h-2.5 w-2.5" />
								)}
								{trade.status}
							</Badge>
							{isImported && (
								<Badge
									className="hidden border-accent/30 font-mono text-[9px] text-accent uppercase sm:inline-flex"
									variant="outline"
								>
									<Import className="mr-1 h-2.5 w-2.5" />
									Imported
								</Badge>
							)}
						</div>
						<p className="hidden font-mono text-[10px] text-muted-foreground sm:block">
							{formatDate(
								trade.entryTime,
								{
									weekday: "short",
									month: "short",
									day: "numeric",
									year: "numeric",
								},
								timezone,
							)}
							{stats?.duration && (
								<span className="text-muted-foreground/50">
									{" "}
									· {stats.duration}
								</span>
							)}
							{trade.account?.name && (
								<span className="text-muted-foreground/50">
									{" "}
									· {trade.account.name}
								</span>
							)}
						</p>
					</div>
				</div>

				{/* Right: Actions */}
				<div className="flex shrink-0 items-center gap-1 sm:gap-2">
					{/* Stats drawer button - mobile only */}
					<Button
						className="h-8 w-8 md:hidden"
						onClick={() => setIsStatsOpen(true)}
						size="icon"
						variant="ghost"
					>
						<BarChart3 className="h-4 w-4" />
					</Button>

					{/* Mark as reviewed - icon only on mobile */}
					<button
						className={cn(
							"flex min-h-[44px] items-center gap-1.5 rounded px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors sm:min-h-0 sm:px-3",
							trade.isReviewed
								? "bg-profit/10 text-profit"
								: "text-muted-foreground hover:bg-muted",
						)}
						onClick={() =>
							markReviewed.mutate({
								id: tradeId,
								isReviewed: !trade.isReviewed,
							})
						}
						type="button"
					>
						{trade.isReviewed ? (
							<CheckCircle2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
						) : (
							<Clock className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
						)}
						<span className="hidden sm:inline">
							{trade.isReviewed ? "Reviewed" : "Mark as reviewed"}
						</span>
					</button>

					{/* Share button (placeholder) - hidden on mobile */}
					<Button
						className="hidden h-8 w-8 sm:flex"
						disabled
						size="icon"
						variant="ghost"
					>
						<Share2 className="h-4 w-4" />
					</Button>

					{/* Settings/Actions menu */}
					<Button
						className="h-8 w-8"
						onClick={() => setIsDeleting(true)}
						size="icon"
						variant="ghost"
					>
						<Settings className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* ================================================================
			    RESIZABLE PANELS (Desktop) / Full-width Content (Mobile)
			    ================================================================ */}
			{isMobile ? (
				// Mobile: Full-width content panel + Sheet drawer for stats
				<>
					<div className="min-h-0 flex-1 overflow-hidden">
						<ContentPanel
							initialTab={initialTab}
							onUpdateField={updateField}
							trade={{
								id: trade.id,
								symbol: trade.symbol,
								direction: trade.direction,
								status: trade.status,
								entryPrice: trade.entryPrice,
								exitPrice: trade.exitPrice,
								entryTime: trade.entryTime,
								exitTime: trade.exitTime,
								stopLoss: trade.stopLoss,
								takeProfit: trade.takeProfit,
								wasTrailed: trade.wasTrailed,
								trailedStopLoss: trade.trailedStopLoss,
								notes: trade.notes,
								tradeTags: trade.tradeTags,
								executions: trade.executions,
								maePrice: trade.maePrice,
								mfePrice: trade.mfePrice,
								quantity: trade.quantity,
								attachments: trade.attachments,
							}}
						/>
					</div>

					{/* Stats Sheet Drawer (Mobile) */}
					<Sheet onOpenChange={setIsStatsOpen} open={isStatsOpen}>
						<SheetContent
							className="w-[85%] overflow-hidden p-0 sm:max-w-md"
							side="left"
						>
							<SheetHeader className="border-border border-b px-4 py-3">
								<SheetTitle className="font-mono text-sm uppercase tracking-wider">
									Trade Stats
								</SheetTitle>
							</SheetHeader>
							<div className="h-[calc(100%-57px)] overflow-hidden">
								<StatsPanel
									onUpdateField={updateField}
									onUpdateRating={(rating) => updateRating(rating)}
									pendingRating={pendingRating}
									stats={
										stats ?? {
											points: null,
											ticks: null,
											ticksPerContract: null,
											grossPnl: null,
											roi: null,
											duration: null,
											rMultiple: null,
											plannedRR: null,
										}
									}
									trade={{
										id: trade.id,
										symbol: trade.symbol,
										direction: trade.direction,
										status: trade.status,

										quantity: trade.quantity,
										entryPrice: trade.entryPrice,
										exitPrice: trade.exitPrice,
										entryTime: trade.entryTime,
										exitTime: trade.exitTime,
										stopLoss: trade.stopLoss,
										takeProfit: trade.takeProfit,
										fees: trade.fees,
										netPnl: trade.netPnl,
										rating: trade.rating,
										strategyId: trade.strategyId,
										wasTrailed: trade.wasTrailed,
										trailedStopLoss: trade.trailedStopLoss,
										emotionalState: trade.emotionalState,
										exitReason: trade.exitReason,
										tradeTags: trade.tradeTags,
										maePrice: trade.maePrice,
										mfePrice: trade.mfePrice,
										maeAmount: trade.maeAmount,
										mfeAmount: trade.mfeAmount,
										marketDataQuality: trade.marketDataQuality,
										account: trade.account,
										executions: trade.executions?.map((e) => ({
											id: e.id,
											executionType: e.executionType as
												| "entry"
												| "exit"
												| "scale_in"
												| "scale_out",
											price: e.price,
											quantity: e.quantity,
											executedAt: e.executedAt,
											fees: e.fees,
											realizedPnl: e.realizedPnl,
											notes: e.notes,
										})),
									}}
								/>
							</div>
						</SheetContent>
					</Sheet>
				</>
			) : (
				// Desktop: Resizable panels
				<ResizablePanelGroup
					className="h-full min-h-0 flex-1"
					direction="horizontal"
					onLayout={handleLayoutChange}
				>
					{/* LEFT PANEL - Stats */}
					<ResizablePanel
						className="min-w-0 overflow-hidden border-border border-r"
						defaultSize={panelSizes[0]}
						maxSize={70}
						minSize={10}
					>
						<StatsPanel
							onUpdateField={updateField}
							onUpdateRating={(rating) => updateRating(rating)}
							pendingRating={pendingRating}
							stats={
								stats ?? {
									points: null,
									ticks: null,
									ticksPerContract: null,
									grossPnl: null,
									roi: null,
									duration: null,
									rMultiple: null,
									plannedRR: null,
								}
							}
							trade={{
								id: trade.id,
								symbol: trade.symbol,
								direction: trade.direction,
								status: trade.status,

								quantity: trade.quantity,
								entryPrice: trade.entryPrice,
								exitPrice: trade.exitPrice,
								entryTime: trade.entryTime,
								exitTime: trade.exitTime,
								stopLoss: trade.stopLoss,
								takeProfit: trade.takeProfit,
								fees: trade.fees,
								netPnl: trade.netPnl,
								rating: trade.rating,
								strategyId: trade.strategyId,
								wasTrailed: trade.wasTrailed,
								trailedStopLoss: trade.trailedStopLoss,
								emotionalState: trade.emotionalState,
								exitReason: trade.exitReason,
								tradeTags: trade.tradeTags,
								maePrice: trade.maePrice,
								mfePrice: trade.mfePrice,
								maeAmount: trade.maeAmount,
								mfeAmount: trade.mfeAmount,
								marketDataQuality: trade.marketDataQuality,
								account: trade.account,
								executions: trade.executions?.map((e) => ({
									id: e.id,
									executionType: e.executionType as
										| "entry"
										| "exit"
										| "scale_in"
										| "scale_out",
									price: e.price,
									quantity: e.quantity,
									executedAt: e.executedAt,
									fees: e.fees,
									realizedPnl: e.realizedPnl,
									notes: e.notes,
								})),
							}}
						/>
					</ResizablePanel>

					<ResizableHandle withHandle />

					{/* RIGHT PANEL - Content */}
					<ResizablePanel
						className="min-w-0 overflow-hidden"
						defaultSize={panelSizes[1]}
						minSize={20}
					>
						<ContentPanel
							initialTab={initialTab}
							onUpdateField={updateField}
							trade={{
								id: trade.id,
								symbol: trade.symbol,
								direction: trade.direction,
								status: trade.status,
								entryPrice: trade.entryPrice,
								exitPrice: trade.exitPrice,
								entryTime: trade.entryTime,
								exitTime: trade.exitTime,
								stopLoss: trade.stopLoss,
								takeProfit: trade.takeProfit,
								wasTrailed: trade.wasTrailed,
								trailedStopLoss: trade.trailedStopLoss,
								notes: trade.notes,
								tradeTags: trade.tradeTags,
								executions: trade.executions,
								maePrice: trade.maePrice,
								mfePrice: trade.mfePrice,
								quantity: trade.quantity,
								attachments: trade.attachments,
							}}
						/>
					</ResizablePanel>
				</ResizablePanelGroup>
			)}

			{/* ================================================================
			    DIALOGS
			    ================================================================ */}

			{/* Close Trade Dialog */}
			{trade.status === "open" && (
				<Dialog onOpenChange={setIsClosing} open={isClosing}>
					<DialogContent className="border-border bg-background">
						<DialogHeader>
							<DialogTitle className="font-mono uppercase tracking-wider">
								Close Trade
							</DialogTitle>
							<DialogDescription className="font-mono text-xs">
								Enter exit details for {trade.symbol} {trade.direction}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-1">
								<label
									className="font-mono text-[11px] text-muted-foreground uppercase"
									htmlFor="close-exit-price"
								>
									Exit Price
								</label>
								<Input
									className="font-mono"
									id="close-exit-price"
									onChange={(e) =>
										setCloseData({ ...closeData, exitPrice: e.target.value })
									}
									placeholder="0.00"
									step="any"
									type="number"
									value={closeData.exitPrice}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<label
										className="font-mono text-[11px] text-muted-foreground uppercase"
										htmlFor="close-exit-date"
									>
										Date
									</label>
									<Input
										id="close-exit-date"
										onChange={(e) =>
											setCloseData({ ...closeData, exitDate: e.target.value })
										}
										type="date"
										value={closeData.exitDate}
									/>
								</div>
								<div className="space-y-1">
									<label
										className="font-mono text-[11px] text-muted-foreground uppercase"
										htmlFor="close-exit-time"
									>
										Time
									</label>
									<Input
										id="close-exit-time"
										onChange={(e) =>
											setCloseData({ ...closeData, exitTime: e.target.value })
										}
										type="time"
										value={closeData.exitTime}
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<label
										className="font-mono text-[11px] text-muted-foreground uppercase"
										htmlFor="close-pnl"
									>
										Realized P&L
									</label>
									<Input
										className="font-mono"
										id="close-pnl"
										onChange={(e) =>
											setCloseData({
												...closeData,
												realizedPnl: e.target.value,
											})
										}
										placeholder="e.g. 150.00 or -75.50"
										step="any"
										type="number"
										value={closeData.realizedPnl}
									/>
								</div>
								<div className="space-y-1">
									<label
										className="font-mono text-[11px] text-muted-foreground uppercase"
										htmlFor="close-fees"
									>
										Fees (optional)
									</label>
									<Input
										className="font-mono"
										id="close-fees"
										onChange={(e) =>
											setCloseData({ ...closeData, fees: e.target.value })
										}
										placeholder="0.00"
										step="any"
										type="number"
										value={closeData.fees}
									/>
								</div>
							</div>
						</div>
						<DialogFooter>
							<Button onClick={() => setIsClosing(false)} variant="ghost">
								Cancel
							</Button>
							<Button
								disabled={
									!closeData.exitPrice ||
									!closeData.realizedPnl ||
									closeTrade.isPending
								}
								onClick={handleCloseTrade}
							>
								{closeTrade.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Close Trade
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}

			{/* Delete Dialog */}
			<Dialog onOpenChange={setIsDeleting} open={isDeleting}>
				<DialogContent className="border-border bg-background">
					<DialogHeader>
						<DialogTitle className="font-mono uppercase tracking-wider">
							Delete Trade
						</DialogTitle>
						<DialogDescription className="font-mono text-xs">
							This will move the trade to trash. You can restore it later.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center justify-between rounded border border-border bg-muted/50 p-4">
						<div className="flex items-center gap-3">
							<Trash2 className="h-5 w-5 text-loss" />
							<div>
								<p className="font-mono text-sm">
									{trade.symbol} {trade.direction.toUpperCase()}
								</p>
								<p className="font-mono text-[10px] text-muted-foreground">
									{formatDate(trade.entryTime, undefined, timezone)}
								</p>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={() => setIsDeleting(false)} variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={deleteTrade.isPending}
							onClick={() => deleteTrade.mutate({ id: tradeId })}
							variant="destructive"
						>
							{deleteTrade.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
