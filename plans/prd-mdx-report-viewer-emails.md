# PRD: MDX Report Viewer & React Email System

## Overview

Replace the current PDF-based report pipeline (`@react-pdf/renderer` -> S3 upload -> expiring presigned download URL) with a rich in-app MDX report viewer. Reports are stored as MDX content in the database, rendered at `/ai/reports/[reportId]` using `next-mdx-remote` with the **full analytics component library** exposed as MDX components (EquityCurve, SessionChart, HourHeatmap, MetricCard, etc.). The AI outputs real React components in its response — `<EquityCurve dataRef="equity-1" />` — and they render as actual interactive AG Charts and styled cards in the viewer.

Data for components is stored via a new `store_report_data` AI tool. During report generation, the AI calls `store_report_data({ refId: "equity-1", data: [...] })` to register datasets, then references them in MDX. The viewer hydrates these via React context.

Additionally, replace the raw HTML email builder with a React Email system in `src/emails/`, establishing a branded, reusable email foundation for all future transactional emails.

**Why**: The PDF pipeline is unreliable (presigned URLs expire after 7 days, `@react-pdf/renderer` has limited fidelity, PDF generation is token-hungry). An in-app MDX viewer is faster, permanently accessible, and renders **real interactive components** — not static images or markdown approximations. The AI can output `<EquityCurve>` with real data and traders get the same AG Charts they see on their analytics page, embedded directly in their report.

## Goals

- Reports rendered with real React components (AG Charts, metric cards, heatmaps) via MDX
- AI outputs MDX with custom components when helpful — user changes nothing about how they ask
- Reports permanently viewable at `/ai/reports/[reportId]` (no expiring URLs)
- Client-side PDF export via html2canvas + jsPDF for download
- Branded React Email system in `src/emails/` for all transactional emails
- Remove `@react-pdf/renderer` and the entire PDF generation pipeline

## User Stories

### US-000: Audit Existing Code for MDX Report Viewer

**Description**: As a developer, I want to audit existing report generation, email, analytics components, and MDX-related dependencies before implementing so that we reuse code and understand the full surface area of changes.

**Acceptance Criteria**:
- [ ] Catalog all analytics components in `src/components/analytics/` with their prop interfaces and data shapes
- [ ] Document which components are self-contained (data in, chart out) vs which depend on external state/context
- [ ] Check existing markdown rendering in `src/app/(protected)/ai/_components/message-renderer.tsx`
- [ ] Audit `src/trigger/generate-ai-report.ts` for all touch points that need to change
- [ ] Audit `src/lib/ai/report-pdf.ts` and `src/lib/ai/report-email.ts` for removal
- [ ] Audit `src/server/api/routers/ai.ts` report endpoints for needed changes
- [ ] Check `src/lib/ai/prompts/trading-analyst.ts` for the report mode prompt
- [ ] Document findings in `scripts/ralph/progress.txt`
- [ ] Typecheck passes (`bun run check`)

**Search Commands**:
```bash
grep -rn "generateReportPdf\|report-pdf" src/
grep -rn "sendReportEmail\|report-email" src/
grep -rn "pdfUrl\|pdfKey\|pdf_url\|pdf_key" src/
grep -rn "@react-pdf/renderer" src/
```

---

### US-001: Schema Changes — Add MDX Content & Data Artifacts, Remove PDF Columns

**Description**: As a developer, I want to update the `aiReports` schema to store MDX content and component data artifacts, and remove the obsolete PDF columns.

**Acceptance Criteria**:
- [ ] Add `content` column to `aiReports`: `text("content")` — stores the AI's full MDX response
- [ ] Add `dataArtifacts` column to `aiReports`: `jsonb("data_artifacts")` — native PostgreSQL JSONB mapping `refId` to data objects (e.g. `{"equity-1": [...], "day-perf": [...]}`). JSONB validates JSON on write, stores in efficient binary format, and Drizzle returns it as a parsed object (no `JSON.parse()` needed on read)
- [ ] Remove `pdfUrl` column from `aiReports` (no legacy data — beta, no existing reports)
- [ ] Remove `pdfKey` column from `aiReports` (no legacy data)
- [ ] Update TypeScript types: `AiReport`, `NewAiReport` reflect new columns
- [ ] Run `bun run db:push` to apply schema changes
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: AI Tool — store_report_data (Register Data for MDX Components)

**Description**: As a developer, I want a new AI tool that lets the AI register datasets with reference IDs so that MDX components can access them at render time via `dataRef` props.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/tools/store-report-data.ts`
- [ ] Export tool definition in OpenAI function-calling format:
  - Name: `store_report_data`
  - Description: "Store a dataset for use in report MDX components. Call this before referencing data in components like <EquityCurve dataRef='my-ref-id' />. The data will be available to the component at render time."
  - Parameters: `{ refId: string (unique identifier), description: string (what this data represents), data: any (the dataset — array of objects, single object, etc.) }`
- [ ] Export `executeStoreReportData(refId: string, description: string, data: unknown, context: { dataStore: Map<string, unknown> })` function
- [ ] Execution stores data in the provided `dataStore` map (in-memory during generation, persisted after)
- [ ] Validates `refId` is non-empty and doesn't already exist in the store
- [ ] Returns `{ success: true, refId, rowCount }` for arrays, `{ success: true, refId }` for objects
- [ ] Register in `src/lib/ai/tools/index.ts` — add to `AI_TOOLS` array and `executeTool` dispatcher
- [ ] Tool is only included in tools array when mode is `"report"` (not needed for chat)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Update AI System Prompt — MDX Component Catalog & Formatting Guide

**Description**: As a developer, I want the report-mode system prompt to include a catalog of available MDX components with their props, data shapes, and usage guidelines so the AI knows when and how to use them for richer reports.

**Acceptance Criteria**:
- [ ] Update `src/lib/ai/prompts/trading-analyst.ts` — add a new `MDX_COMPONENT_CATALOG` section included only in report mode
- [ ] The catalog documents these components with props interface and data shape:

  **Chart Components (AG Charts):**
  - `<EquityCurve dataRef="..." />` — Cumulative P&L area chart with drawdown. Data: `Array<{ date: string, equity: number, peak: number, drawdown: number, drawdownPercent: number, pnl: number, tradeIndex: number }>`
  - `<MonthlyChart dataRef="..." />` — Monthly P&L area chart. Data: `Array<{ month: string, pnl: number, trades: number, winRate: number, cumulative: number }>`
  - `<SymbolDistributionChart dataRef="..." />` — Donut/polar chart by symbol. Data: `Array<{ symbol: string, pnl: number, trades: number, winRate: number }>`
  - `<DayOfWeekChart dataRef="..." />` — Day-of-week performance bars. Data: `Array<{ day: string, pnl: number, trades: number, winRate: number, avgPnl: number }>`
  - `<HourHeatmap dataRef="..." />` — 24-hour P&L heatmap grid. Data: `Array<{ hour: number, pnl: number, trades: number }>`
  - `<SessionChart dataRef="..." />` — Trading session performance cards. Data: `Array<{ session: string, pnl: number, trades: number, winRate: number, avgPnl: number }>`
  - `<RMultipleChart dataRef="..." />` — R-multiple distribution histogram. Data: `{ buckets: Array<{ label: string, count: number, pnl: number }>, stats: { avgR: number, medianR: number, maxR: number, minR: number } }`
  - `<MonteCarloChart dataRef="..." />` — Monte Carlo simulation fan chart. Data: `{ simulations: Array<Array<number>>, percentiles: { p5: number[], p25: number[], p50: number[], p75: number[], p95: number[] } }`

  **Display Components:**
  - `<MetricCard title="..." value="..." description="..." />` — Single metric display. No dataRef needed — inline props.
  - `<MetricGrid>` — Wrapper for multiple MetricCards in a responsive grid. Usage: `<MetricGrid><MetricCard .../><MetricCard .../></MetricGrid>`
  - `<DrawdownTable dataRef="..." />` — Drawdown periods table. Data: `Array<{ start: string, end: string, depth: number, depthPercent: number, duration: number, recovered: boolean }>`
  - `<SymbolTable dataRef="..." />` — Symbol statistics table. Data: `Array<{ symbol: string, trades: number, winRate: number, pnl: number, avgPnl: number, profitFactor: number }>`
  - `<CalendarHeatmap dataRef="..." />` — Date-based P&L heatmap. Data: `Array<{ date: string, pnl: number, trades: number }>`

  **Report-Specific Components (new):**
  - `<Callout type="note|tip|warning|important">` — Styled callout box for key findings
  - `<DataTable dataRef="..." columns={["Col1","Col2"]} />` — Generic data table renderer. Data: `Array<Record<string, string | number>>`
  - `<ChartImage src="..." alt="..." />` — Lightbox image wrapper for Python-generated charts

- [ ] Include formatting guidelines:
  - "Use `<MetricCard>` or `<MetricGrid>` for key stats instead of markdown tables when you have 2-8 metrics"
  - "Use `<EquityCurve>`, `<DayOfWeekChart>`, etc. when you have the right data shape — these render as real interactive charts"
  - "Always call `store_report_data` first to register data, then reference it with `dataRef` in the component"
  - "Use `<Callout type='tip'>` for actionable recommendations and `<Callout type='warning'>` for risk alerts"
  - "Regular markdown (headings, paragraphs, lists, bold, tables) still works — use components only when they add value"
  - "You can mix markdown and components freely in the same report"
- [ ] Include 1-2 complete mini-examples showing the full flow: tool call → store_report_data → MDX component usage
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Update Trigger.dev Task — Save MDX Content & Data Artifacts

**Description**: As a developer, I want the `generate-ai-report` Trigger.dev task to save MDX content and data artifacts to the database instead of generating a PDF.

**Acceptance Criteria**:
- [ ] In `src/trigger/generate-ai-report.ts`:
  - Create a `dataStore: Map<string, unknown>` at the start of the task run
  - Pass `dataStore` to `executeTool` context so `store_report_data` can populate it
  - After tool-calling loop completes, serialize `dataStore` to JSON string
  - Save final AI content to `aiReports.content` column
  - Save data store to `aiReports.dataArtifacts` column as object (Drizzle handles JSONB serialization — just pass `Object.fromEntries(dataStore)` directly)
- [ ] Remove the `generateAndUploadPdf` call and all PDF-related logic
- [ ] Remove the `extractChartUrls` and `extractCodeArtifacts` helper functions
- [ ] Remove imports of `generateReportPdf` from `report-pdf.ts`
- [ ] Update progress stages: remove `"generating_pdf"` and `"uploading"` — after analyzing, go straight to `"complete"`
- [ ] Keep email notification but update to link to viewer page instead of PDF download URL
- [ ] Update the fallback path (max tool rounds) to also save content + dataArtifacts
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: Update tRPC Endpoints — Report Content & Data for Viewer

**Description**: As a developer, I want updated tRPC endpoints that serve MDX content and data artifacts for the report viewer page.

**Acceptance Criteria**:
- [ ] Update `getReport` query in `src/server/api/routers/ai.ts`:
  - Include `content` and `dataArtifacts` in the returned fields
  - Remove `pdfUrl` and `pdfKey` from response
- [ ] Add `getReportContent` query (optimized for viewer — separate from getReport which is used for list):
  - Input: `{ reportId: string }`
  - Returns: `{ id, title, content, dataArtifacts, status, createdAt, completedAt, model, tokensUsed, chartsGenerated, prompt }`
  - Validates user ownership
  - Returns 404 if not found or not owned by user
- [ ] Update `getReportStatus` — remove `pdfUrl` from response
- [ ] Update `listReports` — remove `pdfUrl` from list items, add `content` existence flag (boolean `hasContent` — so UI knows if report is viewable)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Integration Tests for Updated Report Endpoints

**Description**: As a developer, I want integration tests for the updated report tRPC endpoints to verify the new content/dataArtifacts flow works correctly.

**Acceptance Criteria**:
- [ ] Update existing report tests or create `tests/integration/report-viewer.test.ts`
- [ ] Test: `getReportContent` returns content and dataArtifacts for a completed report
- [ ] Test: `getReportContent` returns 404 for non-existent report
- [ ] Test: `getReportContent` rejects access to another user's report
- [ ] Test: `listReports` includes `hasContent` boolean flag
- [ ] Test: `getReport` includes content field but not pdfUrl/pdfKey
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-007: React Email Setup — Base Layout & Folder Structure

**Description**: As a developer, I want a React Email system with a branded Terminal-themed base layout in `src/emails/` so that all future transactional emails share a consistent design.

**Acceptance Criteria**:
- [ ] Install `@react-email/components`: `bun add @react-email/components`
- [ ] Create `src/emails/` directory structure:
  ```
  src/emails/
  ├── components/
  │   └── base-layout.tsx     # Shared branded layout wrapper
  └── report-complete.tsx     # First email template
  ```
- [ ] Create `src/emails/components/base-layout.tsx`:
  - Terminal-themed email layout matching the app's design system
  - Dark background (`#050505`), monospace fonts (Courier New fallback), chartreuse accent (`#d4ff00`)
  - Header: "TRADERLOG" branding with accent border
  - Content slot (children)
  - Footer: "TheTraderLog — Professional Trading Journal" + timestamp
  - Fully responsive (mobile email clients)
  - Uses `@react-email/components`: `Html`, `Head`, `Body`, `Container`, `Section`, `Text`, `Hr`, `Preview`
- [ ] Export `BaseLayout` component with props: `{ preview: string, children: React.ReactNode }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Report Completion Email Template (React Email)

**Description**: As a developer, I want a polished report completion email using React Email that links to the in-app viewer instead of an expiring PDF URL.

**Acceptance Criteria**:
- [ ] Create `src/emails/report-complete.tsx`:
  - Uses `BaseLayout` wrapper
  - Preview text: "Your AI analysis report is ready — view it now"
  - Report title displayed in ice blue (`#00d4ff`) monospace
  - "VIEW REPORT" button: chartreuse background (`#d4ff00`), dark text, links to `/ai/reports/[reportId]`
  - Subtitle: "Your report is permanently available in TheTraderLog" (no more "expires in 7 days")
  - Optional: report metadata (generation time, charts generated, tokens used)
  - Uses `@react-email/components`: `Button`, `Link`, `Section`, `Text`
- [ ] Export `ReportCompleteEmail` component with props: `{ reportTitle: string, reportUrl: string, metadata?: { duration?: string, chartsGenerated?: number } }`
- [ ] Export `renderReportCompleteEmail(props)` function that returns HTML string via `render()` from `@react-email/components`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-009: Update Email Delivery — Use React Email Template

**Description**: As a developer, I want to update the email sending code to use the new React Email template instead of raw HTML.

**Acceptance Criteria**:
- [ ] Update `src/lib/ai/report-email.ts`:
  - Import `renderReportCompleteEmail` from `src/emails/report-complete`
  - Replace `buildReportEmailHtml` with React Email render call
  - Update `sendReportEmail` params: replace `downloadUrl` with `reportUrl` (viewer page URL)
  - Add optional `metadata` param for report stats
  - Remove the old `buildReportEmailHtml` function and `escapeHtml` helper
- [ ] Update call site in `src/trigger/generate-ai-report.ts`:
  - Construct viewer URL: `${process.env.NEXT_PUBLIC_APP_URL}/ai/reports/${reportId}`
  - Pass `reportUrl` instead of `downloadUrl`
  - Pass metadata (duration, chartsGenerated) if available
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010: MDX Report Component Library — Wrappers & Context Provider

**Description**: As a developer, I want a set of MDX-compatible wrapper components and a data context provider so that MDX reports can reference data artifacts and render real analytics components.

**Acceptance Criteria**:
- [ ] Create `src/components/mdx/` directory:
  ```
  src/components/mdx/
  ├── provider.tsx           # ReportDataProvider context
  ├── components.tsx         # MDX component map (all wrappers)
  ├── metric-grid.tsx        # New: responsive grid wrapper for MetricCards
  ├── callout.tsx            # New: styled callout box (note/tip/warning/important)
  ├── data-table.tsx         # New: generic data table renderer
  └── chart-image.tsx        # New: lightbox image wrapper for Python charts
  ```
- [ ] Create `ReportDataProvider` in `provider.tsx`:
  - React context that holds the parsed `dataArtifacts` map
  - `useReportData(refId: string)` hook that looks up data by refId
  - Returns `undefined` if refId not found (components handle gracefully)
- [ ] Create wrapper components for each analytics chart:
  - Each wrapper accepts `dataRef: string` prop + optional `className`
  - Uses `useReportData(dataRef)` to get data
  - Transforms data to the shape the underlying component expects (if needed)
  - Renders the real component from `src/components/analytics/`
  - Shows a graceful fallback if data is missing or malformed: `"[Chart: data not available]"` styled in `text-muted-foreground font-mono text-xs`
  - Components to wrap: `EquityCurve`, `MonthlyChart`, `SymbolDistributionChart`, `DayOfWeekChart`, `HourHeatmap`, `SessionChart`, `RMultipleChart`, `MonteCarloChart`, `CalendarHeatmap`, `DrawdownTable`, `SymbolTable`
- [ ] Create `MetricGrid` component: responsive grid wrapper (`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2`)
- [ ] Create `Callout` component:
  - Props: `type: "note" | "tip" | "warning" | "important"`, `children`
  - NOTE: `border-l-2 border-accent/30 bg-accent/[0.02]` with Info icon in `text-accent`
  - TIP: `border-l-2 border-profit/30 bg-profit/[0.02]` with Lightbulb icon in `text-profit`
  - WARNING: `border-l-2 border-loss/30 bg-loss/[0.02]` with AlertTriangle icon in `text-loss`
  - IMPORTANT: `border-l-2 border-primary/30 bg-primary/[0.02]` with AlertCircle icon in `text-primary`
- [ ] Create `DataTable` component:
  - Props: `dataRef: string`, `columns?: string[]` (optional column filter/rename)
  - Renders a styled table from array-of-objects data
  - Auto-detects numeric columns for right-alignment and P&L coloring
  - Terminal design: monospace, bordered, alternating row shading
- [ ] Create `ChartImage` component:
  - Props: `src: string`, `alt?: string`, `caption?: string`
  - Renders image with Terminal-styled border
  - Clickable lightbox overlay (reuse existing pattern from message-renderer)
- [ ] Export `mdxComponents` map from `components.tsx` — maps component names to implementations for next-mdx-remote
- [ ] `MetricCard` is passed through directly (inline props, no dataRef needed)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-011: Report Viewer Page — `/ai/reports/[reportId]`

**Description**: As a trader, I want a dedicated report viewer page where I can read my AI-generated reports rendered with real interactive components, charts, and rich formatting.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/ai/reports/[reportId]/page.tsx`
- [ ] Server component that fetches report content via tRPC (`getReportContent`)
- [ ] Renders MDX using `next-mdx-remote/rsc`:
  - Install: `bun add next-mdx-remote`
  - Use `MDXRemote` with the `mdxComponents` map from US-010
  - Wrap in `ReportDataProvider` with parsed `dataArtifacts`
- [ ] Page layout:
  - **Header bar**: Back button (link to `/ai` reports tab), report title, generation date, model used
  - Header styling: `border-b border-white/5 bg-white/[0.01] px-6 py-4`
  - Title: `font-mono text-lg text-foreground font-medium`
  - Meta: `font-mono text-[10px] text-muted-foreground` — date, model, tokens, charts count
  - **Action buttons** in header: "Download PDF" button (US-012), share/copy link button
  - **Content area**: `max-w-4xl mx-auto px-6 py-8` with MDX rendered content
  - **Table of Contents sidebar** (desktop xl+ only): auto-generated from headings in the MDX, `sticky top-20` positioning, `font-mono text-[10px]` links, active section highlighting on scroll
- [ ] MDX rendering with `remark-gfm` plugin for GitHub-flavored markdown (tables, strikethrough, etc.)
- [ ] Error handling:
  - If MDX compilation fails, fall back to rendering raw content as markdown via `react-markdown` (graceful degradation)
  - If report not found: show 404 page
  - If report still generating: show progress indicator with current stage
- [ ] Loading state: skeleton matching report layout dimensions
- [ ] Terminal design: dark background, monospace text, proper spacing
- [ ] Responsive: content fills viewport on mobile, ToC hidden below xl
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-012: Client-Side PDF Export via html2canvas + jsPDF

**Description**: As a trader, I want to download my report as a PDF so that I can share it or keep an offline copy.

**Acceptance Criteria**:
- [ ] Install dependencies: `bun add html2canvas-pro jspdf`
- [ ] Create `src/lib/export/pdf-export.ts`:
  - Export `exportReportToPdf(element: HTMLElement, title: string): Promise<void>`
  - Uses `html2canvas-pro` to capture the rendered report content area
  - Generates PDF via `jsPDF` with A4 page size
  - Handles multi-page reports (split canvas into page-sized chunks)
  - Adds header on first page: "TRADERLOG // AI ANALYSIS REPORT" + title
  - Adds footer on each page: page number
  - Downloads as `{slug}-report.pdf`
- [ ] Add "Download PDF" button in report viewer header (US-011):
  - Button: `rounded border border-white/10 bg-white/[0.02] hover:border-primary/30 hover:text-primary px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all`
  - Download icon + "PDF" label
  - Loading state while generating: spinner + "Generating..."
  - Wraps the report content area in a ref for capture
- [ ] Print-optimized CSS: `@media print` styles that hide ToC sidebar, header actions, and set white background for better print quality
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: download a multi-page report

---

### US-013: Update Report Interface — "View Report" Replaces PDF Download

**Description**: As a trader, I want the reports list to link to the in-app viewer instead of downloading a PDF so that I get the richer viewing experience.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/ai/_components/report-interface.tsx`:
  - Replace "Download PDF" button on completed reports with "View Report" link
  - "View Report" navigates to `/ai/reports/[reportId]`
  - Button style: `rounded border border-white/10 bg-white/[0.02] hover:border-accent/30 hover:text-accent px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-all` with `ArrowRight` icon
  - Remove any references to `pdfUrl` in the component
- [ ] Update progress stage labels: remove "Compiling report..." (generating_pdf) and "Finalizing..." (uploading)
- [ ] Update progress bar percentages: remove generating_pdf and uploading stages, adjust so analyzing goes to 90%, then straight to complete at 100%
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-014: Remove Old PDF Generation Code

**Description**: As a developer, I want to remove all PDF generation code now that reports use the MDX viewer.

**Acceptance Criteria**:
- [ ] Delete `src/lib/ai/report-pdf.ts` entirely
- [ ] Uninstall `@react-pdf/renderer` dependency: `bun remove @react-pdf/renderer`
- [ ] Remove any remaining imports of `generateReportPdf` across the codebase
- [ ] Remove `progressStage` values `"generating_pdf"` and `"uploading"` from any constants/labels
- [ ] Remove any S3 upload logic that was specific to PDF reports (keep S3 utils used by other features like Python chart images)
- [ ] Clean up `src/lib/constants/errors.ts`: remove `ERR_AI_PDF_FAILED` if no longer referenced
- [ ] Clean up error mapping in `src/trigger/generate-ai-report.ts`: remove PDF-specific error handling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-015: E2E Tests for Report Viewer Page

**Description**: As a developer, I want E2E tests for the report viewer page to verify MDX rendering, component display, and PDF export work correctly.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/report-viewer.spec.ts`
- [ ] All new UI elements have `data-testid` attributes
- [ ] Tests:
  - Report viewer page loads with correct title and metadata in header
  - Back button navigates to AI reports tab
  - MDX content renders with proper heading hierarchy
  - Table of Contents sidebar visible on xl+ viewport, hidden on mobile
  - ToC links scroll to corresponding sections
  - MetricCard components render with values
  - Callout components render with correct styling per type
  - DataTable renders with data
  - ChartImage renders and opens lightbox on click
  - PDF download button triggers download
  - Loading skeleton shown while report data loads
  - 404 page shown for non-existent report ID
  - Generating state shows progress indicator
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-016: E2E Tests for Updated Report Interface

**Description**: As a developer, I want E2E tests for the updated report list interface to verify the "View Report" flow works correctly.

**Acceptance Criteria**:
- [ ] Update existing report tests or create `tests/e2e/report-interface-update.spec.ts`
- [ ] Tests:
  - Completed reports show "View Report" button instead of "Download PDF"
  - "View Report" button navigates to `/ai/reports/[reportId]`
  - Progress stages no longer show "Compiling report..." or "Finalizing..."
  - Progress bar transitions smoothly from analyzing to complete
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Functional Requirements

1. **FR-001**: AI outputs MDX with custom components (`<EquityCurve>`, `<MetricCard>`, etc.) — rendered as real React components in the viewer
2. **FR-002**: Data for components stored via `store_report_data` tool during generation, hydrated at render time via `dataRef` props
3. **FR-003**: Reports permanently viewable at `/ai/reports/[reportId]` — no expiring URLs
4. **FR-004**: MDX compilation via `next-mdx-remote` with full component library exposed
5. **FR-005**: Graceful fallback to markdown rendering if MDX compilation fails
6. **FR-006**: Client-side PDF export via html2canvas + jsPDF captures WYSIWYG
7. **FR-007**: React Email system in `src/emails/` with branded Terminal-themed base layout
8. **FR-008**: Report completion email links to viewer page, not expiring download URL
9. **FR-009**: User changes nothing about how they ask for reports — the AI decides when components add value
10. **FR-010**: All existing report functionality (start, track progress, retry failed) continues to work

## Non-Goals (Out of Scope)

- Real-time collaborative report editing
- Report versioning or history
- Custom component creation by users
- Report scheduling (auto-generate weekly reports)
- Report sharing via public links
- Server-side PDF rendering
- Email system for anything beyond report completion (welcome, digest, alerts are future work — just establish the foundation)

## Technical Considerations

### Database Changes
- Add `content` text column to `aiReports` (nullable)
- Add `dataArtifacts` jsonb column to `aiReports` (nullable, native PostgreSQL JSONB — no manual JSON.parse needed)
- Remove `pdfUrl` and `pdfKey` columns (no legacy data — beta, no existing reports)

### New Dependencies
- `next-mdx-remote` — MDX compilation for App Router RSC
- `html2canvas-pro` + `jspdf` — client-side PDF export
- `@react-email/components` — React Email component library for email templates

### Removed Dependencies
- `@react-pdf/renderer` — no longer needed

### New AI Tool
- `store_report_data` — registers datasets with reference IDs for MDX component data hydration
- Only available in report mode (not chat)
- Data stored as JSON in `aiReports.dataArtifacts`

### File Structure (New/Modified)
```
src/
├── components/mdx/
│   ├── provider.tsx           # ReportDataProvider context + useReportData hook
│   ├── components.tsx         # MDX component map for next-mdx-remote
│   ├── metric-grid.tsx        # Responsive grid for MetricCards
│   ├── callout.tsx            # Styled callout boxes (note/tip/warning/important)
│   ├── data-table.tsx         # Generic data table renderer
│   └── chart-image.tsx        # Lightbox image wrapper
├── emails/
│   ├── components/
│   │   └── base-layout.tsx    # Shared branded email layout
│   └── report-complete.tsx    # Report completion email
├── lib/
│   ├── ai/
│   │   ├── tools/
│   │   │   └── store-report-data.ts  # NEW: store data for MDX components
│   │   ├── report-email.ts           # UPDATED: use React Email
│   │   ├── report-pdf.ts             # DELETED
│   │   └── prompts/
│   │       └── trading-analyst.ts    # UPDATED: MDX component catalog
│   └── export/
│       └── pdf-export.ts             # NEW: client-side PDF export
├── app/(protected)/ai/
│   └── reports/
│       └── [reportId]/
│           └── page.tsx              # NEW: report viewer page
├── trigger/
│   └── generate-ai-report.ts        # UPDATED: save MDX + data artifacts
└── server/
    ├── api/routers/ai.ts             # UPDATED: new getReportContent endpoint
    └── db/schema.ts                  # UPDATED: content + dataArtifacts columns
```

### Architecture Flow

```
Report Generation:
  User prompt → startReport (tRPC) → Trigger.dev task
    → AI tool-calling loop (run_query, call_analytics, store_report_data, run_python)
    → Final MDX response saved to aiReports.content
    → dataStore serialized to aiReports.dataArtifacts
    → Email sent with viewer link

Report Viewing:
  /ai/reports/[reportId] → getReportContent (tRPC)
    → MDX compiled via next-mdx-remote
    → ReportDataProvider wraps content with parsed dataArtifacts
    → MDX components resolve dataRef via useReportData hook
    → Real AG Charts, MetricCards, tables rendered

PDF Export:
  "Download PDF" button → html2canvas captures rendered content → jsPDF generates multi-page PDF
```

## Design Considerations

- Terminal design system fully preserved: dark bg (`#050505`), monospace fonts, chartreuse (`#d4ff00`) for user actions, ice blue (`#00d4ff`) for AI elements
- Report viewer is information-dense — no excessive whitespace, traders want data
- MDX components render the same AG Charts and styled cards traders see on their analytics pages — consistent visual language
- Table of Contents only shown on desktop (xl breakpoint) — not valuable on mobile
- PDF export captures what the user sees — WYSIWYG principle
- Email design matches app Terminal aesthetic — monospace, dark, branded
- Graceful degradation: if MDX fails to compile, raw markdown still renders beautifully
- Components handle missing data gracefully — show placeholder text, never crash

## Story Dependency Order

```
US-000 (Audit)
  ↓
┌─── Backend Track ─────────────────────┐  ┌─── Email Track ─────────────────┐
│                                       │  │                                 │
│ US-001 (Schema changes)               │  │ US-007 (React Email setup)      │
│   ↓                                   │  │   ↓                             │
│ US-002 (store_report_data tool)       │  │ US-008 (Report email template)  │
│ US-003 (System prompt update)         │  │   ↓                             │
│   ↓                                   │  │ US-009 (Update email delivery)  │
│ US-004 (Trigger.dev task update) ─────│──│──→ (depends on US-008)          │
│   ↓                                   │  │                                 │
│ US-005 (tRPC endpoint updates)        │  └─────────────────────────────────┘
│   ↓                                   │
│ US-006 (Integration tests)            │
│                                       │
└───────────────────────────────────────┘
  ↓
┌─── Frontend Track ────────────────────┐
│                                       │
│ US-010 (MDX component library)        │
│   ↓                                   │
│ US-011 (Report viewer page)           │
│   ↓                                   │
│ US-012 (PDF export) ──────────┐       │
│ US-013 (Update report UI) ────┤ par.  │
│   ↓                           │       │
│ US-014 (Remove old PDF code)  │       │
│                               ↓       │
│ US-015 (E2E viewer tests) ────┐       │
│ US-016 (E2E interface tests) ─┘ par.  │
│                                       │
└───────────────────────────────────────┘
```

## Success Metrics

- Reports render with real AG Charts, MetricCards, and styled components — not just text
- AI naturally uses MDX components when they add value (verifiable by reviewing generated report content)
- Zero data loss on MDX compilation failure (graceful markdown fallback)
- Report viewer loads in < 2 seconds
- PDF export produces a readable multi-page document
- Email delivers with proper branding and viewer link
- `@react-pdf/renderer` fully removed from dependency tree
- All existing tests continue to pass
- All new E2E tests pass

## Open Questions

None — scope is well-defined. The AI gets a component catalog in its system prompt and decides when to use components. Data is stored via `store_report_data` tool and hydrated via `dataRef` context. No user behavior changes required.
