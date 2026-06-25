# Prop-Firm Compliance Model — Research & Design

> Researched 2026-06-20 across 14 firms (Topstep, Apex, Take Profit Trader,
> MyFundedFutures, Tradeify, Bulenox, Elite Trader Funding, Earn2Trade, FTMO,
> FundedNext, The5ers, Funding Pips, Alpha Capital, E8) + 6 cross-firm rule
> dimensions, then adversarially fact-checked. **Prop rules change often — re-verify
> any specific number against the firm's live help center before shipping it as a
> preset.** The "Verified corrections" section lists values the fact-check caught
> wrong in the first-pass synthesis.

---

## TL;DR — three headline takeaways

1. **The entire payout-eligibility layer is missing.** This is the single biggest
   gap. Real funded accounts gate withdrawals on: a winning-day count (e.g. 5 days
   each ≥ $threshold), a buffer/safety-net floor (only profit above start+drawdown is
   withdrawable), a payout cycle timer, a cycle-windowed consistency check, escalating
   first-payout caps + a lifetime payout count, and a minimum withdrawal. We model
   none of it (only a flat `profitSplit` + `payoutFrequency` label exist), and we have
   no `account_payouts` table to hold the state these need.

2. **Two real bugs in what we already ship.**
   - **Trailing drawdown never locks.** Nearly every futures firm freezes the trailing
     floor at the starting balance (or start + $100) once the trader banks enough
     profit. Our `calculateTrailingDrawdown` / `calculateEodTrailingDrawdown` trail the
     high-water mark forever, so we *overstate* drawdown risk after the buffer is built.
   - **Consistency is mislabeled.** The schema comment says `consistencyRule` = "max
     single day profit as % of *target*", but the code computes max winning day / **total
     realized profit**. The fact-check confirmed total-profit is the correct denominator
     for the major firms (incl. Topstep Combine), so **the code is right and the label is
     wrong** — relabel, and add a type enum so the few "% of target" variants are also
     representable.

3. **`drawdownType` (trailing|static|eod) collapses 4 independent axes** and can't tell
   Apex (intraday, lock at start+$100) apart from Topstep (EOD, lock at start) — both are
   just "trailing" today.

Architectural constraint that colors everything: **all our compliance math runs on
realized P&L from closed trades only** (no live equity / open positions). Several real
rules (intraday-unrealized trailing, equity-basis daily loss, FTMO-style liquidation,
no-open-positions payout gate) can therefore only be *approximated* — they should be
tagged `approximate` / `needs-live` rather than shown as exact.

---

## A. What real props enforce in 2026 (quantitative, by category)

### A.1 Drawdown / Max Loss Limit — 4 independent axes
- **Anchor**: `static` (fixed at start − DD$, never moves; most CFD firms) vs `trailing`.
- **High-water source** (trailing only): `intraday_unrealized` (open-position peaks push
  the floor — Apex, TPT PRO, MFFU Rapid, FundedNext) vs `eod_realized` (only closing
  balances move it — Topstep, TPT Test/PRO+, MFFU Core/Pro, Tradeify, Earn2Trade, FTMO).
- **Lock**: `none` (FTMO relative — trails forever) vs `at_start` (Topstep, TPT, MFFU
  EOD, Tradeify, Earn2Trade) vs `at_start_plus_buffer` (+$100: Apex, MFFU intraday/Rapid).
- **Breach basis**: `balance_realized` vs `equity_unrealized` (intraday firms + FTMO
  liquidate on floating P&L).

Quant (futures, $ below start). **Use the corrected Apex figures from Verified
corrections below, not the first-pass numbers.**
- Topstep MLL: 50K=2,000 / 100K=3,000 / 150K=4,500; EOD-realized, lock at start.
- Apex 4.0: 25K=1,500, 50K=2,500, 100K=3,000, 150K≈4,000–5,000 (verify); lock at start+$100
  (Safety Net = start + DD + $100).
- TPT: 25K=1,500, 50K=2,000, 75K=2,500, 100K=3,000, 150K=4,500; Test/PRO+ EOD, PRO intraday;
  lock at start.
- MFFU: 4% (1,000/2,000/3,000/4,500); Rapid intraday else EOD; lock at start+$100.
- Tradeify: 4% (25K=1,000, 50K=2,000, 100K=4,000, 150K=6,000); EOD, lock at start+$100.
- FTMO (CFD): 10% max loss on equity; 1-step EOD relative (no lock) / 2-step static 90% of
  initial. FundingPips 6–10% mostly static. The5ers Futures 4% EOD trailing (does NOT lock).

### A.2 Daily Loss Limit
- **Futures trend = removed or soft pause.** TPT & MFFU: none. Topstep: removed default DLL
  on TopstepX. Apex EOD flavor pauses the day (soft, doesn't fail); intraday flavor: none.
- **CFD = hard breach on equity.** FTMO 3% (1-step) / 5% (2-step) of initial; FundingPips 3–5%.
- Our current daily-loss calc (today's realized P&L vs % of initial) is correct for the
  static-from-initial realized variant; it does **not** match FTMO equity-basis or
  from-day-start-balance variants.

### A.3 Profit target
Near-universal **6% of size** for futures evals ($3,000 on 50K). Some 5% variants. CFD:
FTMO 10% (1-step) or 10%+5% (2-step).

### A.4 Consistency (best-day concentration)
Dominant form: best winning day ≤ X% of cumulative realized profit. Axes our single field
ignores: **denominator** (% of total profit — most firms incl. Topstep — vs % of fixed
target), **window** (full eval vs since-last-payout), **phase** (eval-only vs funded-only —
Apex is funded-only 50%), **comparator** (Apex "more than 50%" i.e. exactly-50% passes; most
use ≤), **shape** (flat vs tiered ladder vs per-trade). **Enforcement is almost always soft**
— the UI should say "$X more profit needed", never "FAILED".

### A.5 Qualifying trading day & activity
Two distinct counts we conflate:
- **Min days to PASS eval** (any-trade days): Topstep 2, TPT 5, MFFU 2, Earn2Trade 10,
  Apex 0, Bulenox 0, FTMO 4/phase.
- **Winning days to QUALIFY for payout** (realized net ≥ $threshold): Topstep 5×$150;
  Apex 5× (25K $100 / 50K $200–250 / 100K $250–300); MFFU 5× (25K $100 / 50K $150 / 100K $200).
- **Inactivity timeout**: ~30 calendar days funded (FTMO, Topstep XFA, FundingPips);
  FundedNext 60 (all account types).
- **Eval time limit**: trend is unlimited (Topstep, MFFU, TPT, FTMO). **Apex is the
  exception — 30 calendar days from purchase.**

### A.6 Payout eligibility (biggest gap — no model today)
Futures stack: (1) winning-day count + threshold, (2) buffer/safety-net floor = start + DD$
(only profit above is withdrawable), (3) per-payout consistency (cycle-windowed), (4)
escalating first-payout caps + lifetime payout count (Apex max 6), (5) min withdrawal
$250–$1,000, (6) one-time activation fee, (7) split. CFD: time gate (14/21 calendar days
from first trade, then bi-weekly), no buffer, no winning-day count, "in profit + flat".
Splits: flat 80–90% futures; escalating tiers on CFD (FTMO 80→90, The5ers 50→100,
FundedNext 80→90→95).

### A.7 Position sizing / scaling / per-trade risk
Futures: hard max-contract cap by size (10:1 micro:mini), often eval > funded (Apex), plus
balance-threshold scaling (Topstep XFA, Apex/MFFU half-size until safety-net cleared). CFD:
max lots per instrument class, max risk % + mandatory stop, margin/exposure ceilings.

### A.8 Conduct / time
EOD-flat (near-universal futures; only the clock varies — Topstep 15:10 CT, Apex/TPT/Tradeify
16:59 ET). News blackouts (none Topstep/Apex; ±2 min FTMO funded/MFFU; ±5 min E8).
Weekend/overnight (CFD swing variants). Prohibited strategies (HFT <30s, hyperactivity,
copy/cross-account hedging, martingale, arbitrage) — mostly non-deterministic → checklist.

---

## B. Gap analysis

**Modeled correctly:** static drawdown; profit-target progress; daily-loss as % of initial
from realized (for the static-from-initial variant only); eval trading-days count.

**Modeled WRONG (latent bugs):**
1. Consistency label/impl mismatch (label "% of target", code "% of total" — code is the
   more-correct one; relabel + add type enum).
2. Trailing drawdown never locks at start / start+buffer (overstates risk post-buffer).
3. Intraday-unrealized trailing silently approximated from closed trades (no `dataConfidence`
   badge; can show "safe" when the firm liquidated on floating P&L).
4. `drawdownType` enum conflates 4 axes.

**Not modeled at all:** entire payout-eligibility model; qualifying-day definition;
profit-split tiers/bonus; drawdown lock+buffer+basis+high-water-source; `maxDrawdownAbsolute`
($); position/contract limits + scaling; conduct/time rules; **payout history table**
(needed for cycles, payout index, days-since-last-payout).

---

## C. Proposed data model (grouped)

All new fields nullable so existing live/demo/CFD rows are unaffected. Per-field
computability: `auto` (from realized closed trades), `info-only`, `needs-live`.

- **C.1 Drawdown:** `drawdownAnchor {static,trailing}`, `drawdownHighWaterSource
  {intraday_unrealized,eod_realized}`, `drawdownLock {none,at_start,at_start_plus_buffer}`,
  `drawdownLockBuffer $`, `drawdownBasis {balance_realized,equity_unrealized}`,
  `maxDrawdownAbsolute $`. Keep `maxDrawdown`% + `drawdownType` for back-compat (backfill).
- **C.2 Daily loss:** `dailyLossBasis`, `dailyLossAnchor {static_from_initial,
  from_day_start_balance}`, `dailyLossFailsAccount bool`, `dailyLossResetTime`+tz.
- **C.3 Eval/timeline:** `profitTargetAbsolute $`, `evalMaxDays int?` (null=unlimited),
  rename `minTradingDays`→`minTradingDaysEval`.
- **C.4 Trading-day def:** `qualifyingDayMode {any_trade,any_positive,min_profit_abs,
  min_profit_pct}`, `qualifyingDayMinProfit $`, `dayBoundaryTimezone`+`dayResetTime`,
  `inactivityLimitDays` (default 30, 0=none) + `inactivityLimitDaysEval`.
- **C.5 Consistency:** `consistencyRuleType {off,best_day_pct_of_total,
  best_day_pct_of_target,per_trade_pct_of_total,top_days_ratio,best_day_pct_of_positive_days}`
  (default existing rows → `best_day_pct_of_total`), rename value→`consistencyPct`,
  `consistencyWindow {full_evaluation,since_last_payout,fixed_cycle}`, `consistencyComparator
  {lt,lte}`, `consistencyPhase {evaluation_only,funded_only,both}`,
  `consistencyExpiresAfterPayouts int?`, `consistencyTiers jsonb`.
- **C.6 Payout (funded):** `winningDayThreshold $` + `winningDaysRequired int`,
  `payoutCycleType {winning_days,calendar_days,hours}` + `payoutCycleLength`,
  `firstPayoutWaitDays`, `bufferType {none,start_plus_drawdown}` +
  `payoutRequiresBufferCleared`, `minWithdrawal $`, `firstPayoutCaps jsonb` +
  `maxLifetimePayouts`, `payoutConsistencyPct`, `profitSplitTiers jsonb` +
  `currentProfitSplitTier` + `lifetimeBonusThreshold $`, `activationFee $`.
  **NEW TABLE `account_payouts`** {id, accountId, date, requestedAmount, paidAmount, split,
  cycleIndex} — persistent state for cycles/caps/days-since-last-payout.
- **C.7 Position/scaling:** `maxContracts` + `microToMiniRatio` (default 10), `maxLotsFx`/
  `maxLotsMetalsIndices`/`maxOpenPositions`, `maxRiskPerTradePct`+`stopLossRequired`,
  `maxMarginPct`, `scalingPlan jsonb` + `scalingBasis` + `scalingAppliesAt`.
- **C.8 Conduct/time (mostly info-only):** `sessionFlatEnabled`+`sessionFlatTime`+tz,
  `weekend/overnightHoldingAllowed`, `minHoldSeconds`+`quickStrikeProfitPct`,
  `maxTradesPerDay`, `newsBlackout*` (needs feed), `prohibitedStrategiesAck` checklist.

---

## D. Proposed compliance calculations
- `computeTrailingFloor(equityCurve, opts)` → adds the missing **lock** (`Math.min(floor,
  start[+buffer])` once profit ≥ DD$) + `dataConfidence: exact | approximate_lower_bound`.
- `checkConsistency(trades, opts)` → typed/windowed; returns `extraProfitNeeded` (the soft
  number users actually want).
- `computePayoutEligibility(funded, trades, payouts, now)` → **marquee new model**: winning
  days, buffer/withdrawable, cycle timer, windowed consistency, caps, estimated payout,
  blockers[], manualChecks[] (no-open-positions / equity-locked buffer).
- `countQualifyingDays`, `checkInactivity`, `checkEvalTimeLimit`, `checkContractLimits`,
  `checkScalingPlan`, `checkSessionFlat`, `checkQuickStrike`, `checkNewsBlackout` (gated).
- Extend `simulatePropChallenge` to apply the consistency gate + lock-at-start drawdown.

---

## E. Settings UX — presets + advanced/custom
~50 fields make raw forms unusable. Plan:
1. **Preset picker (primary path):** Firm → Product/Plan → Account size → a `PROP_PRESETS`
   registry pre-fills every field. Compact summary card + "as of" date + "verify" note.
2. **Advanced/Custom mode toggle:** grouped accordion (Drawdown, Daily Loss, Eval Target,
   Trading Days, Consistency, Payout, Position/Scaling, Conduct). Preset values stay editable.
3. **Computability badges:** `Auto` (green) / `Info only` / `Needs live data` (amber) per
   field/section — honest about the realized-only architecture.
4. **Payout panel** (funded): checklist UI (winning days X/N, buffer cleared, cycle timer,
   windowed consistency, capped estimate) with manual badges for open-positions/equity.

Presets worth shipping: Topstep Combine + Express Funded; Apex 4.0 eval + PA (EOD & Intraday);
TPT Test/PRO/PRO+; MFFU Rapid/Pro/Flex/Core/Builder; Tradeify; Bulenox; Elite; Earn2Trade;
E8; FundedNext — plus CFD (FTMO, FundingPips, The5ers, Alpha) flagged "equity-based — checks
approximate."

---

## F. Phased implementation plan
- **Phase 0 — bug fixes, NO migration (ship now):** add lock-at-start to the trailing
  drawdown calcs (derive DD$ from existing `maxDrawdown`% × balance); relabel consistency +
  document the denominator; add `dataConfidence` to drawdown results + an "approximate
  (realized-only)" badge. Highest value / lowest risk.
- **Phase 1 — drawdown axes + eval correctness (migration #1):** C.1 fields, `evalMaxDays`,
  rename min-days, C.2 daily-loss axes; ship `computeTrailingFloor`, `checkEvalTimeLimit`,
  `checkInactivity`. Backfill from `drawdownType`.
- **Phase 2 — consistency typing + qualifying days (migration #2):** C.5 + C.4; default
  rows to `best_day_pct_of_total`; ship `checkConsistency`, `countQualifyingDays`.
- **Phase 3 — PAYOUT model (migration #3, the big one):** `account_payouts` table + C.6;
  ship `computePayoutEligibility` + Payout panel. Closes the largest gap.
- **Phase 4 — presets + UX:** `PROP_PRESETS` registry, firm/plan/size picker, advanced mode,
  computability badges.
- **Phase 5 — position/scaling + conduct (migration #4):** C.7/C.8; ship `checkContractLimits`
  (uses imported trade size), `checkScalingPlan` (EOD), `checkSessionFlat`, `checkQuickStrike`.
  News blackout deferred behind a calendar integration; prohibited-strategy bans = info-only.

> Migration note: `db:push` only updates the Neon **dev** branch — prod enums/columns must be
> ALTERed separately on the prod branch.

---

## Verified corrections (fact-check caught these wrong in the first-pass synthesis)
1. **Apex drawdown amounts:** 50K = **$2,500** (not $2,000), 25K = $1,500, 100K = $3,000,
   150K ≈ $4,000–5,000 (Apex's own docs are internally inconsistent — verify). Lock at
   start + $100 confirmed.
2. **Apex consistency:** 50%, **funded/PA-only**, no 6th-payout sunset (that belongs to the
   legacy 30% rule), comparator is "more than 50%" (exactly-50% passes), resets per cycle.
3. **Topstep Combine consistency denominator = TOTAL profit**, not profit target (Best Day /
   Total Profit ≤ 50%). → confirms our existing code's denominator is the correct one.
4. **Eval time limit:** unlimited for Topstep/MFFU/TPT/FTMO, but **Apex = 30 calendar days
   from purchase** (the exception).
5. **Inactivity:** FundedNext = **60 days** for all account types (not 30 funded / 7 eval).
6. **Min eval trading days:** MFFU = **2** (not 1–2).
7. **Max contracts (50K):** MFFU max = **5** (Rapid), not 6–10; 10:1 micro:mini confirmed.

> Caveat from the fact-check: Apex's official pages were behind Cloudflare/anti-bot, so Apex
> values rest on Google-indexed excerpts + corroboration. Confirm 25K/150K Apex DD on the
> live help center before shipping those presets.

---

## ADDENDUM — Withdrawable-buffer floor, VERIFIED & FIXED 2026-06-25

Re-researched all 10 funded firms (10 web agents + adversarial verify). The original
"buffer/safety-net floor = start + DD$" (§A.6) was **wrong for most firms**, and the calc
also anchored the floor to the user-entered `initialBalance` instead of the nominal program
size — so an account logged mid-stream (initialBalance above nominal start) got an inflated
floor. Both are now fixed (migration `0019`, columns `account_size` + `safety_net_buffer`;
floor = `account_size + safety_net_buffer`, drawdown lock anchored to `account_size`).

**Verified per-firm withdrawable-floor model (funded):**
| Firm | Floor formula | Confidence |
|---|---|---|
| Apex (4.0, since 2026-03-01) | start + DD + **$100**; DDs 1,000/2,000/3,000/4,000 (legacy was 1,500/2,500/3,000/5,000) | med (official pages 403/429, 5+ corroborating) |
| MyFundedFutures | start + DD + **$100** (50K=52,100 / 100K=103,100 / 150K=154,600) | high |
| Bulenox | start + DD + **$100** ("Withdrawal Safety Threshold Reserve"; 50K=52,600) | high |
| Elite Trader Funding | start + DD + **$100** (50K=52,100 / 100K=103,100 / 150K=155,100) | high |
| Take Profit Trader | start + DD (no +$100) | high |
| Tradeify (3.0) | start + DD + **$1,000** (Growth 50K=53,000); fail-floor = start+$100 | high (Growth); Select/Lightning via formula |
| Earn2Trade | **no buffer** — floor = start | high |
| FTMO | **no buffer** — profit removed on payout, account resets | high |
| FundedNext | Rapid/Legacy/Flex = start (no buffer); **Bolt** = start+DD+$100 | high |
| Topstep XFA | **$0-anchored** — "50K" is *buying power*, balance starts at $0 | high |

`safety_net_buffer` (USD over nominal start) is now set on all funded presets per the above.

**Remaining follow-ups (not done in the 0019 pass):**
- **Topstep XFA** left unmodelled — its $0-anchored balance needs its own treatment (the
  start+buffer floor model doesn't fit). Presets carry no `safetyNetBuffer`.
- **FundedNext Bolt** still has `bufferType` unset (defaults to floor=start); should be
  start+DD+$100 — left as a flagged follow-up.
- **MFFU/ETF drawdown-amount display:** some preset `maxDrawdownAbsolute` values (MFFU
  100K/150K, ETF 150K) disagree with the verified DDs. The *buffer* is now correct
  (decoupled via `safety_net_buffer`), but the drawdown-loss display still uses these.
