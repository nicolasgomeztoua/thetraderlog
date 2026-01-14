"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface RiskParameters {
	positionSizing?: {
		method: "fixed" | "risk_percent" | "kelly";
		fixedSize?: number;
		riskPercent?: number;
		kellyFraction?: number;
	};
	maxRiskPerTrade?: {
		type: "dollars" | "percent";
		value: number;
	};
	dailyLossLimit?: {
		type: "dollars" | "percent";
		value: number;
	};
	maxConcurrentPositions?: number;
	minRRRatio?: number;
	targetRMultiples?: number[];
}

interface RiskConfigProps {
	value: RiskParameters | null;
	onChange: (value: RiskParameters | null) => void;
}

export function RiskConfig({ value, onChange }: RiskConfigProps) {
	const riskParams = value ?? {};

	const updateField = <K extends keyof RiskParameters>(
		field: K,
		fieldValue: RiskParameters[K],
	) => {
		onChange({ ...riskParams, [field]: fieldValue });
	};

	return (
		<div className="space-y-4 sm:space-y-6">
			{/* Position Sizing */}
			<div className="space-y-3">
				<h4 className="font-mono text-[10px] text-primary/80 uppercase tracking-wider sm:text-[11px]">
					Position Sizing
				</h4>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
					<div className="space-y-1">
						<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
							Method
						</span>
						<Select
							onValueChange={(v) =>
								updateField("positionSizing", {
									...riskParams.positionSizing,
									method: v as "fixed" | "risk_percent" | "kelly",
								})
							}
							value={riskParams.positionSizing?.method ?? ""}
						>
							<SelectTrigger className="min-h-[44px] font-mono text-sm sm:min-h-0">
								<SelectValue placeholder="Select method..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem className="min-h-[44px] sm:min-h-0" value="fixed">
									Fixed Size
								</SelectItem>
								<SelectItem
									className="min-h-[44px] sm:min-h-0"
									value="risk_percent"
								>
									Risk % of Account
								</SelectItem>
								<SelectItem className="min-h-[44px] sm:min-h-0" value="kelly">
									Kelly Criterion
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{riskParams.positionSizing?.method === "fixed" && (
						<div className="space-y-1">
							<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
								Size (lots/contracts)
							</span>
							<Input
								className="min-h-[44px] font-mono sm:min-h-0"
								inputMode="decimal"
								onChange={(e) =>
									updateField("positionSizing", {
										...riskParams.positionSizing,
										method: "fixed",
										fixedSize: parseFloat(e.target.value) || undefined,
									})
								}
								placeholder="1.0"
								step="0.01"
								type="number"
								value={riskParams.positionSizing?.fixedSize ?? ""}
							/>
						</div>
					)}

					{riskParams.positionSizing?.method === "risk_percent" && (
						<div className="space-y-1">
							<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
								Risk %
							</span>
							<Input
								className="min-h-[44px] font-mono sm:min-h-0"
								inputMode="decimal"
								onChange={(e) =>
									updateField("positionSizing", {
										...riskParams.positionSizing,
										method: "risk_percent",
										riskPercent: parseFloat(e.target.value) || undefined,
									})
								}
								placeholder="1.0"
								step="0.1"
								type="number"
								value={riskParams.positionSizing?.riskPercent ?? ""}
							/>
						</div>
					)}

					{riskParams.positionSizing?.method === "kelly" && (
						<div className="space-y-1">
							<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
								Kelly Fraction
							</span>
							<Input
								className="min-h-[44px] font-mono sm:min-h-0"
								inputMode="decimal"
								onChange={(e) =>
									updateField("positionSizing", {
										...riskParams.positionSizing,
										method: "kelly",
										kellyFraction: parseFloat(e.target.value) || undefined,
									})
								}
								placeholder="0.25"
								step="0.01"
								type="number"
								value={riskParams.positionSizing?.kellyFraction ?? ""}
							/>
						</div>
					)}
				</div>
			</div>

			{/* Max Risk Per Trade */}
			<div className="space-y-3">
				<h4 className="font-mono text-[10px] text-primary/80 uppercase tracking-wider sm:text-[11px]">
					Max Risk Per Trade
				</h4>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
					<div className="space-y-1">
						<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
							Type
						</span>
						<Select
							onValueChange={(v) =>
								updateField("maxRiskPerTrade", {
									type: v as "dollars" | "percent",
									value: riskParams.maxRiskPerTrade?.value ?? 0,
								})
							}
							value={riskParams.maxRiskPerTrade?.type ?? ""}
						>
							<SelectTrigger className="min-h-[44px] font-mono text-sm sm:min-h-0">
								<SelectValue placeholder="Select type..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem className="min-h-[44px] sm:min-h-0" value="dollars">
									Dollars ($)
								</SelectItem>
								<SelectItem className="min-h-[44px] sm:min-h-0" value="percent">
									Percent (%)
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1">
						<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
							Value
						</span>
						<Input
							className="min-h-[44px] font-mono sm:min-h-0"
							inputMode="decimal"
							onChange={(e) =>
								updateField("maxRiskPerTrade", {
									type: riskParams.maxRiskPerTrade?.type ?? "dollars",
									value: parseFloat(e.target.value) || 0,
								})
							}
							placeholder="100"
							step="1"
							type="number"
							value={riskParams.maxRiskPerTrade?.value ?? ""}
						/>
					</div>
				</div>
			</div>

			{/* Daily Loss Limit */}
			<div className="space-y-3">
				<h4 className="font-mono text-[10px] text-primary/80 uppercase tracking-wider sm:text-[11px]">
					Daily Loss Limit
				</h4>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
					<div className="space-y-1">
						<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
							Type
						</span>
						<Select
							onValueChange={(v) =>
								updateField("dailyLossLimit", {
									type: v as "dollars" | "percent",
									value: riskParams.dailyLossLimit?.value ?? 0,
								})
							}
							value={riskParams.dailyLossLimit?.type ?? ""}
						>
							<SelectTrigger className="min-h-[44px] font-mono text-sm sm:min-h-0">
								<SelectValue placeholder="Select type..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem className="min-h-[44px] sm:min-h-0" value="dollars">
									Dollars ($)
								</SelectItem>
								<SelectItem className="min-h-[44px] sm:min-h-0" value="percent">
									Percent (%)
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1">
						<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
							Value
						</span>
						<Input
							className="min-h-[44px] font-mono sm:min-h-0"
							inputMode="decimal"
							onChange={(e) =>
								updateField("dailyLossLimit", {
									type: riskParams.dailyLossLimit?.type ?? "dollars",
									value: parseFloat(e.target.value) || 0,
								})
							}
							placeholder="500"
							step="1"
							type="number"
							value={riskParams.dailyLossLimit?.value ?? ""}
						/>
					</div>
				</div>
			</div>

			{/* Other Settings */}
			<div className="space-y-3">
				<h4 className="font-mono text-[10px] text-primary/80 uppercase tracking-wider sm:text-[11px]">
					Other Settings
				</h4>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
					<div className="space-y-1">
						<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
							Max Concurrent Positions
						</span>
						<Input
							className="min-h-[44px] font-mono sm:min-h-0"
							inputMode="numeric"
							onChange={(e) =>
								updateField(
									"maxConcurrentPositions",
									parseInt(e.target.value, 10) || undefined,
								)
							}
							placeholder="3"
							step="1"
							type="number"
							value={riskParams.maxConcurrentPositions ?? ""}
						/>
					</div>
					<div className="space-y-1">
						<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
							Min R:R Ratio
						</span>
						<Input
							className="min-h-[44px] font-mono sm:min-h-0"
							inputMode="decimal"
							onChange={(e) =>
								updateField(
									"minRRRatio",
									parseFloat(e.target.value) || undefined,
								)
							}
							placeholder="2.0"
							step="0.1"
							type="number"
							value={riskParams.minRRRatio ?? ""}
						/>
					</div>
				</div>
			</div>

			{/* Target R Multiples */}
			<div className="space-y-3">
				<h4 className="font-mono text-[10px] text-primary/80 uppercase tracking-wider sm:text-[11px]">
					Target R Multiples
				</h4>
				<div className="flex flex-wrap gap-2">
					{(riskParams.targetRMultiples ?? []).map((r) => (
						<div
							className="flex min-h-[36px] items-center gap-1 rounded border border-white/10 bg-white/2 px-2 py-1 sm:min-h-0"
							key={r}
						>
							<span className="font-mono text-sm">{r}R</span>
							<button
								className="min-h-[24px] min-w-[24px] text-muted-foreground hover:text-loss sm:min-h-0 sm:min-w-0"
								onClick={() => {
									const newMultiples = (
										riskParams.targetRMultiples ?? []
									).filter((m) => m !== r);
									updateField(
										"targetRMultiples",
										newMultiples.length > 0 ? newMultiples : undefined,
									);
								}}
								type="button"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
					<Button
						className="min-h-[36px] font-mono text-xs sm:h-7 sm:min-h-0"
						onClick={() => {
							const newValue = prompt("Enter R multiple (e.g., 2):");
							if (newValue) {
								const num = parseFloat(newValue);
								if (!Number.isNaN(num)) {
									updateField("targetRMultiples", [
										...(riskParams.targetRMultiples ?? []),
										num,
									]);
								}
							}
						}}
						size="sm"
						type="button"
						variant="outline"
					>
						<Plus className="mr-1 h-3 w-3" />
						Add Target
					</Button>
				</div>
			</div>
		</div>
	);
}
