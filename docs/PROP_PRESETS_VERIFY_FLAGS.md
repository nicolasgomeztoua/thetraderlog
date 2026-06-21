# Prop preset verify-pass flags (advisory)

The presets-build workflow ran a second fact-check pass over the seeded preset
values. These are the entries it flagged as `wrong`/`uncertain`. They are
**advisory only** — the verifier itself was wrong on at least one (it claimed
Topstep Combine consistency is "% of profit target", but Topstep's official
formula is Best Day / Total Profit, i.e. `best_day_pct_of_total`, which is what
we ship). Treat each as a TODO to double-check against the firm's live rules
before relying on it. Presets are editable defaults in the UI.

Generated 44 flags.

## topstep-combine-100k — wrong

consistency comparator/type → best_day_pct_of_target (best day ≤ 50% of the PROFIT TARGET, not 50% of total profit). The 50% number is correct, but the rule type "best_day_pct_of_total" is mislabeled: Topstep's Combine consistency caps the single best day at 50% of the $6,000 profit target (i.e. best day must be under $3,000 on 100K), and exceeding it during the Combine raises your effective profit target rather than failing you. consistencyPhase → evaluation_only (Topstep applies the Consistency Target during the Combine, not on Express Funded accounts).

NOTE ON THE OTHER FIELDS (all correct as stated): maxDD$=3000 confirmed (trailing MLL on 100K); lock=at_start confirmed (trailing MLL ratchets up with EOD balance and locks permanently once it reaches the $100,000 starting balance); profitTarget=6% confirmed ($6,000 / $100,000); winningDays=none confirmed (no winning-days requirement during the Combine — that belongs to the funded/XFA phase, e.g. 5 winning days + $5K under the Feb 2026 dual-path); evalMaxDays=unlimited confirmed (no time limit on the Trading Combine; minimum is 2 days).

META: There is currently NO Topstep preset in src/lib/constants/prop-presets.ts — that file only contains Tradeify presets. So the id "topstep-combine-100k" does not exist in the codebase yet; these corrections apply to the values you would seed it with.

## apex-eod-pa-25k — wrong

evalMaxDays → 30 (calendar days), NOT unlimited. Every source confirms the post-March-2026 Apex evaluation has a hard 30-calendar-day window with no extensions or resets. CORRECT fields (no change): maxDD$=1000 (corroborated directly and by safety-net math: safety net $26,100 = $25,000 start + $1,000 DD + $100 buffer); lock=at_start_plus_buffer (EOD trailing stops/locks once balance hits start+DD+$100 = $26,100); profitTarget=none for the funded PA phase (eval target is $1,500, but a PA/funded account has no profit target — correct); consistency=50% best_day_pct_of_total (correct for CURRENT accounts purchased on/after 2026-03-01); winningDays=5x$100 (5 qualifying days, $100 min net profit per day on the 25K). CAVEAT to note in the preset: the 50% consistency rule applies only to accounts purchased on/after 2026-03-01; LEGACY accounts (pre-March-2026) use the older 30% rule — flag this so it is not silently applied to legacy accounts.

## apex-50k-eval-intraday — wrong

maxDD$ -> 2500 (NOT 2000): the Apex 50K Intraday eval has a $2,500 trailing drawdown; threshold starts at $47,500 and stops trailing once it reaches $53,000 (peak balance $55,000). The $2,000 value is an outlier error from one third-party blog (tradetanto); Apex's own help-center example (~25 pts on 5 NQ ~= $2,500) plus multiple sources confirm $2,500. THIS IS THE HARD NUMERIC ERROR.

lock -> LIKELY WRONG for the evaluation phase. On the eval the trailing threshold follows the peak (realized+unrealized) and only locks at $53,000 = the Profit-Target balance (start + the full $3,000 target), i.e. effectively "locks once target reached," not a small fixed buffer above start. The "Starting Balance + $100" lock that at_start_plus_buffer (with a small buffer) implies is the funded Performance Account behavior, NOT the evaluation. Recommend reviewing; the eval behaves as lock-at-profit-target-balance.

profitTarget -> 6% is CORRECT (= $3,000 on $50K).
consistency -> none is CORRECT (no consistency rule on Apex evaluations under the 4.0 model).
winningDays -> none/- is CORRECT for the eval (the 7 winning-days / 30% best-day consistency are funded-PA payout rules, not eval rules).
evalMaxDays -> 30 is CORRECT under current Apex 4.0 (since 2026-03-01 evals are a one-time fee giving 30 consecutive calendar days of access, expiring 11:59pm ET on day 30, no renewal). Caveat: legacy Apex evals had NO time limit, so 30 is only right for the current 4.0 model.

NOTE: No Apex preset currently exists in src/lib/constants/prop-presets.ts (file only contains Tradeify presets). These claimed values were fact-checked as a candidate preset, not an existing entry.

Sources: https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-explained/ · https://support.apextraderfunding.com/hc/en-us/articles/45683513113115-Intraday-Trailing-Drawdown-Explained · https://apextraderfunding.com/help-center/billing/evaluation-plan-fees-and-access-explained/ · https://livestreamtrading.com/apex-funded-trader-review/

## apex-100k-pa — wrong

evalMaxDays → 30 (NOT unlimited). As of 2026-06, after Apex's March 2026 "4.0" update, every new evaluation has a 30 calendar-day time limit with no extensions; "unlimited / no time limit" only applies to LEGACY accounts purchased before March 1, 2026. Field should be 30, not null.

All OTHER stated values are CONFIRMED correct for the current (2026) 100K EOD Performance Account:
- maxDrawdownAbsolute = 3000 — correct (100K threshold = $97,000).
- drawdownLock = at_start_plus_buffer with buffer $100 — correct: the EOD trailing threshold permanently locks once it reaches starting balance + $100 ($100,100 on a 100K). Safety net = drawdown limit + $100. (One secondary source claimed the +$100 lock is Intraday-only and cited $103,100 for EOD; this contradicts the official Apex help center and the majority of sources, so treat that source as wrong.)
- profitTarget = none on the PA — correct; the $6,000 profit target is evaluation-phase only.
- consistencyRule = 50% (best_day_pct_of_total, lte) — correct; this is the current 4.0 rule. Legacy was 30%.
- winningDaysRequired = 5, qualifyingDayMinProfit = $300 — correct; current rule is 5 qualifying days (down from 8/7 legacy) and the 100K EOD minimum qualifying-day profit is $300.

NOTE: this preset does not yet exist in src/lib/constants/prop-presets.ts — that file currently contains only Tradeify entries. The id 'apex-100k-pa' is inferred from the task, not found in code.

## apex-eval-150k-intraday — uncertain

maxDrawdownAbsolute=4000 → CONFIRMED (all 2026 sources agree the 150K drawdown is $4,000 for both intraday and EOD variants).
profitTarget=6% → CONFIRMED ($9,000 / $150,000 = 6.0%). Note: one early search snippet listing "$8,000 target / $3,000 DD" is an outlier/legacy figure not supported by any detailed 2026 source; do not use it.
consistency=none → CONFIRMED (no consistency rule in the eval phase; the 50% rule applies only to Performance/funded accounts at payout).
winningDays=none → CONFIRMED for the eval phase (no winning-day/qualifying-day requirement to pass; winning-day logic is a funded/payout concept).
evalMaxDays=30 → CONFIRMED (30 calendar days, no extensions — this is the Apex 4.0 / 2026 rule; older "no time limit" descriptions are stale).
drawdownLock=at_start_plus_buffer → FLAGGED / likely wrong for the INTRADAY eval. Sources (incl. official-page summary) state the intraday trailing threshold "continues to trail indefinitely with the Peak Balance and does not stop at a fixed level" during the evaluation. The lock-at (start + drawdown) behavior is documented for Performance/funded accounts and the EOD model, not the intraday eval. Recommend encoding the intraday eval as continuously trailing (no at-start-plus-buffer lock); reserve at_start_plus_buffer for the PA/funded or EOD preset. Could not fully confirm exact intraday-eval lock semantics from accessible pages, hence overall verdict = uncertain.
Extra note: daily loss limit for the INTRADAY variant = none (correct as "(-)"); the EOD 150K variant instead has a $2,000 fixed daily loss limit during eval.
Note: the prop-presets.ts file currently contains only Tradeify presets — no Apex preset exists yet, so this is a pre-add verification of proposed values.

## apex-150k-pa-eod — wrong

Scope note: No Apex preset currently exists in src/lib/constants/prop-presets.ts (only Tradeify presets are present), so these values are not yet in the codebase — they were fact-checked against Apex's published 4.0 rules (effective March 1, 2026).

VERIFIED CORRECT:
- maxDD$=4000 — correct for the 150K EOD account (multiple sources agree).
- lock=at_start_plus_buffer — correct; on PA accounts the EOD trailing drawdown stops permanently once the threshold reaches Starting Balance + $100 (a start+buffer lock). Make sure drawdownLockBuffer=100 is encoded (the buffer is $100, not $4000).
- profitTarget=none/- — correct; PA/funded accounts have no profit target (the $9,000 target applies only to the 150K evaluation).
- consistency=50% best_day_pct_of_total — correct for 4.0 (no single day may be ≥50% of total net profit since last payout). Note the LEGACY value was 30%; 50% is the current figure.
- winningDays=5x$350 — correct; 5 qualifying days, $350/day minimum is the 150K EOD tier specifically (do not confuse with $300, which is the 100K EOD tier).

LIKELY WRONG:
- evalMaxDays=unlimited → for the Apex 4.0 EVALUATION the time limit is 30 calendar days from purchase (no extensions/resets) per most 2026 sources, NOT unlimited. Caveat: this is a PA (funded) preset, where evalMaxDays is arguably N/A (null) since the funded account has no deadline to accumulate qualifying days. Fix: set evalMaxDays=30 if this represents the evaluation path, or null for a pure PA preset — but 'unlimited' is incorrect either way.

Sources: https://damnpropfirms.com/futures-prop-firms/apex-trader-funding/ · https://pipback.com/blogs/apex-trader-funding-2026-review/ · https://h2tfunding.com/apex-trader-funding-payout-rules/ · https://proptradingvibes.com/blog/apex-trader-funding-rules-overview

## apex-50k-pa-intraday — wrong

evalMaxDays → 30 (PRIMARY ERROR): the Apex Evaluation phase has a hard 30 CALENDAR-day limit under the 4.0/March-2026 ruleset — no extensions, no resets; "unlimited" is wrong if this field models the eval window (field name "evalMaxDays" implies it does). Caveat: a funded PA itself has NO time limit, so if this preset strictly models only the PA phase, unlimited would be acceptable. Flagging because the field name points to the eval.

drawdownLockBuffer → 100: the lock="at_start_plus_buffer" enum is correct, but the buffer must be +$100. Trailing stops permanently once the threshold reaches Starting Balance + $100 = $50,100 on a 50K PA (per Apex official help center). NOT +$2,000/$52,000 as one minority third-party source claimed.

maxDD$=2000 → CORRECT ($48,000 starting floor, $2,000 trailing drawdown).

consistency=50% (best_day_pct_of_total) → CORRECT (March 2026 / 4.0): single best day must be < 50% of total profit; comparator should be lte/lt.

winningDays=5x$200 → CORRECT for INTRADAY (5 qualifying days, $200+ net each; the EOD variant would be $250).

profitTarget=none (-%) → CORRECT for the funded PA phase (the PA itself has no profit target). NOTE: the $3,000 / 6% target is an EVALUATION-phase rule only — so if this preset is ever used to model the eval, profitTarget should be 6% / $3,000.

Sources: https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-performance-accounts-pa/ · https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-explained/ · https://apextraderfunding.com/help-center/intraday-trailing-drawdown-accounts/intraday-trailing-drawdown-payouts/ · https://proptradingvibes.com/blog/apex-trader-funding-rules-overview

## apex-25k-pa-intraday — wrong

evalMaxDays → 30 (NOT unlimited): Under Apex 4.0 (effective March 1, 2026) the evaluation has a 30-calendar-day access window from purchase. What 4.0 removed was the MINIMUM trading-days requirement, not the maximum window — so "unlimited" is wrong. Note: for a Performance Account (PA/funded) preset evalMaxDays is technically N/A, but if populated it must be 30, never unlimited.

consistencyPhase → funded_only (clarification, set this field): The 50% consistency rule is a PA/payout-only gate and does NOT apply during the evaluation. The proposed consistency=50% best_day_pct_of_total is CORRECT, but it must be scoped to funded_only (comparator lte).

drawdownLockBuffer → 100 (ensure set with lock=at_start_plus_buffer): On the PA, trailing stops permanently once the EOD threshold reaches start + $100 ($25,100 on the 25K). lock=at_start_plus_buffer is the right mechanism but requires drawdownLockBuffer: 100.

profitTarget → none is acceptable ONLY because this is the PA/funded phase (funded accounts have no target). If this preset is ever used to represent the 25K EVALUATION, the target is $1,500. Flagging the ambiguity.

CONFIRMED-but-trap (no change): maxDD$=1000 is CORRECT for current 4.0 rules (dedicated 2026 Apex 25K source: "Max trailing drawdown 1,000 USD" for both EOD and Intraday). The widely-cited $1,500 is the LEGACY/pre-4.0 number — do not "fix" 1000 to 1500.

CONFIRMED (no change): winningDays = 5 x $100 (5 qualifying days, each >= $100 net for the 25K); consistency rule type best_day_pct_of_total at 50%; lock mechanism at_start_plus_buffer.

## myfundedfutures-rapid-eval-100k — wrong

maxDrawdownAbsolute (maxDD$): claimed 4000 is WRONG → correct value is 3000. The official MyFundedFutures help center "Rapid Plan 100K – A Comprehensive Look" states the evaluation Maximum Loss Limit (EOD) is $3,000, not $4,000. The $4,000 / "4% intraday trailing" figure comes only from third-party blogs (proptradingvibes) that conflate Rapid with a generic 4% rule; even the pickmytrade FAQ that calls it "4%" still quotes the dollar amount as $3,000 (which is 3%, exposing the blogs' inconsistency). Use $3,000. As %, maxDrawdown = 3 (not 4).

drawdownLock / drawdown TYPE for the EVAL phase (claimed lock=at_start_plus_buffer): MISLEADING for an evaluation preset. During the EVALUATION, the $3,000 drawdown is END-OF-DAY (EOD), effectively static — it does NOT trail intraday and does not "lock at start + buffer." The intraday-trailing-then-lock behavior only exists in the Sim Funded stage, where Max Loss trails the equity high-water mark at a $3,000 distance and then LOCKS once it reaches a $100 minimum account balance (i.e. locks at +$100, NOT at "start + buffer" of the full $3,000). For an eval preset set drawdownAnchor="static"/drawdownType="eod" with no trailing/lock. If you instead intend a funded preset, the lock buffer is $100 (drawdownLockBuffer: 100), not "start_plus_drawdown".

profitTarget: CONFIRMED correct = 6% ($6,000).

consistency: CONFIRMED correct = 50%, best_day_pct_of_total, evaluation-only (no consistency rule once funded).

winningDays (eval): CONFIRMED correct = none/blank. Winning-days requirements are a funded payout rule (5 winning days), not part of the eval.

evalMaxDays: CONFIRMED correct = unlimited (no time limit; only a 2-day MINIMUM trading-days requirement exists, which the claim did not list — minTradingDays should be 2).

## myfundedfutures-rapid-funded-100k — wrong

maxDrawdownAbsolute (maxDD$) → 3000, NOT 4000. Official MyFundedFutures help center ("Rapid Plan 100k — A Comprehensive Look") and the official /plans/rapid page both state $3,000 intraday trailing max drawdown for the Rapid 100K. The 4000 figure only appears in a secondary blog (proptradingvibes) derived from a generic "4% intraday trailing" rule of thumb, and that source explicitly flags its $100K numbers as UNVERIFIED. Use 3000.

drawdownLock (lock=at_start_plus_buffer) → CORRECT. Trailing DD locks once the trailing max loss reaches $100 above the starting balance (start + $100 buffer) and then stops trailing. drawdownLockBuffer should be 100.

winningDaysRequired / winningDayThreshold (winningDays=5x$200) → WRONG, remove entirely. Rapid has NO winning-days requirement. Payout eligibility is buffer/threshold based: account must reach ~start+$100 plus the minimum withdrawal (~$3,100 realized profit), min withdrawal $500, daily payout cadence. There is no 5-day winning cycle and no $200/day winning-day threshold (that 5x$200 pattern is Tradeify's, not MFFU Rapid). Set winningDaysRequired/winningDayThreshold to undefined; use payoutCycleType=threshold-style with minWithdrawal=500.

consistency (consistency=none%) → CORRECT ONLY IF this is the FUNDED preset. Official rule: consistency is 50% during EVALUATION ONLY; none in funded. If this preset is the funded phase, consistency=none is right. If it represents evaluation, it must be consistencyRule=50, consistencyComparator=lte, consistencyPhase=evaluation_only.

profitTarget (profitTarget=-%, omitted) → context-dependent. Correct (omit) for the FUNDED phase. But if this preset is the evaluation phase, the Rapid 100K target is $6,000 (6%) — profitTargetAbsolute=6000, profitTarget=6. Confirm phase; eval target is well documented.

evalMaxDays (unlimited) → CORRECT. No maximum time limit; only a 2-day minimum trading-day requirement (minTradingDays=2).

Also note: profitSplit=90, dailyLossLimit=none (no daily loss limit on Rapid), minTradingDays=2.

## myfundedfutures-rapid-funded-50k — wrong

profitTarget: $3,000 (6% of $50K) — a profit target DOES exist; the claimed "-%" (none) is wrong. The Rapid 50K requires a $3,000 profit target across at least 2 trading days during evaluation.

winningDays: WRONG / fabricated. The claimed "5x$150" (5 winning days at $150 minimum) does not exist for MFFU Rapid. Rapid has NO winning-days payout requirement and NO per-day minimum-profit threshold. Payouts are daily (every 24h) and are gated ONLY by building a $2,100 realized-profit buffer before the first payout (first payout available 24h after the first trade once buffer + $500 minimum are met). Correct values: winningDaysRequired = none/0, winningDayThreshold = none, payoutCycleType = daily/buffer (not winning_days), firstPayoutBuffer = $2,100, minWithdrawal = $500, profitSplit = 90.

consistency (eval): The claim "none" is only correct for the funded stage. There IS a 50% consistency rule in the EVALUATION stage (eval-only). Funded stage = none. So consistencyRule should be 50% with consistencyPhase = evaluation_only, not blank/none across the board.

minTradingDays: should be 2 (eval requires hitting the target across at least 2 trading days) — not stated in the claim.

CONFIRMED correct: maxDD$ = 2000 (trailing max loss limit); lock = at_start_plus_buffer with a $100 buffer (trailing drawdown locks at start balance + $100); evalMaxDays = unlimited (Rapid has no evaluation time limit). Daily loss limit = none (correctly absent). Note: the $2,100 payout buffer is distinct from the $100 drawdown-lock buffer — do not conflate them.

## myfundedfutures-rapid-eval-150k — wrong

maxDrawdownAbsolute (maxDD$) → 4500 (NOT 6000). The MyFundedFutures Rapid 150K evaluation max loss is $4,500 = 4% of $150K, per the official help-center "Rapid Plan 150k" article. $6,000 appears to be a cross-contamination from the Core 100K profit target. | profitTarget → CONFIRMED 6% ($9,000). | consistency → CONFIRMED 50%, best_day_pct_of_total, evaluation-only (no consistency rule once Sim Funded). | drawdownLock → CONFIRMED equivalent to at_start_plus_buffer with $100 buffer: the trailing max loss freezes once its distance to the high-water mark shrinks to $100 (e.g. $50K peaking at $52,000 locks floor at $52,100); this is the same modeling the existing Tradeify presets use (drawdownLock: "at_start_plus_buffer", drawdownLockBuffer: 100). The drawdown anchor is intraday/tick-by-tick trailing (equity high-water), not EOD — if a preset is built, drawdownAnchor should be "trailing" with intraday basis, though the eval-stage label in MFFU docs reads "Maximum Loss Limit (EOD)". | winningDays → CONFIRMED none in evaluation (winning-days requirement applies only to funded-stage payout cadence, every 5 winning days). | evalMaxDays → CONFIRMED unlimited (no time limit). | ALSO NOTE (omitted from prompt): minTradingDays = 2 for the Rapid evaluation; no daily loss limit.

## myfundedfutures-rapid-funded-150k — wrong

maxDD$ -> 4500 (not 6000; the 150K Rapid trailing/max-loss distance is $4,500, locking at +$100 above start). winningDays -> none (Rapid has NO winning-days requirement and NO per-day minimum profit; the claimed "5 winning days x $300" does not exist for Rapid). Payout eligibility on Rapid 150K is instead gated by a buffer of $4,600 in realized profit above starting balance, then daily payouts (every 24h), $500 minimum withdrawal, 90/10 split. Recommend removing winningDaysRequired/winningDayThreshold and encoding the $4,600 payout buffer + minWithdrawal=500 + profitSplit=90 instead. CORRECT as claimed: lock=at_start_plus_buffer (locks at start+$100, drawdownLockBuffer=100); profitTarget=none for the funded phase ($9,000/6% target is evaluation-only); consistency=none (the 50% consistency rule is evaluation-only); evalMaxDays=unlimited (no time limit on the Rapid eval).

Sources: https://help.myfundedfutures.com/en/articles/13286582-rapid-plan-150k-a-comprehensive-look · https://myfundedfutures.com/plans/rapid · https://help.myfundedfutures.com/en/articles/13134718-understanding-rapid-live · https://proptradingvibes.com/blog/myfundedfutures-payout-rules

## myfundedfutures-core-funded-50k — wrong

consistency -> NOT firm-confirmed at 40%. MFFU's official help center states the consistency rule is 50% and applies to the EVALUATION ONLY; it is explicitly removed on the Core funded/payout stage. The "40% funded" figure appears only in some third-party guides, not in MFFU docs. For a Funded preset use NO consistency rule (omit consistencyRule); if it must represent eval, use consistencyRule=50, consistencyPhase=evaluation_only. | winningDays $150 -> 5 winning days is correct, but the $150 winningDayThreshold is the documented Flex 50K figure; MFFU does not publish a per-winning-day minimum for Core, so $150 is unverified for Core (drop winningDayThreshold or mark approximate). | maxDD$=2000 -> confirmed by the firm's own pages, but note it equals 4% of 50K, not 3%; several review sites mislabel Core DD as $1,500/3%. | lock=at_start_plus_buffer -> confirmed; lock buffer is $100 (floor freezes at $50,000/start once EOD balance reaches $52,100 = start + 2000 DD + 100), so drawdownLockBuffer should be 100. One review wrongly claims the MLL never locks. | profitTarget='-' -> flagged: Core 50K has a $3,000 (6%) target. Omitting it is valid only for a pure funded-phase preset; if the preset spans eval, set profitTargetAbsolute=3000 / profitTarget=6. | evalMaxDays=unlimited -> confirmed (no time cap; minimum active days only). | NOTE: no MyFundedFutures preset currently exists in src/lib/constants/prop-presets.ts (only Tradeify presets present); the id was inferred.

Sources: https://myfundedfutures.com/blog/myfundedfutures-mffu-core-plan · https://help.myfundedfutures.com/en/articles/11994562-consistency-rule-at-myfunded-futures-core-scale-and-pro-plans · https://help.myfundedfutures.com/en/articles/8528339-understanding-evaluation-parameters-at-mffu · https://tradecovex.com/guides/myfundedfutures-rules-2026

## myfundedfutures-pro-eval-100k — wrong

maxDrawdownAbsolute (maxDD$) → 3000 (not 4000): the 100K Pro uses a $3,000 EOD trailing max-loss line = 3% of $100K; after the first payout the MLL locks at $100,100 (start + $100). All other claimed fields are correct: lock=at_start_plus_buffer with $100 buffer ✓; profitTarget=6% / $6,000 ✓; consistency=50% best_day_pct_of_total, evaluation-only (no single day's profit > 50% of total eval profit; note the one-day-pass variant has NO consistency rule) ✓; evalMaxDays=unlimited ✓; winningDays placeholder correctly empty (no winning-days requirement in eval). Minor: minTradingDays should be 2, not 1.

Sources: https://myfundedfutures.com/plans/pro · https://help.myfundedfutures.com/en/articles/11802674-pro-plan-sim-funded-and-live-account-highlights · https://help.myfundedfutures.com/en/articles/11994562-consistency-rule-at-myfunded-futures-core-scale-and-pro-plans

## myfundedfutures-pro-eval-50k — uncertain

Most values are correct, but two fields are flag-worthy.

VERIFIED CORRECT:
- maxDrawdownAbsolute = 2000 -> confirmed ($2,000 Max Loss EOD for 50K Pro).
- profitTarget = 6% -> confirmed ($3,000 / $50,000 = 6%; profitTargetAbsolute should be 3000).
- consistencyRule = 50%, type best_day_pct_of_total -> confirmed (no single day > 50% of total eval profit; evaluation_only phase; does not breach, just requires more days).
- evalMaxDays = unlimited (null) -> confirmed (no time limit on Pro eval).

FLAGGED / NEEDS CORRECTION:
- lock = at_start_plus_buffer: PARTIALLY WRONG for the EVALUATION phase. Pro uses EOD trailing DD that trails the closing balance and stops trailing once the account reaches starting balance + max DD (the $2,000 line freezes at the $50,000 start, i.e. once equity hits ~$52,000). The permanent lock at "start + $100" buffer happens ONLY AFTER the first approved payout (a FUNDED-phase event), not during eval. So if this eval preset pairs at_start_plus_buffer with drawdownLockBuffer = 100, that buffer is wrong for eval -> in eval the line freezes at the starting balance (effective buffer = 0, drawdownLockBuffer should be 0, not 100). drawdownHighWaterSource should be eod_realized / drawdownAnchor = trailing, drawdownType = eod -- those are consistent with EOD trailing. Recommend: drawdownLock = at_start_plus_buffer with drawdownLockBuffer = 0 for the eval preset (the +$100 belongs on the FUNDED preset, post-first-payout).
- winningDays = "-x$-" is a placeholder, not a real value. The Pro EVALUATION has NO winning-day requirement and NO winning-day dollar threshold. The only activity requirement is a MINIMUM of 2 TRADING days (minTradingDays = 2). winningDayThreshold / winningDaysRequired should be OMITTED (undefined) on the eval preset.

Also note: Pro plan has NO daily loss limit in eval or funded (dailyLossLimit should be omitted). Note that this preset id does not yet exist in src/lib/constants/prop-presets.ts (only Tradeify presets are present); these fields were supplied in the task prompt, not the file.

## myfundedfutures-pro-eval-150k — wrong

maxDD$ → 4500 (not 6000; the 150K Pro EOD trailing max drawdown is $4,500. $6,000 is actually the 100K account's profit target, not the 150K drawdown). All other claimed fields are CONFIRMED: lock=at_start_plus_buffer (MLL locks permanently at starting balance + $100 after first payout) → correct; profitTarget=6% ($9,000 on $150K) → correct; consistency=50% measured as best_day_pct_of_total (best single day cannot exceed 50% of total eval profit, eval-only) → correct; winningDays=none in evaluation → correct; evalMaxDays=unlimited (only a minimum of 2 trading days, no maximum deadline) → correct. Note: there is no MyFundedFutures preset in src/lib/constants/prop-presets.ts — the file currently only contains Tradeify presets — so these values were fact-checked as claims, not against an existing entry.

## myfundedfutures-pro-funded-50k — wrong

winningDaysRequired/winningDayThreshold → none. The "5 winning days x $150" rule does NOT apply to the MFFU Pro plan; that is the Flex plan rule ($150/day on the 50K Flex). The Pro plan has NO winning-days payout trigger — payouts run on a 14-calendar-day cycle from the first funded trade, gated only by clearing a $2,100 profit buffer (50K) with a $1,000 minimum withdrawal. Set winningDaysRequired and winningDayThreshold to undefined, and instead model payoutCycleType=calendar_days with payoutCycleLength=14 and a payout buffer of $2,100.

CONFIRMED fields (no change): maxDrawdownAbsolute=2000 ($2,000 EOD trailing max loss limit — note $2,100 is the separate payout buffer, not the drawdown); profitTarget=none in funded ($3,000 is eval-only); consistency=none in funded (the 50% consistency rule is evaluation-only); evalMaxDays=unlimited (no max duration).

drawdownLock note (minor): the firm locks the MLL at starting balance + $100 ($50,100) after the FIRST APPROVED PAYOUT, not at account start. "at_start_plus_buffer" is a reasonable enum, but the lock TRIGGER is first-payout, and the locked level is start+$100 (i.e. buffer=100), not start+drawdown. Verify drawdownLockBuffer=100 and that the lock is gated on first payout.

NOTE: this preset (id myfundedfutures-pro-funded-50k) does not yet exist in src/lib/constants/prop-presets.ts — that file currently contains only Tradeify presets. These corrections apply to the values as specified for when the MFFU preset is added.

## myfundedfutures-pro-funded-150k — wrong

maxDD$ -> 4500 (Pro plan is 3% EOD trailing; 3% of 150,000 = $4,500, NOT $6,000). winningDays -> none (the Pro plan funded stage has NO winning-days payout model; payouts are a profit-buffer + 14-calendar-day-cycle model: $4,600 profit buffer for 150K, $1,000 minimum withdrawal, requests every 14 calendar days from first trade. The "5 winning days" model with a per-day minimum belongs to the Flex plan, and even there the threshold is $150/day, not $300. The "20 winning days at 4% (=$6,000/day)" figure only relates to unlocking the live-allocation initial balance, not to regular payouts). CONFIRMED correct: lock=at_start_plus_buffer (trailing locks permanently once EOD balance reaches starting balance + $100, i.e. $150,100); profitTarget=- (no funded-stage profit target; the eval target is $9,000 / 6%); consistency=none (50% consistency applies in evaluation only, none in funded stage); evalMaxDays=unlimited (no maximum days, minimum 2 trading days). NOTE: no MyFundedFutures preset currently exists in src/lib/constants/prop-presets.ts (it only contains Tradeify presets), so these values were fact-checked from the task prompt against official sources, not against a stored preset.

## myfundedfutures-pro-funded-100k — wrong

maxDrawdownAbsolute: 3000 (NOT 4000) — the 100K Pro EOD trailing maximum loss limit is $3,000, confirmed by the official plan page and help center. | winningDaysRequired / winningDayThreshold: REMOVE (NOT 5 x $200) — the Pro plan has NO winning-days payout requirement; it uses a time-based cycle: a payout can be requested every 14 calendar days from first trade, after clearing the ~$3,100 payout buffer. The "5 winning days at $X" model belongs to the Flex plan ($100/$150 per day), not Pro, so both the count (5) and the threshold ($200) are inapplicable. Suggested replacement payout fields: payoutCycleType=calendar_days, payoutCycleLength=14, minWithdrawal=1000, profitSplit=80. | CONFIRMED (no change): drawdownLock=at_start_plus_buffer with $100 buffer (MLL locks to $100,100 / start+$100 after first payout and stops trailing); profitTarget=none in the funded phase (the $6,000 target is evaluation-only); consistency=none in funded (the 50% rule is eval-only); evalMaxDays=unlimited (no time limit, ~2 minimum trading days). NOTE: no MyFundedFutures preset currently exists in src/lib/constants/prop-presets.ts — this is a fact-check of the proposed values only.

Sources: https://myfundedfutures.com/plans/pro · https://help.myfundedfutures.com/en/articles/11802674-pro-plan-sim-funded-and-live-account-highlights · https://help.myfundedfutures.com/en/articles/8348565-max-eod-trailing · https://help.myfundedfutures.com/en/articles/13745661-payout-policy-overview-best-and-fastest-prop-firm-payouts

## bulenox-eval-150k (proposed; NOT YET in codebase — no Bulenox preset exists in src/lib/constants/prop-presets.ts, only Tradeify) — wrong

Most numbers check out, but two fields are wrong/incomplete for a "150K Option 2, EOD" evaluation preset:

CONFIRMED correct:
- maxDrawdownAbsolute (maxDD$) = 4500 — correct ($4,500 EOD drawdown, same for Option 1 and Option 2).
- profitTarget = 6% (= $9,000) — correct.
- consistency = none during evaluation — correct (Bulenox's 40% best-day rule applies only to Master/funded payouts, NOT during qualification).
- winningDays / winning-day threshold = none in eval — correct (winning-days is a funded-payout concept; eval has no such requirement).
- evalMaxDays = unlimited (null) — correct (no time limit on the qualification phase).

WRONG / NEEDS CORRECTION:
- drawdownLock: "at_start_plus_buffer" is WRONG for the EVALUATION preset. Per the official Bulenox qualification page, the EOD trailing drawdown keeps trailing for the entire qualification phase and does NOT lock during the eval. The lock at "initial balance + $100" only applies on the Master (funded) account. Correct value for this eval preset → drawdownLock = "never" (and drop drawdownLockBuffer, or set to 0). Note: a funded Bulenox preset WOULD use at_start_plus_buffer with drawdownLockBuffer = 100.

MISSING (incomplete) — the defining feature of Option 2:
- dailyLossLimit is absent. Option 2's whole distinction from Option 1 is its daily loss limit. For 150K Option 2 it is $3,300 (= 2.2% of 150,000). Add dailyLossLimit ≈ 2.2 (dailyLossLimitAbsolute = 3300), dailyLossAnchor = "from_day_start_balance", dailyLossFailsAccount = false (hitting it suspends the account for the rest of that day, it is not a hard fail). Without this, the preset is indistinguishable from Option 1.

Also worth setting: drawdownAnchor = "trailing", drawdownHighWaterSource = "eod_realized", drawdownType = "eod", profitTargetAbsolute = 9000, minTradingDays = 0/1 (no minimum trading days in qualification).

## elite-trader-funding-static-eval-50k — wrong

profitTarget: $4,000 absolute (8% of 50K) — supplied value was a placeholder "-%". | drawdownAnchor/lock: this is a STATIC (non-trailing) drawdown — the floor is fixed at $48,000 from day one ($2,000 below the $50,000 start) and never moves with profit. The supplied lock=at_start_plus_buffer is a trailing-drawdown concept and is the wrong model. Use drawdownAnchor="static" (drawdownType="static"), drawdownLockBuffer=0; there is no separate lock event because a static floor is already fixed at start. | minTradingDays: 5 (required to pass; missing from the supplied set). | maxDrawdown$ = 2000: CORRECT. | consistency = none in eval: CORRECT (the 23% consistency rule applies only in the funded/Elite phase, not during the evaluation). | winningDays: N/A for the evaluation phase — winning-day/payout rules belong to the funded phase, so this field does not apply to an eval preset (supplied "-" is acceptable as not-applicable). | evalMaxDays = unlimited: CORRECT (no time limit). | Note: maxContracts for 50K static = 4 minis / 40 micros; daily loss limit = none (correctly implied).

## elite-1step-funded-100k — wrong

consistency → The 23% figure is misclassified. It is NOT a "best_day_pct_of_positive_days" consistency rule. Per ETF's official 1-Step help page, 23% is part of the Active Trading Day (ATD) qualifying threshold: a day counts as an ATD only if its realized profit is >= 23% of your BEST ATD's P&L AND >= $200. So it is a qualifying-day minimum-as-percent-of-best-day rule (comparator >=, gating which days count toward the 8 ATDs), not a "best day must be <= X% of total/positive days" consistency rule. ETF's real consistency rule is the separate 40% rule (best day <= 40% of total accumulated profit), and that rule does NOT apply to 1-Step accounts (and is grandfathered off for accounts activated on/after 2024-08-01). Recommended model: consistencyRuleType=none (1-Step has no consistency rule); encode 23% via qualifyingDayMode (each ATD >= 23% of best day) + qualifyingDayMinProfit=200.

profitTarget → minor/informational: 100K 1-Step eval target is $6,000 (6%); preset leaves it as "-%". Acceptable for a funded-phase preset but note the underlying eval target is $6,000.

maxDD$=3000 → CORRECT (100K 1-Step: $100,000 start, $3,000 trailing max DD).
lock=at_start_plus_buffer → CORRECT (DD stops trailing at start + maxDD + $100; buffer=$100).
winningDays=8x$200 → CORRECT (8 ATDs for first payout cycle; $200 min realized/ATD for 100K 1-Step; $100 exception applies only to 10K/25K 1-Step, 25K EOD, 100K Static).
evalMaxDays=unlimited → CORRECT (no time limit on 1-Step).

NOTE: no preset with this id exists in src/lib/constants/prop-presets.ts — that file currently contains only Tradeify presets, so no Elite Trader Funding entry is present to carry these values.

## elite-trader-funding-1step-funded-150k — wrong

consistency semantics → the 23% is NOT "best_day_pct_of_positive_days". Per Elite's official 1-Step help page, 23% defines an Active Trading Day (ATD): a day counts toward payout only if it earns at least 23% of the best trading day's profit (a per-day floor vs. best day, comparator gte). It is a qualifying-day threshold, not a "best day as % of positive days" consistency cap. Model it as a percent-of-best-day qualifying-day floor (qualifyingDayMode), not consistencyRuleType=best_day_pct_of_positive_days. | All numeric values are correct as stated: maxDD$=5000 (correct), drawdownLock=at_start_plus_buffer with $100 buffer (correct — DD locks permanently at start+$100 once realized profit = maxDD+$100), profitTarget=none/- for funded phase (correct), winningDays=8 ATDs x $200 min realized/day for first payout cycle (correct; note cycles 2+ require 10 ATDs), evalMaxDays=unlimited (correct). | META: no Elite Trader Funding preset currently exists in src/lib/constants/prop-presets.ts — that file contains only Tradeify presets. The id is inferred from the firm/plan/size naming convention.

## elitetraderfunding-1step-funded-50k — wrong

Most values check out, but the consistency field is mislabeled — flag and fix.

CONFIRMED:
- maxDD$ = 2000 (50K 1-Step, $48,000 floor) — correct.
- lock = at_start_plus_buffer — correct; trailing DD stops permanently once realized profit reaches maxDD + $100 (floor locks at $50,100, buffer = 100).
- profitTarget = omitted (-) — correct for the FUNDED phase (no profit target once funded; the $3,000 target is evaluation-only).
- winningDays = 8 × $200 — correct for the FIRST payout cycle (8 Active Trading Days, each ≥ $200 realized). Note: subsequent cycles require 10 ATDs (not modeled by this single value, acceptable for cycle-1 preset).
- evalMaxDays = unlimited — correct (no time limit; monthly renewal until passed).

WRONG (the headline flag):
- consistency = 23% with consistencyRuleType "best_day_pct_of_positive_days" → INCORRECT. ETF's "23% rule" is NOT a best-day consistency cap. It is a per-Active-Trading-Day FLOOR: each ATD must earn ≥ 23% of your BEST day's P&L (AND ≥ $200) to count. That is a qualifying-day condition, not a consistency cap, and the direction (floor on each day vs. cap on top day) and denominator ("best day," not "summed positive days") are both wrong.

CORRECTIONS:
- consistencyRuleType → "off" (current 2026 accounts have no best-day-cap consistency rule; ETF replaced the traditional consistency rule with the ATD system. The 40%-of-total best-day cap still in ETF's terms applies ONLY to accounts purchased before Aug 1, 2024, so it does not bind a 2026 account.)
- consistencyRule → remove/none (was 23).
- Model the 23% rule on the qualifying-day axis instead: winning day = max($200, 23% of best ATD). i.e. qualifyingDayMode = min_profit_abs with qualifyingDayMinProfit = 200, plus a per-day "≥23% of best day" floor (winningDayThreshold = 200; the 23%-of-best-day floor is the ATD qualifier, not consistency).
- (Optional, if a best-day cap field is desired for legacy coverage only: best_day_pct_of_total at 40%, funded_only — but it should NOT be enabled for 2026 accounts.)

## elite-eod-funded-100k — wrong

profitTarget: WRONG — not "-%/none". The Elite Trader Funding 100K EOD evaluation has a $6,000 profit target. Set profitTargetAbsolute=6000 (profitTarget≈6%).

consistencyRuleType/consistencyRule: WRONG — EOD accounts have NO traditional consistency rule. The 23% figure is the ATD (Active Trading Day) qualifying threshold, not a consistency rule, and the label "best_day_pct_of_positive_days" is the wrong calculation. The real rule: a day counts as an ATD only if realized profit >= MAX($200, 23% x your single best profitable day so far in the cycle) — i.e. 23% of the single best day (a ratcheting payout-qualification threshold), NOT a percent of positive days. This belongs in the qualifying-day/ATD logic (qualifyingDayMode + the $200 floor + 23%-of-best-day), not consistencyRuleType=best_day_pct_of_positive_days.

winningDays=8x$200: PARTIALLY CORRECT — Cycle 1 = 8 ATDs at $200 min realized profit/day is right for the standard 100K EOD ($100 floor only applies to Static Elite). But cycles 2-4 require 10 ATDs; if the preset hardcodes 8 it only captures the first payout cycle.

maxDrawdownAbsolute=3500: CONFIRMED (EOD trailing $3,500).
drawdownLock=at_start_plus_buffer: CONFIRMED — trails until realized profit = maxDD + $100 ($3,600), then locks permanently at start + $100 buffer.
evalMaxDays=unlimited: CONFIRMED (no time limit).

MISSING field: the 100K EOD also carries a $2,200 daily loss limit, which the preset omits.

## elite-trader-funding-eod-50k — wrong

consistency (WRONG): The "23% (best_day_pct_of_positive_days)" value conflates two distinct rules. (a) The 23% figure is NOT a consistency rule; it is the ACTIVE-TRADING-DAY (ATD) qualifier — a day only counts as an ATD if it earns >= 23% of your BEST ATD's P&L AND >= $200 realized profit. It is a FLOOR (>=), not a ceiling, so modeling it as a consistency cap with an lte comparator is inverted/incorrect. (b) The actual consistency rule on the sim-funded path is best-day-as-%-of-TOTAL-profit = 40% for accounts purchased/activated before 2024-08-01, NOT applied to accounts on/after 2024-08-01 (newer 1-Step/Fast-Track variants ~30%). The proposed type "best_day_pct_of_positive_days" is also wrong — ETF measures best day as a % of total profit, not of positive days.

profitTarget="-" (none): Only correct if this is truly the FUNDED phase. The 50K EOD EVALUATION product carries a $3,000 (6%) profit target. A "50K EOD" is fundamentally an evaluation account, so verify the phase — "none" may be an error.

dailyLossLimit (MISSING FIELD): The 50K EOD has a $1,100 daily loss limit (intraday losses count; removed permanently once safety net = drawdown + $100 is reached). Should be captured.

CONFIRMED CORRECT: maxDD$=2000 (EOD trailing; 50K safety net $52,100 = start + $2,000 + $100); lock=at_start_plus_buffer with $100 buffer; winningDays = 8 ATDs x $200 min (Payout Cycle 1; note subsequent cycles require 10 ATDs); evalMaxDays=unlimited (no time limit on EOD evals).

Note: No ETF preset currently exists in src/lib/constants/prop-presets.ts (only Tradeify); id above follows the file's naming convention.

Sources: https://elitetraderfunding.app/help/how-the-revamped-eod-plan-works · https://www.quantvps.com/blog/elite-trader-funding-payout-rules-explained-how-trader-payouts-work · https://pipback.com/firms/elite-trader-funding/ · https://elitetraderfunding.app/blog/no-consistency-rule-prop-firms-what-atd-means

## elite-trader-funding-static-funded-50k — wrong

profitTarget: WRONG — should NOT be empty. The 50K Static eval has a $4,000 profit target (8% of $50K). Set profitTargetAbsolute=4000, profitTarget=8.

drawdownLock (lock=at_start_plus_buffer): WRONG/misleading for a Static account. A Static drawdown is FIXED from day one and never trails — official help: "The minimum allowed balance is static—it does not trail or move with unrealized profit." There is no start+buffer+$100 trailing lock. Use drawdownAnchor=static (drawdownType=static), with no trailing-buffer lock. NOTE: the $2,000+$100=$2,100 figure that appears in sources is the SAFETY-NET / payout-eligibility threshold (realized profit >= drawdown + $100), NOT a drawdown lock point — it belongs in the payout-buffer field, not the drawdown lock.

consistency=23% (best_day_pct_of_positive_days): MISLABELED. The 23% is the Active Trading Day qualifier (a day counts toward payout only if its realized profit >= 23% of your single best trading day AND >= $200) — it is NOT a "best day as % of total profits" consistency cap. The real ETF consistency cap (best day <= X% of total profits) is 40% on legacy accounts, and current sources report Static accounts have NO traditional consistency rule. Move 23% into the qualifying-day/ATD logic (with the $200 floor) and either set consistency=40% (legacy) or drop the consistency rule for Static. The best_day_pct_of_positive_days comparator does not match ETF's definition (it is % of your single best day, evaluated per-day to qualify that day).

maxDD$=2000: CORRECT (confirmed, $48,000 minimum balance).

winningDays=8x$200: CORRECT for first payout (8 Active Trading Days, each >=$200 realized AND >=23% of best day). Note subsequent payouts require 10 ATDs.

evalMaxDays=unlimited: CORRECT (no time limit — "take as many days as you need"). Minimum is 5 trading days to pass eval.

Sources: https://help.elitetraderfunding.com/help/how-the-static-account-plan-works · https://elitetraderfunding.com/static/ · https://www.quantvps.com/blog/elite-trader-funding-payout-rules-explained-how-trader-payouts-work · https://pipback.com/firms/elite-trader-funding/

## elite-trader-funding-150k-funded-eod — wrong

consistency -> WRONG. EOD accounts have NO consistency rule. The 23% is not a best-day-concentration cap; it is the Active Trading Day (ATD) credit threshold = MAX($200, 23% x highest profitable day so far) that decides whether a day counts toward the 8 winning days. It should be set consistencyRuleType=off, and the 23% modeled as a qualifying-day relative gate alongside qualifyingDayMinProfit=200, NOT consistencyRuleType=best_day_pct_of_positive_days (that enum means best day <= X% of summed positive days -- wrong direction and wrong denominator). | maxDD$ -> 4500 (CORRECT, no change; 3% EOD trailing). | lock -> at_start_plus_buffer, $100 buffer (CORRECT; DD locks permanently at start+$100 once realized profit = DD+$100). | profitTarget -> none for funded phase (CORRECT; the $9,000 target applies to the EOD evaluation only). | winningDays -> 8x$200 (CORRECT for the FIRST payout cycle; note cycles 2-4 require 10 ATDs, which a single winningDaysRequired field cannot express). | evalMaxDays -> unlimited (CORRECT; only Fast Track has a 10-day limit).

Sources: https://elitetraderfunding.app/blog/no-consistency-rule-prop-firms-what-atd-means · https://elitetraderfunding.app/blog/end-of-day-drawdown-prop-firms-how-eod-accounts-work-2026 · https://pipback.com/blogs/elite-trader-funding-review/ · https://propfirmapp.com/prop-firms/elite-trader-funding

## ftmo-2step-challenge-100k — uncertain

All listed numbers are CORRECT for the FTMO Challenge 2-Step, Phase 1, 100K (the "Phase 1 + 10% target" framing = the 2-Step product). Verified against ftmo.com/comparison-table and /trading-objectives (2026-06): maxDD$=10000 (10% of $100k) correct; lock=undefined correct (2-Step max loss is STATIC, NOT trailing — only the 1-Step trails); profitTarget=10% correct; consistency=none correct (Best Day/consistency rule applies only to the 1-Step, NOT the 2-Step); winningDays=none correct; evalMaxDays=unlimited correct (FTMO removed time limits). Verdict is "uncertain" only because TWO real Phase 1 objectives are MISSING from the preset and should be added: (1) maxDailyLoss → 5% ($5,000/day, recalculated 00:00 CE(S)T) — absent here; (2) minTradingDays → 4 — absent here. Also flag: maxDrawdownAbsolute=10000 should be marked approximate=true because FTMO's max loss is equity-based (includes floating P&L + commissions/swaps) while this app is realized-P&L-only, so the $ value is right but the check under-approximates. IMPORTANT caveat: if the intended product is actually the 1-Step Challenge, then lock and consistency are WRONG — the 1-Step uses lock=end-of-day-trailing (can only increase) and consistency=50% Best Day Rule, with maxDailyLoss=3% ($3,000). The 10% Phase-1 target wording matches the 2-Step, so I treated it as the 2-Step. Note: no FTMO preset currently exists in src/lib/constants/prop-presets.ts — only Tradeify presets are defined; id above follows the file's naming convention.

## ftmo-50k-funded — wrong

Note: no FTMO preset exists in src/lib/constants/prop-presets.ts yet (only Tradeify is present); these are proposed/checked values, not an existing entry. Verified against ftmo.com as of 2026-06.

maxDD$ (maxDrawdownAbsolute) = 5000 — CONFIRMED. Maximum Loss is $5,000 = 10% of a $50K account on both 1-step and 2-step funded accounts. (maxDrawdown % = 10.)

lock = undefined — WRONG for the default 1-Step funded account. FTMO's 1-Step (and 1-Step funded) Maximum Loss is an END-OF-DAY TRAILING drawdown that only rises with new EOD balance highs and never decreases; it does NOT lock at a +10% threshold — it trails for the life of the account. So drawdownAnchor should be 'trailing' with drawdownHighWaterSource 'eod' and drawdownLock = none/never (no lock), NOT a static/undefined drawdown. (The 2-Step funded account, by contrast, uses a STATIC 10% max loss.) Recommend modeling the 1-step funded variant: trailing EOD, no lock.

profitTarget = none/undefined — CONFIRMED. No profit target on the funded FTMO Account.

consistency = none% — CONFIRMED as a percentage consistency rule (none). CAVEAT: the 1-Step funded account carries a separate 'Best Day Rule' (a best-trading-day constraint, introduced with the 2026 1-step format); it is not a % consistency rule but should be flagged.

winningDays = none — CONFIRMED. No minimum winning-days requirement. Payout eligibility = min 14 calendar days from first trade + account in profit + no open positions.

evalMaxDays = unlimited — CONFIRMED (funded phase has no time limit). Field is mislabeled for a funded preset (funded has no 'eval'); intent (no time limit) is correct.

Also worth setting: dailyLossLimit % — 1-step funded = 3% ($1,500); 2-step funded = 5% ($2,500). profitSplit = 90% (1-step from first withdrawal); 2-step = 80% base, 90% on Scaling Plan. firstPayoutWaitDays = 14.</corrections>
</invoke>


## fundednext-rapid-eval-100k — wrong

lock → NOT "at_start". The FundedNext 100K Rapid uses a trailing end-of-day (EOD) max loss limit that trails UPWARD with profit and locks only when the MLL reaches the initial account balance ($100,000); trailing range is $97,500 → $100,000. Correct value should be the trailing-locks-at-initial-balance setting (e.g. drawdownAnchor=trailing, drawdownHighWaterSource=eod, drawdownLock=at_initial_balance / "locks at start balance"), not lock=at_start.

CONFIRMED (no change): maxDD$=2500 ($2,500 max loss limit for 100K Rapid); profitTarget=5% ($5,000 on $100K); consistency=none (no consistency rule during the challenge/eval phase — the 40% rule applies only on the funded account); winningDays=none/N-A for eval (winning-days is a funded payout-eligibility concept, not an eval rule); evalMaxDays=unlimited (no time limit).

ALSO NOTE: no FundedNext preset exists in src/lib/constants/prop-presets.ts — the file currently contains only Tradeify presets, so this id (fundednext-rapid-eval-100k) is not yet defined in code; values were fact-checked as a proposed preset.

## fundednext-bolt-funded-50k — wrong

lock → at_start_plus_buffer with a $100 buffer (drawdownLock: "at_start_plus_buffer", drawdownLockBuffer: 100). The trailing EOD Maximum Loss Limit stops trailing and permanently locks at $50,100 on the 50K account = starting balance + $100, NOT at the bare starting balance. The claimed lock=at_start is the single wrong number.

Confirmed fields (no correction needed): maxDD$=2000 (Maximum Loss Limit $2,000 = 4%, end-of-day trailing); profitTarget=blank/none for the FUNDED phase (the $3,000 / ~6% target is challenge-only); consistency=none in funded (40% applies in the challenge phase only); winningDays=0 / no minimum daily profit (Bolt uses a buffer-based payout, no winning-day or benchmark-day requirement); evalMaxDays=unlimited (no calendar time limit on the eval).

Note also: daily loss limit is $1,000 (soft breach) — not part of the claimed fields but relevant if the preset is built. Funded payouts are closed-end (max 5 lifetime, first 4 capped at $1,200, eligibility once EOD balance ≥ $52,100 with ≥$250 cycle profit), 80% profit split.

Meta: This preset DOES NOT EXIST in src/lib/constants/prop-presets.ts — that file currently holds only Tradeify presets. If/when the FundedNext Bolt funded preset is added, encode the lock as at_start_plus_buffer / buffer=100, not at_start.

## fundednext-bolt-eval-50k — wrong

drawdownLock → at_start_plus_buffer (NOT at_start). The Bolt Maximum Loss Limit is a trailing EOD drawdown that locks at initial balance + $100 = $50,100, not at the starting balance. Official help center explicitly says it "will stop trailing once it reaches $50,100" and contrasts this with Legacy accounts which lock at exactly the initial balance. Set drawdownLockBuffer = 100.

All other provided fields are CORRECT:
- maxDrawdownAbsolute = 2000 (confirmed; threshold starts at $48,000, i.e. $50,000 - $2,000).
- profitTarget = 6% (confirmed; $3,000 on a $50K account = 6%).
- consistency = 40% best_day_pct_of_total (confirmed; daily profit cannot exceed 40% of the $3,000 profit target = $1,200/day; eval phase only).
- winningDays = none (confirmed; no winning-day requirement in the eval phase).
- evalMaxDays = unlimited (confirmed; official page states "No time limit").

Notes / additions not in the provided fields (real ruleset, worth including in the preset): drawdownAnchor = trailing, drawdownType = eod, drawdownHighWaterSource = eod_realized, drawdownBasis = balance_realized. There is also a $1,000 daily loss limit (soft breach / trading pause for the rest of the day, equity at/below $49,000) that was omitted from the provided fields.

## fundednext-legacy-eval-25k — wrong

consistency comparator/basis: the proposed "consistency=40% (best_day_pct_of_total)" should be best_day_pct_of_target, NOT best_day_pct_of_total. FundedNext's official rule is "daily profit cannot exceed 40% of the total PROFIT TARGET" (40% x $1,250 = $500/day cap on the 25K) = best-day-vs-profit-TARGET. In this codebase best_day_pct_of_total = "best day % of total profit ACHIEVED" (a different calc) while best_day_pct_of_target = "best day % of profit target", which is what FundedNext actually documents. The 40% number itself is correct; only the comparator enum is wrong.

ALL OTHER PROPOSED VALUES CONFIRMED CORRECT: maxDD$=1000 -> confirmed ($1,000 max loss on 25K Legacy). lock=at_start -> confirmed; EOD trailing drawdown "trails upward only until the threshold equals the starting balance, then locks and stops trailing" ($24,000 -> $25,000). Note FundedNext locks at the starting balance with NO +buffer, so plain at_start is correct (unlike Tradeify's at_start_plus_buffer +$100). profitTarget=5% -> confirmed ($1,250 = 5% of $25,000). consistency=40% value -> confirmed (challenge/eval phase only; FundedNext removed the 40% rule on Legacy FUNDED accounts in 2026 but it still applies during the challenge). winningDays unset (-x$-) -> correct for eval; winning-days is a funded-account payout concept, not an evaluation rule. evalMaxDays=unlimited -> confirmed ("No time limit").

Additional setup notes (not corrections): no daily loss limit on Legacy (omit dailyLossLimit); no documented minimum trading days; drawdownHighWaterSource = eod (highest recorded end-of-day balance, updated at start of each trading day); consistencyPhase = evaluation_only.

Sources: https://helpfutures.fundednext.com/en/articles/14282421-is-there-any-consistency-rule-in-the-fundednext-futures-legacy-challenge-and-fundednext-account · https://helpfutures.fundednext.com/en/articles/14282332-what-is-the-profit-target-in-the-fundednext-futures-legacy-challenge · https://fundednext.com/futures-challenge-terms · https://fundednext.com/futures/legacy

## fundednext-legacy-funded-25k — wrong

lock → NOT "at_start". FundedNext Legacy uses a trailing end-of-day (EOD) max-loss-limit that moves UP with the highest EOD balance and never down, then LOCKS at the initial account balance once profit reaches the drawdown amount (i.e. lock = at_start_plus_buffer, with buffer = the drawdown $1,000; anchor = trailing, high-water source = eod_realized). "at_start" would imply a static drawdown locked from day one, which is incorrect. Per FundedNext MLL page: "Moves up when the account balance increases until it goes to the initial balance, but never moves down" and "Since the MLL has reached the initial balance... it locks here and will not increase any further." | maxDD$=1000 → confirmed correct ($1,000 = 4% on 25K). | profitTarget (none, funded phase) → confirmed correct; the $1,250/5% target applies only to the challenge phase, not the funded account. | consistency=none → confirmed correct on funded; the 40% consistency rule applies during the Legacy challenge but is removed once funded. | winningDays=5x$100 → confirmed correct ("Minimum 5 Benchmark Days before the first withdrawal"; "Benchmark profits: $100 (25K)"). | evalMaxDays=unlimited → confirmed correct (no max time limit, no min trading days; only a 7-consecutive-day inactivity deactivation). NOTE: no FundedNext preset currently exists in src/lib/constants/prop-presets.ts (only Tradeify presets are present); these values appear to be a proposed preset.

## fundednext-legacy-eval-50k — wrong

consistency basis → WRONG: should be `best_day_pct_of_target` (40% of the PROFIT TARGET, i.e. $1,200 on the $3,000 target), NOT `best_day_pct_of_total`. FundedNext's official rule is "no single day's profit may exceed 40% of the profit target." The 40% number itself is correct; only the comparator/type is mislabeled. The codebase enum already has the right value: CONSISTENCY_RULE_TYPE.BEST_DAY_PCT_OF_TARGET ("best_day_pct_of_target").

ALL OTHER FIELDS CONFIRMED CORRECT:
- maxDD$ = 2000 → CORRECT (tightened from $2,500 to $2,000 in Jan 2026; = 4% of $50K; trailing EOD max loss).
- lock = at_start → CORRECT (trailing EOD MLL trails up only until it reaches the INITIAL account balance, then locks permanently; no buffer, so at_start is right).
- profitTarget = 6% → CORRECT ($3,000 on $50K = 6%; raised from $2,500/5% in March 2026, so 6% is current as-of 2026-06).
- winningDays = none → CORRECT (no winning-days requirement in the Legacy eval).
- evalMaxDays = unlimited → CORRECT (Legacy Challenge has no time limit).

ADDITIONAL note (field omitted from the preset, but a real eval rule worth adding): minTradingDays = 3 (Legacy eval requires a minimum of 3 trading days to pass). Also worth setting consistencyPhase = evaluation_only since FundedNext removed the 40% consistency rule on Legacy FUNDED accounts in 2026 (it applies during the challenge only), and dailyLossLimit = none (no daily loss limit on Legacy).

## fundednext-legacy-100k-eval — wrong

Most values check out, but the drawdown model is mischaracterized — flag it.

CONFIRMED:
- maxDD$ = 3000: correct. Official Futures help center: 100K Legacy Maximum Loss Limit (MLL) is $3,000 (floor at $97,000).
- profitTarget = 6% ($6,000): correct per official help center (25K=$1,250, 50K=$3,000, 100K=$6,000). 2:1 target:DD.
- consistency = 40% (best_day_pct_of_total): correct — "daily/single-day profit cannot exceed 40% of total profit." IMPORTANT: applies in EVALUATION ONLY; FundedNext removed the consistency rule on funded Legacy accounts in 2026. So consistencyPhase should be evaluation_only.
- winningDays = none: correct — no winning-days requirement in the eval phase.
- evalMaxDays = unlimited: correct — no time limit on the challenge.

WRONG / NEEDS CORRECTION:
- lock = at_start → MISLEADING. The Legacy MLL is a TRAILING end-of-day drawdown, not a static-from-start one. It trails up with EOD balance and only LOCKS once profit grows enough that the trailing threshold reaches the initial/starting balance (i.e., account up ~$3,000); thereafter it stays fixed at the starting balance. So:
    drawdownAnchor = "trailing" (NOT static)
    drawdownHighWaterSource = "eod_realized" / EOD-balance trailing
    drawdownLock = "at_start" is acceptable ONLY in the sense of "locks AT the starting-balance level" with drawdownLockBuffer = 0 — but it must be paired with a trailing anchor. As written ("lock=at_start" with no trailing anchor) it reads like a static at-start DD, which is incorrect. Encode it as trailing + lock-at-starting-balance, buffer 0.

ADDITIONAL NOTES:
- FundedNext Legacy is a FUTURES product (not CFD/forex) — set category=futures. Lineup is Bolt, Rapid, Legacy; Legacy is the only one feeding the Live/funded program. Express/Evaluation CFD models were discontinued for new clients (Mar 2025); do not conflate "Legacy" with a CFD "Eval."
- Session/EOD flat close ~3:10 PM CT applies to all FundedNext Futures accounts.

## fundednext-flex-eval-50k — wrong

lock → at_start_plus_buffer (buffer = $100). FundedNext's Flex 50K trailing max drawdown locks once the account reaches $50,100 (start + $100), not at the $50,000 start balance, so "at_start" is incorrect; it should be drawdownLock="at_start_plus_buffer" with drawdownLockBuffer=100 (matching the codebase's existing Tradeify pattern). All other fields confirmed correct: maxDD$=1500 ($1,500 max loss limit), profitTarget=5% ($2,500 for the 50K), consistency=40% best_day_pct_of_total (daily profit must not exceed 40% of the total profit target; Challenge phase only — does not apply on the funded account), winningDays=none required to pass the eval (the 5 benchmark/winning days only apply to the funded "FundedNext Account" for payout eligibility), evalMaxDays=unlimited (no time limit). Note: this preset does not currently exist in src/lib/constants/prop-presets.ts — the file only contains Tradeify presets.

Sources: https://helpfutures.fundednext.com/en/articles/14878751-what-is-fundednext-futures-flex-challenge · https://helpfutures.fundednext.com/en/articles/14878840-what-is-the-profit-target-in-the-fundednext-futures-flex-challenge · https://helpfutures.fundednext.com/en/articles/14878830-how-do-i-pass-fundednext-futures-flex-challenge · https://helpfutures.fundednext.com/en/articles/14878851-is-there-any-consistency-rule-in-the-fundednext-futures-flex-challenge-and-fundednext-account

## fundednext-flex-funded-50k — wrong

lock → at_start_plus_buffer (drawdownLockBuffer 100). The FundedNext Flex 50K trailing EOD max-loss does NOT lock at_start; per the official help center it "locks and stops trailing once the account hits $50,100 for the 50K Account" — i.e. start ($50,000) + $100 buffer. Use drawdownLock "at_start_plus_buffer" with drawdownLockBuffer 100 (same pattern as the Tradeify presets in this file). All other claimed fields are correct: maxDD$=1500 (confirmed, EOD trailing), profitTarget=none in funded (the $2,500 target is eval/Challenge-phase only), consistency=none in funded (40% rule applies to the Challenge Phase only), winningDays=5x$200 (5 benchmark/winning days of $200 each; $500 min total profit before first withdrawal), evalMaxDays=unlimited (no stated time limit). Note: this preset does not yet exist in src/lib/constants/prop-presets.ts — that file currently contains only Tradeify presets, so these values are being fact-checked pre-insertion.

Sources: https://helpfutures.fundednext.com/en/articles/14878751-what-is-fundednext-futures-flex-challenge · https://helpfutures.fundednext.com/en/articles/14878865-what-are-the-performance-reward-eligibility-criteria-for-flex-fundednext-account · https://helpfutures.fundednext.com/en/articles/14878830-how-do-i-pass-fundednext-futures-flex-challenge · https://fundednext.com/futures/flex

## fundednext-flex-funded-100k — wrong

lock: WRONG — should be "at_start_plus_buffer" with drawdownLockBuffer=100, NOT "at_start". FundedNext's EOD trailing MLL on the 100K Flex locks/stops trailing at $100,100 = initial balance ($100,000) + $100, not at the bare starting balance. (This matches the at_start_plus_buffer / buffer=100 convention the Tradeify presets in the same file already use.)

All other fields CONFIRMED:
- maxDD$=2500 — correct ($2,500 max loss limit on 100K).
- profitTarget=none — correct; the $5,000 target is challenge-phase only, the funded "FundedNext Account" has no profit target.
- consistency=none — correct; the 40% consistency rule applies in the Flex Challenge (eval) only, not in the funded account.
- winningDays=5x$200 — correct; 5 benchmark days, each requiring ≥$200 profit on the 100K, before a payout. (minWithdrawal is $250 and payout cap is $2,500/cycle, 80% split or 90% with add-on, max 5 payouts then concludes — not in the asked fields but worth noting.)
- evalMaxDays=unlimited — correct; FundedNext Futures imposes no time limit / no max days.

META (out of scope of the field values but critical): NO FundedNext preset exists in src/lib/constants/prop-presets.ts on this branch — the file contains only the TRADEIFY array (PROP_PRESETS = [...TRADEIFY]). The id "fundednext-flex-funded-100k" is inferred from the firm/plan/size naming convention; the preset has not yet been added.

## fundednext-flex-funded-150k — wrong

lock → "at_start_plus_buffer" with drawdownLockBuffer=100 (NOT "at_start"). FundedNext Futures Flex uses an EOD TRAILING max-loss-limit that trails upward with end-of-day balance and only locks once it reaches the initial balance + $100 buffer (i.e. $150,100 for the 150K). It is not static-at-start from day one. Anchor should be drawdownAnchor="trailing", drawdownHighWaterSource="eod_realized". All other proposed fields are correct: maxDD$=4000 ✓ (MLL for 150K); profitTarget=none ✓ (the $8,000 target is challenge-only, funded account has no target); consistency=none ✓ (40% rule is challenge-phase only, not applied on funded account); winningDays=5×$250 ✓ (5 benchmark days, $250 min profit/day on the 150K; note 50K/100K use $200); evalMaxDays=unlimited ✓ (no max trading days). Caveat: "Flex" is a FUTURES product (launched May 2026), not the CFD "Stellar Lite" — make sure category="futures". Also note this preset does not yet exist in src/lib/constants/prop-presets.ts (only Tradeify presets are present there).

## fundednext-flex-eval-100k — wrong

Two fields are wrong; three are correct; one nuance.

CORRECT:
- maxDD$ = 2500 (confirmed: $2,500 max loss limit for 100K Flex).
- profitTarget = 5% ($5,000 for 100K) — confirmed.
- evalMaxDays = unlimited (null) — confirmed "No time limit" on the Flex page.

WRONG:
1. lock: "at_start" -> "at_start_plus_buffer" with buffer $100. FundedNext's EOD trailing MLL locks at starting balance + $100 (i.e. $100,100 for 100K), not exactly at the starting balance. Multiple sources including the FundedNext Futures help center and the Flex landing/review pages state it locks at $50,100 / $100,100 / $150,100. (Note: the generic /general-rules/futures/trading-objectives page loosely says "locks once it reaches the initial balance," but the Flex-specific docs consistently say +$100 — go with +$100.) Recommend drawdownLock="at_start_plus_buffer", drawdownLockBuffer=100.

2. consistency rule type: "best_day_pct_of_total" -> "best_day_pct_of_target". The 40% value is correct, but FundedNext defines it as "a trader's profit on any single day must not exceed 40% of the total PROFIT TARGET" (40% x profit target = daily threshold; exceeding it raises the required target). That is best-day-as-%-of-target, not best-day-as-%-of-total-profit. Use consistencyRuleType="best_day_pct_of_target", consistencyRule=40, consistencyComparator="lte", consistencyPhase="evaluation_only" (no consistency rule once funded).

NUANCE (winningDays): Leaving winningDaysRequired unset for the eval is acceptable — there is no official winning-days payout requirement in the evaluation. The "5 benchmark days" / winning-days concept applies to the FUNDED account payout stage, not the eval. Some third-party reviews mention "minimum 2 profitable days" to pass, but FundedNext's own objectives pages do not list a minimum-trading-days requirement for Flex (only a 10-calendar-day inactivity rule). Safe to leave winningDays/minTradingDays unset, optionally add inactivityLimitDays=10.

Also note this firm is futures/EOD-realized and a true single-phase eval; daily loss limit should remain omitted (Flex has "no daily loss limit").

## fundednext-flex-eval-150k — wrong

lock -> at_start_plus_buffer with drawdownLockBuffer:100 (official help center: trailing DD locks at $150,100 = start + $100 buffer; 'at_start' is wrong). consistencyRuleType -> best_day_pct_of_target (FundedNext caps single-day profit at 40% of the PROFIT TARGET, not 40% of total profit; the 40% value is correct but best_day_pct_of_total is the wrong rule type — codebase already has best_day_pct_of_target). maxDD$=4000 -> correct ($4,000 EOD trailing). profitTarget=5.33% -> correct ($8,000/$150,000=5.333%). winningDays (none in eval) -> correct (5 benchmark days at $250+ apply only to funded-account payouts). evalMaxDays=unlimited -> correct (no time limit). NOTE: no FundedNext preset exists yet in src/lib/constants/prop-presets.ts (only Tradeify presets present); validated the proposed values, not an existing entry.

Sources: https://helpfutures.fundednext.com/en/articles/14878751-what-is-fundednext-futures-flex-challenge · https://helpfutures.fundednext.com/en/articles/14878851-is-there-any-consistency-rule-in-the-fundednext-futures-flex-challenge-and-fundednext-account · https://helpfutures.fundednext.com/en/articles/14878830-how-do-i-pass-fundednext-futures-flex-challenge · https://fundednext.com/general-rules/futures/trading-objectives

