# PRD: Structured Report Output (Eliminate MDX Coordination Failures)

## Overview

Replace the fragile MDX-based report generation pipeline with a structured JSON output approach. Currently, the writer LLM generates raw MDX with `dataRef` string references that must exactly match keys stored by a separate gatherer LLM — a two-phase coordination gap that causes 3+ "data not available" failures per report. The new approach has the writer produce a Zod-validated JSON structure, and a deterministic code assembler resolves data references, injects fallbacks, and renders React directly — eliminating MDX compilation errors, hallucinated dataRefs, and the unreliable AI repair loop entirely.

## Goals

- Zero "data not available" rendering failures caused by dataRef mismatches
- Eliminate MDX compilation errors (no more sanitization, no more `compileMDX`)
- Replace the AI-powered validator repair loop with deterministic code validation
- Maintain full chart/component rendering capabilities (EquityCurve, RMultipleChart, DataTable, etc.)
- Keep the Plan → Gather → Write → Validate pipeline architecture (only changing Write + Validate internals)

## User Stories

### US-001: Define Structured Report Zod Schema

**Description**: As a developer, I want a Zod schema defining the structured report format so that the writer can produce validated JSON output instead of free-form MDX.

**Acceptance Criteria**:
- [ ] New file: `src/lib/ai/report-pipeline/report-schema.ts`
- [ ] Schema uses discriminated union for content blocks: `prose`, `metrics`, `chart`, `callout`, `image`
- [ ] `prose` block: `{ type: "prose", content: string }` — content is markdown
- [ ] `metrics` block: `{ type: "metrics", items: MetricItem[] }` — each item has title, value, tooltip (what/why/benchmark), optional colorClass and description
- [ ] `chart` block: `{ type: "chart", component: ChartComponent enum, dataRef: string }` — component is one of the known chart/display component names
- [ ] `callout` block: `{ type: "callout", calloutType: "tip" | "warning" | "note" | "important", content: string }`
- [ ] `image` block: `{ type: "image", src: string, alt: string, caption?: string }` — for Python-generated charts
- [ ] Section schema: `{ heading: string, blocks: ContentBlock[] }`
- [ ] Top-level report schema: `{ executiveSummary: string, sections: Section[], keyTakeaways: string[] }`
- [ ] All types exported alongside schemas (inferred via `z.infer`)
- [ ] Component enum includes all chart components: EquityCurve, MonthlyChart, SymbolDistributionChart, DayOfWeekChart, HourHeatmap, SessionChart, RMultipleChart, MonteCarloChart, CalendarHeatmap, DrawdownTable, SymbolTable, DataTable
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-002: Add `aiGenerateObject` Wrapper to AI Client

**Description**: As a developer, I want a `aiGenerateObject` wrapper in the AI client module so that the writer phase can produce structured JSON output using the Vercel AI SDK `generateObject` function, with the same error handling as `aiGenerateText`.

**Acceptance Criteria**:
- [ ] Import `generateObject` from `"ai"` in `src/lib/ai/client.ts`
- [ ] New function `aiGenerateObject<T>` with options: model, system, messages, schema (Zod), maxRetries, temperature, maxOutputTokens
- [ ] Returns `{ object: T, totalTokens: number }` — the validated parsed object + token count
- [ ] Uses same `mapToOpenRouterError` error handling as `aiGenerateText`
- [ ] Generic type parameter `T` inferred from the Zod schema
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-003: Enhance `store_report_data` with Component Type Metadata

**Description**: As a developer, I want the `store_report_data` tool to accept an optional `component` field so that the gatherer can declare which chart component each dataset is intended for, enabling better validation and writer context.

**Acceptance Criteria**:
- [ ] Add optional `component` field to `store_report_data` input schema in `src/lib/ai/tools/definitions.ts` — z.string().optional() with description explaining it should be the component name (e.g., "EquityCurve", "DataTable")
- [ ] Update `executeStoreReportData` in `src/lib/ai/tools/store-report-data.ts` to store component metadata alongside data
- [ ] Change dataStore type from `Map<string, unknown>` to `Map<string, { data: unknown; component?: string; description: string }>` — update the type in `gatherer.ts` interface, `definitions.ts` ToolContext, and `generate-ai-report.ts`
- [ ] Update `Object.fromEntries(dataStore)` serialization in trigger task to only serialize the `data` field into `dataArtifacts` (keep DB schema unchanged)
- [ ] Update gatherer system prompt to instruct the AI to always specify the `component` field when calling `store_report_data`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-004: Update Writer Context for Structured JSON Output

**Description**: As a developer, I want the writer context builder to produce instructions optimized for JSON output instead of MDX, including available dataRef keys with component type hints from the gatherer metadata.

**Acceptance Criteria**:
- [ ] Rewrite `src/lib/ai/report-pipeline/writer-context.ts`
- [ ] Remove the MDX Catalog section (no longer needed — the Zod schema defines available components)
- [ ] Remove MDX-specific formatting rules (LaTeX escaping, pipe tables, code fences)
- [ ] Keep the Data Summary section — available dataRef keys with previews, aggregates, and sufficiency warnings
- [ ] Enhance data summary to show component type hints from dataStore metadata: `"equity-data" → EquityCurve (88 rows)` instead of just `"equity-data" (88 rows)`
- [ ] Add JSON-specific formatting rules: markdown within prose blocks, no HTML tags in prose, cite specific numbers
- [ ] Update `buildWriterContext` function signature to accept the enhanced dataStore type from US-003
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-005: Rewrite Writer Phase for Structured JSON Output

**Description**: As a developer, I want the writer phase to use `aiGenerateObject` with the structured report Zod schema so that it produces validated JSON instead of raw MDX.

**Acceptance Criteria**:
- [ ] Rewrite `src/lib/ai/report-pipeline/writer.ts`
- [ ] Use `aiGenerateObject` (from US-002) with the report schema (from US-001) instead of `aiGenerateText`
- [ ] Update `WriterResult` to return `{ report: StructuredReport; tokensUsed: number }` instead of `{ content: string; tokensUsed: number }`
- [ ] Rewrite `WRITER_PERSONA` and `WRITER_INSTRUCTIONS` for JSON output:
  - Instruct the writer to produce a structured JSON report matching the schema
  - Emphasize: use only dataRef keys from the available list, lead with insight not data, cite specific numbers in prose blocks
  - Include rules for when to skip chart blocks and use prose-only (insufficient data warnings)
  - Include the available dataRef keys list (same pattern as current, but referencing JSON chart blocks instead of MDX components)
- [ ] Remove `DATAREF_KEYS_PLACEHOLDER` replacement logic — dataRef keys are now part of writer context
- [ ] Update `WriterOptions` to remove `dataStoreKeys` (now embedded in writerContext)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-006: Update Few-Shot Examples for Structured JSON Format

**Description**: As a developer, I want few-shot examples in JSON format so that the writer LLM learns to produce structured report output matching the Zod schema.

**Acceptance Criteria**:
- [ ] Rewrite `src/lib/ai/report-pipeline/few-shot-examples.ts`
- [ ] Convert the Performance Overview example from MDX to a JSON section object:
  - `heading`, `blocks` array with prose, metrics, chart (EquityCurve), more prose, callout
  - Show proper MetricItem format with tooltip objects
- [ ] Convert the Risk Analysis example from MDX to JSON:
  - Multiple chart blocks (DrawdownTable, RMultipleChart, MonteCarloChart)
  - MetricGrid with 4 items
  - Multiple callout blocks
- [ ] Convert the Sparse Data example from MDX to JSON:
  - Demonstrate skipping a chart block and using prose + metrics instead
  - Show note callout guiding user to log more data
- [ ] Examples must be valid JSON matching the report schema — include a note that these are illustrative sections, not full reports
- [ ] Export as `WRITER_FEW_SHOT_EXAMPLES` string (same export name for compatibility)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-007: Create Deterministic Report Validator

**Description**: As a developer, I want a fully deterministic validator that checks data integrity and injects prose fallbacks, replacing the current AI-powered repair loop, so that validation is predictable, faster, and cheaper.

**Acceptance Criteria**:
- [ ] Rewrite `src/lib/ai/report-pipeline/validator.ts`
- [ ] Remove all AI repair logic (`attemptRepair`, `REPAIR_SYSTEM_PROMPT`, `buildRepairPrompt`)
- [ ] Remove MDX compilation check (`validateMdxCompilation`, `compileMDX` import)
- [ ] New `runValidatorPhase` accepts: `{ report: StructuredReport, dataStore: Map<string, { data: unknown; component?: string; description: string }> }`
- [ ] Returns: `{ report: StructuredReport, warnings: string[] }` (always returns a valid report — fixes inline)
- [ ] Validation checks (all deterministic code):
  1. For each `chart` block: verify `dataRef` exists in dataStore — if missing, replace block with a `prose` block explaining: "Data for this visualization was not available. [description from plan if available]"
  2. For each `chart` block: verify data shape is compatible with the component (array for most charts, object with `buckets`/`stats` for RMultipleChart, object for MonteCarloChart) — if incompatible, replace with prose fallback
  3. For each `chart` block: check data sufficiency using the same `COMPONENT_MINIMUMS` thresholds from current writer-context.ts — if insufficient, replace with prose fallback
  4. Collect warnings for any replacements made (logged but not blocking)
- [ ] `tokensUsed` is always 0 (no LLM calls)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-008: Build JSON Report Renderer Component

**Description**: As a developer, I want a React component that renders structured JSON reports directly (without MDX compilation) so that reports display reliably using the same chart components.

**Acceptance Criteria**:
- [ ] New file: `src/components/report/report-renderer.tsx` (client component)
- [ ] `ReportRenderer` component accepts: `{ report: StructuredReport, dataArtifacts: Record<string, unknown> }`
- [ ] Wraps content in `ReportDataProvider` (reuses existing context provider from `src/components/mdx/provider.tsx`)
- [ ] Renders `executiveSummary` as markdown via `ReactMarkdown` with `remarkGfm`
- [ ] Renders each section with heading (includes `id` for TOC anchor linking — same slug logic as current `extractHeadings`)
- [ ] `BlockRenderer` component handles each block type:
  - `prose`: renders via `ReactMarkdown` with `remarkGfm`, uses `markdownComponents` for consistent heading/paragraph/table styling
  - `metrics`: renders `MetricGrid` + `MetricCard` components (reuses existing)
  - `chart`: renders the appropriate chart wrapper component (reuses existing `MdxEquityCurve`, `MdxRMultipleChart`, etc. from `chart-wrappers.tsx`)
  - `callout`: renders `Callout` component (reuses existing)
  - `image`: renders `ChartImage` component (reuses existing)
- [ ] `keyTakeaways` renders as a numbered list with markdown support per item
- [ ] Styling matches current report output (same classes, spacing, Terminal design system)
- [ ] All rendered elements include `data-testid` attributes for testing
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

### US-009: Update Report Viewer Page for JSON Rendering

**Description**: As a developer, I want the report viewer page to use the new JSON renderer instead of MDX compilation so that reports render without compilation failures.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/ai/reports/[reportId]/page.tsx`
- [ ] Remove `compileMDX` import and usage
- [ ] Remove `sanitizeMdxProse` import and usage
- [ ] Remove `mdxComponents` import
- [ ] Parse `report.content` as JSON into `StructuredReport` type (with try/catch)
- [ ] If JSON parse fails, fall back to rendering raw content via `ReactMarkdown` (handles legacy reports gracefully)
- [ ] Pass parsed report + `dataArtifacts` to `ReportRenderer` component
- [ ] Update `ReportViewerContent` component:
  - Remove `mdxFailed` prop
  - Remove `children` prop (was server-compiled MDX)
  - Accept `report: StructuredReport` prop instead
  - Keep TOC extraction — extract headings from `report.sections[].heading` instead of regex on raw content
  - Keep active heading tracking with IntersectionObserver
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

### US-010: Update Share and Print Pages for JSON Rendering

**Description**: As a developer, I want the share page and print page to use the new JSON renderer so that shared/exported reports also render correctly.

**Acceptance Criteria**:
- [ ] Update `src/app/share/[token]/page.tsx`:
  - Remove `compileMDX` import and usage
  - Remove `sanitizeMdxProse` import and usage
  - Parse report content as JSON, fall back to ReactMarkdown for legacy
  - Use `ReportRenderer` component for JSON reports
  - Keep `ReportDataProvider` wrapping
- [ ] Update `src/app/print/reports/[id]/page.tsx`:
  - Same changes as share page
  - Ensure print-specific styling still works
- [ ] Both pages handle JSON parse failure gracefully (show raw content as markdown)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify share page in browser
- [ ] Verify print page in browser

### US-011: Update Trigger Task Pipeline Orchestration

**Description**: As a developer, I want the trigger task to wire the new structured pipeline phases together so that reports are generated, validated, and stored in the new JSON format.

**Acceptance Criteria**:
- [ ] Update `src/trigger/generate-ai-report.ts`
- [ ] Phase 3 (Writing): call `runWriterPhase` which now returns `{ report: StructuredReport, tokensUsed }` instead of `{ content: string, tokensUsed }`
- [ ] Phase 4 (Validation): call new `runValidatorPhase` with the structured report + dataStore — receives validated report + warnings
- [ ] Save results: serialize `validatorResult.report` as JSON string into `content` column
- [ ] Save `dataArtifacts` as before (using the `data` field from enhanced dataStore entries)
- [ ] Log validator warnings (if any) for debugging
- [ ] Remove references to `writerResult.content` (now `writerResult.report`)
- [ ] Update `buildWriterContext` call to pass enhanced dataStore
- [ ] Remove `dataStoreKeys` from writer options (no longer needed — embedded in context)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-012: Clean Up Deprecated MDX Infrastructure

**Description**: As a developer, I want to remove the now-unused MDX compilation infrastructure so that the codebase is clean and there's no confusion about which rendering path is active.

**Acceptance Criteria**:
- [ ] Remove `src/lib/mdx/sanitize.ts` (sanitizeMdxProse no longer needed)
- [ ] Remove the MDX Catalog constant from old `writer-context.ts` if any remnants remain
- [ ] Remove `next-mdx-remote` from dependencies if no other code uses it (check all imports first)
- [ ] If `next-mdx-remote` is still needed elsewhere, keep it but remove the report-specific compileMDX calls
- [ ] Remove `src/components/mdx/components.tsx` (the mdxComponents map) if only used by report rendering
- [ ] Keep `src/components/mdx/chart-wrappers.tsx` — reused by the JSON renderer
- [ ] Keep `src/components/mdx/provider.tsx` — reused by the JSON renderer
- [ ] Keep `src/components/mdx/data-table.tsx` — reused by the JSON renderer
- [ ] Verify no other files import removed modules (grep for all removed exports)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-013: Integration Tests for Structured Report Pipeline

**Description**: As a developer, I want integration tests for the new structured report pipeline so that we can verify schema validation, deterministic fallbacks, and rendering correctness.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/structured-report.test.ts`
- [ ] Test: report schema validates a well-formed report object (all block types)
- [ ] Test: report schema rejects malformed input (missing required fields, invalid block types, invalid component names)
- [ ] Test: deterministic validator passes a report with all valid dataRefs
- [ ] Test: deterministic validator replaces a chart block with prose when dataRef is missing from dataStore
- [ ] Test: deterministic validator replaces a chart block with prose when data shape is incompatible
- [ ] Test: deterministic validator replaces a chart block with prose when data is insufficient (below COMPONENT_MINIMUMS)
- [ ] Test: `executeStoreReportData` stores component metadata correctly
- [ ] Test: `aiGenerateObject` wrapper returns typed object (mock the AI call)
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

## Functional Requirements

1. **FR-001**: The writer MUST produce output conforming to the `StructuredReport` Zod schema — enforced by `generateObject`
2. **FR-002**: Every chart block's `dataRef` MUST be validated against the dataStore before rendering — missing refs trigger prose fallback
3. **FR-003**: Data shape validation MUST check: arrays for most charts, `{ buckets, stats }` for RMultipleChart, object for MonteCarloChart
4. **FR-004**: Data sufficiency MUST use the same thresholds as current system (10 for R-multiple, 20 for Monte Carlo, 5 for equity curve, etc.)
5. **FR-005**: Prose fallback blocks MUST explain why the visualization was omitted (e.g., "Only 1 of 88 trades had stop-loss data — insufficient for R-multiple distribution chart")
6. **FR-006**: All three rendering surfaces (viewer, share, print) MUST use the JSON renderer
7. **FR-007**: Existing chart components (EquityCurve, RMultipleChart, etc.) MUST be reused, not rewritten
8. **FR-008**: No LLM calls during validation — the validator is 100% deterministic code

## Non-Goals (Out of Scope)

- Streaming/progressive rendering of reports (keep batch generation)
- Backward compatibility with existing MDX-format reports (clean break — old reports show as raw text fallback)
- Changes to the planner phase (it continues producing text plans)
- Changes to the gatherer's core tool-calling behavior (only adding metadata to `store_report_data`)
- Adding new chart component types
- Changing the report viewer UI layout, TOC, or header

## Technical Considerations

### Database
- No schema migration needed — `content` column (text) stores JSON string instead of MDX string
- `dataArtifacts` column (jsonb) is unchanged
- Old reports will fail JSON parse and fall back to ReactMarkdown (acceptable per clean break decision)

### AI SDK
- Using Vercel AI SDK v6 `generateObject` with Zod schema
- OpenRouter models may use tool-calling mode or JSON mode under the hood — both work
- `generateObject` guarantees the output matches the schema — eliminates an entire class of validation errors

### Rendering
- No more `compileMDX` from `next-mdx-remote/rsc` — removes a server-side compilation step
- No more `sanitizeMdxProse` — removes MDX-specific escaping
- ReactMarkdown (already a dependency) handles prose blocks
- Existing chart wrapper components reused via direct import instead of MDX component map

### Dependencies
- `next-mdx-remote` may become removable if no other features use it
- `react-markdown` and `remark-gfm` already in use, no new dependencies

## Design Considerations

- Report renderer follows Terminal design system (same classes as current MDX output)
- All existing chart components maintain their current styling
- TOC sidebar derived from `sections[].heading` instead of regex on raw content
- Callout components reuse existing styling (tip=green, warning=yellow, note=muted, important=red)
- MetricCard tooltips rendered identically (what/why/benchmark structure preserved in schema)

## Success Metrics

- Zero "data not available" failures caused by dataRef mismatches in new reports
- Zero MDX compilation errors (eliminated by design)
- Validator phase costs $0 in LLM tokens (fully deterministic)
- All existing chart types renderable through the new pipeline
- Report generation time equal or faster than current (one fewer LLM call in validation)

## Open Questions

- None — scope is well-defined based on clarification answers
