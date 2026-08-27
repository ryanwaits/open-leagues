# Plan 091: A real `/about` marketing page, built from the locked mock

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If anything in the "STOP conditions" section occurs, stop
> and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 101cd0c..HEAD -- src/routes src/styles.css src/skin src/components/logo.tsx src/components/shell.tsx`
> If any diff exists, compare the "Current state" excerpts below against
> the live files before proceeding; on a mismatch, STOP and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — one new route, no existing route/component is modified
  except a one-line link addition (see Scope). Nothing behind auth changes.
- **Depends on**: none
- **Category**: feature (marketing)
- **Planned at**: commit `101cd0c`, 2026-08-27
- **Design source**: this plan implements a design the user approved as an
  Artifact mock, iterated live in conversation (hdls.tools-inspired shell,
  repainted with this repo's real Console skin tokens; then revised to swap
  in real fetched brand icons, Title Case nav, and a `--help`-style
  features block instead of a bordered grid). The mock used hardcoded hex
  values and a Google-Fonts import (JetBrains Mono) because it was a
  standalone preview; **this plan deliberately does not carry those two
  choices into the real app** — see "Deviations from the mock" below for
  why, before you second-guess it as a mistake.

## Why this matters

The app's `/` route already has a signed-out homepage (`GuestHome` in
`src/routes/index.tsx`), but that page is written for a visitor to *this
specific hosted instance* ("Sign in to a seat you already have, or join
with an invite") — it assumes you already know what this product is. There
is no page in the repo aimed at someone evaluating whether to self-host
open-leagues at all. This plan adds one: `/about`, reachable on every
self-hosted instance, that makes the "headless, agent-native, real MCP
proof" case the README and this session's work have been building toward.

## Deviations from the mock (read before writing code)

1. **No new font.** The mock loaded JetBrains Mono from Google Fonts for
   display text. The real Console skin (`src/skin/skins/console.css`) has
   no webfont at all — `--font-stack-display`/`--font-stack-sans` are a
   system-sans stack, `--font-stack-mono` is a system-mono stack. Adding an
   external font for one route breaks that "quiet, native" identity the
   skin already committed to. **Use the `font-sans`/`font-mono` Tailwind
   utilities** (they resolve to those exact system stacks via `@theme
   inline` in `src/styles.css`) — do not add a `<link>` or `@import` for
   any font.
2. **No hardcoded hex.** The mock inlined literal hex values in a `<style>`
   block because it was a standalone file. The real implementation must
   use the app's existing semantic Tailwind utilities (`bg-bg`,
   `text-fg`, `text-muted`, `text-faint`, `border-line`, `border-line-strong`,
   `bg-surface`, `bg-raised`, `bg-band`, `text-accent`, `rounded-*`) — see
   the mapping table below. This is what makes the page automatically
   correct in both light and dark without any extra work.
3. **Forces the Console skin, not whatever the visitor has picked.**
   `data-skin` is a global attribute on `<html>`, shared with the visitor's
   in-app skin preference (Ledger/Box Score/Console — see
   `src/lib/theme.ts`). A marketing page's identity shouldn't flicker
   between three different visual languages depending on what a returning
   member happens to have picked for their own desk — same reasoning a
   product's public marketing site doesn't reflow to match a logged-in
   user's dashboard theme. This route force-sets `data-skin="console"` on
   mount and restores whatever was there before on unmount (Step 3). Light
   vs dark still follows the visitor's normal preference — only the skin
   axis is pinned.
4. **Only one real, twice-verified demo exchange, not two.** The mock's
   chat-demo card had a second turn ("migrate my old Sleeper league in...")
   that was never actually run live — it was written as a plausible
   illustrative continuation, not captured from a real session. Presenting
   fabricated content as proof (even styled identically to real proof)
   is exactly the thing this session has been careful never to do
   elsewhere (see `docs/codex-demo.md`'s own transcript, which is real).
   **This plan keeps only the first exchange**, which is real and was
   independently verified twice this session: once by the advisor directly
   (a live Codex CLI session against local dev), once by the plan-090
   executor (an independent re-run), and a third time by the user
   themselves live in ChatGPT/Codex desktop against production. Do not add
   a second turn back in.

## Tailwind utility mapping (real tokens, from `src/styles.css`'s `@theme inline`)

| Mock's hardcoded hex use | Real Tailwind utility |
|---|---|
| page background (`--paper`) | `bg-bg` |
| card/raised surface (`--paper-raised`) | `bg-surface` |
| sunken surface (`--paper-sunken`) | `bg-raised` |
| muted row background (`--band`) | `bg-band` |
| primary text (`--ink`) | `text-fg` |
| secondary text (`--ink-2`) | `text-muted` |
| tertiary/faint text (`--ink-3`) | `text-faint` |
| hairline border (`--hairline`) | `border-line` |
| stronger hairline (`--hairline-strong`) | `border-line-strong` |
| accent blue (`--brand`) | `text-accent` / `bg-accent` |
| accent deep (`--brand-deep`) | `text-accent-deep` |
| radii | `rounded-sm` / `rounded-md` / `rounded-lg` / `rounded-xl` / `rounded-pill` |
| mono font | `font-mono` |
| sans font (body/display) | `font-sans` |

## Current state

**`src/routes/login.tsx`** is the closest existing pattern to follow: a
standalone full-page route with no `<Shell>` wrapper, `createFileRoute`,
its own component function. Read it directly before writing this route —
match its file shape (imports at top, one `Route` export, one component
function), not just its visual output.

**`src/lib/theme.ts:104-121`** (verified at `101cd0c`):
```ts
export function readSkin(): SkinPref {
  if (typeof localStorage === "undefined") return "ledger";
  try {
    const raw = localStorage.getItem(SKIN_KEY);
    return isSkinPref(raw) ? raw : "ledger";
  } catch {
    return "ledger";
  }
}

/** Applies the resolved skin to <html>. Absent attribute = ledger, same
 * convention as data-accent. */
function paintSkin(skin: SkinPref) {
  if (typeof document === "undefined") return;
  if (skin === "ledger") document.documentElement.removeAttribute("data-skin");
  else document.documentElement.setAttribute("data-skin", skin);
}
```
`paintSkin` is not exported — this plan's route does its own
`setAttribute`/`removeAttribute` directly rather than importing it (see
Step 3), so it doesn't take a dependency on theme.ts's private internals.

**`src/components/logo.tsx`** (verified at `101cd0c`, full file):
```tsx
/** The Open Leagues mark: a standings table, first place filled.
 * Mono currentColor so it rides any skin/theme; pass a size class. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" fill="none" aria-hidden className={className}>
      <rect x="6" y="9" width="32" height="7.5" rx="2" fill="currentColor" />
      <rect x="6" y="20.5" width="32" height="7.5" rx="2" stroke="currentColor" strokeWidth="2.4" />
      <rect x="6" y="32" width="22" height="7.5" rx="2" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}
```
Reuse this for the nav wordmark's mark — do not draw a new logo glyph.

**`src/skin/brand.ts`** (verified at `101cd0c`, full file):
```ts
export const brand = {
  name: "Open Leagues",
  shortName: "Open Leagues",
  tagline: "Your league, your desk.",
  kicker: "Hosted here · no other app",
} as const;
```

**Real, verified proof content** (from `docs/codex-demo.md`, landed this
session at `749328a` — do not alter these values, they're a real transcript):
- prompt: `Use the open-leagues MCP tools to get my league context — team
  name, record, and this week's matchup opponent if one exists. Report
  just that, nothing else.`
- tools actually called, in order: `listMyLeagues`, `getAgentContext`,
  `getLeagueBundle` (the doc's real run also called `getMatchups`/
  `getSchedule` after two failed guesses — this plan's demo card
  simplifies to the three reads that produced the final answer, since the
  failed-guess detail is `codex-demo.md`'s job to show honestly, not a
  marketing page's)
- real answer: `hands — 0-0-0 — vs Butterbean`

**Real fetched brand icons** (Simple Icons project, MIT-licensed SVG path
data, fetched directly — verify the license notice at
https://github.com/simple-icons/simple-icons/blob/master/LICENSE.md before
shipping if you want to double check, but Simple Icons is CC0/MIT for the
icon set itself):

Claude icon path (viewBox `0 0 24 24`):
```
m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z
```

OpenAI icon path (viewBox `0 0 24 24`):
```
M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z
```
No SVG/official mark exists for Grok/xAI in any icon set checked this
session — render it as a plain text monogram (`GROK`), not a fabricated
logo. Do not go looking for one; it was already searched.

## Scope

**In scope**:
- New file `src/routes/about.tsx` (Step 2)
- New file `src/components/icons/brand-marks.tsx` (Step 1) — the two real
  SVG icon components, kept separate from `about.tsx` so they're reusable
  if a future page wants them
- One-line addition to `src/routes/index.tsx`'s `GuestHome` — a small
  `<Link to="/about">` (Step 4), so the new page is actually reachable
  from inside the app, not just a dead route
- `plans/README.md` status row — skip if a reviewer maintains the index

**Out of scope**:
- Any change to `GuestHome`'s existing copy, buttons, or layout beyond the
  one added link
- Any change to `Shell`, `theme.ts`, `brand.ts`, or any existing route
- A custom `<title>`/meta tag for `/about` — nice-to-have, not required;
  skip it if `head:` route-level overrides turn out to need root-route
  changes to support (check `src/routes/__root.tsx`'s `head:` export first
  — if child routes can already extend it without editing the root, add
  one; if not, don't touch the root route for this)
- Any change to the icon SVGs' path data beyond adding `fill="currentColor"`
  and stripping the embedded `<title>` (keep as `aria-hidden`, add a plain
  text label alongside in the DOM instead — see Step 2)
- Anything not explicitly listed above

## Git workflow

Current branch; one commit, e.g.
`feat: add /about marketing page`.
Do not push (standing rule — `main` auto-deploys to `leagues.waits.dev` via
Render on every push).

## Steps

### Step 1: `src/components/icons/brand-marks.tsx`

```tsx
/** Real brand marks for the /about page's "works with" row — SVG path
 * data from the Simple Icons project, recoloured to currentColor so they
 * ride the active skin/theme. No official Grok/xAI mark exists in any
 * icon set as of this writing — that one stays a text monogram. */

export function ClaudeMark({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

export function OpenAIMark({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}
```

**Verify**: `bun run typecheck` on just this file passes (it will be
checked as part of Step 5's full gate; no need to run it standalone).

### Step 2: `src/routes/about.tsx`

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClaudeMark, OpenAIMark } from "@/components/icons/brand-marks";
import { LogoMark } from "@/components/logo";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  // Marketing identity is fixed to Console, independent of whatever skin
  // the visitor has picked for their own desk (data-skin lives on <html>,
  // shared globally — see src/lib/theme.ts). Restore whatever was there
  // before on unmount so navigating away doesn't leave it stuck.
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-skin");
    el.setAttribute("data-skin", "console");
    return () => {
      if (prev) el.setAttribute("data-skin", prev);
      else el.removeAttribute("data-skin");
    };
  }, []);

  return (
    <div className="mx-auto max-w-[720px] px-6 pb-12 font-sans text-fg">
      <nav className="flex items-center justify-between border-b border-line py-7">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <LogoMark className="h-4 w-4 text-accent" />
          open-leagues
        </div>
        <div className="flex gap-5 text-sm">
          <a href="#features" className="text-muted hover:text-fg">
            Features
          </a>
          <a href="#docs" className="text-muted hover:text-fg">
            Docs
          </a>
          <a
            href="https://github.com/ryanwaits/open-leagues"
            className="text-muted hover:text-fg"
          >
            GitHub
          </a>
        </div>
      </nav>

      <h1 className="mt-12 text-balance text-[34px] font-medium leading-[1.25] tracking-[-0.01em]">
        A headless fantasy league.
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Postgres holds the league and enforces the rules. An MCP server
        exposes every verb. The reference app you're picturing right now is
        client zero — not the product.
      </p>
      <p className="mt-2.5 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Migrate a league in once, then run it from a browser, a terminal, or
        an agent that's never seen this repo before.
      </p>

      <div className="mt-7 mb-8">
        <div className="mb-3 text-[13px] text-faint">works with</div>
        <div className="flex gap-2.5">
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-muted"
            title="Claude"
          >
            <ClaudeMark className="h-[15px] w-[15px]" />
          </div>
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-muted"
            title="OpenAI / Codex"
          >
            <OpenAIMark className="h-[15px] w-[15px]" />
          </div>
          <div
            className="flex h-[30px] items-center justify-center rounded-md border border-line bg-surface px-2.5 font-mono text-[10.5px] font-semibold tracking-wide text-muted"
            title="Grok (xAI) — no official mark available, shown as text"
          >
            GROK
          </div>
        </div>
      </div>

      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="flex items-center gap-1.5 border-b border-line bg-band px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="ml-1 font-mono text-xs text-faint">
            codex · open-leagues
          </span>
        </div>
        <div className="bg-band px-4 py-3 text-[14.5px] before:mr-1 before:text-faint before:content-['›']">
          get my league context — team name, record, this week&apos;s opponent
        </div>
        <div className="border-t border-line px-4 py-3 text-[13px] italic text-faint">
          Called open-leagues → listMyLeagues, getAgentContext, getLeagueBundle
        </div>
        <div className="flex items-baseline gap-2 border-t border-line px-4 py-3 text-[14.5px]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>
            <b className="font-semibold">hands</b> — 0-0-0 — vs{" "}
            <b className="font-semibold">Butterbean</b>
          </span>
        </div>
      </div>

      <div
        id="features"
        className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint"
      >
        features
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="flex items-center justify-between border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
          <span>open-leagues --help</span>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-[1.7]">
          <span className="text-faint">$ open-leagues --help</span>
          {"\n\n"}
          <span className="font-semibold">importLeague </span>
          <span className="text-muted">  migrate from Sleeper, ESPN, or a pasted recap</span>
          {"\n"}
          <span className="font-semibold">startPlayer  </span>
          <span className="text-muted">  sit/start against real projections</span>
          {"\n"}
          <span className="font-semibold">addDrop      </span>
          <span className="text-muted">  work the wire, FAAB conserved</span>
          {"\n"}
          <span className="font-semibold">voteTrade    </span>
          <span className="text-muted">
            {"  "}propose, counter, accept — priced by replacement value
          </span>
          {"\n"}
          <span className="font-semibold">placeWager   </span>
          <span className="text-muted">  a real house book against your league&apos;s own purse</span>
          {"\n\n"}
          <span className="italic text-faint">
            57 of 76 verbs wired to MCP — same primitives the app runs on.
          </span>
        </pre>
      </div>

      <div
        id="docs"
        className="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-faint"
      >
        docs
      </div>
      <p className="mb-5 text-[13.5px] text-muted">
        Any signed-in member mints their own token from{" "}
        <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[13px]">
          /account
        </code>{" "}
        — no commish gate.
      </p>

      <TermCard label="Codex CLI">
        codex mcp add open-leagues --url https://YOUR_HOST/api/mcp
        --bearer-token-env-var OPENLEAGUES_TOKEN
      </TermCard>
      <TermCard label="Codex CLI (self-hosted box)">
        codex mcp add open-leagues -- bun scripts/mcp.mjs
      </TermCard>
      <TermCard label="Claude / ChatGPT connector">
        {"# url\nhttps://YOUR_HOST/api/mcp\n# auth — bearer token, minted from /account"}
      </TermCard>
      <TermCard label="Self-host">
        {`git clone https://github.com/ryanwaits/open-leagues.git\ncd open-leagues\ndocker compose up -d`}
      </TermCard>

      <footer className="mt-16 border-t border-line pt-6 pb-6 text-center text-xs text-faint">
        open-leagues — headless fantasy football operator, MIT
      </footer>
    </div>
  );
}

function TermCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 overflow-hidden rounded-md border border-line-strong bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
        <span>{label}</span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-[1.7]">
        {children}
      </pre>
    </div>
  );
}
```

A few things worth naming explicitly since a weaker executor could trip on
them:
- `React.ReactNode` requires `import type React from "react"` or
  `import type { ReactNode } from "react"` — use whichever this codebase's
  existing files already do (check another component file with a
  `children` prop, e.g. grep `ReactNode` under `src/components/`, and match
  it) rather than guessing.
- The `before:content-['›']` Tailwind arbitrary-value syntax must exactly
  match this repo's Tailwind v4 conventions — if `bun run typecheck`/
  `bun run build` shows this line failing to compile as expected, don't
  fight it: replace with a plain `<span className="text-faint">› </span>`
  prefix inside the JSX instead of a pseudo-element, and note the swap in
  your report.
- `bg-line-strong` (used for the demo card's three fake window-control
  dots) needs to exist as a real Tailwind utility — it maps from
  `--color-line-strong` in `@theme inline`, same as `border-line-strong`
  does. If it doesn't resolve, use `bg-line` instead and note it.

### Step 3: Confirm the skin-force effect actually works

This can't be verified by reading code alone — run it.

```sh
bun run dev
```
Using `agent-browser` (sandbox disabled per the standing rule):
1. Open `http://localhost:8080/` first, confirm no `data-skin` attribute
   present by default (`document.documentElement.getAttribute('data-skin')`
   → `null`).
2. Navigate to `http://localhost:8080/about`. Re-check the attribute → must
   now read `"console"`. Visually confirm (screenshot) it renders in the
   Console palette (off-white/near-black ground, blue accent — not the
   default Ledger off-white-warm/green look).
3. Navigate back to `/`. Re-check the attribute → must be back to `null`
   (not stuck on `"console"`).
4. Repeat with a skin preference actually set first: on `/account`, switch
   to Box Score, confirm `data-skin="boxscore"` on `<html>`. Then visit
   `/about` (must show Console), then navigate away (must restore
   `"boxscore"`, not `null` and not `"console"`).

**Verify**: all four attribute checks above match exactly. If any doesn't,
STOP — the cleanup logic has a bug, don't ship a route that leaks a global
attribute override.

### Step 4: One link from `GuestHome`

In `src/routes/index.tsx`, inside the existing `GuestHome` component (the
signed-out `/` view), add one small link to `/about` — e.g. near the
existing Sign in/Join buttons, something like:

```tsx
<Link to="/about" className="mt-3 block text-sm text-muted underline underline-offset-4">
  What is this?
</Link>
```

Match whatever spacing/class conventions the surrounding buttons already
use rather than inventing new ones — read the current `GuestHome` function
body first (it's short) and place this consistently with its existing
layout, not just appended awkwardly at the end.

**Verify**: `grep -n 'to="/about"' src/routes/index.tsx` → one match.

### Step 5: Full gate

`bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run
build` all exit 0.

### Step 6: Commit

Message: `feat: add /about marketing page`. Do not push.

## Test plan

- No new automated tests — this is a static content page with one
  behavioral piece (the skin-force effect), which Step 3 verifies manually
  and directly since it's a DOM/browser-only concern with no existing test
  harness pattern to extend.
- Manual: Step 3's four checks, plus a visual pass in both light and dark
  (`agent-browser` screenshot each) to confirm the page reads correctly —
  no illegible text, no layout overflow, the works-with icons visible in
  both themes (they use `text-muted`, which should adapt automatically —
  confirm it actually does, don't assume).

## Done criteria

- [ ] `src/components/icons/brand-marks.tsx` exports `ClaudeMark` and
      `OpenAIMark`, both `fill="currentColor"`, no hardcoded color
- [ ] `src/routes/about.tsx` uses only Tailwind semantic utilities from the
      mapping table — `grep -c '#[0-9a-fA-F]\{3,6\}' src/routes/about.tsx`
      → `0` (no hardcoded hex anywhere)
- [ ] No Google Fonts `<link>`/`@import` added anywhere in this change —
      `grep -rn 'fonts.googleapis' src/routes/about.tsx` → no match
- [ ] Step 3's four `data-skin` checks all pass
- [ ] `GuestHome` links to `/about`
- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` ·
      `bun run build` all exit 0
- [ ] Commit created locally; **not pushed**

## STOP conditions

- The drift check shows any in-scope file has changed since `101cd0c` in a
  way that contradicts an excerpt above.
- Any Tailwind utility named in this plan (`bg-bg`, `text-fg`, `bg-band`,
  `border-line-strong`, etc.) doesn't actually exist/resolve when you check
  `@theme inline` in `src/styles.css` yourself — stop and report the exact
  mismatch rather than substituting a hardcoded hex value to make it work.
- You find yourself wanting to add a second demo-card exchange, a stock
  illustration, or any data not explicitly given in this plan as real —
  don't; this plan's "Deviations from the mock" section explains why.
- The skin-force effect (Step 3) leaks — `data-skin` stays `"console"`
  after navigating away, or fails to restore a prior explicit preference.

## Maintenance notes

- If Console's token values change in `src/skin/skins/console.css`, this
  page updates automatically (it never hardcodes a color) — that's the
  entire point of using semantic Tailwind utilities instead of the mock's
  hex values.
- If the real MCP catalog's wired-verb count changes from 57/76, the
  `--help` block's closing line needs a manual update — it's not derived
  from `src/lib/agent/core.ts` at build time, just written as a fact at
  the time this plan was authored. A future plan could wire it to read the
  real count if that drift becomes annoying.
- The demo card's transcript is frozen to what's real as of `docs/codex-demo.md`
  (commit `749328a`). If that doc's transcript is ever updated (e.g. a
  fresh live re-verification with different tool-call ordering), this
  page's copy should be refreshed to match — don't let them drift apart
  silently.
