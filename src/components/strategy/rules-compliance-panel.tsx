"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

export interface RuleComplianceData {
	ruleId: string;
	ruleText: string;
	category: "entry" | "exit" | "risk" | "management";
	checkedCount: number;
	totalTrades: number;
	compliance: number;
}

export interface TradeComplianceData {
	tradeId: string;
	compliance: number;
	symbol: string;
	exitTime: Date | string | null;
	pnl: number;
	checkedCount: number;
	totalRules: number;
}

export interface RulesCompliancePanelProps {
	/** Average compliance percentage across all trades */
	avgCompliance: number;
	/** Total number of trades analyzed */
	totalTrades: number;
	/** Per-rule compliance data */
	ruleCompliance: RuleComplianceData[];
	/** Per-trade compliance data for trends and recent trades list */
	tradeCompliance?: TradeComplianceData[];
	/** Optional className for container */
	className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_LABELS: Record<RuleComplianceData["category"], string> = {
	entry: "Entry",
	exit: "Exit",
	risk: "Risk",
	management: "Management",
};

const CATEGORY_COLORS: Record<RuleComplianceData["category"], string> = {
	entry: "#00ff88", // profit green
	exit: "#d4ff00", // primary
	risk: "#ff3b3b", // loss red
	management: "#00d4ff", // accent/ice blue
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getComplianceColor(compliance: number): string {
	if (compliance >= 80) return "#00ff88"; // profit green
	if (compliance >= 50) return "#ffaa00"; // yellow/warning
	return "#ff3b3b"; // loss red
}

function getComplianceLabel(compliance: number): string {
	if (compliance >= 80) return "Strong";
	if (compliance >= 50) return "Moderate";
	return "Weak";
}

// =============================================================================
// COMPLIANCE TREND CHART COMPONENT
// =============================================================================

interface ComplianceTrendChartProps {
	tradeCompliance: TradeComplianceData[];
}

function ComplianceTrendChart({ tradeCompliance }: ComplianceTrendChartProps) {
	// Sort by exitTime and take last 20 trades
	const tradesWithExit = tradeCompliance.filter(
		(t): t is TradeComplianceData & { exitTime: Date | string } =>
			t.exitTime !== null,
	);
	const sortedTrades = [...tradesWithExit]
		.sort((a, b) => {
			const dateA = new Date(a.exitTime).getTime();
			const dateB = new Date(b.exitTime).getTime();
			return dateA - dateB;
		})
		.slice(-20);

	if (sortedTrades.length < 2) {
		return (
			<div className="flex h-24 items-center justify-center rounded border border-white/5 bg-white/2">
				<span className="font-mono text-[10px] text-muted-foreground">
					Need 2+ trades for trend chart
				</span>
			</div>
		);
	}

	// Chart dimensions
	const width = 100;
	const height = 60;
	const padding = { top: 8, right: 8, bottom: 8, left: 8 };
	const chartWidth = width - padding.left - padding.right;
	const chartHeight = height - padding.top - padding.bottom;

	// Normalize data (compliance is 0-100)
	const minY = 0;
	const maxY = 100;
	const points = sortedTrades.map((trade, i) => {
		const x = padding.left + (i / (sortedTrades.length - 1)) * chartWidth;
		const y =
			padding.top +
			chartHeight -
			((trade.compliance - minY) / (maxY - minY)) * chartHeight;
		return { x, y, compliance: trade.compliance };
	});

	// Build path
	const pathD = points
		.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
		.join(" ");

	// Calculate trend color based on recent performance
	const recentCompliance = points.slice(-3);
	const avgRecent =
		recentCompliance.reduce((sum, p) => sum + p.compliance, 0) /
		recentCompliance.length;
	const color =
		avgRecent >= 70 ? "#00ff88" : avgRecent >= 50 ? "#ffaa00" : "#ff3b3b";

	// Build area path for fill
	const firstPoint = points[0];
	const lastPoint = points[points.length - 1];
	if (!firstPoint || !lastPoint) {
		return null;
	}
	const areaD = `${pathD} L ${lastPoint.x} ${height - padding.bottom} L ${firstPoint.x} ${height - padding.bottom} Z`;

	return (
		<div className="space-y-2">
			<h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
				Compliance Trend (Last 20 Trades)
			</h3>
			<div className="rounded border border-white/5 bg-white/2 p-3">
				<svg
					aria-label="Compliance trend over time"
					className="w-full"
					preserveAspectRatio="none"
					role="img"
					style={{ height: height }}
					viewBox={`0 0 ${width} ${height}`}
				>
					<defs>
						<linearGradient
							id="complianceTrendGradient"
							x1="0%"
							x2="0%"
							y1="0%"
							y2="100%"
						>
							<stop offset="0%" stopColor={color} stopOpacity="0.3" />
							<stop offset="100%" stopColor={color} stopOpacity="0" />
						</linearGradient>
					</defs>

					{/* Reference lines */}
					<line
						opacity="0.1"
						stroke="white"
						x1={padding.left}
						x2={width - padding.right}
						y1={padding.top + chartHeight * 0.2}
						y2={padding.top + chartHeight * 0.2}
					/>
					<line
						opacity="0.1"
						stroke="white"
						x1={padding.left}
						x2={width - padding.right}
						y1={padding.top + chartHeight * 0.5}
						y2={padding.top + chartHeight * 0.5}
					/>

					{/* Area fill */}
					<path d={areaD} fill="url(#complianceTrendGradient)" />

					{/* Line */}
					<path
						d={pathD}
						fill="none"
						stroke={color}
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
					/>

					{/* End point */}
					<circle cx={lastPoint.x} cy={lastPoint.y} fill={color} r="3" />
				</svg>

				{/* Legend */}
				<div className="mt-2 flex items-center justify-between">
					<span className="font-mono text-[9px] text-muted-foreground">
						{sortedTrades.length} trades
					</span>
					<span className="font-mono text-[10px]" style={{ color }}>
						Latest: {lastPoint.compliance.toFixed(0)}%
					</span>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// RECENT TRADES LIST COMPONENT
// =============================================================================

interface RecentTradesListProps {
	tradeCompliance: TradeComplianceData[];
}

function RecentTradesList({ tradeCompliance }: RecentTradesListProps) {
	// Sort by exitTime (most recent first) and take last 5
	const tradesWithExit = tradeCompliance.filter(
		(t): t is TradeComplianceData & { exitTime: Date | string } =>
			t.exitTime !== null,
	);
	const recentTrades = [...tradesWithExit]
		.sort((a, b) => {
			const dateA = new Date(a.exitTime).getTime();
			const dateB = new Date(b.exitTime).getTime();
			return dateB - dateA;
		})
		.slice(0, 5);

	if (recentTrades.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			<h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
				Recent Trades
			</h3>
			<div className="space-y-1.5">
				{recentTrades.map((trade) => {
					const complianceColor = getComplianceColor(trade.compliance);
					const pnlColor = trade.pnl >= 0 ? "#00ff88" : "#ff3b3b";
					const exitDate = trade.exitTime
						? new Date(trade.exitTime).toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
							})
						: "—";

					return (
						<div
							className="flex items-center justify-between gap-3 rounded border border-white/5 bg-white/2 px-3 py-2"
							key={trade.tradeId}
						>
							<div className="flex items-center gap-3">
								<span className="font-mono text-xs">{trade.symbol}</span>
								<span className="font-mono text-[10px] text-muted-foreground">
									{exitDate}
								</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="font-mono text-xs" style={{ color: pnlColor }}>
									{trade.pnl >= 0 ? "+" : ""}$
									{Math.abs(trade.pnl).toLocaleString("en-US", {
										minimumFractionDigits: 0,
										maximumFractionDigits: 0,
									})}
								</span>
								<span
									className="rounded px-1.5 py-0.5 font-medium font-mono text-[10px]"
									style={{
										backgroundColor: `${complianceColor}15`,
										color: complianceColor,
									}}
								>
									{trade.checkedCount}/{trade.totalRules}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// =============================================================================
// IMPROVEMENT TIPS COMPONENT
// =============================================================================

interface ImprovementTipsProps {
	ruleCompliance: RuleComplianceData[];
}

function ImprovementTips({ ruleCompliance }: ImprovementTipsProps) {
	// Get rules with compliance < 70% sorted by lowest first
	const weakRules = [...ruleCompliance]
		.filter((r) => r.compliance < 70)
		.sort((a, b) => a.compliance - b.compliance)
		.slice(0, 3);

	if (weakRules.length === 0) {
		return (
			<div className="rounded border border-profit/20 bg-profit/5 p-4">
				<div className="flex items-center gap-2">
					<CheckCircle2 className="h-4 w-4 text-profit" />
					<span className="font-mono text-profit text-sm">
						Great job! All rules are above 70% compliance.
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
				Improvement Focus
			</h3>
			<div className="space-y-2">
				{weakRules.map((rule, index) => (
					<div
						className="rounded border border-white/5 bg-white/2 p-3"
						key={rule.ruleId}
					>
						<div className="flex items-start gap-2">
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-loss/20 font-mono text-[10px] text-loss">
								{index + 1}
							</span>
							<div className="flex-1">
								<p className="font-mono text-sm">{rule.ruleText}</p>
								<p className="mt-1 font-mono text-[10px] text-muted-foreground">
									Only followed in {rule.compliance.toFixed(0)}% of trades (
									{rule.checkedCount}/{rule.totalTrades})
								</p>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// =============================================================================
// COMPLIANCE GAUGE COMPONENT
// =============================================================================

interface ComplianceGaugeProps {
	compliance: number;
	totalTrades: number;
}

function ComplianceGauge({ compliance, totalTrades }: ComplianceGaugeProps) {
	const color = getComplianceColor(compliance);
	const label = getComplianceLabel(compliance);

	// Circle math
	const size = 160;
	const strokeWidth = 12;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = Math.min(Math.max(compliance, 0), 100) / 100;
	const strokeDashoffset = circumference * (1 - progress);

	return (
		<div className="flex flex-col items-center justify-center py-4">
			<div
				className="relative"
				style={{
					width: size,
					height: size,
					filter: `drop-shadow(0 0 16px ${color}25)`,
				}}
			>
				<svg
					aria-label={`Compliance: ${compliance.toFixed(0)}%`}
					className="-rotate-90"
					height={size}
					role="img"
					width={size}
				>
					{/* Background circle */}
					<circle
						cx={size / 2}
						cy={size / 2}
						fill="none"
						r={radius}
						stroke="rgba(255, 255, 255, 0.08)"
						strokeWidth={strokeWidth}
					/>
					{/* Progress arc */}
					<circle
						cx={size / 2}
						cy={size / 2}
						fill="none"
						r={radius}
						stroke={color}
						strokeDasharray={circumference}
						strokeDashoffset={strokeDashoffset}
						strokeLinecap="round"
						strokeWidth={strokeWidth}
						style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
					/>
				</svg>

				{/* Center content */}
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span
						className="font-bold font-mono text-3xl tracking-tight"
						style={{ color }}
					>
						{compliance.toFixed(0)}%
					</span>
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Compliance
					</span>
				</div>
			</div>

			{/* Label badge */}
			<div
				className="mt-3 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
				style={{
					backgroundColor: `${color}15`,
					color: color,
					border: `1px solid ${color}30`,
				}}
			>
				{label}
			</div>

			{/* Trades count */}
			<div className="mt-2 font-mono text-[10px] text-muted-foreground">
				Based on {totalTrades} {totalTrades === 1 ? "trade" : "trades"}
			</div>
		</div>
	);
}

// =============================================================================
// CATEGORY BREAKDOWN COMPONENT
// =============================================================================

interface CategoryBreakdownProps {
	ruleCompliance: RuleComplianceData[];
}

function CategoryBreakdown({ ruleCompliance }: CategoryBreakdownProps) {
	// Group rules by category and calculate average compliance
	const categoryStats = (["entry", "exit", "risk", "management"] as const).map(
		(category) => {
			const rules = ruleCompliance.filter((r) => r.category === category);
			const avgCompliance =
				rules.length > 0
					? rules.reduce((sum, r) => sum + r.compliance, 0) / rules.length
					: 0;

			return {
				category,
				label: CATEGORY_LABELS[category],
				color: CATEGORY_COLORS[category],
				compliance: avgCompliance,
				rulesCount: rules.length,
			};
		},
	);

	// Filter out categories with no rules
	const activeCategories = categoryStats.filter((c) => c.rulesCount > 0);

	if (activeCategories.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
				By Category
			</h3>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{activeCategories.map((cat) => (
					<div
						className="rounded border border-white/5 bg-white/2 p-3"
						key={cat.category}
					>
						<div className="flex items-center gap-2">
							<div
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: cat.color }}
							/>
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								{cat.label}
							</span>
						</div>
						<div
							className={cn(
								"mt-1 font-bold font-mono text-lg",
								cat.compliance >= 80
									? "text-profit"
									: cat.compliance >= 50
										? "text-yellow-500"
										: "text-loss",
							)}
						>
							{cat.compliance.toFixed(0)}%
						</div>
						<div className="font-mono text-[9px] text-muted-foreground">
							{cat.rulesCount} {cat.rulesCount === 1 ? "rule" : "rules"}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// =============================================================================
// RULE COMPLIANCE LIST COMPONENT
// =============================================================================

interface RuleComplianceListProps {
	ruleCompliance: RuleComplianceData[];
}

function RuleComplianceList({ ruleCompliance }: RuleComplianceListProps) {
	// Sort by compliance (lowest first to highlight problem areas)
	const sortedRules = [...ruleCompliance].sort(
		(a, b) => a.compliance - b.compliance,
	);

	if (sortedRules.length === 0) {
		return (
			<div className="py-8 text-center font-mono text-muted-foreground text-sm">
				No rules defined for this strategy
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
				Individual Rules
			</h3>
			<div className="space-y-2">
				{sortedRules.map((rule) => {
					const color = getComplianceColor(rule.compliance);
					return (
						<div
							className="flex items-center justify-between gap-3 rounded border border-white/5 bg-white/2 p-3"
							key={rule.ruleId}
						>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span
										className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase"
										style={{
											backgroundColor: `${CATEGORY_COLORS[rule.category]}15`,
											color: CATEGORY_COLORS[rule.category],
										}}
									>
										{CATEGORY_LABELS[rule.category]}
									</span>
									<span className="truncate font-mono text-sm">
										{rule.ruleText}
									</span>
								</div>
								<div className="mt-1 font-mono text-[10px] text-muted-foreground">
									{rule.checkedCount} of {rule.totalTrades} trades
								</div>
							</div>
							<div
								className="shrink-0 font-bold font-mono text-base"
								style={{ color }}
							>
								{rule.compliance.toFixed(0)}%
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// =============================================================================
// HIGHLIGHTS COMPONENT (Most Followed / Most Skipped)
// =============================================================================

interface HighlightsSectionProps {
	ruleCompliance: RuleComplianceData[];
}

function HighlightsSection({ ruleCompliance }: HighlightsSectionProps) {
	if (ruleCompliance.length === 0) {
		return null;
	}

	// Get top 3 most followed and most skipped
	const sorted = [...ruleCompliance].sort(
		(a, b) => b.compliance - a.compliance,
	);
	const mostFollowed = sorted.slice(0, 3).filter((r) => r.compliance >= 50);
	const mostSkipped = sorted
		.slice(-3)
		.reverse()
		.filter((r) => r.compliance < 80);

	if (mostFollowed.length === 0 && mostSkipped.length === 0) {
		return null;
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{/* Most Followed */}
			{mostFollowed.length > 0 && (
				<div className="space-y-2">
					<h3 className="flex items-center gap-2 font-mono text-[10px] text-profit uppercase tracking-widest">
						<CheckCircle2 className="h-3 w-3" />
						Most Followed
					</h3>
					<div className="space-y-1.5">
						{mostFollowed.map((rule) => (
							<div
								className="flex items-center gap-2 rounded border border-profit/20 bg-profit/5 px-3 py-2"
								key={rule.ruleId}
							>
								<span className="flex-1 truncate font-mono text-xs">
									{rule.ruleText}
								</span>
								<span className="shrink-0 font-bold font-mono text-profit text-xs">
									{rule.compliance.toFixed(0)}%
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Most Skipped */}
			{mostSkipped.length > 0 && (
				<div className="space-y-2">
					<h3 className="flex items-center gap-2 font-mono text-[10px] text-loss uppercase tracking-widest">
						<XCircle className="h-3 w-3" />
						Most Skipped
					</h3>
					<div className="space-y-1.5">
						{mostSkipped.map((rule) => (
							<div
								className="flex items-center gap-2 rounded border border-loss/20 bg-loss/5 px-3 py-2"
								key={rule.ruleId}
							>
								<span className="flex-1 truncate font-mono text-xs">
									{rule.ruleText}
								</span>
								<span className="shrink-0 font-bold font-mono text-loss text-xs">
									{rule.compliance.toFixed(0)}%
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Rules Compliance Panel - Shows overall and per-rule compliance statistics.
 * Features:
 * - Circular gauge for overall compliance percentage
 * - Compliance trend chart over time
 * - Category breakdown (Entry, Exit, Risk, Management)
 * - Recent trades list with compliance badges
 * - Improvement tips based on lowest compliance rules
 * - Individual rule compliance list sorted by compliance
 * - Most Followed and Most Skipped highlights
 */
export function RulesCompliancePanel({
	avgCompliance,
	totalTrades,
	ruleCompliance,
	tradeCompliance,
	className,
}: RulesCompliancePanelProps) {
	const hasData = totalTrades > 0;
	const hasTradeCompliance = tradeCompliance && tradeCompliance.length > 0;

	return (
		<div
			className={cn("space-y-6", className)}
			data-testid="rules-compliance-panel"
		>
			{/* Overall compliance gauge */}
			<ComplianceGauge
				compliance={hasData ? avgCompliance : 0}
				totalTrades={totalTrades}
			/>

			{/* No data message */}
			{!hasData && (
				<div className="py-4 text-center font-mono text-muted-foreground text-sm">
					No trades yet to analyze compliance
				</div>
			)}

			{/* Compliance trend chart */}
			{hasTradeCompliance && (
				<ComplianceTrendChart tradeCompliance={tradeCompliance} />
			)}

			{/* Category breakdown */}
			{hasData && <CategoryBreakdown ruleCompliance={ruleCompliance} />}

			{/* Recent trades list */}
			{hasTradeCompliance && (
				<RecentTradesList tradeCompliance={tradeCompliance} />
			)}

			{/* Improvement tips */}
			{hasData && ruleCompliance.length > 0 && (
				<ImprovementTips ruleCompliance={ruleCompliance} />
			)}

			{/* Highlights section */}
			{hasData && <HighlightsSection ruleCompliance={ruleCompliance} />}

			{/* Individual rules list */}
			<RuleComplianceList ruleCompliance={ruleCompliance} />
		</div>
	);
}
