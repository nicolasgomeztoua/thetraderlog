"use client";

import {
	CheckCircle2,
	Circle,
	Filter,
	Loader2,
	MoreHorizontal,
	Plus,
	RotateCcw,
	Search,
	Star,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import {
	ERR_RATING_UPDATE_FAILED,
	ERR_STRATEGY_UPDATE_FAILED,
	ERR_TRADE_DELETE_FAILED,
	ERR_TRADE_RESTORE_FAILED,
	ERR_TRADES_DELETE_FAILED,
	ERR_TRASH_EMPTY_FAILED,
} from "@/lib/constants/errors";
import { cn, formatCurrency, getPnLColorClass } from "@/lib/shared";
import { getErrorMessage } from "@/lib/shared/utils";
import { calculateActualRMultiple } from "@/lib/trades/calculations";
import { api } from "@/trpc/react";

export default function JournalPage() {
	const { selectedAccountId, selectedAccount } = useAccount();
	const { formatDateTime } = useTimezone();
	const isMobile = useIsMobile();
	const [tab, setTab] = useState<"trades" | "trash">("trades");
	const [filterSheetOpen, setFilterSheetOpen] = useState(false);

	// Filters
	const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");

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

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
		}, 300);
		return () => clearTimeout(timer);
	}, [search]);

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
		onError: () => {
			toast.error(ERR_RATING_UPDATE_FAILED);
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
		onError: () => {
			toast.error(ERR_STRATEGY_UPDATE_FAILED);
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

	const handleSelectTrade = (id: string, checked: boolean) => {
		const newSelected = new Set(selectedTrades);
		if (checked) {
			newSelected.add(id);
		} else {
			newSelected.delete(id);
		}
		setSelectedTrades(newSelected);
	};

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
		setSearch("");
	};

	// Render a table cell based on column id
	const renderCell = (
		columnId: string,
		trade: (typeof allTrades)[0],
	): React.ReactNode => {
		switch (columnId) {
			case "checkbox":
				return (
					<Checkbox
						checked={selectedTrades.has(trade.id)}
						onCheckedChange={(checked) =>
							handleSelectTrade(trade.id, !!checked)
						}
					/>
				);
			case "symbol":
				return <span className="font-bold font-mono">{trade.symbol}</span>;
			case "side":
				return (
					<span
						className={cn(
							"font-mono text-xs uppercase",
							trade.direction === "long" ? "text-profit" : "text-loss",
						)}
					>
						{trade.direction === "long" ? "Long" : "Short"}
					</span>
				);
			case "entry":
				return (
					<div>
						<div className="font-mono text-sm">
							{parseFloat(trade.entryPrice).toFixed(2)}
						</div>
						<div className="font-mono text-[10px] text-muted-foreground">
							{formatDateTime(trade.entryTime)}
						</div>
					</div>
				);
			case "exit":
				return trade.exitPrice ? (
					<div>
						<div className="font-mono text-sm">
							{parseFloat(trade.exitPrice).toFixed(2)}
						</div>
						<div className="font-mono text-[10px] text-muted-foreground">
							{formatDateTime(trade.exitTime)}
						</div>
					</div>
				) : (
					<span className="font-mono text-muted-foreground text-xs">—</span>
				);
			case "size":
				return (
					<span className="font-mono text-sm">
						{parseFloat(trade.quantity).toFixed(2)}
					</span>
				);
			case "pnl":
				return (
					<span
						className={cn(
							"font-bold font-mono",
							trade.netPnl
								? getPnLColorClass(trade.netPnl)
								: "text-muted-foreground",
						)}
					>
						{trade.netPnl ? formatCurrency(parseFloat(trade.netPnl)) : "—"}
					</span>
				);
			case "result":
				return trade.status === "open" ? (
					<span className="font-mono text-muted-foreground text-xs">Open</span>
				) : trade.exitReason === "take_profit" || trade.takeProfitHit ? (
					<span className="font-mono text-profit text-xs">TP</span>
				) : trade.exitReason === "stop_loss" || trade.stopLossHit ? (
					<span className="font-mono text-loss text-xs">SL</span>
				) : trade.exitReason === "trailing_stop" ? (
					<span className="font-mono text-accent text-xs">Trail</span>
				) : trade.exitReason === "breakeven" ? (
					<span className="font-mono text-breakeven text-xs">BE</span>
				) : (
					<span className="font-mono text-muted-foreground text-xs">
						Manual
					</span>
				);
			case "rating":
				return (
					<StarRating
						onChange={(rating) =>
							updateRating({ id: trade.id, rating: rating ?? 0 })
						}
						size="sm"
						value={trade.rating ?? 0}
					/>
				);
			case "reviewed":
				return (
					<button
						className="flex items-center justify-center"
						onClick={(e) => {
							e.stopPropagation();
							markReviewed.mutate({
								id: trade.id,
								isReviewed: !trade.isReviewed,
							});
						}}
						type="button"
					>
						{trade.isReviewed ? (
							<CheckCircle2 className="h-4 w-4 text-profit" />
						) : (
							<Circle className="h-4 w-4 text-muted-foreground/30" />
						)}
					</button>
				);
			case "setup":
				return (
					<span className="font-mono text-muted-foreground text-xs">
						{trade.setupType || "—"}
					</span>
				);
			case "fees":
				return (
					<span className="font-mono text-muted-foreground text-xs">
						{trade.fees ? formatCurrency(parseFloat(trade.fees)) : "—"}
					</span>
				);
			case "duration": {
				if (!trade.exitTime)
					return (
						<span className="font-mono text-muted-foreground text-xs">—</span>
					);
				const duration =
					new Date(trade.exitTime).getTime() -
					new Date(trade.entryTime).getTime();
				const minutes = Math.floor(duration / 60000);
				const hours = Math.floor(minutes / 60);
				const days = Math.floor(hours / 24);
				if (days > 0)
					return (
						<span className="font-mono text-xs">
							{days}d {hours % 24}h
						</span>
					);
				if (hours > 0)
					return (
						<span className="font-mono text-xs">
							{hours}h {minutes % 60}m
						</span>
					);
				return <span className="font-mono text-xs">{minutes}m</span>;
			}
			case "rMultiple": {
				// Calculate R-Multiple using actual P&L and proper risk calculation
				const rMultiple = calculateActualRMultiple(
					trade.netPnl ? parseFloat(trade.netPnl) : null,
					parseFloat(trade.entryPrice),
					trade.stopLoss ? parseFloat(trade.stopLoss) : null,
					parseFloat(trade.quantity),
					trade.symbol,
				);
				if (rMultiple === null) {
					return (
						<span className="font-mono text-muted-foreground text-xs">—</span>
					);
				}
				return (
					<span
						className={cn(
							"font-mono text-xs",
							rMultiple > 0
								? "text-profit"
								: rMultiple < 0
									? "text-loss"
									: "text-muted-foreground",
						)}
					>
						{rMultiple.toFixed(2)}R
					</span>
				);
			}
			case "tags":
				return (
					<div className="flex flex-wrap gap-1">
						{trade.tradeTags?.slice(0, 2).map((tt) => (
							<Badge
								className="px-1 py-0 text-[10px]"
								key={tt.tagId}
								style={{
									borderColor: tt.tag.color ?? undefined,
									color: tt.tag.color ?? undefined,
								}}
								variant="outline"
							>
								{tt.tag.name}
							</Badge>
						))}
						{trade.tradeTags && trade.tradeTags.length > 2 && (
							<Badge className="px-1 py-0 text-[10px]" variant="secondary">
								+{trade.tradeTags.length - 2}
							</Badge>
						)}
					</div>
				);
			case "account":
				return (
					<span className="font-mono text-muted-foreground text-xs">
						{trade.account?.name || "—"}
					</span>
				);
			case "strategy":
				return (
					<Select
						onValueChange={(value) => {
							const strategyId = value === "none" ? null : value;
							updateStrategyMutation.mutate({ id: trade.id, strategyId });
						}}
						value={trade.strategyId?.toString() ?? "none"}
					>
						<SelectTrigger className="h-7 w-[130px] border-transparent bg-transparent px-2 font-mono text-xs hover:border-border focus:ring-0 focus:ring-offset-0">
							<SelectValue>
								{trade.strategy ? (
									<div className="flex items-center gap-1.5">
										<div
											className="h-1.5 w-1.5 shrink-0 rounded-full"
											style={{
												backgroundColor: trade.strategy.color ?? "#d4ff00",
											}}
										/>
										<span className="truncate">{trade.strategy.name}</span>
									</div>
								) : (
									<span className="text-muted-foreground/50">None</span>
								)}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">
								<span className="text-muted-foreground">None</span>
							</SelectItem>
							{strategiesList?.map((s) => (
								<SelectItem key={s.id} value={s.id.toString()}>
									<div className="flex items-center gap-1.5">
										<div
											className="h-1.5 w-1.5 shrink-0 rounded-full"
											style={{ backgroundColor: s.color ?? "#d4ff00" }}
										/>
										{s.name}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				);
			case "actions":
				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button className="h-8 w-8" size="icon" variant="ghost">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem asChild className="font-mono text-xs">
								<Link href={`/journal/${trade.id}`}>View Details</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="font-mono text-destructive text-xs focus:text-destructive"
								onClick={() => {
									setTradeToDelete(trade.id);
									setDeleteDialogOpen(true);
								}}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			default:
				return null;
		}
	};

	// Mobile trade card component
	const TradeCard = ({ trade }: { trade: (typeof allTrades)[0] }) => {
		const rMultiple = calculateActualRMultiple(
			trade.netPnl ? parseFloat(trade.netPnl) : null,
			parseFloat(trade.entryPrice),
			trade.stopLoss ? parseFloat(trade.stopLoss) : null,
			parseFloat(trade.quantity),
			trade.symbol,
		);

		return (
			<button
				className={cn(
					"flex w-full cursor-pointer flex-col gap-3 border-border border-b bg-transparent p-4 text-left transition-colors active:bg-secondary",
					selectedTrades.has(trade.id) && "bg-accent",
				)}
				onClick={() => router.push(`/journal/${trade.id}`)}
				type="button"
			>
				{/* Top row: checkbox, symbol, direction, P&L */}
				<div className="flex w-full items-center justify-between">
					<div className="flex items-center gap-3">
						<Checkbox
							checked={selectedTrades.has(trade.id)}
							onCheckedChange={(checked) => {
								handleSelectTrade(trade.id, !!checked);
							}}
							onClick={(e) => e.stopPropagation()}
						/>
						<div className="flex items-center gap-2">
							<span className="font-bold font-mono text-sm">
								{trade.symbol}
							</span>
							<span
								className={cn(
									"font-mono text-xs uppercase",
									trade.direction === "long" ? "text-profit" : "text-loss",
								)}
							>
								{trade.direction === "long" ? "L" : "S"}
							</span>
						</div>
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

				{/* Middle row: entry/exit info */}
				<div className="flex w-full items-center justify-between font-mono text-muted-foreground text-xs">
					<span>{formatDateTime(trade.entryTime)}</span>
					<div className="flex items-center gap-2">
						{rMultiple !== null && (
							<span
								className={cn(
									rMultiple > 0
										? "text-profit"
										: rMultiple < 0
											? "text-loss"
											: "text-muted-foreground",
								)}
							>
								{rMultiple.toFixed(2)}R
							</span>
						)}
						{trade.status === "open" ? (
							<span className="text-muted-foreground">Open</span>
						) : trade.exitReason === "take_profit" || trade.takeProfitHit ? (
							<span className="text-profit">TP</span>
						) : trade.exitReason === "stop_loss" || trade.stopLossHit ? (
							<span className="text-loss">SL</span>
						) : trade.exitReason === "trailing_stop" ? (
							<span className="text-accent">Trail</span>
						) : trade.exitReason === "breakeven" ? (
							<span className="text-breakeven">BE</span>
						) : (
							<span className="text-muted-foreground">Manual</span>
						)}
					</div>
				</div>

				{/* Bottom row: rating, reviewed, actions */}
				<div className="flex w-full items-center justify-between">
					<div className="flex items-center gap-3">
						{/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper */}
						{/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation wrapper */}
						<span onClick={(e) => e.stopPropagation()}>
							<StarRating
								onChange={(rating) =>
									updateRating({ id: trade.id, rating: rating ?? 0 })
								}
								size="sm"
								value={trade.rating ?? 0}
							/>
						</span>
						{/* biome-ignore lint/a11y/useSemanticElements: nested interactive element inside button */}
						<span
							className="flex items-center justify-center"
							onClick={(e) => {
								e.stopPropagation();
								markReviewed.mutate({
									id: trade.id,
									isReviewed: !trade.isReviewed,
								});
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.stopPropagation();
									e.preventDefault();
									markReviewed.mutate({
										id: trade.id,
										isReviewed: !trade.isReviewed,
									});
								}
							}}
							role="button"
							tabIndex={0}
						>
							{trade.isReviewed ? (
								<CheckCircle2 className="h-4 w-4 text-profit" />
							) : (
								<Circle className="h-4 w-4 text-muted-foreground/30" />
							)}
						</span>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
							<Button className="h-8 w-8" size="icon" variant="ghost">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem asChild className="font-mono text-xs">
								<Link href={`/journal/${trade.id}`}>View Details</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="font-mono text-destructive text-xs focus:text-destructive"
								onClick={(e) => {
									e.stopPropagation();
									setTradeToDelete(trade.id);
									setDeleteDialogOpen(true);
								}}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</button>
		);
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
						className="h-9 min-h-[44px] font-mono text-xs"
						disabled={restoreTrade.isPending}
						onClick={() => restoreTrade.mutate({ id: trade.id })}
						size="sm"
						variant="outline"
					>
						<RotateCcw className="mr-2 h-4 w-4" />
						Restore
					</Button>
					<Button
						className="h-9 min-h-[44px] font-mono text-xs"
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
						<div className="relative flex-1">
							<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
							<Input
								className="pl-9 font-mono text-xs"
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search symbol, setup, notes..."
								value={search}
							/>
						</div>
						{/* Mobile filter button */}
						{isMobile && (
							<Sheet onOpenChange={setFilterSheetOpen} open={filterSheetOpen}>
								<SheetTrigger asChild>
									<Button
										className="min-h-[44px] shrink-0 font-mono text-xs"
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
								className="min-h-[44px] font-mono text-xs uppercase tracking-wider sm:min-h-0"
								disabled={deleteMany.isPending}
								onClick={handleBulkDelete}
								size="sm"
								variant="destructive"
							>
								<Trash2 className="h-3.5 w-3.5 sm:mr-2" />
								<span className="hidden sm:inline">Delete</span>
							</Button>
							<Button
								className="min-h-[44px] font-mono text-xs uppercase tracking-wider sm:min-h-0"
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
										className="min-h-[44px] font-mono text-xs uppercase tracking-wider sm:min-h-0"
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
								className="min-h-[44px] font-mono text-xs uppercase tracking-wider sm:min-h-0"
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
						{isLoading || isFetching || columnsLoading ? (
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
									<Button
										asChild
										className="font-mono text-xs uppercase tracking-wider"
										size="sm"
									>
										<Link href="/trade/new">
											<Plus className="mr-2 h-3.5 w-3.5" />
											Add Your First Trade
										</Link>
									</Button>
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
									<TradeCard key={trade.id} trade={trade} />
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
														col.id === "checkbox" && "w-[40px]",
														col.id === "actions" && "w-[50px]",
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
											<TableRow
												className={cn(
													"cursor-pointer border-border transition-colors hover:bg-secondary",
													selectedTrades.has(trade.id) && "bg-accent",
												)}
												key={trade.id}
												onClick={() => router.push(`/journal/${trade.id}`)}
											>
												{visibleColumns.map((col) => (
													<TableCell
														key={col.id}
														onClick={(e) => {
															if (
																col.id === "checkbox" ||
																col.id === "actions" ||
																col.id === "rating" ||
																col.id === "reviewed" ||
																col.id === "strategy"
															) {
																e.stopPropagation();
															}
														}}
													>
														{renderCell(col.id, trade)}
													</TableCell>
												))}
											</TableRow>
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
								className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:min-h-0 sm:w-auto"
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
										<TableHead className="w-[100px] font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
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
