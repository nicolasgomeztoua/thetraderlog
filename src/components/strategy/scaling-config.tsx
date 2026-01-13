"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ScalingRules {
	scaleIn?: Array<{
		trigger: string;
		sizePercent: number;
	}>;
	scaleOut?: Array<{
		trigger: string;
		sizePercent: number;
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
		<div className="space-y-6">
			{/* Scale In Rules */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h4 className="font-mono text-[11px] text-profit uppercase tracking-wider">
						Scale In Rules
					</h4>
					<Button
						className="h-7 font-mono text-xs"
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
					<p className="font-mono text-muted-foreground text-sm">
						No scale-in rules defined
					</p>
				) : (
					<div className="space-y-2">
						{(scalingRules.scaleIn ?? []).map((rule, idx) => (
							<div
								className="flex items-center gap-3 rounded border border-white/5 bg-white/2 p-3"
								key={`scalein-${rule.trigger || idx}`}
							>
								<div className="flex-1 space-y-1">
									<span className="font-mono text-[10px] text-muted-foreground uppercase">
										Trigger
									</span>
									<Input
										className="font-mono text-sm"
										onChange={(e) =>
											updateScaleIn(idx, "trigger", e.target.value)
										}
										placeholder="e.g., Price reaches +0.5R"
										value={rule.trigger}
									/>
								</div>
								<div className="w-24 space-y-1">
									<span className="font-mono text-[10px] text-muted-foreground uppercase">
										Size %
									</span>
									<Input
										className="font-mono text-sm"
										onChange={(e) =>
											updateScaleIn(
												idx,
												"sizePercent",
												parseFloat(e.target.value) || 0,
											)
										}
										step="5"
										type="number"
										value={rule.sizePercent}
									/>
								</div>
								<Button
									className="mt-5 h-8 w-8 text-muted-foreground hover:text-loss"
									onClick={() => removeScaleIn(idx)}
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

			{/* Scale Out Rules */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h4 className="font-mono text-[11px] text-loss uppercase tracking-wider">
						Scale Out Rules
					</h4>
					<Button
						className="h-7 font-mono text-xs"
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
					<p className="font-mono text-muted-foreground text-sm">
						No scale-out rules defined
					</p>
				) : (
					<div className="space-y-2">
						{(scalingRules.scaleOut ?? []).map((rule, idx) => (
							<div
								className="flex items-center gap-3 rounded border border-white/5 bg-white/2 p-3"
								key={`scaleout-${rule.trigger || idx}`}
							>
								<div className="flex-1 space-y-1">
									<span className="font-mono text-[10px] text-muted-foreground uppercase">
										Trigger
									</span>
									<Input
										className="font-mono text-sm"
										onChange={(e) =>
											updateScaleOut(idx, "trigger", e.target.value)
										}
										placeholder="e.g., At +1R take 50%"
										value={rule.trigger}
									/>
								</div>
								<div className="w-24 space-y-1">
									<span className="font-mono text-[10px] text-muted-foreground uppercase">
										Size %
									</span>
									<Input
										className="font-mono text-sm"
										onChange={(e) =>
											updateScaleOut(
												idx,
												"sizePercent",
												parseFloat(e.target.value) || 0,
											)
										}
										step="5"
										type="number"
										value={rule.sizePercent}
									/>
								</div>
								<Button
									className="mt-5 h-8 w-8 text-muted-foreground hover:text-loss"
									onClick={() => removeScaleOut(idx)}
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
