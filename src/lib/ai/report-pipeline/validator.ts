import type { LanguageModel } from "ai";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { aiGenerateText } from "@/lib/ai/client";
import { sanitizeMdxProse } from "@/lib/mdx/sanitize";

// =============================================================================
// TYPES
// =============================================================================

interface ValidatorOptions {
	content: string;
	dataStoreKeys: string[];
	model: LanguageModel;
}

interface ValidatorResult {
	valid: boolean;
	content: string;
	errors: string[];
	tokensUsed: number;
}

// =============================================================================
// KNOWN MDX COMPONENTS — must match src/components/mdx/components.tsx
// =============================================================================

const KNOWN_COMPONENTS = new Set([
	// Chart components (require dataRef)
	"EquityCurve",
	"MonthlyChart",
	"SymbolDistributionChart",
	"DayOfWeekChart",
	"HourHeatmap",
	"SessionChart",
	"RMultipleChart",
	"MonteCarloChart",
	// Display components (require dataRef)
	"CalendarHeatmap",
	"DrawdownTable",
	"SymbolTable",
	"DataTable",
	// Inline components (no dataRef)
	"MetricCard",
	"MetricGrid",
	"Callout",
	"ChartImage",
]);

// Components that require a dataRef attribute
const DATAREF_COMPONENTS = new Set([
	"EquityCurve",
	"MonthlyChart",
	"SymbolDistributionChart",
	"DayOfWeekChart",
	"HourHeatmap",
	"SessionChart",
	"RMultipleChart",
	"MonteCarloChart",
	"CalendarHeatmap",
	"DrawdownTable",
	"SymbolTable",
	"DataTable",
]);

// =============================================================================
// VALIDATION CHECKS
// =============================================================================

// Regex to match JSX/MDX component usage: <ComponentName ... />  or <ComponentName ...>
// Captures: component name + attributes string
const COMPONENT_REGEX =
	/<([A-Z][A-Za-z0-9]*)(\s[^>]*)?\s*\/?>|<([A-Z][A-Za-z0-9]*)(\s[^>]*)?>/g;

// Regex to extract dataRef attribute value: dataRef="value" or dataRef={'value'} or dataRef={`value`}
const DATAREF_REGEX = /dataRef=["'{`]([^"'{`]+)["'}`]/;

interface ParsedComponent {
	name: string;
	dataRef: string | null;
	raw: string;
}

function parseComponents(content: string): ParsedComponent[] {
	const components: ParsedComponent[] = [];
	let match = COMPONENT_REGEX.exec(content);
	while (match) {
		const name = match[1] ?? match[3] ?? "";
		const attrs = match[2] ?? match[4] ?? "";
		const dataRefMatch = DATAREF_REGEX.exec(attrs);
		components.push({
			name,
			dataRef: dataRefMatch?.[1] ?? null,
			raw: match[0],
		});
		match = COMPONENT_REGEX.exec(content);
	}
	return components;
}

function validateComponents(components: ParsedComponent[]): string[] {
	const errors: string[] = [];
	for (const comp of components) {
		if (!KNOWN_COMPONENTS.has(comp.name)) {
			errors.push(
				`Unknown MDX component: <${comp.name}>. Valid components: ${[...KNOWN_COMPONENTS].join(", ")}`,
			);
		}
	}
	return errors;
}

function validateDataRefs(
	components: ParsedComponent[],
	dataStoreKeys: string[],
): string[] {
	const errors: string[] = [];
	const validKeys = new Set(dataStoreKeys);

	for (const comp of components) {
		// Check components that require dataRef
		if (DATAREF_COMPONENTS.has(comp.name) && !comp.dataRef) {
			errors.push(`<${comp.name}> is missing required dataRef attribute`);
		}

		// Check that dataRef values exist in the dataStore
		if (comp.dataRef && !validKeys.has(comp.dataRef)) {
			errors.push(
				`<${comp.name} dataRef="${comp.dataRef}" /> references non-existent data key. Available keys: ${dataStoreKeys.join(", ")}`,
			);
		}
	}
	return errors;
}

async function validateMdxCompilation(content: string): Promise<string[]> {
	try {
		const sanitized = sanitizeMdxProse(content);
		await compileMDX({
			source: sanitized,
			options: {
				mdxOptions: {
					remarkPlugins: [remarkGfm],
					format: "mdx",
				},
			},
		});
		return [];
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return [`MDX compilation error: ${message}`];
	}
}

function runStaticValidation(
	content: string,
	dataStoreKeys: string[],
): string[] {
	const components = parseComponents(content);
	const componentErrors = validateComponents(components);
	const dataRefErrors = validateDataRefs(components, dataStoreKeys);
	return [...componentErrors, ...dataRefErrors];
}

// =============================================================================
// AUTO-REPAIR
// =============================================================================

const MAX_REPAIR_ATTEMPTS = 2;

const REPAIR_SYSTEM_PROMPT = `You are an MDX report repair assistant for EdgeJournal. Your job is to fix errors in an MDX trading report.

You will receive the original MDX content and a list of specific errors. Fix ONLY the listed errors while preserving all other content exactly as-is.

Rules:
- If a component name is unknown, replace it with the closest valid component or remove it
- If a dataRef references a non-existent key, replace with the correct key from the available list or remove the component
- If a component is missing a required dataRef, add a dataRef from the available keys if appropriate, or remove the component
- If there are MDX compilation errors, fix the syntax (unclosed tags, invalid JSX expressions, etc.)
- Do NOT change the narrative text, data values, or report structure
- Do NOT add new components or sections
- Do NOT wrap your output in code fences — return raw MDX content only
- Preserve all formatting and whitespace`;

function buildRepairPrompt(
	content: string,
	errors: string[],
	dataStoreKeys: string[],
): string {
	const errorList = errors.map((e, i) => `${i + 1}. ${e}`).join("\n");
	const keyList =
		dataStoreKeys.length > 0
			? dataStoreKeys.map((k) => `- \`${k}\``).join("\n")
			: "- (none)";

	return `## Errors to Fix

${errorList}

## Available dataRef Keys

${keyList}

## MDX Content to Repair

${content}`;
}

async function attemptRepair(
	content: string,
	errors: string[],
	dataStoreKeys: string[],
	model: LanguageModel,
): Promise<{ content: string; tokensUsed: number }> {
	const userPrompt = buildRepairPrompt(content, errors, dataStoreKeys);

	const result = await aiGenerateText({
		model,
		system: REPAIR_SYSTEM_PROMPT,
		messages: [{ role: "user", content: userPrompt }],
	});

	return {
		content: result.text,
		tokensUsed: result.totalTokens,
	};
}

// =============================================================================
// VALIDATOR PHASE
// =============================================================================

export async function runValidatorPhase(
	options: ValidatorOptions,
): Promise<ValidatorResult> {
	const { content, dataStoreKeys, model } = options;
	let totalTokensUsed = 0;

	// --- Static validation (component names + dataRef keys) ---
	const staticErrors = runStaticValidation(content, dataStoreKeys);

	// --- MDX compilation check ---
	const compilationErrors = await validateMdxCompilation(content);

	const allErrors = [...staticErrors, ...compilationErrors];

	// If no errors, return immediately
	if (allErrors.length === 0) {
		return {
			valid: true,
			content,
			errors: [],
			tokensUsed: 0,
		};
	}

	// --- Auto-repair loop ---
	let currentContent = content;
	let currentErrors = allErrors;

	for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
		const repair = await attemptRepair(
			currentContent,
			currentErrors,
			dataStoreKeys,
			model,
		);
		totalTokensUsed += repair.tokensUsed;
		currentContent = repair.content;

		// Re-validate after repair
		const newStaticErrors = runStaticValidation(currentContent, dataStoreKeys);
		const newCompilationErrors = await validateMdxCompilation(currentContent);
		currentErrors = [...newStaticErrors, ...newCompilationErrors];

		if (currentErrors.length === 0) {
			return {
				valid: true,
				content: currentContent,
				errors: [],
				tokensUsed: totalTokensUsed,
			};
		}
	}

	// Repair failed after max attempts — graceful degradation
	return {
		valid: false,
		content,
		errors: currentErrors,
		tokensUsed: totalTokensUsed,
	};
}
