"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

export interface StepConfig {
	id: string;
	label: string;
	shortLabel?: string; // For mobile
}

export interface StrategyStepperProps {
	steps: StepConfig[];
	currentStep: number;
	completedSteps: Set<number>;
	onStepClick: (stepIndex: number) => void;
	className?: string;
}

// =============================================================================
// DEFAULT STEPS
// =============================================================================

export const STRATEGY_WIZARD_STEPS: StepConfig[] = [
	{ id: "basic", label: "Basic Info", shortLabel: "Basic" },
	{ id: "strategy", label: "Strategy", shortLabel: "Strategy" },
	{ id: "risk", label: "Risk Management", shortLabel: "Risk" },
	{ id: "scaling", label: "Scaling", shortLabel: "Scale" },
	{ id: "trailing", label: "Trailing Stops", shortLabel: "Trail" },
	{ id: "rules", label: "Rules Checklist", shortLabel: "Rules" },
];

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Sidebar stepper for multi-step wizard flows.
 * Shows numbered steps with active/completed states.
 * Responsive: vertical on desktop, horizontal on mobile.
 */
export function StrategyStepper({
	steps,
	currentStep,
	completedSteps,
	onStepClick,
	className,
}: StrategyStepperProps) {
	return (
		<nav
			aria-label="Strategy wizard progress"
			className={cn("font-mono", className)}
			data-testid="strategy-stepper"
		>
			{/* Desktop: Vertical stepper */}
			<ol
				className="hidden flex-col gap-1 md:flex"
				data-testid="strategy-stepper-desktop"
			>
				{steps.map((step, index) => {
					const isActive = index === currentStep;
					const isCompleted = completedSteps.has(index);
					const isPast = index < currentStep;

					return (
						<li key={step.id}>
							<button
								aria-current={isActive ? "step" : undefined}
								className={cn(
									"flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-all",
									"hover:bg-white/5",
									isActive && "bg-primary/10",
								)}
								data-testid={`strategy-stepper-step-${step.id}`}
								onClick={() => onStepClick(index)}
								type="button"
							>
								{/* Step number / check icon */}
								<span
									className={cn(
										"flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-medium text-xs transition-colors",
										isCompleted && "bg-profit text-background",
										isActive && !isCompleted && "bg-primary text-background",
										!isActive &&
											!isCompleted &&
											"bg-white/10 text-muted-foreground",
									)}
								>
									{isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
								</span>

								{/* Step label */}
								<span
									className={cn(
										"text-sm transition-colors",
										isActive && "text-primary",
										isPast && !isActive && "text-muted-foreground",
										!isPast && !isActive && "text-muted-foreground/70",
									)}
								>
									{step.label}
								</span>
							</button>
						</li>
					);
				})}
			</ol>

			{/* Mobile: Horizontal stepper */}
			<ol
				className="flex items-center justify-between gap-1 overflow-x-auto md:hidden"
				data-testid="strategy-stepper-mobile"
			>
				{steps.map((step, index) => {
					const isActive = index === currentStep;
					const isCompleted = completedSteps.has(index);

					return (
						<li className="flex flex-col items-center" key={step.id}>
							<button
								aria-current={isActive ? "step" : undefined}
								className={cn(
									"flex flex-col items-center gap-1 rounded-lg p-2 transition-all",
									"hover:bg-white/5",
									isActive && "bg-primary/10",
								)}
								data-testid={`strategy-stepper-step-mobile-${step.id}`}
								onClick={() => onStepClick(index)}
								type="button"
							>
								{/* Step number / check icon */}
								<span
									className={cn(
										"flex h-7 w-7 items-center justify-center rounded-full font-medium text-xs transition-colors",
										isCompleted && "bg-profit text-background",
										isActive && !isCompleted && "bg-primary text-background",
										!isActive &&
											!isCompleted &&
											"bg-white/10 text-muted-foreground",
									)}
								>
									{isCompleted ? <Check className="h-4 w-4" /> : index + 1}
								</span>

								{/* Short label */}
								<span
									className={cn(
										"text-[10px] transition-colors",
										isActive && "text-primary",
										!isActive && "text-muted-foreground/70",
									)}
								>
									{step.shortLabel ?? step.label}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
