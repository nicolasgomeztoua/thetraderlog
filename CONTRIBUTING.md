# Contributing to TheTraderLog

Thanks for your interest in improving TheTraderLog! This guide covers the dev
workflow and conventions.

> **License note:** TheTraderLog is licensed under the
> [PolyForm Noncommercial License 1.0.0](./LICENSE). By submitting a
> contribution, you agree that your contribution is licensed under the same
> terms, and that the project maintainer may also license the project (including
> your contribution) commercially.

## Getting set up

1. Follow the [Self-Hosting Guide](./SELF_HOSTING.md) to get a working local
   environment (services, `.env`, database).
2. Install dependencies and start the dev server:
   ```bash
   bun install
   bun run dev
   ```

## Before you open a PR

Run these locally — they're the same gates CI enforces:

```bash
bun run check        # Biome lint + format
bun run typecheck    # tsc --noEmit
bun run test         # Vitest (requires a running Docker/OrbStack/Podman)
```

All three must pass.

## Code conventions

These are enforced or expected throughout the codebase:

- **Formatting & linting:** [Biome](https://biomejs.dev). Run `bun run check` (or
  `bun run check:write` to auto-fix).
- **No non-null assertions (`!`)** — use nullish coalescing with safe defaults.
- **Prefer `const`**, avoid `var`.
- **Absolute imports** from `@/` (maps to `src/`).
- **No hardcoded constants** in components or routers — shared constants live in
  `src/lib/constants/` (domain-specific files), exported as named constants.
- **No hardcoded error strings** — error messages live in
  `src/lib/constants/errors.ts` (`ERR_` for static, `err`-prefixed functions for
  dynamic). In frontend catch blocks use
  `getErrorMessage(error, ERR_FALLBACK)`.
- **Database:** the Drizzle schema in `src/server/db/schema.ts` is the single
  source of truth. Change it, then `bun run db:push`. Decimals are stored as
  strings — parse with `parseFloat()` for comparisons.
- **tRPC:** all mutations require auth via `protectedProcedure`; user ownership
  is validated in middleware — never trust a client-provided `userId`.

## Testing

- Tests use **real PostgreSQL via Testcontainers** (not mocks), so a container
  runtime must be running.
- Test trading behavior, not implementation details.
- Use the provided fixtures (`createTestUser()`, `setupTrader()`,
  `setupTraderWithTrades()`); truncate tables in `beforeAll`/`afterAll`.
- See [tests/README.md](./tests/README.md) for the full testing guide.

```bash
bun run test          # all tests
bun run test:watch    # watch mode
bun run test:e2e      # Playwright e2e
```

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org):

```
feat(analytics): add session breakdown chart
fix(import): track only closed trades in progress loader
perf(build): use Turbopack for production build
docs(readme): document self-hosting
```

Common types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`.

## Pull requests

1. Branch off `main`.
2. Keep PRs focused — one logical change per PR.
3. Make sure `check`, `typecheck`, and `test` pass.
4. Describe **what** changed and **why**; link any related issue.
5. Add or update tests for behavior changes.

## Reporting bugs & requesting features

Open an issue with clear reproduction steps (for bugs) or a concise description
of the problem you're trying to solve (for features). Screenshots and sample CSV
rows help a lot for import/analytics issues.

## Security

Please do **not** open public issues for security vulnerabilities. Instead,
contact the maintainer privately so the issue can be addressed before disclosure.
