# open-leagues — project notes for agents

Product name is **open-leagues**. License is MIT. This is a self-hosted fantasy
football league desk. One deploy hosts many leagues.

## Where things live

- League primitives (create, join, draft, lineup, claims, trades, facts)
  live in `src/lib/league`. Public `createServerFn` wrappers are
  `src/lib/league/fns.ts`. Player and score reads are `src/lib/data/fns.ts`.
- The agent tool catalog is `src/lib/agent` (`catalog.ts`, `CATALOG.md`).
  If a verb is not in that catalog, it is not a tool. Tick is a clock, not
  a tool.
- Visual skin is `src/skin` (plan 026). Restyle there. Do not fork the
  engine to change paint.

## Do not

- Do not edit `src/lib/league/engine.server.ts` unless a numbered plan
  says so.
- Do not hit `/api/league/tick` without `CRON_SECRET` (Bearer or
  `?secret=`) when that env is set. Never print the secret.
- Do not rewrite `src/lib/auth/server.ts`. Email/password is
  `src/lib/auth/email-password.ts`. Google/X buttons are gated in
  `src/lib/auth/providers.ts` and `src/routes/login.tsx`.
- Do not write a `.env` with secrets into the repo. `.env.example` is the
  empty key list. Do not delete `AGENTS.md` (Grok preview still needs it).

## Self-host

No `DATABASE_URL` → PGLite on disk at `data/pglite` (override with
`PGLITE_DATA_DIR`; `PGLITE_EPHEMERAL=1` is RAM-only). Set `DATABASE_URL`
and run `bun run db:migrate` for Postgres. A public host also needs
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and a cron GET to
`/api/league/tick`.

Sleeper is the outbound player/week pipe. ESPN cookies are import-only.

## Verify

`bun test` · `bun run typecheck` · `bun run lint`
