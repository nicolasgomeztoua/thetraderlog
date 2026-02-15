import type { LanguageModel } from "ai";
import { aiGenerateText } from "@/lib/ai/client-v2";
import { WRITER_FEW_SHOT_EXAMPLES } from "./few-shot-examples";

// =============================================================================
// TYPES
// =============================================================================

interface WriterOptions {
	plan: string;
	writerContext: string;
	prompt: string;
	model: LanguageModel;
	dataStoreKeys: string[];
}

interface WriterResult {
	content: string;
	tokensUsed: number;
}

// =============================================================================
// WRITER SYSTEM PROMPT
// =============================================================================

const WRITER_PERSONA = `You are the report writer for EdgeJournal, a professional trading journal. Your ONLY job is to produce a polished MDX report using the analysis plan and gathered data provided to you.

You do NOT have access to any tools. You cannot query data, call analytics, or execute code. All data has already been gathered and is summarized in your context. Use the dataRef keys to reference datasets in MDX components.`;

const WRITER_INSTRUCTIONS = `## Your Task

Write a complete trading performance report in MDX format. Follow these rules:

### Structure
1. Start with a concise **executive summary** (2-3 sentences capturing the key takeaway)
2. Follow the section plan from the Analysis Plan
3. Each section should mix **narrative prose** with **MDX components**
4. End with a **Key Takeaways & Next Steps** section listing 3-5 actionable recommendations

### Writing Style
- Lead with insight, not data — tell the trader what the numbers MEAN
- Cite specific numbers in prose (e.g., "$4,827", "58.3%", "1.4x your average loss")
- Never write vague statements like "your performance was good" — always quantify
- Use active voice and direct language
- Keep paragraphs to 2-3 sentences for readability

### MDX Component Usage
- Use the exact dataRef keys listed in the Data Summary section
- Place MetricGrid groups at the top of major sections for key stats
- Always include all three tooltip fields (what, why, benchmark) for MetricCard
- Place charts/tables after a narrative paragraph that introduces what the reader will see
- Use Callout components for actionable tips (type="tip") and risk warnings (type="warning")
- Do NOT wrap MDX components in code fences — write them inline with markdown

### Available dataRef Keys
The following dataRef keys are available for use in MDX components:
DATAREF_KEYS_PLACEHOLDER

Only use dataRef keys from this list. Using a non-existent key will cause a rendering error.`;

function buildWriterSystemPrompt(
	writerContext: string,
	dataStoreKeys: string[],
): string {
	const keyList =
		dataStoreKeys.length > 0
			? dataStoreKeys.map((key) => `- \`${key}\``).join("\n")
			: "- (no datasets gathered)";

	const instructions = WRITER_INSTRUCTIONS.replace(
		"DATAREF_KEYS_PLACEHOLDER",
		keyList,
	);

	return [
		WRITER_PERSONA,
		writerContext,
		instructions,
		WRITER_FEW_SHOT_EXAMPLES,
	].join("\n\n");
}

// =============================================================================
// WRITER PHASE
// =============================================================================

export async function runWriterPhase(
	options: WriterOptions,
): Promise<WriterResult> {
	const systemPrompt = buildWriterSystemPrompt(
		options.writerContext,
		options.dataStoreKeys,
	);

	const result = await aiGenerateText({
		model: options.model,
		system: systemPrompt,
		messages: [{ role: "user", content: options.prompt }],
	});

	return {
		content: result.text,
		tokensUsed: result.totalTokens,
	};
}
