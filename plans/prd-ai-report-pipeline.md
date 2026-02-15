# PRD: Multi-Phase AI Report Pipeline + Vercel AI SDK Migration

## Overview

Replace the hand-rolled OpenRouter client and single-loop report generation with a proper agent harness using Vercel AI SDK. Reports move from a single 20-round tool-calling loop to a 4-phase pipeline (Plan → Gather → Write → Validate) that produces higher-quality output through context separation, structured planning, and automatic repair of broken MDX/dataRefs. Chat mode also migrated to Vercel AI SDK for consistency.

## Goals

- Migrate all AI client code from hand-rolled OpenRouter fetch to Vercel AI SDK (`ai` + `@ai-sdk/openai`)
- Split report generation into 4 discrete phases with phase-specific prompts and context
- Reduce context noise in the writer phase by only providing gathered data + MDX catalog (no schema/SQL docs)
- Add automatic validation and self-repair of broken MDX output and missing dataRefs
- Add report templates (Monthly Review, Risk Audit, Strategy Comparison) for consistent, structured output
- Improve prompt quality with few-shot examples of excellent MDX reports
- Maintain backward compatibility — existing reports, chat, and all UI remain unchanged

## Non-Goals (Out of Scope)

- Streaming/live preview of report generation (future effort)
- Changing the report viewer, PDF generation, or email notification
- Switching LLM models (keep GLM-5 for reports, Kimi-K2 for chat)
- Changing the MDX component catalog or adding new chart types
- Billing or usage tracking changes
- UI changes of any kind

## User Stories

### US-000: Audit Existing AI Code + Vercel AI SDK Patterns

**Description**: As a developer, I want to audit the current AI implementation and understand Vercel AI SDK patterns so that the migration is informed and we reuse existing code.

**Acceptance Criteria**:
- [ ] Document all imports/usages of `src/lib/ai/client.ts` across the codebase
- [ ] Document all tool definitions in `src/lib/ai/tools/` — their JSON Schema shapes and executor functions
- [ ] Document the chat flow in `src/server/api/routers/ai.ts` — how tool loops work, how messages are saved
- [ ] Document the report flow in `src/trigger/generate-ai-report.ts` — phases, progress tracking, dataStore
- [ ] Research Vercel AI SDK patterns: `generateText` with `maxSteps`, `streamText`, `tool()` with Zod, OpenRouter provider setup via `createOpenAI({ baseURL })`
- [ ] Document migration mapping: which current functions map to which SDK functions
- [ ] Write findings to `scripts/ralph/progress.txt`
- [ ] Typecheck passes (`bun run check`)

---

### US-001: Install Vercel AI SDK + OpenRouter Provider

**Description**: As a developer, I want the Vercel AI SDK installed with an OpenRouter-compatible provider so that all subsequent stories can use it.

**Acceptance Criteria**:
- [ ] Install packages: `bun add ai @ai-sdk/openai`
- [ ] Create `src/lib/ai/provider.ts` — configure OpenRouter provider using `createOpenAI` with `baseURL: "https://openrouter.ai/api/v1"` and `apiKey` from env
- [ ] Export helper functions: `getModel(modelId: string)` that returns a Vercel AI SDK model instance
- [ ] Export default models: `getChatModel()` → uses `DEFAULT_CHAT_MODEL`, `getReportModel()` → uses `DEFAULT_REPORT_MODEL`
- [ ] Include OpenRouter-specific headers (`HTTP-Referer`, `X-Title`) via provider config
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: Migrate Tool Definitions to Vercel AI SDK Format

**Description**: As a developer, I want all AI tool definitions converted to Vercel AI SDK's `tool()` format with Zod schemas so that they work with `generateText` and `streamText`.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/tools/definitions.ts` with Vercel AI SDK tool definitions
- [ ] Convert each tool's JSON Schema parameters to Zod schemas:
  - `run_query`: `z.object({ query: z.string() })`
  - `call_analytics`: `z.object({ router: z.string(), endpoint: z.string(), input: z.record(z.unknown()).optional() })`
  - `get_market_data`: `z.object({ symbol: z.string(), interval: z.string(), startDate: z.string(), endDate: z.string() })`
  - `run_python`: `z.object({ code: z.string(), dataContext: z.string().optional() })`
  - `store_report_data`: `z.object({ refId: z.string(), description: z.string(), data: z.unknown() })`
- [ ] Each tool definition includes `description` matching the existing descriptions
- [ ] Each tool has an `execute` function that calls the existing executor (reuse `executeRunQuery`, `executeCallAnalytics`, etc.)
- [ ] Export `getChatTools(context)` and `getReportTools(context)` that return tool maps with context (userId, db, dataStore) bound
- [ ] Existing `src/lib/ai/tools/index.ts` exports preserved for backward compatibility during migration
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Replace AI Client with Vercel AI SDK

**Description**: As a developer, I want to replace the hand-rolled OpenRouter client (`src/lib/ai/client.ts`) with Vercel AI SDK functions so that all AI calls use the new SDK.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/client-v2.ts` (new file, coexists with old client during migration)
- [ ] Export `aiGenerateText(options)` — wraps Vercel AI SDK `generateText()` with:
  - Model from provider
  - System prompt, messages, tools, maxSteps
  - Returns `{ text, toolCalls, toolResults, usage, steps }`
- [ ] Export `aiStreamText(options)` — wraps `streamText()` with same config
- [ ] Both functions handle OpenRouter errors and map to existing `OpenRouterError` format
- [ ] Token usage extracted from Vercel AI SDK response (`usage.totalTokens`, etc.)
- [ ] Retry logic: Vercel AI SDK doesn't auto-retry, so wrap with existing exponential backoff for 429/5xx
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Migrate Chat to Vercel AI SDK

**Description**: As a developer, I want the chat tool-calling loop in `ai.ts` router to use Vercel AI SDK so that chat and reports share the same SDK.

**Acceptance Criteria**:
- [ ] Update `src/server/api/routers/ai.ts` `sendMessage` procedure to use `aiGenerateText` from `client-v2.ts`
- [ ] Replace manual for-loop with `maxSteps: MAX_TOOL_ROUNDS_CHAT` — Vercel AI SDK handles the tool loop automatically
- [ ] Tools provided via `getChatTools(context)` from the new definitions
- [ ] System prompt building unchanged (same `buildSystemPrompt` call)
- [ ] Message format conversion: map existing `ChatMessage[]` to Vercel AI SDK `CoreMessage[]` format
- [ ] Token usage still tracked from response (`usage.totalTokens`)
- [ ] Tool calls still saved to `aiMessages.toolCalls` column
- [ ] All existing chat behavior preserved — same tools, same limits, same error handling
- [ ] Old `chatCompletion` import removed from `ai.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: Create Report Planner Phase

**Description**: As a developer, I want a planner phase that analyzes the user's prompt and outputs a structured markdown analysis plan so that subsequent phases know exactly what data to gather and what sections to write.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-pipeline/planner.ts`
- [ ] Export `runPlannerPhase(options)` function that takes:
  - `prompt`: user's report request
  - `userContext`: condensed user context (strategies, tags, accounts, settings)
  - `model`: model ID string
- [ ] Uses `generateText` with a planner-specific system prompt that instructs the model to:
  - Analyze what the user is asking for
  - List the data sources needed (specific analytics endpoints, SQL queries, market data)
  - Outline the report sections with descriptions
  - Identify which MDX chart components map to each section
  - Estimate how many tool calls are needed
- [ ] Planner does NOT have access to tools — it only plans, never executes
- [ ] Planner system prompt includes: condensed user context, list of available analytics endpoints (names + descriptions only, not full schema), list of available MDX components (names + data shape summaries)
- [ ] Returns `{ plan: string, estimatedToolCalls: number }` — plan is the markdown output
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Create Report Data Gatherer Phase

**Description**: As a developer, I want a data gatherer phase that reads the planner's output and executes all necessary tool calls to populate the dataStore so that the writer has all data ready.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-pipeline/gatherer.ts`
- [ ] Export `runGathererPhase(options)` function that takes:
  - `plan`: markdown plan from planner
  - `prompt`: original user prompt
  - `userContext`: full user context
  - `schemaContext`: full schema context (gatherer needs SQL docs)
  - `model`: model ID
  - `userId`: for tool execution context
  - `db`: read-only database instance
  - `dataStore`: Map for storing gathered data
- [ ] Uses `generateText` with `maxSteps` set to `MAX_TOOL_ROUNDS_REPORT` (20)
- [ ] Has access to ALL tools: `run_query`, `call_analytics`, `get_market_data`, `run_python`, `store_report_data`
- [ ] System prompt instructs: "Execute the analysis plan below. Call tools to gather all needed data. Use `store_report_data` to register each dataset. Do NOT write any report prose — just gather data and confirm what was stored."
- [ ] System prompt includes the plan, full schema context, and data handling notes (timezone, breakeven, etc.)
- [ ] Returns `{ toolCalls: ToolCall[], tokensUsed: number, dataStoreKeys: string[] }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Create Condensed Writer Context

**Description**: As a developer, I want a condensed context builder for the writer phase that only includes what the writer needs (gathered data summaries + MDX catalog) so that the writer operates with minimal context noise.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-pipeline/writer-context.ts`
- [ ] Export `buildWriterContext(options)` that takes:
  - `dataStore`: populated Map from gatherer phase
  - `plan`: markdown plan from planner
- [ ] Generates a condensed context string containing:
  - The analysis plan (section outline)
  - For each dataStore entry: `refId`, `description`, and a summary (first 3 rows of data if array, or key fields if object — NOT full datasets)
  - Full MDX component catalog (same as current `MDX_COMPONENT_CATALOG` from `trading-analyst.ts`)
  - Formatting rules (no LaTeX, table format, etc.)
- [ ] Does NOT include: database schema, SQL syntax, tRPC endpoint docs, tool descriptions
- [ ] Context size should be roughly 40-60% smaller than the current full system prompt
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Create Report Writer Phase

**Description**: As a developer, I want a writer phase that takes the gathered data and plan, then produces the final MDX report so that the report content is generated with maximum focus on writing quality.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-pipeline/writer.ts`
- [ ] Export `runWriterPhase(options)` function that takes:
  - `plan`: markdown plan from planner
  - `writerContext`: condensed context from `buildWriterContext`
  - `prompt`: original user prompt
  - `model`: model ID
  - `dataStoreKeys`: list of available dataRef keys
- [ ] Uses `generateText` with NO tools — writer only writes, never calls tools
- [ ] System prompt instructs the model to:
  - Write a comprehensive MDX report following the plan
  - Use the provided dataRef keys in MDX components (lists exact available keys)
  - Follow all formatting rules (no LaTeX, pipe tables, etc.)
  - Include executive summary, analysis sections, actionable recommendations
  - Use MetricCard, MetricGrid, Callout components for inline data
  - Reference dataRefs ONLY from the provided list — never invent dataRefs
- [ ] Returns `{ content: string, tokensUsed: number }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-009: Create Report Validator + Auto-Repair Phase

**Description**: As a developer, I want a validator phase that checks the writer's MDX output for broken dataRefs and compilation errors, and auto-repairs if needed, so that users never see broken reports.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-pipeline/validator.ts`
- [ ] Export `runValidatorPhase(options)` function that takes:
  - `content`: MDX string from writer
  - `dataStoreKeys`: list of valid dataRef keys
  - `model`: model ID (for repair calls)
- [ ] **DataRef validation**: Parse all MDX components, extract `dataRef` attributes, check each exists in `dataStoreKeys`
- [ ] **MDX compilation check**: Attempt to compile MDX using `next-mdx-remote` (same as viewer) — catch compilation errors
- [ ] **Component validation**: Check all MDX component names are from the known catalog (EquityCurve, MonthlyChart, etc.)
- [ ] If validation passes: return `{ valid: true, content }` unchanged
- [ ] If validation fails: attempt auto-repair (up to 2 attempts):
  - Build a repair prompt listing specific errors (missing dataRefs, invalid component names, MDX syntax errors)
  - Call `generateText` asking the model to fix ONLY the listed issues
  - Re-validate the repaired output
- [ ] If repair fails after 2 attempts: return `{ valid: false, content: originalContent, errors: string[] }` — let it save with warnings (graceful degradation, same as current behavior)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010: Report Templates

**Description**: As a developer, I want pre-defined report templates so that users get consistent, structured reports and the LLM doesn't have to invent report structure from scratch.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-templates/index.ts`
- [ ] Create 3 templates, each exporting a `ReportTemplate` type with:
  - `id`: string identifier
  - `name`: display name
  - `description`: what this template analyzes
  - `sections`: array of `{ title, description, suggestedDataSources, suggestedComponents }` — guides the planner
  - `plannerHint`: additional instructions appended to the planner prompt when this template is selected
- [ ] Templates:
  - **Monthly Review** (`monthly-review`): Equity curve, monthly P&L, win rate trends, best/worst days, symbol breakdown, key metrics, behavioral patterns, recommendations
  - **Risk Audit** (`risk-audit`): Drawdown analysis, position sizing, R-multiple distribution, Monte Carlo projections, risk of ruin, max adverse excursion, risk-adjusted returns
  - **Strategy Comparison** (`strategy-comparison`): Per-strategy metrics, win rate/expectancy/profit factor comparison, best/worst strategy identification, recommendations on which to keep/drop
- [ ] Export `getTemplate(id)` and `getAllTemplates()` functions
- [ ] Templates are data-only (no LLM calls) — they augment the planner prompt
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-011: Few-Shot Examples for MDX Quality

**Description**: As a developer, I want few-shot examples of excellent MDX report output embedded in the writer's system prompt so that the model produces higher-quality, more consistent reports.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-pipeline/few-shot-examples.ts`
- [ ] Export `WRITER_FEW_SHOT_EXAMPLES` — a string containing 2 curated examples of excellent report sections
- [ ] Example 1: A performance overview section showing proper use of MetricGrid, EquityCurve, Callout, and narrative analysis around the charts
- [ ] Example 2: A risk analysis section showing proper use of DrawdownTable, MonteCarloChart, RMultipleChart, with specific actionable recommendations
- [ ] Examples demonstrate:
  - Correct dataRef usage (referencing specific stored keys)
  - Mixing prose and MDX components naturally
  - Specific numbers and percentages in narrative (not vague)
  - Actionable recommendations backed by data
  - Proper formatting (no LaTeX, pipe tables, etc.)
- [ ] Examples are concise — each ~150-200 words of prose + components (not full reports)
- [ ] Integrated into the writer system prompt in US-008's `runWriterPhase`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012: Rewire Report Generation to 4-Phase Pipeline

**Description**: As a developer, I want `generate-ai-report.ts` to use the new 4-phase pipeline instead of the single tool-calling loop so that reports benefit from planning, context separation, and validation.

**Acceptance Criteria**:
- [ ] Update `src/trigger/generate-ai-report.ts` to call phases sequentially:
  1. `runPlannerPhase()` — progress stage: `planning`
  2. `runGathererPhase()` — progress stage: `gathering_data`
  3. `runWriterPhase()` — progress stage: `writing`
  4. `runValidatorPhase()` — progress stage: `validating`
- [ ] Progress tracking updated with new stage names: `building_context` → `planning` → `gathering_data` → `writing` → `validating` → `complete`
- [ ] Token usage aggregated across all 4 phases
- [ ] Tool call count from gatherer phase saved to `totalToolCalls`
- [ ] `chartsGenerated` from dataStore size (same as before)
- [ ] DataStore, content, and dataArtifacts saving unchanged
- [ ] Email notification unchanged
- [ ] Error handling: if any phase fails, mark report as failed with appropriate error message
- [ ] If planner fails: use fallback — run gatherer with just the raw user prompt (graceful degradation to current-like behavior)
- [ ] If validator reports errors but repair failed: save content anyway with warnings logged (never block a report from saving)
- [ ] Remove the old single-loop logic entirely
- [ ] Template support: if the report was initiated with a template ID, pass the template's `plannerHint` to the planner phase
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-013: Clean Up Old Client + Migration Artifacts

**Description**: As a developer, I want to remove the old hand-rolled OpenRouter client and consolidate to a single Vercel AI SDK client so that there's no dead code or dual implementations.

**Acceptance Criteria**:
- [ ] Remove `src/lib/ai/client.ts` (old hand-rolled client)
- [ ] Rename `src/lib/ai/client-v2.ts` to `src/lib/ai/client.ts` (or inline into consumers if simple enough)
- [ ] Remove old tool definition format from `src/lib/ai/tools/index.ts` — only keep Vercel AI SDK format
- [ ] Update all remaining imports across codebase (grep for old client imports)
- [ ] Remove `ChatMessage`, `ToolCall`, `ToolDefinition`, `ChatCompletionOptions`, `ChatCompletionResponse`, `StreamChunk` types if fully replaced by Vercel AI SDK types
- [ ] Remove `fetchWithRetry`, `buildHeaders`, `buildRequestBody` helper functions
- [ ] Verify no references to old client remain: `grep -rn "from.*client" src/lib/ai/`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-014: Template Selection UI

**Description**: As a trader, I want to choose a report template when creating a report so that I get structured, consistent analysis without writing detailed prompts.

**Acceptance Criteria**:
- [ ] Update the report creation UI to show template options alongside the free-text prompt
- [ ] Display 3 template cards: Monthly Review, Risk Audit, Strategy Comparison
- [ ] Each card shows: name, description, number of sections
- [ ] User can either select a template OR write a free-form prompt (not both required — template auto-fills a sensible default prompt)
- [ ] When template selected, pass `templateId` to the `startReport` mutation
- [ ] Update `ai.startReport` tRPC mutation to accept optional `templateId` parameter
- [ ] Pass `templateId` through to the Trigger.dev task payload
- [ ] Terminal design system styling: dark cards, chartreuse accent on selected, monospace labels
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-015: Integration Tests for Report Pipeline Phases

**Description**: As a developer, I want integration tests for the individual pipeline phase modules so that we can verify each phase works correctly in isolation.

**Acceptance Criteria**:
- [ ] Create `tests/integration/ai-report-pipeline.test.ts`
- [ ] Test `buildWriterContext`: given a mock dataStore and plan, verify output contains data summaries, MDX catalog, and excludes schema/SQL docs
- [ ] Test `runValidatorPhase` with valid MDX: returns `{ valid: true }`
- [ ] Test `runValidatorPhase` with missing dataRef: detects the error
- [ ] Test `runValidatorPhase` with invalid component name: detects the error
- [ ] Test template loading: `getTemplate("monthly-review")` returns correct structure
- [ ] Test `getAllTemplates()` returns all 3 templates
- [ ] Note: planner, gatherer, and writer phases require real LLM calls and cannot be meaningfully unit tested — these are validated via manual testing and production monitoring
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

## Functional Requirements

1. FR-001: All AI calls (chat and report) must go through Vercel AI SDK — no direct OpenRouter fetch calls
2. FR-002: Report generation must follow 4 phases: Plan → Gather → Write → Validate
3. FR-003: Writer phase must NOT have access to tools — only writes MDX from pre-gathered data
4. FR-004: Validator must attempt auto-repair up to 2 times before giving up
5. FR-005: Reports must never fail to save — validation failures degrade gracefully
6. FR-006: Progress tracking must reflect new phase names in the UI
7. FR-007: Templates are optional — free-form prompts still work exactly as before
8. FR-008: Token usage must be aggregated across all phases and saved to the report record
9. FR-009: Existing chat behavior must be identical after migration (same tools, same limits)

## Technical Considerations

- **Vercel AI SDK + OpenRouter**: Use `createOpenAI` from `@ai-sdk/openai` with `baseURL: "https://openrouter.ai/api/v1"`. OpenRouter is OpenAI-compatible, this is the recommended approach.
- **Tool migration**: Vercel AI SDK uses `tool({ description, parameters: zodSchema, execute })` — the execute functions can wrap existing executors from `src/lib/ai/tools/`
- **Message format**: Vercel AI SDK uses `CoreMessage[]` instead of the current `ChatMessage[]` — need conversion layer or full replacement
- **maxSteps**: Replaces the manual for-loop in chat. For the gatherer phase, set to `MAX_TOOL_ROUNDS_REPORT`
- **No streaming needed**: Report phases all use `generateText` (non-streaming). Chat can use either.
- **Database**: No schema changes required. Existing `aiReports` columns handle all new data.
- **Progress stages**: Update `progressStage` values — UI reads these strings, so the progress display component may need updated stage labels

## Design Considerations

- Template cards follow Terminal design system: dark bg, chartreuse border on selected, monospace text
- Template selection appears above the prompt input on the report creation form
- No changes to the report viewer, PDF, or email UI

## Success Metrics

- Reports with broken dataRefs drop to near-zero (validator catches them)
- MDX compilation failures drop to near-zero (validator catches them)
- Report quality improves via context separation (writer gets cleaner context)
- Templates provide consistent structure for common report types

## Open Questions

- Should the planner phase be skippable for simple prompts (e.g., "show my equity curve")? For now: always run all 4 phases for consistency.
- Should we expose phase-level progress in the UI (e.g., "Planning... → Gathering data... → Writing...")? The `progressStage` column already supports this — just need UI label mapping.
- Should templates be stored in the database for future user-created templates? For now: hardcoded in code, can migrate to DB later.
