"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared";
import type { StrategyFormData } from "../strategy-form";

// =============================================================================
// TYPES
// =============================================================================

export interface WizardStep {
	id: string;
	name: string;
	component: ReactNode;
	validate?: (data: Partial<StrategyFormData>) => boolean;
}

interface WizardContextValue {
	data: Partial<StrategyFormData>;
	updateData: (updates: Partial<StrategyFormData>) => void;
	currentStep: number;
	goToStep: (step: number) => void;
	canProceed: boolean;
	setCanProceed: (value: boolean) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard() {
	const context = useContext(WizardContext);
	if (!context) {
		throw new Error("useWizard must be used within WizardContainer");
	}
	return context;
}

// =============================================================================
// STEP INDICATOR
// =============================================================================

interface StepIndicatorProps {
	steps: WizardStep[];
	currentStep: number;
	onStepClick: (step: number) => void;
}

function StepIndicator({
	currentStep,
	onStepClick,
	steps,
}: StepIndicatorProps) {
	return (
		<div className="mb-8" data-testid="wizard-step-indicator">
			{/* Desktop: horizontal with progress lines */}
			<div className="hidden sm:flex sm:items-center sm:justify-center">
				{steps.map((step, index) => {
					const isCompleted = index < currentStep;
					const isCurrent = index === currentStep;
					const isClickable = index <= currentStep;

					return (
						<div className="flex items-center" key={step.id}>
							{/* Step circle */}
							<button
								className={cn(
									"flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono text-xs transition-all",
									isCompleted &&
										"border-primary bg-primary text-primary-foreground",
									isCurrent && "border-primary bg-primary/10 text-primary",
									!isCompleted &&
										!isCurrent &&
										"border-white/10 text-muted-foreground",
									isClickable && "cursor-pointer hover:border-primary/50",
									!isClickable && "cursor-default",
								)}
								data-testid={`wizard-step-${index}`}
								disabled={!isClickable}
								onClick={() => isClickable && onStepClick(index)}
								type="button"
							>
								{isCompleted ? (
									<Check className="h-4 w-4" />
								) : (
									<span>{index + 1}</span>
								)}
							</button>

							{/* Step label */}
							<span
								className={cn(
									"ml-2 font-mono text-[10px] uppercase tracking-wider",
									isCurrent && "text-primary",
									!isCurrent && "text-muted-foreground",
								)}
							>
								{step.name}
							</span>

							{/* Progress line */}
							{index < steps.length - 1 && (
								<div
									className={cn(
										"mx-4 h-px w-12",
										isCompleted ? "bg-primary" : "bg-white/10",
									)}
								/>
							)}
						</div>
					);
				})}
			</div>

			{/* Mobile: compact step indicator */}
			<div className="flex items-center justify-between sm:hidden">
				<span className="font-mono text-muted-foreground text-xs">
					Step {currentStep + 1} of {steps.length}
				</span>
				<span className="font-mono text-primary text-xs uppercase tracking-wider">
					{steps[currentStep]?.name}
				</span>
			</div>

			{/* Mobile: progress bar */}
			<div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5 sm:hidden">
				<div
					className="h-full bg-primary transition-all"
					style={{
						width: `${((currentStep + 1) / steps.length) * 100}%`,
					}}
				/>
			</div>
		</div>
	);
}

// =============================================================================
// WIZARD CONTAINER
// =============================================================================

interface WizardContainerProps {
	steps: WizardStep[];
	onComplete: (data: StrategyFormData) => void;
	initialData?: Partial<StrategyFormData>;
	isSubmitting?: boolean;
}

export function WizardContainer({
	initialData,
	isSubmitting,
	onComplete,
	steps,
}: WizardContainerProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [data, setData] = useState<Partial<StrategyFormData>>(
		initialData ?? {},
	);
	const [canProceed, setCanProceed] = useState(false);

	const isFirstStep = currentStep === 0;
	const isLastStep = currentStep === steps.length - 1;
	const currentStepConfig = steps[currentStep];

	// Update form data
	const updateData = useCallback((updates: Partial<StrategyFormData>) => {
		setData((prev) => ({ ...prev, ...updates }));
	}, []);

	// Navigate to a specific step
	const goToStep = useCallback(
		(step: number) => {
			if (step >= 0 && step <= currentStep) {
				setCurrentStep(step);
			}
		},
		[currentStep],
	);

	// Handle next step
	const handleNext = useCallback(() => {
		if (isLastStep) {
			// Complete the wizard
			onComplete(data as StrategyFormData);
		} else {
			setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
		}
	}, [isLastStep, onComplete, data, steps.length]);

	// Handle previous step
	const handleBack = useCallback(() => {
		setCurrentStep((prev) => Math.max(prev - 1, 0));
	}, []);

	// Validate current step
	useEffect(() => {
		const validator = currentStepConfig?.validate;
		if (validator) {
			setCanProceed(validator(data));
		} else {
			setCanProceed(true);
		}
	}, [currentStepConfig, data]);

	// Handle keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't trigger on input/textarea elements
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			if (e.key === "Enter" && canProceed && !isSubmitting) {
				e.preventDefault();
				handleNext();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [canProceed, handleNext, isSubmitting]);

	// Context value
	const contextValue = useMemo<WizardContextValue>(
		() => ({
			canProceed,
			currentStep,
			data,
			goToStep,
			setCanProceed,
			updateData,
		}),
		[data, updateData, currentStep, goToStep, canProceed],
	);

	return (
		<WizardContext.Provider value={contextValue}>
			<div className="flex flex-col" data-testid="wizard-container">
				{/* Step Indicator */}
				<StepIndicator
					currentStep={currentStep}
					onStepClick={goToStep}
					steps={steps}
				/>

				{/* Step Content */}
				<div className="min-h-[300px]" data-testid="wizard-step-content">
					{currentStepConfig?.component}
				</div>

				{/* Navigation Buttons */}
				<div
					className="mt-8 flex items-center justify-between border-white/5 border-t pt-6"
					data-testid="wizard-navigation"
				>
					{/* Back Button */}
					<div>
						{!isFirstStep && (
							<Button
								className="font-mono text-xs uppercase tracking-wider"
								data-testid="wizard-button-back"
								disabled={isSubmitting}
								onClick={handleBack}
								type="button"
								variant="ghost"
							>
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back
							</Button>
						)}
					</div>

					{/* Next/Submit Button */}
					<Button
						className="font-mono text-xs uppercase tracking-wider"
						data-testid="wizard-button-next"
						disabled={!canProceed || isSubmitting}
						onClick={handleNext}
						type="button"
					>
						{isSubmitting ? (
							"Creating..."
						) : isLastStep ? (
							<>
								Create Strategy
								<Check className="ml-2 h-4 w-4" />
							</>
						) : (
							<>
								Continue
								<ArrowRight className="ml-2 h-4 w-4" />
							</>
						)}
					</Button>
				</div>
			</div>
		</WizardContext.Provider>
	);
}
