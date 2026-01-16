# Plan: AI Analytics System (Phase 4 - Core Differentiator)

## Overview

This is EdgeJournal's core differentiator - the reason to use this over TradeZella. A comprehensive AI analytics system where users can ask ANY question and receive deep, professional-grade analysis reports.

## Current State

**AI Today**: Client-side pattern matching with 6 hardcoded responses. No real AI.

**Data Available**:
- 17 tables of rich trading data (trades, executions, strategies, journals, tags)
- 24 analytics endpoints already computing metrics
- Market data cache with MAE/MFE and post-exit analysis

## User Requirements

1. **5 reports per month** - Deep, comprehensive AI analysis (Opus or GPT-4.5)
2. **User-prompted** - User asks ANY question, AI generates in-depth report
3. **Any date range** - From single day to entire trading history
4. **Conversational clarification** - AI asks questions to understand user's terminology
5. **Context-aware** - AI reads user's strategies, tags, notes, journals
6. **Downloadable/emailable** - PDF reports with charts and case studies
7. **Advanced analysis capabilities**:
   - Trailing stop optimization
   - Break-even analysis
   - "What if I held X minutes longer?"
   - Stop placement vs actual price movement
   - Custom calculations (e.g., "2 std devs on liquidity sweep legs")
   - Behavioral patterns (revenge trading, overtrading)
   - Strategy rule compliance analysis

**No quick chat** - Focus entirely on making reports exceptional. Quick questions are answered by the existing analytics UI.

## Architecture: Hybrid Database (Neon + Turso)

### Decision: Neon (shared) + Turso (per-user)

```
┌─────────────────────────────────────────────────────────────┐
│  NEON (Central PostgreSQL) - Shared Data                    │
│  - users table (Clerk sync, auth)                           │
│  - candle_cache (market data, shared across all users)      │
│  - billing/subscriptions                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TURSO (Per-User SQLite) - User Data                        │
│                                                             │
│  User A: libsql://{hash(userA)}.turso.io                   │
│  ├── trades, trade_executions                               │
│  ├── strategies, strategy_rules                             │
│  ├── tags, trade_tags                                       │
│  ├── daily_journals, journal_attachments                    │
│  ├── ai_reports, ai_conversations                           │
│  └── user_settings, filter_presets                          │
│                                                             │
│  User B: libsql://{hash(userB)}.turso.io                   │
│  └── [same schema, completely isolated]                     │
└─────────────────────────────────────────────────────────────┘
```

**Why this architecture:**
- **Monster aggregations** - Query just that user's DB, no filtering, no RLS
- **True isolation** - AI literally cannot see other users' data
- **Safe AI queries** - Read-only connection to user's Turso DB
- **Edge performance** - Turso is SQLite at edge, fast globally
- **Shared data stays shared** - candle_cache doesn't duplicate

**Turso setup:**
- Clerk webhook creates user DB on signup
- Drizzle ORM supports both Postgres (Neon) and SQLite (Turso)
- Schema synced via Turso parent database

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  AI Analytics Page (/ai)                                    │
│  - Conversation interface (clarifying questions)            │
│  - Report request form (date range, prompt)                 │
│  - Report history & downloads                               │
│  - Credit usage (X/5 reports)                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Trigger.dev (Long-Running AI Task)                         │
│  - Orchestrates multi-step AI conversation                  │
│  - Runs for 30-60+ minutes if needed                        │
│  - Handles tool calls (SQL queries)                         │
│  - Generates PDF report                                     │
│  - Sends email when complete                                │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ User's Turso │  │ Shared Neon  │  │ OpenRouter   │  │ Daytona      │
│ DB (trades,  │  │ (candles,    │  │ (Opus,       │  │ (Python)     │
│ strategies)  │  │ users)       │  │ GPT-4.5)     │  │ pandas       │
│ READ-ONLY    │  │ READ-ONLY    │  │              │  │ matplotlib   │
│              │  │              │  │              │  │ scipy        │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Report Generation                                          │
│  - Custom Python charts (matplotlib, plotly, seaborn)       │
│  - Statistical analysis (scipy, statsmodels)                │
│  - Code artifacts saved with report                         │
│  - PDF compilation (Puppeteer HTML→PDF)                     │
│  - Upload to S3                                             │
│  - Email via Resend                                         │
└─────────────────────────────────────────────────────────────┘
```

**Daytona for Python execution** - AI writes custom Python code for analysis and visualizations. Sandbox runs pandas, matplotlib, scipy for professional-grade charts and statistical analysis. Code is saved with report for reproducibility.

## Implementation Phases

### Phase 4.1: Database Migration (Neon → Turso per-user)
- [ ] Set up Turso account and parent schema database
- [ ] Create Clerk webhook to provision user DB on signup
- [ ] Set up Drizzle for Turso (libsql driver)
- [ ] Create `src/server/db/turso.ts` - per-user connection factory
- [ ] Keep `src/server/db/neon.ts` - shared data (users, candles, billing)
- [ ] Migrate existing user data from Neon to Turso (migration script)
- [ ] Update all routers to use user's Turso DB for user-specific data

### Phase 4.2: AI Infrastructure
- [ ] Add OpenRouter integration (or direct Anthropic/OpenAI)
- [ ] Create AI service (`src/lib/ai/client.ts`) with streaming
- [ ] Support model selection (Opus, GPT-4.5)
- [ ] Add `ai_reports` table to Turso schema
- [ ] Add `ai_conversations` table for multi-turn clarification
- [ ] Add credit tracking (aiCreditsUsed, aiCreditsResetAt) to user settings
- [ ] Monthly reset cron job for credits

### Phase 4.3: Context Builder & Tools
- [ ] Context builder loads user's strategies, tags, recent journals
- [ ] Define SQL tools for AI:
  - `run_query` - execute read-only SQL against user's Turso
  - `get_market_data` - fetch candles from shared Neon
  - `get_trade_details` - deep dive on specific trades
- [ ] Tool execution layer (validates SQL is read-only, executes, returns)
- [ ] AI can call tools iteratively during analysis

### Phase 4.4: Daytona Python Sandbox
- [ ] Daytona account and SDK integration
- [ ] Python environment with pre-installed packages:
  - pandas, numpy (data manipulation)
  - matplotlib, plotly, seaborn (visualization)
  - scipy, statsmodels (statistical analysis)
- [ ] `run_python` tool for AI to execute custom code
- [ ] Chart output capture (save generated images)
- [ ] Code artifact storage (save Python code with report)
- [ ] Sandbox resource limits and timeouts
- [ ] Error handling for failed code execution

### Phase 4.5: Conversation & Clarification Flow
- [ ] Multi-turn conversation support (AI asks clarifying questions)
- [ ] User can reference specific trades ("look at trade #47")
- [ ] AI builds understanding before deep analysis
- [ ] Conversation persisted in `ai_conversations` table
- [ ] Clear transition from "clarifying" to "generating report"

### Phase 4.6: Report Generation Pipeline (Trigger.dev)
- [ ] Create `generate-ai-report` Trigger.dev task
- [ ] Long-running (30-60+ min) with progress updates
- [ ] Compile Python-generated charts into report
- [ ] PDF compilation (Puppeteer HTML→PDF)
- [ ] Include code artifacts as appendix
- [ ] Upload PDF to S3
- [ ] Send email via Resend with download link
- [ ] Update `ai_reports` with completed report

### Phase 4.7: Frontend UI
- [ ] Redesign `/ai` page:
  - Conversation interface for clarification
  - Report request form (date range, prompt)
  - Progress indicator for running reports (with live updates)
  - Report history with download links
  - Credit usage display (X/5)
- [ ] Email notification preferences
- [ ] Model selection (Opus vs GPT-4.5)
- [ ] View code artifacts from reports

## Key Files to Create/Modify

### Database Layer
```
src/server/db/
├── neon.ts                # Shared DB connection (users, candles, billing)
├── turso.ts               # Per-user DB factory: getUserDb(userId)
├── schema/
│   ├── shared.ts          # Neon schema (users, candle_cache)
│   └── user.ts            # Turso schema (trades, journals, ai_reports, etc.)
```

### AI System
```
src/lib/ai/
├── client.ts              # OpenRouter wrapper (streaming, model selection)
├── context-builder.ts     # Load strategies, tags, journals for AI context
├── prompts/
│   └── trading-analyst.ts # System prompt: expert trading coach
└── tools/
    ├── index.ts           # Tool definitions
    ├── run-query.ts       # Execute read-only SQL on user's Turso
    ├── get-market-data.ts # Fetch candles from shared Neon
    └── get-trade-details.ts # Deep dive on specific trades

src/trigger/
└── generate-ai-report.ts  # Long-running report generation task
```

### API & Frontend
```
src/server/api/routers/ai.ts  # tRPC router (startReport, getReport, getCredits)

src/app/(protected)/ai/
├── page.tsx               # Complete redesign
├── _components/
│   ├── conversation.tsx   # Multi-turn clarification chat
│   ├── report-form.tsx    # Date range + prompt input
│   ├── report-progress.tsx # Progress for running reports
│   ├── report-history.tsx # Past reports with downloads
│   └── credit-tracker.tsx # X/5 credits display
```

### Schema (Turso per-user)
```sql
-- AI conversations (multi-turn clarification)
ai_conversations (
  id TEXT PRIMARY KEY,
  status TEXT,              -- 'clarifying' | 'generating' | 'complete'
  initial_prompt TEXT,
  date_range_start TIMESTAMP,
  date_range_end TIMESTAMP,
  created_at TIMESTAMP
)

ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  role TEXT,                -- 'user' | 'assistant'
  content TEXT,
  created_at TIMESTAMP
)

-- Generated reports
ai_reports (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,     -- Links to conversation that generated it
  prompt TEXT,              -- Final question after clarification
  model TEXT,               -- 'opus' | 'gpt-4.5'
  pdf_url TEXT,             -- S3 URL for download
  tokens_used INTEGER,
  created_at TIMESTAMP
)
```

### User Settings Addition
```sql
ai_credits_used INTEGER DEFAULT 0,
ai_credits_reset_at TIMESTAMP
```

## Resolved Decisions

1. **Database**: Neon (shared) + Turso (per-user)
2. **AI execution**: Trigger.dev orchestration + Daytona Python sandboxes
3. **Python sandbox**: matplotlib, pandas, scipy, plotly, statsmodels for professional charts & analysis
4. **Model flexibility**: OpenRouter for Opus/GPT-4.5/future models
5. **Interaction**: Conversational clarification → deep report
6. **Output**: PDF reports with custom Python charts, emailed + downloadable
7. **Limits**: 5 reports/month
8. **Business model**: Subscription (you pay API costs)

## Open Questions

1. **Report templates**: Suggested prompts to help users get started?
2. **Chart styling**: Custom theme for matplotlib/plotly to match Terminal design?

## Verification

- [ ] Clerk webhook creates Turso DB for new users
- [ ] Existing data migrated to Turso successfully
- [ ] AI can run SQL queries against user's Turso (read-only)
- [ ] Daytona sandbox executes Python code successfully
- [ ] Python charts render with Terminal design theme
- [ ] Conversation flow works (clarify → generate)
- [ ] Report generates as PDF with custom charts
- [ ] Code artifacts saved with reports
- [ ] Email sent with download link
- [ ] 5 reports/month limit enforced
- [ ] Credits reset monthly

## Estimate

This is the largest feature in the roadmap:

| Sub-phase | Effort |
|-----------|--------|
| 4.1 Database Migration | 2-3 weeks |
| 4.2 AI Infrastructure | 1-2 weeks |
| 4.3 Context & Tools | 1-2 weeks |
| 4.4 Daytona Python Sandbox | 1-2 weeks |
| 4.5 Conversation Flow | 1 week |
| 4.6 Report Pipeline | 2-3 weeks |
| 4.7 Frontend UI | 1-2 weeks |

**Total: 10-15 weeks**

## Roadmap Addition

Add to `ROADMAP.md` as **Phase 4: AI Analytics** after Dashboard (Phase 3):

```markdown
## Phase 4: AI Analytics (Core Differentiator)

> **Priority:** HIGHEST | **Dependencies:** Phase 3 | **Estimate:** 8-13 weeks

### Goal
Deep AI-powered analysis reports. Users ask any question, get professional-grade PDF reports with charts and case studies. 5 reports/month.

### Key Features
- Neon + Turso hybrid database (per-user isolation)
- Conversational clarification before analysis
- Long-running Trigger.dev tasks (30-60+ min)
- PDF reports with charts, emailed to user
- Opus / GPT-4.5 model selection
```
