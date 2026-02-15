import type { LanguageModel } from "ai";
import { aiGenerateObject } from "@/lib/ai/client";
import { WRITER_FEW_SHOT_EXAMPLES } from "./few-shot-examples";
import type { StructuredReport } from "./report-schema";
import { structuredReportSchema } from "./report-schema";

// =============================================================================
// TYPES
// =============================================================================

interface WriterOptions {
	plan: string;
	writerContext: string;
	prompt: string;
	model: LanguageModel;
}

interface WriterResult {
	report: StructuredReport;
	tokensUsed: number;
}

// =============================================================================
// WRITER SYSTEM PROMPT
// =============================================================================

const WRITER_PERSONA = `You are the report writer for EdgeJournal, a professional trading journal. Your ONLY job is to produce a structured JSON report using the analysis plan and gathered data provided to you.

You do NOT have access to any tools. You cannot query data, call analytics, or execute code. All data has already been gathered and is summarized in your context. Use the dataRef keys to reference datasets in chart blocks.`;

const WRITER_INSTRUCTIONS = `## Your Task

Produce a structured trading performance report as JSON. The output must conform to the provided Zod schema. Follow these rules:

### Structure
1. Start with a concise **executiveSummary** (2-3 sentences capturing the key takeaway)
2. Follow the section plan from the Analysis Plan
3. Each section has a **heading** and an array of **blocks** — mix prose, metrics, chart, and callout blocks naturally
4. End with **keyTakeaways** — 3-5 actionable recommendations as an array of strings

### Block Types
- **prose**: Use for narrative analysis. Content is markdown-formatted. Lead with insight, not data.
- **metrics**: Use for key stats at the top of major sections. Each item needs title, value, and tooltip (what, why, benchmark). Optional colorClass (e.g. "text-profit", "text-loss") and description.
- **chart**: References a gathered dataset via dataRef. Only use dataRef keys from the Data Summary. The component field must be one of the enum values (EquityCurve, MonthlyChart, etc.).
- **callout**: Use for actionable tips (calloutType="tip") and risk warnings (calloutType="warning"). Content is markdown.
- **image**: For Python-generated chart images. Use src, alt, and optional caption.

### Writing Style
- Lead with insight, not data — tell the trader what the numbers MEAN
- Cite specific numbers in prose (e.g., "$4,827", "58.3%", "1.4x your average loss")
- Never write vague statements like "your performance was good" — always quantify
- Use active voice and direct language
- Keep prose blocks to 2-3 sentences for readability

### Chart Block Rules
- Place charts after a prose block that introduces what the reader will see
- Use the exact dataRef keys listed in the Data Summary
- The component field must match the dataset type (e.g., EquityCurve for equity data)

### DataRef Integrity Rules (CRITICAL)
- ONLY use dataRef keys from the "Available dataRef keys" list in the Data Summary — **never invent or guess keys**
- If the analysis plan mentions a dataset that is NOT in the available keys list, skip the chart block and use prose to discuss the topic instead
- Common mistake: the plan says "monthly-pnl" but the actual key is "monthly-data" — ALWAYS use the ACTUAL key from the Data Summary, not what the plan says
- Every dataRef in a chart block MUST match one of the keys exactly — a single typo causes a rendering error

### Data Accuracy Rules (CRITICAL)
- Every factual claim you write MUST be directly supported by the data shown in the Data Summary
- **Never** write "every", "always", "never", "all trades" unless literally ALL rows in the data confirm it
- Cross-check superlatives: before writing "your best day" or "worst loss", verify against the actual min/max values in the data
- If the Data Summary shows only a preview (not FULL DATA), qualify statements with "based on available data" or "among the sampled trades"
- If the data shows a contradictory case, you MUST acknowledge it — do not write sweeping claims that ignore outliers

### When to Skip Chart Blocks
- If the Data Summary includes a WARNING for a dataset, do NOT use a chart block for it
- **1-2 data points**: Use metrics blocks and prose only — a chart with 1-2 items is misleading
- **3-4 data points**: Use metrics blocks — charts need more density to be useful
- **5+ data points**: Charts are appropriate
- When skipping a chart, briefly explain why in a prose block: "With only [N] trades having stop-loss data, a histogram would be misleading. Here are the key metrics instead:"
- Use a callout with calloutType="note" to guide the user: "As you log more trades with defined stop losses, future reports will include a full R-multiple distribution chart."`;

function buildWriterSystemPrompt(writerContext: string): string {
	return [
		WRITER_PERSONA,
		writerContext,
		WRITER_INSTRUCTIONS,
		WRITER_FEW_SHOT_EXAMPLES,
	].join("\n\n");
}

// =============================================================================
// WRITER PHASE
// =============================================================================

export async function runWriterPhase(
	options: WriterOptions,
): Promise<WriterResult> {
	const systemPrompt = buildWriterSystemPrompt(options.writerContext);

	const result = await aiGenerateObject({
		model: options.model,
		system: systemPrompt,
		messages: [{ role: "user", content: options.prompt }],
		schema: structuredReportSchema,
	});

	return {
		report: result.object,
		tokensUsed: result.totalTokens,
	};
}
