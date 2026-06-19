"use client";

import {
	CheckCircle2,
	FileSpreadsheet,
	Filter,
	Loader2,
	Lock,
	Plus,
	RotateCcw,
	Star,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useHasFeature } from "@/components/billing/upgrade-prompt";
import { ColumnConfig } from "@/components/trade-log/column-config";
import {
	DEFAULT_FILTERS,
	FilterPanel,
	type FilterState,
} from "@/components/trade-log/filter-panel";
import { SortableHeader } from "@/components/trade-log/sortable-header";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/ui/star-rating";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "@/contexts/account-context";
import {
	useDebouncedMutation,
	useOptimisticState,
} from "@/hooks/use-debounced-mutation";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTimezone } from "@/hooks/use-timezone";
import { useTradeColumns } from "@/hooks/use-trade-columns";
import { useTradeSort } from "@/hooks/use-trade-sort";
import { FEATURE_TRADE_MANAGEMENT } from "@/lib/constants/billing";
import {
	ERR_RATING_UPDATE_FAILED,
	ERR_REVIEW_UPDATE_FAILED,
	ERR_STRATEGY_UPDATE_FAILED,
	ERR_TRADE_DELETE_FAILED,
	ERR_TRADE_RESTORE_FAILED,
	ERR_TRADES_DELETE_FAILED,
	ERR_TRASH_EMPTY_FAILED,
} from "@/lib/constants/errors";
import { cn, formatCurrency, getPnLColorClass } from "@/lib/shared";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";
import { TradeCard } from "./_components/trade-card";
import { TradeRow } from "./_components/trade-row";
import { TradeSearchInput } from "./_components/trade-search-input";

export default function JournalPage() {
	const { hasAccess: hasTradeManagement } = useHasFeature(
		FEATURE_TRADE_MANAGEMENT,
	);
	const { selectedAccountId, selectedAccount } = useAccount();
	const { formatDateTime } = useTimezone();
	const isMobile = useIsMobile();
	const [tab, setTab] = useState<"trades" | "trash">("trades");
	const [filterSheetOpen, setFilterSheetOpen] = useState(false);

	// Filters
	const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
	const [debouncedSearch, setDebouncedSearch] = useState("");
	// Bumped to remount (and clear) the search input on "clear filters".
	const [searchResetKey, setSearchResetKey] = useState(0);

	// Column configuration
	const {
		columns,
		visibleColumns,
		toggleColumn,
		resetColumns,
		isLoading: columnsLoading,
	} = useTradeColumns();

	// Sort configuration
	const { sort, toggleSort } = useTradeSort();
	const router = useRouter();

	// Selection for bulk actions
	const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);

	// Build query params from filters
	const queryParams = useMemo(() => {
		const params: Record<string, unknown> = {
			limit: 30,
			accountId: selectedAccountId ?? undefined,
			search: debouncedSearch || undefined,
			// Server-side sorting
			sortField: sort.field,
			sortDirection: sort.direction,
		};

		if (filters.status !== "all") params.status = filters.status;
		if (filters.direction !== "all") params.tradeDirection = filters.direction;
		if (filters.result !== "all") params.result = filters.result;
		if (filters.symbol) params.symbol = filters.symbol;
		if (filters.startDate)
			params.startDate = new Date(filters.startDate).toISOString();
		if (filters.endDate)
			params.endDate = new Date(filters.endDate).toISOString();
		if (filters.minPnl) params.minPnl = parseFloat(filters.minPnl);
		if (filters.maxPnl) params.maxPnl = parseFloat(filters.maxPnl);
		if (filters.minRating) params.minRating = parseInt(filters.minRating, 10);
		if (filters.maxRating) params.maxRating = parseInt(filters.maxRating, 10);
		if (filters.isReviewed !== "all") {
			params.isReviewed = filters.isReviewed === "reviewed";
		}
		if (filters.setupType) params.setupType = filters.setupType;
		if (filters.dayOfWeek.length > 0) params.dayOfWeek = filters.dayOfWeek;
		if (filters.exitReason) params.exitReason = filters.exitReason;
		if (filters.tagIds.length > 0) params.tagIds = filters.tagIds;
		if (filters.strategyId) params.strategyId = filters.strategyId;
		if (filters.minRMultiple)
			params.minRMultiple = parseFloat(filters.minRMultiple);
		if (filters.maxRMultiple)
			params.maxRMultiple = parseFloat(filters.maxRMultiple);

		return params;
	}, [filters, selectedAccountId, debouncedSearch, sort]);

	// Main trades query
	const {
		data,
		isLoading,
		isFetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = api.trades.getAll.useInfiniteQuery(
		queryParams as Parameters<typeof api.trades.getAll.useInfiniteQuery>[0],
		{
			getNextPageParam: (lastPage) => lastPage?.nextCursor,
			enabled: tab === "trades",
		},
	);

	// Infinite scroll hook
	const { sentinelRef } = useInfiniteScroll({
		onLoadMore: () => fetchNextPage(),
		hasMore: !!hasNextPage,
		isLoading: isFetchingNextPage,
	});

	// Deleted trades query
	const { data: deletedTrades, isLoading: loadingDeleted } =
		api.trades.getDeleted.useQuery(
			{ accountId: selectedAccountId ?? undefined },
			{ enabled: tab === "trash" },
		);

	// Strategies list for dropdown
	const { data: strategiesList } = api.strategies.getSimpleList.useQuery();

	const utils = api.useUtils();

	// Optimistic state for instant UI updates
	const {
		applyUpdate: applyOptimisticUpdate,
		clearUpdates: clearOptimisticUpdates,
		mergeWithData,
	} = useOptimisticState<Record<string, unknown>>();

	// Mutations
	const deleteTrade = api.trades.delete.useMutation({
		onSuccess: () => {
			toast.success("Trade moved to trash");
			utils.trades.getAll.invalidate();
			utils.trades.getDeleted.invalidate();
			setSelectedTrades(new Set());
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_TRADE_DELETE_FAILED));
		},
	});

	const deleteMany = api.trades.deleteMany.useMutation({
		onSuccess: (data) => {
			toast.success(`${data.deleted} trades moved to trash`);
			utils.trades.getAll.invalidate();
			utils.trades.getDeleted.invalidate();
			setSelectedTrades(new Set());
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_TRADES_DELETE_FAILED));
		},
	});

	const restoreTrade = api.trades.restore.useMutation({
		onSuccess: () => {
			toast.success("Trade restored");
			utils.trades.getAll.invalidate();
			utils.trades.getDeleted.invalidate();
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_TRADE_RESTORE_FAILED));
		},
	});

	const permanentDelete = api.trades.permanentDelete.useMutation({
		onSuccess: () => {
			toast.success("Trade permanently deleted");
			utils.trades.getDeleted.invalidate();
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_TRADE_DELETE_FAILED));
		},
	});

	const emptyTrash = api.trades.emptyTrash.useMutation({
		onSuccess: (data) => {
			toast.success(`${data.deleted} trades permanently deleted`);
			utils.trades.getAll.invalidate();
			utils.trades.getDeleted.invalidate();
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_TRASH_EMPTY_FAILED));
		},
	});

	// Rating mutation (raw, called by debounced handler)
	const updateRatingMutation = api.trades.updateRating.useMutation({
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_RATING_UPDATE_FAILED));
		},
	});

	// Debounced rating updates with per-trade debouncing
	const { trigger: updateRating } = useDebouncedMutation({
		mutationFn: ({ id, rating }: { id: string; rating: number }) => {
			updateRatingMutation.mutate({ id, rating });
		},
		onOptimisticUpdate: ({ id, rating }) => {
			applyOptimisticUpdate(id, { rating });
		},
		delay: 300,
		getKey: ({ id }) => id, // Per-trade debouncing
	});

	// Review mutation with optimistic update
	const markReviewed = api.trades.markReviewed.useMutation({
		onMutate: ({ id, isReviewed }) => {
			applyOptimisticUpdate(id, { isReviewed });
		},
		onSettled: async () => {
			await utils.trades.getAll.invalidate();
			clearOptimisticUpdates();
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_REVIEW_UPDATE_FAILED));
		},
	});

	// Strategy update mutation with optimistic update
	const updateStrategyMutation = api.trades.updateStrategy.useMutation({
		onMutate: ({ id, strategyId }) => {
			// Find strategy details for optimistic update
			const strategy = strategiesList?.find((s) => s.id === strategyId);
			applyOptimisticUpdate(id, {
				strategyId,
				strategy: strategy
					? { id: strategy.id, name: strategy.name, color: strategy.color }
					: null,
			});
		},
		onSettled: async () => {
			await utils.trades.getAll.invalidate();
			clearOptimisticUpdates();
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_STRATEGY_UPDATE_FAILED));
		},
	});

	// Bulk actions
	const bulkMarkReviewed = api.trades.bulkMarkReviewed.useMutation({
		onMutate: ({ ids, isReviewed }) => {
			for (const id of ids) {
				applyOptimisticUpdate(id, { isReviewed });
			}
		},
		onSuccess: (data) => {
			toast.success(`${data.updated} trades marked as reviewed`);
			setSelectedTrades(new Set());
		},
		onSettled: async () => {
			await utils.trades.getAll.invalidate();
			clearOptimisticUpdates();
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_REVIEW_UPDATE_FAILED));
		},
	});

	const bulkUpdateRating = api.trades.bulkUpdateRating.useMutation({
		onMutate: ({ ids, rating }) => {
			for (const id of ids) {
				applyOptimisticUpdate(id, { rating });
			}
		},
		onSuccess: (data) => {
			toast.success(`${data.updated} trades updated`);
			setSelectedTrades(new Set());
		},
		onSettled: async () => {
			await utils.trades.getAll.invalidate();
			clearOptimisticUpdates();
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_RATING_UPDATE_FAILED));
		},
	});

	const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);

	// Merge server data with optimistic updates (data comes pre-sorted from server)
	const allTrades = useMemo(() => {
		const trades = data?.pages.flatMap((page) => page.items) ?? [];
		return mergeWithData(trades);
	}, [data, mergeWithData]);

	const handleSelectAll = (checked: boolean) => {
		if (checked) {
			setSelectedTrades(new Set(allTrades.map((t) => t.id)));
		} else {
			setSelectedTrades(new Set());
		}
	};

	// Stable handlers (functional updates / refs) so memoized rows and cards only
	// re-render when their own trade or selection changes.
	const handleSelectTrade = useCallback((id: string, checked: boolean) => {
		setSelectedTrades((prev) => {
			const newSelected = new Set(prev);
			if (checked) {
				newSelected.add(id);
			} else {
				newSelected.delete(id);
			}
			return newSelected;
		});
	}, []);

	const handleNavigate = useCallback(
		(id: string) => {
			router.push(`/journal/${id}`);
		},
		[router],
	);

	const handleRequestDelete = useCallback((id: string) => {
		setTradeToDelete(id);
		setDeleteDialogOpen(true);
	}, []);

	const handleBulkDelete = () => {
		if (selectedTrades.size === 0) return;
		deleteMany.mutate({ ids: Array.from(selectedTrades) });
	};

	const handleDeleteTrade = () => {
		if (tradeToDelete) {
			deleteTrade.mutate({ id: tradeToDelete });
			setDeleteDialogOpen(false);
			setTradeToDelete(null);
		}
	};

	const clearFilters = () => {
		setFilters(DEFAULT_FILTERS);
		setDebouncedSearch("");
		setSearchResetKey((k) => k + 1);
	};

	// Mobile trash card component
	const TrashCard = ({
		trade,
	}: {
		trade: NonNullable<typeof deletedTrades>[0];
	}) => {
		return (
			<div className="flex flex-col gap-3 border-border border-b p-4">
				{/* Top row: symbol, direction, P&L */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="font-bold font-mono text-sm">{trade.symbol}</span>
						<span
							className={cn(
								"font-mono text-xs uppercase",
								trade.direction === "long" ? "text-profit" : "text-loss",
							)}
						>
							{trade.direction === "long" ? "L" : "S"}
						</span>
					</div>
					<span
						className={cn(
							"font-bold font-mono text-sm",
							trade.netPnl
								? getPnLColorClass(trade.netPnl)
								: "text-muted-foreground",
						)}
					>
						{trade.netPnl ? formatCurrency(parseFloat(trade.netPnl)) : "—"}
					</span>
				</div>

				{/* Middle row: entry info, deleted date */}
				<div className="flex items-center justify-between font-mono text-muted-foreground text-xs">
					<span>Entry: {parseFloat(trade.entryPrice).toFixed(2)}</span>
					<span>
						Deleted: {trade.deletedAt ? formatDateTime(trade.deletedAt) : "—"}
					</span>
				</div>

				{/* Bottom row: actions */}
				<div className="flex items-center justify-end gap-2">
					<Button
						className="h-9 min-h-11 font-mono text-xs"
						disabled={restoreTrade.isPending}
						onClick={() => restoreTrade.mutate({ id: trade.id })}
						size="sm"
						variant="outline"
					>
						<RotateCcw className="mr-2 h-4 w-4" />
						Restore
					</Button>
					<Button
						className="h-9 min-h-11 font-mono text-xs"
						disabled={permanentDelete.isPending}
						onClick={() => {
							if (
								confirm("Permanently delete this trade? This cannot be undone.")
							) {
								permanentDelete.mutate({ id: trade.id });
							}
						}}
						size="sm"
						variant="destructive"
					>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete
					</Button>
				</div>
			</div>
		);
	};

	return (
		<div className="space-y-4 sm:space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<span className="mb-2 block font-mono text-primary text-xs uppercase tracking-wider">
						Trading Journal
					</span>
					<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
						Trades
					</h1>
					<p className="mt-1 font-mono text-muted-foreground text-sm">
						{selectedAccount ? (
							<>
								Viewing{" "}
								<span className="text-foreground">{selectedAccount.name}</span>
							</>
						) : (
							"All accounts"
						)}
					</p>
				</div>
				{/* Hide ColumnConfig on mobile */}
				<div className="hidden items-center gap-2 sm:flex">
					<ColumnConfig
						columns={columns}
						onReset={resetColumns}
						onToggle={toggleColumn}
					/>
				</div>
			</div>

			<Tabs onValueChange={(v) => setTab(v as "trades" | "trash")} value={tab}>
				<TabsList className="border border-border bg-secondary">
					<TabsTrigger
						className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-muted/300"
						value="trades"
					>
						All Trades
					</TabsTrigger>
					<TabsTrigger
						className="gap-2 font-mono text-xs uppercase tracking-wider data-[state=active]:bg-muted/300"
						value="trash"
					>
						<Trash2 className="h-3.5 w-3.5" />
						Trash
					</TabsTrigger>
				</TabsList>

				<TabsContent className="space-y-4" value="trades">
					{/* Search + Filter button on mobile */}
					<div className="flex gap-2">
						<TradeSearchInput
							key={searchResetKey}
							onDebouncedChange={setDebouncedSearch}
						/>
						{/* Mobile filter button */}
						{isMobile && (
							<Sheet onOpenChange={setFilterSheetOpen} open={filterSheetOpen}>
								<SheetTrigger asChild>
									<Button
										className="min-h-11 shrink-0 font-mono text-xs"
										size="icon"
										variant="outline"
									>
										<Filter className="h-4 w-4" />
									</Button>
								</SheetTrigger>
								<SheetContent
									className="w-full overflow-y-auto sm:max-w-md"
									side="right"
								>
									<SheetHeader>
										<SheetTitle className="font-mono text-sm uppercase tracking-wider">
											Filters
										</SheetTitle>
									</SheetHeader>
									<div className="mt-4">
										<FilterPanel
											filters={filters}
											onChange={(newFilters) => {
												setFilters(newFilters);
											}}
											onClear={() => {
												clearFilters();
												setFilterSheetOpen(false);
											}}
										/>
									</div>
								</SheetContent>
							</Sheet>
						)}
					</div>

					{/* Filter Panel - desktop only */}
					{!isMobile && (
						<FilterPanel
							filters={filters}
							onChange={setFilters}
							onClear={clearFilters}
						/>
					)}

					{/* Bulk Actions - responsive */}
					{selectedTrades.size > 0 && (
						<div className="flex flex-wrap items-center gap-2 rounded border border-border bg-card px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
							<span className="font-mono text-muted-foreground text-xs">
								{selectedTrades.size} selected
							</span>
							<Button
								className="min-h-11 font-mono text-xs uppercase tracking-wider sm:min-h-0"
								disabled={deleteMany.isPending}
								onClick={handleBulkDelete}
								size="sm"
								variant="destructive"
							>
								<Trash2 className="h-3.5 w-3.5 sm:mr-2" />
								<span className="hidden sm:inline">Delete</span>
							</Button>
							<Button
								className="min-h-11 font-mono text-xs uppercase tracking-wider sm:min-h-0"
								onClick={() =>
									bulkMarkReviewed.mutate({
										ids: Array.from(selectedTrades),
										isReviewed: true,
									})
								}
								size="sm"
								variant="outline"
							>
								<CheckCircle2 className="h-3.5 w-3.5 sm:mr-2" />
								<span className="hidden sm:inline">Mark Reviewed</span>
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										className="min-h-11 font-mono text-xs uppercase tracking-wider sm:min-h-0"
										size="sm"
										variant="outline"
									>
										<Star className="h-3.5 w-3.5 sm:mr-2" />
										<span className="hidden sm:inline">Set Rating</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									{[1, 2, 3, 4, 5].map((r) => (
										<DropdownMenuItem
											key={r}
											onClick={() =>
												bulkUpdateRating.mutate({
													ids: Array.from(selectedTrades),
													rating: r,
												})
											}
										>
											<StarRating readonly size="sm" value={r} />
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() =>
											bulkUpdateRating.mutate({
												ids: Array.from(selectedTrades),
												rating: null,
											})
										}
									>
										Clear Rating
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<Button
								className="min-h-11 font-mono text-xs uppercase tracking-wider sm:min-h-0"
								onClick={() => setSelectedTrades(new Set())}
								size="sm"
								variant="ghost"
							>
								Cancel
							</Button>
						</div>
					)}

					{/* Trades Table / Card List */}
					<div className="overflow-hidden rounded border border-border bg-card">
						{isLoading ||
						(isFetching && !isFetchingNextPage) ||
						columnsLoading ? (
							<div className="space-y-3 p-6">
								{[...Array(5)].map((_, i) => (
									<Skeleton
										className="h-12 w-full"
										key={`skeleton-${i.toString()}`}
									/>
								))}
							</div>
						) : allTrades.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-16 text-center">
								<div className="mb-4 flex h-16 w-16 items-center justify-center rounded border border-border bg-card">
									<Plus className="h-6 w-6 text-muted-foreground/50" />
								</div>
								<h3 className="mb-1 font-medium">No trades found</h3>
								<p className="mb-4 px-4 font-mono text-muted-foreground text-xs">
									{Object.values(filters).some(
										(v) =>
											(typeof v === "string" && v !== "" && v !== "all") ||
											(Array.isArray(v) && v.length > 0),
									)
										? "Try adjusting your filters"
										: "Start logging your trades to build your journal"}
								</p>
								{!Object.values(filters).some(
									(v) =>
										(typeof v === "string" && v !== "" && v !== "all") ||
										(Array.isArray(v) && v.length > 0),
								) && (
									<div className="flex items-center gap-2">
										<Button
											asChild
											className="font-mono text-xs uppercase tracking-wider"
											size="sm"
											variant="outline"
										>
											<Link href="/trade/new">
												{!hasTradeManagement && (
													<Lock className="mr-1 size-3" />
												)}
												<Plus className="mr-2 h-3.5 w-3.5" />
												Manual Entry
											</Link>
										</Button>
										<Button
											asChild
											className="font-mono text-xs uppercase tracking-wider"
											size="sm"
										>
											<Link href="/import">
												<FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
												Import CSV
											</Link>
										</Button>
									</div>
								)}
							</div>
						) : isMobile ? (
							/* Mobile card view */
							<>
								{/* Select all header on mobile */}
								<div className="flex items-center justify-between border-border border-b px-4 py-2">
									<div className="flex items-center gap-2">
										<Checkbox
											checked={
												selectedTrades.size === allTrades.length &&
												allTrades.length > 0
											}
											onCheckedChange={handleSelectAll}
										/>
										<span className="font-mono text-muted-foreground text-xs">
											Select all
										</span>
									</div>
									<span className="font-mono text-muted-foreground text-xs">
										{allTrades.length} trades
									</span>
								</div>
								{allTrades.map((trade) => (
									<TradeCard
										formatDateTime={formatDateTime}
										isSelected={selectedTrades.has(trade.id)}
										key={trade.id}
										onNavigate={handleNavigate}
										onRate={updateRating}
										onRequestDelete={handleRequestDelete}
										onSelectTrade={handleSelectTrade}
										onToggleReviewed={markReviewed.mutate}
										trade={trade}
									/>
								))}
								{/* Infinite scroll sentinel */}
								<div className="h-1" ref={sentinelRef} />

								{/* Loading indicator */}
								{isFetchingNextPage && (
									<div className="flex justify-center border-border border-t p-4">
										<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
									</div>
								)}

								{/* End of list indicator */}
								{!hasNextPage && allTrades.length > 0 && (
									<div className="py-4 text-center font-mono text-muted-foreground text-xs">
										End of trades
									</div>
								)}
							</>
						) : (
							/* Desktop table view */
							<>
								<Table>
									<TableHeader>
										<TableRow className="border-border hover:bg-transparent">
											{visibleColumns.map((col) => (
												<TableHead
													className={cn(
														"font-mono text-[10px] text-muted-foreground uppercase tracking-wider",
														col.id === "checkbox" && "w-10",
														col.id === "actions" && "w-12.5",
													)}
													key={col.id}
												>
													{col.id === "checkbox" ? (
														<Checkbox
															checked={
																selectedTrades.size === allTrades.length &&
																allTrades.length > 0
															}
															onCheckedChange={handleSelectAll}
														/>
													) : (
														<SortableHeader
															columnId={col.id}
															label={col.label}
															onSort={toggleSort}
															sort={sort}
														/>
													)}
												</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{allTrades.map((trade) => (
											<TradeRow
												formatDateTime={formatDateTime}
												isSelected={selectedTrades.has(trade.id)}
												key={trade.id}
												onChangeStrategy={updateStrategyMutation.mutate}
												onNavigate={handleNavigate}
												onRate={updateRating}
												onRequestDelete={handleRequestDelete}
												onSelectTrade={handleSelectTrade}
												onToggleReviewed={markReviewed.mutate}
												strategiesList={strategiesList}
												trade={trade}
												visibleColumns={visibleColumns}
											/>
										))}
									</TableBody>
								</Table>

								{/* Infinite scroll sentinel */}
								<div className="h-1" ref={sentinelRef} />

								{/* Loading indicator */}
								{isFetchingNextPage && (
									<div className="flex justify-center border-border border-t p-4">
										<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
									</div>
								)}

								{/* End of list indicator */}
								{!hasNextPage && allTrades.length > 0 && (
									<div className="py-4 text-center font-mono text-muted-foreground text-xs">
										End of trades
									</div>
								)}
							</>
						)}
					</div>
				</TabsContent>

				<TabsContent className="space-y-4" value="trash">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<p className="font-mono text-muted-foreground text-xs">
							Trades in trash can be restored or permanently deleted.
						</p>
						{deletedTrades && deletedTrades.length > 0 && (
							<Button
								className="min-h-11 w-full font-mono text-xs uppercase tracking-wider sm:min-h-0 sm:w-auto"
								disabled={emptyTrash.isPending}
								onClick={() => setEmptyTrashDialogOpen(true)}
								size="sm"
								variant="destructive"
							>
								{emptyTrash.isPending ? (
									<>
										<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
										Deleting...
									</>
								) : (
									<>
										<Trash2 className="mr-2 h-3.5 w-3.5" />
										Empty Trash
									</>
								)}
							</Button>
						)}
					</div>
					<div className="overflow-hidden rounded border border-border bg-card">
						{loadingDeleted ? (
							<div className="space-y-3 p-6">
								{[...Array(3)].map((_, i) => (
									<Skeleton
										className="h-12 w-full"
										key={`skeleton-${i.toString()}`}
									/>
								))}
							</div>
						) : !deletedTrades || deletedTrades.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<div className="mb-3 flex h-12 w-12 items-center justify-center rounded border border-border bg-card">
									<Trash2 className="h-5 w-5 text-muted-foreground/30" />
								</div>
								<h3 className="mb-1 font-medium">Trash is empty</h3>
								<p className="font-mono text-muted-foreground text-xs">
									Deleted trades will appear here
								</p>
							</div>
						) : isMobile ? (
							/* Mobile card view for trash */
							<div>
								{deletedTrades.map((trade) => (
									<TrashCard key={trade.id} trade={trade} />
								))}
							</div>
						) : (
							/* Desktop table view for trash */
							<Table>
								<TableHeader>
									<TableRow className="border-border hover:bg-transparent">
										<TableHead className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
											Symbol
										</TableHead>
										<TableHead className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
											Direction
										</TableHead>
										<TableHead className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
											Entry
										</TableHead>
										<TableHead className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
											P&L
										</TableHead>
										<TableHead className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
											Deleted
										</TableHead>
										<TableHead className="w-25 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{deletedTrades.map((trade) => (
										<TableRow
											className="border-border hover:bg-secondary"
											key={trade.id}
										>
											<TableCell className="font-bold font-mono">
												{trade.symbol}
											</TableCell>
											<TableCell>
												<span
													className={cn(
														"font-mono text-xs uppercase",
														trade.direction === "long"
															? "text-profit"
															: "text-loss",
													)}
												>
													{trade.direction === "long" ? "Long" : "Short"}
												</span>
											</TableCell>
											<TableCell>
												<div className="font-mono text-sm">
													{parseFloat(trade.entryPrice).toFixed(2)}
												</div>
												<div className="font-mono text-[10px] text-muted-foreground">
													{formatDateTime(trade.entryTime)}
												</div>
											</TableCell>
											<TableCell>
												<span
													className={cn(
														"font-bold font-mono",
														trade.netPnl
															? getPnLColorClass(trade.netPnl)
															: "text-muted-foreground",
													)}
												>
													{trade.netPnl
														? formatCurrency(parseFloat(trade.netPnl))
														: "—"}
												</span>
											</TableCell>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{trade.deletedAt
													? formatDateTime(trade.deletedAt)
													: "—"}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1">
													<Button
														className="h-8 w-8"
														disabled={restoreTrade.isPending}
														onClick={() =>
															restoreTrade.mutate({ id: trade.id })
														}
														size="icon"
														title="Restore"
														variant="ghost"
													>
														<RotateCcw className="h-4 w-4" />
													</Button>
													<Button
														className="h-8 w-8 text-destructive hover:text-destructive"
														disabled={permanentDelete.isPending}
														onClick={() => {
															if (
																confirm(
																	"Permanently delete this trade? This cannot be undone.",
																)
															) {
																permanentDelete.mutate({ id: trade.id });
															}
														}}
														size="icon"
														title="Delete permanently"
														variant="ghost"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</div>
				</TabsContent>
			</Tabs>

			{/* Delete Confirmation Dialog */}
			<AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
				<AlertDialogContent className="border-border bg-background">
					<AlertDialogHeader>
						<AlertDialogTitle className="font-mono uppercase tracking-wider">
							Delete Trade
						</AlertDialogTitle>
						<AlertDialogDescription className="font-mono text-xs">
							This will move the trade to trash. You can restore it later if
							needed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="font-mono text-xs uppercase tracking-wider">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive font-mono text-destructive-foreground text-xs uppercase tracking-wider hover:bg-destructive/90"
							onClick={handleDeleteTrade}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Empty Trash Confirmation Dialog */}
			<AlertDialog
				onOpenChange={setEmptyTrashDialogOpen}
				open={emptyTrashDialogOpen}
			>
				<AlertDialogContent className="border-border bg-background">
					<AlertDialogHeader>
						<AlertDialogTitle className="font-mono uppercase tracking-wider">
							Empty Trash
						</AlertDialogTitle>
						<AlertDialogDescription className="font-mono text-xs">
							This will permanently delete {deletedTrades?.length ?? 0}{" "}
							trade(s). This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="font-mono text-xs uppercase tracking-wider">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive font-mono text-destructive-foreground text-xs uppercase tracking-wider hover:bg-destructive/90"
							onClick={() => {
								emptyTrash.mutate({
									accountId: selectedAccountId ?? undefined,
								});
								setEmptyTrashDialogOpen(false);
							}}
						>
							Delete All
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
