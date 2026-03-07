/**
 * Schema Context Generator
 *
 * Auto-generates a comprehensive description of the database schema, relationships,
 * and available tRPC analytics endpoints for the AI system prompt.
 * This is a static string generated once — not per-request.
 */

const SCHEMA_CONTEXT = `
## Database Schema

### Enums

- **user_role**: user, admin
- **trade_direction**: long, short
- **trade_status**: open, closed
- **execution_type**: entry, exit, scale_in, scale_out
- **emotional_state**: confident, fearful, greedy, neutral, frustrated, excited, anxious
- **import_source**: manual, csv
- **exit_reason**: manual, stop_loss, trailing_stop, take_profit, time_based, breakeven
- **account_type**: prop_challenge, prop_funded, live, demo
- **drawdown_type**: trailing, static, eod
- **payout_frequency**: weekly, bi_weekly, monthly
- **challenge_status**: active, passed, failed
- **trading_platform**: projectx, topstepx, ninjatrader, tradovate, rithmic, apex, other
- **strategy_rule_category**: entry, exit, risk, management
- **rule_type**: manual, auto, semi_auto
- **data_quality**: full, partial, unavailable, pending
- **ai_conversation_status**: active, generating, complete, failed
- **ai_conversation_mode**: chat, report
- **ai_report_status**: queued, generating, complete, failed

### Tables

#### user
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| clerk_id | text (unique) | no | Clerk auth provider ID |
| email | text | no | |
| name | text | yes | |
| image_url | text | yes | |
| role | user_role | no | Default: 'user' |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### account
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| name | text | no | e.g., "Main Account" |
| broker | text | yes | e.g., "IBKR", "Oanda" |
| platform | trading_platform | no | Default: 'other' |
| account_type | account_type | no | Default: 'live' |
| initial_balance | decimal(20,2) | yes | Default: '0' |
| currency | text | yes | Default: 'USD' |
| account_number | text | yes | External account number |
| is_active | boolean | yes | Default: true |
| is_default | boolean | yes | Default: false |
| notes | text | yes | |
| color | text | yes | For UI distinction |
| max_drawdown | decimal(10,2) | yes | Prop firm: max drawdown % |
| drawdown_type | drawdown_type | yes | trailing, static, eod |
| daily_loss_limit | decimal(10,2) | yes | Max daily loss % |
| profit_target | decimal(10,2) | yes | Challenge: profit target % |
| consistency_rule | decimal(10,2) | yes | Max single day profit as % of target |
| min_trading_days | integer | yes | Minimum required trading days |
| challenge_start_date | timestamp with tz | yes | |
| challenge_end_date | timestamp with tz | yes | |
| challenge_status | challenge_status | yes | active, passed, failed |
| profit_split | decimal(10,2) | yes | Funded: profit sharing % |
| payout_frequency | payout_frequency | yes | weekly, bi_weekly, monthly |
| linked_account_id | text (FK → account.id) | yes | Funded → challenge link |
| group_id | text (FK → account_group.id) | yes | Copy trading group |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### account_group
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| name | text | no | e.g., "Copy Trading Group A" |
| description | text | yes | |
| color | text | yes | Default: '#6366f1' |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### trade
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| account_id | text (FK → account.id) | yes | SET NULL on delete |
| strategy_id | text (FK → strategy.id) | yes | |
| symbol | text | no | e.g., "ES", "NQ", "MES", "MNQ" |
| direction | trade_direction | no | long or short |
| status | trade_status | no | Default: 'open' |
| entry_price | decimal(20,8) | no | |
| entry_time | timestamp with tz | no | |
| exit_price | decimal(20,8) | yes | NULL if still open |
| exit_time | timestamp with tz | yes | NULL if still open |
| quantity | decimal(20,8) | no | Lots or contracts |
| stop_loss | decimal(20,8) | yes | Planned stop loss |
| take_profit | decimal(20,8) | yes | Planned take profit |
| stop_loss_hit | boolean | yes | Default: false |
| take_profit_hit | boolean | yes | Default: false |
| trailed_stop_loss | decimal(20,8) | yes | Final trailed SL |
| was_trailed | boolean | yes | Default: false |
| exit_reason | exit_reason | yes | How the trade was closed |
| is_partially_exited | boolean | yes | Default: false |
| remaining_quantity | decimal(20,8) | yes | Remaining after partials |
| realized_pnl | decimal(20,2) | yes | Gross P&L |
| fees | decimal(20,2) | yes | Default: '0' |
| net_pnl | decimal(20,2) | yes | realized_pnl - fees |
| mae_price | decimal(20,8) | yes | Max adverse excursion price |
| mfe_price | decimal(20,8) | yes | Max favorable excursion price |
| mae_amount | decimal(20,2) | yes | MAE in $ |
| mfe_amount | decimal(20,2) | yes | MFE in $ |
| market_data_quality | data_quality | yes | full, partial, unavailable, pending |
| setup_type | text | yes | e.g., "breakout", "reversal" |
| emotional_state | emotional_state | yes | |
| notes | text | yes | |
| rating | integer | yes | 1-5 stars |
| is_reviewed | boolean | yes | Default: false |
| import_source | import_source | no | Default: 'manual' |
| external_id | text | yes | For imported trades |
| trade_hash | text | yes | SHA-256 for duplicate detection |
| deleted_at | timestamp with tz | yes | Soft delete |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### trade_execution
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| trade_id | text (FK → trade.id) | no | CASCADE on delete |
| execution_type | execution_type | no | entry, exit, scale_in, scale_out |
| price | decimal(20,8) | no | |
| quantity | decimal(20,8) | no | |
| executed_at | timestamp with tz | no | |
| fees | decimal(20,2) | yes | Default: '0' |
| realized_pnl | decimal(20,2) | yes | P&L for this execution |
| notes | text | yes | |
| created_at | timestamp with tz | no | |

#### tag
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| name | text | no | |
| color | text | yes | Default: '#6366f1' |
| created_at | timestamp with tz | no | |

#### trade_tag (junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| trade_id | text (FK → trade.id) | no | Composite PK |
| tag_id | text (FK → tag.id) | no | Composite PK |

#### user_settings
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id, unique) | no | One settings per user |
| timezone | text | yes | Default: 'UTC' |
| breakeven_threshold | decimal(10,2) | yes | Default: '3.00' — P&L within ±$X is breakeven |
| currency | text | yes | Default: 'USD' |
| theme | text | yes | Default: 'terminal' |
| trade_log_columns | text | yes | JSON string |
| trade_log_sort | text | yes | JSON string |
| trading_sessions | text | yes | JSON array of session configs |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### filter_preset
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| name | text | no | |
| description | text | yes | |
| filters | text | no | JSON string of analytics filters |
| is_default | boolean | yes | Default: false |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### strategy
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| name | text | no | |
| description | text | yes | |
| color | text | yes | Default: '#d4ff00' |
| entry_criteria | text | yes | Rich text for entry rules |
| exit_rules | text | yes | Rich text for exit rules |
| risk_parameters | text | yes | JSON: positionSizing, maxRiskPerTrade, dailyLossLimit, etc. |
| scaling_rules | text | yes | JSON: scaleIn/scaleOut triggers |
| trailing_rules | text | yes | JSON: moveToBreakeven, trailStops |
| is_active | boolean | yes | Default: true |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### strategy_rule
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| strategy_id | text (FK → strategy.id) | no | CASCADE on delete |
| text | text | no | The rule text |
| category | strategy_rule_category | no | Default: 'entry' |
| order | integer | no | Default: 0 |
| rule_type | rule_type | no | Default: 'manual' |
| config_source | text | yes | Source config path |
| auto_condition | text | yes | JSON evaluation parameters |
| is_generated | boolean | no | Default: false |
| source_config_hash | text | yes | For change detection |
| created_at | timestamp with tz | no | |

#### trade_rule_check (junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| trade_id | text (FK → trade.id) | no | Composite PK |
| rule_id | text (FK → strategy_rule.id) | no | Composite PK |
| checked | boolean | no | Default: false |
| checked_at | timestamp with tz | yes | |
| evaluation_result | text | yes | JSON with evaluation details |
| was_auto_evaluated | boolean | no | Default: false |
| user_override | boolean | yes | If user overrode auto-evaluation |

#### daily_journal
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| date | timestamp with tz | no | Normalized to midnight |
| content | text | yes | Rich text (HTML from Tiptap) |
| content_format | text | yes | Default: 'html' |
| day_started_at | timestamp with tz | yes | When user clicked "Start My Journal" |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### daily_checklist_template
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| text | text | no | The checklist item text |
| order | integer | no | Default: 0 |
| is_active | boolean | no | Default: true |
| created_at | timestamp with tz | no | |

#### checklist_check
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| journal_id | text (FK → daily_journal.id) | no | CASCADE on delete |
| template_id | text (FK → daily_checklist_template.id) | yes | For user-created checks |
| forced_item_id | text | yes | For system-level checks |
| checked | boolean | no | Default: false |
| checked_at | timestamp with tz | yes | |

#### ai_conversation
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| title | text | yes | |
| status | ai_conversation_status | no | Default: 'active' |
| mode | ai_conversation_mode | yes | chat or report |
| initial_prompt | text | yes | |
| date_range_start | timestamp with tz | yes | |
| date_range_end | timestamp with tz | yes | |
| model | text | yes | |
| created_at | timestamp with tz | no | |
| updated_at | timestamp with tz | yes | Auto-updated |

#### ai_message
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| conversation_id | text (FK → ai_conversation.id) | no | CASCADE on delete |
| role | text | no | 'user', 'assistant', or 'system' |
| content | text | no | |
| model | text | yes | Model used (assistant messages) |
| tokens_used | integer | yes | Token count |
| tool_calls | text | yes | JSON string of tool calls |
| created_at | timestamp with tz | no | |

#### ai_report
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| user_id | text (FK → user.id) | no | CASCADE on delete |
| conversation_id | text (FK → ai_conversation.id) | no | CASCADE on delete |
| title | text | no | |
| prompt | text | no | |
| model | text | no | |
| status | ai_report_status | no | Default: 'queued' |
| content | text | yes | AI-generated MDX content |
| data_artifacts | jsonb | yes | Component data referenced by dataRef |
| tokens_used | integer | no | Default: 0 |
| trigger_task_id | text | yes | |
| created_at | timestamp with tz | no | |
| completed_at | timestamp with tz | yes | |

#### journal_attachment
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| journal_id | text (FK → daily_journal.id) | no | CASCADE on delete |
| url | text | no | S3/CDN URL |
| key | text | no | S3 object key |
| filename | text | no | |
| mime_type | text | no | |
| size | integer | no | Bytes |
| caption | text | yes | |
| created_at | timestamp with tz | no | |

#### trade_attachment
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| trade_id | text (FK → trade.id) | no | CASCADE on delete |
| url | text | no | S3/CDN URL (stores S3 key) |
| key | text | no | S3 object key |
| filename | text | no | |
| mime_type | text | no | |
| size | integer | no | Bytes |
| caption | text | yes | |
| created_at | timestamp with tz | no | |

#### candle_cache
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text (PK) | no | Generated ID |
| symbol | text | no | e.g., "ES", "NQ", "MNQ" |
| interval | text | no | "1min", "5min", "15min", "1h" |
| date | timestamp with tz | no | Normalized to midnight UTC |
| bars | text | no | JSON array of OHLC bars |
| bar_count | integer | no | Quick count |
| source | text | no | e.g., "databento" |
| fetched_at | timestamp with tz | no | |

### Relationships

- **user** → has many: accounts, account_groups, trades, tags, strategies, daily_journals, ai_conversations, ai_reports, filter_presets, daily_checklist_templates; has one: user_settings
- **account** → belongs to: user; has many: trades; belongs to: account_group (optional); links to: account (self-ref for funded→challenge)
- **trade** → belongs to: user, account (optional), strategy (optional); has many: trade_executions, trade_tags, trade_rule_checks, trade_attachments
- **tag** → belongs to: user; has many: trade_tags
- **strategy** → belongs to: user; has many: strategy_rules, trades
- **ai_conversation** → belongs to: user; has many: ai_messages, ai_reports
- **ai_report** → belongs to: user, ai_conversation
- **daily_journal** → belongs to: user; has many: checklist_checks, journal_attachments
- **daily_checklist_template** → belongs to: user; has many: checklist_checks

### Important Data Notes

- **P&L values** (realized_pnl, net_pnl, fees, etc.) are stored as decimal strings. Always use CAST(column AS NUMERIC) for SQL aggregation.
- **All timestamps** use "with timezone" — stored in UTC.
- **Soft deletes**: trades have a deleted_at column. Always filter with \`deleted_at IS NULL\` unless you want to include deleted trades.
- **User scoping**: All queries use user-scoped CTE aliases (user_trades, user_accounts, etc.) that automatically filter to the current user. NEVER use raw table names like \`trade\` or \`account\` — always use \`user_trades\`, \`user_accounts\`, etc.
- **Breakeven threshold**: User-configurable via user_settings.breakeven_threshold (default $3). Trades with |net_pnl| <= threshold are considered breakeven.

## Timezone Handling

**CRITICAL**: All timestamps are stored in UTC. When extracting date/time parts (hour, day of week, month, date), you MUST convert to the user's timezone first using \`AT TIME ZONE\`. The user's timezone is available in the \`user_settings\` CTE.

### Pattern
\`\`\`sql
-- Convert to user's timezone before extracting date/time parts
EXTRACT(HOUR FROM entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1))
EXTRACT(DOW FROM entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1))
TO_CHAR(entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1), 'YYYY-MM')
\`\`\`

### Common Mistake
\`\`\`sql
-- WRONG: Extracts hour/day in UTC — will misclassify sessions and days
EXTRACT(HOUR FROM entry_time)
EXTRACT(DOW FROM entry_time)
TO_CHAR(entry_time, 'YYYY-MM')

-- RIGHT: Converts to user's local time first
EXTRACT(HOUR FROM entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1))
EXTRACT(DOW FROM entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1))
TO_CHAR(entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1), 'YYYY-MM')
\`\`\`

## Example SQL Queries

**IMPORTANT**: Always use the user-scoped CTE aliases (user_trades, user_accounts, etc.) — NEVER raw table names. You do NOT need WHERE user_id clauses; the CTEs already filter to the current user.

### P&L by Day of Week
\`\`\`sql
SELECT
  EXTRACT(DOW FROM entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1)) AS day_of_week,
  COUNT(*) AS trades,
  SUM(CAST(net_pnl AS NUMERIC)) AS total_pnl,
  AVG(CAST(net_pnl AS NUMERIC)) AS avg_pnl
FROM user_trades
WHERE deleted_at IS NULL AND status = 'closed'
GROUP BY day_of_week
ORDER BY day_of_week;
\`\`\`

### P&L by Symbol
\`\`\`sql
SELECT
  symbol,
  COUNT(*) AS trades,
  SUM(CAST(net_pnl AS NUMERIC)) AS total_pnl,
  AVG(CAST(net_pnl AS NUMERIC)) AS avg_pnl,
  SUM(CASE WHEN CAST(net_pnl AS NUMERIC) > 0 THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN CAST(net_pnl AS NUMERIC) < 0 THEN 1 ELSE 0 END) AS losses
FROM user_trades
WHERE deleted_at IS NULL AND status = 'closed'
GROUP BY symbol
ORDER BY total_pnl DESC;
\`\`\`

### Trades with Tags
\`\`\`sql
SELECT t.*, array_agg(tg.name) AS tag_names
FROM user_trades t
LEFT JOIN user_trade_tags tt ON t.id = tt.trade_id
LEFT JOIN user_tags tg ON tt.tag_id = tg.id
WHERE t.deleted_at IS NULL
GROUP BY t.id
ORDER BY t.entry_time DESC
LIMIT 50;
\`\`\`

### Win Rate by Strategy
\`\`\`sql
SELECT
  s.name AS strategy_name,
  COUNT(*) AS trades,
  SUM(CASE WHEN CAST(t.net_pnl AS NUMERIC) > 0 THEN 1 ELSE 0 END) AS wins,
  ROUND(
    SUM(CASE WHEN CAST(t.net_pnl AS NUMERIC) > 0 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100,
    1
  ) AS win_rate,
  SUM(CAST(t.net_pnl AS NUMERIC)) AS total_pnl
FROM user_trades t
JOIN user_strategies s ON t.strategy_id = s.id
WHERE t.deleted_at IS NULL AND t.status = 'closed'
GROUP BY s.name
ORDER BY total_pnl DESC;
\`\`\`

### Equity Curve (Cumulative P&L)
\`\`\`sql
SELECT
  id, symbol, entry_time, exit_time, CAST(net_pnl AS NUMERIC) AS pnl,
  SUM(CAST(net_pnl AS NUMERIC)) OVER (ORDER BY exit_time) AS cumulative_pnl
FROM user_trades
WHERE deleted_at IS NULL AND status = 'closed'
ORDER BY exit_time;
\`\`\`

### Monthly Performance
\`\`\`sql
SELECT
  TO_CHAR(entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1), 'YYYY-MM') AS month,
  COUNT(*) AS trades,
  SUM(CAST(net_pnl AS NUMERIC)) AS total_pnl,
  AVG(CAST(net_pnl AS NUMERIC)) AS avg_pnl,
  SUM(CASE WHEN CAST(net_pnl AS NUMERIC) > 0 THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN CAST(net_pnl AS NUMERIC) < 0 THEN 1 ELSE 0 END) AS losses
FROM user_trades
WHERE deleted_at IS NULL AND status = 'closed'
GROUP BY month
ORDER BY month DESC;
\`\`\`

### Holding Time Analysis
\`\`\`sql
SELECT
  EXTRACT(EPOCH FROM (exit_time - entry_time)) / 60 AS holding_minutes,
  CAST(net_pnl AS NUMERIC) AS pnl,
  symbol, direction
FROM user_trades
WHERE deleted_at IS NULL AND status = 'closed'
  AND exit_time IS NOT NULL
ORDER BY holding_minutes;
\`\`\`

### R-Multiple Distribution
\`\`\`sql
SELECT
  t.id, t.symbol,
  CAST(t.net_pnl AS NUMERIC) AS pnl,
  CAST(t.stop_loss AS NUMERIC) AS stop_loss,
  CAST(t.entry_price AS NUMERIC) AS entry_price,
  CASE
    WHEN t.stop_loss IS NOT NULL AND t.entry_price IS NOT NULL
    THEN CAST(t.net_pnl AS NUMERIC) / NULLIF(ABS(CAST(t.entry_price AS NUMERIC) - CAST(t.stop_loss AS NUMERIC)) * CAST(t.quantity AS NUMERIC), 0)
    ELSE NULL
  END AS r_multiple
FROM user_trades t
WHERE t.deleted_at IS NULL AND t.status = 'closed'
  AND t.stop_loss IS NOT NULL
ORDER BY r_multiple DESC;
\`\`\`

### Entry Position Within Daily Range (cross-reference with get_market_data)
Use this pattern with get_market_data to assess entry quality. First fetch daily candles for the symbol, then compare entry prices.
\`\`\`sql
SELECT
  t.id, t.symbol, t.direction,
  CAST(t.entry_price AS NUMERIC) AS entry_price,
  CAST(t.net_pnl AS NUMERIC) AS pnl,
  t.entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1) AS local_entry_time,
  TO_CHAR(t.entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1), 'YYYY-MM-DD') AS trade_date
FROM user_trades t
WHERE t.deleted_at IS NULL AND t.status = 'closed'
  AND t.symbol = 'ES'
ORDER BY t.entry_time DESC
LIMIT 50;
\`\`\`
Then use get_market_data for the same symbol/dates and compute: entry_position = (entry_price - day_low) / (day_high - day_low). Values near 0 = entered near the low, near 1 = entered near the high. For longs, lower is better; for shorts, higher is better.

### Trade P&L vs Market Volatility
\`\`\`sql
SELECT
  TO_CHAR(t.entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1), 'YYYY-MM-DD') AS trade_date,
  t.symbol,
  COUNT(*) AS trades,
  SUM(CAST(t.net_pnl AS NUMERIC)) AS daily_pnl,
  AVG(CAST(t.net_pnl AS NUMERIC)) AS avg_pnl
FROM user_trades t
WHERE t.deleted_at IS NULL AND t.status = 'closed'
GROUP BY trade_date, t.symbol
ORDER BY trade_date DESC;
\`\`\`
Cross-reference with get_market_data daily candles: volatility = (high - low). Correlate daily_pnl with volatility to see if the trader performs better on high or low volatility days.

### Entries Relative to Session Open
\`\`\`sql
SELECT
  t.id, t.symbol, t.direction,
  CAST(t.entry_price AS NUMERIC) AS entry_price,
  CAST(t.net_pnl AS NUMERIC) AS pnl,
  EXTRACT(HOUR FROM t.entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1)) AS entry_hour,
  EXTRACT(MINUTE FROM t.entry_time AT TIME ZONE (SELECT timezone FROM user_settings LIMIT 1)) AS entry_minute
FROM user_trades t
WHERE t.deleted_at IS NULL AND t.status = 'closed'
ORDER BY t.entry_time DESC;
\`\`\`
Combine with get_market_data (use 1h or 15min candles) to compute how far from session open price the trader entered, and whether they traded with or against the initial move.

## Available tRPC Endpoints

Use the \`call_analytics\` tool to invoke these endpoints. Analytics and trades endpoints accept optional accountId and analytics filters.

### Analytics Router

| Endpoint | Description | Returns |
|----------|-------------|---------|
| getOverview | Overall trading statistics | totalTrades, wins, losses, winRate, totalPnl, avgPnl, profitFactor, sharpeRatio, etc. |
| getCalendarData | Daily P&L for calendar heatmap | Array of {date, pnl, trades, wins, losses, winRate, avgPnl} (365 days) |
| getPerformanceByDayOfWeek | Performance breakdown by day | Array of 7 items: {day, pnl, trades, wins, losses, winRate, avgPnl} |
| getPerformanceByHour | Performance breakdown by hour | Array of 24 items: {hour, pnl, trades, wins, losses, winRate, avgPnl} |
| getPerformanceBySession | Performance by trading session | Array of {name, start, end, color, pnl, trades, wins, losses, winRate, avgPnl} |
| getPerformanceByMonth | Monthly performance | Array of {month, pnl, trades, wins, losses, winRate, avgPnl} |
| getRiskMetrics | Risk analysis metrics | maxDrawdown, maxConsecutiveLosses, kellyPercentage, riskOfRuin, recoveryFactor, etc. |
| getEquityCurve | Cumulative P&L over time | Array of {date, cumulativePnl, drawdownPercent, tradeId, symbol} |
| getDrawdownHistory | Historical drawdown periods | Array of {magnitude, startDate, troughDate, recoveryDate, troughValue, recoveryValue} |
| getRMultipleDistribution | R-multiple distribution | buckets with counts and stats (total, avg, median, min, max) |
| getRiskRewardAnalysis | Risk/reward analysis | tradesWithStopLoss, rMultiples, plannedRRs, efficiencies, performance by planned RR |
| getPositionSizeAnalysis | Position size analysis | buckets with trades, wins, losses, totalPnl by size range |
| getPerformanceBySymbol | Performance by instrument | Array of {symbol, trades, wins, losses, winRate, pnl, avgPnl, profitFactor, stdDev} |
| getStreakAnalysis | Win/loss streak analysis | currentStreak, maxWinStreak, maxLossStreak, streakDistribution |
| getRevengeTrading | Revenge trading detection | afterWin, afterLoss, afterConsecutiveLosses, revengeIndicator |
| getOvertradingAnalysis | Overtrading detection | byTradeCount, optimalRange, overtradingThreshold, correlationScore |
| getHoldingTimeAnalysis | Holding time analysis | Array of {label, minMinutes, maxMinutes, trades, wins, losses, totalPnl, winRate, avgPnl} |
| getBehavioralPatterns | Behavioral analysis | tiltScore, disciplineScore, overtradingTendency, emotionalStateBreakdown |
| getMonteCarloSimulation | Monte Carlo simulation | percentiles, probabilityOfProfit, expectedValue, standardDeviation |

### Trades Router

| Endpoint | Description | Returns |
|----------|-------------|---------|
| getStats | Trade statistics summary | totalTrades, wins, losses, winRate, totalPnl, avgPnl, avgWin, avgLoss, profitFactor |
| getAll | Filtered trade list (paginated) | {items: Trade[], nextCursor} with full filter support |

### Accounts Router

| Endpoint | Description | Returns |
|----------|-------------|---------|
| getPropCompliance | Prop firm challenge/funded compliance metrics | drawdown {current, limit, type, used, remaining, status}, dailyLoss {todayPnl, limit, used, remaining, status}, profitTarget {current, target, progress, status}, consistency {maxDayPercent, limit, isCompliant}, tradingDays {daysTraded, minRequired, remaining, dates}, timeline {startDate, endDate, daysRemaining, daysElapsed}, equityCurve, overallStatus (safe/caution/danger), tradeStats {totalTrades, wins, losses, winRate, avgWin, avgLoss}, account info |

**Note:** accounts.getPropCompliance requires \`{ accountId: string }\` and only works for prop_challenge or prop_funded accounts. Use this when the trader asks about challenge progress, drawdown limits, profit targets, daily loss compliance, or probability of passing their prop challenge.

### Analytics Filter Schema

Most analytics endpoints accept these optional filters:
- **symbols**: string[] — Filter by trading symbols
- **dateRange**: { start?: Date, end?: Date } — Date range filter
- **daysOfWeek**: number[] — Filter by day of week (0-6)
- **hours**: number[] — Filter by hour (0-23)
- **sessions**: string[] — Filter by trading session names
- **strategies**: string[] — Filter by strategy IDs
- **tags**: string[] — Filter by tag IDs
- **rMultipleRange**: { min?: number, max?: number } — R-multiple range
- **positionSizeRange**: { min?: number, max?: number } — Position size range
- **outcome**: string — Filter by outcome (win, loss, breakeven)
- **reviewed**: boolean — Filter by review status
`.trim();

/**
 * Returns a comprehensive schema context string for AI system prompts.
 * This is a static string — generated once, not per-request.
 */
export function generateSchemaContext(): string {
	return SCHEMA_CONTEXT;
}
