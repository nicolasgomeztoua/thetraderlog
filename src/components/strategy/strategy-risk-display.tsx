"use client";

import { ShieldAlert } from "lucide-react";
import type { RiskParameters } from "./risk-config";

interface StrategyRiskDisplayProps {
	riskParameters: RiskParameters | null;
}

interface RiskValueProps {
	label: string;
	value: string | null;
	testId: string;
}

function RiskValue({ label, value, testId }: RiskValueProps) {
	return (
		<div
			className="flex flex-col gap-0.5 border-white/5 border-b p-2.5 odd:border-r sm:gap-1 sm:border-r sm:border-b-0 sm:p-4 sm:last:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0"
			data-testid={testId}
		>
			<span className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
				{label}
			</span>
			<span className="font-bold font-mono text-base sm:text-xl">
				{value ?? "—"}
			</span>
		</div>
	);
}

function formatPositionSizing(
	positionSizing: RiskParameters["positionSizing"],
): string | null {
	if (!positionSizing?.method) return null;

	switch (positionSizing.method) {
		case "fixed":
			return positionSizing.fixedSize
				? `${positionSizing.fixedSize} lot${positionSizing.fixedSize !== 1 ? "s" : ""}`
				: "Fixed";
		case "risk_percent":
			return positionSizing.riskPercent
				? `${positionSizing.riskPercent}%`
				: "Risk %";
		case "kelly":
			return positionSizing.kellyFraction
				? `${(positionSizing.kellyFraction * 100).toFixed(0)}% Kelly`
				: "Kelly";
		default:
			return null;
	}
}

function formatMaxRiskPerTrade(
	maxRiskPerTrade: RiskParameters["maxRiskPerTrade"],
): string | null {
	if (!maxRiskPerTrade?.value) return null;
	return maxRiskPerTrade.type === "percent"
		? `${maxRiskPerTrade.value}%`
		: `$${maxRiskPerTrade.value.toLocaleString()}`;
}

function formatDailyLossLimit(
	dailyLossLimit: RiskParameters["dailyLossLimit"],
): string | null {
	if (!dailyLossLimit?.value) return null;
	return dailyLossLimit.type === "percent"
		? `${dailyLossLimit.value}%`
		: `$${dailyLossLimit.value.toLocaleString()}`;
}

function formatMaxConcurrentPositions(
	maxConcurrentPositions: number | undefined,
): string | null {
	if (maxConcurrentPositions === undefined) return null;
	return maxConcurrentPositions.toString();
}

function formatMinRRRatio(minRRRatio: number | undefined): string | null {
	if (minRRRatio === undefined) return null;
	return `${minRRRatio.toFixed(1)}:1`;
}

export function StrategyRiskDisplay({
	riskParameters,
}: StrategyRiskDisplayProps) {
	// Check if risk parameters are configured
	const hasRiskParams =
		riskParameters &&
		(riskParameters.positionSizing?.method ||
			riskParameters.maxRiskPerTrade?.value ||
			riskParameters.dailyLossLimit?.value ||
			riskParameters.maxConcurrentPositions !== undefined ||
			riskParameters.minRRRatio !== undefined);

	if (!hasRiskParams) {
		return (
			<div
				className="overflow-hidden rounded border border-white/10 border-dashed"
				data-testid="strategy-risk-display-empty"
			>
				{/* Terminal window chrome header */}
				<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-3 py-1.5 sm:px-4 sm:py-2">
					<div className="flex items-center gap-1 sm:gap-1.5">
						<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
						<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
						<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
					</div>
					<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
						risk.config
					</span>
					<div className="w-10 sm:w-14" />
				</div>

				{/* Section header with command prompt */}
				<div className="flex items-center gap-1.5 border-white/5 border-b bg-white/2 px-3 py-2 sm:gap-2 sm:px-4 sm:py-3">
					<span className="font-mono text-[10px] text-breakeven sm:text-xs">
						{">"}
					</span>
					<ShieldAlert className="h-3.5 w-3.5 text-breakeven sm:h-4 sm:w-4" />
					<span className="font-mono text-[10px] text-breakeven uppercase tracking-wider sm:text-xs">
						Risk Parameters
					</span>
				</div>

				{/* Empty state */}
				<div className="p-6 text-center sm:p-8">
					<p className="font-mono text-[10px] text-muted-foreground/60 sm:text-xs">
						Risk parameters not configured
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className="overflow-hidden rounded border border-white/10"
			data-testid="strategy-risk-display"
		>
			{/* Terminal window chrome header */}
			<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-3 py-1.5 sm:px-4 sm:py-2">
				<div className="flex items-center gap-1 sm:gap-1.5">
					<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
					<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
					<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
				</div>
				<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
					risk.config
				</span>
				<div className="w-10 sm:w-14" />
			</div>

			{/* Section header with command prompt */}
			<div className="flex items-center gap-1.5 border-white/5 border-b bg-white/2 px-3 py-2 sm:gap-2 sm:px-4 sm:py-3">
				<span className="font-mono text-[10px] text-breakeven sm:text-xs">
					{">"}
				</span>
				<ShieldAlert className="h-3.5 w-3.5 text-breakeven sm:h-4 sm:w-4" />
				<span className="font-mono text-[10px] text-breakeven uppercase tracking-wider sm:text-xs">
					Risk Parameters
				</span>
			</div>

			{/* Risk values grid */}
			<div className="grid grid-cols-2 sm:grid-cols-5">
				<RiskValue
					label="Position Sizing"
					testId="strategy-risk-position-sizing"
					value={formatPositionSizing(riskParameters.positionSizing)}
				/>
				<RiskValue
					label="Max Risk/Trade"
					testId="strategy-risk-max-risk"
					value={formatMaxRiskPerTrade(riskParameters.maxRiskPerTrade)}
				/>
				<RiskValue
					label="Daily Loss Limit"
					testId="strategy-risk-daily-loss"
					value={formatDailyLossLimit(riskParameters.dailyLossLimit)}
				/>
				<RiskValue
					label="Max Positions"
					testId="strategy-risk-max-positions"
					value={formatMaxConcurrentPositions(
						riskParameters.maxConcurrentPositions,
					)}
				/>
				<RiskValue
					label="Min R:R Ratio"
					testId="strategy-risk-min-rr"
					value={formatMinRRRatio(riskParameters.minRRRatio)}
				/>
			</div>
		</div>
	);
}
