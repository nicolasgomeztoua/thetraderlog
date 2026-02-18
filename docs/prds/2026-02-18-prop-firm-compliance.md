# PRD: Prop Firm Compliance Dashboard

**Author:** EdgeCEO  
**Date:** 2026-02-18  
**Status:** Draft  
**Priority:** High — differentiator feature, data model already complete

---

## Problem

EdgeJournal already collects comprehensive prop firm data at account creation (max drawdown, daily loss limit, profit target, consistency rule, min trading days, challenge dates, drawdown type). But none of it is surfaced meaningfully. Traders on prop challenges have to manually track whether they're about to blow their account. That's the #1 anxiety for prop traders, and we store everything needed to solve it — we just don't.

TradeZella shows basic account stats but doesn't provide real-time compliance checking. Edgewonk doesn't handle prop firms at all. This is a gap we can own.

## Solution

Three layers of prop firm awareness, from lightweight to dedicated:

### Layer 1: Passive Integration (Dashboard + Trade Details)

**Dashboard Widget — "Prop Status"**  
A compact card on the dashboard for users with active prop_challenge or prop_funded accounts. Shows at a glance:

- **Drawdown gauge** — current drawdown % vs max allowed drawdown %, with color coding (green/yellow/red)
- **Daily P&L vs daily loss limit** — today's realized P&L compared to the daily limit
- **Profit target progress** — simple progress bar (current P&L / profit target %)
- **Trading days count** — days traded vs minimum required
- **Challenge timeline** — days remaining until challengeEndDate

Visual states:
- 🟢 **Safe** — all metrics within comfortable range (>30% buffer)
- 🟡 **Caution** — approaching any limit (10-30% buffer remaining)
- 🔴 **Danger** — within 10% of any limit

**Trade Detail Integration**  
When viewing a trade on a prop account, show a small contextual banner:
- "After this trade: 3.2% of 6% max drawdown used" (if the trade was a loss)
- "Profit target: 72% reached" (running total context)

This is lightweight — no new pages, just prop-aware annotations on existing UI.

### Layer 2: Dedicated Compliance Page (`/compliance`)

New sidebar nav item (only visible when user has ≥1 prop account). Full-page view:

**Header Section**
- Account selector (filtered to prop accounts only)
- Challenge status badge (Active / Passed / Failed)
- Phase indicator if challenge → funded link exists

**Compliance Grid (4 cards)**

| Metric | Display | Calculation |
|--------|---------|-------------|
| Max Drawdown | Gauge — current vs limit | `(initialBalance - currentBalance) / initialBalance` vs `maxDrawdown` field. For trailing: track high-water mark. |
| Daily Loss | Today's P&L vs limit | Sum of today's closed trades' `netPnl` vs `dailyLossLimit * initialBalance / 100` |
| Profit Target | Progress bar | `totalPnl / (profitTarget * initialBalance / 100) * 100` |
| Consistency Rule | Largest single-day P&L as % of target | Track max daily profit, compare to `consistencyRule` field |

**Drawdown Chart**
- Equity curve overlaid with horizontal lines at max drawdown threshold and daily loss limit
- Shaded danger zone
- This reuses the existing `buildEquityCurve` from `src/lib/analytics/risk.ts` — just adds threshold lines

**Trading Days Timeline**
- Visual calendar or bar showing days traded vs `minTradingDays`
- Days remaining until `challengeEndDate`
- Highlight which days had trading activity

**Challenge History**
- If user has completed challenges (passed/failed), show a timeline of previous attempts
- Uses `linkedAccountId` to trace challenge → funded journeys

### Layer 3: Risk of Ruin — Prop-Aware (Analytics Enhancement)

The existing Risk of Ruin calculation in `src/lib/analytics/risk.ts` already accepts a `ruinThreshold` parameter, and the analytics router already reads the account's `maxDrawdown` to pass as `ruinThreshold`. **This is already working.**

What's missing is the framing. Current RoR answers: "What's the probability I'll lose X% of my account?" For prop traders, the question is more specific: **"What's the probability I'll blow this challenge?"**

Enhancement:
- When a prop account is selected in analytics, the RoR gauge subtitle should read: "Probability of failing this challenge" instead of generic "Risk of Ruin"
- The "Based on" tooltip should explicitly say "Based on [X]% max drawdown rule" 
- Add a secondary Monte Carlo visualization: "Simulated challenge outcomes" — X% of simulations pass the challenge, Y% fail. This is way more tangible than abstract RoR.

**Implementation note:** The `calculateRiskOfRuin` function and the analytics router `getRiskMetrics` already handle the account-specific `ruinThreshold`. The enhancement is mostly UI copy + an additional Monte Carlo sim that factors in profit target + max drawdown + time limit simultaneously.

### Layer 4: AI Integration

Make prop compliance data available to the AI system for queries and reports.

**Chat context enrichment:**
- When a user asks about their prop account, the AI should have access to:
  - Current drawdown vs limit
  - Daily P&L vs daily loss limit
  - Profit target progress
  - Days remaining
  - Challenge status
- This means adding a `getPropCompliance` query to the analytics router (or accounts router) that the AI context builder can call

**Report integration:**
- AI reports for prop accounts should include a "Challenge Compliance" section
- Auto-generated insights like: "At your current win rate and average loss, you have a 2.3% probability of hitting the max drawdown before reaching the profit target"
- The AI planner (`src/lib/ai/report-pipeline/planner.ts`) already knows about `getRiskMetrics` — extend context to include prop-specific framing

**Suggested prompts:**
- Add to `src/lib/constants/ai.ts` suggested prompts: "How am I doing on my prop challenge?", "Will I pass this challenge at my current pace?"

---

## Data Model

**No schema changes needed.** Everything lives in the existing `accounts` table:
- `accountType` (prop_challenge / prop_funded)
- `maxDrawdown`, `drawdownType`, `dailyLossLimit`
- `profitTarget`, `consistencyRule`, `minTradingDays`
- `challengeStartDate`, `challengeEndDate`, `challengeStatus`
- `profitSplit`, `payoutFrequency` (funded)
- `linkedAccountId` (challenge → funded link)
- `initialBalance`, `currency`

**Computed at query time** from trades:
- Current drawdown (from equity curve)
- Daily P&L (from today's trades)
- Profit target progress (from total P&L)
- Trading days count (distinct trade dates)
- Consistency metric (max single-day profit)

---

## Technical Notes

### Existing code to reuse
- `buildEquityCurve()` — for drawdown visualization (`src/lib/analytics/risk.ts`)
- `calculateRiskOfRuin()` — already prop-aware via `ruinThreshold` param
- `accounts.getStats` — already computes totalPnl, winRate, currentBalance
- `RiskGauge` component — already shows `ruinThresholdSource: "account"` distinction
- `MonteCarloChart` component — already exists for reports

### New code needed
- `PropComplianceWidget` — dashboard compact card
- `/compliance` page + components
- `accounts.getComplianceStatus` or `analytics.getPropCompliance` — server query computing all compliance metrics in one call
- Drawdown type handling: trailing drawdown needs high-water mark tracking (compute from equity curve, not stored)
- Daily P&L aggregation (group trades by date, sum netPnl)
- Sidebar nav conditional item
- AI context extension for prop data

### Drawdown Type Logic
This is the most complex part:
- **Static**: `(initialBalance - currentBalance) / initialBalance` — straightforward
- **Trailing**: Track the high-water mark (peak balance), drawdown measured from peak. `buildEquityCurve` already tracks `peak` — adapt for balance-based (initialBalance + cumulative P&L)
- **EOD (End of Day)**: Like trailing but only updates at market close, not intraday. Since we only track closed trades (not ticks), this is effectively the same as trailing for our purposes.

---

## User Stories

1. **As a prop trader**, I want to see my challenge compliance at a glance on the dashboard, so I don't have to manually calculate drawdown limits.
2. **As a prop trader**, I want a dedicated page showing all my challenge metrics with visual progress, so I can assess my standing in detail.
3. **As a prop trader**, I want to know the probability of blowing my challenge based on my actual trading stats, so I can adjust my risk.
4. **As a prop trader**, I want to ask the AI "how am I doing on my challenge?" and get a meaningful, data-backed answer.
5. **As a trader who passed a challenge**, I want to see my journey from challenge to funded account, including compliance history.

---

## Success Metrics

- **Adoption**: >60% of users with prop accounts visit the compliance page within first week
- **Engagement**: compliance page becomes top-3 most visited page for prop users
- **Retention signal**: prop users who engage with compliance features retain better than those who don't (hypothesis to validate)

---

## Implementation Order

1. **`getComplianceStatus` query** — backend first, all the math in one endpoint
2. **Dashboard widget** — highest visibility, lowest effort
3. **Compliance page** — full dedicated experience
4. **Analytics RoR enhancement** — copy + Monte Carlo prop sim
5. **AI integration** — context enrichment + suggested prompts

---

## Out of Scope

- Real-time / websocket drawdown tracking (we compute from closed trades)
- Push notifications / email alerts when approaching limits (future feature)
- Prop firm preset databases (Nicolas explicitly rejected this — custom only)
- Intraday P&L tracking (requires live data feed, not in scope for v1)
