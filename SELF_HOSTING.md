# Self-Hosting TheTraderLog

This guide walks you through running your own instance of TheTraderLog from
scratch. The app integrates several third-party services — you'll create a free
account with each and plug in your own keys. Nothing here is shared with the
hosted product at thetraderlog.com.

> **License reminder:** TheTraderLog is source-available under the
> [PolyForm Noncommercial License](./LICENSE). You may self-host for personal,
> educational, and other noncommercial use. Commercial use requires a separate
> license. See [LICENSE](./LICENSE).

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Bun](https://bun.sh) | 1.3+ | Package manager + runtime |
| [Node.js](https://nodejs.org) | 20+ | Required by Next.js 15 tooling |
| [Git](https://git-scm.com) | any | To clone the repo |
| Docker (or OrbStack/Podman) | any | **Only needed to run the test suite** (Testcontainers spins up PostgreSQL) |

You do **not** need Docker just to run the app — only for `bun run test`.

---

## 2. Accounts you'll need

| Service | Purpose | Required? | Sign up |
|---------|---------|-----------|---------|
| **PostgreSQL** (e.g. [Neon](https://neon.tech)) | Database | ✅ Required | Free tier |
| **[Clerk](https://clerk.com)** | Authentication & user management | ✅ Required | Free tier |
| **[Databento](https://databento.com)** | Futures market data (MAE/MFE) | ✅ Required | Paid (usage-based) |
| **[Trigger.dev](https://trigger.dev)** | Background jobs (import enrichment, AI reports) | ✅ Required | Free tier |
| **S3-compatible storage** (e.g. [Cloudflare R2](https://developers.cloudflare.com/r2/)) | Screenshots & image uploads | ✅ Required | Free tier |
| **[OpenRouter](https://openrouter.ai)** | AI chat & reports | ✅ Required | Pay-as-you-go |
| **[Daytona](https://www.daytona.io)** | Sandboxed Python for AI `run_python` tool | ⬜ Optional | — |
| **[Resend](https://resend.com)** | Transactional/report emails | ⬜ Optional | Free tier |
| **[Sentry](https://sentry.io)** | Error monitoring | ⬜ Optional | Free tier |

> The "Required" services are enforced by environment-variable validation
> (`src/env.js`). If one is missing, the app won't boot. You can temporarily set
> `SKIP_ENV_VALIDATION=1` to build without them, but features that depend on a
> missing service will fail at runtime.

---

## 3. Clone & install

```bash
git clone <your-fork-url> traderlog
cd traderlog
bun install
cp .env.example .env
```

Now fill in `.env` as you complete each step below.

---

## 4. Configure services

### 4.1 PostgreSQL (Neon)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string into `DATABASE_URL`.
3. (Optional) If you use a read replica, set `DATABASE_READ_URL`.

Push the schema (Drizzle) to your database:

```bash
bun run db:push
```

You can inspect data anytime with `bun run db:studio`.

### 4.2 Clerk (auth)

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Copy the API keys into `CLERK_SECRET_KEY` and
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
3. **Set up the user-sync webhook** (this is how users get a row in your DB):
   - In Clerk → **Webhooks** → add an endpoint:
     `https://<your-domain>/api/webhooks/clerk`
   - Subscribe to `user.created`, `user.updated`, and `user.deleted`.
   - Copy the signing secret into `CLERK_WEBHOOK_SECRET`.
   - For **local development**, expose your localhost (e.g. with
     [`ngrok`](https://ngrok.com)) and point the webhook at the tunnel URL, or
     create users directly and sync them.

### 4.3 Databento (market data)

1. Create a key at [databento.com](https://databento.com).
2. Set `DATABENTO_API_KEY`.

> Market data lags real-time by ~8 hours on a rolling basis, so a session you
> trade today becomes queryable the same evening. Trades for which no data is
> available are marked `unavailable`/`pending` rather than blocking the UI.

### 4.4 Trigger.dev (background jobs)

1. Create a project at [trigger.dev](https://trigger.dev).
2. Set `TRIGGER_SECRET_KEY` (use the **dev** key locally, the **prod** key in production).
3. **Update the project ref** in [`trigger.config.ts`](./trigger.config.ts):
   ```ts
   project: "proj_xxxxxxxxxxxx", // ← replace with YOUR project ref
   ```
4. Run the Trigger.dev dev worker alongside your app while developing:
   ```bash
   bunx trigger.dev@latest dev
   ```
5. Deploy your tasks for production:
   ```bash
   bunx trigger.dev@latest deploy
   ```

### 4.5 S3-compatible storage (Cloudflare R2)

1. Create a bucket in [Cloudflare R2](https://developers.cloudflare.com/r2/)
   (or AWS S3 / MinIO / Backblaze B2).
2. Create an access key pair and fill in:
   `S3_ENDPOINT`, `S3_REGION` (`auto` for R2), `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`.
3. (Optional) If you serve images via a public bucket/CDN URL, set
   `S3_PUBLIC_URL`.
4. Configure CORS on the bucket to allow uploads from your app's origin
   (`NEXT_PUBLIC_APP_URL`).

### 4.6 OpenRouter (AI)

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. Set `OPENROUTER_API_KEY`.

### 4.7 Optional: Daytona, Resend, Sentry

- **Daytona** — set `DAYTONA_API_KEY` to enable the AI `run_python` tool.
- **Resend** — set `RESEND_API_KEY` to enable report emails, and update the
  `from:` address in `src/lib/ai/report-email.ts` to a domain you've verified.
- **Sentry** — set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (runtime) and
  `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` (build-time source maps).
  If unset, errors are silently dropped — the app still runs.

---

## 5. Unlocking features (no billing required)

Feature gating is wired to **Clerk Billing** plans (`Starter`, `Pro`). As a
self-hoster you almost certainly don't want to set up paid plans just to use
your own instance. Instead, grant yourself full access via a metadata flag:

1. In the Clerk dashboard, open your user → **Public metadata**.
2. Set:
   ```json
   { "features": { "beta_access": true } }
   ```
3. Sign out and back in.

`beta_access` bypasses all plan/feature checks and grants full Pro-level access
(see `src/lib/billing/utils.ts`). You can leave all `NEXT_PUBLIC_CLERK_PLAN_ID_*`
variables blank.

---

## 6. Run the app

```bash
bun run dev          # Next.js dev server (Turbopack) on http://localhost:3000
# in a second terminal, for background jobs to run locally:
bunx trigger.dev@latest dev
```

Open <http://localhost:3000>, sign up, set the `beta_access` flag (step 5), and
import a CSV of trades to see analytics populate.

---

## 7. Tests

The integration suite uses **real PostgreSQL via Testcontainers**, so a
container runtime must be running (Docker, OrbStack, Podman, …).

```bash
bun run test          # unit + integration
bun run test:e2e      # Playwright end-to-end (optional)
```

If Testcontainers can't find your Docker socket (common with OrbStack/Podman on
macOS), point it explicitly, e.g.:

```bash
DOCKER_HOST="unix://$HOME/.orbstack/run/docker.sock" bun run test
```

---

## 8. Production deployment

The app is a standard Next.js 15 application and deploys cleanly to Vercel or
any Node host.

1. Set every required env var in your host's dashboard (use **production** keys).
2. Set `NEXT_PUBLIC_APP_URL` to your real domain.
3. Point the Clerk webhook at `https://<your-domain>/api/webhooks/clerk`.
4. Deploy your Trigger.dev tasks: `bunx trigger.dev@latest deploy`.
5. Build: `bun run build` (uses Turbopack).

> **Marketing/SEO pages** (landing, pricing) contain some hardcoded
> `thetraderlog.com` references and branding. They're harmless when self-hosting
> the app itself, but update or remove them if you publish a public-facing site.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| App won't start, env validation error | A required variable is missing/empty in `.env`. |
| Signed up but "user not found" errors | Clerk webhook isn't reaching your app (check the endpoint URL & secret; tunnel localhost in dev). |
| Imported trades stuck "Processing market data…" | Trigger.dev worker not running, or wrong `project` ref in `trigger.config.ts`. |
| Features locked behind upgrade prompts | Set `{ "features": { "beta_access": true } }` in Clerk public metadata (step 5). |
| Image uploads fail | S3 credentials wrong, or bucket CORS doesn't allow your origin. |
| Tests fail to start a container | Docker/OrbStack not running, or `DOCKER_HOST` not set (see §7). |

For development conventions and how to contribute, see
[CONTRIBUTING.md](./CONTRIBUTING.md).
