"use client";

import {
	ArrowLeft,
	ArrowRight,
	Check,
	GripVertical,
	Plus,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, PRESET_COLORS } from "@/lib/shared";
import { RiskConfig } from "./risk-config";
import { ScalingConfig } from "./scaling-config";
import type { StrategyFormData, StrategyRule } from "./strategy-form";
import { STRATEGY_WIZARD_STEPS, StrategyStepper } from "./strategy-stepper";
import { TrailingConfig } from "./trailing-config";

// =============================================================================
// TYPES
// =============================================================================

interface StrategyWizardProps {
	initialData?: Partial<StrategyFormData>;
	onSubmit: (data: StrategyFormData) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
}

const CATEGORY_OPTIONS = [
	{ value: "entry", label: "Entry" },
	{ value: "exit", label: "Exit" },
	{ value: "risk", label: "Risk" },
	{ value: "management", label: "Management" },
];

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Multi-step wizard for creating/editing strategies.
 * Two-column layout: stepper sidebar + content area.
 * Terminal-styled header with traffic lights.
 */
export function StrategyWizard({
	initialData,
	onSubmit,
	isSubmitting,
	submitLabel = "Create Strategy",
}: StrategyWizardProps) {
	// Form state
	const [formData, setFormData] = useState<StrategyFormData>({
		name: initialData?.name ?? "",
		description: initialData?.description ?? "",
		color: initialData?.color ?? "#d4ff00",
		entryCriteria: initialData?.entryCriteria ?? "",
		exitRules: initialData?.exitRules ?? "",
		riskParameters: initialData?.riskParameters ?? null,
		scalingRules: initialData?.scalingRules ?? null,
		trailingRules: initialData?.trailingRules ?? null,
		isActive: initialData?.isActive ?? true,
		rules: initialData?.rules ?? [],
	});

	// Wizard state
	const [currentStep, setCurrentStep] = useState(0);
	const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

	// =============================================================================
	// FORM HANDLERS
	// =============================================================================

	const updateField = <K extends keyof StrategyFormData>(
		field: K,
		value: StrategyFormData[K],
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const addRule = () => {
		setFormData((prev) => ({
			...prev,
			rules: [
				...prev.rules,
				{
					text: "",
					category: "entry" as const,
					order: prev.rules.length,
				},
			],
		}));
	};

	const updateRule = (idx: number, updates: Partial<StrategyRule>) => {
		setFormData((prev) => ({
			...prev,
			rules: prev.rules.map((r, i) => (i === idx ? { ...r, ...updates } : r)),
		}));
	};

	const removeRule = (idx: number) => {
		setFormData((prev) => ({
			...prev,
			rules: prev.rules
				.filter((_, i) => i !== idx)
				.map((r, i) => ({ ...r, order: i })),
		}));
	};

	// =============================================================================
	// NAVIGATION HANDLERS
	// =============================================================================

	const handleStepClick = (stepIndex: number) => {
		// Mark current step as completed when navigating away
		if (stepIndex !== currentStep) {
			setCompletedSteps((prev) => new Set([...prev, currentStep]));
		}
		setCurrentStep(stepIndex);
	};

	const handleNext = () => {
		if (currentStep < STRATEGY_WIZARD_STEPS.length - 1) {
			setCompletedSteps((prev) => new Set([...prev, currentStep]));
			setCurrentStep(currentStep + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit(formData);
	};

	const isLastStep = currentStep === STRATEGY_WIZARD_STEPS.length - 1;
	const canSubmit = formData.name.trim() !== "";

	// =============================================================================
	// STEP CONTENT RENDERING
	// =============================================================================

	const renderStepContent = () => {
		switch (currentStep) {
			case 0: // Basic Info
				return (
					<div className="space-y-4 sm:space-y-6">
						<div className="space-y-1">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
								Strategy Name *
							</span>
							<Input
								className="min-h-[44px] font-mono sm:min-h-0"
								data-testid="strategy-wizard-input-name"
								onChange={(e) => updateField("name", e.target.value)}
								placeholder="e.g., Trend Continuation"
								required
								value={formData.name}
							/>
						</div>

						<div className="space-y-1">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
								Description
							</span>
							<Textarea
								className="font-mono"
								data-testid="strategy-wizard-input-description"
								onChange={(e) => updateField("description", e.target.value)}
								placeholder="Brief description of this strategy..."
								rows={3}
								value={formData.description}
							/>
						</div>

						<div className="space-y-2">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
								Color
							</span>
							<div
								className="flex flex-wrap gap-2"
								data-testid="strategy-wizard-color-picker"
							>
								{PRESET_COLORS.map((color) => (
									<button
										className={cn(
											"h-9 w-9 rounded border-2 transition-all sm:h-8 sm:w-8",
											formData.color === color
												? "scale-110 border-white"
												: "border-transparent hover:border-white/30",
										)}
										data-testid={`strategy-wizard-color-${color.replace("#", "")}`}
										key={color}
										onClick={() => updateField("color", color)}
										style={{ backgroundColor: color }}
										type="button"
									/>
								))}
							</div>
						</div>
					</div>
				);

			case 1: // Strategy
				return (
					<div className="space-y-4 sm:space-y-6">
						<div className="space-y-1">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
								Entry Criteria
							</span>
							<Textarea
								className="font-mono text-sm"
								data-testid="strategy-wizard-input-entry"
								onChange={(e) => updateField("entryCriteria", e.target.value)}
								placeholder="Describe your entry criteria in detail..."
								rows={6}
								value={formData.entryCriteria}
							/>
						</div>

						<div className="space-y-1">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
								Exit Rules
							</span>
							<Textarea
								className="font-mono text-sm"
								data-testid="strategy-wizard-input-exit"
								onChange={(e) => updateField("exitRules", e.target.value)}
								placeholder="Describe your exit rules in detail..."
								rows={6}
								value={formData.exitRules}
							/>
						</div>
					</div>
				);

			case 2: // Risk Management
				return (
					<RiskConfig
						onChange={(value) => updateField("riskParameters", value)}
						value={formData.riskParameters}
					/>
				);

			case 3: // Scaling
				return (
					<ScalingConfig
						onChange={(value) => updateField("scalingRules", value)}
						value={formData.scalingRules}
					/>
				);

			case 4: // Trailing Stops
				return (
					<TrailingConfig
						onChange={(value) => updateField("trailingRules", value)}
						value={formData.trailingRules}
					/>
				);

			case 5: // Rules Checklist
				return (
					<div
						className="space-y-4"
						data-testid="strategy-wizard-rules-section"
					>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<p className="font-mono text-muted-foreground text-xs sm:text-sm">
								Define rules that you&apos;ll check off when taking trades with
								this strategy.
							</p>
							<Button
								className="min-h-[36px] shrink-0 font-mono text-xs sm:min-h-0"
								data-testid="strategy-wizard-button-add-rule"
								onClick={addRule}
								size="sm"
								type="button"
								variant="outline"
							>
								<Plus className="mr-1 h-3 w-3" />
								Add Rule
							</Button>
						</div>

						{formData.rules.length === 0 ? (
							<div className="rounded border border-white/5 bg-white/2 py-6 text-center sm:py-8">
								<p className="font-mono text-muted-foreground text-xs sm:text-sm">
									No rules defined yet
								</p>
								<Button
									className="mt-4 min-h-[36px] font-mono text-xs sm:min-h-0"
									onClick={addRule}
									type="button"
									variant="outline"
								>
									<Plus className="mr-1 h-3 w-3" />
									Add Your First Rule
								</Button>
							</div>
						) : (
							<div className="space-y-2">
								{formData.rules.map((rule, idx) => (
									<div
										className="flex flex-col gap-2 rounded border border-white/5 bg-white/2 p-3 sm:flex-row sm:items-center sm:gap-3"
										data-testid={`strategy-wizard-rule-${idx}`}
										key={rule.id ?? `new-${rule.order}`}
									>
										<div className="flex items-center gap-2 sm:gap-3">
											<GripVertical className="hidden h-4 w-4 cursor-grab text-muted-foreground/50 sm:block" />
											<div className="w-24 sm:w-28">
												<Select
													onValueChange={(v) =>
														updateRule(idx, {
															category: v as StrategyRule["category"],
														})
													}
													value={rule.category}
												>
													<SelectTrigger className="h-9 font-mono text-xs sm:h-8">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{CATEGORY_OPTIONS.map((opt) => (
															<SelectItem
																className="min-h-[44px] sm:min-h-0"
																key={opt.value}
																value={opt.value}
															>
																{opt.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<Button
												className="ml-auto h-9 w-9 text-muted-foreground hover:text-loss sm:hidden"
												onClick={() => removeRule(idx)}
												size="icon"
												type="button"
												variant="ghost"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
										<Input
											className="min-h-[44px] flex-1 font-mono text-sm sm:min-h-0"
											onChange={(e) =>
												updateRule(idx, { text: e.target.value })
											}
											placeholder="Enter rule text..."
											value={rule.text}
										/>
										<Button
											className="hidden h-8 w-8 text-muted-foreground hover:text-loss sm:flex"
											onClick={() => removeRule(idx)}
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
				);

			default:
				return null;
		}
	};

	// =============================================================================
	// RENDER
	// =============================================================================

	return (
		<form
			className="overflow-hidden rounded border border-border"
			data-testid="strategy-wizard"
			onSubmit={handleSubmit}
		>
			{/* Terminal header */}
			<div className="flex items-center justify-between border-border border-b bg-secondary px-3 py-2 sm:px-4">
				<div className="flex items-center gap-1.5 sm:gap-2">
					<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
				</div>
				<div className="text-center">
					<span className="font-mono text-[10px] text-muted-foreground">
						strategy-wizard
					</span>
				</div>
				<div className="w-12" />
			</div>

			{/* Two-column layout */}
			<div className="flex flex-col md:flex-row">
				{/* Sidebar stepper */}
				<div className="border-border border-b bg-secondary/30 p-4 md:w-56 md:border-r md:border-b-0">
					<StrategyStepper
						completedSteps={completedSteps}
						currentStep={currentStep}
						onStepClick={handleStepClick}
						steps={STRATEGY_WIZARD_STEPS}
					/>
				</div>

				{/* Content area */}
				<div className="flex flex-1 flex-col">
					{/* Step content */}
					<div
						className="flex-1 bg-card p-4 sm:p-6"
						data-testid="strategy-wizard-content"
					>
						{/* Step title */}
						<div className="mb-6">
							<h2 className="font-bold font-mono text-lg">
								{STRATEGY_WIZARD_STEPS[currentStep]?.label}
							</h2>
							<p className="mt-1 font-mono text-muted-foreground text-xs">
								Step {currentStep + 1} of {STRATEGY_WIZARD_STEPS.length}
							</p>
						</div>

						{/* Step fields */}
						{renderStepContent()}
					</div>

					{/* Navigation footer */}
					<div className="flex items-center justify-between border-border border-t bg-secondary/30 px-4 py-3 sm:px-6 sm:py-4">
						<Button
							className="min-h-[44px] font-mono text-xs sm:min-h-0"
							data-testid="strategy-wizard-button-back"
							disabled={currentStep === 0}
							onClick={handleBack}
							type="button"
							variant="ghost"
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back
						</Button>

						{isLastStep ? (
							<Button
								className="min-h-[44px] font-mono text-xs uppercase tracking-wider sm:min-h-0"
								data-testid="strategy-wizard-button-submit"
								disabled={isSubmitting || !canSubmit}
								type="submit"
							>
								{isSubmitting ? (
									"Creating..."
								) : (
									<>
										<Check className="mr-2 h-4 w-4" />
										{submitLabel}
									</>
								)}
							</Button>
						) : (
							<Button
								className="min-h-[44px] font-mono text-xs sm:min-h-0"
								data-testid="strategy-wizard-button-next"
								onClick={handleNext}
								type="button"
							>
								Continue
								<ArrowRight className="ml-2 h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</div>
		</form>
	);
}
