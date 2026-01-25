"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId } from "react";
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
import { RULE_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/shared";
import type { StrategyRule } from "../strategy-form";
import { useWizard } from "./wizard-container";

/**
 * Step 2 - Rules
 *
 * Captures strategy rules:
 * - Entry Criteria (optional textarea)
 * - Exit Rules (optional textarea)
 * - Checklist Rules (dynamic list with category)
 */
export function StepRules() {
	const { data, updateData, setCanProceed } = useWizard();
	const componentId = useId();

	// Get current rules or empty array
	const rules: StrategyRule[] = data.rules ?? [];

	// All fields are optional, so we can always proceed
	useEffect(() => {
		setCanProceed(true);
	}, [setCanProceed]);

	function handleEntryCriteriaChange(
		e: React.ChangeEvent<HTMLTextAreaElement>,
	) {
		updateData({ entryCriteria: e.target.value });
	}

	function handleExitRulesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
		updateData({ exitRules: e.target.value });
	}

	function addRule(category: StrategyRule["category"]) {
		const newRule: StrategyRule = {
			text: "",
			category,
			order: rules.length,
		};
		updateData({ rules: [...rules, newRule] });
	}

	function updateRule(index: number, updates: Partial<StrategyRule>) {
		const updatedRules = rules.map((rule, i) =>
			i === index ? { ...rule, ...updates } : rule,
		);
		updateData({ rules: updatedRules });
	}

	function removeRule(index: number) {
		const updatedRules = rules
			.filter((_, i) => i !== index)
			.map((rule, i) => ({ ...rule, order: i }));
		updateData({ rules: updatedRules });
	}

	// Group rules by category for display
	const rulesByCategory = RULE_CATEGORIES.reduce(
		(acc, cat) => {
			acc[cat.value] = rules.filter((r) => r.category === cat.value);
			return acc;
		},
		{} as Record<string, StrategyRule[]>,
	);

	return (
		<div className="space-y-8" data-testid="wizard-step-rules">
			{/* Entry Criteria */}
			<div className="space-y-1.5">
				<label
					className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest"
					htmlFor={`${componentId}-entry-criteria`}
				>
					Entry Criteria
				</label>
				<Textarea
					className={cn(
						"w-full font-mono text-base md:text-sm",
						"border-white/10 bg-white/2 placeholder:text-muted-foreground/50",
						"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
					)}
					data-testid="wizard-textarea-entry-criteria"
					id={`${componentId}-entry-criteria`}
					onChange={handleEntryCriteriaChange}
					placeholder="Describe your entry conditions in detail..."
					rows={4}
					value={data.entryCriteria ?? ""}
				/>
				<p className="font-mono text-[10px] text-muted-foreground/60">
					Conditions that must be met before entering a trade.
				</p>
			</div>

			{/* Exit Rules */}
			<div className="space-y-1.5">
				<label
					className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest"
					htmlFor={`${componentId}-exit-rules`}
				>
					Exit Rules
				</label>
				<Textarea
					className={cn(
						"w-full font-mono text-base md:text-sm",
						"border-white/10 bg-white/2 placeholder:text-muted-foreground/50",
						"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
					)}
					data-testid="wizard-textarea-exit-rules"
					id={`${componentId}-exit-rules`}
					onChange={handleExitRulesChange}
					placeholder="Describe your exit conditions..."
					rows={4}
					value={data.exitRules ?? ""}
				/>
				<p className="font-mono text-[10px] text-muted-foreground/60">
					When and how you exit trades (take profit, stop loss, time-based).
				</p>
			</div>

			{/* Checklist Rules */}
			<div className="space-y-4">
				<div className="space-y-1">
					<span className="block font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
						Checklist Rules
					</span>
					<p className="font-mono text-[10px] text-muted-foreground/60">
						These rules will appear as a checklist when you log trades. Add
						rules to each category as needed.
					</p>
				</div>

				{/* Rules grouped by category */}
				<div className="space-y-4">
					{RULE_CATEGORIES.map((category) => {
						const categoryRules = rulesByCategory[category.value] ?? [];
						const categoryLabelId = `${componentId}-${category.value}-label`;

						return (
							<div
								className="rounded border border-white/5 bg-white/2 p-4"
								data-testid={`wizard-rules-category-${category.value}`}
								key={category.value}
							>
								{/* Category Header */}
								<div className="mb-3 flex items-center justify-between">
									<span
										className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
										id={categoryLabelId}
									>
										{category.label}
									</span>
									<Button
										aria-label={`Add ${category.label} rule`}
										className="h-7 font-mono text-[10px] uppercase tracking-wider"
										data-testid={`wizard-button-add-rule-${category.value}`}
										onClick={() =>
											addRule(category.value as StrategyRule["category"])
										}
										size="sm"
										type="button"
										variant="ghost"
									>
										<Plus className="mr-1 h-3 w-3" />
										Add
									</Button>
								</div>

								{/* Rules List */}
								{categoryRules.length === 0 ? (
									<p className="font-mono text-[10px] text-muted-foreground/40 italic">
										No {category.label.toLowerCase()} rules defined
									</p>
								) : (
									<ul aria-labelledby={categoryLabelId} className="space-y-2">
										{categoryRules.map((rule) => {
											const globalIndex = rules.findIndex(
												(r) => r === rule || (r.id && r.id === rule.id),
											);
											const inputId = `${componentId}-rule-${rule.id ?? globalIndex}`;

											return (
												<li
													className="flex items-center gap-2"
													data-testid={`wizard-rule-${rule.id ?? globalIndex}`}
													key={rule.id ?? `rule-${globalIndex}`}
												>
													{/* Category indicator (for visual clarity when editing) */}
													<div
														aria-hidden="true"
														className="hidden h-6 w-1 shrink-0 rounded-full bg-primary/30 sm:block"
													/>

													{/* Rule text input */}
													<Input
														aria-label={`${category.label} rule text`}
														className={cn(
															"flex-1 font-mono text-sm",
															"border-white/10 bg-white/2 placeholder:text-muted-foreground/50",
															"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
														)}
														data-testid={`wizard-rule-input-${rule.id ?? globalIndex}`}
														id={inputId}
														onChange={(e) =>
															updateRule(globalIndex, { text: e.target.value })
														}
														placeholder={`Enter ${category.label.toLowerCase()} rule...`}
														type="text"
														value={rule.text}
													/>

													{/* Category dropdown (for changing category) */}
													<Select
														onValueChange={(v) =>
															updateRule(globalIndex, {
																category: v as StrategyRule["category"],
															})
														}
														value={rule.category}
													>
														<SelectTrigger
															className="h-9 w-24 shrink-0 font-mono text-[10px] sm:w-28"
															data-testid={`wizard-rule-category-${rule.id ?? globalIndex}`}
														>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{RULE_CATEGORIES.map((opt) => (
																<SelectItem key={opt.value} value={opt.value}>
																	{opt.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>

													{/* Delete button */}
													<Button
														aria-label="Remove rule"
														className="h-9 w-9 shrink-0 text-muted-foreground hover:text-loss"
														data-testid={`wizard-rule-delete-${rule.id ?? globalIndex}`}
														onClick={() => removeRule(globalIndex)}
														size="icon"
														type="button"
														variant="ghost"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</li>
											);
										})}
									</ul>
								)}
							</div>
						);
					})}
				</div>

				{/* Summary */}
				{rules.length > 0 && (
					<p
						className="font-mono text-[10px] text-muted-foreground"
						data-testid="wizard-rules-summary"
					>
						{rules.length} rule{rules.length !== 1 ? "s" : ""} defined
					</p>
				)}
			</div>
		</div>
	);
}
