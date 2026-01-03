# Product Roadmap

1. [ ] Screenshot Cloud Upload System — Implement cloud storage integration (Uploadthing/S3/Cloudinary) with multi-screenshot support per trade, caption editing, before/during/after categorization, gallery lightbox view, and drag-and-drop upload on trade detail page. `M`

2. [ ] Daily Trades Sidebar Navigation — Build collapsible sidebar on trade detail page showing all trades for the selected day, enabling quick navigation between trades, displaying daily P&L summary, and previous/next day navigation buttons. `S`

3. [ ] Chart Entry/Exit Markers — Add visual markers on lightweight-charts showing exact entry and exit prices, partial exit points, MAE/MFE extremes with color coding, and tooltips showing execution details on hover. `S`

4. [ ] Customizable Dashboard Widgets — Create drag-and-drop widget system with react-grid-layout, widget registry, user layout persistence in database, widget settings modal, and preset dashboard templates (Scalper, Swing Trader, Day Trader profiles). `L`

5. [ ] Advanced Time-Based Analytics — Complete time-based reports including trading frequency analysis, best/worst day highlighting with statistical significance, session performance trends over time, and month-over-month comparison charts. `M`

6. [ ] Setup-Based Performance Reports — Implement best setup analysis with win rate and profit factor by setup type, setup comparison matrix, setup performance over time line chart, and filtering by setup effectiveness. `M`

7. [ ] Streak and Pattern Detection — Build consecutive wins/losses tracking, performance-after-win vs performance-after-loss analysis, recovery from drawdown patterns, tilt detection based on behavior changes, and overtrading alerts. `L`

8. [ ] Notebook System — Create notebook entry CRUD with Tiptap rich text editor, pre-built templates (pre-market prep, post-market review, weekly assessment), full-text search, trade linking, and calendar view of entries. `L`

9. [ ] Custom Report Builder — Develop report builder interface with metric selection, chart type customization, date range filtering, export to PDF/CSV, shareable public links, and scheduled email delivery. `L`

10. [ ] Daily Notes System — Implement daily notes table synced across all trades for a given day, pre-market and post-market sections, rich text editing, and automatic display on trade detail pages for context. `S`

11. [ ] Additional Broker CSV Parsers — Extend CSV import to support MT5, NinjaTrader, cTrader, TradingView, Tradovate, Rithmic, Topstep, and Apex broker formats with parser tests and import validation. `M`

12. [ ] Monte Carlo Strategy Simulation — Add risk percentage per trade to strategy model, implement Monte Carlo simulation engine with proper compounding, generate equity curve projections, calculate risk-adjusted strategy comparison, and visualize outcome distribution. `L`

13. [ ] Trade Replay Engine — Integrate historical market data provider (Polygon/Alpha Vantage), build replay player with play/pause/speed controls, timeline scrubber, jump-to-entry/exit buttons, and real-time P&L calculation during playback. `XL`

14. [ ] Strategy Backtesting System — Create backtest session management, manual trade entry interface during backtest, keyboard shortcuts for efficient testing, performance summary with equity curve, comparison to live trading metrics, and export results. `XL`

15. [ ] Mobile Responsive Optimization — Audit all pages for mobile breakpoints, implement mobile navigation drawer, optimize trade entry form for touch, create mobile-friendly chart interactions, add swipe gestures for trade navigation, and improve touch target sizes. `M`

16. [ ] PWA and Offline Support — Set up service worker for offline functionality, implement install prompt, create app icons and manifest, add push notifications for trade reminders and daily review prompts, and cache critical assets. `M`

17. [ ] Mentor Mode Collaboration — Build mentor invite system with email invitations, read-only account access for mentors, mentor annotation tools on trades, feedback system, access revocation controls, and privacy settings for sensitive data. `L`

> Notes
> - Order prioritizes completing in-progress features (Phase 5) before expanding to new areas
> - Dashboard and analytics enhancements build on existing infrastructure
> - Advanced features (replay, backtesting) come after core functionality is solid
> - Each item represents an end-to-end (frontend + backend) functional and testable feature
