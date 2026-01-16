œ- Customizable dashboard widgets/layout
- Real-time calendar updates (WebSocket)
- Market outlook with price levels or charts
- Trading session time indicators
- Dark/light theme toggle (always dark)

## Technical Considerations
- **Database**: New `economicEvents` table with proper indexes for date queries
- **Trigger.dev**: Scheduled task infrastructure already exists, follow `processTradeMAEMFE` pattern
- **API**: JBlanked API requires API key, has rate limits - hourly fetch is conservative
- **Caching**: Database acts as cache; no additional client-side caching needed
- **Existing APIs**: `dailyJournal.getStreak()` already exists for streak display

## Design Considerations
- Terminal design system compliance (dark theme, monospace, data-dense)
- Primary accent: Chartreuse `#d4ff00` for actions and highlights
- Data colors: Profit `#00ff88`, Loss `#ff3b3b`, Breakeven `#fbbf24`
- Cards use `bg-card` with `border-border` styling
- All interactive elements use `font-mono`
- Responsive: single column mobile, two columns on `lg:` breakpoint

## Success Metrics
- Dashboard loads in under 2 seconds
- Users can navigate to all key actions (Journal, Log Trade, Import) in one click
- Economic calendar shows events when available
- No regression in existing dashboard functionality (Start Journal)

## Open Questions
- None - requirements clarified during planning

## Dependencies
- JBlanked API account and API key for economic calendar data
- Trigger.dev project deployed for scheduled sync task
