"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
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
							<NumberInput
								className="min-h-[44px] font-mono sm:min-h-0"
								min={0}
								onChange={(val) =>
									updateField("positionSizing", {
										...riskParams.positionSizing,
										method: "fixed",
										fixedSize: val ?? undefined,
									})
								}
								placeholder="1.0"
								precision={2}
								step={0.01}
								value={riskParams.positionSizing?.fixedSize ?? null}
							/>
						</div>
					)}

					{riskParams.positionSizing?.method === "risk_percent" && (
						<div className="space-y-1">
							<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
								Risk %
							</span>
							<NumberInput
								className="min-h-[44px] font-mono sm:min-h-0"
								max={100}
								min={0}
								onChange={(val) =>
									updateField("positionSizing", {
										...riskParams.positionSizing,
										method: "risk_percent",
										riskPercent: val ?? undefined,
									})
								}
								placeholder="1.0"
								precision={1}
								step={0.1}
								suffix="%"
								value={riskParams.positionSizing?.riskPercent ?? null}
							/>
						</div>
					)}

					{riskParams.positionSizing?.method === "kelly" && (
						<div className="space-y-1">
							<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
								Kelly Fraction
							</span>
							<NumberInput
								className="min-h-[44px] font-mono sm:min-h-0"
								max={1}
								min={0}
								onChange={(val) =>
									updateField("positionSizing", {
										...riskParams.positionSizing,
										method: "kelly",
										kellyFraction: val ?? undefined,
									})
								}
								placeholder="0.25"
								precision={2}
								step={0.01}
								value={riskParams.positionSizing?.kellyFraction ?? null}
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
						<NumberInput
							className="min-h-[44px] font-mono sm:min-h-0"
							min={0}
							onChange={(val) =>
								updateField("maxRiskPerTrade", {
									type: riskParams.maxRiskPerTrade?.type ?? "dollars",
									value: val ?? 0,
								})
							}
							placeholder="100"
							precision={2}
							prefix={
								riskParams.maxRiskPerTrade?.type === "dollars" ? "$" : undefined
							}
							step={1}
							suffix={
								riskParams.maxRiskPerTrade?.type === "percent" ? "%" : undefined
							}
							value={riskParams.maxRiskPerTrade?.value ?? null}
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
						<NumberInput
							className="min-h-[44px] font-mono sm:min-h-0"
							min={0}
							onChange={(val) =>
								updateField("dailyLossLimit", {
									type: riskParams.dailyLossLimit?.type ?? "dollars",
									value: val ?? 0,
								})
							}
							placeholder="500"
							precision={2}
							prefix={
								riskParams.dailyLossLimit?.type === "dollars" ? "$" : undefined
							}
							step={1}
							suffix={
								riskParams.dailyLossLimit?.type === "percent" ? "%" : undefined
							}
							value={riskParams.dailyLossLimit?.value ?? null}
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
						<NumberInput
							className="min-h-[44px] font-mono sm:min-h-0"
							min={0}
							onChange={(val) =>
								updateField("maxConcurrentPositions", val ?? undefined)
							}
							placeholder="3"
							precision={0}
							step={1}
							value={riskParams.maxConcurrentPositions ?? null}
						/>
					</div>
					<div className="space-y-1">
						<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
							Min R:R Ratio
						</span>
						<NumberInput
							className="min-h-[44px] font-mono sm:min-h-0"
							min={0}
							onChange={(val) => updateField("minRRRatio", val ?? undefined)}
							placeholder="2.0"
							precision={1}
							step={0.1}
							value={riskParams.minRRRatio ?? null}
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
