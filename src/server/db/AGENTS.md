# Database Layer - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/backend/SKILL.md`

## Patterns

### Adding New Tables
**When:** Creating a new entity table
**How:** Define table with createTable(), add ID generator in src/lib/shared/id.ts, add relations, export types (Select + Insert). Don't forget to update parent table relations (e.g., users relations must include the new many() reference).

### AI Schema Structure
**When:** Working with AI entities
**How:** aiConversations → aiMessages (one-to-many), aiConversations → aiReports (one-to-many). Conversations have mode (chat/report) and status (active/generating/complete/failed). Reports track PDF generation status separately.

### Adding Environment Variables
**When:** Adding a new server-side env var (API keys, secrets)
**How:** Add to `src/env.js` in both `server` schema (with zod validation) AND `runtimeEnv` mapping. Use `z.string().min(1)` for required keys. Build with `SKIP_ENV_VALIDATION=1` to test without the key present.

## Gotchas

### db:push FK Name Truncation
**Problem:** NOTICE about truncated identifier for daily_checklist_check FK
**Solution:** Safe to ignore — PostgreSQL truncates identifiers over 63 chars automatically

### Biome Check Pre-existing Issues
**Problem:** `bun run check` fails on scripts/ralph/prd.command-center-dashboard.json formatting
**Solution:** Not a blocker — use `bunx biome check <specific-files>` to verify your changes only

## Decisions

### AI Report Status Separate from Conversation Status
**Choice:** aiReports has its own status enum (queued/generating/complete/failed)
**Why:** Reports have a different lifecycle than conversations — they go through PDF generation and email delivery stages
