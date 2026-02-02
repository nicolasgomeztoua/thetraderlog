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

## Architecture: Simple & Pragmatic

### Decision: Keep existing Neon DB

No need for per-user database isolation. The existing Neon PostgreSQL handles this fine:
- A very active trader has ~10k trades - trivial for Postgres
- AI tools always include `WHERE user_id = ?` (enforced in tool layer)
- Read-only database role for AI queries
- Existing tRPC endpoints already enforce user ownership

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
│  - Handles tool calls (tRPC + SQL)                          │
│  - Generates PDF report                                     │
│  - Sends email when complete                                │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Neon DB      │  │ OpenRouter   │  │ Daytona      │
│ (read-only   │  │ (Opus,       │  │ (Python)     │
│ role, user   │  │ GPT-4.5)     │  │ pandas       │
│ scoped)      │  │              │  │ matplotlib   │
└──────────────┘  └──────────────┘  └──────────────┘
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

### Why NOT per-user databases (Turso)?

We considered Turso per-user SQLite DBs but decided against it:
- **Overkill for scale** - Even 10k trades per user is trivial for Postgres
- **Operational complexity** - Schema migrations across thousands of DBs
- **Cost** - Per-database pricing adds up
- **Two ORMs** - Postgres + SQLite dialects have differences
- **Simpler solution exists** - Read-only role + WHERE clauses = same security

### AI Data Access Strategy

The AI writes its own SQL queries - that's the whole point. Canned endpoints can't answer "what if I held 5 minutes longer on my ES trades during London open?"

**Primary: Read-only SQL tool**
- AI writes custom queries for any analysis
- Dedicated read-only Postgres role (can't modify data)
- Tool layer wraps queries in user-scoped CTE:
  ```sql
  WITH user_trades AS (SELECT * FROM trades WHERE user_id = $1)
  -- AI's query uses user_trades instead of trades
  ```
- Validates queries are SELECT-only before execution
- Returns results as JSON for AI to analyze

**Schema context in system prompt**
- AI gets full schema definitions (tables, columns, types, relationships)
- Example queries for common patterns
- This lets it write accurate SQL without hallucinating column names

## Implementation Phases

### Phase 4.1: AI Infrastructure
- [ ] Add OpenRouter integration (or direct Anthropic/OpenAI)
- [ ] Create AI service (`src/lib/ai/client.ts`) with streaming
- [ ] Support model selection (Opus, GPT-4.5)
- [ ] Add `ai_reports` table to schema
- [ ] Add `ai_conversations` table for multi-turn clarification
- [ ] Add credit tracking columns to user_settings
- [ ] Monthly reset cron job for credits (Trigger.dev scheduled task)

### Phase 4.2: Context Builder & Tools
- [ ] Context builder loads user's strategies, tags, recent journals
- [ ] Create read-only Postgres role for AI queries
- [ ] Generate schema context for system prompt (tables, columns, relationships)
- [ ] Define AI tools:
  - `run_query` - execute read-only SQL with user scoping (primary tool)
  - `get_market_data` - fetch candles for price analysis (joins with trades)
- [ ] Tool execution layer:
  - Validates query is SELECT-only (no INSERT/UPDATE/DELETE/DROP)
  - Wraps query in user-scoped CTE
  - Returns results as JSON
  - Handles errors gracefully

### Phase 4.3: Daytona Python Sandbox
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

### Phase 4.4: Conversation & Clarification Flow
- [ ] Multi-turn conversation support (AI asks clarifying questions)
- [ ] User can reference specific trades ("look at trade #47")
- [ ] AI builds understanding before deep analysis
- [ ] Conversation persisted in `ai_conversations` table
- [ ] Clear transition from "clarifying" to "generating report"

### Phase 4.5: Report Generation Pipeline (Trigger.dev)
- [ ] Create `generate-ai-report` Trigger.dev task
- [ ] Long-running (30-60+ min) with progress updates
- [ ] Compile Python-generated charts into report
- [ ] PDF compilation (Puppeteer HTML→PDF or react-pdf)
- [ ] Include code artifacts as appendix
- [ ] Upload PDF to S3
- [ ] Send email via Resend with download link
- [ ] Update `ai_reports` with completed report

### Phase 4.6: Frontend UI
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

### AI System
```
src/lib/ai/
├── client.ts              # OpenRouter wrapper (streaming, model selection)
├── context-builder.ts     # Load strategies, tags, journals for AI context
├── schema-context.ts      # Generate schema definitions for system prompt
├── prompts/
│   └── trading-analyst.ts # System prompt: expert trading coach + schema
└── tools/
    ├── index.ts           # Tool definitions
    ├── run-query.ts       # Execute read-only SQL with user scoping
    ├── get-market-data.ts # Fetch candles for price analysis
    └── run-python.ts      # Execute Python in Daytona sandbox

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

### Schema Additions (existing Neon DB)
```sql
-- AI conversations (multi-turn clarification)
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'clarifying',  -- 'clarifying' | 'generating' | 'complete'
  initial_prompt TEXT NOT NULL,
  date_range_start TIMESTAMP,
  date_range_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
  role TEXT NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Generated reports
CREATE TABLE ai_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  conversation_id TEXT REFERENCES ai_conversations(id),
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,  -- 'opus' | 'gpt-4.5'
  pdf_url TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add to user_settings
ALTER TABLE user_settings ADD COLUMN ai_credits_used INTEGER DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN ai_credits_reset_at TIMESTAMP;
```

## Resolved Decisions

1. **Database**: Keep existing Neon (no Turso per-user complexity)
2. **AI data access**: AI writes custom SQL (read-only role + user-scoped CTE)
3. **AI execution**: Trigger.dev orchestration + Daytona Python sandboxes
4. **Python sandbox**: matplotlib, pandas, scipy, plotly, statsmodels
5. **Model flexibility**: OpenRouter for Opus/GPT-4.5/future models
6. **Interaction**: Conversational clarification → deep report
7. **Output**: PDF reports with custom Python charts, emailed + downloadable
8. **Limits**: 5 reports/month
9. **Business model**: Subscription (you pay API costs)

## Open Questions

1. **Report templates**: Suggested prompts to help users get started?
2. **Chart styling**: Custom theme for matplotlib/plotly to match Terminal design?
3. **Vector search**: Add pgvector later for "find similar trades"? (nice-to-have)

## Verification

- [ ] AI can write and execute custom SQL queries
- [ ] Read-only SQL queries scoped to user work correctly
- [ ] AI has accurate schema context (no hallucinated columns)
- [ ] Daytona sandbox executes Python code successfully
- [ ] Python charts render with Terminal design theme
- [ ] Conversation flow works (clarify → generate)
- [ ] Report generates as PDF with custom charts
- [ ] Code artifacts saved with reports
- [ ] Email sent with download link
- [ ] 5 reports/month limit enforced
- [ ] Credits reset monthly

## Estimate

Simplified without database migration:

| Sub-phase | Effort |
|-----------|--------|
| 4.1 AI Infrastructure | 1 week |
| 4.2 Context & Tools | 1 week |
| 4.3 Daytona Python Sandbox | 1-2 weeks |
| 4.4 Conversation Flow | 1 week |
| 4.5 Report Pipeline | 1-2 weeks |
| 4.6 Frontend UI | 1-2 weeks |

**Total: 6-9 weeks** (down from 10-15 weeks)
