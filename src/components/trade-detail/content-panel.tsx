"use client";

import { Lock, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
	UpgradePrompt,
	useHasFeature,
} from "@/components/billing/upgrade-prompt";
import { DailyJournalPreview } from "@/components/daily-journal/daily-journal-preview";
import { TradeTags } from "@/components/tags/tag-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FEATURE_TRADE_REPLAY } from "@/lib/constants/billing";
import { ERR_MARKET_DATA_REFRESH_FAILED } from "@/lib/constants/errors";
import { cn } from "@/lib/shared";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";
import type { TradeForContentPanel } from "@/types";
import { TradeReplay } from "./replay";
import { RunningPnlTab } from "./running-pnl-tab";
import { TradeNoteEditor } from "./trade-note-editor";
import { TradingChartSkeleton } from "./trading-chart-skeleton";

const TradingViewChart = dynamic(
	() => import("./tradingview-chart").then((m) => m.TradingViewChart),
	{ ssr: false, loading: () => <TradingChartSkeleton /> },
);

// =============================================================================
// TYPES
// =============================================================================

// Use shared type (notes field comes from API, tradeTags already included)
type Trade = TradeForContentPanel & {
	notes: string | null;
};

interface ContentPanelProps {
	trade: Trade;
	onUpdateField: (
		field: string,
		value: string | number | boolean | null,
	) => void;
	className?: string;
	initialTab?: string;
}

// =============================================================================
// NOTES SECTION
// =============================================================================

function NotesSection({
	trade,
	onUpdateField,
}: {
	trade: Trade;
	onUpdateField: (field: string, value: string | null) => void;
}) {
	return (
		<div className="flex h-full flex-col">
			{/* Sub-tabs for Trade note vs Daily Journal */}
			<Tabs className="flex min-h-0 flex-1 flex-col" defaultValue="trade-note">
				<TabsList className="w-full shrink-0 justify-start bg-transparent">
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="trade-note"
					>
						Trade note
					</TabsTrigger>
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="daily-journal"
					>
						Daily Journal
					</TabsTrigger>
				</TabsList>

				<TabsContent
					className="mt-4 flex min-h-0 flex-1 flex-col"
					value="trade-note"
				>
					<TradeNoteEditor
						className="min-h-0 flex-1"
						onChange={(v) => onUpdateField("notes", v)}
						value={trade.notes}
					/>
				</TabsContent>

				<TabsContent
					className="mt-4 flex min-h-0 flex-1 flex-col"
					value="daily-journal"
				>
					<DailyJournalPreview
						className="min-h-0 flex-1"
						date={trade.entryTime}
						editable
					/>
				</TabsContent>
			</Tabs>

			{/* Tags Section - fixed at bottom */}
			<div className="mt-6 shrink-0 space-y-2">
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Tags
				</div>
				<TradeTags
					maxDisplay={10}
					tags={trade.tradeTags ?? []}
					tradeId={trade.id}
				/>
			</div>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ContentPanel({
	trade,
	onUpdateField,
	className,
	initialTab,
}: ContentPanelProps) {
	const { hasAccess: hasReplay } = useHasFeature(FEATURE_TRADE_REPLAY);

	const utils = api.useUtils();
	const refreshMarketData = api.trades.refreshMarketData.useMutation({
		onSuccess: (data) => {
			// Cache was cleared server-side — refetch chart candles + the trade
			// (MAE/MFE + stats) so the latest provider data shows immediately.
			utils.marketData.getFullDayChartData.invalidate();
			utils.marketData.getExtendedChartData.invalidate();
			utils.trades.getById.invalidate({ id: trade.id });

			// A no-data outcome isn't an error: "pending" means the session
			// hasn't published yet (try again after it settles), "unavailable"
			// means the provider has no data for this window.
			if (data.dataQuality === "pending") {
				toast(
					data.message ??
						"This session hasn't published yet — check back after it settles.",
				);
			} else if (data.dataQuality === "unavailable") {
				toast.error(data.message ?? ERR_MARKET_DATA_REFRESH_FAILED);
			} else {
				toast.success("Market data refreshed");
			}
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_MARKET_DATA_REFRESH_FAILED));
		},
	});

	return (
		<div
			className={cn("flex h-full min-w-0 flex-col overflow-hidden", className)}
		>
			<Tabs
				className="flex h-full min-w-0 flex-col"
				defaultValue={initialTab ?? "chart"}
			>
				<TabsList className="w-full shrink-0 justify-start overflow-x-auto rounded-none border-border border-b bg-transparent px-2">
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="chart"
					>
						Chart
					</TabsTrigger>
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="notes"
					>
						Notes
					</TabsTrigger>
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="replay"
					>
						Replay
						{!hasReplay && (
							<Lock className="ml-1 size-3 text-muted-foreground" />
						)}
					</TabsTrigger>
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="running-pnl"
					>
						Running P&L
					</TabsTrigger>

					{/* Re-fetch market data for this trade (candles + MAE/MFE) on demand */}
					<button
						className="ml-auto flex items-center gap-1.5 self-center px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:text-foreground disabled:opacity-50"
						disabled={refreshMarketData.isPending}
						onClick={() => refreshMarketData.mutate({ tradeId: trade.id })}
						title="Re-fetch market data and recompute MAE/MFE"
						type="button"
					>
						<RefreshCw
							className={cn(
								"size-3",
								refreshMarketData.isPending && "animate-spin",
							)}
						/>
						<span className="hidden sm:inline">Re-fetch data</span>
					</button>
				</TabsList>

				{/* CHART TAB */}
				<TabsContent className="m-0 flex-1 p-0" value="chart">
					<TradingViewChart
						direction={trade.direction}
						entryTime={trade.entryTime}
						executions={trade.executions}
						exitTime={trade.exitTime}
						maePrice={trade.maePrice}
						mfePrice={trade.mfePrice}
						status={trade.status}
						stopLoss={trade.stopLoss}
						symbol={trade.symbol}
						takeProfit={trade.takeProfit}
						tradeId={trade.id}
						trailedStopLoss={trade.trailedStopLoss}
						wasTrailed={trade.wasTrailed ?? undefined}
					/>
				</TabsContent>

				{/* NOTES TAB */}
				<TabsContent className="m-0 min-h-0 flex-1 p-4" value="notes">
					<NotesSection onUpdateField={onUpdateField} trade={trade} />
				</TabsContent>

				{/* REPLAY TAB */}
				<TabsContent className="m-0 flex-1 p-0" value="replay">
					{hasReplay ? (
						<TradeReplay
							direction={trade.direction}
							entryPrice={trade.entryPrice}
							entryTime={trade.entryTime}
							executions={trade.executions?.map((exec) => ({
								id: exec.id,
								executionType: exec.executionType,
								executedAt: exec.executedAt,
								price: exec.price,
								quantity: exec.quantity,
								realizedPnl: exec.realizedPnl,
							}))}
							exitPrice={trade.exitPrice}
							exitTime={trade.exitTime}
							quantity={trade.quantity}
							stopLoss={trade.stopLoss}
							symbol={trade.symbol}
							takeProfit={trade.takeProfit}
							tradeId={trade.id}
						/>
					) : (
						<UpgradePrompt feature={FEATURE_TRADE_REPLAY}>
							<div />
						</UpgradePrompt>
					)}
				</TabsContent>

				{/* RUNNING P&L TAB */}
				<TabsContent className="m-0 flex-1 p-0" value="running-pnl">
					<RunningPnlTab
						direction={trade.direction}
						entryPrice={trade.entryPrice}
						entryTime={trade.entryTime}
						executions={trade.executions?.map((exec) => ({
							id: exec.id,
							executionType: exec.executionType,
							executedAt: exec.executedAt,
							price: exec.price,
							quantity: exec.quantity,
							realizedPnl: exec.realizedPnl,
						}))}
						exitPrice={trade.exitPrice}
						exitTime={trade.exitTime}
						quantity={trade.quantity}
						symbol={trade.symbol}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
