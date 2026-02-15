// =============================================================================
// FEW-SHOT EXAMPLES FOR WRITER PHASE
//
// Curated report sections demonstrating correct JSON structured output matching
// the report Zod schema. These are injected into the writer system prompt to
// guide output quality.
// =============================================================================

const PERFORMANCE_OVERVIEW_EXAMPLE = `### Example Section: Performance Overview

\`\`\`json
{
  "heading": "Performance Overview",
  "blocks": [
    {
      "type": "prose",
      "content": "Over the past 30 days, your trading shows a clear positive trajectory with a net P&L of $4,827.50 across 156 trades. Your win rate of 58.3% combined with a profit factor of 1.92 puts you solidly in profitable territory, though there is room to improve your loss management."
    },
    {
      "type": "metrics",
      "items": [
        {
          "title": "Net P&L",
          "value": "$4,827.50",
          "tooltip": { "what": "Total profit minus total losses and fees", "why": "Bottom-line measure of trading success", "benchmark": "Positive is the baseline — compare to previous months" },
          "colorClass": "text-profit"
        },
        {
          "title": "Win Rate",
          "value": "58.3%",
          "tooltip": { "what": "Percentage of trades closed in profit", "why": "Core accuracy metric for your edge", "benchmark": "Above 50% is good; above 60% is excellent" }
        },
        {
          "title": "Profit Factor",
          "value": "1.92",
          "tooltip": { "what": "Gross profit divided by gross loss", "why": "Measures dollar efficiency of your edge", "benchmark": "Above 1.5 is solid; above 2.0 is strong" }
        },
        {
          "title": "Expectancy",
          "value": "$30.94",
          "tooltip": { "what": "Average expected profit per trade", "why": "Combines win rate and risk/reward into one metric", "benchmark": "Positive means your system has an edge" },
          "colorClass": "text-profit"
        }
      ]
    },
    {
      "type": "chart",
      "component": "EquityCurve",
      "dataRef": "equity-data"
    },
    {
      "type": "prose",
      "content": "The equity curve reveals two distinct phases: a steady climb through the first three weeks, followed by a sharp drawdown on the 22nd that erased $1,200 in gains before recovering. This drawdown coincided with a 5-trade losing streak on NQ — your worst run of the month."
    },
    {
      "type": "callout",
      "calloutType": "tip",
      "content": "Your average winner ($124.80) is 1.4x your average loser ($88.20). Maintaining this asymmetry is the foundation of your profitability."
    }
  ]
}
\`\`\``;

const RISK_ANALYSIS_EXAMPLE = `### Example Section: Risk Analysis

\`\`\`json
{
  "heading": "Risk & Position Sizing Analysis",
  "blocks": [
    {
      "type": "prose",
      "content": "Your risk management has been disciplined overall, but the data reveals a few patterns that warrant attention. Your max drawdown of 6.8% stays within conservative bounds, and R-multiple analysis shows you are cutting losses appropriately on most trades."
    },
    {
      "type": "chart",
      "component": "DrawdownTable",
      "dataRef": "drawdown-data"
    },
    {
      "type": "prose",
      "content": "The two deepest drawdowns both occurred after overtrading sessions — 8+ trades in a single day versus your average of 4.2. This pattern suggests that volume, not market conditions, is the primary drawdown driver."
    },
    {
      "type": "chart",
      "component": "RMultipleChart",
      "dataRef": "r-multiple-data"
    },
    {
      "type": "prose",
      "content": "Your R-multiple distribution is right-skewed with a mean of 0.42R. Winners average 1.8R while losers average -0.9R, giving you a healthy payoff ratio. However, the long left tail (3 trades below -3R) indicates occasional stop violations."
    },
    {
      "type": "metrics",
      "items": [
        {
          "title": "Max Drawdown",
          "value": "-6.8%",
          "tooltip": { "what": "Largest peak-to-trough equity decline", "why": "Measures worst-case scenario in your track record", "benchmark": "Under 10% is conservative; under 5% is excellent" },
          "colorClass": "text-loss"
        },
        {
          "title": "Risk of Ruin",
          "value": "0.3%",
          "tooltip": { "what": "Probability of losing 50% of capital at current risk levels", "why": "Key survival metric — should be near zero", "benchmark": "Under 1% means your survival is virtually guaranteed" },
          "colorClass": "text-profit"
        },
        {
          "title": "Avg R-Multiple",
          "value": "0.42R",
          "tooltip": { "what": "Average risk-adjusted return per trade", "why": "Normalizes returns by the risk taken on each trade", "benchmark": "Above 0.3R is good; above 0.5R is strong" }
        },
        {
          "title": "Sharpe Ratio",
          "value": "1.84",
          "tooltip": { "what": "Risk-adjusted return relative to volatility", "why": "Measures return per unit of risk taken", "benchmark": "Above 1.0 is good; above 2.0 is excellent" }
        }
      ]
    },
    {
      "type": "chart",
      "component": "MonteCarloChart",
      "dataRef": "monte-carlo-data"
    },
    {
      "type": "prose",
      "content": "The Monte Carlo simulation projects a 94% probability of profit over the next 100 trades at current performance levels. The median projected outcome is +$7,200, with a 5th percentile floor of -$1,800. This suggests your edge is robust, but sizing increases should wait until the stop-violation pattern is resolved."
    },
    {
      "type": "callout",
      "calloutType": "warning",
      "content": "Three trades exceeded -3R this month. Review these trades — if stops were moved or skipped, this is a discipline issue, not a strategy issue."
    },
    {
      "type": "callout",
      "calloutType": "tip",
      "content": "Your risk of ruin at 0.3% is excellent. You have significant room to increase position size gradually — consider moving from 1 to 1.25 contracts on your A+ setups only."
    }
  ]
}
\`\`\``;

const SPARSE_DATA_EXAMPLE = `### Example Section: Handling Sparse Data (R-Multiple with 1 trade)

\`\`\`json
{
  "heading": "Risk-Adjusted Returns",
  "blocks": [
    {
      "type": "prose",
      "content": "Only 1 of your 23 trades had a defined stop loss, so we can't yet build a full R-multiple distribution. Here's what that single trade tells us:"
    },
    {
      "type": "metrics",
      "items": [
        {
          "title": "Trades with Stop Loss",
          "value": "1 of 23",
          "tooltip": { "what": "Number of trades where initial risk (stop loss) was defined", "why": "R-multiples require a stop loss to calculate risk-adjusted return", "benchmark": "Aim for 100% — every trade should have a defined stop" },
          "colorClass": "text-loss"
        },
        {
          "title": "R-Multiple",
          "value": "-3.54R",
          "tooltip": { "what": "How many times your initial risk you gained or lost", "why": "Negative R means the loss exceeded the planned risk", "benchmark": "Losses should stay near -1R; above -2R needs investigation" },
          "colorClass": "text-loss"
        }
      ]
    },
    {
      "type": "prose",
      "content": "That single R-multiple of -3.54 is concerning — it means the trade lost 3.5x the amount you planned to risk. This typically happens when a stop loss is moved or ignored during the trade."
    },
    {
      "type": "callout",
      "calloutType": "note",
      "content": "As you log more trades with defined stop losses, future reports will include a full R-multiple distribution chart showing your risk-adjusted performance across all trades."
    },
    {
      "type": "callout",
      "calloutType": "warning",
      "content": "A -3.54R loss suggests a stop-loss violation. Review whether the stop was moved during the trade or if the original stop was too tight for the instrument's volatility."
    }
  ]
}
\`\`\``;

export const WRITER_FEW_SHOT_EXAMPLES = `## Few-Shot Examples

Study these examples carefully. They demonstrate the expected quality, structure, and JSON format for your report output. Each example shows a single **section** object (with heading and blocks array).

Key patterns to follow:
- **Lead with narrative**, not data — start each section with a prose block that provides analysis, then show supporting metrics and charts
- **Cite specific numbers** in prose (e.g., "$4,827.50", "58.3%", "1.4x") — never write vague statements like "your performance was good"
- **Use dataRef keys** exactly as listed in the Data Summary section — never invent keys
- **Mix block types naturally** — alternate prose, metrics, and chart blocks; don't cluster all charts together
- **Callouts at the end of sections** — use "tip" for actionable recommendations, "warning" for risk alerts, "note" for future guidance
- **Metrics blocks** with 3-5 items for key stats — each item needs title, value, and tooltip (what, why, benchmark)
- **Tooltip format**: always include all three fields (what, why, benchmark)
- **Handle sparse data gracefully** — use metrics and prose blocks instead of chart blocks when data is limited (see sparse data example below)

${PERFORMANCE_OVERVIEW_EXAMPLE}

${RISK_ANALYSIS_EXAMPLE}

${SPARSE_DATA_EXAMPLE}`;
