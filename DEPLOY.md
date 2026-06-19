# Deploy Your Own TheTraderLog (Beginner Guide)

This guide gets you a **live, private copy of TheTraderLog on the internet** —
mostly by clicking buttons and pasting keys. No prior DevOps experience needed.
You'll create free accounts with a few services, then deploy to **Vercel**.

> ⏱️ **Time:** ~30–45 minutes the first time.
> 💳 **Cost:** The hosting and most services have **free tiers**. Two services
> (Databento for market data, OpenRouter for AI) are **pay-as-you-go** — the app
> deploys fine without spending, but those specific features need a few dollars
> of credit to actually return data. See [Is it really free?](#is-it-really-free).

> 📜 **License note:** TheTraderLog is free for **personal / noncommercial** use
> ([details](./LICENSE)). Vercel's free "Hobby" plan is *also* personal-use-only,
> so the two line up nicely.

---

## What you'll end up with

A URL like `https://your-traderlog.vercel.app` that **only you** can use (it's
your own instance with your own login), running entirely on your own free/cheap
accounts.

---

## Step 0 — Accounts to create

Open these in tabs and sign up (GitHub login works for most). Don't configure
anything yet — we'll grab keys as we go.

| Service | What it does | Free tier? |
|---------|--------------|-----------|
| [GitHub](https://github.com/signup) | Stores the code you deploy | ✅ |
| [Vercel](https://vercel.com/signup) | Hosts the website | ✅ Hobby (personal use) |
| [Neon](https://neon.tech) | Database | ✅ |
| [Clerk](https://clerk.com) | Login / accounts | ✅ |
| [Cloudflare](https://dash.cloudflare.com/sign-up) (R2) | Image/screenshot storage | ✅ |
| [Trigger.dev](https://trigger.dev) | Background jobs | ✅ |
| [OpenRouter](https://openrouter.ai) | AI features | 💳 pay-as-you-go |
| [Databento](https://databento.com) | Futures market data | 💳 pay-as-you-go |

You'll also need **[Node.js 20+](https://nodejs.org)** installed on your computer
for two one-time terminal commands near the end. (Everything else is web clicks.)

---

## Step 1 — Get your own copy of the code

1. Go to the TheTraderLog repository on GitHub.
2. Click **Fork** (top-right) → **Create fork**. This puts a copy in your account.

---

## Step 2 — Database (Neon)

1. In [Neon](https://neon.tech), create a project (any name).
2. On the project dashboard, find the **connection string** — it looks like
   `postgresql://user:pass@host/dbname?sslmode=require`.
3. **Copy it** somewhere temporary. This is your `DATABASE_URL`.

## Step 3 — Login (Clerk)

1. In [Clerk](https://dashboard.clerk.com), create an **Application**.
2. Choose your sign-in options (Email is fine).
3. Go to **API Keys** and copy:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY`
4. Leave the webhook for now — we set it up after the first deploy (Step 8).

## Step 4 — Storage (Cloudflare R2)

1. In [Cloudflare](https://dash.cloudflare.com) → **R2** → **Create bucket**
   (e.g. `traderlog-assets`).
2. **R2** → **Manage API Tokens** → **Create API Token** (Object Read & Write).
   Copy:
   - **Access Key ID** → `S3_ACCESS_KEY_ID`
   - **Secret Access Key** → `S3_SECRET_ACCESS_KEY`
3. Your **endpoint** is shown as `https://<account-id>.r2.cloudflarestorage.com`
   → `S3_ENDPOINT`.
4. Set `S3_REGION` to `auto` and `S3_BUCKET` to your bucket name.
5. (Optional) In bucket **Settings**, allow public access / add a custom domain
   if you want shared images to load, and put that URL in `S3_PUBLIC_URL`.
6. In bucket **Settings → CORS**, allow your future site origin (you can come
   back and set this to your Vercel URL after Step 7).

## Step 5 — AI (OpenRouter)

1. In [OpenRouter](https://openrouter.ai/keys), create a key → `OPENROUTER_API_KEY`.
2. Add a few dollars of credit under **Credits** (AI chat/reports won't work at $0).

## Step 6 — Market data (Databento)

1. In [Databento](https://databento.com), create an API key → `DATABENTO_API_KEY`.
2. (Optional now) Add credit when you want MAE/MFE excursions to actually fill in.

## Step 7 — Background jobs (Trigger.dev)

1. In [Trigger.dev](https://trigger.dev), create a **project**.
2. Copy the project **reference** (looks like `proj_xxxxxxxx`).
3. In your forked repo, edit **`trigger.config.ts`** and replace the `project`
   value with your own ref. Commit the change (GitHub's web editor works:
   open the file → ✏️ → commit).
4. Copy your **secret key** → `TRIGGER_SECRET_KEY` (use the **dev** key while
   testing, the **prod** key for the live site).

---

## Step 8 — Deploy to Vercel

1. In [Vercel](https://vercel.com/new), click **Add New… → Project** and
   **Import** your forked repo.
2. Before clicking Deploy, expand **Environment Variables** and add each value
   you collected. At minimum:

   ```
   DATABASE_URL
   CLERK_SECRET_KEY
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   CLERK_WEBHOOK_SECRET          ← placeholder for now, fix in Step 9
   DATABENTO_API_KEY
   TRIGGER_SECRET_KEY
   S3_ENDPOINT
   S3_REGION
   S3_ACCESS_KEY_ID
   S3_SECRET_ACCESS_KEY
   S3_BUCKET
   OPENROUTER_API_KEY
   ```

   > Tip: copy your finished `.env` and paste it into Vercel's "bulk edit" box —
   > it accepts the whole `KEY=value` list at once.

3. Click **Deploy**. Wait for the build. You'll get a URL like
   `https://your-traderlog.vercel.app`.

## Step 9 — Connect the URL back up

Now that you have a real URL:

1. In Vercel → your project → **Settings → Environment Variables**, set
   `NEXT_PUBLIC_APP_URL` to your Vercel URL (e.g. `https://your-traderlog.vercel.app`).
2. In **Clerk → Webhooks → Add Endpoint**, set the URL to
   `https://your-traderlog.vercel.app/api/webhooks/clerk` and subscribe to
   `user.created`, `user.updated`, `user.deleted`. Copy the **signing secret**
   into Vercel as `CLERK_WEBHOOK_SECRET`.
3. In Cloudflare R2 bucket **CORS**, allow your Vercel origin.
4. Back in Vercel, **Redeploy** (Deployments → ⋯ → Redeploy) so the new env vars
   take effect.

---

## Step 10 — Two one-time terminal commands

These need [Node.js 20+](https://nodejs.org). On your computer:

```bash
# 1. Get the code locally
git clone https://github.com/<your-username>/thetraderlog.git
cd thetraderlog
npm install -g bun && bun install

# 2. Create the database tables (uses your Neon URL)
echo 'DATABASE_URL="<your-neon-connection-string>"' > .env
bun run db:push

# 3. Deploy the background jobs to Trigger.dev (follow the login prompt)
bunx trigger.dev@latest deploy
```

That's it for setup.

---

## Step 11 — Unlock all features for yourself

Features are normally gated behind paid plans. To give **your own account** full
access without setting up billing:

1. In **Clerk → Users**, open your user.
2. Edit **Public metadata** and paste:
   ```json
   { "features": { "beta_access": true } }
   ```
3. Save, then sign out and back in on your site.

You now have full Pro-level access. 🎉

---

## You're live

Visit your Vercel URL, sign up, set the `beta_access` flag, and import a CSV of
trades. Welcome to your own TheTraderLog.

---

## Is it really free?

| Service | Free? | Notes |
|---------|-------|-------|
| Vercel (Hobby) | ✅ | Personal/noncommercial use only |
| Neon | ✅ | Generous free tier |
| Clerk | ✅ | Free up to a high monthly active user count |
| Cloudflare R2 | ✅ | Free storage tier (may ask for a card on file) |
| Trigger.dev | ✅ | Free tier covers personal usage |
| OpenRouter | 💳 | Needs a few dollars of credit for AI chat/reports |
| Databento | 💳 | Pay-as-you-go for market data (MAE/MFE) |

So: **hosting + database + auth + storage + jobs are free**. The two paid ones
are only for *market-data* and *AI* features — the rest of the journal and
analytics work without them.

---

## Common problems

| Symptom | Fix |
|---------|-----|
| Build fails on Vercel | A required env var is missing — check Step 8's list. |
| Sign up works but app errors with "user not found" | Clerk webhook not set or wrong secret (Step 9). |
| Imported trades stuck on "Processing market data…" | You skipped `trigger.dev deploy` (Step 10) or the `project` ref in `trigger.config.ts` is wrong (Step 7). |
| Everything says "Upgrade" | Set `beta_access` in Clerk (Step 11). |
| Image uploads fail | R2 keys wrong, or bucket CORS doesn't allow your Vercel URL. |

For a more technical/local-dev setup, see [SELF_HOSTING.md](./SELF_HOSTING.md).
