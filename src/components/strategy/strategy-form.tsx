"use client";

import {
	CheckSquare,
	FileText,
	GripVertical,
	Info,
	Layers,
	Plus,
	Shield,
	Trash2,
	TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { PRESET_COLORS } from "@/lib/shared";
import type { RiskParameters } from "./risk-config";
import { RiskConfig } from "./risk-config";
import type { ScalingRules } from "./scaling-config";
import { ScalingConfig } from "./scaling-config";
import type { TrailingRules } from "./trailing-config";
import { TrailingConfig } from "./trailing-config";

export interface StrategyRule {
	id?: string;
	text: string;
	category: "entry" | "exit" | "risk" | "management";
	order: number;
}

export interface StrategyFormData {
	name: string;
	description: string;
	color: string;
	entryCriteria: string;
	exitRules: string;
	riskParameters: RiskParameters | null;
	scalingRules: ScalingRules | null;
	trailingRules: TrailingRules | null;
	isActive: boolean;
	rules: StrategyRule[];
}

interface StrategyFormProps {
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

// Tab sections defined outside component to avoid recreation on each render
const FORM_SECTIONS = [
	{ id: "overview", label: "Overview", icon: Info },
	{ id: "strategy", label: "Strategy", icon: FileText },
	{ id: "risk", label: "Risk", icon: Shield },
	{ id: "scaling", label: "Scaling", icon: Layers },
	{ id: "trailing", label: "Trailing", icon: TrendingUp },
	{ id: "rules", label: "Checklist", icon: CheckSquare },
] as const;

export function StrategyForm({
	initialData,
	onSubmit,
	isSubmitting,
	submitLabel = "Save Strategy",
}: StrategyFormProps) {
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

	// Storage key for persisting active tab
	const STORAGE_KEY = "strategy-form-active-tab";

	// Initialize active section from sessionStorage
	const [activeSection, setActiveSection] = useState<string>(() => {
		if (typeof window !== "undefined") {
			return sessionStorage.getItem(STORAGE_KEY) ?? "overview";
		}
		return "overview";
	});

	// Tab button refs for keyboard navigation
	const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

	// Persist active tab to sessionStorage
	useEffect(() => {
		sessionStorage.setItem(STORAGE_KEY, activeSection);
	}, [activeSection]);

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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit(formData);
	};

	// Keyboard navigation handler
	const handleTabKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
			let nextIndex: number | null = null;

			if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				e.preventDefault();
				nextIndex = (currentIndex + 1) % FORM_SECTIONS.length;
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				e.preventDefault();
				nextIndex =
					(currentIndex - 1 + FORM_SECTIONS.length) % FORM_SECTIONS.length;
			} else if (e.key === "Home") {
				e.preventDefault();
				nextIndex = 0;
			} else if (e.key === "End") {
				e.preventDefault();
				nextIndex = FORM_SECTIONS.length - 1;
			}

			if (nextIndex !== null && nextIndex >= 0 && nextIndex < FORM_SECTIONS.length) {
				const nextTab = tabRefs.current[nextIndex];
				const nextSection = FORM_SECTIONS[nextIndex];
				if (nextTab && nextSection) {
					nextTab.focus();
					setActiveSection(nextSection.id);
				}
			}
		},
		[],
	);

	return (
		<form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
			{/* Section Tabs */}
			<div
				className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
				data-testid="strategy-form-tabs"
			>
				<TooltipProvider delayDuration={300}>
					<div
						aria-label="Strategy sections"
						className="flex gap-1 border-border border-b"
						role="tablist"
					>
						{FORM_SECTIONS.map((section, index) => {
							const Icon = section.icon;
							const isActive = activeSection === section.id;

							return (
								<Tooltip key={section.id}>
									<TooltipTrigger asChild>
										<button
											aria-controls={`tabpanel-${section.id}`}
											aria-selected={isActive}
											className={`relative flex shrink-0 items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary sm:px-4 ${
												isActive
													? "text-foreground"
													: "text-muted-foreground hover:text-foreground/80"
											}`}
											data-testid={`strategy-tab-${section.id}`}
											onClick={() => setActiveSection(section.id)}
											onKeyDown={(e) => handleTabKeyDown(e, index)}
											ref={(el) => {
												tabRefs.current[index] = el;
											}}
											role="tab"
											tabIndex={isActive ? 0 : -1}
											type="button"
										>
											<Icon className="size-4" />
											<span className="hidden sm:inline">{section.label}</span>
											{/* Active indicator - chartreuse underline */}
											{isActive && (
												<span className="-bottom-px absolute inset-x-0 h-0.5 bg-primary" />
											)}
										</button>
									</TooltipTrigger>
									<TooltipContent
										className="font-mono text-xs sm:hidden"
										side="bottom"
									>
										{section.label}
									</TooltipContent>
								</Tooltip>
							);
						})}
					</div>
				</TooltipProvider>
			</div>

			{/* Overview Section (renamed from Basic Info) */}
			{activeSection === "overview" && (
				<div className="space-y-4 sm:space-y-6">
					<div className="space-y-1">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
							Strategy Name *
						</span>
						<Input
							className="min-h-[44px] font-mono sm:min-h-0"
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
						<div className="flex flex-wrap gap-2">
							{PRESET_COLORS.map((color) => (
								<button
									className={`h-9 w-9 rounded border-2 transition-all sm:h-8 sm:w-8 ${
										formData.color === color
											? "scale-110 border-white"
											: "border-transparent hover:border-white/30"
									}`}
									key={color}
									onClick={() => updateField("color", color)}
									style={{ backgroundColor: color }}
									type="button"
								/>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Strategy Section */}
			{activeSection === "strategy" && (
				<div className="space-y-4 sm:space-y-6">
					<div className="space-y-1">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-[11px]">
							Entry Criteria
						</span>
						<Textarea
							className="font-mono text-sm"
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
							onChange={(e) => updateField("exitRules", e.target.value)}
							placeholder="Describe your exit rules in detail..."
							rows={6}
							value={formData.exitRules}
						/>
					</div>
				</div>
			)}

			{/* Risk Management Section */}
			{activeSection === "risk" && (
				<RiskConfig
					onChange={(value) => updateField("riskParameters", value)}
					value={formData.riskParameters}
				/>
			)}

			{/* Scaling Section */}
			{activeSection === "scaling" && (
				<ScalingConfig
					onChange={(value) => updateField("scalingRules", value)}
					value={formData.scalingRules}
				/>
			)}

			{/* Trailing Stops Section */}
			{activeSection === "trailing" && (
				<TrailingConfig
					onChange={(value) => updateField("trailingRules", value)}
					value={formData.trailingRules}
				/>
			)}

			{/* Rules Checklist Section */}
			{activeSection === "rules" && (
				<div className="space-y-4">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<p className="font-mono text-muted-foreground text-xs sm:text-sm">
							Define rules that you&apos;ll check off when taking trades with
							this strategy.
						</p>
						<Button
							className="min-h-[36px] shrink-0 font-mono text-xs sm:min-h-0"
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
										onChange={(e) => updateRule(idx, { text: e.target.value })}
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
			)}

			{/* Submit Button */}
			<div className="flex items-center justify-end gap-3 border-border border-t pt-4 sm:pt-6">
				<Button
					className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:min-h-0 sm:w-auto"
					disabled={isSubmitting || !formData.name}
					type="submit"
				>
					{isSubmitting ? "Saving..." : submitLabel}
				</Button>
			</div>
		</form>
	);
}
