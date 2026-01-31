"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ScalingRules {
	scaleIn?: Array<{
		trigger: string;
		sizePercent: number;
		enabled?: boolean;
	}>;
	scaleOut?: Array<{
		trigger: string;
		sizePercent: number;
		enabled?: boolean;
	}>;
}

interface ScalingConfigProps {
	value: ScalingRules | null;
	onChange: (value: ScalingRules | null) => void;
}

export function ScalingConfig({ value, onChange }: ScalingConfigProps) {
	const scalingRules = value ?? {};

	const addScaleIn = () => {
		onChange({
			...scalingRules,
			scaleIn: [
				...(scalingRules.scaleIn ?? []),
				{ trigger: "", sizePercent: 25 },
			],
		});
	};

	const addScaleOut = () => {
		onChange({
			...scalingRules,
			scaleOut: [
				...(scalingRules.scaleOut ?? []),
				{ trigger: "", sizePercent: 50 },
			],
		});
	};

	const updateScaleIn = (
		idx: number,
		field: "trigger" | "sizePercent",
		fieldValue: string | number,
	) => {
		const newScaleIn = [...(scalingRules.scaleIn ?? [])];
		const existing = newScaleIn[idx] ?? { trigger: "", sizePercent: 0 };
		newScaleIn[idx] = { ...existing, [field]: fieldValue };
		onChange({ ...scalingRules, scaleIn: newScaleIn });
	};

	const updateScaleOut = (
		idx: number,
		field: "trigger" | "sizePercent",
		fieldValue: string | number,
	) => {
		const newScaleOut = [...(scalingRules.scaleOut ?? [])];
		const existing = newScaleOut[idx] ?? { trigger: "", sizePercent: 0 };
		newScaleOut[idx] = { ...existing, [field]: fieldValue };
		onChange({ ...scalingRules, scaleOut: newScaleOut });
	};

	const removeScaleIn = (idx: number) => {
		const newScaleIn = [...(scalingRules.scaleIn ?? [])];
		newScaleIn.splice(idx, 1);
		onChange({
			...scalingRules,
			scaleIn: newScaleIn.length > 0 ? newScaleIn : undefined,
		});
	};

	const removeScaleOut = (idx: number) => {
		const newScaleOut = [...(scalingRules.scaleOut ?? [])];
		newScaleOut.splice(idx, 1);
		onChange({
			...scalingRules,
			scaleOut: newScaleOut.length > 0 ? newScaleOut : undefined,
		});
	};

	return (
		<div className="space-y-4 sm:space-y-6">
			{/* Scale In Rules */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
						→ Scale In Rules <span className="text-profit">↑</span>
					</h4>
					<Button
						className="min-h-[36px] font-mono text-xs uppercase tracking-wider sm:h-7 sm:min-h-0"
						onClick={addScaleIn}
						size="sm"
						type="button"
						variant="outline"
					>
						<Plus className="mr-1 h-3 w-3" />
						Add Rule
					</Button>
				</div>

				{(scalingRules.scaleIn ?? []).length === 0 ? (
					<p className="font-mono text-muted-foreground text-xs sm:text-sm">
						No scale-in rules defined
					</p>
				) : (
					<div className="space-y-2">
						{(scalingRules.scaleIn ?? []).map((rule, idx) => (
							<div
								className="flex flex-col gap-2 rounded border border-white/10 bg-white/2 p-3 sm:flex-row sm:items-end sm:gap-3"
								key={`scalein-${rule.trigger || idx}`}
							>
								<div className="flex-1 space-y-1">
									<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
										Trigger
									</span>
									<Input
										className="min-h-[44px] font-mono text-sm sm:min-h-0"
										onChange={(e) =>
											updateScaleIn(idx, "trigger", e.target.value)
										}
										placeholder="e.g., Price reaches +0.5R"
										value={rule.trigger}
									/>
								</div>
								<div className="flex items-end gap-2">
									<div className="flex-1 space-y-1 sm:w-24 sm:flex-initial">
										<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
											Size %
										</span>
										<Input
											className="min-h-[44px] font-mono text-sm sm:min-h-0"
											inputMode="decimal"
											onChange={(e) => {
												const parsed = parseFloat(e.target.value);
												updateScaleIn(
													idx,
													"sizePercent",
													Number.isNaN(parsed) ? 0 : parsed,
												);
											}}
											step="5"
											type="number"
											value={rule.sizePercent}
										/>
									</div>
									<Button
										className="h-11 w-11 shrink-0 text-muted-foreground hover:text-loss sm:h-8 sm:w-8"
										onClick={() => removeScaleIn(idx)}
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

			{/* Scale Out Rules */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
						→ Scale Out Rules <span className="text-loss">↓</span>
					</h4>
					<Button
						className="min-h-[36px] font-mono text-xs uppercase tracking-wider sm:h-7 sm:min-h-0"
						onClick={addScaleOut}
						size="sm"
						type="button"
						variant="outline"
					>
						<Plus className="mr-1 h-3 w-3" />
						Add Rule
					</Button>
				</div>

				{(scalingRules.scaleOut ?? []).length === 0 ? (
					<p className="font-mono text-muted-foreground text-xs sm:text-sm">
						No scale-out rules defined
					</p>
				) : (
					<div className="space-y-2">
						{(scalingRules.scaleOut ?? []).map((rule, idx) => (
							<div
								className="flex flex-col gap-2 rounded border border-white/10 bg-white/2 p-3 sm:flex-row sm:items-end sm:gap-3"
								key={`scaleout-${rule.trigger || idx}`}
							>
								<div className="flex-1 space-y-1">
									<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
										Trigger
									</span>
									<Input
										className="min-h-[44px] font-mono text-sm sm:min-h-0"
										onChange={(e) =>
											updateScaleOut(idx, "trigger", e.target.value)
										}
										placeholder="e.g., At +1R take 50%"
										value={rule.trigger}
									/>
								</div>
								<div className="flex items-end gap-2">
									<div className="flex-1 space-y-1 sm:w-24 sm:flex-initial">
										<span className="font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">
											Size %
										</span>
										<Input
											className="min-h-[44px] font-mono text-sm sm:min-h-0"
											inputMode="decimal"
											onChange={(e) => {
												const parsed = parseFloat(e.target.value);
												updateScaleOut(
													idx,
													"sizePercent",
													Number.isNaN(parsed) ? 0 : parsed,
												);
											}}
											step="5"
											type="number"
											value={rule.sizePercent}
										/>
									</div>
									<Button
										className="h-11 w-11 shrink-0 text-muted-foreground hover:text-loss sm:h-8 sm:w-8"
										onClick={() => removeScaleOut(idx)}
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
