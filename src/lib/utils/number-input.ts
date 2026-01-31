/**
 * Parse a number input value, returning undefined if empty/invalid.
 * Use this for clearable number inputs to avoid the "0 on clear" problem.
 */
export function parseNumberInput(value: string): number | undefined {
	if (value === "") return undefined;
	const parsed = parseFloat(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Same as parseNumberInput but for integers.
 */
export function parseIntInput(value: string): number | undefined {
	if (value === "") return undefined;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}
