"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface TrailingRules {
	moveToBreakeven?: {
		triggerR: number;
		offsetTicks?: number;
		enabled?: boolean;
	};
	trailStops?: Array<{
		triggerR: number;
		method: "fixed_ticks" | "atr_multiple" | "swing_low";
		value: number;
		enabled?: boolean;
	}>;
}

interface TrailingConfigProps {
	value: TrailingRules | null;
	onChange: (value: TrailingRules | null) => void;
}

export function TrailingConfig({ value, onChange }: TrailingConfigProps) {
	const trailingRules = value ?? {};
	const hasBreakeven = !!trailingRules.moveToBreakeven;

	const toggleBreakeven = (enabled: boolean) => {
		if (enabled) {
			onChange({
				...trailingRules,
				moveToBreakeven: { triggerR: 1, offsetTicks: 0 },
			});
		} else {
			const { moveToBreakeven: _removed, ...rest } = trailingRules;
			onChange(Object.keys(rest).length > 0 ? rest : null);
		}
	};

	const updateBreakeven = (
		field: "triggerR" | "offsetTicks" | "enabled",
		fieldValue: number | boolean,
	) => {
		const currentBreakeven = trailingRules.moveToBreakeven ?? { triggerR: 1 };
		onChange({
			...trailingRules,
			moveToBreakeven: {
				...currentBreakeven,
				[field]: fieldValue,
			},
		});
	};

	const addTrailStop = () => {
		onChange({
			...trailingRules,
			trailStops: [
				...(trailingRules.trailStops ?? []),
				{ triggerR: 1.5, method: "fixed_ticks" as const, value: 10 },
			],
		});
	};

	const updateTrailStop = (
		idx: number,
		field: "triggerR" | "method" | "value" | "enabled",
		fieldValue: number | string | boolean,
	) => {
		const newTrailStops = [...(trailingRules.trailStops ?? [])];
		const existing = newTrailStops[idx] ?? {
			triggerR: 1,
			method: "fixed_ticks" as const,
			value: 10,
		};
		newTrailStops[idx] = { ...existing, [field]: fieldValue };
		onChange({ ...trailingRules, trailStops: newTrailStops });
	};

	const removeTrailStop = (idx: number) => {
		const newTrailStops = [...(trailingRules.trailStops ?? [])];
		newTrailStops.splice(idx, 1);
		onChange({
			...trailingRules,
			trailStops: newTrailStops.length > 0 ? newTrailStops : undefined,
		});
	};

	return (
		<div className="space-y-4 sm:space-y-6">
			{/* Move to Breakeven */}
			<div className="space-y-3">
				<div className="flex items-center gap-3">
					<Checkbox
						checked={hasBreakeven}
						className="h-5 w-5 sm:h-4 sm:w-4"
						id="breakeven-toggle"
						onCheckedChange={(checked) => toggleBreakeven(checked === true)}
					/>
					<label
						className="cursor-pointer font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]"
						htmlFor="breakeven-toggle"
					>
						→ Move to Breakeven
					</label>
				</div>

				{hasBreakeven && (
					<div className="ml-0 grid grid-cols-1 gap-3 sm:ml-6 sm:grid-cols-3 sm:gap-4">
						<div className="space-y-1">
							<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
								Trigger at R
							</span>
							<Input
								className="min-h-[44px] font-mono sm:min-h-0"
								inputMode="decimal"
								onChange={(e) => {
									const parsed = parseFloat(e.target.value);
									updateBreakeven(
										"triggerR",
										Number.isNaN(parsed) ? 0 : parsed,
									);
								}}
								placeholder="1.0"
								step="0.1"
								type="number"
								value={trailingRules.moveToBreakeven?.triggerR ?? ""}
							/>
						</div>
						<div className="space-y-1">
							<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
								Offset (ticks)
							</span>
							<Input
								className="min-h-[44px] font-mono sm:min-h-0"
								inputMode="numeric"
								onChange={(e) =>
									updateBreakeven(
										"offsetTicks",
										parseInt(e.target.value, 10) || 0,
									)
								}
								placeholder="0"
								step="1"
								type="number"
								value={trailingRules.moveToBreakeven?.offsetTicks ?? ""}
							/>
						</div>
						<div className="flex flex-col items-center justify-end gap-1">
							<span className="font-mono text-[9px] text-muted-foreground">
								Track
							</span>
							<Switch
								checked={trailingRules.moveToBreakeven?.enabled ?? false}
								onCheckedChange={(checked) =>
									updateBreakeven("enabled", checked)
								}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Trail Stops */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
						→ Trailing Stop Rules
					</h4>
					<Button
						className="min-h-[36px] font-mono text-xs uppercase tracking-wider sm:h-7 sm:min-h-0"
						onClick={addTrailStop}
						size="sm"
						type="button"
						variant="outline"
					>
						<Plus className="mr-1 h-3 w-3" />
						Add Rule
					</Button>
				</div>

				{(trailingRules.trailStops ?? []).length === 0 ? (
					<p className="font-mono text-muted-foreground text-xs sm:text-sm">
						No trailing stop rules defined
					</p>
				) : (
					<div className="space-y-2">
						{(trailingRules.trailStops ?? []).map((rule, idx) => (
							<div
								className="flex flex-col gap-2 rounded border border-border bg-muted p-3 sm:flex-row sm:items-end sm:gap-3"
								key={`trail-${rule.triggerR}-${rule.method}`}
							>
								<div className="grid grid-cols-2 gap-2 sm:contents">
									<div className="space-y-1 sm:w-24">
										<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
											At R
										</span>
										<Input
											className="min-h-[44px] font-mono text-sm sm:min-h-0"
											inputMode="decimal"
											onChange={(e) => {
												const parsed = parseFloat(e.target.value);
												updateTrailStop(
													idx,
													"triggerR",
													Number.isNaN(parsed) ? 0 : parsed,
												);
											}}
											step="0.1"
											type="number"
											value={rule.triggerR}
										/>
									</div>
									<div className="space-y-1 sm:w-24">
										<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
											Value
										</span>
										<Input
											className="min-h-[44px] font-mono text-sm sm:min-h-0"
											inputMode="decimal"
											onChange={(e) => {
												const parsed = parseFloat(e.target.value);
												updateTrailStop(
													idx,
													"value",
													Number.isNaN(parsed) ? 0 : parsed,
												);
											}}
											step="1"
											type="number"
											value={rule.value}
										/>
									</div>
								</div>
								<div className="flex items-end gap-2">
									<div className="flex-1 space-y-1">
										<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
											Method
										</span>
										<Select
											onValueChange={(v) => updateTrailStop(idx, "method", v)}
											value={rule.method}
										>
											<SelectTrigger className="min-h-[44px] font-mono text-sm sm:min-h-0">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem
													className="min-h-[44px] sm:min-h-0"
													value="fixed_ticks"
												>
													Fixed Ticks
												</SelectItem>
												<SelectItem
													className="min-h-[44px] sm:min-h-0"
													value="atr_multiple"
												>
													ATR Multiple
												</SelectItem>
												<SelectItem
													className="min-h-[44px] sm:min-h-0"
													value="swing_low"
												>
													Swing Low/High
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="flex flex-col items-center justify-end gap-1">
										<span className="font-mono text-[9px] text-muted-foreground">
											Track
										</span>
										<Switch
											checked={rule.enabled ?? false}
											onCheckedChange={(checked) =>
												updateTrailStop(idx, "enabled", checked)
											}
										/>
									</div>
									<Button
										className="h-11 w-11 shrink-0 text-muted-foreground hover:text-loss sm:h-8 sm:w-8"
										onClick={() => removeTrailStop(idx)}
										size="icon"
										type="button"
										variant="ghost"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
