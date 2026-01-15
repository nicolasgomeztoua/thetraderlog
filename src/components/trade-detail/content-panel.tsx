import { DailyJournalPreview } from "@/components/daily-journal/daily-journal-preview";
import { TradeTags } from "@/components/tags/tag-selector";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";
import type { TradeForContentPanel } from "@/types";
import { EditableTextarea } from "./editable-field";
import { TradeReplay } from "./replay";
import { RunningPnlTab } from "./running-pnl-tab";
import { TradingViewChart } from "./tradingview-chart";

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
	const utils = api.useUtils();

	return (
		<div className="space-y-6">
			{/* Sub-tabs for Trade note vs Daily Journal */}
			<Tabs defaultValue="trade-note">
				<TabsList className="w-full justify-start bg-transparent">
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

				<TabsContent className="mt-4" value="trade-note">
					<EditableTextarea
						onChange={(v) => onUpdateField("notes", v || null)}
						placeholder="Add notes about this trade..."
						rows={6}
						value={trade.notes}
					/>
				</TabsContent>

				<TabsContent className="mt-4" value="daily-journal">
					<DailyJournalPreview date={trade.entryTime} editable />
				</TabsContent>
			</Tabs>

			{/* Tags Section */}
			<div className="space-y-2">
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Tags
				</div>
				<TradeTags
					maxDisplay={10}
					onUpdate={() => utils.trades.getById.invalidate({ id: trade.id })}
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
}: ContentPanelProps) {
	return (
		<div
			className={cn("flex h-full min-w-0 flex-col overflow-hidden", className)}
		>
			<Tabs className="flex h-full min-w-0 flex-col" defaultValue="chart">
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
					</TabsTrigger>
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="running-pnl"
					>
						Running P&L
					</TabsTrigger>
				</TabsList>

				{/* CHART TAB */}
				<TabsContent className="m-0 flex-1 p-0" value="chart">
					<TradingViewChart
						direction={trade.direction}
						entryPrice={trade.entryPrice}
						entryTime={trade.entryTime}
						executions={trade.executions}
						exitPrice={trade.exitPrice}
						exitTime={trade.exitTime}
						maePrice={trade.maePrice}
						mfePrice={trade.mfePrice}
						status={trade.status}
						stopLoss={trade.stopLoss}
						symbol={trade.symbol}
						takeProfit={trade.takeProfit}
						trailedStopLoss={trade.trailedStopLoss}
						wasTrailed={trade.wasTrailed ?? undefined}
					/>
				</TabsContent>

				{/* NOTES TAB */}
				<TabsContent className="m-0 flex-1" value="notes">
					<ScrollArea className="h-full">
						<div className="p-4">
							<NotesSection onUpdateField={onUpdateField} trade={trade} />
						</div>
					</ScrollArea>
				</TabsContent>

				{/* REPLAY TAB */}
				<TabsContent className="m-0 flex-1 p-0" value="replay">
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
						instrumentType={trade.instrumentType}
						quantity={trade.quantity}
						stopLoss={trade.stopLoss}
						symbol={trade.symbol}
						takeProfit={trade.takeProfit}
						tradeId={trade.id}
					/>
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
						exitTime={trade.exitTime}
						instrumentType={trade.instrumentType}
						quantity={trade.quantity}
						symbol={trade.symbol}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
