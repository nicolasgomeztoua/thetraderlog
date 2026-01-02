"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
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
import type { RiskParameters } from "./risk-config";
import { RiskConfig } from "./risk-config";
import type { ScalingRules } from "./scaling-config";
import { ScalingConfig } from "./scaling-config";
import type { TrailingRules } from "./trailing-config";
import { TrailingConfig } from "./trailing-config";

// Preset colors following the design system
const PRESET_COLORS = [
	"#d4ff00", // Primary chartreuse
	"#00d4ff", // Accent ice blue
	"#00ff88", // Profit green
	"#f59e0b", // Amber
	"#ec4899", // Pink
	"#8b5cf6", // Purple
	"#14b8a6", // Teal
	"#f97316", // Orange
	"#6366f1", // Indigo
];

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

	const [activeSection, setActiveSection] = useState<string>("basic");

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

	const sections = [
		{ id: "basic", label: "Basic Info" },
		{ id: "strategy", label: "Strategy" },
		{ id: "risk", label: "Risk Management" },
		{ id: "scaling", label: "Scaling" },
		{ id: "trailing", label: "Trailing Stops" },
		{ id: "rules", label: "Rules Checklist" },
	];

	return (
		<form className="space-y-6" onSubmit={handleSubmit}>
			{/* Section Tabs */}
			<div className="flex flex-wrap gap-2 border-border border-b pb-4">
				{sections.map((section) => (
					<button
						className={`rounded px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
							activeSection === section.id
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-white/5"
						}`}
						key={section.id}
						onClick={() => setActiveSection(section.id)}
						type="button"
					>
						{section.label}
					</button>
				))}
			</div>

			{/* Basic Info Section */}
			{activeSection === "basic" && (
				<div className="space-y-6">
					<div className="space-y-1">
						<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
							Strategy Name *
						</span>
						<Input
							className="font-mono"
							onChange={(e) => updateField("name", e.target.value)}
							placeholder="e.g., Trend Continuation"
							required
							value={formData.name}
						/>
					</div>

					<div className="space-y-1">
						<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
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
						<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
							Color
						</span>
						<div className="flex gap-2">
							{PRESET_COLORS.map((color) => (
								<button
									className={`h-8 w-8 rounded border-2 transition-all ${
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
				<div className="space-y-6">
					<div className="space-y-1">
						<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
							Entry Criteria
						</span>
						<Textarea
							className="font-mono"
							onChange={(e) => updateField("entryCriteria", e.target.value)}
							placeholder="Describe your entry criteria in detail..."
							rows={6}
							value={formData.entryCriteria}
						/>
					</div>

					<div className="space-y-1">
						<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
							Exit Rules
						</span>
						<Textarea
							className="font-mono"
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
					<div className="flex items-center justify-between">
						<p className="font-mono text-muted-foreground text-sm">
							Define rules that you&apos;ll check off when taking trades with
							this strategy.
						</p>
						<Button
							className="font-mono text-xs"
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
						<div className="rounded border border-white/5 bg-white/[0.02] py-8 text-center">
							<p className="font-mono text-muted-foreground text-sm">
								No rules defined yet
							</p>
							<Button
								className="mt-4 font-mono text-xs"
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
									className="flex items-center gap-3 rounded border border-white/5 bg-white/[0.02] p-3"
									key={rule.id ?? `new-${rule.order}`}
								>
									<GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/50" />
									<div className="w-28">
										<Select
											onValueChange={(v) =>
												updateRule(idx, {
													category: v as StrategyRule["category"],
												})
											}
											value={rule.category}
										>
											<SelectTrigger className="h-8 font-mono text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{CATEGORY_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<Input
										className="flex-1 font-mono text-sm"
										onChange={(e) => updateRule(idx, { text: e.target.value })}
										placeholder="Enter rule text..."
										value={rule.text}
									/>
									<Button
										className="h-8 w-8 text-muted-foreground hover:text-loss"
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
			<div className="flex items-center justify-end gap-3 border-border border-t pt-6">
				<Button
					className="font-mono text-xs uppercase tracking-wider"
					disabled={isSubmitting || !formData.name}
					type="submit"
				>
					{isSubmitting ? "Saving..." : submitLabel}
				</Button>
			</div>
		</form>
	);
}
