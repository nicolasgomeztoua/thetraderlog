"use client";

import { CheckCircle, ClipboardList, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { RISK_TYPES } from "@/lib/constants";
import { cn } from "@/lib/shared";
import type { RiskParameters } from "../risk-config";
import type { ScalingRules } from "../scaling-config";
import type { TrailingRules } from "../trailing-config";
import { useWizard } from "./wizard-container";

/**
 * Step 3 - Risk Management
 *
 * Configures risk parameters and management rules:
 * - Auto-validated parameters (checked automatically against trades)
 * - Conditional checklist parameters (show as checklist when R thresholds hit)
 */
export function StepRisk() {
	const { data, updateData, setCanProceed } = useWizard();
	const componentId = useId();

	// Get current values or defaults
	const riskParameters: RiskParameters = data.riskParameters ?? {};
	const trailingRules: TrailingRules = data.trailingRules ?? {};
	const scalingRules: ScalingRules = data.scalingRules ?? {};

	// All fields are optional, so we can always proceed
	useEffect(() => {
		setCanProceed(true);
	}, [setCanProceed]);

	// Helper to update risk parameters
	function updateRiskParam<K extends keyof RiskParameters>(
		field: K,
		value: RiskParameters[K],
	) {
		const updated = { ...riskParameters, [field]: value };
		// Remove undefined values
		if (value === undefined) {
			delete updated[field];
		}
		updateData({
			riskParameters: Object.keys(updated).length > 0 ? updated : null,
		});
	}

	// Helper to update trailing rules
	function updateTrailingRules(updates: Partial<TrailingRules>) {
		const updated = { ...trailingRules, ...updates };
		// Remove undefined/null values
		Object.keys(updated).forEach((key) => {
			const k = key as keyof TrailingRules;
			if (updated[k] === undefined || updated[k] === null) {
				delete updated[k];
			}
		});
		updateData({
			trailingRules: Object.keys(updated).length > 0 ? updated : null,
		});
	}

	// Helper to update scaling rules
	function updateScalingRules(updates: Partial<ScalingRules>) {
		const updated = { ...scalingRules, ...updates };
		// Remove undefined/null values
		Object.keys(updated).forEach((key) => {
			const k = key as keyof ScalingRules;
			if (updated[k] === undefined || updated[k] === null) {
				delete updated[k];
			}
		});
		updateData({
			scalingRules: Object.keys(updated).length > 0 ? updated : null,
		});
	}

	// Move to Breakeven handlers
	const hasBreakeven = !!trailingRules.moveToBreakeven;

	function toggleBreakeven(enabled: boolean) {
		if (enabled) {
			updateTrailingRules({
				moveToBreakeven: { triggerR: 1, offsetTicks: 0 },
			});
		} else {
			const { moveToBreakeven: _removed, ...rest } = trailingRules;
			updateData({
				trailingRules: Object.keys(rest).length > 0 ? rest : null,
			});
		}
	}

	function updateBreakeven(field: "triggerR" | "offsetTicks", value: number) {
		const currentBreakeven = trailingRules.moveToBreakeven ?? { triggerR: 1 };
		updateTrailingRules({
			moveToBreakeven: {
				...currentBreakeven,
				[field]: value,
			},
		});
	}

	// Trail Stop handlers
	function addTrailStop() {
		updateTrailingRules({
			trailStops: [
				...(trailingRules.trailStops ?? []),
				{ triggerR: 1.5, method: "fixed_ticks" as const, value: 10 },
			],
		});
	}

	function updateTrailStop(
		idx: number,
		field: "triggerR" | "method" | "value",
		value: number | string,
	) {
		const newTrailStops = [...(trailingRules.trailStops ?? [])];
		const existing = newTrailStops[idx] ?? {
			triggerR: 1,
			method: "fixed_ticks" as const,
			value: 10,
		};
		newTrailStops[idx] = { ...existing, [field]: value };
		updateTrailingRules({ trailStops: newTrailStops });
	}

	function removeTrailStop(idx: number) {
		const newTrailStops = [...(trailingRules.trailStops ?? [])];
		newTrailStops.splice(idx, 1);
		updateTrailingRules({
			trailStops: newTrailStops.length > 0 ? newTrailStops : undefined,
		});
	}

	// Scale Out handlers
	function addScaleOut() {
		updateScalingRules({
			scaleOut: [
				...(scalingRules.scaleOut ?? []),
				{ trigger: "1", sizePercent: 50 },
			],
		});
	}

	function updateScaleOut(
		idx: number,
		field: "trigger" | "sizePercent",
		value: string | number,
	) {
		const newScaleOut = [...(scalingRules.scaleOut ?? [])];
		const existing = newScaleOut[idx] ?? { trigger: "", sizePercent: 0 };
		newScaleOut[idx] = { ...existing, [field]: value };
		updateScalingRules({ scaleOut: newScaleOut });
	}

	function removeScaleOut(idx: number) {
		const newScaleOut = [...(scalingRules.scaleOut ?? [])];
		newScaleOut.splice(idx, 1);
		updateScalingRules({
			scaleOut: newScaleOut.length > 0 ? newScaleOut : undefined,
		});
	}

	// Target R Multiples handlers
	function addTargetR(value: number) {
		const currentTargets = riskParameters.targetRMultiples ?? [];
		if (!currentTargets.includes(value)) {
			updateRiskParam(
				"targetRMultiples",
				[...currentTargets, value].sort((a, b) => a - b),
			);
		}
	}

	function removeTargetR(value: number) {
		const newTargets = (riskParameters.targetRMultiples ?? []).filter(
			(r) => r !== value,
		);
		updateRiskParam(
			"targetRMultiples",
			newTargets.length > 0 ? newTargets : undefined,
		);
	}

	return (
		<div className="space-y-8" data-testid="wizard-step-risk">
			{/* Auto-Validated Parameters Section */}
			<section className="space-y-4">
				<div className="flex items-center gap-2">
					<div className="flex h-6 w-6 items-center justify-center rounded-full bg-profit/20">
						<CheckCircle className="h-4 w-4 text-profit" />
					</div>
					<h3 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Auto-Checked Parameters
					</h3>
				</div>
				<p className="font-mono text-[10px] text-muted-foreground/60">
					These parameters are automatically validated against your trades.
					You&apos;ll see pass/fail indicators on each trade.
				</p>

				<div className="space-y-6 rounded border border-white/5 bg-white/2 p-4">
					{/* Min R:R Ratio */}
					<div className="space-y-1.5" data-testid="wizard-risk-min-rr">
						<NumberInput
							allowDecimals
							decimalPlaces={2}
							label="Min R:R Ratio"
							min={0.1}
							onChange={(value) =>
								updateRiskParam("minRRRatio", value ?? undefined)
							}
							placeholder="2.0"
							suffix="R"
							value={riskParameters.minRRRatio ?? null}
						/>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							Minimum risk-to-reward ratio required before entering a trade.
						</p>
					</div>

					{/* Max Risk Per Trade */}
					<div className="space-y-1.5" data-testid="wizard-risk-max-risk">
						<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
							Max Risk Per Trade
						</span>
						<div className="grid grid-cols-2 gap-3">
							<Select
								onValueChange={(v) =>
									updateRiskParam("maxRiskPerTrade", {
										type: v as "dollars" | "percent",
										value: riskParameters.maxRiskPerTrade?.value ?? 0,
									})
								}
								value={riskParameters.maxRiskPerTrade?.type ?? ""}
							>
								<SelectTrigger
									className="font-mono text-sm"
									data-testid="wizard-risk-max-risk-type"
								>
									<SelectValue placeholder="Type..." />
								</SelectTrigger>
								<SelectContent>
									{RISK_TYPES.map((type) => (
										<SelectItem key={type.value} value={type.value}>
											{type.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<NumberInput
								allowDecimals={
									riskParameters.maxRiskPerTrade?.type === "percent"
								}
								decimalPlaces={
									riskParameters.maxRiskPerTrade?.type === "percent" ? 2 : 0
								}
								inputClassName="text-sm"
								min={0}
								onChange={(value) =>
									updateRiskParam("maxRiskPerTrade", {
										type: riskParameters.maxRiskPerTrade?.type ?? "dollars",
										value: value ?? 0,
									})
								}
								placeholder={
									riskParameters.maxRiskPerTrade?.type === "percent"
										? "1.0"
										: "100"
								}
								suffix={
									riskParameters.maxRiskPerTrade?.type === "percent" ? "%" : "$"
								}
								value={riskParameters.maxRiskPerTrade?.value ?? null}
							/>
						</div>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							Maximum risk allowed per trade (checked against actual trade
							risk).
						</p>
					</div>

					{/* Daily Loss Limit */}
					<div className="space-y-1.5" data-testid="wizard-risk-daily-loss">
						<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
							Daily Loss Limit
						</span>
						<div className="grid grid-cols-2 gap-3">
							<Select
								onValueChange={(v) =>
									updateRiskParam("dailyLossLimit", {
										type: v as "dollars" | "percent",
										value: riskParameters.dailyLossLimit?.value ?? 0,
									})
								}
								value={riskParameters.dailyLossLimit?.type ?? ""}
							>
								<SelectTrigger
									className="font-mono text-sm"
									data-testid="wizard-risk-daily-loss-type"
								>
									<SelectValue placeholder="Type..." />
								</SelectTrigger>
								<SelectContent>
									{RISK_TYPES.map((type) => (
										<SelectItem key={type.value} value={type.value}>
											{type.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<NumberInput
								allowDecimals={
									riskParameters.dailyLossLimit?.type === "percent"
								}
								decimalPlaces={
									riskParameters.dailyLossLimit?.type === "percent" ? 2 : 0
								}
								inputClassName="text-sm"
								min={0}
								onChange={(value) =>
									updateRiskParam("dailyLossLimit", {
										type: riskParameters.dailyLossLimit?.type ?? "dollars",
										value: value ?? 0,
									})
								}
								placeholder={
									riskParameters.dailyLossLimit?.type === "percent"
										? "2.0"
										: "500"
								}
								suffix={
									riskParameters.dailyLossLimit?.type === "percent" ? "%" : "$"
								}
								value={riskParameters.dailyLossLimit?.value ?? null}
							/>
						</div>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							Maximum cumulative loss allowed per day before stopping trading.
						</p>
					</div>

					{/* Max Concurrent Positions */}
					<div className="space-y-1.5" data-testid="wizard-risk-max-positions">
						<NumberInput
							allowDecimals={false}
							label="Max Concurrent Positions"
							min={1}
							onChange={(value) =>
								updateRiskParam("maxConcurrentPositions", value ?? undefined)
							}
							placeholder="3"
							value={riskParameters.maxConcurrentPositions ?? null}
						/>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							Maximum number of open positions allowed at any time.
						</p>
					</div>
				</div>
			</section>

			{/* Conditional Checklist Parameters Section */}
			<section className="space-y-4">
				<div className="flex items-center gap-2">
					<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
						<ClipboardList className="h-4 w-4 text-primary" />
					</div>
					<h3 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Conditional Checklist Rules
					</h3>
				</div>
				<p className="font-mono text-[10px] text-muted-foreground/60">
					These rules appear as checklist items when your trade hits the
					specified R threshold. You&apos;ll manually confirm you followed the
					rule.
				</p>

				<div className="space-y-6 rounded border border-white/5 bg-white/2 p-4">
					{/* Move to Breakeven */}
					<div className="space-y-3" data-testid="wizard-risk-breakeven">
						<div className="flex items-center gap-3">
							<Checkbox
								checked={hasBreakeven}
								className="h-5 w-5 sm:h-4 sm:w-4"
								data-testid="wizard-risk-breakeven-toggle"
								id={`${componentId}-breakeven-toggle`}
								onCheckedChange={(checked) => toggleBreakeven(checked === true)}
							/>
							<label
								className="cursor-pointer font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest"
								htmlFor={`${componentId}-breakeven-toggle`}
							>
								Move to Breakeven
							</label>
						</div>

						{hasBreakeven && (
							<div className="ml-0 grid grid-cols-2 gap-3 sm:ml-7">
								<NumberInput
									allowDecimals
									decimalPlaces={1}
									label="Trigger at R"
									min={0.1}
									onChange={(value) => updateBreakeven("triggerR", value ?? 1)}
									placeholder="1.0"
									suffix="R"
									value={trailingRules.moveToBreakeven?.triggerR ?? null}
								/>
								<NumberInput
									allowDecimals={false}
									label="Offset (ticks)"
									min={0}
									onChange={(value) =>
										updateBreakeven("offsetTicks", value ?? 0)
									}
									placeholder="0"
									value={trailingRules.moveToBreakeven?.offsetTicks ?? null}
								/>
							</div>
						)}
						<p className="font-mono text-[10px] text-muted-foreground/60">
							When trade reaches trigger R, checklist will ask if you moved stop
							to breakeven.
						</p>
					</div>

					{/* Trail Stops */}
					<div className="space-y-3" data-testid="wizard-risk-trail-stops">
						<div className="flex items-center justify-between">
							<span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
								Trail Stop Rules
							</span>
							<Button
								className="h-7 font-mono text-[10px] uppercase tracking-wider"
								data-testid="wizard-risk-trail-stops-add"
								onClick={addTrailStop}
								size="sm"
								type="button"
								variant="ghost"
							>
								<Plus className="mr-1 h-3 w-3" />
								Add
							</Button>
						</div>

						{(trailingRules.trailStops ?? []).length === 0 ? (
							<p className="font-mono text-[10px] text-muted-foreground/40 italic">
								No trail stop rules defined
							</p>
						) : (
							<ul className="space-y-2">
								{(trailingRules.trailStops ?? []).map((rule, idx) => (
									<li
										className="flex items-end gap-2 rounded border border-white/5 bg-white/3 p-3"
										data-testid={`wizard-risk-trail-stop-${idx}`}
										key={`trail-${rule.triggerR}-${idx}`}
									>
										<NumberInput
											allowDecimals
											className="w-20"
											decimalPlaces={1}
											inputClassName="text-sm"
											label="At R"
											min={0.1}
											onChange={(value) =>
												updateTrailStop(idx, "triggerR", value ?? 1)
											}
											value={rule.triggerR}
										/>
										<div className="flex-1 space-y-1.5">
											<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
												Method
											</span>
											<Select
												onValueChange={(v) => updateTrailStop(idx, "method", v)}
												value={rule.method}
											>
												<SelectTrigger className="h-9 font-mono text-sm">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="fixed_ticks">
														Fixed Ticks
													</SelectItem>
													<SelectItem value="atr_multiple">
														ATR Multiple
													</SelectItem>
													<SelectItem value="swing_low">
														Swing Low/High
													</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<NumberInput
											allowDecimals={rule.method === "atr_multiple"}
											className="w-20"
											decimalPlaces={rule.method === "atr_multiple" ? 1 : 0}
											inputClassName="text-sm"
											label="Value"
											min={0}
											onChange={(value) =>
												updateTrailStop(idx, "value", value ?? 0)
											}
											value={rule.value}
										/>
										<Button
											aria-label="Remove trail stop rule"
											className="h-9 w-9 shrink-0 text-muted-foreground hover:text-loss"
											data-testid={`wizard-risk-trail-stop-delete-${idx}`}
											onClick={() => removeTrailStop(idx)}
											size="icon"
											type="button"
											variant="ghost"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</li>
								))}
							</ul>
						)}
						<p className="font-mono text-[10px] text-muted-foreground/60">
							At each R threshold, checklist will ask if you trailed your stop.
						</p>
					</div>

					{/* Scale Out Rules */}
					<div className="space-y-3" data-testid="wizard-risk-scale-out">
						<div className="flex items-center justify-between">
							<span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
								Scale Out Rules
							</span>
							<Button
								className="h-7 font-mono text-[10px] uppercase tracking-wider"
								data-testid="wizard-risk-scale-out-add"
								onClick={addScaleOut}
								size="sm"
								type="button"
								variant="ghost"
							>
								<Plus className="mr-1 h-3 w-3" />
								Add
							</Button>
						</div>

						{(scalingRules.scaleOut ?? []).length === 0 ? (
							<p className="font-mono text-[10px] text-muted-foreground/40 italic">
								No scale out rules defined
							</p>
						) : (
							<ul className="space-y-2">
								{(scalingRules.scaleOut ?? []).map((rule, idx) => (
									<li
										className="flex items-end gap-2 rounded border border-white/5 bg-white/3 p-3"
										data-testid={`wizard-risk-scale-out-${idx}`}
										key={`scaleout-${rule.trigger || idx}`}
									>
										<NumberInput
											allowDecimals
											className="w-20"
											decimalPlaces={1}
											inputClassName="text-sm"
											label="At R"
											min={0.1}
											onChange={(value) =>
												updateScaleOut(idx, "trigger", String(value ?? ""))
											}
											value={rule.trigger ? parseFloat(rule.trigger) : null}
										/>
										<NumberInput
											allowDecimals={false}
											className="flex-1"
											inputClassName="text-sm"
											label="Take % off"
											max={100}
											min={1}
											onChange={(value) =>
												updateScaleOut(idx, "sizePercent", value ?? 0)
											}
											suffix="%"
											value={rule.sizePercent}
										/>
										<Button
											aria-label="Remove scale out rule"
											className="h-9 w-9 shrink-0 text-muted-foreground hover:text-loss"
											data-testid={`wizard-risk-scale-out-delete-${idx}`}
											onClick={() => removeScaleOut(idx)}
											size="icon"
											type="button"
											variant="ghost"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</li>
								))}
							</ul>
						)}
						<p className="font-mono text-[10px] text-muted-foreground/60">
							At each R threshold, checklist will ask if you scaled out the
							specified percentage.
						</p>
					</div>

					{/* Target R Multiples */}
					<div className="space-y-3" data-testid="wizard-risk-target-multiples">
						<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
							Target R Multiples
						</span>
						<div className="flex flex-wrap gap-2">
							{(riskParameters.targetRMultiples ?? []).map((r) => (
								<div
									className={cn(
										"flex h-8 items-center gap-1 rounded border border-white/10 bg-white/2 px-2",
										"font-mono text-sm",
									)}
									data-testid={`wizard-risk-target-${r}`}
									key={r}
								>
									<span>{r}R</span>
									<button
										aria-label={`Remove ${r}R target`}
										className="text-muted-foreground hover:text-loss"
										onClick={() => removeTargetR(r)}
										type="button"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							))}
							<QuickAddTargetR onAdd={addTargetR} />
						</div>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							Track which R targets you hit. Shows in trade compliance display.
						</p>
					</div>
				</div>
			</section>
		</div>
	);
}

/**
 * Quick add component for target R multiples
 */
function QuickAddTargetR({ onAdd }: { onAdd: (value: number) => void }) {
	const commonTargets = [1, 2, 3, 4, 5];

	return (
		<div className="flex items-center gap-1">
			{commonTargets.map((r) => (
				<Button
					aria-label={`Add ${r}R target`}
					className="h-8 w-8 p-0 font-mono text-xs"
					data-testid={`wizard-risk-add-target-${r}`}
					key={`quick-${r}`}
					onClick={() => onAdd(r)}
					type="button"
					variant="ghost"
				>
					+{r}R
				</Button>
			))}
		</div>
	);
}
