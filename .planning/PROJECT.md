# Strategy Section Redesign & Marketplace

## What This Is

A comprehensive overhaul of EdgeJournal's strategy section with two major initiatives: (1) redesigning the strategy creation and editing experience to be more spacious, visually distinctive, and engaging, and (2) introducing a strategy marketplace where users can share, discover, vote on, and download trading strategies from the community.

## Core Value

Strategies should feel like first-class entities with visual identity and personality — not just database records in a form. The marketplace extends this by letting traders learn from each other's approaches.

## Requirements

### Validated

<!-- Existing strategy functionality that works today -->

- ✓ User can create a new strategy with name and description — existing
- ✓ User can define entry and exit rules for a strategy — existing
- ✓ User can set risk parameters (max risk %, position sizing) — existing
- ✓ User can view strategy performance stats (win rate, profit factor) — existing
- ✓ User can link trades to strategies — existing
- ✓ User can edit strategy details — existing
- ✓ User can delete strategies — existing
- ✓ User can view all their strategies in a list — existing

### Active

<!-- New requirements for this milestone -->

**Design Overhaul:**
- [ ] Strategy editing happens on dedicated page (`/strategies/[id]/edit`)
- [ ] Strategy has cover image (uploaded or from URL)
- [ ] Edit page has spacious layout with visual breathing room
- [ ] Strategies have distinct visual identity (cover image, colors)
- [ ] Strategy creation wizard is streamlined and engaging
- [ ] Strategy detail view shows cover image prominently

**Marketplace - Core:**
- [ ] User can mark a strategy as public or private
- [ ] Marketplace page lists all public strategies
- [ ] Marketplace shows strategy cover image, name, description preview
- [ ] Marketplace shows creator attribution (with anonymous option)
- [ ] Marketplace shows strategy performance stats

**Marketplace - Discovery:**
- [ ] User can search strategies by name/description
- [ ] User can filter strategies by instrument (ES, NQ, forex, etc.)
- [ ] User can filter strategies by category/tags
- [ ] User can sort by votes, downloads, or recency

**Marketplace - Interaction:**
- [ ] User can upvote or downvote a strategy (Reddit-style, net score)
- [ ] User can download (copy) a strategy to their account
- [ ] Download count tracked and displayed
- [ ] User can only vote once per strategy

### Out of Scope

- Real-time strategy sharing/following (no live sync) — complexity, v2
- Monetization/paid strategies — requires payments infrastructure
- Comments/discussion on strategies — social complexity, v2
- Strategy versioning/history — adds significant complexity
- Strategy templates/presets — can be added later

## Context

EdgeJournal is a professional trading journal for futures and forex traders with a Terminal-inspired dark UI design system. The current strategy section works functionally but feels basic — cramped forms, no visual identity, tedious wizard flow.

**Design Reference:** Tradezella's strategy section was mentioned as inspiration — full-page editing, cover images, more polished feel.

**Technical Foundation:**
- Strategies table exists in schema (`src/server/db/schema.ts`)
- tRPC router exists (`src/server/api/routers/strategies.ts`)
- S3 storage already configured for file uploads
- User authentication via Clerk already handles identity

## Constraints

- **Design System**: Must follow Terminal design (dark theme #050505, chartreuse accent #d4ff00, monospace)
- **Tech Stack**: Next.js 15, tRPC v11, Drizzle ORM, Tailwind v4 — no new frameworks
- **Storage**: Cover images use existing S3 infrastructure
- **Performance**: Marketplace queries must remain fast with pagination

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dedicated edit page over modal | User wants full-page experience, not cramped overlay | — Pending |
| Reddit-style voting (up/down) | Surfaces quality strategies, allows negative signals | — Pending |
| Anonymous attribution option | Lets users share without spotlight | — Pending |
| Stats included in public view | Adds credibility, helps evaluation | — Pending |
| Copy-to-account for downloads | Simple model, no ongoing sync complexity | — Pending |

---
*Last updated: 2026-01-17 after initialization*
