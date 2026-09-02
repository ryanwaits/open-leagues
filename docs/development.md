# Development

## Check

```sh
bun test
bun test src/lib/auth/providers.test.mjs   # native Google button gating
bun test src/lib/push                      # SW + no-VAPID no-op
bun run typecheck
bun run lint
```

## Testing the book (wagers)

Betting is on when the commissioner sets **The book** to **On** in league
settings and saves. Matchups shows the line; a live price opens the wager
ticket, preseason shows a "no price" empty state.

With `bun run dev` up:

```sh
bun scripts/wager-qa.mjs
```

Signs in with the local seed, makes a throwaway league, turns the book on, and
screenshots the ticket or no-price panel to `screenshots/`. Stdout
`"path":"price"`: a $1 ticket was submitted. `"path":"no-price"`: preseason,
no line to quote. Re-run once a regular-season week has projections.
