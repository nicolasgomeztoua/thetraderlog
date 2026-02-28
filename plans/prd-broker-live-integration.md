# PRD: Broker Live Integration

> Research basis: Deep competitive analysis of Tradezella (13 direct auto-sync), TraderSync (50+ auto-sync),
> Tradervue (80+ direct sync), Edgewonk, TradesViz, Tradesyncer — plus direct API research on 14 brokers.
> Generated: 2026-02-18

---

## Overview

EdgeJournal currently requires manual CSV upload for every trade. Traders forget to journal, CSV exports are
tedious, and there is no automatic capture safety net. This feature adds **read-only live broker sync** that
automatically imports closed trades from a trader's broker into their EdgeJournal account — no manual export needed.

> **Note:** This PRD was written before the futures-only pivot. Forex-specific brokers (OANDA, MetaApi/MT4/MT5) and forex detection logic are no longer in scope.

Target audiences:
- **Futures prop traders** (Apex, Topstep, MyFundedFutures) on Tradovate, Rithmic, NinjaTrader
- **US equity/multi-asset traders** on TradeStation, Schwab, Webull

---

## Goals

- Auto-import closed trades from 10+ brokers/platforms covering ~90% of EdgeJournal's target users
- Eliminate manual CSV workflow for supported brokers
- Ensure zero credential exposure: read-only scopes, encrypted storage, never returned to frontend
- Match competitor coverage: Tradezella-level (13 auto-sync) in Phase 1, TraderSync-level (50+) via SnapTrade in Phase 3
- Clear "Connect Broker" UX with per-broker instructions and sync status

---

## Architecture Overview

```
User Settings → brokerConnections table (encrypted creds)
                         │
              ┌──────────┴──────────┐
              │   Sync Engine       │
              │  (tRPC mutation +   │
              │   daily cron)       │
              └──────────┬──────────┘
                         │ calls
        ┌────────────────┼────────────────┐
        │                │                │
  BrokerAdapter    BrokerAdapter    BrokerAdapter
   (Tradovate)      (IBKR Flex)      (MetaApi)
        │                │                │
  ParsedTrade[]    ParsedTrade[]    ParsedTrade[]
        │
  Existing trade import pipeline (dedup via hash)
```

**Connection methods by broker:**
| Broker | Method | Auth |
|--------|--------|------|
| Tradovate | REST + WebSocket | API key (cid + sec + deviceId) |
| IBKR | Flex Web Service HTTP | Flex Token + Query ID |
| OANDA | REST v20 | Bearer token (Personal Access Token) |
| MetaApi → MT4/5 | REST + WebSocket (cloud) | MetaApi token + broker login |
| TopstepX/ProjectX | REST + WebSocket | API Key → JWT |
| TradeStation | REST | OAuth 2.0 (access + refresh token) |
| Charles Schwab | REST | OAuth 2.0 (access + refresh token) |
| SnapTrade (aggregator) | REST | OAuth 2.0 per-user connection |
| NinjaTrader | CSV parser (v1); local bridge (v2) | N/A for CSV |
| Rithmic | CSV parser (v1); R\|Protocol API (v2) | N/A for CSV |

---

## User Stories

---

### US-000: Audit Existing Utilities Before Broker Integration

**Description**: As a developer, I want to audit the existing codebase before implementing broker integration
so that we reuse existing utilities and avoid duplicating trade import, deduplication, and parsing logic.

**Acceptance Criteria**:
- [ ] Read `src/lib/trades/csv-parsers/types.ts` — confirm `ParsedTrade` is the canonical format for all adapters
- [ ] Read `src/lib/trades/hash.ts` — confirm trade hash/dedup mechanism and document its API in `scripts/ralph/progress.txt`
- [ ] Read `src/lib/trades/csv-parsers/index.ts` — document existing parsers (MT4, MT5, ProjectX done; NinjaTrader null)
- [ ] Check `src/server/db/schema.ts` for `importSourceEnum`, `tradingPlatformEnum`, and `accounts` table structure
- [ ] Search for any existing broker connection or OAuth utilities in `src/lib/`
- [ ] Check `src/server/api/routers/` for any existing sync or import router
- [ ] Document findings in `scripts/ralph/progress.txt`:
  - `ParsedTrade` interface location and fields
  - Hash/dedup utility API
  - Enums that need new values
  - What's missing (encryption utility, broker adapter interface, new tables)
- [ ] Typecheck passes (`bun run check`)

---

### US-001: Schema — Broker Connections Table

**Description**: As a developer, I want a `broker_connections` table in the database so that users can securely
store their broker credentials for auto-sync.

**Acceptance Criteria**:
- [ ] New enum `brokerProviderEnum` added to `schema.ts` with values:
  `tradovate | ibkr | oanda | metaapi | topstepx | tradestation | schwab | snaptrade | rithmic | ninjatrader`
- [ ] New enum `brokerConnectionStatusEnum` added: `active | error | disconnected | pending`
- [ ] `broker_connections` table in `schema.ts` with fields:
  - `id` (text, PK, `ids.brokerConnection()` prefix `bcon_`)
  - `userId` (text, FK → users.id, cascade delete)
  - `accountId` (text, FK → accounts.id, cascade delete, nullable — connection can be account-level)
  - `provider` (brokerProviderEnum, not null)
  - `label` (text, nullable — user-defined nickname)
  - `encryptedCredentials` (text, not null — AES-256-GCM encrypted JSON blob)
  - `credentialIv` (text, not null — initialization vector for decryption)
  - `status` (brokerConnectionStatusEnum, default `pending`)
  - `lastSyncAt` (timestamp with timezone, nullable)
  - `lastSyncError` (text, nullable)
  - `syncedTradeCount` (integer, default 0)
  - `createdAt`, `updatedAt` (timestamps)
- [ ] Index on `(userId)` and `(accountId)`
- [ ] `brokerConnectionsRelations` defined (belongs to user, belongs to account)
- [ ] `importSourceEnum` updated to include `"broker_sync"` value
- [ ] `tradingPlatformEnum` updated to include `"tradovate" | "ibkr" | "rithmic"` (for future account platform tracking)
- [ ] `bun run db:push` succeeds
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: Schema — Broker Sync Logs Table

**Description**: As a developer, I want a `broker_sync_logs` table so that we can track sync history, errors,
and trade counts per sync run for debugging and user transparency.

**Acceptance Criteria**:
- [ ] New enum `syncResultEnum` added: `success | partial | failed`
- [ ] `broker_sync_logs` table in `schema.ts`:
  - `id` (text, PK, `ids.syncLog()` prefix `slog_`)
  - `connectionId` (text, FK → broker_connections.id, cascade delete)
  - `userId` (text, FK → users.id, cascade delete)
  - `result` (syncResultEnum, not null)
  - `tradesImported` (integer, default 0)
  - `tradesSkipped` (integer, default 0 — already-imported trades)
  - `errorMessage` (text, nullable)
  - `duration` (integer, nullable — ms)
  - `syncedAt` (timestamp with timezone, not null, default now)
- [ ] Index on `(connectionId)` and `(userId, syncedAt)` for history queries
- [ ] `ids.syncLog()` and `ids.brokerConnection()` added to `src/lib/shared/id.ts`
- [ ] `bun run db:push` succeeds
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Credential Encryption Utility

**Description**: As a developer, I want an encryption utility for broker credentials so that API keys and
OAuth tokens are never stored in plaintext in the database.

**Acceptance Criteria**:
- [ ] New file `src/lib/brokers/encryption.ts` created
- [ ] Uses Node.js built-in `crypto` module (AES-256-GCM)
- [ ] `BROKER_ENCRYPTION_KEY` env var (32-byte hex string) used as key — documented in `.env.example`
- [ ] Exports:
  - `encryptCredentials(data: Record<string, string>): { encrypted: string; iv: string }`
  - `decryptCredentials(encrypted: string, iv: string): Record<string, string>`
- [ ] Both functions throw typed errors on failure (not expose raw crypto errors)
- [ ] Unit test in `tests/unit/broker-encryption.test.ts` verifies round-trip encrypt/decrypt
- [ ] `BROKER_ENCRYPTION_KEY` added to `.env.example` with generation instructions
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Broker Adapter Interface

**Description**: As a developer, I want a `BrokerAdapter` interface that all broker integrations implement
so that the sync engine can work uniformly across all broker types.

**Acceptance Criteria**:
- [ ] New file `src/lib/brokers/types.ts` created with:
  ```typescript
  interface BrokerAdapter {
    provider: BrokerProvider; // from schema enum
    name: string;
    description: string;
    authType: 'api_key' | 'oauth2' | 'flex_token' | 'bearer_token' | 'metaapi';
    // Validate that stored credentials have required fields
    validateCredentials(credentials: Record<string, string>): boolean;
    // Fetch closed trades since a given date (or all if null)
    fetchClosedTrades(credentials: Record<string, string>, since?: Date): Promise<ParsedTrade[]>;
    // Test connection and return account info
    testConnection(credentials: Record<string, string>): Promise<{ success: boolean; accountId?: string; error?: string }>;
  }
  ```
- [ ] `BrokerProvider` type exported (union of all enum values)
- [ ] `BrokerCredentials` type exported per broker (discriminated union or per-broker types)
- [ ] `src/lib/brokers/registry.ts` created: maps provider → adapter instance
- [ ] `src/lib/brokers/index.ts` created: barrel exports
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: NinjaTrader CSV Parser

**Description**: As a trader, I want to upload my NinjaTrader 8 trade performance CSV so that my NinjaTrader
trades are imported without a live API connection.

**Note**: This completes the stubbed `ninjatrader: null` entry in the parser registry.

**NT8 CSV format**: "Trade Performance" export has columns: `Entry time`, `Exit time`, `Instrument`,
`Market pos.`, `Qty`, `Entry price`, `Exit price`, `Profit`, `Cum. profit`, `Commission`, `MAE`, `MFE`

**Acceptance Criteria**:
- [ ] `src/lib/trades/csv-parsers/ninjatrader-parser.ts` created implementing `CSVParser`
- [ ] `validateHeaders()` detects NT8 Trade Performance CSV headers (case-insensitive, flexible)
- [ ] `parse()` handles:
  - Direction: "Long" / "Short" from `Market pos.` column
  - Symbol extraction from `Instrument` (e.g., "ES 03-25" → symbol "ES", futures type)
  - Entry/Exit time parsed from NT8 date format (`MM/DD/YYYY HH:MM:SS` or similar)
  - P&L, commission, quantity extracted
  - `externalId` generated from entry time + symbol + direction hash if no ID column
- [ ] Parser registered in `src/lib/trades/csv-parsers/index.ts` (replaces `null`)
- [ ] `getSupportedPlatforms()` updated to include NinjaTrader
- [ ] Test file `tests/unit/ninjatrader-parser.test.ts` with a sample NT8 CSV fixture
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Rithmic CSV Parser

**Description**: As a prop trader (Apex, MyFundedFutures), I want to upload my Rithmic R|Trader Pro order
history CSV so that my Rithmic-platform trades are imported without a live API connection.

**Rithmic CSV format** (R|Trader Pro "Recent Orders" export): `Order#`, `Date`, `Time`, `B/S`, `Symbol`,
`Exchange`, `Qty`, `Price`, `Commission`, `Status`, `Account`

**Acceptance Criteria**:
- [ ] `src/lib/trades/csv-parsers/rithmic-parser.ts` created implementing `CSVParser`
- [ ] `validateHeaders()` detects Rithmic R|Trader Pro CSV headers
- [ ] `parse()` handles:
  - Pairs buy/sell orders into complete trades (by symbol + date proximity matching)
  - Direction: "B" → long, "S" → short
  - Symbol recognized as futures (ES, NQ, CL, GC, etc.)
  - Date + Time columns merged into ISO timestamp
  - Fill price extracted as entry/exit price
  - Commission per fill
  - Skips cancelled/rejected orders (Status != "Filled" or "Partially Filled")
- [ ] `TradingPlatform` type in `types.ts` updated to include `"rithmic"`
- [ ] Parser registered in `index.ts`
- [ ] `getSupportedPlatforms()` updated to include Rithmic
- [ ] Test file `tests/unit/rithmic-parser.test.ts` with sample Rithmic CSV fixtures (including partial fills)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Tradovate Broker Adapter

**Description**: As a developer, I want a Tradovate adapter so that users can connect their Tradovate account
and have closed trades automatically synced to EdgeJournal.

**API**: Tradovate REST API (`https://live.tradovateapi.com/v1/`)
**Auth**: POST `/auth/accesstokenrequest` with `{name, password, appId, appVersion, deviceId, cid, sec}`
**Credentials stored**: `{ cid, sec, username, password, deviceId }`
**Closed trades**: GET `/order/list` + `/fill/list` to reconstruct completed trades
**Token lifetime**: 90 minutes, auto-renew via `/auth/renewAccessToken`

**Acceptance Criteria**:
- [ ] `src/lib/brokers/adapters/tradovate.ts` created implementing `BrokerAdapter`
- [ ] `testConnection()`: authenticates and returns accountId
- [ ] `fetchClosedTrades()`:
  - Authenticates with stored credentials
  - Fetches fills/orders from Tradovate REST API
  - Reconstructs `ParsedTrade[]` from fill pairs (entry + exit)
  - Maps Tradovate symbol (e.g., "ESH5") to canonical symbol ("ES") with futures instrument type
  - Respects `since` date filter to avoid re-fetching all history on every sync
- [ ] Registered in `src/lib/brokers/registry.ts`
- [ ] Returns typed errors (not raw HTTP errors) on auth failure, rate limit, network error
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: IBKR Flex Web Service Adapter

**Description**: As a developer, I want an IBKR Flex Web Service adapter so that Interactive Brokers users
can sync their closed trades daily using a Flex Token.

**API**: `https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest`
**Auth**: Flex Token (numeric) + Query ID (numeric) — user generates both in IBKR Client Portal
**Flow**: (1) POST request URL → receive `ReferenceCode`. (2) Poll GET statement URL with ReferenceCode → XML response
**Credentials stored**: `{ flexToken, queryId }`
**Data**: Trades XML with `<Trade>` elements — symbol, buy/sell, qty, price, dateTime, ibOrderID, commission, proceeds

**Acceptance Criteria**:
- [ ] `src/lib/brokers/adapters/ibkr.ts` created implementing `BrokerAdapter`
- [ ] `testConnection()`: sends a test request and verifies token validity
- [ ] `fetchClosedTrades()`:
  - Two-step Flex request (SendRequest → poll for statement)
  - Polls up to 5 times with 3-second delay between attempts
  - Parses XML `<Trade>` elements (using built-in XML parsing, not a library)
  - Maps IBKR symbols + assetCategory to `ParsedTrade` (futures vs forex detection)
  - Filters by `since` date on the XML data
- [ ] Registered in `src/lib/brokers/registry.ts`
- [ ] Handles IBKR-specific errors (token expired, statement not ready, server busy)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-009: OANDA REST Adapter

**Description**: As a developer, I want an OANDA REST v20 adapter so that forex traders can sync their OANDA
trades automatically with just a Personal Access Token.

**API**: `https://api-fxtrade.oanda.com/v3/accounts/{accountId}/trades?state=CLOSED`
**Auth**: Bearer token (Personal Access Token from OANDA Account Management portal)
**Credentials stored**: `{ accessToken, accountId }`

**Acceptance Criteria**:
- [ ] `src/lib/brokers/adapters/oanda.ts` created implementing `BrokerAdapter`
- [ ] `testConnection()`: calls `/v3/accounts/{accountId}/summary` to verify token
- [ ] `fetchClosedTrades()`:
  - GET `/v3/accounts/{accountId}/trades?state=CLOSED&count=500`
  - Handles pagination via `beforeID` cursor parameter
  - Maps OANDA trade fields to `ParsedTrade` (instrument, openedTime, closeTime, price, currentUnits, realizedPL, financing)
  - OANDA instrument format `EUR_USD` → canonical symbol `EURUSD`, forex instrument type
  - Respects `since` date filter
- [ ] Registered in `src/lib/brokers/registry.ts`
- [ ] Handles OANDA v20 errors (401 Unauthorized, 404 account not found)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010: MetaApi Adapter (MT4/MT5 Cloud Bridge)

**Description**: As a developer, I want a MetaApi adapter so that MT4/MT5 traders (FTMO, IC Markets, Pepperstone,
etc.) can sync trades without installing an Expert Advisor or running desktop software.

**Service**: MetaApi cloud (`https://mt-client-api-v1.london.agiliumtrade.ai`)
**SDK**: `metaapi.cloud-sdk` npm package
**Auth**: MetaApi auth token (JWT) + MetaTrader account ID on MetaApi
**Credentials stored**: `{ metaapiToken, metaapiAccountId }`
**Data**: MetaStats API provides deal history — `metaapiAccount.getHistoryStorage().getDealsByTimeRange()`

**Acceptance Criteria**:
- [ ] `metaapi.cloud-sdk` added to dependencies (`bun add metaapi.cloud-sdk`)
- [ ] `src/lib/brokers/adapters/metaapi.ts` created implementing `BrokerAdapter`
- [ ] `testConnection()`: initializes MetaApi connection, verifies account state = "DEPLOYED"
- [ ] `fetchClosedTrades()`:
  - Uses MetaStats API to get closed positions/deals since `since` date
  - Maps MetaApi deal format to `ParsedTrade` (symbol, type: "DEAL_TYPE_BUY"/"SELL", volume, price, profit, commission, swap, time)
  - Groups deals into trades (entry + exit pairs by positionId)
  - Instrument type: forex by default for MT4/5 symbols
- [ ] Registered in `src/lib/brokers/registry.ts`
- [ ] `METAAPI_TOKEN` env var documented in `.env.example` (server-side MetaApi token, not user's)
- [ ] Handles MetaApi errors gracefully (account not deployed, connection timeout)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-011: TopstepX / ProjectX Live API Adapter

**Description**: As a developer, I want a TopstepX live API adapter so that Topstep traders can sync trades
in real-time via the ProjectX gateway API (separate from the existing CSV parser).

**Note**: ProjectX CSV parser already exists. This adds the live API adapter for auto-sync.
**API**: `https://api.topstepx.com/api` (REST) + `wss://realtime.topstepx.com/api` (WebSocket/SignalR)
**Auth**: POST `/api/Auth/loginKey` with `{ userName, apiKey }` → JWT session token
**Credentials stored**: `{ apiKey, username }`
**Closed trades**: GET `/api/Order/search` with `{ accountId, startTimestamp, endTimestamp }`

**Acceptance Criteria**:
- [ ] `src/lib/brokers/adapters/topstepx.ts` created implementing `BrokerAdapter`
- [ ] `testConnection()`: authenticates via `/api/Auth/loginKey`, verifies JWT, returns accountId
- [ ] `fetchClosedTrades()`:
  - Authenticates to get JWT session token
  - GET `/api/Order/search` with date range parameters
  - Filters for filled orders only
  - Pairs buy/sell filled orders into complete trades by symbol + timestamp proximity
  - Maps to `ParsedTrade` (symbol, direction, qty, avgFillPrice, commission)
  - Futures instrument type (TopstepX is futures-only)
- [ ] Registered in `src/lib/brokers/registry.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012: OAuth 2.0 Infrastructure (Callback Routes + Token Storage)

**Description**: As a developer, I want OAuth 2.0 callback infrastructure so that TradeStation and Schwab
can be connected via the standard authorization code flow without storing user passwords.

**Acceptance Criteria**:
- [ ] `src/app/api/brokers/oauth/[provider]/route.ts` created:
  - GET: initiate OAuth flow — redirects to broker authorization URL with `state` param (CSRF token)
  - Stores `state` in signed cookie (short-lived, 10 min)
- [ ] `src/app/api/brokers/oauth/[provider]/callback/route.ts` created:
  - GET: receives `code` + `state` from broker redirect
  - Validates `state` CSRF cookie
  - Exchanges `code` for `{ access_token, refresh_token, expires_in }` via broker token endpoint
  - Encrypts and stores tokens in `broker_connections` table
  - Redirects to `/settings/brokers?connected=true`
- [ ] `src/lib/brokers/oauth.ts` utility with:
  - `buildAuthorizationUrl(provider, redirectUri, scopes, state): string`
  - `exchangeCodeForTokens(provider, code, redirectUri): Promise<OAuthTokens>`
  - `refreshAccessToken(provider, refreshToken): Promise<OAuthTokens>`
- [ ] Supported providers in OAuth utility: `tradestation | schwab`
- [ ] `TRADESTATION_CLIENT_ID`, `TRADESTATION_CLIENT_SECRET`, `SCHWAB_CLIENT_ID`, `SCHWAB_CLIENT_SECRET`
  added to `.env.example`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-013: TradeStation OAuth Adapter

**Description**: As a developer, I want a TradeStation broker adapter so that TradeStation futures/options
traders can connect via OAuth and have trades synced automatically.

**API**: `https://api.tradestation.com/v3/`
**Auth**: OAuth 2.0 — access token (20 min) + refresh token. Credentials stored: encrypted OAuth tokens.
**Closed trades**: GET `/v3/brokerage/accounts/{accountID}/historicalorders`

**Acceptance Criteria**:
- [ ] `src/lib/brokers/adapters/tradestation.ts` created implementing `BrokerAdapter`
- [ ] `testConnection()`: calls `/v3/brokerage/accounts` to verify token validity, returns account list
- [ ] `fetchClosedTrades()`:
  - Auto-refreshes access token if expired (using stored refresh token via `refreshAccessToken()`)
  - GET `/v3/brokerage/accounts/{accountId}/historicalorders?since={since}`
  - Filters filled orders
  - Maps TradeStation order fields to `ParsedTrade` (Symbol, BuySell, QuantityFilled, AverageFillPrice, OpenedDateTime, ClosedDateTime, Commission)
  - Detects futures vs forex vs equity by asset type
- [ ] Registered in `src/lib/brokers/registry.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-014: Schwab OAuth Adapter

**Description**: As a developer, I want a Charles Schwab (thinkorswim) broker adapter so that Schwab traders
can connect via OAuth and have trades synced automatically.

**API**: `https://api.schwabapi.com/trader/v1/`
**Auth**: OAuth 2.0. Access token: 30 min. Refresh token: 7 days. Credentials stored: encrypted OAuth tokens.
**Closed trades**: GET `/trader/v1/accounts/{accountHash}/orders?status=FILLED`

**Acceptance Criteria**:
- [ ] `src/lib/brokers/adapters/schwab.ts` created implementing `BrokerAdapter`
- [ ] `testConnection()`: calls `/trader/v1/accounts` to verify token
- [ ] `fetchClosedTrades()`:
  - Auto-refreshes expired access token
  - GET `/trader/v1/accounts/{accountHash}/orders?status=FILLED&fromEnteredTime={since}`
  - Maps Schwab order fields to `ParsedTrade` (instrument symbol, orderLegCollection direction, quantity, price, enteredTime, closeTime, fees)
  - Detects futures vs equity by instrument type field
- [ ] Registered in `src/lib/brokers/registry.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-015: SnapTrade Aggregator Adapter

**Description**: As a developer, I want a SnapTrade integration so that users of 25+ brokerages (Fidelity,
E*Trade, Questrade, Coinbase, Webull, etc.) can connect via a single OAuth-based aggregator without EdgeJournal
needing individual integrations for each.

**Service**: SnapTrade REST API (`https://api.snaptrade.com/api/v1`)
**Auth**: Per-app consumer key + consumer secret (server-side). Per-user OAuth connection via SnapTrade portal.
**Coverage**: 25+ brokerages including Fidelity, E*Trade, Questrade, Webull, Coinbase, and more.
**Credentials stored**: `{ snaptradeUserId, userSecret }` (SnapTrade's per-user credentials, not broker credentials)

**Acceptance Criteria**:
- [ ] `snaptrade` npm package or SnapTrade REST calls added (`bun add snaptrade`)
- [ ] `src/lib/brokers/adapters/snaptrade.ts` created implementing `BrokerAdapter`
- [ ] `src/app/api/brokers/snaptrade/register/route.ts`: creates SnapTrade user, returns redirect URL for broker OAuth
- [ ] `src/app/api/brokers/snaptrade/callback/route.ts`: stores `userId` + `userSecret` after SnapTrade OAuth
- [ ] `fetchClosedTrades()`:
  - GET `/api/v1/activities` filtered by `type=DIVIDEND,BUY,SELL` and date range
  - Maps to `ParsedTrade`
- [ ] `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY` added to `.env.example`
- [ ] Registered in `src/lib/brokers/registry.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-016: brokerConnections tRPC Router — CRUD

**Description**: As a frontend, I want tRPC procedures to manage broker connections so that users can add,
list, test, and remove their broker integrations.

**Acceptance Criteria**:
- [ ] `src/server/api/routers/brokerConnections.ts` created with `protectedProcedure` for all:
  - `list` query: returns all connections for authenticated user (credentials NEVER included in response)
  - `create` mutation: validates credentials format, calls `adapter.testConnection()`, encrypts credentials, inserts row; returns connection without creds
  - `delete` mutation: validates user owns connection, deletes row + associated sync logs
  - `testConnection` mutation: decrypts credentials, calls `adapter.testConnection()`, returns `{ success, error? }`
- [ ] Error handling uses constants from `src/lib/constants/errors.ts` (add new `ERR_BROKER_*` constants)
- [ ] Router registered in `src/server/api/root.ts`
- [ ] All mutations return full objects (not just IDs) for optimistic UI updates
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-017: Integration Tests — brokerConnections Router

**Description**: As a developer, I want integration tests for the brokerConnections router so that we verify
connection CRUD operations are secure and correct.

**Acceptance Criteria**:
- [ ] `tests/integration/broker-connections.test.ts` created
- [ ] Uses `setupTrader()` fixture
- [ ] Tests:
  - `list` returns empty array for new user
  - `create` stores connection (no credentials in response)
  - `create` rejects invalid credentials format (missing required fields per provider)
  - `delete` removes connection
  - `delete` rejects deletion of another user's connection (ownership validation)
  - `testConnection` returns success/error status (mock adapter or use OANDA demo if possible)
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-018: Sync Engine — tRPC Mutation + Trade Deduplication

**Description**: As a developer, I want a `sync` tRPC mutation that fetches new trades from a broker adapter,
deduplicates against existing trades, and imports only new ones so that repeated syncs are idempotent.

**Acceptance Criteria**:
- [ ] `sync` mutation added to `brokerConnections` router:
  - Input: `{ connectionId: string, accountId: string }`
  - Validates user owns both connection and account
  - Decrypts credentials
  - Calls `adapter.fetchClosedTrades(credentials, connection.lastSyncAt ?? undefined)`
  - For each `ParsedTrade`: generates hash (using existing `src/lib/trades/hash.ts`), checks if hash exists in `trades` table
  - Inserts only new (non-duplicate) trades via existing trade import pipeline
  - Sets `importSource = "broker_sync"` on imported trades
  - Updates `broker_connections.lastSyncAt`, `syncedTradeCount`
  - Inserts `broker_sync_logs` row with result
  - Returns `{ imported: number; skipped: number; errors: string[] }`
- [ ] `syncAll` mutation: syncs all active connections for the user (calls `sync` for each)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-019: Integration Tests — Sync Engine

**Description**: As a developer, I want integration tests for the sync engine so that we verify deduplication,
error handling, and log insertion work correctly.

**Acceptance Criteria**:
- [ ] `tests/integration/broker-sync.test.ts` created
- [ ] Uses mocked broker adapter that returns deterministic `ParsedTrade[]`
- [ ] Tests:
  - First sync imports all returned trades
  - Second sync with same trades → 0 imported, all skipped (deduplication)
  - Sync with 1 new + 2 existing → 1 imported, 2 skipped
  - Failed adapter call → `broker_sync_logs` row with `result: "failed"`, `lastSyncError` updated
  - `syncAll` triggers sync for all active connections
  - Unauthorized `sync` call rejected (wrong user owns connection)
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-020: Broker Connections Settings Page — Shell

**Description**: As a trader, I want a "Connected Brokers" settings page so that I can see all my broker
connections and manage them in one place.

**Acceptance Criteria**:
- [ ] New route: `src/app/(protected)/settings/brokers/page.tsx`
- [ ] Navigation link added to settings sidebar (or equivalent nav)
- [ ] Page shell renders with:
  - Page title: "CONNECTED BROKERS" (monospace, chartreuse accent)
  - Subtitle: "Auto-sync closed trades from your broker accounts"
  - "ADD CONNECTION" button (chartreuse, top right)
  - Empty state: "No broker connections. Add one to start auto-syncing trades." with icon
  - Connection cards area (renders `<BrokerConnectionCard />` list — placeholder if list empty)
- [ ] Page uses `api.brokerConnections.list` tRPC query
- [ ] Terminal design system styling (bg-background, monospace fonts, chartreuse accent)
- [ ] `data-testid` on: page container, add button, empty state, connection list
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: page renders, nav link works

---

### US-021: Add Broker Connection Modal — API Key / Token Flow

**Description**: As a trader, I want to add a broker connection by entering my API credentials so that I can
connect to brokers that use API keys, Flex tokens, or bearer tokens (Tradovate, IBKR, OANDA, TopstepX).

**Acceptance Criteria**:
- [ ] `<AddBrokerConnectionModal />` component created
- [ ] Step 1 — Broker selector: grid of broker cards with logo, name, connection method badge (API Key / OAuth / Flex Token)
  - Include: Tradovate, IBKR, OANDA, TopstepX, MetaApi (MT4/5), NinjaTrader (CSV), Rithmic (CSV)
- [ ] Step 2 — Credentials form: per-broker dynamic fields:
  - Tradovate: Client ID, Secret, Username, Password, Device ID
  - IBKR: Flex Token, Query ID (with link to setup instructions)
  - OANDA: Personal Access Token, Account ID
  - TopstepX: API Key, Username
  - MetaApi: MetaApi Token, MetaApi Account ID
- [ ] Step 3 — Test & Save: shows spinner while calling `testConnection`, shows success/error result before saving
- [ ] On success: closes modal, refreshes connection list, shows toast "Broker connected successfully"
- [ ] Each credential field: `type="password"` with show/hide toggle
- [ ] Per-broker help text with link to instructions for generating credentials
- [ ] `data-testid` on all key elements
- [ ] Terminal design system styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: full add flow works for at least one broker

---

### US-022: OAuth Connection Flow UI

**Description**: As a trader, I want to connect TradeStation or Schwab via OAuth so that I never have to
share my broker login credentials with EdgeJournal.

**Acceptance Criteria**:
- [ ] Broker selector (US-021) includes TradeStation and Schwab with "Connect via OAuth" badge
- [ ] Clicking Connect for OAuth brokers: redirects to `/api/brokers/oauth/[provider]` (initiates OAuth flow)
- [ ] After successful OAuth callback: redirected to `/settings/brokers?connected=true`
- [ ] `?connected=true` query param triggers success toast on page load
- [ ] OAuth connection card appears in list (same card as API key connections)
- [ ] SnapTrade connections show a "Connect via SnapTrade" flow with redirect
- [ ] Error state: if OAuth fails, redirect to `/settings/brokers?error=oauth_failed` with error message
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: OAuth flow for at least one provider (can use TradeStation sandbox/demo)

---

### US-023: Broker Connection Card + Manual Sync UI

**Description**: As a trader, I want to see the status of each broker connection and trigger a manual sync
so that I can refresh my trades on demand.

**Acceptance Criteria**:
- [ ] `<BrokerConnectionCard />` component created, displays:
  - Broker logo/icon + name
  - Status badge: `ACTIVE` (green), `ERROR` (red), `DISCONNECTED` (gray)
  - Last sync time: "Last synced 2h ago" (relative time) or "Never synced"
  - Total trades synced count
  - "SYNC NOW" button — calls `sync` mutation, shows spinner, updates on complete
  - "DISCONNECT" button — confirms then calls `delete` mutation
- [ ] After "SYNC NOW": inline result shows "Imported 3 trades, 12 skipped" or error message
- [ ] "SYNC NOW" disabled during active sync (loading state)
- [ ] Error state: if `lastSyncError` exists, shows error icon + truncated error message with tooltip for full text
- [ ] `data-testid` on: card, status badge, sync button, disconnect button, sync result
- [ ] Terminal design system styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: cards render, sync works end-to-end

---

### US-024: Sync Activity Log UI

**Description**: As a trader, I want to see a sync history for each broker connection so that I can
understand what was imported and debug any sync failures.

**Acceptance Criteria**:
- [ ] `syncHistory` query added to `brokerConnections` router: returns last 20 `broker_sync_logs` for a connection
- [ ] `<SyncHistoryDrawer />` component: opens on "View History" link on connection card
- [ ] Drawer shows table with columns: Date, Result (SUCCESS/PARTIAL/FAILED badge), Imported, Skipped, Duration
- [ ] Failed rows show error message in expandable row
- [ ] Empty state: "No sync history yet"
- [ ] Drawer closes on Escape or backdrop click
- [ ] `data-testid` on: open history button, drawer, table rows, close button
- [ ] Terminal design system styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: history drawer opens, shows sync logs

---

### US-025: E2E Tests — Broker Connections UI

**Description**: As a developer, I want E2E tests for the broker connections UI so that the full connection
and sync flow is verified end-to-end.

**Acceptance Criteria**:
- [ ] `tests/e2e/broker-connections.spec.ts` created
- [ ] All new UI elements have `data-testid` attributes (verify US-020 through US-024)
- [ ] Tests:
  - Navigate to `/settings/brokers` — page loads, empty state visible
  - Open "Add Connection" modal — broker selector renders with expected brokers
  - Select OANDA — credential form shows Access Token + Account ID fields
  - Fill invalid credentials → test connection shows error
  - (With mock/stub) fill valid credentials → success message, connection card appears
  - Click "SYNC NOW" on connection card → loading state shows, result displays
  - Click "DISCONNECT" → confirmation dialog → connection removed from list
  - Click "View History" → drawer opens with sync logs
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Functional Requirements

1. **FR-001**: All broker credentials encrypted at rest using AES-256-GCM before database storage
2. **FR-002**: Credentials NEVER returned to the frontend after initial connection
3. **FR-003**: All connections are read-only — EdgeJournal must never place orders on behalf of users
4. **FR-004**: Sync is idempotent — re-syncing never creates duplicate trades (hash-based dedup)
5. **FR-005**: `importSource = "broker_sync"` set on all auto-synced trades for auditability
6. **FR-006**: Each sync run logged to `broker_sync_logs` with imported/skipped counts and duration
7. **FR-007**: Failed syncs update `broker_connections.lastSyncError` and status to `"error"`
8. **FR-008**: Successful syncs update `lastSyncAt` and reset status to `"active"`
9. **FR-009**: Users can have multiple connections (different brokers, different accounts)
10. **FR-010**: OAuth tokens auto-refreshed before expiry (TradeStation, Schwab)

---

## Non-Goals (Out of Scope)

- **Order placement** — EdgeJournal is a journal, not a trading platform
- **Real-time streaming / live P&L** — sync is batch-based (daily or on-demand)
- **Rithmic R|Protocol API** — requires manual approval from Rithmic; CSV is v1, API is v2 (future)
- **NinjaTrader live bridge** — local agent software is Phase 2; CSV is v1
- **cTrader / DXtrade direct API** — covered by MetaApi cloud for MT-adjacent brokers
- **Forex.com / GAIN Capital direct API** — requires manual sales contact, not self-serve
- **Crypto exchanges (Coinbase/Binance)** — covered by SnapTrade aggregator
- **Position monitoring / live P&L** — out of scope, journaling only
- **Automatic background cron sync** — manual sync + on-login sync in v1; scheduled cron in v2

---

## Technical Considerations

### New Files
```
src/lib/brokers/
├── types.ts              # BrokerAdapter interface, BrokerProvider type
├── encryption.ts         # AES-256-GCM encrypt/decrypt
├── oauth.ts              # OAuth 2.0 utilities
├── registry.ts           # Provider → adapter mapping
├── index.ts              # Barrel exports
└── adapters/
    ├── tradovate.ts
    ├── ibkr.ts
    ├── oanda.ts
    ├── metaapi.ts
    ├── topstepx.ts
    ├── tradestation.ts
    ├── schwab.ts
    └── snaptrade.ts

src/lib/trades/csv-parsers/
├── ninjatrader-parser.ts  # Completes stubbed entry
└── rithmic-parser.ts      # New

src/server/api/routers/
└── brokerConnections.ts   # New router

src/app/(protected)/settings/brokers/
└── page.tsx               # New settings page

src/app/api/brokers/
├── oauth/[provider]/route.ts
├── oauth/[provider]/callback/route.ts
└── snaptrade/
    ├── register/route.ts
    └── callback/route.ts
```

### Schema Changes
- 2 new tables: `broker_connections`, `broker_sync_logs`
- 2 new enums: `broker_provider`, `broker_connection_status`, `sync_result`
- Updated enums: `import_source` (add `broker_sync`), `trading_platform` (add `tradovate`, `ibkr`, `rithmic`)

### New Env Vars
```
BROKER_ENCRYPTION_KEY=        # 32-byte hex, generate with: openssl rand -hex 32
METAAPI_TOKEN=                # Server-side MetaApi auth token
TRADESTATION_CLIENT_ID=
TRADESTATION_CLIENT_SECRET=
SCHWAB_CLIENT_ID=
SCHWAB_CLIENT_SECRET=
SNAPTRADE_CLIENT_ID=
SNAPTRADE_CONSUMER_KEY=
```

### Trade Import Pipeline Integration
- All adapters return `ParsedTrade[]` — same type used by CSV parsers
- Sync engine reuses the existing trade creation logic from the `trades` router
- Hash-based deduplication via `src/lib/trades/hash.ts` (audit US-000 to confirm)
- `importSource` set to `"broker_sync"` (new enum value)

---

## Design Considerations

- **Terminal design system** throughout (dark theme, chartreuse accents, monospace)
- **Status badges**: `ACTIVE` (profit green `#00ff88`), `ERROR` (loss red `#ff3b3b`), `DISCONNECTED` (gray)
- **Broker logos**: Use text abbreviations or simple SVG icons in chartreuse — avoid external CDN deps
- **Security messaging**: Prominent "Read-only — EdgeJournal cannot place trades" in connection UI
- **Credential fields**: `type="password"` with show/hide toggle, never logged
- **Empty state**: Clear call-to-action with terminal-style ASCII border or icon

---

## Competitive Coverage After Implementation

| Phase | Brokers Added | Cumulative Auto-Sync Coverage |
|-------|--------------|-------------------------------|
| Phase 1 (CSV) | NinjaTrader, Rithmic | CSV-based (manual upload, new formats) |
| Phase 2 (API Key) | Tradovate, IBKR, OANDA, TopstepX, MetaApi→MT4/5 | ~13 auto-sync (Tradezella parity) |
| Phase 3 (OAuth) | TradeStation, Schwab | ~15 auto-sync |
| Phase 4 (Aggregator) | SnapTrade → 25+ brokerages | ~40+ auto-sync |

**Prop firm coverage via platform integrations**:
- Apex Trader Funding → Rithmic (CSV v1) + NinjaTrader (CSV)
- Topstep → Tradovate + TopstepX live API
- FTMO → MetaApi (MT4/5)
- MyFundedFutures → Rithmic (CSV v1)
- Earn2Trade → Rithmic (CSV v1)

---

## Success Metrics

- 80%+ of new users connect at least one broker within first week
- Sync error rate < 5% across all providers
- Zero credential exposure incidents
- Auto-sync reduces manual CSV uploads by 70%+
- NPS improvement from "too much manual work" cohort

---

## Open Questions

1. **MetaApi cost model**: Free tier allows 1 account. Paid plan needed at scale. Evaluate cost per user before launch.
2. **Rithmic API approval**: Must contact `rapi@rithmic.com` early — approval not guaranteed. CSV is v1 fallback.
3. **TradeStation/Schwab OAuth app approval**: Register early (1-5 business days each).
4. **On-login sync trigger**: Should we auto-sync all connections when user logs in? Adds latency but improves freshness.
5. **Sync frequency limit**: Should we rate-limit manual syncs (e.g., once per 30 minutes) to avoid broker API abuse?
6. **IBKR Flex Query template**: Should EdgeJournal provide a pre-built Flex Query template users can import, or give instructions to build their own?
