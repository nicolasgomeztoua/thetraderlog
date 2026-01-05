"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	type ConditionOperator,
	FILTER_FIELD_CONFIGS,
	type FilterField,
	getFieldConfig,
	getOperatorsForField,
	OPERATOR_LABELS,
	type QueryCondition as QueryConditionType,
} from "@/types/query-builder";

// =============================================================================
// CONSTANTS
// =============================================================================

const DAY_OPTIONS = [
	{ value: "0", label: "Sunday" },
	{ value: "1", label: "Monday" },
	{ value: "2", label: "Tuesday" },
	{ value: "3", label: "Wednesday" },
	{ value: "4", label: "Thursday" },
	{ value: "5", label: "Friday" },
	{ value: "6", label: "Saturday" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
	value: String(i),
	label: `${i.toString().padStart(2, "0")}:00`,
}));

const OUTCOME_OPTIONS = [
	{ value: "win", label: "Win" },
	{ value: "loss", label: "Loss" },
	{ value: "breakeven", label: "Breakeven" },
];

const REVIEWED_OPTIONS = [
	{ value: "true", label: "Reviewed" },
	{ value: "false", label: "Not reviewed" },
];

// =============================================================================
// TYPES
// =============================================================================

interface FilterOption {
	id: string;
	name: string;
	color?: string;
}

interface QueryConditionProps {
	condition: QueryConditionType;
	onChange: (condition: QueryConditionType) => void;
	onRemove: () => void;
	/** Available symbols */
	symbols?: string[];
	/** Available strategies */
	strategies?: FilterOption[];
	/** Available tags */
	tags?: FilterOption[];
	/** Available sessions */
	sessions?: FilterOption[];
	/** Can this condition be removed? */
	canRemove?: boolean;
}

// =============================================================================
// VALUE INPUT COMPONENTS
// =============================================================================

function StringValueInput({
	value,
	onChange,
	placeholder = "Enter value...",
}: {
	value: unknown;
	onChange: (value: string) => void;
	placeholder?: string;
}) {
	return (
		<Input
			className="h-8 w-32 font-mono text-xs"
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
			value={typeof value === "string" ? value : ""}
		/>
	);
}

function NumberValueInput({
	value,
	onChange,
	placeholder = "0",
	step = 1,
}: {
	value: unknown;
	onChange: (value: number | null) => void;
	placeholder?: string;
	step?: number;
}) {
	return (
		<Input
			className="h-8 w-24 font-mono text-xs"
			onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
			placeholder={placeholder}
			step={step}
			type="number"
			value={typeof value === "number" ? value : ""}
		/>
	);
}

function BetweenValueInput({
	value,
	onChange,
	step = 1,
}: {
	value: unknown;
	onChange: (value: { min: number | null; max: number | null }) => void;
	step?: number;
}) {
	const currentValue =
		typeof value === "object" && value !== null
			? (value as { min: number | null; max: number | null })
			: { min: null, max: null };

	return (
		<div className="flex items-center gap-2">
			<Input
				className="h-8 w-20 font-mono text-xs"
				onChange={(e) =>
					onChange({
						...currentValue,
						min: e.target.value ? Number(e.target.value) : null,
					})
				}
				placeholder="Min"
				step={step}
				type="number"
				value={currentValue.min ?? ""}
			/>
			<span className="font-mono text-muted-foreground text-xs">and</span>
			<Input
				className="h-8 w-20 font-mono text-xs"
				onChange={(e) =>
					onChange({
						...currentValue,
						max: e.target.value ? Number(e.target.value) : null,
					})
				}
				placeholder="Max"
				step={step}
				type="number"
				value={currentValue.max ?? ""}
			/>
		</div>
	);
}

function DateValueInput({
	value,
	onChange,
}: {
	value: unknown;
	onChange: (value: Date | null) => void;
}) {
	const formatForInput = (date: Date | null | unknown) => {
		if (!date || !(date instanceof Date)) return "";
		return format(date, "yyyy-MM-dd");
	};

	return (
		<div className="relative">
			<CalendarIcon className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
			<Input
				className="h-8 w-36 pl-9 font-mono text-xs"
				onChange={(e) =>
					onChange(e.target.value ? new Date(e.target.value) : null)
				}
				type="date"
				value={formatForInput(value)}
			/>
		</div>
	);
}

function DateBetweenValueInput({
	value,
	onChange,
}: {
	value: unknown;
	onChange: (value: { start: Date | null; end: Date | null }) => void;
}) {
	const currentValue =
		typeof value === "object" && value !== null
			? (value as { start: Date | null; end: Date | null })
			: { start: null, end: null };

	const formatForInput = (date: Date | null | unknown) => {
		if (!date || !(date instanceof Date)) return "";
		return format(date, "yyyy-MM-dd");
	};

	return (
		<div className="flex items-center gap-2">
			<div className="relative">
				<CalendarIcon className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3 text-muted-foreground" />
				<Input
					className="h-8 w-32 pl-8 font-mono text-xs"
					onChange={(e) =>
						onChange({
							...currentValue,
							start: e.target.value ? new Date(e.target.value) : null,
						})
					}
					type="date"
					value={formatForInput(currentValue.start)}
				/>
			</div>
			<span className="font-mono text-muted-foreground text-xs">and</span>
			<div className="relative">
				<CalendarIcon className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3 text-muted-foreground" />
				<Input
					className="h-8 w-32 pl-8 font-mono text-xs"
					onChange={(e) =>
						onChange({
							...currentValue,
							end: e.target.value ? new Date(e.target.value) : null,
						})
					}
					type="date"
					value={formatForInput(currentValue.end)}
				/>
			</div>
		</div>
	);
}

function SelectValueInput({
	value,
	onChange,
	options,
	placeholder = "Select...",
}: {
	value: unknown;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
	placeholder?: string;
}) {
	return (
		<Select
			onValueChange={onChange}
			value={typeof value === "string" ? value : ""}
		>
			<SelectTrigger className="h-8 w-32 font-mono text-xs">
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{options.map((opt) => (
					<SelectItem
						className="font-mono text-xs"
						key={opt.value}
						value={opt.value}
					>
						{opt.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function MultiSelectValueInput({
	value,
	onChange,
	options,
	placeholder = "Select...",
}: {
	value: unknown;
	onChange: (value: string[]) => void;
	options: { value: string; label: string }[];
	placeholder?: string;
}) {
	const selectedValues = Array.isArray(value) ? (value as string[]) : [];

	const toggleOption = useCallback(
		(optValue: string) => {
			if (selectedValues.includes(optValue)) {
				onChange(selectedValues.filter((v) => v !== optValue));
			} else {
				onChange([...selectedValues, optValue]);
			}
		},
		[selectedValues, onChange],
	);

	return (
		<div className="flex max-w-[200px] flex-wrap gap-1">
			{options.map((opt) => {
				const isSelected = selectedValues.includes(opt.value);
				return (
					<button
						className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
							isSelected
								? "border-primary bg-primary/10 text-primary"
								: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20"
						}`}
						key={opt.value}
						onClick={() => toggleOption(opt.value)}
						type="button"
					>
						{opt.label}
					</button>
				);
			})}
			{options.length === 0 && (
				<span className="font-mono text-muted-foreground text-xs">
					{placeholder}
				</span>
			)}
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function QueryCondition({
	condition,
	onChange,
	onRemove,
	symbols = [],
	strategies = [],
	tags = [],
	sessions = [],
	canRemove = true,
}: QueryConditionProps) {
	const availableOperators = useMemo(
		() => getOperatorsForField(condition.field),
		[condition.field],
	);

	// Update field and reset operator/value to defaults
	const handleFieldChange = useCallback(
		(field: FilterField) => {
			const newConfig = getFieldConfig(field);
			const newOperator = newConfig.operators[0] ?? "equals";
			onChange({
				...condition,
				field,
				operator: newOperator,
				value: getDefaultValueForOperator(field, newOperator),
			});
		},
		[condition, onChange],
	);

	// Update operator and potentially reset value
	const handleOperatorChange = useCallback(
		(operator: ConditionOperator) => {
			onChange({
				...condition,
				operator,
				value: getDefaultValueForOperator(condition.field, operator),
			});
		},
		[condition, onChange],
	);

	// Update value
	const handleValueChange = useCallback(
		(value: unknown) => {
			onChange({
				...condition,
				value,
			});
		},
		[condition, onChange],
	);

	// Render the appropriate value input based on field and operator
	const renderValueInput = () => {
		const { field, operator, value } = condition;

		// Handle "between" operators
		if (operator === "between") {
			if (field === "date") {
				return (
					<DateBetweenValueInput onChange={handleValueChange} value={value} />
				);
			}
			return (
				<BetweenValueInput
					onChange={handleValueChange}
					step={field === "rMultiple" ? 0.1 : 1}
					value={value}
				/>
			);
		}

		// Handle multi-select operators
		if (
			operator === "is_one_of" ||
			operator === "has_any" ||
			operator === "has_all"
		) {
			const options = getOptionsForField(field, {
				symbols,
				strategies,
				tags,
				sessions,
			});
			return (
				<MultiSelectValueInput
					onChange={handleValueChange}
					options={options}
					placeholder="Select options..."
					value={value}
				/>
			);
		}

		// Handle single value inputs by field type
		switch (field) {
			case "symbol":
				return (
					<SelectValueInput
						onChange={handleValueChange}
						options={symbols.map((s) => ({ value: s, label: s }))}
						placeholder="Select symbol"
						value={value}
					/>
				);

			case "dayOfWeek":
				return (
					<SelectValueInput
						onChange={(v) => handleValueChange(Number(v))}
						options={DAY_OPTIONS}
						placeholder="Select day"
						value={String(value)}
					/>
				);

			case "hour":
				return (
					<SelectValueInput
						onChange={(v) => handleValueChange(Number(v))}
						options={HOUR_OPTIONS}
						placeholder="Select hour"
						value={String(value)}
					/>
				);

			case "session":
				return (
					<SelectValueInput
						onChange={handleValueChange}
						options={sessions.map((s) => ({ value: s.id, label: s.name }))}
						placeholder="Select session"
						value={value}
					/>
				);

			case "strategy":
				return (
					<SelectValueInput
						onChange={handleValueChange}
						options={strategies.map((s) => ({ value: s.id, label: s.name }))}
						placeholder="Select strategy"
						value={value}
					/>
				);

			case "tag":
				return (
					<MultiSelectValueInput
						onChange={handleValueChange}
						options={tags.map((t) => ({ value: t.id, label: t.name }))}
						placeholder="Select tags"
						value={value}
					/>
				);

			case "outcome":
				return (
					<SelectValueInput
						onChange={handleValueChange}
						options={OUTCOME_OPTIONS}
						placeholder="Select outcome"
						value={value}
					/>
				);

			case "reviewed":
				return (
					<SelectValueInput
						onChange={(v) => handleValueChange(v === "true")}
						options={REVIEWED_OPTIONS}
						placeholder="Select status"
						value={String(value)}
					/>
				);

			case "rMultiple":
			case "positionSize":
			case "pnl":
				return (
					<NumberValueInput
						onChange={handleValueChange}
						placeholder="0"
						step={field === "rMultiple" ? 0.1 : 1}
						value={value}
					/>
				);

			case "date":
				return <DateValueInput onChange={handleValueChange} value={value} />;

			default:
				return (
					<StringValueInput
						onChange={handleValueChange}
						placeholder="Enter value"
						value={value}
					/>
				);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			{/* Field selector */}
			<Select
				onValueChange={(v) => handleFieldChange(v as FilterField)}
				value={condition.field}
			>
				<SelectTrigger className="h-8 w-32 font-mono text-xs">
					<SelectValue placeholder="Field" />
				</SelectTrigger>
				<SelectContent>
					{FILTER_FIELD_CONFIGS.map((config) => (
						<SelectItem
							className="font-mono text-xs"
							key={config.field}
							value={config.field}
						>
							{config.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{/* Operator selector */}
			<Select
				onValueChange={(v) => handleOperatorChange(v as ConditionOperator)}
				value={condition.operator}
			>
				<SelectTrigger className="h-8 w-36 font-mono text-xs">
					<SelectValue placeholder="Operator" />
				</SelectTrigger>
				<SelectContent>
					{availableOperators.map((op) => (
						<SelectItem className="font-mono text-xs" key={op} value={op}>
							{OPERATOR_LABELS[op]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{/* Value input */}
			{renderValueInput()}

			{/* Remove button */}
			{canRemove && (
				<Button
					className="h-8 w-8 text-muted-foreground hover:text-destructive"
					onClick={onRemove}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<X className="size-4" />
				</Button>
			)}
		</div>
	);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDefaultValueForOperator(
	field: FilterField,
	operator: ConditionOperator,
): unknown {
	if (operator === "between") {
		if (field === "date") {
			return { start: null, end: null };
		}
		return { min: null, max: null };
	}

	if (
		operator === "is_one_of" ||
		operator === "has_any" ||
		operator === "has_all"
	) {
		return [];
	}

	const config = getFieldConfig(field);
	switch (config.type) {
		case "string":
			return "";
		case "number":
			return null;
		case "boolean":
			return true;
		case "date":
			return null;
		case "array":
			return [];
		default:
			return null;
	}
}

function getOptionsForField(
	field: FilterField,
	data: {
		symbols: string[];
		strategies: FilterOption[];
		tags: FilterOption[];
		sessions: FilterOption[];
	},
): { value: string; label: string }[] {
	switch (field) {
		case "symbol":
			return data.symbols.map((s) => ({ value: s, label: s }));
		case "dayOfWeek":
			return DAY_OPTIONS;
		case "hour":
			return HOUR_OPTIONS;
		case "session":
			return data.sessions.map((s) => ({ value: s.id, label: s.name }));
		case "strategy":
			return data.strategies.map((s) => ({ value: s.id, label: s.name }));
		case "tag":
			return data.tags.map((t) => ({ value: t.id, label: t.name }));
		case "outcome":
			return OUTCOME_OPTIONS;
		case "reviewed":
			return REVIEWED_OPTIONS;
		default:
			return [];
	}
}
