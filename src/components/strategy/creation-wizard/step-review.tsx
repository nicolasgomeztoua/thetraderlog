"use client";

import { CheckCircle, ClipboardList, Pencil } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RULE_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/shared";
import type { RiskParameters } from "../risk-config";
import type { ScalingRules } from "../scaling-config";
import type { StrategyRule } from "../strategy-form";
import type { TrailingRules } from "../trailing-config";
import { useWizard } from "./wizard-container";

/**
 * Step 4 - Review
 *
 * Displays all entered data in read-only format before final creation:
 * - Basics section (name, description, color swatch)
 * - Rules section (entry/exit criteria, checklist rules count)
 * - Risk section (configured parameters only)
 *
 * "Edit" links next to each section jump back to that step.
 */
export function StepReview() {
	const { data, goToStep, setCanProceed } = useWizard();

	// Review step can always proceed (create strategy)
	useEffect(() => {
		setCanProceed(true);
	}, [setCanProceed]);

	const rules: StrategyRule[] = data.rules ?? [];
	const riskParameters: RiskParameters = data.riskParameters ?? {};
	const trailingRules: TrailingRules = data.trailingRules ?? {};
	const scalingRules: ScalingRules = data.scalingRules ?? {};

	// Count rules by category
	const rulesByCategory = RULE_CATEGORIES.reduce(
		(acc, cat) => {
			acc[cat.value] = rules.filter((r) => r.category === cat.value).length;
			return acc;
		},
		{} as Record<string, number>,
	);

	// Check which risk parameters are configured
	const hasAutoCheckedParams =
		riskParameters.minRRRatio !== undefined ||
		riskParameters.maxRiskPerTrade !== undefined ||
		riskParameters.dailyLossLimit !== undefined ||
		riskParameters.maxConcurrentPositions !== undefined;

	const hasConditionalParams =
		trailingRules.moveToBreakeven !== undefined ||
		(trailingRules.trailStops && trailingRules.trailStops.length > 0) ||
		(scalingRules.scaleOut && scalingRules.scaleOut.length > 0) ||
		(riskParameters.targetRMultiples &&
			riskParameters.targetRMultiples.length > 0);

	return (
		<div className="space-y-6" data-testid="wizard-step-review">
			{/* Basics Section */}
			<ReviewSection onEdit={() => goToStep(0)} stepIndex={0} title="Basics">
				<div className="space-y-3">
					{/* Name */}
					<ReviewField label="Name" value={data.name ?? ""} />

					{/* Description */}
					{data.description ? (
						<ReviewField label="Description" value={data.description} />
					) : (
						<ReviewField label="Description" muted value="Not specified" />
					)}

					{/* Color */}
					<div className="flex items-center gap-3">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
							Color
						</span>
						<div
							className="h-5 w-5 rounded"
							data-testid="wizard-review-color"
							style={{ backgroundColor: data.color ?? "#d4ff00" }}
						/>
					</div>
				</div>
			</ReviewSection>

			{/* Rules Section */}
			<ReviewSection onEdit={() => goToStep(1)} stepIndex={1} title="Rules">
				<div className="space-y-3">
					{/* Entry Criteria */}
					{data.entryCriteria ? (
						<ReviewField
							label="Entry Criteria"
							multiline
							value={data.entryCriteria}
						/>
					) : (
						<ReviewField label="Entry Criteria" muted value="Not specified" />
					)}

					{/* Exit Rules */}
					{data.exitRules ? (
						<ReviewField label="Exit Rules" multiline value={data.exitRules} />
					) : (
						<ReviewField label="Exit Rules" muted value="Not specified" />
					)}

					{/* Checklist Rules Count */}
					<div className="space-y-1">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
							Checklist Rules
						</span>
						{rules.length > 0 ? (
							<div
								className="flex flex-wrap gap-2"
								data-testid="wizard-review-rules-count"
							>
								{RULE_CATEGORIES.map((cat) => {
									const count = rulesByCategory[cat.value] ?? 0;
									if (count === 0) return null;
									return (
										<span
											className="rounded bg-white/5 px-2 py-1 font-mono text-xs"
											key={cat.value}
										>
											{count} {cat.label.toLowerCase()}
										</span>
									);
								})}
							</div>
						) : (
							<span className="font-mono text-muted-foreground/50 text-sm">
								No checklist rules defined
							</span>
						)}
					</div>
				</div>
			</ReviewSection>

			{/* Risk Section */}
			<ReviewSection
				onEdit={() => goToStep(2)}
				stepIndex={2}
				title="Risk Management"
			>
				{!hasAutoCheckedParams && !hasConditionalParams ? (
					<span className="font-mono text-muted-foreground/50 text-sm">
						No risk parameters configured
					</span>
				) : (
					<div className="space-y-4">
						{/* Auto-Checked Parameters */}
						{hasAutoCheckedParams && (
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-profit" />
									<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Auto-Checked
									</span>
								</div>
								<div
									className="grid gap-2 sm:grid-cols-2"
									data-testid="wizard-review-auto-checked"
								>
									{riskParameters.minRRRatio !== undefined && (
										<ReviewField
											label="Min R:R"
											value={`${riskParameters.minRRRatio}R`}
										/>
									)}
									{riskParameters.maxRiskPerTrade && (
										<ReviewField
											label="Max Risk/Trade"
											value={
												riskParameters.maxRiskPerTrade.type === "percent"
													? `${riskParameters.maxRiskPerTrade.value}%`
													: `$${riskParameters.maxRiskPerTrade.value}`
											}
										/>
									)}
									{riskParameters.dailyLossLimit && (
										<ReviewField
											label="Daily Loss Limit"
											value={
												riskParameters.dailyLossLimit.type === "percent"
													? `${riskParameters.dailyLossLimit.value}%`
													: `$${riskParameters.dailyLossLimit.value}`
											}
										/>
									)}
									{riskParameters.maxConcurrentPositions !== undefined && (
										<ReviewField
											label="Max Positions"
											value={`${riskParameters.maxConcurrentPositions}`}
										/>
									)}
								</div>
							</div>
						)}

						{/* Conditional Checklist Parameters */}
						{hasConditionalParams && (
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<ClipboardList className="h-4 w-4 text-primary" />
									<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Conditional Checklists
									</span>
								</div>
								<div
									className="space-y-2"
									data-testid="wizard-review-conditional"
								>
									{trailingRules.moveToBreakeven && (
										<ReviewField
											label="Move to Breakeven"
											value={`at ${trailingRules.moveToBreakeven.triggerR}R${trailingRules.moveToBreakeven.offsetTicks ? ` (+${trailingRules.moveToBreakeven.offsetTicks} ticks)` : ""}`}
										/>
									)}
									{trailingRules.trailStops &&
										trailingRules.trailStops.length > 0 && (
											<ReviewField
												label="Trail Stops"
												value={`${trailingRules.trailStops.length} rule${trailingRules.trailStops.length !== 1 ? "s" : ""}`}
											/>
										)}
									{scalingRules.scaleOut &&
										scalingRules.scaleOut.length > 0 && (
											<ReviewField
												label="Scale Out"
												value={`${scalingRules.scaleOut.length} rule${scalingRules.scaleOut.length !== 1 ? "s" : ""}`}
											/>
										)}
									{riskParameters.targetRMultiples &&
										riskParameters.targetRMultiples.length > 0 && (
											<ReviewField
												label="Target R Multiples"
												value={riskParameters.targetRMultiples
													.map((r) => `${r}R`)
													.join(", ")}
											/>
										)}
								</div>
							</div>
						)}
					</div>
				)}
			</ReviewSection>

			{/* Auto-Compliance Note */}
			<div
				className="rounded border border-primary/20 bg-primary/5 p-4"
				data-testid="wizard-review-note"
			>
				<p className="font-mono text-primary text-xs">
					<span className="font-semibold">Note:</span> Risk parameters marked as
					&quot;Auto-Checked&quot; will be automatically validated against your
					trades. You&apos;ll see compliance indicators on each trade detail
					page.
				</p>
			</div>
		</div>
	);
}

/**
 * Section wrapper with title and edit link
 */
interface ReviewSectionProps {
	title: string;
	stepIndex: number;
	onEdit: () => void;
	children: React.ReactNode;
}

function ReviewSection({
	children,
	onEdit,
	stepIndex,
	title,
}: ReviewSectionProps) {
	return (
		<section
			className="rounded border border-white/5 bg-white/2 p-4"
			data-testid={`wizard-review-section-${stepIndex}`}
		>
			<div className="mb-3 flex items-center justify-between">
				<h3 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					{title}
				</h3>
				<Button
					className="h-7 font-mono text-[10px] uppercase tracking-wider"
					data-testid={`wizard-review-edit-${stepIndex}`}
					onClick={onEdit}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Pencil className="mr-1 h-3 w-3" />
					Edit
				</Button>
			</div>
			{children}
		</section>
	);
}

/**
 * Field display component for review sections
 */
interface ReviewFieldProps {
	label: string;
	value: string;
	muted?: boolean;
	multiline?: boolean;
}

function ReviewField({ label, muted, multiline, value }: ReviewFieldProps) {
	return (
		<div className={cn("space-y-0.5", multiline && "col-span-full")}>
			<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
				{label}
			</span>
			<p
				className={cn(
					"font-mono text-sm",
					muted ? "text-muted-foreground/50" : "text-foreground",
					multiline && "whitespace-pre-wrap text-muted-foreground/80",
				)}
			>
				{value}
			</p>
		</div>
	);
}
