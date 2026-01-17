# External Integrations

**Analysis Date:** 2025-01-17

## APIs & External Services

**Market Data - Futures:**
- Databento - CME, NYMEX, COMEX, CBOT futures OHLC data
  - SDK/Client: Native fetch to `https://hist.databento.com/v0/timeseries.get_range`
  - Auth: `DATABENTO_API_KEY` (Basic auth header)
  - Implementation: `src/lib/market-data/service.ts`
  - Symbols: Continuous contracts (e.g., `ES.v.0` for E-mini S&P)
  - Features: 1-minute bars, aggregation to 5min/15min/30min/1h/4h

**Market Data - Forex/Crypto:**
- Twelve Data - Forex pairs, crypto, commodities
  - SDK/Client: Native fetch to `https://api.twelvedata.com/time_series`
  - Auth: `TWELVE_DATA_API_KEY` (query param)
  - Implementation: `src/lib/market-data/service.ts`
  - Symbol mapping: `src/lib/market-data/symbols.ts`

**Background Jobs:**
- Trigger.dev - Async task processing
  - SDK: `@trigger.dev/sdk@4.3.2`
  - Auth: `TRIGGER_SECRET_KEY`
  - Config: `trigger.config.ts`
  - Tasks: `src/trigger/process-trade-maemfe.ts` (MAE/MFE calculation)
  - Project ID: `proj_marsyipkncnbpuycshht`
  - Features: Retry with exponential backoff, concurrency limiting

## Data Storage

**Database:**
- PostgreSQL (any provider)
  - Connection: `DATABASE_URL`
  - Client: Drizzle ORM + postgres.js
  - Schema: `src/server/db/schema.ts` (1070 lines, comprehensive)
  - Connection: `src/server/db/index.ts`
  - Features: Connection caching in development (HMR-safe)

**Market Data Cache:**
- PostgreSQL `candle_cache` table
  - Purpose: Cross-user deduplication of market data
  - Strategy: Cache-first, fetch on miss, store permanently
  - Key: symbol + interval + date (midnight UTC)

**File Storage:**
- S3-compatible storage (any provider)
  - Client: Bun's native `S3Client` (`src/lib/storage/s3.ts`)
  - Providers: AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces
  - Required vars: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`
  - Optional: `S3_PUBLIC_URL` (custom domain/CDN)
  - Usage: Presigned URLs for uploads, trade screenshots, journal attachments

**Caching:**
- React Query cache (client-side, in-memory)
- No Redis or external cache service

## Authentication & Identity

**Auth Provider:**
- Clerk
  - SDK: `@clerk/nextjs@6.36.0`
  - Frontend key: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - Backend key: `CLERK_SECRET_KEY`
  - Theme: `@clerk/themes` (dark theme)
  - Implementation:
    - Middleware: `src/middleware.ts` (route protection)
    - tRPC auth: `src/server/api/trpc.ts` (authMiddleware)
    - Components: `SignIn`, `SignUp`, `UserButton`
    - Route paths: `/sign-in`, `/sign-up`

**User Sync:**
- Database users table synced via Clerk webhooks
- First-login auto-sync in tRPC authMiddleware
- User data: clerkId, email, name, imageUrl, role

## Monitoring & Observability

**Error Tracking:**
- None configured (console.error only)

**Logs:**
- Console logging (development)
- No structured logging service

**Analytics:**
- None configured

## CI/CD & Deployment

**Hosting:**
- Not explicitly configured (Next.js compatible with Vercel, etc.)
- Requires Bun runtime support

**CI Pipeline:**
- GitHub (implied by `.git`)
- Greptile AI code review (mentioned in Ralph workflow)

**Deployment:**
- Database migrations: `bun run db:push`
- Build: `bun run build`
- Start: `bun run start`

## Environment Configuration

**Required env vars:**
```
# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...

# Market Data APIs
DATABENTO_API_KEY=...
TWELVE_DATA_API_KEY=...

# Background Jobs
TRIGGER_SECRET_KEY=...

# S3 Storage
S3_ENDPOINT=https://...
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=...
```

**Optional env vars:**
```
S3_PUBLIC_URL=https://cdn.example.com
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

**Secrets location:**
- `.env` file (gitignored)
- Environment validation at build time via `src/env.js`
- Skip validation with `SKIP_ENV_VALIDATION=true` (Docker builds)

## Webhooks & Callbacks

**Incoming:**
- Clerk user webhooks: `POST /api/webhooks/clerk`
  - Implementation: `src/app/api/webhooks/clerk/route.ts`
  - Events: `user.created`, `user.updated`, `user.deleted`
  - Verification: Svix signature validation
  - Secret: `CLERK_WEBHOOK_SECRET`

**Outgoing:**
- Trigger.dev task invocations (to Trigger.dev cloud)

## API Routers

**tRPC Routers:**
| Router | File | Purpose |
|--------|------|---------|
| accounts | `src/server/api/routers/accounts.ts` | Trading accounts CRUD |
| trades | `src/server/api/routers/trades.ts` | Trade management |
| analytics | `src/server/api/routers/analytics.ts` | Performance analytics |
| marketData | `src/server/api/routers/marketData.ts` | OHLC data, MAE/MFE |
| strategies | `src/server/api/routers/strategies.ts` | Strategy management |
| tags | `src/server/api/routers/tags.ts` | Trade tags |
| settings | `src/server/api/routers/settings.ts` | User preferences |
| filterPresets | `src/server/api/routers/filterPresets.ts` | Saved filter configs |
| dailyJournal | `src/server/api/routers/dailyJournal.ts` | Daily journal entries |
| storage | `src/server/api/routers/storage.ts` | S3 presigned URLs |

## Rate Limits & Quotas

**Databento:**
- Concurrency limited to 10 via Trigger.dev queue
- Historical data API (pay-per-use)

**Twelve Data:**
- Free tier: 800 API calls/day, 8 calls/minute
- Paid tiers available

**Trigger.dev:**
- Depends on plan (free tier: limited runs)
- Retry: 3 attempts with exponential backoff

**Clerk:**
- Depends on plan (free tier: 5,000 MAUs)

---

*Integration audit: 2025-01-17*
