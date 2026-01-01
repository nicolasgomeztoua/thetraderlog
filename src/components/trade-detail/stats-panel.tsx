import {
	BookMarked,
	Camera,
	ExternalLink,
	Info,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ComplianceBadge, RuleChecklist } from "@/components/strategy";
import { TradeTags } from "@/components/tags/tag-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { StarRating } from "@/components/ui/star-rating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTimezone } from "@/hooks/use-timezone";
import type { TradeStats } from "@/lib/trade-calculations";
import { cn, formatCurrency } from "@/lib/utils";
import { api } from "@/trpc/react";
import type { TradeForStatsPanel } from "@/types";
import { EditableField } from "./editable-field";
import { type Execution, ExecutionTimeline } from "./execution-timeline";

// =============================================================================
// TYPES
// =============================================================================

// Extend the shared type with API-specific fields (dates come as strings over tRPC)
interface Trade
	extends Omit<TradeForStatsPanel, "entryTime" | "exitTime" | "executions"> {
	entryTime: Date | string;
	exitTime: Date | string | null;
	executions?: Execution[]; // Local Execution type (simpler than full TradeExecution)
}

interface StatsPanelProps {
	trade: Trade;
	stats: TradeStats;
	onUpdateField: (
		field: string,
		value: string | number | boolean | null,
	) => void;
	onUpdateRating: (rating: number) => void;
	pendingRating: number | null;
	className?: string;
}

// =============================================================================
// SECTION WRAPPER - Consistent card-like sections
// =============================================================================

function Section({
	title,
	children,
	className,
}: {
	title?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"rounded-sm border border-white/[0.06] bg-white/[0.02] p-4",
				className,
			)}
		>
			{title && (
				<h3 className="mb-3 font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
					{title}
				</h3>
			)}
			{children}
		</div>
	);
}

// =============================================================================
// STAT ROW - Compact key-value display
// =============================================================================

function StatRow({
	label,
	value,
	valueClassName,
	suffix,
}: {
	label: string;
	value: string | number | null | undefined;
	valueClassName?: string;
	suffix?: string;
}) {
	const displayValue = value ?? "—";
	return (
		<div className="flex items-center justify-between py-1.5">
			<span className="font-mono text-[11px] text-muted-foreground/70">
				{label}
			</span>
			<span className={cn("font-mono text-sm tabular-nums", valueClassName)}>
				{displayValue}
				{suffix && value != null && (
					<span className="text-muted-foreground/70">{suffix}</span>
				)}
			</span>
		</div>
	);
}

// =============================================================================
// STRATEGY SECTION
// =============================================================================

function StrategySection({
	tradeId,
	strategyId,
	onStrategyChange,
}: {
	tradeId: string;
	strategyId: string | null;
	onStrategyChange: (strategyId: string | null) => void;
}) {
	const utils = api.useUtils();
	const { data: strategies } = api.strategies.getAll.useQuery();
	const { data: ruleChecksData } = api.strategies.getTradeRuleChecks.useQuery(
		{ tradeId },
		{ enabled: !!strategyId },
	);
	const [optimisticCompliance, setOptimisticCompliance] = useState<
		number | null
	>(null);

	const updateTradeMutation = api.trades.update.useMutation({
		onSuccess: () => {
			utils.trades.getById.invalidate({ id: tradeId });
			utils.strategies.getTradeRuleChecks.invalidate({ tradeId });
		},
	});

	const handleStrategyChange = (value: string) => {
		const newStrategyId = value === "none" ? null : value;
		onStrategyChange(newStrategyId);
		updateTradeMutation.mutate({ id: tradeId, strategyId: newStrategyId });
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<Select
					onValueChange={handleStrategyChange}
					value={strategyId?.toString() ?? "none"}
				>
					<SelectTrigger className="flex-1 font-mono text-xs">
						<SelectValue placeholder="Select strategy..." />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">No strategy</SelectItem>
						{strategies?.map((s) => (
							<SelectItem key={s.id} value={s.id.toString()}>
								<div className="flex items-center gap-2">
									<div
										className="h-2 w-2 rounded-full"
										style={{ backgroundColor: s.color ?? "#d4ff00" }}
									/>
									{s.name}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{strategyId && ruleChecksData?.strategy && (
					<>
						<ComplianceBadge
							compliance={optimisticCompliance ?? ruleChecksData.compliance}
							size="sm"
						/>
						<Button asChild className="h-7 w-7" size="icon" variant="ghost">
							<Link href={`/strategies/${strategyId}`}>
								<ExternalLink className="h-3 w-3" />
							</Link>
						</Button>
					</>
				)}
			</div>

			{strategyId && ruleChecksData && ruleChecksData.rules.length > 0 && (
				<RuleChecklist
					checks={ruleChecksData.checks}
					onComplianceChange={setOptimisticCompliance}
					onUpdate={() =>
						utils.strategies.getTradeRuleChecks.invalidate({ tradeId })
					}
					rules={ruleChecksData.rules}
					tradeId={tradeId}
				/>
			)}

			{!strategyId && (
				<div className="flex items-center gap-3 rounded border border-white/5 bg-white/[0.01] p-3">
					<BookMarked className="h-4 w-4 text-muted-foreground/50" />
					<p className="font-mono text-[11px] text-muted-foreground">
						No strategy assigned
					</p>
				</div>
			)}
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StatsPanel({
	trade,
	stats,
	onUpdateField,
	onUpdateRating,
	pendingRating,
	className,
}: StatsPanelProps) {
	const { formatTime } = useTimezone();
	const utils = api.useUtils();
	const netPnl = trade.netPnl ? parseFloat(trade.netPnl) : null;
	const isProfit = netPnl !== null && netPnl > 0;
	const isLoss = netPnl !== null && netPnl < 0;

	return (
		<div
			className={cn("flex h-full min-w-0 flex-col overflow-hidden", className)}
		>
			<Tabs className="flex h-full min-w-0 flex-col" defaultValue="stats">
				<TabsList className="w-full shrink-0 justify-start overflow-x-auto rounded-none border-border border-b bg-transparent px-2">
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="stats"
					>
						Stats
					</TabsTrigger>
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="strategy"
					>
						Strategy
					</TabsTrigger>
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="executions"
					>
						Executions
					</TabsTrigger>
					<TabsTrigger
						className="rounded-none border-transparent border-b-2 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-transparent"
						value="attachments"
					>
						Attachments
					</TabsTrigger>
				</TabsList>

				{/* STATS TAB */}
				<TabsContent className="m-0 flex-1 overflow-hidden" value="stats">
					<ScrollArea className="h-full">
						<div className="space-y-4 p-4">
							{/* ============================================
							    HERO: Net P&L + Direction
							    ============================================ */}
							<div className="flex items-start justify-between gap-4 pb-2">
								<div>
									<div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">
										Net P&L
									</div>
									<div
										className={cn(
											"mt-0.5 font-bold font-mono text-3xl tabular-nums tracking-tight",
											isProfit && "text-profit",
											isLoss && "text-loss",
											!isProfit && !isLoss && "text-muted-foreground",
										)}
									>
										{netPnl !== null ? formatCurrency(netPnl) : "—"}
									</div>
								</div>
								<div
									className={cn(
										"flex items-center gap-1.5 rounded-sm px-2.5 py-1.5",
										trade.direction === "long"
											? "bg-profit/10 text-profit"
											: "bg-loss/10 text-loss",
									)}
								>
									{trade.direction === "long" ? (
										<TrendingUp className="h-3.5 w-3.5" />
									) : (
										<TrendingDown className="h-3.5 w-3.5" />
									)}
									<span className="font-medium font-mono text-xs uppercase">
										{trade.direction}
									</span>
								</div>
							</div>

							{/* ============================================
							    SECTION 1: Risk Levels (Editable)
							    ============================================ */}
							<Section title="Risk Levels">
								<div className="grid grid-cols-2 gap-3">
									<EditableField
										label="Take Profit"
										onChange={(v) => onUpdateField("takeProfit", v)}
										prefix="$"
										type="number"
										value={trade.takeProfit}
									/>
									<EditableField
										label="Stop Loss"
										onChange={(v) => onUpdateField("stopLoss", v)}
										prefix="$"
										type="number"
										value={trade.stopLoss}
									/>
								</div>

								{/* Trailing Stop */}
								<div className="mt-3 space-y-2">
									<div className="flex items-center gap-2">
										<Checkbox
											checked={trade.wasTrailed ?? false}
											id="was-trailed"
											onCheckedChange={(checked) =>
												onUpdateField("wasTrailed", checked === true)
											}
										/>
										<label
											className="cursor-pointer font-mono text-[11px] text-muted-foreground"
											htmlFor="was-trailed"
										>
											Stop was trailed
										</label>
									</div>

									{trade.wasTrailed && (
										<EditableField
											onChange={(v) => onUpdateField("trailedStopLoss", v)}
											placeholder="Final stop level"
											prefix="$"
											type="number"
											value={trade.trailedStopLoss}
										/>
									)}
								</div>
							</Section>

							{/* ============================================
							    SECTION 2: Performance Metrics (Read-only)
							    ============================================ */}
							<Section title="Performance">
								<div className="divide-y divide-white/[0.04]">
									<StatRow
										label="Planned R:R"
										suffix="R"
										value={stats.plannedRR?.toFixed(2)}
									/>
									<StatRow
										label="Realized R"
										suffix="R"
										value={stats.rMultiple?.toFixed(2)}
										valueClassName={
											stats.rMultiple !== null
												? stats.rMultiple >= 0
													? "text-profit"
													: "text-loss"
												: undefined
										}
									/>
									<StatRow
										label="Gross P&L"
										value={
											stats.grossPnl !== null
												? formatCurrency(stats.grossPnl)
												: null
										}
										valueClassName={
											stats.grossPnl !== null
												? stats.grossPnl >= 0
													? "text-profit"
													: "text-loss"
												: undefined
										}
									/>
									<StatRow
										label="ROI"
										suffix="%"
										value={stats.roi?.toFixed(2)}
										valueClassName={
											stats.roi !== null
												? stats.roi >= 0
													? "text-profit"
													: "text-loss"
												: undefined
										}
									/>
								</div>
							</Section>

							{/* ============================================
							    SECTION 3: Price MAE/MFE (Closed trades only)
							    ============================================ */}
							{trade.status === "closed" &&
								trade.maePrice &&
								trade.mfePrice && (
									<div className="grid grid-cols-2 gap-2">
										{/* MAE Card */}
										<div className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-3">
											<div className="mb-1 flex items-center gap-1">
												<span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
													MAE
												</span>
												<Tooltip>
													<TooltipTrigger asChild>
														<Info className="h-3 w-3 cursor-help text-muted-foreground/50 transition-colors hover:text-muted-foreground" />
													</TooltipTrigger>
													<TooltipContent className="max-w-[200px]" side="top">
														<p className="font-sans text-xs">
															<span className="font-semibold">
																Maximum Adverse Excursion
															</span>
															<br />
															The worst price reached against your position
														</p>
													</TooltipContent>
												</Tooltip>
											</div>
											<span className="font-mono text-loss text-sm tabular-nums">
												${parseFloat(trade.maePrice).toLocaleString()}
											</span>
										</div>

										{/* MFE Card */}
										<div className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-3">
											<div className="mb-1 flex items-center gap-1">
												<span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
													MFE
												</span>
												<Tooltip>
													<TooltipTrigger asChild>
														<Info className="h-3 w-3 cursor-help text-muted-foreground/50 transition-colors hover:text-muted-foreground" />
													</TooltipTrigger>
													<TooltipContent className="max-w-[200px]" side="top">
														<p className="font-sans text-xs">
															<span className="font-semibold">
																Maximum Favorable Excursion
															</span>
															<br />
															The best price reached in your favor
														</p>
													</TooltipContent>
												</Tooltip>
											</div>
											<span className="font-mono text-profit text-sm tabular-nums">
												${parseFloat(trade.mfePrice).toLocaleString()}
											</span>
										</div>
									</div>
								)}

							{/* ============================================
							    SECTION 4: Trade Details (Read-only)
							    ============================================ */}
							<Section title="Trade Details">
								<div className="divide-y divide-white/[0.04]">
									<StatRow
										label={
											trade.instrumentType === "futures" ? "Contracts" : "Lots"
										}
										value={parseFloat(trade.quantity).toString()}
									/>
									<StatRow
										label="Points"
										value={stats.points?.toFixed(2)}
										valueClassName={
											stats.points !== null
												? stats.points >= 0
													? "text-profit"
													: "text-loss"
												: undefined
										}
									/>
									{trade.instrumentType === "futures" && (
										<>
											<StatRow
												label="Ticks"
												value={stats.ticks?.toFixed(1)}
												valueClassName={
													stats.ticks !== null
														? stats.ticks >= 0
															? "text-profit"
															: "text-loss"
														: undefined
												}
											/>
											<StatRow
												label="Ticks/Contract"
												value={stats.ticksPerContract?.toFixed(1)}
											/>
										</>
									)}
									{trade.instrumentType === "forex" && (
										<StatRow
											label="Pips"
											value={stats.pips?.toFixed(1)}
											valueClassName={
												stats.pips !== null
													? stats.pips >= 0
														? "text-profit"
														: "text-loss"
													: undefined
											}
										/>
									)}
									<StatRow
										label="Fees"
										value={
											trade.fees
												? `$${parseFloat(trade.fees).toFixed(2)}`
												: null
										}
									/>
								</div>
							</Section>

							{/* ============================================
							    SECTION 5: Entry & Exit
							    ============================================ */}
							<Section title="Entry & Exit">
								<div className="divide-y divide-white/[0.04]">
									<StatRow
										label="Entry Price"
										value={`$${parseFloat(trade.entryPrice).toLocaleString()}`}
									/>
									<StatRow
										label="Exit Price"
										value={
											trade.exitPrice
												? `$${parseFloat(trade.exitPrice).toLocaleString()}`
												: null
										}
									/>
									<StatRow
										label="Entry Time"
										value={formatTime(trade.entryTime)}
									/>
									<StatRow
										label="Exit Time"
										value={trade.exitTime ? formatTime(trade.exitTime) : null}
									/>
								</div>
							</Section>

							{/* ============================================
							    SECTION 6: Trade Context (Editable)
							    ============================================ */}
							<Section title="Context">
								<div className="grid grid-cols-2 gap-3">
									{/* Row 1: Rating | Mood */}
									<div className="space-y-1.5">
										<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
											Rating
										</span>
										<div className="flex h-10 items-center">
											<StarRating
												onChange={(rating) => onUpdateRating(rating ?? 0)}
												size="sm"
												value={pendingRating ?? trade.rating ?? 0}
											/>
										</div>
									</div>

									<div className="space-y-1.5">
										<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
											Mood
										</span>
										<Select
											onValueChange={(v) =>
												onUpdateField("emotionalState", v === "none" ? null : v)
											}
											value={trade.emotionalState ?? "none"}
										>
											<SelectTrigger
												aria-label="Mood"
												className="h-10 font-mono text-xs"
											>
												<SelectValue placeholder="—" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">—</SelectItem>
												<SelectItem value="confident">😎 Confident</SelectItem>
												<SelectItem value="neutral">😐 Neutral</SelectItem>
												<SelectItem value="anxious">😰 Anxious</SelectItem>
												<SelectItem value="fearful">😨 Fearful</SelectItem>
												<SelectItem value="greedy">🤑 Greedy</SelectItem>
												<SelectItem value="frustrated">
													😤 Frustrated
												</SelectItem>
												<SelectItem value="excited">🤩 Excited</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{/* Row 2: Exit Reason | Tags */}
									<div className="space-y-1.5">
										<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
											Exit Reason
										</span>
										<Select
											onValueChange={(v) =>
												onUpdateField("exitReason", v === "none" ? null : v)
											}
											value={trade.exitReason ?? "none"}
										>
											<SelectTrigger
												aria-label="Exit Reason"
												className="h-10 font-mono text-xs"
											>
												<SelectValue placeholder="—" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">—</SelectItem>
												<SelectItem value="manual">Manual</SelectItem>
												<SelectItem value="stop_loss">Stop Loss</SelectItem>
												<SelectItem value="trailing_stop">Trailing</SelectItem>
												<SelectItem value="take_profit">Take Profit</SelectItem>
												<SelectItem value="time_based">Time-Based</SelectItem>
												<SelectItem value="breakeven">Breakeven</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-1.5">
										<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
											Tags
										</span>
										<TradeTags
											maxDisplay={3}
											onUpdate={() =>
												utils.trades.getById.invalidate({ id: trade.id })
											}
											tags={trade.tradeTags ?? []}
											tradeId={trade.id}
										/>
									</div>
								</div>
							</Section>
						</div>
					</ScrollArea>
				</TabsContent>

				{/* STRATEGY TAB */}
				<TabsContent
					className="m-0 flex-1 overflow-hidden p-4"
					value="strategy"
				>
					<StrategySection
						onStrategyChange={(id) => onUpdateField("strategyId", id)}
						strategyId={trade.strategyId}
						tradeId={trade.id}
					/>
				</TabsContent>

				{/* EXECUTIONS TAB */}
				<TabsContent
					className="m-0 flex-1 overflow-hidden p-4"
					value="executions"
				>
					<ExecutionTimeline
						executions={trade.executions ?? []}
						instrumentType={trade.instrumentType}
						onAddExecution={() => {
							// TODO: Implement add execution
						}}
					/>
				</TabsContent>

				{/* ATTACHMENTS TAB */}
				<TabsContent
					className="m-0 flex-1 overflow-hidden p-4"
					value="attachments"
				>
					<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
						<Camera className="mb-3 h-10 w-10 opacity-50" />
						<p className="font-mono text-xs">Drop images or click to upload</p>
						<p className="mt-1 font-mono text-[10px] opacity-50">Coming soon</p>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
