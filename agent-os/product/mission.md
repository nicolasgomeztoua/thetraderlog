# Product Mission

## Pitch
EdgeJournal is a professional trading journal that helps futures and forex traders improve their performance by providing a data-dense, terminal-inspired platform for tracking trades, analyzing performance metrics, and discovering actionable insights through AI-powered analytics.

## Users

### Primary Customers
- **Professional Retail Traders**: Independent futures and forex traders seeking to optimize their trading strategies through detailed performance tracking and analytics
- **Prop Firm Traders**: Traders participating in proprietary firm challenges and funded programs who need to demonstrate consistent performance and risk management
- **Trading Teams**: Small trading groups or mentorship programs requiring collaborative performance review and accountability

### User Personas

**Alex Chen** (28-42)
- **Role:** Independent Futures Day Trader
- **Context:** Trades ES and NQ futures full-time, focuses on scalping and momentum strategies during market sessions
- **Pain Points:**
  - Overwhelmed by spreadsheets and manual journaling that can't keep up with high-frequency trading
  - Struggles to identify which setups and times of day are most profitable
  - Needs to track partial exits and scale-ins accurately for position sizing analysis
  - Wants professional-grade metrics (Sharpe ratio, drawdown analysis) without complex calculations
- **Goals:** Achieve consistent profitability, refine entry/exit timing, manage risk effectively, prove readiness for prop firm funding

**Jordan Martinez** (25-35)
- **Role:** Forex Prop Challenge Trader
- **Context:** Trading multiple funded accounts and prop firm challenges simultaneously, needs to maintain different account types and track progress toward payout
- **Pain Points:**
  - Managing multiple accounts (demo, challenge, funded) across different prop firms is chaotic
  - Can't easily track which strategies work best for challenge vs funded account rules
  - Needs to demonstrate rule adherence (max daily loss, consistency targets) to prop firms
  - Manual journaling takes time away from chart analysis and trade preparation
- **Goals:** Pass prop challenges, maintain funded status, scale to multiple funded accounts, maximize monthly payouts

**Sarah Thompson** (32-48)
- **Role:** Trading Mentor / Professional Trader
- **Context:** Runs a small mentorship program while actively trading, needs to review student trades and track own performance
- **Pain Points:**
  - Difficult to share trading insights and review student performance without revealing sensitive account data
  - Needs privacy controls when sharing screenshots during educational content creation
  - Wants to demonstrate proven strategies and risk management to students with real data
- **Goals:** Build credible educational content, help students develop consistency, maintain own trading edge through detailed analysis

## The Problem

### Spreadsheets Can't Keep Up With Professional Trading
Most traders start with Excel or Google Sheets, but quickly hit limitations. Calculating P&L for partial exits, tracking MAE/MFE (Maximum Adverse/Favorable Excursion), analyzing win rates by setup type, and visualizing equity curves require complex formulas and constant manual updates. For active traders taking 10-50 trades per day, this becomes unsustainable. Critical insights get lost in the noise, and traders miss opportunities to refine their edge.

**Our Solution:** Automated trade tracking with intelligent P&L calculation, real-time analytics, and instant access to 50+ performance metrics. Import trades via CSV from any broker, and EdgeJournal handles the math - from basic win rate to advanced risk-adjusted returns like Sharpe and Sortino ratios.

### Existing Trading Journals Are Consumer-Focused, Not Professional-Grade
Popular trading journal apps prioritize simplicity and visual appeal over data density and analytical depth. They lack the granular metrics that professional traders and prop firms demand: Monte Carlo simulations, Risk of Ruin calculations, Kelly Criterion position sizing, strategy backtesting, and rule adherence tracking. Their interfaces feel like consumer productivity apps, not professional trading tools.

**Our Solution:** A terminal-inspired, dark-only interface designed for traders who live in professional charting platforms. Every screen maximizes information density without clutter. Advanced analytics include institutional-grade metrics used by hedge funds and prop firms. The design philosophy matches the professional trader's workflow: fast, focused, and data-driven.

### Multi-Account Management Is An Afterthought
Traders working with multiple prop firms or managing demo, live, and challenge accounts simultaneously need seamless account switching and aggregated analytics. Most journals treat multi-account as a premium add-on with poor UX, forcing traders to switch contexts or maintain separate subscriptions.

**Our Solution:** Built-in multi-account architecture from day one. Create unlimited accounts (demo, live, prop challenge, prop funded), organize them into groups, and analyze performance across accounts or individually. Prop challenge accounts can link to funded accounts when you pass, maintaining historical continuity.

## Differentiators

### Terminal-Inspired Professional Interface
Unlike TradeZella, TradingDiary Pro, and other consumer-focused journals with bright colors and rounded corners, EdgeJournal uses a dark-only terminal aesthetic (#050505 background, electric chartreuse #d4ff00 accents) with monospace fonts for all interactive elements. This creates a professional, data-dense environment that matches the tools traders already use (TradingView, NinjaTrader, charting platforms). The result is reduced eye strain during long market hours and a UI that feels purpose-built for serious traders.

### Advanced Risk Analytics Out of the Box
While competitors offer basic win rate and profit factor, EdgeJournal provides institutional-grade risk metrics without additional cost: Sharpe Ratio, Sortino Ratio, Calmar Ratio, Risk of Ruin, Kelly Criterion, Ulcer Index, and Recovery Factor. These are metrics used by hedge funds and required by top-tier prop firms. Traders get professional analysis without needing a finance degree or Excel expertise.

### Strategy System With Rule Adherence Tracking
Unlike basic tagging systems in other journals, EdgeJournal's strategy system lets you document entry criteria, exit rules, and risk parameters as structured checklists. On each trade, mark which rules you followed or broke. Over time, see compliance percentages and performance correlation: Did your best trades follow your rules? Are you deviating when emotional? This accountability system helps traders build discipline and refine their edge systematically.

### Real Market Data Integration for MAE/MFE Analysis
Most journals rely on traders manually entering "highest favorable price" and "worst adverse price" during a trade. EdgeJournal automatically fetches historical OHLC data during your trade window (via Databento for futures, Twelve Data for forex) and calculates Maximum Adverse Excursion (MAE) and Maximum Favorable Excursion (MFE). This reveals how much of the move you captured and whether you're exiting too early or letting winners run. The market data caching layer ensures fast performance without redundant API calls.

### Prop Firm Account Lifecycle Support
Built specifically for the prop trading workflow: create a prop challenge account, track progress toward evaluation targets, then link to a funded account when you pass - maintaining your full trade history. Other journals treat prop accounts as generic tags, losing the structured relationship between challenge and funded phases. EdgeJournal understands the prop firm lifecycle and helps traders optimize for both passing evaluations and maintaining funded status.

## Key Features

### Core Features
- **Multi-Account Management:** Unlimited accounts with types (demo, live, prop challenge, prop funded), account groups for organization, and seamless switching between contexts
- **Intelligent Trade Tracking:** Support for partial exits, scale-ins via trade executions, automatic P&L calculation with 8 decimal precision, and CSV import from major brokers (ProjectX, MT4/MT5)
- **Advanced Analytics Dashboard:** 50+ reports including time-based analysis (day of week, time of day, trading session), risk metrics (Sharpe/Sortino/Calmar ratios, Risk of Ruin), and equity curve with drawdown tracking
- **Strategy System:** Document trading strategies with structured entry/exit rules, track rule adherence per trade, analyze performance by strategy, and compare strategy effectiveness over time

### Collaboration Features
- **Trade Screenshots & Attachments:** Upload annotated charts and screenshots to each trade, organize by before/during/after, and review visual context when analyzing past trades
- **Tag System:** Create custom tags with colors, apply multiple tags per trade, filter and analyze performance by tag, and identify patterns across tagged trade groups
- **Daily Notes & Journal:** Pre-market preparation notes, post-market review entries, and synchronized daily notes across all trades for a given day

### Advanced Features
- **AI-Powered Insights:** Ice Blue (#00d4ff) accented AI analysis tab that discovers hidden patterns in trading behavior, identifies tilt signals, and suggests areas for improvement based on historical performance
- **MAE/MFE Analysis:** Automatic calculation of Maximum Adverse Excursion and Maximum Favorable Excursion using real market data, showing trade efficiency (how much of the move you captured) and optimal exit timing analysis
- **Real-Time Market Data:** Integrated charting with TradingView-style lightweight charts, real OHLC data from Databento (futures) and Twelve Data (forex/crypto), and cached data layer for instant chart rendering
- **Professional Risk Metrics:** Kelly Criterion for optimal position sizing, Monte Carlo simulations for strategy validation, consecutive win/loss streak tracking, and recovery factor analysis
- **Customizable Dashboard:** Drag-and-drop widget system (planned), multiple view modes (dollars, percentage, R-multiples, ticks, pips, points), and privacy mode for sharing screenshots
- **Trade Detail Panel:** Resizable two-panel layout inspired by TradeZella, tabbed interface for stats/strategy/executions/attachments, running P&L visualization, and quick navigation to same-day trades
