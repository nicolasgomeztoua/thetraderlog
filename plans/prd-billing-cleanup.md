# PRD: Billing System Cleanup

## Overview
The billing system has three bugs/issues that need fixing:
1. **Beta detection is broken** — code checks Clerk entitlements (`has({ feature })`) but beta flag is stored in user **public metadata**. Beta users see paywalls.
2. **`/pricing` page doesn't exist** — all "Upgrade" buttons link to `/pricing` which 404s. The `Pricing` component exists but is only embedded as a section on the landing page.
3. **Free tier removal** — remove the free tier entirely. Users pick Starter or Pro with a 30-day trial (managed by Clerk). No more "free" plan.

## Goals
- Beta users get full Pro access (all features, unlimited AI usage)
- Upgrade buttons take users to a working `/pricing` page using Clerk's `<PricingTable>`
- Only two plans exist: Starter ($10/mo) and Pro ($24/mo), both with 30-day trial
- Clean up all free-tier references across the codebase

## User Stories

### US-001: Fix Beta Detection to Use Public Metadata
**Description**: As a beta user, I want my beta access recognized so that I'm not blocked by paywalls.

**Acceptance Criteria**:
- [ ] `isBetaAuth()` in `src/lib/billing/utils.ts` checks `publicMetadata.features.beta_access` (not `has({ feature })`)
- [ ] Client-side: `UpgradePrompt` checks `user.publicMetadata.features.beta_access` via `useUser()` hook
- [ ] Client-side: `billing-tab.tsx` beta detection uses public metadata
- [ ] Client-side: `pricing.tsx` beta detection uses public metadata
- [ ] Client-side: `usage-limit-banner.tsx` beta detection uses public metadata (if applicable)
- [ ] Server-side: `requireFeature` middleware in `trpc.ts` passes beta check using session claims/public metadata
- [ ] Server-side: `billing.ts` router `getCurrentPlan` and `getUsage` use public metadata for beta check
- [ ] Server-side: AI router beta checks use public metadata
- [ ] Remove `FEATURE_BETA_ACCESS` constant (no longer needed as entitlement slug)
- [ ] Add a shared helper like `isBetaUser(publicMetadata)` that both client and server can use
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Technical Notes**:
- Server-side: `auth()` returns `sessionClaims` which includes `publicMetadata` — access via `ctx.clerkAuth.sessionClaims?.publicMetadata`
- Client-side: use `useUser()` hook → `user.publicMetadata.features?.beta_access`
- Consider typing public metadata via Clerk's `ClerkPublicMetadata` interface in `types/globals.d.ts`

### US-002: Integration Tests for Beta Detection Fix
**Description**: As a developer, I want integration tests verifying beta users bypass all feature gates.

**Acceptance Criteria**:
- [ ] Update existing tests in `tests/integration/billing.test.ts` to use public metadata mock for beta
- [ ] Update `tests/integration/entitlements.test.ts` to use public metadata mock for beta
- [ ] Test: beta user can access Starter-gated features (trade management, CSV import, tags, strategies)
- [ ] Test: beta user can access Pro-gated features (AI chat, AI reports, PDF export)
- [ ] Test: beta user gets unlimited AI usage (no limits enforced)
- [ ] Test: non-beta user without plan gets denied
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

### US-003: Create `/pricing` Page with Clerk PricingTable
**Description**: As a user clicking "Upgrade", I want to land on a working pricing page so I can select and purchase a plan.

**Acceptance Criteria**:
- [ ] Create `src/app/(marketing)/pricing/page.tsx` route
- [ ] Page renders Clerk's `<PricingTable>` component
- [ ] Style PricingTable using Clerk's appearance API to match Terminal design system (dark theme, chartreuse accent, monospace fonts)
- [ ] Page has proper metadata (title: "Pricing | TheTraderLog")
- [ ] Page is accessible to both authenticated and unauthenticated users
- [ ] Falls back gracefully if Clerk billing is not configured
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: `/pricing` loads, shows plans, checkout works

**Technical Notes**:
- Clerk `<PricingTable>` is a drop-in component from `@clerk/nextjs`
- Use Clerk's `appearance` prop to customize colors, fonts, border radius
- Terminal design tokens: bg `#050505`, primary `#d4ff00`, secondary `#00d4ff`, font-family `monospace`

### US-004: Remove Free Tier from Constants and Billing Utils
**Description**: As a developer, I want the free tier removed from the billing constants so the system only knows about Starter and Pro.

**Acceptance Criteria**:
- [ ] Remove `PLAN_FREE` export from `src/lib/constants/billing.ts`
- [ ] Remove free tier entry from `PLAN_METADATA`
- [ ] Update `getEffectivePlan()` in `src/lib/billing/utils.ts` — return `null` or a "no_plan" sentinel instead of `PLAN_FREE` when user has no plan
- [ ] Update `hasPlanAccess()` if affected
- [ ] Add `PLAN_NONE` constant (or similar) for the "no subscription" state
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-005: Update Pricing Component — Remove Free Tier
**Description**: As a visitor viewing pricing, I want to see only Starter and Pro plans with 30-day trial badges.

**Acceptance Criteria**:
- [ ] Remove free tier card from `src/app/(marketing)/_components/pricing.tsx`
- [ ] Show only Starter ($10/mo) and Pro ($24/mo) cards
- [ ] Both plans show "30-day free trial" badge
- [ ] Update copy: remove "Start free" / "Get Started Free" language
- [ ] Update CTA buttons to route to `/pricing` (Clerk PricingTable) for checkout
- [ ] Update `PLAN_HIERARCHY` to remove `PLAN_FREE`
- [ ] Update landing page trial note copy (remove "no credit card required" if Clerk requires card for trial)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

### US-006: Update Billing Settings Tab — Remove Free Tier
**Description**: As a user on the billing settings page, I want to see only Starter and Pro in the plan comparison, with clear upgrade paths.

**Acceptance Criteria**:
- [ ] Remove free tier from "All Plans" comparison grid in `billing-tab.tsx`
- [ ] Show only Starter and Pro in comparison
- [ ] Update "Current Plan" card: if user has no plan, show "No active plan" with upgrade CTA
- [ ] Update upgrade button `href` from `/pricing` to `/pricing` (now a real page)
- [ ] Handle `PLAN_NONE` / no-plan state gracefully
- [ ] Remove `PLAN_FREE` imports
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

### US-007: Update Upgrade Prompt — Remove Free Tier References
**Description**: As a user seeing a paywall, I want the upgrade prompt to link to the working `/pricing` page.

**Acceptance Criteria**:
- [ ] `UpgradePrompt` in `src/components/billing/upgrade-prompt.tsx` links to `/pricing` (already does, but now the page exists)
- [ ] Remove any `PLAN_FREE` references if present
- [ ] Verify beta detection uses the new public metadata approach (from US-001)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-008: Update Billing Router — Remove Free Tier Fallback
**Description**: As a developer, I want the billing router to return a clear "no plan" state instead of falling back to free tier.

**Acceptance Criteria**:
- [ ] `getCurrentPlan` in `src/server/api/routers/billing.ts` returns `PLAN_NONE` (or `null`) instead of `PLAN_FREE` for users without a subscription
- [ ] Remove `PLAN_FREE` imports from billing router
- [ ] `getUsage` still works correctly for users with no plan (returns zero usage, null limits)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-009: Clean Up All Remaining Free Tier References
**Description**: As a developer, I want all free tier references removed across the codebase for consistency.

**Acceptance Criteria**:
- [ ] Search entire codebase for `PLAN_FREE`, `"free"` (plan context), `Free` (plan name) references
- [ ] Update or remove references in: error messages (`errors.ts`), usage-limit-banner, any other components
- [ ] Update `download-pdf-button.tsx` if it references free tier
- [ ] Update AI router if it references free tier
- [ ] Update `AGENTS.md` files if they reference free tier
- [ ] Remove the archived PRD `scripts/ralph/prd.billing.archive.json` free tier references if needed
- [ ] Verify no dead imports or unused constants remain
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-010: Update Integration Tests for Free Tier Removal
**Description**: As a developer, I want all tests updated to reflect the two-tier billing model.

**Acceptance Criteria**:
- [ ] Update `tests/integration/billing.test.ts`: remove free tier test cases, add "no plan" state tests
- [ ] Update `tests/integration/entitlements.test.ts`: remove free tier scenarios, verify no-plan users are denied
- [ ] Verify all test fixtures/mocks no longer reference `PLAN_FREE`
- [ ] Test: user with no plan gets denied feature access
- [ ] Test: Starter user gets Starter features
- [ ] Test: Pro user gets all features
- [ ] Test: beta user (via public metadata) gets all features
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

## Functional Requirements
1. FR-001: Beta access is determined by `publicMetadata.features.beta_access === true`, not Clerk entitlements
2. FR-002: Beta users have full Pro access — all features unlocked, unlimited AI usage
3. FR-003: `/pricing` page exists and renders Clerk's `<PricingTable>` styled to match Terminal design
4. FR-004: Only two plans exist: Starter ($10/mo) and Pro ($24/mo)
5. FR-005: Both plans offer a 30-day free trial (configured in Clerk dashboard, not in code)
6. FR-006: Users without a subscription see "No active plan" state, not "Free tier"
7. FR-007: All upgrade CTAs route to `/pricing` which is now a real page

## Non-Goals (Out of Scope)
- Migrating existing free-tier users (Clerk handles trial/plan state)
- Building custom checkout UI (using Clerk's native `<PricingTable>`)
- Changing plan pricing or features
- Adding new billing features
- Webhook handling for subscription events

## Technical Considerations

### Beta Detection Architecture
- **Public metadata** is readable on both server (via `auth().sessionClaims.metadata`) and client (via `useUser().publicMetadata`)
- Type the metadata shape: `interface ClerkPublicMetadata { features?: { beta_access?: boolean } }`
- Declare in `types/globals.d.ts` to extend Clerk's types globally
- Single shared helper: `isBetaUser(metadata: ClerkPublicMetadata): boolean`

### Clerk PricingTable
- Import: `import { PricingTable } from "@clerk/nextjs"`
- Customizable via `appearance` prop (colors, fonts, border-radius)
- Handles plan selection, checkout, and trial activation natively
- Requires plans to be configured in Clerk Dashboard

### Files to Modify
| File | Changes |
|------|---------|
| `src/lib/constants/billing.ts` | Remove `PLAN_FREE`, `FEATURE_BETA_ACCESS`; add `PLAN_NONE` |
| `src/lib/billing/utils.ts` | Update `isBetaAuth` to use public metadata; update `getEffectivePlan` |
| `src/components/billing/upgrade-prompt.tsx` | Update beta check to use `useUser()` |
| `src/app/(protected)/settings/_components/billing-tab.tsx` | Remove free tier, update beta check |
| `src/app/(marketing)/_components/pricing.tsx` | Remove free tier card, update CTAs |
| `src/app/(marketing)/pricing/page.tsx` | **NEW** — Clerk PricingTable page |
| `src/server/api/routers/billing.ts` | Update beta check, remove free fallback |
| `src/server/api/trpc.ts` | Update `requireFeature`/`requirePlan` beta check |
| `src/server/api/routers/ai.ts` | Update beta check |
| `src/components/billing/usage-limit-banner.tsx` | Update beta check |
| `tests/integration/billing.test.ts` | Update for new beta detection + no free tier |
| `tests/integration/entitlements.test.ts` | Update for new beta detection + no free tier |
| `types/globals.d.ts` | Add `ClerkPublicMetadata` type declaration |

## Design Considerations
- Terminal design system applied to Clerk PricingTable via appearance API
- Colors: Chartreuse `#d4ff00`, Ice Blue `#00d4ff`, Background `#050505`
- Monospace fonts for all interactive elements
- "No active plan" state should feel clean, not punitive — clear CTA to pick a plan

## Success Metrics
- Beta user sees zero paywalls (all features accessible)
- `/pricing` page loads and renders Clerk PricingTable
- No references to free tier remain in codebase
- All tests pass with updated billing model
- Build and typecheck pass cleanly

## Open Questions
- Does Clerk require a credit card for 30-day trials? (Configured in Clerk Dashboard, not code — verify setting)
- Should the "no plan" state allow any read-only access, or fully block the app? (Current assumption: same as old free tier — read-only dashboard/analytics access, gated features show upgrade prompt)
