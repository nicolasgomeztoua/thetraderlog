// =============================================================================
// FEW-SHOT EXAMPLES FOR WRITER PHASE
//
// Curated report sections demonstrating correct MDX component usage, data-driven
// narrative, and proper formatting. These are injected into the writer system
// prompt to guide output quality.
// =============================================================================

const PERFORMANCE_OVERVIEW_EXAMPLE = `### Example Section: Performance Overview

\`\`\`mdx
## Performance Overview

Over the past 30 days, your trading shows a clear positive trajectory with a net P&L of $4,827.50 across 156 trades. Your win rate of 58.3% combined with a profit factor of 1.92 puts you solidly in profitable territory, though there is room to improve your loss management.

<MetricGrid>
  <MetricCard title="Net P&L" value="$4,827.50" tooltip={{ what: "Total profit minus total losses and fees", why: "Bottom-line measure of trading success", benchmark: "Positive is the baseline — compare to previous months" }} colorClass="text-profit" />
  <MetricCard title="Win Rate" value="58.3%" tooltip={{ what: "Percentage of trades closed in profit", why: "Core accuracy metric for your edge", benchmark: "Above 50% is good; above 60% is excellent" }} />
  <MetricCard title="Profit Factor" value="1.92" tooltip={{ what: "Gross profit divided by gross loss", why: "Measures dollar efficiency of your edge", benchmark: "Above 1.5 is solid; above 2.0 is strong" }} />
  <MetricCard title="Expectancy" value="$30.94" tooltip={{ what: "Average expected profit per trade", why: "Combines win rate and risk/reward into one metric", benchmark: "Positive means your system has an edge" }} colorClass="text-profit" />
</MetricGrid>

<EquityCurve dataRef="equity-data" />

The equity curve reveals two distinct phases: a steady climb through the first three weeks, followed by a sharp drawdown on the 22nd that erased $1,200 in gains before recovering. This drawdown coincided with a 5-trade losing streak on NQ — your worst run of the month.

<Callout type="tip">Your average winner ($124.80) is 1.4x your average loser ($88.20). Maintaining this asymmetry is the foundation of your profitability.</Callout>
\`\`\``;

const RISK_ANALYSIS_EXAMPLE = `### Example Section: Risk Analysis

\`\`\`mdx
## Risk & Position Sizing Analysis

Your risk management has been disciplined overall, but the data reveals a few patterns that warrant attention. Your max drawdown of 6.8% stays within conservative bounds, and R-multiple analysis shows you are cutting losses appropriately on most trades.

<DrawdownTable dataRef="drawdown-data" />

The two deepest drawdowns both occurred after overtrading sessions — 8+ trades in a single day versus your average of 4.2. This pattern suggests that volume, not market conditions, is the primary drawdown driver.

<RMultipleChart dataRef="r-multiple-data" />

Your R-multiple distribution is right-skewed with a mean of 0.42R. Winners average 1.8R while losers average -0.9R, giving you a healthy payoff ratio. However, the long left tail (3 trades below -3R) indicates occasional stop violations.

<MetricGrid>
  <MetricCard title="Max Drawdown" value="-6.8%" tooltip={{ what: "Largest peak-to-trough equity decline", why: "Measures worst-case scenario in your track record", benchmark: "Under 10% is conservative; under 5% is excellent" }} colorClass="text-loss" />
  <MetricCard title="Risk of Ruin" value="0.3%" tooltip={{ what: "Probability of losing 50% of capital at current risk levels", why: "Key survival metric — should be near zero", benchmark: "Under 1% means your survival is virtually guaranteed" }} colorClass="text-profit" />
  <MetricCard title="Avg R-Multiple" value="0.42R" tooltip={{ what: "Average risk-adjusted return per trade", why: "Normalizes returns by the risk taken on each trade", benchmark: "Above 0.3R is good; above 0.5R is strong" }} />
  <MetricCard title="Sharpe Ratio" value="1.84" tooltip={{ what: "Risk-adjusted return relative to volatility", why: "Measures return per unit of risk taken", benchmark: "Above 1.0 is good; above 2.0 is excellent" }} />
</MetricGrid>

<MonteCarloChart dataRef="monte-carlo-data" />

The Monte Carlo simulation projects a 94% probability of profit over the next 100 trades at current performance levels. The median projected outcome is +$7,200, with a 5th percentile floor of -$1,800. This suggests your edge is robust, but sizing increases should wait until the stop-violation pattern is resolved.

<Callout type="warning">Three trades exceeded -3R this month. Review these trades — if stops were moved or skipped, this is a discipline issue, not a strategy issue.</Callout>

<Callout type="tip">Your risk of ruin at 0.3% is excellent. You have significant room to increase position size gradually — consider moving from 1 to 1.25 contracts on your A+ setups only.</Callout>
\`\`\``;

export const WRITER_FEW_SHOT_EXAMPLES = `## Few-Shot Examples

Study these examples carefully. They demonstrate the expected quality, formatting, and MDX component usage for your report output.

Key patterns to follow:
- **Lead with narrative**, not components — write analysis first, then show the supporting visualization
- **Cite specific numbers** in prose (e.g., "$4,827.50", "58.3%", "1.4x") — never write vague statements like "your performance was good"
- **Use dataRef keys** exactly as listed in the Data Summary section
- **Mix components naturally** with markdown text — don't cluster all components together
- **Callouts at the end of sections** — use "tip" for actionable recommendations, "warning" for risk alerts
- **MetricGrid groups** of 3-5 MetricCards for key stats at the top of major sections
- **Tooltip format**: always include all three fields (what, why, benchmark) for MetricCard tooltips

${PERFORMANCE_OVERVIEW_EXAMPLE}

${RISK_ANALYSIS_EXAMPLE}`;
