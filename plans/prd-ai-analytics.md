# PRD: AI Analytics System

## Overview

Replace the current client-side fake AI page with a real AI analytics system powered by OpenRouter. Two modes: **Chat** (real-time conversational Q&A about trading data) and **Report** (deep, long-running analysis with Python charts and PDF output). The AI has full access to the user's trading data via SQL queries and existing tRPC analytics endpoints, plus a Daytona Python sandbox for custom statistical analysis and visualization.

## Goals

- Real-time AI chat that can answer any question about a user's trading data
- Deep report generation with custom Python charts (matplotlib, plotly, seaborn)
- OpenRouter integration for model flexibility (test Kimi K2, GLM-4, DeepSeek, Claude, GPT, etc.)
- AI writes custom SQL queries scoped to the user for maximum flexibility
- AI can also call existing tRPC analytics endpoints as tools for common metrics
- Daytona Python sandbox for statistical analysis (scipy, statsmodels, pandas)
- Server-side OpenRouter key (pay-as-you-go billing to be implemented later)
- PDF report generation with email delivery via Resend

## User Stories

### US-000: Audit Existing Utilities for AI Analytics
**Description**: As a developer, I want to audit existing code before implementing AI analytics so that we reuse utilities and avoid duplication.

**Acceptance Criteria**:
- [ ] Search `src/lib/` for existing AI-related utilities, formatting helpers, analytics calculations
- [ ] Search `src/server/api/routers/analytics.ts` for all available endpoints and their input/output shapes
- [ ] Search `src/server/api/routers/trades.ts` for query patterns and user-scoping logic
- [ ] Document all 24+ analytics endpoints with descriptions (name, what it returns, input filters)
- [ ] Document existing schema context (all tables, columns, types, relationships)
- [ ] Document findings in `scripts/ralph/progress.txt`
- [ ] Typecheck passes (`bun run check`)

**Search Commands**:
```bash
grep -rn "export function\|export const" src/lib/analytics/ src/lib/trades/ src/lib/shared/
grep -rn "protectedProcedure" src/server/api/routers/analytics.ts | head -30
```

---

### US-001: Update AI Schema — Conversations, Messages, Reports
**Description**: As a developer, I want to update the AI database schema to support chat mode, report mode, and track model/token usage.

**Acceptance Criteria**:
- [ ] Update `aiConversations` table: add `status` (enum: `active`, `generating`, `complete`, `failed`), `mode` (enum: `chat`, `report`), `initialPrompt` (text), `dateRangeStart` (timestamp), `dateRangeEnd` (timestamp), `model` (text)
- [ ] Update `aiMessages` table: add `model` (text, nullable), `tokensUsed` (integer, nullable), `toolCalls` (text, nullable — JSON string of tool calls made)
- [ ] Create new `aiReports` table: `id`, `userId`, `conversationId` (FK), `title`, `prompt`, `model`, `status` (enum: `queued`, `generating`, `complete`, `failed`), `pdfUrl` (text, nullable), `pdfKey` (text, nullable), `tokensUsed` (integer), `triggerTaskId` (text, nullable), `createdAt`, `completedAt`
- [ ] Create new enums: `aiConversationStatusEnum`, `aiConversationModeEnum`, `aiReportStatusEnum`
- [ ] Add relations: aiReports → aiConversations, aiReports → users
- [ ] Export new types: `AiReport`, `NewAiReport`
- [ ] Add id generator for reports in `src/lib/shared` (e.g., `ids.aiReport()`)
- [ ] Run `bun run db:push` to apply schema
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: OpenRouter Client Service
**Description**: As a developer, I want an OpenRouter API client so that the AI system can call any model via a unified interface.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/client.ts` with OpenRouter client
- [ ] Uses `OPENROUTER_API_KEY` env variable (server-side only)
- [ ] Add `OPENROUTER_API_KEY` to `.env.example`
- [ ] Supports streaming responses (for chat mode)
- [ ] Supports non-streaming responses (for report mode / tool calling)
- [ ] Supports tool/function calling (OpenAI-compatible format)
- [ ] Model parameter accepts any string (e.g., `"anthropic/claude-sonnet-4"`, `"moonshotai/kimi-k2"`, `"openai/gpt-4.1"`)
- [ ] Default model configurable via constant in `src/lib/constants/ai.ts`
- [ ] Handles rate limiting and retries (exponential backoff, 3 retries)
- [ ] Returns token usage from response headers/body
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: AI Constants and Model Configuration
**Description**: As a developer, I want AI-related constants centralized so that model lists, default settings, and limits are never hardcoded in components.

**Acceptance Criteria**:
- [ ] Create `src/lib/constants/ai.ts`
- [ ] Export `DEFAULT_CHAT_MODEL` (e.g., `"moonshotai/kimi-k2"` or similar cheap model)
- [ ] Export `DEFAULT_REPORT_MODEL` (e.g., `"anthropic/claude-sonnet-4"` for deeper analysis)
- [ ] Export `AI_MODELS` array: `{ id: string, name: string, provider: string, description: string, mode: "chat" | "report" | "both" }`
- [ ] Export `AI_MODES` constant for chat/report mode options
- [ ] Export `MAX_CHAT_MESSAGES_PER_CONVERSATION` (e.g., 50)
- [ ] Export `MAX_REPORT_TOKENS` (e.g., 100000)
- [ ] Export `SUGGESTED_CHAT_QUERIES` (replace the 6 hardcoded ones in current AI page)
- [ ] Export `SUGGESTED_REPORT_PROMPTS` (e.g., "Analyze my trailing stop optimization", "What-if analysis: hold 5 min longer")
- [ ] Typecheck passes (`bun run check`)

---

### US-004: Schema Context Generator
**Description**: As a developer, I want to auto-generate a schema description from the Drizzle schema so the AI knows all tables, columns, types, and relationships without hallucinating.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/schema-context.ts`
- [ ] Export `generateSchemaContext()` function that returns a string
- [ ] Includes all table names, column names, column types, nullable info, and enum values
- [ ] Includes relationship descriptions (e.g., "trades belong to users via userId", "tradeTags is a junction between trades and tags")
- [ ] Includes example queries for common patterns (e.g., "get all trades for a user with their tags", "P&L by day of week")
- [ ] Includes list of all tRPC analytics endpoints with descriptions (from US-000 audit)
- [ ] Context is a static string (generated once at build/startup, not per-request)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: AI Context Builder — User-Specific Context
**Description**: As a developer, I want a context builder that loads a user's strategies, tags, trading sessions, and recent journals to give the AI personalized context.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/context-builder.ts`
- [ ] Export `buildUserContext(userId: string)` function
- [ ] Loads user's strategies (names, descriptions, entry/exit criteria, risk parameters)
- [ ] Loads user's tags (names, colors)
- [ ] Loads user's trading sessions (custom session definitions from settings)
- [ ] Loads user's account list (names, types, instruments)
- [ ] Loads user's recent journal entries (last 7 days, just content summaries)
- [ ] Loads user's breakeven threshold from settings
- [ ] Returns formatted string for system prompt injection
- [ ] Handles missing data gracefully (new users with no strategies, etc.)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: AI System Prompt — Trading Analyst Persona
**Description**: As a developer, I want a well-crafted system prompt that makes the AI behave as an expert trading analyst with access to the user's data.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/prompts/trading-analyst.ts`
- [ ] Export `buildSystemPrompt(params: { schemaContext: string, userContext: string, mode: "chat" | "report" })` function
- [ ] Persona: Expert trading performance analyst and coach
- [ ] Instructs AI on available tools (run_query, call_analytics, get_market_data, run_python)
- [ ] Instructs AI that all SQL queries are automatically user-scoped (no need for WHERE user_id)
- [ ] For chat mode: concise, conversational, use tools to answer quickly
- [ ] For report mode: thorough, use multiple tools, generate charts, provide deep analysis
- [ ] Includes schema context and user context as reference sections
- [ ] Reminds AI about decimal handling (P&L stored as strings, parse with parseFloat)
- [ ] Reminds AI about timestamp handling (all timestamps are with timezone)
- [ ] Typecheck passes (`bun run check`)

---

### US-007: AI Tool — run_query (Read-Only SQL Execution)
**Description**: As a developer, I want a tool that lets the AI execute read-only SQL queries scoped to the current user so it can answer custom questions.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/tools/run-query.ts`
- [ ] Export tool definition in OpenAI function-calling format (name, description, parameters JSON schema)
- [ ] Export `executeRunQuery(userId: string, query: string)` function
- [ ] Validates query is SELECT-only (reject INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE)
- [ ] Wraps query in user-scoped CTE: `WITH user_trades AS (SELECT * FROM trade WHERE user_id = $1), user_accounts AS (...), ...` for all user-owned tables
- [ ] Uses the main database connection (read-only role can be added later as ops task)
- [ ] Returns results as JSON (array of objects)
- [ ] Limits result rows to 500 to prevent massive responses
- [ ] Handles SQL errors gracefully (returns error message, not stack trace)
- [ ] Logs queries for debugging (but not in production)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: AI Tool — call_analytics (Existing tRPC Endpoints)
**Description**: As a developer, I want a tool that lets the AI invoke existing analytics tRPC endpoints as a convenience shortcut.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/tools/call-analytics.ts`
- [ ] Export tool definition in OpenAI function-calling format
- [ ] Export `executeCallAnalytics(userId: string, endpoint: string, input: Record<string, unknown>)` function
- [ ] Supports calling analytics router procedures: `getOverview`, `getPerformanceByDayOfWeek`, `getPerformanceByHour`, `getPerformanceBySession`, `getPerformanceByMonth`, `getRiskMetrics`, `getEquityCurve`, `getDrawdownHistory`, `getRMultipleDistribution`, `getRiskRewardAnalysis`, `getPositionSizeAnalysis`, `getPerformanceBySymbol`, `getStreakAnalysis`, `getRevengeTrading`, `getOvertradingAnalysis`, `getHoldingTimeAnalysis`, `getBehavioralPatterns`, `getMonteCarloSimulation`
- [ ] Also supports trades router: `getStats`, `getAll` (with filters)
- [ ] Creates a server-side caller using `createCallerFactory` with the user's context
- [ ] Validates endpoint name is in allowlist
- [ ] Passes through filter input (dateRange, symbols, etc.)
- [ ] Returns JSON results
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-009: AI Tool — get_market_data (Candle Data for Price Analysis)
**Description**: As a developer, I want a tool that lets the AI fetch OHLC market data for specific symbols and time ranges so it can analyze price action.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/tools/get-market-data.ts`
- [ ] Export tool definition in OpenAI function-calling format
- [ ] Export `executeGetMarketData(symbol: string, interval: string, startDate: string, endDate: string)` function
- [ ] Uses existing market data service (`src/lib/market-data/service.ts`) and candle cache
- [ ] Returns array of `{ timestamp, open, high, low, close, volume }` objects
- [ ] Limits response to reasonable size (e.g., max 1000 bars)
- [ ] Handles missing data gracefully
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010: AI Tool — run_python (Daytona Sandbox Execution)
**Description**: As a developer, I want a tool that lets the AI execute Python code in a Daytona sandbox for statistical analysis and chart generation.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/tools/run-python.ts`
- [ ] Export tool definition in OpenAI function-calling format
- [ ] Export `executeRunPython(code: string, dataContext?: string)` function
- [ ] Integrates with Daytona SDK to create/reuse sandboxes
- [ ] Add `DAYTONA_API_KEY` to `.env.example`
- [ ] Pre-installed packages: pandas, numpy, scipy, matplotlib, plotly, seaborn, statsmodels
- [ ] Captures stdout/stderr output
- [ ] Captures generated image files (matplotlib `savefig`, plotly `write_image`)
- [ ] Uploads generated images to S3 (Cloudflare R2) and returns URLs
- [ ] Execution timeout: 60 seconds
- [ ] Sandbox resource limits (CPU, memory)
- [ ] Returns `{ stdout: string, stderr: string, images: string[], artifacts: string[] }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-011: AI Tool Registry and Executor
**Description**: As a developer, I want a unified tool registry that collects all AI tool definitions and handles execution dispatching.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/tools/index.ts`
- [ ] Export `AI_TOOLS` array with all tool definitions (run_query, call_analytics, get_market_data, run_python)
- [ ] Export `executeTool(toolName: string, args: Record<string, unknown>, context: { userId: string })` function
- [ ] Dispatches to the correct tool executor based on tool name
- [ ] Returns standardized result format `{ success: boolean, data?: unknown, error?: string }`
- [ ] Handles unknown tool names gracefully
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012: AI tRPC Router — Chat Endpoints
**Description**: As a developer, I want tRPC endpoints for AI chat so the frontend can create conversations, send messages, and receive streamed responses.

**Acceptance Criteria**:
- [ ] Create `src/server/api/routers/ai.ts`
- [ ] Register in `src/server/api/root.ts`
- [ ] `createConversation` mutation: creates conversation record with mode (chat/report), returns conversation ID
- [ ] `sendMessage` mutation: accepts conversationId + content, saves user message, calls OpenRouter with tool loop, saves assistant response, returns assistant message
- [ ] `getConversation` query: returns conversation with all messages
- [ ] `listConversations` query: returns paginated list of user's conversations (most recent first)
- [ ] `deleteConversation` mutation: soft or hard delete conversation and messages
- [ ] All procedures use `protectedProcedure`
- [ ] User ownership validated (can only access own conversations)
- [ ] sendMessage implements the full tool-calling loop: call model → if tool_calls, execute tools → feed results back → repeat until text response
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-013: AI tRPC Router — Report Endpoints
**Description**: As a developer, I want tRPC endpoints for AI report generation so users can request, track, and download reports.

**Acceptance Criteria**:
- [ ] Add to `src/server/api/routers/ai.ts`:
- [ ] `startReport` mutation: creates report record, triggers Trigger.dev task, returns report ID
- [ ] `getReport` query: returns report by ID with status, PDF URL
- [ ] `listReports` query: returns paginated list of user's reports
- [ ] `getReportStatus` query: returns just the status of a report (for polling)
- [ ] All procedures use `protectedProcedure`
- [ ] User ownership validated
- [ ] startReport creates conversation in `report` mode, saves initial prompt as first message
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-014: Integration Tests for AI Router
**Description**: As a developer, I want integration tests for the AI tRPC router so that we can verify correct behavior and prevent regressions.

**Acceptance Criteria**:
- [ ] Test file created: `tests/integration/ai.test.ts`
- [ ] Tests use `setupTrader()` fixture
- [ ] Test: createConversation creates a conversation in chat mode
- [ ] Test: createConversation creates a conversation in report mode
- [ ] Test: sendMessage saves user message and returns assistant message (mock OpenRouter)
- [ ] Test: getConversation returns conversation with messages
- [ ] Test: listConversations returns only user's conversations
- [ ] Test: deleteConversation removes conversation
- [ ] Test: unauthorized access rejected for all procedures
- [ ] Test: user cannot access another user's conversations
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-015: Trigger.dev Report Generation Task
**Description**: As a developer, I want a Trigger.dev long-running task that orchestrates deep AI report generation with multi-step tool calling.

**Acceptance Criteria**:
- [ ] Create `src/trigger/generate-ai-report.ts`
- [ ] Task accepts: `reportId`, `userId`, `prompt`, `model`, `dateRange`
- [ ] Loads user context and schema context
- [ ] Runs multi-turn tool-calling loop with the AI model (up to 20 tool rounds)
- [ ] Each tool call result is fed back to the model
- [ ] Saves all messages to the conversation's `aiMessages` table
- [ ] Tracks total tokens used
- [ ] Updates report status: `queued` → `generating` → `complete` / `failed`
- [ ] On completion: saves final analysis text to the last ai_message
- [ ] On failure: updates report status to `failed` with error in notes
- [ ] Uses `metadata.reportId` for idempotency
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-016: Report PDF Generation and Upload
**Description**: As a developer, I want reports compiled into PDF format and uploaded to S3 for download.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-pdf.ts`
- [ ] Export `generateReportPdf(params: { title: string, content: string, charts: string[], codeArtifacts: string[] })` function
- [ ] Uses Puppeteer (or `@react-pdf/renderer`) to compile HTML → PDF
- [ ] PDF styled with Terminal design theme (dark background, chartreuse accents, monospace fonts)
- [ ] Includes: title, date range, analysis sections, embedded chart images, code appendix
- [ ] Uploads PDF to S3 (Cloudflare R2) using existing storage patterns
- [ ] Returns `{ pdfUrl: string, pdfKey: string }`
- [ ] Updates `aiReports` record with pdfUrl and pdfKey
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-017: Report Email Delivery via Resend
**Description**: As a developer, I want completed reports emailed to the user so they can access them without logging in.

**Acceptance Criteria**:
- [ ] Create `src/lib/ai/report-email.ts`
- [ ] Export `sendReportEmail(params: { to: string, reportTitle: string, downloadUrl: string })` function
- [ ] Uses Resend SDK for email delivery
- [ ] Add `RESEND_API_KEY` to `.env.example`
- [ ] Email template: Terminal-styled HTML email with report title, completion timestamp, download button
- [ ] Presigned download URL (expires in 7 days)
- [ ] Called from Trigger.dev task after PDF upload completes
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-018: Frontend — AI Page Layout with Mode Switcher
**Description**: As a trader, I want the AI page to have a mode dropdown (Chat / Report) so I can choose between quick questions and deep analysis.

**Acceptance Criteria**:
- [ ] Redesign `src/app/(protected)/ai/page.tsx` as a layout wrapper
- [ ] Add mode dropdown at top: "Chat" (default) and "Report"
- [ ] Mode selection stored in URL search params or local state
- [ ] Chat mode shows the conversation interface
- [ ] Report mode shows the report request form + report history
- [ ] Model selector dropdown (populated from `AI_MODELS` constant)
- [ ] Terminal design styling maintained (dark bg, monospace, chartreuse accents)
- [ ] Add `data-testid` attributes on all interactive elements
- [ ] Responsive: works on mobile and desktop
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-019: Frontend — Chat Mode Interface
**Description**: As a trader, I want a real-time chat interface where I can ask questions about my trading data and get AI responses streamed back.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/ai/_components/chat-interface.tsx`
- [ ] Conversation list sidebar (collapsible on mobile): shows recent conversations
- [ ] "New conversation" button
- [ ] Message input with send button (existing terminal-style input)
- [ ] Messages displayed with markdown rendering (use `react-markdown` or similar)
- [ ] Streaming response display with typing indicator
- [ ] Suggested queries shown for empty conversations (from `SUGGESTED_CHAT_QUERIES` constant)
- [ ] Tool call indicators (show when AI is running SQL, calling analytics, etc.)
- [ ] Auto-scroll to latest message
- [ ] Calls `ai.sendMessage` tRPC mutation
- [ ] Calls `ai.listConversations` for sidebar
- [ ] Add `data-testid` attributes on all interactive elements
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-020: Frontend — Report Mode Interface
**Description**: As a trader, I want a report request form where I can describe what analysis I want, pick a date range, and track report progress.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/ai/_components/report-interface.tsx`
- [ ] Report request form: prompt textarea, date range picker, model selector
- [ ] Suggested report prompts (from `SUGGESTED_REPORT_PROMPTS` constant)
- [ ] "Generate Report" button calls `ai.startReport` mutation
- [ ] Active report progress indicator (polling `ai.getReportStatus`)
- [ ] Report history list with status badges (queued/generating/complete/failed)
- [ ] Download PDF button for completed reports
- [ ] Terminal design styling
- [ ] Add `data-testid` attributes on all interactive elements
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-021: Frontend — Markdown and Chart Rendering in Messages
**Description**: As a trader, I want AI responses to render markdown formatting and embedded chart images so the output is readable and professional.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/ai/_components/message-renderer.tsx`
- [ ] Renders markdown: headings, bold, italic, lists, code blocks, tables
- [ ] Renders inline images (chart URLs from Daytona/S3)
- [ ] Code blocks use terminal styling (dark bg, monospace, syntax highlighting optional)
- [ ] Tables use Terminal design (bordered, monospace)
- [ ] Numbers formatted with proper currency/percent formatting where obvious
- [ ] Used by both chat and report message display
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-022: E2E Tests for AI Chat Mode
**Description**: As a developer, I want E2E tests for the AI chat interface so that we can verify user flows work correctly.

**Acceptance Criteria**:
- [ ] Test file created: `tests/e2e/ai-chat.spec.ts`
- [ ] All new UI elements have `data-testid` attributes
- [ ] Test: AI page loads with mode switcher visible
- [ ] Test: Can switch between Chat and Report modes
- [ ] Test: Can create a new conversation
- [ ] Test: Can send a message and see response (mock or stub AI)
- [ ] Test: Suggested queries are clickable
- [ ] Test: Conversation list shows conversations
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-023: E2E Tests for AI Report Mode
**Description**: As a developer, I want E2E tests for the AI report interface so that we can verify the report flow works correctly.

**Acceptance Criteria**:
- [ ] Test file created: `tests/e2e/ai-report.spec.ts`
- [ ] All new UI elements have `data-testid` attributes
- [ ] Test: Report mode shows request form
- [ ] Test: Can fill in prompt and date range
- [ ] Test: Suggested prompts are clickable
- [ ] Test: Generate Report button triggers report creation
- [ ] Test: Report history shows reports with status
- [ ] Test: Completed reports show download button
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-024: Remove Client-Side Fake AI Logic
**Description**: As a developer, I want to remove the old client-side pattern-matching AI logic so the codebase is clean.

**Acceptance Criteria**:
- [ ] Remove `generateLocalInsight` function from AI page
- [ ] Remove `EXAMPLE_QUERIES` hardcoded array (replaced by constant)
- [ ] Remove `hasApiKey` state and API key notice banner (server-side key now)
- [ ] Remove the entire old message rendering logic (replaced by new components)
- [ ] Remove unused imports (Key, Settings icons if no longer needed)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

## Functional Requirements

1. **FR-001**: AI chat responses stream in real-time via OpenRouter streaming API
2. **FR-002**: AI can execute read-only SQL queries scoped to the authenticated user
3. **FR-003**: AI can call existing analytics tRPC endpoints as tools
4. **FR-004**: AI can fetch OHLC market data for any cached symbol
5. **FR-005**: AI can execute Python code in Daytona sandbox with data science packages
6. **FR-006**: Python-generated charts are uploaded to S3 and embedded in responses
7. **FR-007**: Report mode generates long-running analysis via Trigger.dev
8. **FR-008**: Completed reports are compiled to PDF and uploaded to S3
9. **FR-009**: Report completion triggers email notification with download link
10. **FR-010**: All AI conversations and messages are persisted in the database
11. **FR-011**: Users can only access their own conversations and reports
12. **FR-012**: AI has full schema context and user-specific context (strategies, tags, sessions)

## Non-Goals (Out of Scope)

- User-provided API keys (BYOK) — will be a later feature
- Pay-as-you-go billing / credit system — separate implementation
- Vector search / embeddings / "find similar trades"
- Real-time trade alerts or notifications
- Multi-user shared conversations
- Image/screenshot analysis (reading trade screenshots)
- Voice input
- Custom fine-tuned models

## Technical Considerations

### Database Changes
- Update `aiConversations` table (add status, mode, model, initialPrompt, dateRange fields)
- Update `aiMessages` table (add model, tokensUsed, toolCalls fields)
- New `aiReports` table
- New enums: `aiConversationStatusEnum`, `aiConversationModeEnum`, `aiReportStatusEnum`

### New Dependencies
- OpenRouter API (OpenAI-compatible SDK — use `openai` npm package with custom base URL)
- Daytona SDK (`@daytonaio/sdk`)
- Resend (`resend` npm package)
- Puppeteer (`puppeteer` for HTML → PDF)
- React Markdown (`react-markdown` + `remark-gfm` for message rendering)

### API Architecture
```
Chat Mode:
  Client → ai.sendMessage (tRPC) → OpenRouter (streaming) → tool loop → response

Report Mode:
  Client → ai.startReport (tRPC) → Trigger.dev task → OpenRouter (multi-turn) → PDF → S3 → Email
```

### File Structure
```
src/lib/ai/
├── client.ts                  # OpenRouter wrapper
├── context-builder.ts         # Load user strategies/tags/sessions
├── schema-context.ts          # Generate schema description
├── report-pdf.ts              # HTML → PDF compilation
├── report-email.ts            # Email via Resend
├── prompts/
│   └── trading-analyst.ts     # System prompt builder
└── tools/
    ├── index.ts               # Tool registry + executor
    ├── run-query.ts           # Read-only SQL with user scoping
    ├── call-analytics.ts      # Invoke tRPC endpoints
    ├── get-market-data.ts     # Fetch OHLC candles
    └── run-python.ts          # Daytona sandbox execution

src/lib/constants/
└── ai.ts                      # Models, limits, suggested prompts

src/server/api/routers/
└── ai.ts                      # tRPC router (chat + report endpoints)

src/trigger/
└── generate-ai-report.ts     # Long-running report task

src/app/(protected)/ai/
├── page.tsx                   # Layout with mode switcher
└── _components/
    ├── chat-interface.tsx     # Chat mode UI
    ├── report-interface.tsx   # Report mode UI
    └── message-renderer.tsx   # Markdown + chart rendering
```

### Environment Variables (New)
```
OPENROUTER_API_KEY=sk-or-...
DAYTONA_API_KEY=...
RESEND_API_KEY=re_...
```

## Design Considerations

- Terminal design system: dark background (`#050505`), chartreuse accent (`#d4ff00`), ice blue for AI elements (`#00d4ff`)
- Monospace (`font-mono`) for all interactive elements, message text, code blocks
- AI messages use ice blue accent color for distinction
- Tool call indicators: subtle badges showing "Running SQL...", "Analyzing data...", "Generating chart..."
- Report progress: terminal-style progress bar with step descriptions
- Mode switcher: dropdown with terminal styling, not tabs
- Charts embedded inline in messages, clickable to expand

## Success Metrics

- AI can answer arbitrary questions about a user's trading data using SQL + tRPC tools
- AI can generate Python charts that render inline in chat and in PDF reports
- Chat responses stream in under 2 seconds to first token
- Reports complete within 5 minutes for typical analysis
- PDF reports are professionally formatted and downloadable
- All existing tests continue to pass

## Open Questions

1. **Daytona sandbox lifecycle**: Create per-request or maintain a warm pool? (Start with per-request, optimize later)
2. **Streaming protocol**: Use Server-Sent Events via tRPC subscription, or return chunks via polling? (SSE preferred if tRPC supports it, otherwise polling)
3. **Chart theme**: Should Python charts match the Terminal design system exactly? (Yes — provide a matplotlib theme file in the sandbox)
