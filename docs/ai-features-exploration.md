# AI Features Exploration

> Working document for planning TheTraderLog's AI capabilities

## Current State

| Component | Status |
|-----------|--------|
| AI Tables (conversations, messages) | Schema exists |
| AI Frontend Page | Exists but hardcoded responses |
| Trigger.dev | Configured, 1 task (MAE/MFE) |
| Real AI Integration | Not started |

---

## Feature 1: Deep Trading Reports

### Vision
AI-powered deep analysis reports that can:
- Answer any trading question
- Generate custom charts/visualizations
- Analyze behavioral patterns
- Provide actionable insights
- Export as PDF

### Architecture Options

#### Option A: Daytona + Opus (Original Plan)
```
User Prompt → Opus → Python Sandbox (Daytona) → Charts/Analysis → PDF
```

**Pros:**
- Full flexibility (AI writes custom Python)
- Any visualization possible (matplotlib, plotly, seaborn)
- Complex statistical analysis (scipy, statsmodels)

**Cons:**
- High cost (~$5/report with Opus orchestrating)
- Daytona adds complexity and another vendor
- Cold start latency for sandboxes

**Cost Breakdown (Opus):**
- Input: ~50K tokens context (trades, strategies, journals) = ~$0.75
- Output: ~10K tokens (analysis + code) = ~$0.50
- Multiple turns for clarification/iteration = 3-5x multiplier
- **Estimated: $3-8 per deep report**

#### Option B: Sonnet + Daytona
Same architecture but using Sonnet 4 instead of Opus.

**Cost Breakdown (Sonnet):**
- Input: ~50K tokens = ~$0.15
- Output: ~10K tokens = ~$0.10
- Multiple turns = 3-5x multiplier
- **Estimated: $0.50-1.50 per report**

**Tradeoff:** Sonnet is very capable for code generation and analysis. May be 90% as good for 80% less cost.

#### Option C: Hybrid Model Approach
```
Sonnet (orchestration/code) + Opus (final insights/recommendations)
```

Use Sonnet for:
- Data gathering
- Chart generation
- Code execution

Use Opus only for:
- Final synthesis
- Nuanced insights
- Recommendations

**Estimated: $1-3 per report**

#### Option D: Pre-built Analysis Templates
Instead of AI writing custom code each time:
- Pre-define 10-20 common analysis types
- AI selects and parameterizes templates
- Much faster, cheaper, more predictable

**Examples:**
1. Win Rate by Time of Day (heatmap)
2. P&L Distribution (histogram)
3. Drawdown Analysis (line chart)
4. Setup Performance Comparison (bar chart)
5. R:R vs Win Rate Scatter
6. Consecutive Loss Patterns
7. Position Sizing Efficiency
8. Entry Timing Analysis
9. Exit Optimization
10. Session Performance Breakdown

**Pros:**
- Predictable cost ($0.20-0.50/report)
- Fast (no cold starts)
- Consistent quality
- No Daytona needed

**Cons:**
- Less flexible
- Can't handle truly novel questions
- Still needs AI to interpret and narrate

---

## Cost Analysis

### If 100 users do 5 reports/month:

| Approach | Cost/Report | Monthly Cost | Annual |
|----------|-------------|--------------|--------|
| Opus + Daytona | $5 | $2,500 | $30,000 |
| Sonnet + Daytona | $1 | $500 | $6,000 |
| Hybrid | $2 | $1,000 | $12,000 |
| Templates + Sonnet | $0.35 | $175 | $2,100 |

### Pricing Strategy

To break even at $5/report cost:
- Need to charge ~$7-10/report
- Or subscription: $30-50/month for 5 reports

At $1/report cost:
- Can offer 5 free reports/month as loss leader
- Premium unlimited at $15/month profitable

---

## Feature 2: Ideas (Budget Permitting)

### 2A: AI Trade Copilot (Conversational)
Real-time chat about your trading data.

**Use Cases:**
- "Why did I lose money last Tuesday?"
- "Compare my ES vs NQ performance"
- "What's my best setup this month?"

**Cost:** $0.05-0.20 per conversation turn (Haiku/Sonnet)

**Value:** High engagement, drives retention

### 2B: AI Journal Assistant
Helps write daily journal entries.

**Use Cases:**
- "Summarize my trades today"
- "What emotions might have affected my trading?"
- "Suggest areas to focus on tomorrow"

**Cost:** ~$0.10 per journal assist (Haiku)

**Value:** Reduces friction, improves journal quality

### 2C: AI Strategy Builder
Helps define and refine trading strategies.

**Use Cases:**
- "Create a strategy from my best trades"
- "What rules would have improved my win rate?"
- "Backtest this strategy modification"

**Cost:** $0.50-2 per session (Sonnet)

**Value:** Core differentiation, high perceived value

### 2D: Pattern Detection (Automated)
Background analysis that surfaces insights proactively.

**Use Cases:**
- "You've lost 5 trades in a row after 2pm lately"
- "Your win rate drops 30% on Fridays"
- "This setup performs better with tighter stops"

**Cost:** ~$0.10/day per user (batch processing)

**Value:** "Aha moments" without user effort

---

## Questions to Resolve

1. **Daytona vs Templates:** Do we need full Python flexibility, or can templates cover 80% of use cases?

2. **Model Selection:** Opus for everything, or tiered approach (Haiku→Sonnet→Opus)?

3. **Pricing Model:**
   - Per-report pricing?
   - Subscription tiers?
   - Free tier with limits?

4. **MVP Scope:**
   - Deep reports only?
   - Include conversational?
   - Automated insights?

5. **Build Order:**
   - Reports first (highest value)?
   - Copilot first (fastest to build)?
   - Pattern detection (runs in background)?

---

## Recommended Architecture: Tool-Augmented Opus

### The Insight
TradeZella charges $50/month for "db rows" - no AI. At $50/month premium with 5 deep reports, even $5/report Opus costs = 50% margin. **Optimize for quality, not cost.**

But: Don't make Opus reinvent the wheel every time. Give it a library of pre-built, tested tools.

### Architecture
```
User Question
    ↓
Opus (orchestration + interpretation)
    ↓
┌─────────────────────────────────────────────┐
│  Pre-built Tool Library (Python/Daytona)    │
├─────────────────────────────────────────────┤
│  ANALYSIS FUNCTIONS                         │
│  - win_rate_by_hour(trades, filters)        │
│  - pnl_distribution(trades, bins)           │
│  - drawdown_analysis(equity_curve)          │
│  - consecutive_streaks(trades, type)        │
│  - setup_performance(trades, setup_ids)     │
│  - entry_timing_analysis(trades)            │
│  - exit_optimization(trades)                │
│  - session_breakdown(trades, sessions)      │
│  - rr_vs_winrate_scatter(trades)            │
│  - position_sizing_efficiency(trades)       │
│  - mae_mfe_analysis(trades)                 │
│  - behavioral_patterns(trades, journals)    │
├─────────────────────────────────────────────┤
│  CHART GENERATORS                           │
│  - heatmap(data, x, y, value)               │
│  - histogram(data, bins, color)             │
│  - line_chart(series, annotations)          │
│  - bar_chart(categories, values)            │
│  - scatter(x, y, color_by, size_by)         │
│  - equity_curve(trades, drawdown_overlay)   │
│  - calendar_heatmap(dates, values)          │
├─────────────────────────────────────────────┤
│  DATA ACCESS                                │
│  - get_trades(filters, date_range)          │
│  - get_strategies()                         │
│  - get_journal_entries(date_range)          │
│  - get_market_context(symbol, timestamp)    │
│  - get_account_stats(account_id)            │
└─────────────────────────────────────────────┘
    ↓
Opus interprets results, generates narrative
    ↓
PDF Report
```

### Why This Works
1. **Opus focuses on intelligence** - understanding questions, choosing tools, interpreting results, generating insights
2. **Tools are tested & optimized** - no token waste on boilerplate, no bugs from regenerated code
3. **Consistent output** - charts look the same, analysis is reliable
4. **Still flexible** - Opus can write custom Python when needed, but doesn't have to
5. **Faster** - tool calls vs. code generation + execution

### Token Efficiency
Instead of Opus writing:
```python
def calculate_win_rate_by_hour(trades):
    hourly = {}
    for trade in trades:
        hour = trade.entry_time.hour
        if hour not in hourly:
            hourly[hour] = {"wins": 0, "total": 0}
        hourly[hour]["total"] += 1
        if trade.pnl > 0:
            hourly[hour]["wins"] += 1
    # ... 50 more lines
```

Opus just calls:
```python
result = analyze.win_rate_by_hour(trades, group_by="hour")
chart = charts.heatmap(result, x="hour", y="day", value="win_rate")
```

**~90% fewer output tokens for analysis code.**

### Build Order

**Phase 1: Tool Library (Daytona/Python)**
- Build 15-20 analysis functions
- Build 8-10 chart generators
- Data access layer
- Test thoroughly

**Phase 2: Opus Integration**
- System prompt with tool documentation
- Function calling setup
- Conversation flow (clarification, follow-ups)

**Phase 3: Report Pipeline**
- Trigger.dev orchestration
- PDF generation (Puppeteer)
- Email delivery (Resend)

**Phase 4: Additional Features**
- Conversational copilot (reuse tools, use Sonnet)
- Automated insights (batch processing)

---

## Final Infrastructure Decisions

### Model Provider: Anthropic SDK (Direct)
- Opus for deep reports (quality over cost at $50/month premium)
- Sonnet for conversational copilot (cost-efficient for chat)
- No OpenRouter, no Vercel AI SDK - Anthropic SDK handles everything:
  - `toolRunner()` auto-loops tool calls
  - `betaZodTool()` for type-safe tool definitions
  - `client.messages.stream()` for streaming
  - MCP helpers built-in if needed later

### Code Sandbox: Daytona
- Theo.gg recommended
- **Why we need it:** Users can ask reports on ANYTHING. Pre-built tools = "here are 15 reports we thought of". Daytona = "ask me literally anything about your trading". The AI needs to write custom analysis code on the fly.
- Opus writes Python → Daytona executes safely → returns JSON
- Pre-installed: pandas, numpy, scipy, statsmodels
- ~200ms cold start, simple SDK:
  ```typescript
  const sandbox = await daytona.create()
  const response = await sandbox.process.codeRun(pythonCode)
  ```
- We still build a utility library (common functions) so Opus doesn't reinvent the wheel, but it CAN write custom code when needed

### Chart Rendering: AG Charts (React, server-side)
- Already built and styled for terminal design system
- Consistent with rest of app
- Daytona returns data → AG Charts renders
- No matplotlib/plotly styling inconsistency

### Report Storage & Viewing: Typed JSON
- Opus outputs **structured JSON** with typed sections
- Reuse existing AG Charts components from analytics (same types, same components)
- Store report JSON in DB (or R2 if large)
- Simple renderer: switch on section type, render corresponding component
- Fully typed with discriminated unions, Zod validates Opus output
- Reports rendered as pages in the app (`/reports/[id]`)
- AG Charts renders client-side (interactive, hover, zoom)
- Email contains link to report, not attachment
- "Export PDF" button in-app using `html2pdf.js` or print CSS
- **No MDX parsing, no Puppeteer, type-safe end-to-end**

```typescript
type ReportSection =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "chart"; config: ChartConfig }  // existing AG Charts type
  | { type: "list"; items: string[] }
  | { type: "callout"; variant: "insight" | "warning"; text: string }
```

### Background Jobs: Trigger.dev (already configured)
- Orchestrates the full report pipeline
- Handles retries, timeouts
- Non-blocking for user

### Storage: Existing Stack
- Postgres: conversations, report metadata
- R2: PDF files, chart images if needed

### Notifications: Email + In-app + Chime
- **Hybrid flow:** Interactive clarification (sync) → heavy analysis (async)
- Chime/sound when Opus needs user attention mid-conversation
- Chime when report is complete
- Resend for email delivery (with PDF attached or link)
- In-app notification badge
- Reports history page to view/download past reports

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER REQUEST                              │
│                    "Analyze my win rate by time"                 │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      tRPC Router (ai.ts)                         │
│                   - Validate request                             │
│                   - Check credits                                │
│                   - Kick off Trigger.dev task                    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Trigger.dev Task: generate-report                │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1. CONTEXT GATHERING                                      │  │
│  │     - Load user's trades, strategies, journals             │  │
│  │     - Build context for Opus                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  2. OPUS ORCHESTRATION                                     │  │
│  │     - Understands question                                 │  │
│  │     - Decides which tools to call                          │  │
│  │     - May ask clarifying questions (multi-turn)            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  3. DAYTONA SANDBOX (Python)                               │  │
│  │     - Runs analysis functions                              │  │
│  │     - Returns JSON data                                    │  │
│  │     ┌─────────────────────────────────────────────────┐   │  │
│  │     │  analyze.win_rate_by_hour(trades)               │   │  │
│  │     │  analyze.drawdown_analysis(equity)              │   │  │
│  │     │  analyze.behavioral_patterns(trades, journals)  │   │  │
│  │     │  → Returns: { data: [...], insights: [...] }    │   │  │
│  │     └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  4. OPUS INTERPRETATION                                    │  │
│  │     - Analyzes results                                     │  │
│  │     - Generates narrative insights                         │  │
│  │     - Writes report content (markdown)                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  5. STORE REPORT                                           │  │
│  │     - Save structured data (JSON) to DB                    │  │
│  │     - Charts config, narrative, insights                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  6. NOTIFICATION                                           │  │
│  │     - Update DB (report complete)                          │  │
│  │     - Send email via Resend (with link to report)          │  │
│  │     - In-app notification + chime                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Anthropic SDK Pattern

The `toolRunner()` handles the entire orchestration loop:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const anthropic = new Anthropic();

// Define tools with Zod (type-safe, auto-validates)
const analyzeWinRate = betaZodTool({
  name: 'analyze_win_rate',
  description: 'Analyze win rate by time of day',
  inputSchema: z.object({
    trades: z.array(z.object({ /* trade schema */ })),
    groupBy: z.enum(['hour', 'session', 'day']),
  }),
  run: async (input) => {
    // Call Daytona sandbox here
    const result = await daytona.runPython('win_rate.py', input);
    return result;
  },
});

// toolRunner auto-loops until Claude is done
const finalMessage = await anthropic.beta.messages.toolRunner({
  model: 'claude-opus-4-5-20251101',
  max_tokens: 8000,
  system: tradingAnalystPrompt,
  messages: [{ role: 'user', content: userQuestion }],
  tools: [analyzeWinRate, analyzeDrawdown, generateChart /* ... */],
});

// finalMessage contains the complete analysis
```

**Why this is great:**
- No manual tool call loop management
- Zod validates inputs automatically
- Tools can be async (call Daytona, DB, etc.)
- Streaming works with `.stream()` variant

---

## File Structure (New)

```
src/
├── server/api/routers/
│   └── ai.ts                    # NEW: AI endpoints
├── lib/ai/
│   ├── anthropic.ts             # Anthropic SDK client
│   ├── context-builder.ts       # Builds context from user data
│   ├── prompts/
│   │   └── trading-analyst.ts   # System prompts for Opus
│   └── tools/
│       └── definitions.ts       # Tool schemas for function calling
├── trigger/
│   ├── generate-report.ts       # NEW: Main report orchestration
│   └── process-trade-maemfe.ts  # Existing
├── app/(protected)/
│   └── reports/
│       └── [id]/
│           └── page.tsx         # Report viewer (AG Charts)
└── lib/analysis/                # NEW: Analysis function definitions
    ├── win-rate.ts              # Mirrored in Daytona
    ├── drawdown.ts
    ├── streaks.ts
    └── index.ts
```

**Daytona Sandbox (Python):**
```
daytona/
├── analysis/
│   ├── win_rate.py
│   ├── drawdown.py
│   ├── streaks.py
│   ├── position_sizing.py
│   ├── behavioral.py
│   └── __init__.py
├── requirements.txt             # pandas, numpy, scipy, statsmodels
└── main.py                      # Entry point for function calls
```

---

## MVP Feature Scope

### Phase 1: Deep Reports (MVP)
- User submits question
- Opus orchestrates analysis
- Daytona runs Python
- AG Charts renders
- PDF generated
- Email + in-app notification
- 5 reports/month included in premium

### Phase 2: Conversational Copilot
- Reuses same tool library
- Sonnet instead of Opus (cheaper for chat)
- Real-time responses (no PDF)
- Unlimited in premium tier

### Phase 3: Automated Insights
- Background job runs weekly
- Detects patterns, anomalies
- Pushes notifications
- "You lost 40% more on Fridays this month"

---

## Cost Summary (Premium $50/month)

| Component | Cost per Report | Monthly (5 reports) |
|-----------|-----------------|---------------------|
| Opus (orchestration + narrative) | ~$3-4 | $15-20 |
| Daytona (sandbox compute) | ~$0.10-0.50 | $0.50-2.50 |
| R2 storage | negligible | ~$0.10 |
| Resend email | negligible | ~$0.01 |
| **Total** | **~$4-5** | **~$20-25** |

**Gross margin: ~50-60%** at $50/month premium tier.

---

## PRD Breakdown

This is too large for one PRD. Here are the logical separation points:

---

### PRD 1: Daytona Foundation
**Goal:** Get a single analysis tool working end-to-end via Daytona.

**Scope:**
- Research & integrate Daytona SDK
- Create one Python analysis function (e.g., `win_rate_by_hour`)
- Basic tRPC endpoint to trigger it
- Return JSON result to frontend
- Prove the sandbox works

**Stories (~5-8):**
- Set up Daytona account/credentials
- Create Daytona client wrapper (`src/lib/daytona/client.ts`)
- Write `win_rate_by_hour.py` analysis function
- Create `ai.runAnalysis` tRPC endpoint
- Wire up frontend test button
- Handle errors/timeouts

**Output:** Can call Daytona from Next.js, run Python, get JSON back.

**Resolved:**
- [x] Daytona SDK - Simple TypeScript SDK, ~200ms cold start, `sandbox.process.codeRun()`
- [ ] How to pass trade data to sandbox (JSON serialized in code? File upload?)

---

### PRD 2: Analysis Tool Library
**Goal:** Build out the full Python analysis library in Daytona.

**Scope:**
- 10-15 analysis functions
- Consistent input/output schemas
- Unit tests for each function
- Documentation for Opus (tool descriptions)

**Stories (~10-15):**
- `win_rate_by_hour(trades, group_by)`
- `win_rate_by_day(trades)`
- `pnl_distribution(trades, bins)`
- `drawdown_analysis(equity_curve)`
- `consecutive_streaks(trades, type)`
- `setup_performance(trades, setup_ids)`
- `entry_timing_analysis(trades, market_data)`
- `exit_optimization(trades)`
- `session_breakdown(trades, sessions)`
- `mae_mfe_analysis(trades)`
- `position_sizing_efficiency(trades)`
- `behavioral_correlation(trades, journals)`
- Tool schema definitions (Zod) for each

**Output:** Complete library Opus can call.

**Depends on:** PRD 1

---

### PRD 3: AI Orchestration
**Goal:** Wire up Anthropic SDK with toolRunner pattern.

**Scope:**
- Anthropic client setup
- System prompt for trading analyst
- Tool definitions (Zod schemas)
- toolRunner integration
- Trigger.dev task for async execution
- Conversation storage (use existing aiConversations/aiMessages tables)

**Stories (~8-10):**
- Create Anthropic client (`src/lib/ai/anthropic.ts`)
- Write trading analyst system prompt
- Define all tools with `betaZodTool()`
- Create `generate-report` Trigger.dev task
- Context builder (load user's trades, strategies, journals)
- Store conversation history
- Handle multi-turn (if Opus needs clarification)
- `ai.startReport` tRPC endpoint
- `ai.getReportStatus` tRPC endpoint

**Output:** Can ask Opus a question, it calls tools, returns analysis.

**Depends on:** PRD 2

**Open questions to resolve first:**
- [ ] Clarification flow - sync (wait for user) or async (email)?

---

### PRD 4: Report Renderer
**Goal:** Beautiful in-app reports using typed JSON, reusing analytics charts.

**Scope:**
- Report section types (Zod schemas)
- Report renderer component (switch on section type)
- Reuse existing AG Charts components from analytics
- Report storage in DB
- Email delivery via Resend (link to report)
- Optional PDF export

**Stories (~6-8):**
- Define `ReportSection` discriminated union types
- Create Zod schema to validate Opus output
- Build `ReportRenderer` component (~50 lines)
- Create section components: `Heading`, `Paragraph`, `Callout`, `List`
- Wire up existing analytics chart components
- Report page (`/reports/[id]/page.tsx`)
- Resend email template (link to report)
- `ai.getReport` tRPC endpoint
- "Export PDF" button using html2pdf.js
- Print-friendly CSS

**Output:** Opus outputs typed JSON → stored in DB → rendered with existing components.

**Depends on:** PRD 3

**Resolved:**
- [x] Report format - typed JSON sections
- [x] Charts - reuse existing AG Charts from analytics
- [x] No MDX/SSR complexity

---

### PRD 5: User Experience
**Goal:** Polish the user-facing flow.

**Scope:**
- Report request UI (question input, date range picker)
- Progress/status tracking
- In-app notifications
- Report history page
- Credit system (5/month)

**Stories (~8-10):**
- Redesign AI page with report request form
- Date range picker component
- "Generating report..." progress UI
- In-app notification system
- Report history list
- Credit tracking (add `aiCreditsUsed` to user settings?)
- Credit limit enforcement
- "Upgrade to premium" prompt when limit hit
- Settings page: notification preferences

**Output:** Complete user experience.

**Depends on:** PRD 4

**Open questions to resolve first:**
- [ ] Credit system - hard limit vs soft limit?
- [ ] Free tier - any AI access?

---

### PRD 6: Conversational Copilot (Future)
**Goal:** Real-time chat using the same tools.

**Scope:**
- Chat UI (already exists, needs upgrade)
- Sonnet instead of Opus (cheaper)
- Streaming responses
- Reuse tool library
- No PDF generation

**Stories (~5-8):**
- Upgrade existing AI chat page
- Streaming response handler
- Switch to Sonnet for chat
- Quick suggested questions
- Chat history persistence

**Depends on:** PRD 3 (reuses tools)

---

## Recommended Order

```
PRD 1 (Foundation)
    ↓
PRD 2 (Tool Library) ←──────┐
    ↓                       │
PRD 3 (AI Orchestration)    │
    ↓                       │
PRD 4 (Report Output)       │
    ↓                       │
PRD 5 (User Experience)     │
                            │
PRD 6 (Copilot) ────────────┘ (parallel after PRD 3)
```

---

## Open Questions (Resolve Before PRDs)

1. ~~**Daytona specifics**~~ ✅ Resolved - TypeScript SDK, simple API, keeps Opus flexible for "any question"
2. ~~**Clarification flow**~~ ✅ Resolved - **Hybrid sync/async**
   - User submits question
   - If Opus needs clarification → chime/notification → user responds (sync)
   - Once clear → heavy analysis runs async in background
   - Email + chime when report is done
   - Reports viewable/downloadable on site (reports history page)
3. ~~**Report template**~~ ✅ Resolved - Fixed frame, flexible middle:
   - Header (title, question, date)
   - Executive Summary (2-3 sentence takeaway)
   - Key Findings (bullet points with numbers)
   - Analysis (flexible - Opus decides charts/narrative)
   - Recommendations (actionable next steps)
   - Methodology (small/collapsible - how Opus analyzed)
4. ~~**Credit system**~~ ✅ Resolved - **Configurable, data-driven**
   - Don't hardcode limits - make them admin-configurable
   - Track actual cost per report (tokens used, Daytona compute time)
   - Test with real usage first, then set pricing based on data
   - Clerk billing integration for subscription management
5. **Free tier** - Any AI access for free users? Or premium-only? (decide later based on costs)
6. ~~**AG Charts SSR**~~ ✅ Not needed - Reports render client-side in-app, export via html2pdf if needed

---

## Notes & Ideas

_Space for iteration..._

