# Phase 11: Payments & Billing — PRD Review

> **Status:** Implementation substantially complete. Cleanup pass needed before launch.
> **Reviewed:** 2026-03-14 by Edge (OpenClaw)

---

## TL;DR

The core billing infrastructure is built and working. What remains is a cleanup pass to remove free tier references, verify beta detection is wired end-to-end, and nail the gating UX. **This is 1–2 focused coding sessions away from launch-ready.**

---

## What's Already Done ✅

| Area | Status | Files |
|------|--------|-------|
| `aiUsage` DB table | ✅ Done | `src/server/db/schema.ts` |
| Billing constants | ✅ Done | `src/lib/constants/billing.ts` |
| Billing utils (isBeta, hasFeature, getPlan) | ✅ Done | `src/lib/billing/utils.ts` |
| Billing tRPC router | ✅ Done | `src/server/api/routers/billing.ts` |
| AI router gating + usage tracking | ✅ Done | `src/server/api/routers/ai.ts` |
| Feature-gated tRPC middleware | ✅ Done | `src/server/api/trpc.ts` |
| `/pricing` page (Clerk PricingTable) | ✅ Done | `src/app/(marketing)/pricing/` |
| Settings → Billing tab | ✅ Done | `src/app/(protected)/settings/_components/billing-tab.tsx` |
| `<UpgradePrompt>` component | ✅ Done | `src/components/billing/upgrade-prompt.tsx` |
| `<UsageLimitBanner>` component | ✅ Done | `src/components/billing/usage-limit-banner.tsx` |
| Integration tests (billing + entitlements) | ✅ Done | `tests/integration/billing.test.ts`, `entitlements.test.ts` |
| Beta detection via `publicMetadata` | ✅ Done | `isBetaFromMetadata()` in utils.ts |

---

## What Still Needs Doing ⏳

### Priority 1: Free Tier Removal (prd-billing-cleanup.md)

`PLAN_FREE` is still referenced in 5 files. The model is Starter + Pro only (both with 30-day trial). Remove these references:

| File | Action |
|------|--------|
| `src/lib/constants/billing.ts` | Remove `PLAN_FREE` export + metadata entry; add `PLAN_NONE = "none"` |
| `src/lib/billing/utils.ts` | `getEffectivePlan()` → return `PLAN_NONE` instead of `PLAN_FREE` for no-plan users |
| `src/server/api/routers/billing.ts` | Replace `PLAN_FREE` fallback with `PLAN_NONE` in `getCurrentPlan` |
| `src/app/(protected)/settings/_components/billing-tab.tsx` | Remove free tier comparison card; show "No active plan" CTA state |
| `src/app/(marketing)/_components/pricing.tsx` | Remove free tier card; both Starter + Pro show 30-day trial badges |

**Risk:** Low. Mostly constant swaps + UI cleanup. Zero DB changes.

---

### Priority 2: Verify End-to-End Feature Gating

Before launch, manually verify these paths:

| Gate | Route | Expected | Verified? |
|------|-------|----------|-----------|
| AI Chat | `/ai` | Non-Pro sees `<UpgradePrompt>` | ❓ |
| AI Reports | `/ai` | Non-Pro sees `<UpgradePrompt>` | ❓ |
| Trade creation | `/journal` → create | Non-Starter gets gated | ❓ |
| CSV import | `/import` | Non-Starter gets gated | ❓ |
| PDF export | Report viewer | Non-Pro gets gated | ❓ |
| Beta user | Any gated route | Full access, no prompts | ❓ |
| Trial user | Any gated route | Full access (same as plan) | ❓ |

**How to test:** Create Clerk test users with different plan states in the dashboard, click through the app.

---

### Priority 3: Grandfather Existing Beta Users

When billing goes live, existing users need to keep access. Two options:

1. **Manual Clerk metadata update:** For each existing user, set `publicMetadata.features.beta_access = true` via Clerk Dashboard → Users. No code required.
2. **Script via Clerk Backend API:** Write a one-off script in `scripts/` using `@clerk/backend` to bulk-update all existing users. Safer for >10 users.

**Recommendation:** Script it. Beta list = anyone who created an account before billing launch date.

```typescript
// scripts/grandfather-beta-users.ts (example)
import { createClerkClient } from "@clerk/backend";
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const users = await clerk.users.getUserList({ limit: 500 });
for (const user of users.data) {
  await clerk.users.updateUserMetadata(user.id, {
    publicMetadata: { ...user.publicMetadata, features: { beta_access: true } }
  });
}
```

---

### Priority 4: Clerk Dashboard Configuration

These are manual steps — not code. Must be done before any billing code can be tested end-to-end:

- [ ] Connect Stripe account in Clerk Dashboard
- [ ] Create **Starter** plan at $10/mo with features: `trade_management`, `csv_import_export`, `custom_tags`, `custom_strategies`
- [ ] Create **Pro** plan at $24/mo with all Starter features + `ai_chat`, `ai_reports`, `pdf_export`, `priority_support`
- [ ] Enable 30-day free trial on both plans
- [ ] Verify `has({ feature: 'ai_chat' })` returns true for Pro trial users

**Blocker:** Until Clerk Dashboard is configured, server-side `has()` calls always return false. Can work around in dev with beta metadata flag.

---

### Priority 5: Minor Code Health

Two Biome linter warnings exist in the billing files (non-null assertion in `billing.test.ts:147`, attribute sort in `settings-content.tsx`). Not blocking but clean up before PR.

---

## Implementation Order for Launch Day

```
Day 1:
1. Configure Clerk Dashboard (plans, features, trials) — 1h
2. Free tier removal (cleanup PRD US-004/006/008/009) — 1.5h
3. Update integration tests for two-tier model — 30min

Day 2:
4. End-to-end browser testing of all gate paths — 1h
5. Grandfather beta users script — 30min
6. Deploy to staging, smoke test with real Clerk test users — 1h
7. Ship to prod
```

Total: ~5.5 hours of actual work.

---

## Key Technical Decisions (Already Made)

| Decision | Rationale |
|----------|-----------|
| Clerk Billing over raw Stripe | Integrated auth + billing, `has()` works natively |
| Beta via `publicMetadata.features.beta_access` | Readable on both client and server; not a Clerk entitlement |
| Two plans (Starter + Pro), no free tier | Cleaner funnel; trial handles top-of-funnel |
| AI usage counters in DB (not Clerk) | Clerk doesn't support daily/monthly usage caps natively |
| `incrementAndCheckChatUsage()` exported from billing router | Reusable by AI router without circular deps |
| Read-only analytics always accessible | Don't lock users out of their own data |

---

## Open Questions (Resolve Before Launch)

1. **Does Clerk require card for 30-day trial?** → Check Clerk Dashboard trial settings. If yes, update pricing copy to "30-day trial, card required."
2. **Billing portal URL for "Manage Subscription"?** → Clerk provides a managed portal — verify the URL format or use `openBillingPortal()` from `useClerk()` hook (already used in `billing-tab.tsx`?).
3. **No-plan read-only access scope** → Currently: users without a plan can view dashboard/analytics but not create trades. Is this still the intended behavior, or full block?

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Clerk `has()` fails in dev (no plans configured) | High | Certain | Use beta metadata flag for dev testing |
| Beta users locked out if metadata not set | High | Medium | Run grandfather script before launch |
| Free tier removal breaks existing user UX | Medium | Low | Most users created during beta → all get beta flag |
| AI usage counter race condition | Low | Low | Upsert pattern + DB constraint handles this |
| Biome check failing blocks CI | Low | Medium | Fix 6 errors before merging billing changes |

---

## Files Not Yet Touched (Post-Cleanup Candidates)

These routes are not yet gated per the roadmap and may need upgrade prompts added post-cleanup:
- `/strategies` — should require `custom_strategies` feature
- `/daily-journal` — should require... TBD (not explicitly in Phase 11 PRD)
- `/analytics` (non-Overview tabs) — mentioned in ROADMAP.md as "gate analytics tabs"

**Recommendation:** Gate strategies + advanced analytics tabs in the same cleanup pass as free tier removal. It's the same `<UpgradePrompt>` pattern.
