// =============================================================================
// QUERY BUILDER TYPES
// Advanced filtering with AND/OR logic support
// =============================================================================

/**
 * Available filter fields for query builder
 */
export type FilterField =
	| "symbol"
	| "dayOfWeek"
	| "hour"
	| "session"
	| "strategy"
	| "tag"
	| "outcome"
	| "reviewed"
	| "rMultiple"
	| "positionSize"
	| "pnl"
	| "date";

/**
 * Available operators for different field types
 */
export type ConditionOperator =
	| "equals"
	| "not_equals"
	| "greater_than"
	| "less_than"
	| "between"
	| "is_one_of"
	| "has_any"
	| "has_all"
	| "after"
	| "before";

/**
 * Field type determines which operators and value inputs are available
 */
export type FieldType = "string" | "number" | "boolean" | "date" | "array";

/**
 * Configuration for each filter field
 */
export interface FilterFieldConfig {
	field: FilterField;
	label: string;
	type: FieldType;
	operators: ConditionOperator[];
}

/**
 * All available filter field configurations
 */
export const FILTER_FIELD_CONFIGS: FilterFieldConfig[] = [
	{
		field: "symbol",
		label: "Symbol",
		type: "string",
		operators: ["equals", "not_equals", "is_one_of"],
	},
	{
		field: "dayOfWeek",
		label: "Day of Week",
		type: "number",
		operators: ["equals", "is_one_of"],
	},
	{
		field: "hour",
		label: "Hour",
		type: "number",
		operators: ["equals", "between", "is_one_of"],
	},
	{
		field: "session",
		label: "Session",
		type: "string",
		operators: ["equals", "is_one_of"],
	},
	{
		field: "strategy",
		label: "Strategy",
		type: "string",
		operators: ["equals", "not_equals", "is_one_of"],
	},
	{
		field: "tag",
		label: "Tags",
		type: "array",
		operators: ["has_any", "has_all"],
	},
	{
		field: "outcome",
		label: "Outcome",
		type: "string",
		operators: ["equals"],
	},
	{
		field: "reviewed",
		label: "Reviewed",
		type: "boolean",
		operators: ["equals"],
	},
	{
		field: "rMultiple",
		label: "R-Multiple",
		type: "number",
		operators: ["equals", "greater_than", "less_than", "between"],
	},
	{
		field: "positionSize",
		label: "Position Size",
		type: "number",
		operators: ["equals", "greater_than", "less_than", "between"],
	},
	{
		field: "pnl",
		label: "P&L",
		type: "number",
		operators: ["greater_than", "less_than", "between"],
	},
	{
		field: "date",
		label: "Date",
		type: "date",
		operators: ["equals", "between", "after", "before"],
	},
];

/**
 * Operator labels for display
 */
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
	equals: "equals",
	not_equals: "does not equal",
	greater_than: "greater than",
	less_than: "less than",
	between: "between",
	is_one_of: "is one of",
	has_any: "has any of",
	has_all: "has all of",
	after: "after",
	before: "before",
};

/**
 * A single query condition
 */
export interface QueryCondition {
	id: string;
	field: FilterField;
	operator: ConditionOperator;
	value: unknown; // Type depends on field + operator
}

/**
 * A group of conditions with AND/OR logic
 */
export interface QueryGroup {
	id: string;
	logic: "AND" | "OR";
	conditions: QueryCondition[];
}

/**
 * The complete query builder state
 */
export interface QueryBuilderState {
	logic: "AND" | "OR"; // Logic between groups
	groups: QueryGroup[];
}

/**
 * Default empty query state
 */
export const DEFAULT_QUERY_STATE: QueryBuilderState = {
	logic: "AND",
	groups: [],
};

/**
 * Get the field configuration for a given field
 */
export function getFieldConfig(field: FilterField): FilterFieldConfig {
	const config = FILTER_FIELD_CONFIGS.find((c) => c.field === field);
	if (!config) {
		throw new Error(`Unknown field: ${field}`);
	}
	return config;
}

/**
 * Get available operators for a field
 */
export function getOperatorsForField(field: FilterField): ConditionOperator[] {
	return getFieldConfig(field).operators;
}

/**
 * Get the default operator for a field
 */
export function getDefaultOperator(field: FilterField): ConditionOperator {
	const operators = getOperatorsForField(field);
	return operators[0] ?? "equals";
}

/**
 * Get the default value for a field type
 */
export function getDefaultValue(field: FilterField): unknown {
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

/**
 * Generate a unique ID for conditions/groups
 */
export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new empty condition
 */
export function createCondition(field: FilterField = "symbol"): QueryCondition {
	return {
		id: generateId(),
		field,
		operator: getDefaultOperator(field),
		value: getDefaultValue(field),
	};
}

/**
 * Create a new empty group with one condition
 */
export function createGroup(): QueryGroup {
	return {
		id: generateId(),
		logic: "AND",
		conditions: [createCondition()],
	};
}

/**
 * Check if a query has any conditions
 */
export function hasConditions(query: QueryBuilderState): boolean {
	return query.groups.some((g) => g.conditions.length > 0);
}

/**
 * Count total conditions across all groups
 */
export function countConditions(query: QueryBuilderState): number {
	return query.groups.reduce((sum, g) => sum + g.conditions.length, 0);
}
