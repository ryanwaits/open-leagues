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

Managers can stake FAAB on matchups when the commissioner turns betting **On**
under **The book** in league settings (then Save). Open Matchups to see the
line — live prices open the wager ticket; preseason shows an honest "no price"
empty state.

With `bun run dev` up:

```sh
bun scripts/wager-qa.mjs
```

Signs in with the local seed, creates a throwaway league, enables the book, and
screenshots either a placed ticket or the no-price panel under `screenshots/`.
Stdout JSON `"path":"price"` means a $1 ticket actually submitted; `"path":"no-price"`
is preseason (nothing to quote — do not fake a line). Re-run once a regular-season
week has projections.
