"use client";

import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Position sizing methods
const POSITION_SIZING_METHODS = [
	{ value: "fixed", label: "Fixed Size" },
	{ value: "risk_percent", label: "Risk Percent" },
	{ value: "kelly", label: "Kelly Criterion" },
] as const;

// Limit types (dollars or percent)
const LIMIT_TYPES = [
	{ value: "dollars", label: "$" },
	{ value: "percent", label: "%" },
] as const;

type PositionSizingMethod = "fixed" | "risk_percent" | "kelly";
type LimitType = "dollars" | "percent";

interface RiskParameters {
	positionSizing?: {
		method: PositionSizingMethod;
		fixedSize?: number;
		riskPercent?: number;
		kellyFraction?: number;
	};
	maxRiskPerTrade?: {
		type: LimitType;
		value: number;
	};
	dailyLossLimit?: {
		type: LimitType;
		value: number;
	};
	maxConcurrentPositions?: number;
	minRRRatio?: number;
}

interface RiskParametersEditorProps {
	strategyId: string;
	initialRiskParameters: RiskParameters | null;
}

export function RiskParametersEditor({
	strategyId,
	initialRiskParameters,
}: RiskParametersEditorProps) {
	// Parse initial values
	const initial = initialRiskParameters ?? {};

	// Position sizing state
	const [positionSizingMethod, setPositionSizingMethod] =
		useState<PositionSizingMethod>(initial.positionSizing?.method ?? "fixed");
	const [fixedSize, setFixedSize] = useState<string>(
		initial.positionSizing?.fixedSize?.toString() ?? "",
	);
	const [riskPercent, setRiskPercent] = useState<string>(
		initial.positionSizing?.riskPercent?.toString() ?? "",
	);
	const [kellyFraction, setKellyFraction] = useState<string>(
		initial.positionSizing?.kellyFraction?.toString() ?? "",
	);

	// Max risk per trade state
	const [maxRiskType, setMaxRiskType] = useState<LimitType>(
		initial.maxRiskPerTrade?.type ?? "dollars",
	);
	const [maxRiskValue, setMaxRiskValue] = useState<string>(
		initial.maxRiskPerTrade?.value?.toString() ?? "",
	);

	// Daily loss limit state
	const [dailyLossType, setDailyLossType] = useState<LimitType>(
		initial.dailyLossLimit?.type ?? "dollars",
	);
	const [dailyLossValue, setDailyLossValue] = useState<string>(
		initial.dailyLossLimit?.value?.toString() ?? "",
	);

	// Other fields
	const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<string>(
		initial.maxConcurrentPositions?.toString() ?? "",
	);
	const [minRRRatio, setMinRRRatio] = useState<string>(
		initial.minRRRatio?.toString() ?? "",
	);

	// Save status state
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

	// Refs for debouncing
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSavedDataRef = useRef<string>(JSON.stringify(initial));

	// tRPC autosave mutation
	const utils = api.useUtils();
	const autosaveMutation = api.strategies.autosave.useMutation({
		onMutate: () => {
			setSaveStatus("saving");
		},
		onSuccess: (data) => {
			setSaveStatus("saved");
			setLastSavedAt(data.updatedAt);
			// Update the last saved data reference
			lastSavedDataRef.current = buildRiskParametersJson();
		},
		onError: () => {
			setSaveStatus("error");
		},
		onSettled: () => {
			// Invalidate strategy query to keep cache in sync
			void utils.strategies.getById.invalidate({ id: strategyId });
		},
	});

	// Build risk parameters object from current state
	const buildRiskParameters = useCallback((): RiskParameters => {
		const params: RiskParameters = {};

		// Position sizing
		if (positionSizingMethod) {
			const positionSizing: RiskParameters["positionSizing"] = {
				method: positionSizingMethod,
			};
			if (
				positionSizingMethod === "fixed" &&
				fixedSize &&
				!Number.isNaN(Number(fixedSize))
			) {
				positionSizing.fixedSize = Number(fixedSize);
			}
			if (
				positionSizingMethod === "risk_percent" &&
				riskPercent &&
				!Number.isNaN(Number(riskPercent))
			) {
				positionSizing.riskPercent = Number(riskPercent);
			}
			if (
				positionSizingMethod === "kelly" &&
				kellyFraction &&
				!Number.isNaN(Number(kellyFraction))
			) {
				positionSizing.kellyFraction = Number(kellyFraction);
			}
			params.positionSizing = positionSizing;
		}

		// Max risk per trade
		if (maxRiskValue && !Number.isNaN(Number(maxRiskValue))) {
			params.maxRiskPerTrade = {
				type: maxRiskType,
				value: Number(maxRiskValue),
			};
		}

		// Daily loss limit
		if (dailyLossValue && !Number.isNaN(Number(dailyLossValue))) {
			params.dailyLossLimit = {
				type: dailyLossType,
				value: Number(dailyLossValue),
			};
		}

		// Max concurrent positions
		if (
			maxConcurrentPositions &&
			!Number.isNaN(Number(maxConcurrentPositions))
		) {
			params.maxConcurrentPositions = Number(maxConcurrentPositions);
		}

		// Min R:R ratio
		if (minRRRatio && !Number.isNaN(Number(minRRRatio))) {
			params.minRRRatio = Number(minRRRatio);
		}

		return params;
	}, [
		positionSizingMethod,
		fixedSize,
		riskPercent,
		kellyFraction,
		maxRiskType,
		maxRiskValue,
		dailyLossType,
		dailyLossValue,
		maxConcurrentPositions,
		minRRRatio,
	]);

	// Build JSON string for comparison
	const buildRiskParametersJson = useCallback(() => {
		return JSON.stringify(buildRiskParameters());
	}, [buildRiskParameters]);

	// Debounced save function
	const debouncedSave = useCallback(() => {
		// Clear existing timer
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		const currentJson = buildRiskParametersJson();

		// Check if data has actually changed from last saved state
		if (currentJson === lastSavedDataRef.current) {
			return;
		}

		// Show unsaved changes indicator immediately
		if (saveStatus !== "saving") {
			setSaveStatus("idle");
		}

		// Debounce the actual save
		debounceTimerRef.current = setTimeout(() => {
			const riskParameters = buildRiskParameters();
			autosaveMutation.mutate({
				id: strategyId,
				riskParameters,
			});
		}, 500);
	}, [
		strategyId,
		autosaveMutation,
		saveStatus,
		buildRiskParametersJson,
		buildRiskParameters,
	]);

	// Trigger debounced save when any form value changes
	useEffect(() => {
		debouncedSave();
	}, [debouncedSave]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	// Format the last saved time
	const formatLastSaved = (date: Date) => {
		return date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Determine if there are unsaved changes
	const hasUnsavedChanges =
		buildRiskParametersJson() !== lastSavedDataRef.current;

	return (
		<div className="space-y-8" data-testid="risk-parameters-editor">
			{/* Header with save status */}
			<div className="flex items-center justify-between">
				<h3 className="font-mono font-semibold text-base uppercase tracking-wider">
					Risk Management
				</h3>
				<div
					className="flex items-center gap-2 font-mono text-xs"
					data-testid="risk-parameters-status"
				>
					{saveStatus === "saving" && (
						<>
							<Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
							<span className="text-muted-foreground">Saving...</span>
						</>
					)}
					{saveStatus === "saved" && !hasUnsavedChanges && lastSavedAt && (
						<>
							<Check className="h-3 w-3 text-profit" />
							<span className="text-muted-foreground">
								Saved at {formatLastSaved(lastSavedAt)}
							</span>
						</>
					)}
					{saveStatus === "error" && (
						<span className="text-loss">Failed to save</span>
					)}
					{hasUnsavedChanges && saveStatus !== "saving" && (
						<span className="text-muted-foreground/70">Unsaved</span>
					)}
				</div>
			</div>

			{/* Position Sizing Section */}
			<div
				className="space-y-4 rounded-lg border border-white/5 bg-white/[0.01] p-4"
				data-testid="risk-parameters-position-sizing"
			>
				<h4 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
					Position Sizing
				</h4>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<label
							className="font-mono text-[11px] text-muted-foreground"
							htmlFor="position-sizing-method"
						>
							Method
						</label>
						<Select
							onValueChange={(v) =>
								setPositionSizingMethod(v as PositionSizingMethod)
							}
							value={positionSizingMethod}
						>
							<SelectTrigger
								className="w-full font-mono"
								data-testid="risk-parameters-position-sizing-method"
								id="position-sizing-method"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{POSITION_SIZING_METHODS.map((method) => (
									<SelectItem
										className="font-mono"
										key={method.value}
										value={method.value}
									>
										{method.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Conditional input based on method */}
					{positionSizingMethod === "fixed" && (
						<div className="space-y-2">
							<label
								className="font-mono text-[11px] text-muted-foreground"
								htmlFor="fixed-size"
							>
								Fixed Contracts/Lots
							</label>
							<Input
								className="font-mono"
								data-testid="risk-parameters-fixed-size"
								id="fixed-size"
								onChange={(e) => setFixedSize(e.target.value)}
								placeholder="e.g., 2"
								type="number"
								value={fixedSize}
							/>
						</div>
					)}
					{positionSizingMethod === "risk_percent" && (
						<div className="space-y-2">
							<label
								className="font-mono text-[11px] text-muted-foreground"
								htmlFor="risk-percent"
							>
								Risk % of Account
							</label>
							<Input
								className="font-mono"
								data-testid="risk-parameters-risk-percent"
								id="risk-percent"
								onChange={(e) => setRiskPercent(e.target.value)}
								placeholder="e.g., 1.0"
								step="0.1"
								type="number"
								value={riskPercent}
							/>
						</div>
					)}
					{positionSizingMethod === "kelly" && (
						<div className="space-y-2">
							<label
								className="font-mono text-[11px] text-muted-foreground"
								htmlFor="kelly-fraction"
							>
								Kelly Fraction
							</label>
							<Input
								className="font-mono"
								data-testid="risk-parameters-kelly-fraction"
								id="kelly-fraction"
								onChange={(e) => setKellyFraction(e.target.value)}
								placeholder="e.g., 0.25"
								step="0.05"
								type="number"
								value={kellyFraction}
							/>
						</div>
					)}
				</div>
			</div>

			{/* Risk Limits Section */}
			<div
				className="space-y-4 rounded-lg border border-white/5 bg-white/[0.01] p-4"
				data-testid="risk-parameters-limits"
			>
				<h4 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
					Risk Limits
				</h4>
				<div className="grid gap-6 sm:grid-cols-2">
					{/* Max Risk Per Trade */}
					<div className="space-y-2">
						<label
							className="font-mono text-[11px] text-muted-foreground"
							htmlFor="max-risk-value"
						>
							Max Risk Per Trade
						</label>
						<div className="flex gap-2">
							<Select
								onValueChange={(v) => setMaxRiskType(v as LimitType)}
								value={maxRiskType}
							>
								<SelectTrigger
									className="w-16 shrink-0 font-mono"
									data-testid="risk-parameters-max-risk-type"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{LIMIT_TYPES.map((type) => (
										<SelectItem
											className="font-mono"
											key={type.value}
											value={type.value}
										>
											{type.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								className="flex-1 font-mono"
								data-testid="risk-parameters-max-risk-value"
								id="max-risk-value"
								onChange={(e) => setMaxRiskValue(e.target.value)}
								placeholder={
									maxRiskType === "dollars" ? "e.g., 100" : "e.g., 1"
								}
								step={maxRiskType === "dollars" ? "1" : "0.1"}
								type="number"
								value={maxRiskValue}
							/>
						</div>
					</div>

					{/* Daily Loss Limit */}
					<div className="space-y-2">
						<label
							className="font-mono text-[11px] text-muted-foreground"
							htmlFor="daily-loss-value"
						>
							Daily Loss Limit
						</label>
						<div className="flex gap-2">
							<Select
								onValueChange={(v) => setDailyLossType(v as LimitType)}
								value={dailyLossType}
							>
								<SelectTrigger
									className="w-16 shrink-0 font-mono"
									data-testid="risk-parameters-daily-loss-type"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{LIMIT_TYPES.map((type) => (
										<SelectItem
											className="font-mono"
											key={type.value}
											value={type.value}
										>
											{type.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								className="flex-1 font-mono"
								data-testid="risk-parameters-daily-loss-value"
								id="daily-loss-value"
								onChange={(e) => setDailyLossValue(e.target.value)}
								placeholder={
									dailyLossType === "dollars" ? "e.g., 500" : "e.g., 2"
								}
								step={dailyLossType === "dollars" ? "1" : "0.1"}
								type="number"
								value={dailyLossValue}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Position Controls Section */}
			<div
				className="space-y-4 rounded-lg border border-white/5 bg-white/[0.01] p-4"
				data-testid="risk-parameters-controls"
			>
				<h4 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
					Position Controls
				</h4>
				<div className="grid gap-6 sm:grid-cols-2">
					{/* Max Concurrent Positions */}
					<div className="space-y-2">
						<label
							className="font-mono text-[11px] text-muted-foreground"
							htmlFor="max-concurrent"
						>
							Max Concurrent Positions
						</label>
						<Input
							className="font-mono"
							data-testid="risk-parameters-max-concurrent"
							id="max-concurrent"
							min="1"
							onChange={(e) => setMaxConcurrentPositions(e.target.value)}
							placeholder="e.g., 3"
							type="number"
							value={maxConcurrentPositions}
						/>
					</div>

					{/* Min R:R Ratio */}
					<div className="space-y-2">
						<label
							className="font-mono text-[11px] text-muted-foreground"
							htmlFor="min-rr-ratio"
						>
							Minimum R:R Ratio
						</label>
						<Input
							className="font-mono"
							data-testid="risk-parameters-min-rr"
							id="min-rr-ratio"
							min="0.1"
							onChange={(e) => setMinRRRatio(e.target.value)}
							placeholder="e.g., 2.0"
							step="0.1"
							type="number"
							value={minRRRatio}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
