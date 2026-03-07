# PRD: Clerk Billing Integration

## Overview

Add subscription billing to EdgeJournal using Clerk Billing. Three plans (Free Trial, Starter, Pro) gate access to features like trade management, AI chat, AI reports, and PDF export. Clerk handles plan management, checkout, trials, and entitlements natively. We handle AI usage counters (daily chat cap, monthly report cap), a closed beta bypass flag, custom pricing page wiring, a billing settings tab, and upgrade prompt components throughout the app.

## Goals

- Gate features by subscription plan using Clerk's `has()` on both server and client
- Track and enforce AI usage limits (50 chat messages/day, 5 reports/month)
- Provide a closed beta flag that grants Pro features to all beta users for free
- Wire the existing custom pricing page to Clerk checkout flows
- Add a "Billing" tab in settings for plan management, usage visibility, and upgrade/downgrade
- Display compelling upgrade prompts when users hit feature gates

## Plans & Features (Configured in Clerk Dashboard)

| Plan | Price | Trial | Features |
|------|-------|-------|----------|
| Free (default) | $0 | - | Read-only access to existing data |
| Starter | $10/mo | - | `trade_management`, `analytics`, `csv_import_export`, `prop_compliance`, `custom_tags`, `custom_strategies` |
| Pro | $24/mo | 30-day free trial (card required) | Everything in Starter + `ai_chat`, `ai_reports`, `pdf_export`, `priority_support` |

**Note:** Plans and features are created manually in the Clerk Dashboard. This PRD covers code-side implementation only.

**Trial behavior:** Clerk's native trial on the Pro plan. Requires card upfront, 30 days free, then auto-charges $24/mo. Clerk handles expiry emails, webhooks, and conversion.

**Beta bypass:** Users with `publicMetadata.beta === true` in Clerk get Pro-level access regardless of subscription. Flag is flipped manually when billing goes live.

## User Stories

### US-001: AI Usage Tracking Schema

**Description**: As a developer, I want a database table to track daily AI chat messages and monthly report generation so that we can enforce usage caps per plan.

**Acceptance Criteria**:
- [ ] New `aiUsage` table in `src/server/db/schema.ts` with fields:
  - `id` (text, primary key)
  - `userId` (text, FK to users, cascade delete)
  - `chatMessagesUsed` (integer, default 0) - daily counter
  - `chatMessagesDate` (date) - the day this counter applies to
  - `reportsUsed` (integer, default 0) - monthly counter
  - `reportsMonth` (integer) - month number (1-12)
  - `reportsYear` (integer) - year
  - `createdAt`, `updatedAt` timestamps
- [ ] Unique constraint on `(userId, chatMessagesDate)` for daily tracking
- [ ] Unique constraint on `(userId, reportsMonth, reportsYear)` for monthly tracking
- [ ] Relations defined to `users` table
- [ ] Schema pushed with `bun run db:push`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Technical Notes**: Two separate rows per user per period — one for daily chat tracking, one for monthly report tracking. Use upsert pattern (INSERT ON CONFLICT UPDATE) when incrementing counters. When `chatMessagesDate` doesn't match today, the counter effectively resets by creating a new row.

---

### US-002: Billing Constants & Error Messages

**Description**: As a developer, I want centralized billing constants so that plan names, feature slugs, usage limits, and error messages are defined in one place.

**Acceptance Criteria**:
- [ ] New file `src/lib/constants/billing.ts` with:
  - Plan slugs: `PLAN_FREE`, `PLAN_STARTER`, `PLAN_PRO`
  - Feature slugs matching Clerk dashboard: `FEATURE_TRADE_MANAGEMENT`, `FEATURE_ANALYTICS`, `FEATURE_CSV_IMPORT_EXPORT`, `FEATURE_PROP_COMPLIANCE`, `FEATURE_CUSTOM_TAGS`, `FEATURE_CUSTOM_STRATEGIES`, `FEATURE_AI_CHAT`, `FEATURE_AI_REPORTS`, `FEATURE_PDF_EXPORT`, `FEATURE_PRIORITY_SUPPORT`
  - Usage limits: `AI_CHAT_DAILY_LIMIT = 50`, `AI_REPORTS_MONTHLY_LIMIT = 5`
  - Plan display metadata (name, price, description) for UI use
- [ ] Billing error messages added to `src/lib/constants/errors.ts`:
  - `ERR_PLAN_REQUIRED` - generic "subscription required"
  - `ERR_FEATURE_NOT_AVAILABLE` - feature not in current plan
  - `ERR_AI_CHAT_LIMIT_REACHED` - daily chat limit exceeded
  - `ERR_AI_REPORT_LIMIT_REACHED` - monthly report limit exceeded
  - `errUpgradeRequired(feature)` - dynamic upgrade prompt
- [ ] Re-export from `src/lib/constants/index.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Billing Utility Functions

**Description**: As a developer, I want shared utility functions for checking entitlements and beta status so that plan gating logic is consistent across the app.

**Acceptance Criteria**:
- [ ] New file `src/lib/billing/utils.ts` with:
  - `isBetaUser(user)` - checks `publicMetadata.beta === true`
  - `hasFeatureAccess(auth, feature)` - wraps `auth.has({ feature })` with beta bypass
  - `hasPlanAccess(auth, plan)` - wraps `auth.has({ plan })` with beta bypass
  - `getEffectivePlan(auth, user)` - returns the user's current plan slug (or "pro" for beta users)
- [ ] Functions work with Clerk's server-side `auth()` return type
- [ ] Beta bypass: if `isBetaUser()` is true, all feature/plan checks return true
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Server-Side Entitlement Middleware

**Description**: As a developer, I want tRPC middleware that checks plan entitlements so that protected procedures automatically reject unauthorized access.

**Acceptance Criteria**:
- [ ] New middleware in `src/server/api/trpc.ts`:
  - `requireFeature(feature)` - middleware factory that checks `hasFeatureAccess()` and throws `FORBIDDEN` with `ERR_FEATURE_NOT_AVAILABLE` if denied
  - `requirePlan(plan)` - middleware factory that checks `hasPlanAccess()` and throws `FORBIDDEN` with `ERR_PLAN_REQUIRED` if denied
- [ ] Middleware reads beta flag from Clerk user metadata in context
- [ ] New procedure helpers:
  - `starterProcedure` - extends `protectedProcedure` with Starter plan check
  - `proProcedure` - extends `protectedProcedure` with Pro plan check
- [ ] Existing `protectedProcedure` unchanged (auth only, no plan check)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: Billing Router — Plan & Usage Endpoints

**Description**: As a frontend, I want API endpoints to fetch the current plan, check usage, and get billing status so that the UI can display plan info and usage meters.

**Acceptance Criteria**:
- [ ] New router `src/server/api/routers/billing.ts` with:
  - `billing.getCurrentPlan` (query) - returns effective plan slug, plan metadata, beta status, and trial info
  - `billing.getUsage` (query) - returns today's chat message count + limit, this month's report count + limit
  - `billing.incrementChatUsage` (mutation) - increments daily chat counter, returns updated count; throws if limit reached
  - `billing.incrementReportUsage` (mutation) - increments monthly report counter, returns updated count; throws if limit reached
- [ ] All procedures use `protectedProcedure`
- [ ] Usage queries use upsert pattern — create row if not exists for current day/month
- [ ] Beta users see unlimited usage (return limit as `null` or `Infinity`)
- [ ] Router registered in `src/server/api/root.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Gate AI Router with Entitlements & Usage Tracking

**Description**: As a developer, I want the AI router to enforce plan entitlements and track usage so that only Pro users (and beta users) can use AI features within their limits.

**Acceptance Criteria**:
- [ ] `ai.sendMessage` mutation:
  - Check `ai_chat` feature access before processing
  - Call `billing.incrementChatUsage` logic (or inline the upsert) before sending
  - Throw `ERR_AI_CHAT_LIMIT_REACHED` if daily limit exceeded
- [ ] `ai.startReport` mutation:
  - Check `ai_reports` feature access before processing
  - Call `billing.incrementReportUsage` logic before starting
  - Throw `ERR_AI_REPORT_LIMIT_REACHED` if monthly limit exceeded
- [ ] `ai.generatePdf` mutation:
  - Check `pdf_export` feature access before processing
- [ ] Beta users bypass all checks
- [ ] Existing AI functionality unchanged for authorized users
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Gate Trade & Data Routers with Entitlements

**Description**: As a developer, I want trade creation, CSV import/export, and other data-write operations gated by plan so that free users can't add trades after trial expiry.

**Acceptance Criteria**:
- [ ] Trade mutations (`create`, `update`, `bulkCreate`) require `trade_management` feature
- [ ] CSV import endpoint requires `csv_import_export` feature
- [ ] Tag/strategy mutations require `custom_tags` / `custom_strategies` features
- [ ] Read-only queries (list, get, analytics) remain accessible to all authenticated users (free users keep their data)
- [ ] Beta users bypass all checks
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Integration Tests — Billing Router

**Description**: As a developer, I want integration tests for the billing router so that plan and usage logic is verified.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/billing.test.ts`
- [ ] Tests `getCurrentPlan` returns correct plan info
- [ ] Tests `getUsage` returns zero counts for new users
- [ ] Tests `incrementChatUsage` increments and enforces daily limit
- [ ] Tests `incrementReportUsage` increments and enforces monthly limit
- [ ] Tests usage counter resets on new day/month (different date values)
- [ ] Tests beta user bypass returns unlimited
- [ ] Uses `setupTrader()` fixtures
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-009: Integration Tests — AI & Trade Entitlement Gates

**Description**: As a developer, I want integration tests verifying that AI and trade endpoints reject unauthorized users so that entitlement enforcement is reliable.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/entitlements.test.ts`
- [ ] Tests `ai.sendMessage` rejects users without `ai_chat` feature
- [ ] Tests `ai.startReport` rejects users without `ai_reports` feature
- [ ] Tests `ai.generatePdf` rejects users without `pdf_export` feature
- [ ] Tests trade mutations reject users without `trade_management` feature
- [ ] Tests read-only queries remain accessible without plan
- [ ] Tests beta user bypasses all gates
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-010: Pricing Page — Wire Clerk Checkout

**Description**: As a user, I want to click a plan on the pricing page and be taken to Clerk's checkout so that I can subscribe.

**Acceptance Criteria**:
- [ ] Keep existing custom pricing UI in `src/app/(marketing)/_components/pricing.tsx`
- [ ] Update CTA buttons to trigger Clerk checkout for the selected plan:
  - Unauthenticated: `<SignUpButton>` with `forceRedirectUrl` to checkout
  - Authenticated + no plan: direct link to Clerk checkout URL for the plan
  - Authenticated + has plan: "Current Plan" badge or link to settings billing tab
- [ ] Use Clerk's `useAuth()` and `has()` on client to determine current plan state
- [ ] Trial badge on Pro plan: "30-day free trial" messaging
- [ ] Plan features list matches constants from `billing.ts`
- [ ] Terminal design system maintained (chartreuse accents, monospace, dark theme)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-011: Settings Billing Tab — Plan & Usage Management

**Description**: As a subscriber, I want a Billing tab in settings where I can see my current plan, usage meters, and manage my subscription so that I have full control over my account.

**Acceptance Criteria**:
- [ ] New "Billing" tab added to settings page alongside General, Trading, Accounts, Tags
- [ ] Current plan card showing:
  - Plan name and price
  - Beta badge if applicable ("Beta Access — Pro features free")
  - Trial status if on trial ("Trial ends [date]")
  - "Manage Subscription" button (links to Clerk billing portal or triggers plan change)
- [ ] Usage meters section (Pro users only):
  - AI Chat: progress bar showing `used/50` messages today with reset time
  - AI Reports: progress bar showing `used/5` reports this month with reset date
  - Color coding: green < 50%, yellow 50-80%, red > 80%
- [ ] Plan comparison card with upgrade/downgrade CTAs
- [ ] Uses `api.billing.getCurrentPlan` and `api.billing.getUsage` queries
- [ ] Terminal design system (monospace labels, chartreuse accents, dark cards)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-012: Upgrade Prompt Components — Feature Gates UI

**Description**: As a user on a lower plan, I want to see compelling upgrade prompts when I encounter gated features so that I understand the value and can easily upgrade.

**Acceptance Criteria**:
- [ ] New component `src/components/billing/upgrade-prompt.tsx`:
  - Reusable gate component that wraps feature-gated content
  - Props: `feature` (feature slug), `children` (gated content), `planRequired` (plan slug)
  - When access denied: renders a styled upgrade card instead of children
- [ ] Upgrade card design (Terminal design system):
  - Ice blue (#00d4ff) accent border for AI features, chartreuse (#d4ff00) for core features
  - Feature icon + title ("Unlock AI Chat", "Unlock Trade Management")
  - Brief value proposition (1-2 lines)
  - CTA button linking to pricing page or triggering checkout
  - Current plan vs required plan comparison (subtle)
- [ ] Client-side gating using Clerk's `useAuth().has()` with beta bypass
- [ ] Apply upgrade prompts to:
  - AI chat page (for non-Pro users)
  - AI reports page (for non-Pro users)
  - Trade creation form (for free users)
  - CSV import button (for free users)
  - PDF export button (for non-Pro users)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-013: Usage Limit Reached Components

**Description**: As a Pro user who has hit their daily/monthly AI limit, I want to see a clear message about when my usage resets so that I know when I can use the feature again.

**Acceptance Criteria**:
- [ ] New component `src/components/billing/usage-limit-banner.tsx`:
  - Displayed inline when chat or report limit is reached
  - Shows: "Daily limit reached. Resets in X hours" or "Monthly limit reached. Resets [date]"
  - Subtle, non-intrusive design (yellow/amber accent, monospace)
- [ ] AI chat page: show banner above input when daily limit reached, disable send button
- [ ] AI reports page: show banner when monthly limit reached, disable "Generate Report" button
- [ ] Uses `api.billing.getUsage` to check limits before showing
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-014: E2E Tests — Billing UI Flows

**Description**: As a developer, I want E2E tests for the billing UI so that upgrade prompts, settings billing tab, and usage displays work correctly.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/billing.spec.ts`
- [ ] All new billing UI elements have `data-testid` attributes
- [ ] Tests settings billing tab renders with plan info
- [ ] Tests usage meters display correct values
- [ ] Tests upgrade prompt appears for gated features (mock non-Pro user)
- [ ] Tests usage limit banner appears when limits reached
- [ ] Tests pricing page CTA buttons have correct states
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Functional Requirements

1. **FR-001**: Free users (no subscription, expired trial) can view existing trades and analytics but cannot create/edit trades or use AI features
2. **FR-002**: Starter users can create trades, use analytics, import/export CSV, manage tags/strategies — but cannot use AI chat, AI reports, or PDF export
3. **FR-003**: Pro users have full access including AI chat (50 msgs/day), AI reports (5/month), and PDF export
4. **FR-004**: Beta users (`publicMetadata.beta === true`) have full Pro access with no usage limits
5. **FR-005**: AI chat usage counter resets daily at midnight UTC
6. **FR-006**: AI report usage counter resets on the 1st of each month
7. **FR-007**: Server-side entitlement checks are authoritative; client-side checks are for UX only
8. **FR-008**: Feature gates show upgrade prompts, not error pages
9. **FR-009**: Usage limit messages show reset time/date
10. **FR-010**: Trial is Clerk-native on Pro plan (30 days, card required, auto-converts)

## Non-Goals (Out of Scope)

- Setting up plans/features in Clerk Dashboard (done manually)
- Invoice history or billing receipts (Clerk handles via their portal)
- Annual billing toggle (monthly only for launch)
- Refund processing
- Tax/VAT handling
- Usage analytics dashboard for admins
- Stripe webhook handling (Clerk abstracts this)
- Custom checkout page (use Clerk's hosted checkout)

## Technical Considerations

### Database
- New `aiUsage` table with composite unique constraints for daily/monthly tracking
- Upsert pattern (INSERT ON CONFLICT UPDATE) for atomic counter increments
- No schema changes to existing tables

### Clerk Integration
- Plans and features configured in Clerk Dashboard
- `has({ feature: 'x' })` and `has({ plan: 'x' })` for entitlement checks
- `publicMetadata.beta` for beta bypass
- `useAuth().has()` for client-side checks
- `auth().has()` for server-side checks
- Clerk's hosted checkout for payment flow

### tRPC
- New `billing` router for plan/usage queries
- New `starterProcedure` and `proProcedure` convenience wrappers
- Existing routers updated to use feature-gated procedures where needed

### UI Components
- `<UpgradePrompt>` — wraps gated content with upgrade card
- `<UsageLimitBanner>` — inline limit-reached messaging
- Settings billing tab — plan card + usage meters
- All follow Terminal design system

## Design Considerations

- Upgrade prompts use ice blue (#00d4ff) for AI features, chartreuse (#d4ff00) for core features
- Usage meters: green < 50%, yellow 50-80%, red > 80% of limit
- Beta badge: subtle indicator in settings, not intrusive
- Trial messaging: "30-day free trial" on Pro plan in pricing
- Monospace (`font-mono`) for all billing labels, plan names, usage counters
- Dark cards with subtle borders matching existing settings tab style

## Success Metrics

- All feature-gated endpoints return 403 for unauthorized users
- AI usage limits enforced correctly with daily/monthly reset
- Beta users bypass all gates seamlessly
- Zero regressions in existing functionality for subscribed users
- Upgrade prompts render correctly across all gated surfaces

## Open Questions

- Clerk checkout URL format — need to verify how to construct direct checkout links per plan (may need to inspect Clerk SDK after dashboard setup)
- Clerk billing portal URL — need to confirm if Clerk provides a managed billing portal for subscription management or if we build custom
- Whether `has()` works correctly during trial period (expected: yes, trial users have plan access)
