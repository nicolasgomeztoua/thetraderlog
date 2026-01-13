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

export interface TrailingRules {
	moveToBreakeven?: {
		triggerR: number;
		offsetTicks?: number;
	};
	trailStops?: Array<{
		triggerR: number;
		method: "fixed_ticks" | "atr_multiple" | "swing_low";
		value: number;
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
		field: "triggerR" | "offsetTicks",
		fieldValue: number,
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
		field: "triggerR" | "method" | "value",
		fieldValue: number | string,
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
		<div className="space-y-6">
			{/* Move to Breakeven */}
			<div className="space-y-3">
				<div className="flex items-center gap-3">
					<Checkbox
						checked={hasBreakeven}
						id="breakeven-toggle"
						onCheckedChange={(checked) => toggleBreakeven(checked === true)}
					/>
					<label
						className="cursor-pointer font-mono text-[11px] text-primary/80 uppercase tracking-wider"
						htmlFor="breakeven-toggle"
					>
						Move to Breakeven
					</label>
				</div>

				{hasBreakeven && (
					<div className="ml-6 grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<span className="font-mono text-[10px] text-muted-foreground uppercase">
								Trigger at R
							</span>
							<Input
								className="font-mono"
								onChange={(e) =>
									updateBreakeven("triggerR", parseFloat(e.target.value) || 0)
								}
								placeholder="1.0"
								step="0.1"
								type="number"
								value={trailingRules.moveToBreakeven?.triggerR ?? ""}
							/>
						</div>
						<div className="space-y-1">
							<span className="font-mono text-[10px] text-muted-foreground uppercase">
								Offset (ticks)
							</span>
							<Input
								className="font-mono"
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
					</div>
				)}
			</div>

			{/* Trail Stops */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h4 className="font-mono text-[11px] text-primary/80 uppercase tracking-wider">
						Trailing Stop Rules
					</h4>
					<Button
						className="h-7 font-mono text-xs"
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
					<p className="font-mono text-muted-foreground text-sm">
						No trailing stop rules defined
					</p>
				) : (
					<div className="space-y-2">
						{(trailingRules.trailStops ?? []).map((rule, idx) => (
							<div
								className="flex items-end gap-3 rounded border border-white/5 bg-white/2 p-3"
								key={`trail-${rule.triggerR}-${rule.method}`}
							>
								<div className="w-24 space-y-1">
									<span className="font-mono text-[10px] text-muted-foreground uppercase">
										At R
									</span>
									<Input
										className="font-mono text-sm"
										onChange={(e) =>
											updateTrailStop(
												idx,
												"triggerR",
												parseFloat(e.target.value) || 0,
											)
										}
										step="0.1"
										type="number"
										value={rule.triggerR}
									/>
								</div>
								<div className="flex-1 space-y-1">
									<span className="font-mono text-[10px] text-muted-foreground uppercase">
										Method
									</span>
									<Select
										onValueChange={(v) => updateTrailStop(idx, "method", v)}
										value={rule.method}
									>
										<SelectTrigger className="font-mono text-sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="fixed_ticks">Fixed Ticks</SelectItem>
											<SelectItem value="atr_multiple">ATR Multiple</SelectItem>
											<SelectItem value="swing_low">Swing Low/High</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="w-24 space-y-1">
									<span className="font-mono text-[10px] text-muted-foreground uppercase">
										Value
									</span>
									<Input
										className="font-mono text-sm"
										onChange={(e) =>
											updateTrailStop(
												idx,
												"value",
												parseFloat(e.target.value) || 0,
											)
										}
										step="1"
										type="number"
										value={rule.value}
									/>
								</div>
								<Button
									className="h-8 w-8 text-muted-foreground hover:text-loss"
									onClick={() => removeTrailStop(idx)}
									size="icon"
									type="button"
									variant="ghost"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
