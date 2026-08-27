# Implementation Plans

Slices live here. Read the one you are executing from.

- **001–005 — Desk performance** (improve skill, 2026-08-17, commit `1abb347`).
  Goal: league desk feels like a spreadsheet — last-known numbers stay painted,
  tabs do not reload, hard refresh restores the workbook, live scores still tick.
  **All five are DONE.**
- **006–014 — Draft room and league memory** (improve skill, 2026-08-17, commit
  `9948a37`). Goal: a draft worth sitting in — a board, a 90-second clock,
  sticky autodraft, a queue, mid-draft trading of picks/players/FAAB, and a mock
  mode — then the second half of the context engine, so the weekly desk write-up
  remembers a season instead of a week.
- **015–021 — Projections and the trade desk** (improve skill, 2026-08-17,
  commit `304cfb7`). Goal: a projection that moves during the season, a trade
  priced by what your lineup actually scores, and a desk built from player rows
  that carry their numbers instead of names that carry nothing.
- **022–026 — Agent-native foundation** (improve skill, 2026-08-17, commit
  `553f159`). Goal: the league is something a commish can run, a friend can
  put on a home screen, a harness can restyle, and an agent can *use* —
  because the primitives are named and tested, not because we added a chat
  widget. 024–026 are DONE.
- **027–029 — Purse, door, and a real click** (improve skill, 2026-08-18,
  commit `b918703`). Goal: the book cannot invent FAAB, a league can be
  locked to invited emails and member-only reads, and the wager ticket is
  scripted so we stop saying "no one has clicked it." **All three are DONE**
  (verified `dd9bc53`).
- **030–037 — Close the door, then self-host leftovers** (improve skill,
  2026-08-19, commit `dd9bc53`). Goal: invite-only means the RPCs too;
  the remaining skips and self-host gaps are named instead of rediscovered.
  **030–031, 033–037 DONE.** **032** still ops (no live line).
- **038–040 — Agent can actually use the catalog** (improve skill,
  2026-08-19, commit `dd9bc53`). Goal: one context dump, pull-ticket
  parity, and no minted FAAB on trade accept — so a loop over named
  verbs is honest. **038–040 + 031 + 033 are DONE.**
- **053–056 — Liveline: the line on the desk** (improve skill, 2026-08-21,
  commit `69cd95b`). Goal: real‑time line charts where a number has a past —
  one `<LiveLine>` wrapper owning every liveline decision (053), the player
  projection line in the watch drawer / sheet + lineup chips (054), the
  multiseries matchup chart + home card meter with an `ff_ticks` writer (055),
  the book's line‑movement strip with in‑play wagering scoped separately (056).
  Design artifact: https://claude.ai/code/artifact/841ce7c9-05e1-4edd-a217-c48ffed610be
- **057–059 — Ledger·Bot: the default theme cut like x.ai/bot** (improve skill,
  2026-08-22, commit `d370e29`). Goal: the default Ledger mode reads like
  https://x.ai/bot — white ground, flat warm-grey cards, ink primary, sober
  green, Geist — via the skin contract (057 tokens/type), then the primitive
  recipes (058), then phone polish incl. the matchup-edge caption bug (059).
  Ryan's calls: variant B (ringed white cards), sans eyebrows, ship as
  default, Geist. Advisor's: retire `.push`. **All three DONE** (2a9b93f,
  a33f297+3b905a2, 7d11914+ca770a1 — pushed 2026-08-23). Design artifact:
  https://claude.ai/code/artifact/4e0119fb-6b78-48ec-9a77-abaf4c55675e
- **060–063 — Pocket Ledger: mobile-native gestures** (improve skill, 2026-08-23,
  commit `37ed78d`). Goal: the six-move gesture vocabulary from the Pocket Ledger
  study lands — thumb bar slides away + re-tap-to-top (060), the game page's
  pinned rail with swipeable Plays·Box·Scoring panes (061), player sheet/watch on
  vaul detents (062), the matchup score card swiping the week's slate with the
  page re-anchoring on settle (063). Ryan's calls: hide fully; all three panes,
  today's order; card-only swipe with full context shift; ship 060→063. Artifact:
  https://claude.ai/code/artifact/437db70f-5d8e-4f35-97c8-d1a4b620f961
- **064 — Matchup liveline: kickoff gate + tab-switch reveal** (improve skill,
  2026-08-23, commit `01439f9`). Goal: the Where-the-game-is canvas obeys 055's
  Tue–Sat rule (no chart until `pairHasStarted` or stored ticks — outlooks
  loading is not kickoff) and Win % ↔ Margin share one `<LiveLine>` so
  liveline's `chartReveal` wave does not replay on every tab. Sequence after
  063 so the matchup-page swipe and this card cleanup do not review-collide.
- **065–067 — The Box Score** (improve skill, 2026-08-24, commit `0bf3688`).
  Goal: the matchup detail page matches the locked mocks — stacked score card
  with count-based status (no quarter/preview badges; a matchup spans many NFL
  games), game-pill strip (kills the carousel + its anchor bug), quiet rows
  (no repeated clocks; winner bold at final, no glyphs), full bench rows,
  condensing mini-scorebar (065); desktop V1 pinned rail (066); and the page
  contract — the board compares (MatchupEdge leaves /matchups, compact mirror),
  the box score follows (067). Spec artifact (v2-locked):
  https://claude.ai/code/artifact/9f879d2c-915d-4bdb-bdfd-69ef2f4fb950
- **068–069 — The context deck** (improve skill, 2026-08-24). Goal: nothing
  interactive at the top of a phone page — each page's lens + one action dock
  in a context deck fused above the thumb bar, with a control sheet on ☰/swipe
  (stacked posture locked; unified bar and floating pills explored and
  rejected). 068 = the Deck primitive in Shell + the Players wire (deck chips,
  search/status sheet, continuous list replacing 22-page pagination); 069 =
  My Team (Lineup·Bench·Activity tabs that jump and track + ⇄ Trade cap).
  Desktop unchanged; shipped top rails migrate only after these prove it.
  Spec artifact: https://claude.ai/code/artifact/0518fa1c-3e32-4d3d-a4ea-914ac8e7d02e
- **041–044 — Headless engine: token, MCP, skills** (improve skill,
  2026-08-19, commit `735b0ba`). Goal: Codex / Claude / Grok can
  install open-ff as a tool server (stdio on the commish box, HTTP
  on *their* origin) and run migrate / sit / book playbooks. Not
  a multi-tenant SaaS. The PWA stays client zero. **All four DONE.**
- **045 — Migrate sources** (improve skill, 2026-08-19, commit
  `735b0ba`). **DONE** `6a0df03` + split `29f7a2e` (pushed 2026-08-23).
  Canonical `ImportPack`; Sleeper/ESPN/rebuild → `commitImportPack`;
  file always works; NFL hops to ESPN; Yahoo OAuth not shipped.
- **046 — Dead-simple self-host** (improve skill, 2026-08-19,
  commit `735b0ba`). **DONE** `c1769d2` + secret persist `bb965bd`
  (pushed 2026-08-23). Docker + in-process tick. They only pay the host.

Execute in the order below. Each executor: read the plan fully, honor STOP
conditions, update your row when done.

## Last reconcile

2026-08-20 (third pass) against `8e660ba`. No BLOCKED / IN PROGRESS.

Since second pass: 049 voice codemod (`cfbacc8` + revision `06091c8`) and
050 flourishes (`8e660ba`) executed + reviewed + APPROVED via the execute
loop. **Box Score release complete (047+049+050)** — tokens, voice,
flourishes all landed, Ledger pixel-identical throughout, verified in
browser both skins × both modes. 50 of 50 authored plans now DONE except
032 (ops-gated).

**Verified this pass:** full gates green at `8e660ba` (typecheck 0, 184/0
tests, build 0). 032 drift check re-run: wager files restyled by 049
(cosmetic; testids intact, wager-qa.mjs unchanged) — pin refreshed to
`8e660ba`, finding still live.

**Operator queue (nothing executable by an agent):** push/deploy ~30 local
commits on main · real-device iOS/Android install pass (048) · iOS
step-copy variant call (048) · run 032 when a week quotes a line.

## Second-pass reconcile (superseded)

2026-08-20 (second pass) against `505ccb2`. No BLOCKED / IN PROGRESS.

Commits since prior reconcile (`8f04751`): plan 047 executed + reviewed
(`ed6cdd4` + revision `303e7a0`), plan 048 executed + reviewed
(`505ccb2`) — both APPROVED via the improve execute loop, dispatched
executor, tech-lead review, one revision round (047) and one sanctioned
out-of-scope test-assertion fix (048). All local on main, nothing pushed.

**Verified this pass (cheap, on `505ccb2`):**
- 047/048 done criteria re-run in full during review (typecheck 0, tests
  175/0 with the known `import.meta.glob` baseline error, build 0, scoped
  biome no new findings). Live-browser verified: skin toggle + persistence
  + no-flash reload, drawer auto/manual/dismiss branches.
- 026: join still carries `?code=` through login redirect (`join.tsx:60,74`)
  after 048's edit; `src/skin/*` intact (SKILL.md deliberately rewritten by
  047 — fork-and-edit contract replaced by the runtime-skin doc; grok.me
  hosting refs pruned by design, PWA mechanics kept).
- 037: `public/sw.js` present, still no `cache.put`; PushRegister untouched
  by 047/048 (out-of-scope lists held).
- Aggregate: `bun test src scripts` green covers the source-assertion suites
  (030 hosted GETs, join-redirect, brand, skin, a2hs, faab/money/sw math).
- One environmental note: a PGLite WAL corruption from an unclean build
  shutdown surfaced during review; repaired with `bun run db:repair`
  (gitignored `data/pglite` only). Recurs occasionally after interrupted
  `bun run build` — known, documented, not a regression.

**Refreshed TODOs (this pass):**
- 032 unchanged: zero drift on wager files since `84d684e`, finding live,
  purely awaiting a week that quotes a line (ops condition, not code).

**Owed next (not yet authored):** 049 voice codemod (microlabel/card
utilities, per-skin `.push`/`.hl`; re-census counts first — 047's
maintenance notes carry the spec seed) and 050 Box Score flourishes
(ghost numerals, slot rails, agate tables, recap stamp; palette of record
is the Box Score canvas). The Box Score release is not cut until both
land. Operator items open: real-device iOS/Android install pass (048),
iOS step-copy variant decision (048).

## Prior reconcile

2026-08-20 against `8f04751`. No BLOCKED / IN PROGRESS.

Commits since prior reconcile (`84d684e`): unsigned league views bounce
to login (`23e804e`), PGLite empty-reset + WIFFL seed (`5421c47`),
guest/member/commish onboarding (`eaf1152`), Google+push operator docs
(`18884ef`), plan-note refresh (`8f04751`). That landed the previously
dirty account/home/auth/db work. Do not fold leftover product work into
047/048.

**Verified DONE (cheap):**
- 035 `GOOGLE_CLIENT_*` + `configuredLoginSocials`
- 037 `public/sw.js` (no `cache.put`) + `void notifyRoster` on clock/trade/waiver
- 034 `exportLeague` · 046 `docker-compose.yml` + `OPENFF_SELF_TICK`
- 030 `assertLeagueViewer` still on hosted GETs (`getDesk`)
- 038 `getAgentContext` · 045 `commitImportPack`

**Refreshed TODOs:**
- 032 still ops; wager files unchanged since `84d684e`; finding live
  (no `$1` path).
- 047 excerpts still match HEAD (`data-skin` / `--r-xs` absent in
  `src/`). Tightened `account.tsx` / `tokens.css` line pointers.
  Planned-at stays `8f04751`.
- 048 join `remember()` excerpt was wrong even at planned-at (object
  form since `eaf1152`). Finding live (`InstallCoach` still
  account-only). Planned-at stays `8f04751`.

**Rejected:** none. Yahoo importer still YDN-gated.

**Dirty tree:** only `plans/` (047/048 review-plan rewrite + this
reconcile). Source tree clean.

**Indexed from outside this chain:** `047` skin, `048` install drawer
(re-templated to executor grade at `8f04751`, 2026-08-20 review-plan pass).

**Executable now:** `032` when a week quotes a line (047 DONE `303e7a0`,
048 DONE `505ccb2`). Yahoo still YDN-gated. Still to author: `049` voice codemod, `050` Box Score flourishes.

## Decisions locked in

### Desk performance (001–005)

- **Hard refresh = persist first**, not SSR dehydrate. `myRosterId` is auth-personalized; a public HTML cache would lie. Persist the workbook keys in localStorage; keep live scores memory-only. Dehydrate is a later pass if first *anonymous* visit matters.
- **Do not keep sheets mounted with `<Activity>` in this slice.** After 001, a remount reads the React Query cache and should paint instantly. Persist matchup `focus` in the URL (already on `/matchups`). Revisit Activity only if replay/scroll position still feels like a remount after 001–003 — and only if hidden trees pause their `refetchInterval`.

### Draft room (006–012)

- **90 seconds a pick.**
- **A missed clock turns autodraft on and leaves it on** until the manager turns
  it off — not a one-off autopick. Someone away for one pick is usually away for
  the next, and a 90-second stall every round is worse for the nine people who
  are present than an autopick is for the one who is not. Consequence: the queue
  stops being a convenience and becomes the thing that drafts your team, which
  is why 010 is a companion to 009 rather than optional.
- **Expiry is checked on read, not only on cron.** There is no socket layer and
  `/api/league/tick` is hourly, so a deadline nobody acts on would let a board
  sit dead for up to 59 minutes. `loadDraft` advances a stalled board, so
  whoever is looking keeps it moving. Every advance is a **conditional write** so
  two clients cannot double-advance. This is the single most important decision
  in the slice — see 008.
- **The pick on the clock cannot be traded.** Otherwise the new owner either
  inherits a half-spent clock or gets a fresh one, and a fresh one turns "trade
  the pick you are on" into an unlimited stall button. Every future pick, every
  drafted player and any FAAB stays tradeable.
- **No future-season picks.** This year's board only.
- **The mock uses the league's scoring book**, has no clock, and its history is
  **ephemeral** — in memory while the page is open, gone on reload.

### League memory (013–014)

- **The ledger was written before anything read it** and is already
  accumulating. 013 is the rollup half; 014 is the consumer.
- **Facts are threshold-gated.** A fact that fires in week 1 is noise, and noise
  is what makes generated writing feel generated. An empty fact list is a correct
  answer.
- **At most two facts per desk edition.** The cap is the feature; raising it
  turns the desk into a trivia column.

### Projections and the trade desk (015–021)

- **Projections come from Sleeper's weekly feed, scored under each league's own
  book.** Verified live: `/projections/nfl/{season}/{week}` answers 200 and
  returns 26 QB / 78 RB / 124 WR / 73 TE with real numbers for week 8 of 2025.
  Crucially it returns **raw components** (`pass_yd`, `rush_yd`, `rec`, …), not
  just `pts_ppr` — so it goes through `applyBook()` exactly like an actual week
  and a half-PPR league sees a half-PPR number. Storing or showing `pts_ppr`
  directly is the bug this avoids.
- **`perGameUnder` stays as the fallback**, and a projection sourced from it is
  labelled `season-avg` rather than passed off as a forecast.
- **A trade is priced by replacement value, never by summing the assets.** Fill
  the starting lineup best-first before and after, and diff the totals. Trading
  a QB1 while holding a QB2 costs the gap, not the score; trading a bench player
  costs nothing. This is the single most important idea in the slice.
- **No trade grades.** The app states what changes (`+2.1 projected`) and never
  whether it is a good deal — the projection cannot support that claim. Plan 021
  enforces it with a test that fails on evaluative words.
- **The read line is deterministic, not a model call.** One short sentence over
  numeric inputs; a model would add latency and a chance of inventing a figure.
  The richer, model-written voice lives in the desk (013/014), where facts are
  already threshold-gated.
- **Rest-of-season projections are deferred.** A weekly number is not a season
  value, and blending them silently would be dishonest. Its own plan when wanted.

### Agent-native foundation (022–026)

- **The engine is already the product.** ~50 server fns, a scoring book, FAAB,
  trades, a house book, an event diary. 024 names those verbs in
  `src/lib/agent/` + `scripts/ledger.mjs` (reads only).
- **Features are still code, used via prompts.** "Add betting by describing
  it" already happened as a human vertical slice (`wagers.server.ts`). The
  next market is a registry (not in this slice) sitting on a conserved FAAB
  purse. 022 pins the purse *before* 024 lets an agent stake it.
- **Do not wrap `tickAllLeagues` as a tool.** 023 secrets the URL; 024 omits
  it from the catalog.
- **Skin is an overlay, not a fork.** 026 extracts `src/skin/*`. Do not
  unbrand `public/__grok/install` or delete `grokPwaPlugin`.
- **One installed PWA named open-ff**, `start_url=/`. Not a per-league icon.
- **Events stay a diary.** Mechanics stay on tables. 024 exposes `readEvents`
  / facts as reads.
- **Product name is open-ff.** License is MIT. (025 / 026)
- **Join stays invite-code.** Allowlist + member reads landed in **028**.
- **Mutating wager CLI is still off.** 027 closed the mint; 033 wires
  `placeWager` behind `--write` **after** 038 (context dump). Do not
  ship a write CLI that cannot see spendable.
- **Postgres stays the source of truth.** Files-as-interface from the
  Every guide is the wrong storage bet for a multi-manager money
  system. Agents get a legible catalog + a live context dump
  (`getAgentContext`), not a notes-folder rewrite.
- **Operator CLI ≠ manager session.** `ledger.mjs` / MCP stdio +
  `DATABASE_URL` + `OPENFF_USER` is the commish-on-the-box path.
  A hosted friend uses a personal `off_` token (041), never a
  client-supplied `userId`. No shared league API key.
- **MCP is the plug, skills are the features, plugins are a box.**
  Build one server (`dispatch` + `AGENT_CORE`) and three markdown
  skills. Do not build a Codex app, a Claude app, and a Grok app.
  A `/plugin` marketplace listing is packaging for later.
- **Conservation is a guardrail, not a workflow tool.** `applyLoss` /
  `spendable` / execute-trade refusal stay in code. Judgment about
  *whether* to stake belongs in the prompt.
- **Engine stays UI-blind.** No `renderMatchupHtml` in the catalog.
  Generative UI / voice / Codex artifacts are clients.
- **Connectors vs the engine.** League Loom / Flaim are read-only
  MCP cables into ESPN/Sleeper. Steal: paste-one-URL hosted MCP
  (043), prompt library as skills (044), “live data not memory,”
  confirm-before-write. Do not steal: unrevokable sealed cookies,
  18 analysis mega-tools, Fantrax/10-sports, staying on ESPN
  forever. After 045 import, **we** are the league. Writes
  (sit/start/claim/trade/wager) are the wedge they cannot copy
  without becoming us.
- **Self-host is the product, not a mode.** We do not run a
  multi-tenant open-ff.com. A commish deploys *their* origin and
  may run **many leagues** on it (`/new` or import each; each has
  its own invite code). Pays only the host. Sleeper/ESPN stay free
  non-commercial at household scale (a handful of leagues, not
  thousands). MCP (041–043) talks to **their** URL, not ours.
- **Migrate is one-way. Auth is a pump, not a bridge.** Private
  ESPN/Yahoo login (or Sleeper id) exists so we can **extract
  once** and bootstrap seats, settings, rosters, this-season
  weeks. Then the other site is done. No live two-way sync, no
  writing lineups back to ESPN/Sleeper, no keeping espn_s2 as
  standing auth. Manual paste/PDF is the same pump without
  login. After commit, sit/start/FAAB happen **here**. (Sleeper
  the *NFL player/week stats pipe* is unrelated — that is public
  score data, not “your Sleeper league stays connected.”)

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001  | League tabs are in-app Links; router preloads on intent | P1 | S | — | DONE `e79cfbc` (pushed 2026-08-23) |
| 002  | Never unmount last-known data; never lie about empty | P1 | S | — | DONE `ae6e12d` (pushed 2026-08-23) |
| 003  | Shared QueryClient + loaders warm the next sheet | P1 | M | 001 | DONE `2f203be` (pushed 2026-08-23) |
| 004  | Persist the workbook across refresh | P1 | M | 003 | DONE `9948a37` (pushed 2026-08-23) |
| 005  | Cheap GETs: no tick-on-read, no extra bundle | P2 | M | — | DONE `deab224` (pushed 2026-08-23; step 4 slim week-stats skipped) |
| 006  | Draft schema — clock deadline, sticky autodraft, pick queue | P1 | S | — | DONE `32fc696` (pushed 2026-08-23) |
| 007  | Draft board grid — every pick visible at once | P1 | M | — | DONE `304cfb7` (pushed 2026-08-23) |
| 008  | Draft clock — 90s a pick, advanced by whoever is looking | P1 | M | 006 | DONE `6ef392e` (pushed 2026-08-23; live expiry race not exercised — no unlocked draft) |
| 009  | Sticky autodraft after a missed pick | P1 | S | 006, 008 | DONE `7cfd24c` (pushed 2026-08-23; live toggle tests skipped) |
| 010  | Draft queue — the list that drafts for you | P1 | M | 006, 009 | DONE `ee66f0a` (pushed 2026-08-23) |
| 011  | Mid-draft trading — picks, drafted players, FAAB | P2 | M | 007 | DONE `cf6fa91` (pushed 2026-08-23; live trade tests skipped — no signed-in mid-draft league) |
| 012  | Mock draft — the same room with the writes turned off | P3 | M | 007, 010 | DONE `81b0c4c` (pushed 2026-08-23) |
| 013  | Derived league facts — roll the ledger into standing facts | P2 | M | — | DONE `5009378` (pushed 2026-08-23; `832ba4e` locked-only, `ce31848` format) |
| 014  | The desk remembers — feed facts into the weekly write-up | P2 | S | 013 | DONE `7af3716` (verified `e6d44de`: desk calls `loadLeagueFacts`) |
| 015  | Live weekly projections — a number that moves | P1 | M | — | DONE `d6d855d` (pushed 2026-08-23) |
| 016  | Replacement value — price a trade by the lineup it produces | P1 | S | — | DONE `7af4bf4` (verified `e6d44de`: `lineup-value.ts`) |
| 017  | The player stat row — avatar, projection, rank, shape | P1 | M | — | DONE `553f159` (pushed 2026-08-23) |
| 018  | The offer card — decide with the facts in front of you | P1 | M | 016, 017 | DONE `5b092fa` (pushed 2026-08-23) |
| 019  | The composer — a readable deal, and FAAB you can send | P2 | L | 016, 017, 018 | DONE `ec855c3` (verified: composer sends `kind: "faab"`) |
| 020  | Three-team trades — every asset says where it lands | P3 | M | 019 | DONE `4356a5e` (pushed 2026-08-23) |
| 021  | The read line — one sentence that arranges the numbers | P3 | S | 016, 018/019 | DONE `7e6cac7` (verified: `trade-read.ts`) |
| 022  | Prove FAAB, settlement, and clock with tests | P1 | M | — | DONE `ec0bd72` (031 unskipped spendable/atRisk math; mint case flipped in 027) |
| 023  | Close the public clock, invite leak, and bid leak | P1 | S | — | DONE `d9083ad` (verified: `CRON_SECRET` + commish-only invite) |
| 024  | Publish the primitive catalog and a thin tool surface | P1 | M | 022, 023 | DONE `7f5a247` (verified `b918703`: catalog + `getEvents` / `getLeagueFacts` + `scripts/ledger.mjs`) |
| 025  | Make a stranger able to run a league | P1 | M | 023 | DONE `f738a3b` (verified: `open-ff`, README, LICENSE, PGLite `dataDir`) |
| 026  | Skin contract + scan-to-homescreen | P2 | M | 025 | DONE `b918703` (verified: `src/skin/*`, join keeps `?code=`) |
| 027  | Stop a lost wager from minting FAAB | P1 | M | 022 | DONE `9f512b5` (verified `dd9bc53`: `applyLoss` + `movePool(poolCredit)`) |
| 028  | Invite-only desk — allowlist emails and member reads | P1 | M | 023 | DONE `fe3d1a6` (verified `dd9bc53`: allowlist + viewer on listed wrappers) |
| 029  | Exercise the FAAB wager ticket for real | P2 | M | — | DONE `dd9bc53` (verified: `wager-qa.mjs` + testids; preseason no-price) |
| 030  | Require a seat for every hosted league GET | P1 | S | 028 | DONE `4fd580c` (pushed 2026-08-23; eight hosted GETs + source test) |
| 031  | Prove spendable and atRisk without a live database | P2 | S | 027 | DONE `443b8ac` (pushed 2026-08-23) |
| 032  | Re-run the wager script when a week has a live line | P3 | S | 029 | TODO (ops; execute 2026-08-20 STOPPED — still no live line; no commit) |
| 033  | Let the CLI place a wager when asked in writing | P2 | M | 027, 038 | DONE `262717f` (pushed 2026-08-23) |
| 034  | Let a commish download their league | P2 | M | 025 | DONE `0764e94` (pushed 2026-08-23; DeleteLeague untouched) |
| 035  | Optional native Google sign-in for self-host | P2 | M | 025 | DONE `112f48a` (pushed 2026-08-23) |
| 036  | Let a commish delete a league they run | P2 | M | 034 | DONE `fa38680` (verified `7545fdb`: type-name confirm; 034 skipped) |
| 037  | Web Push after someone actually installs the PWA | P3 | L | 026 | DONE `07ca3c3` + `fc4ef7f` + `84d684e` (pushed 2026-08-23; operator waived install gate) |
| 038  | One dump: seat, spendable, facts, verbs | P1 | M | 024 | DONE `e876e59` (pushed 2026-08-23) |
| 039  | Pull an open ticket from the book list | P1 | S | 024 | DONE `6a77792` (pushed 2026-08-23) |
| 040  | Refuse a FAAB trade the sender cannot cover | P1 | S | 027 | DONE `ff3d01b` (pushed 2026-08-23) |
| 041  | Mint a personal token so a host can act as a seat | P1 | M | 038 | DONE `9537500` (pushed 2026-08-23) |
| 042  | Speak MCP on stdio (local Codex / Claude / Grok) | P1 | M | 038, 033 | DONE `337ed25` (biome `e72f4cb`; not pushed) |
| 043  | Serve the same MCP over HTTP with the token | P1 | M | 041, 042 | DONE `9af8eff` (pushed 2026-08-23) |
| 044  | Skills: migrate, lineup, book | P1 | S | 042 | DONE `969cf73` (worktree; not pushed) |
| 045  | Canonical import pack; file fallback; no NFL scrape | P1 | L | 044 | DONE `6a0df03` (split `29f7a2e`; not pushed) |
| 046  | Dead-simple self-host (Docker + in-process tick) | P1 | M | 025 | DONE `c1769d2` (secret persist `bb965bd`; not pushed) |
| 047  | Runtime skin system (Ledger + Box Score) | P2 | M (slice 1) | 026 | DONE `ed6cdd4`+`303e7a0` (pushed 2026-08-23; reviewed/APPROVED 2026-08-20; slice 1 = tokens+plumbing+boxscore.css behind /account picker; voice codemod + flourishes still owed as 049/050 before the Box Score release is cut) |
| 048  | Install drawer (dartwords-style A2HS) | P2 | M | 026, 047 | DONE `505ccb2` (pushed 2026-08-23; reviewed/APPROVED 2026-08-20; real-device iOS A2HS + Android native prompt PENDING OPERATOR; one sanctioned out-of-scope touch: scripts/join-redirect.test.mjs assertion updated for the InstallCoach removal) |
| 049  | Voice codemod — semantic label/card classes per skin | P2 | M | 047 | DONE `cfbacc8`+`06091c8` (pushed 2026-08-23; reviewed/APPROVED 2026-08-20; 57 files, Ledger pixel-identical, Box Score voice live; one revision: state-driven `ring-card-lit` for the import dropzone) |
| 050  | Box Score flourishes — ghost numerals, rails, stamp | P2 | M | 047, 049 | DONE `8e660ba` (pushed 2026-08-23; reviewed/APPROVED 2026-08-20; all CSS-gated, Ledger zero-change verified; **Box Score release complete: 047+049+050**) |
| 052  | BYOK AI foundation + import analyst (AI SDK multi-provider) | P2 | L | — | DONE `38186f9` (not pushed→pushed; reviewed/APPROVED 2026-08-20; one mid-flight STOP correctly raised: agent-catalog parity — resolved by registering the 5 fns; follow-up: scoring-record extraction thinner than slots in live smoke test — prompt/schema tuning candidate 053) |
| 053  | Liveline foundation — `<LiveLine>` wrapper, series utils, dev gallery | P1 | M | — | DONE `89ced48` (pushed 2026-08-23; reviewed/APPROVED 2026-08-21; 17+3 tests; `/dev/liveline` gallery; executor fixed fractional-seconds label bug + import-rule test self-match) |
| 054  | Player projection line — drawer, sheet, player page, lineup pace toggle | P1 | L | 053 | DONE `b4574bd` (pushed 2026-08-23; reviewed/APPROVED 2026-08-21; 10 new tests; executor fixed playWhen 900s offset + a render loop in the series hook; player page left without the block — no weekly projection on that route; bench rows on the box-score route not threaded) |
| 055  | Matchup finals chart + home win-prob meter + `ff_ticks` writer (on read + tick) | P1 | L | 053, 054 | DONE `9b8f62e`+`fdfd48c`+`8c31e11`+`efabd40` (pushed 2026-08-23; reviewed/APPROVED 2026-08-21 after 2 revision rounds: no sample until outlooks load, caption clears the time axis; getTicks registered in the agent catalog — sanctioned out-of-scope touch) |
| 056  | The book's line-movement strip (LinePanel + ticket) + in-play wagering spec | P2 | M | 055 | DONE `7ce8cef` (pushed 2026-08-23; reviewed/APPROVED 2026-08-21; strip quiet + opened/now caption; in-play wagering left as spec in the plan file — not built) |

| 057  | Ledger·Bot tokens + type — off-white ground, ringed white cards, Geist, sans eyebrows, `.push` zeroed | P1 | M | — | DONE `2a9b93f` (pushed 2026-08-23; reviewed/APPROVED 2026-08-23; 2 new skin tests; gate green; Box Score verified unchanged) |
| 058  | Ledger·Bot primitives — ink primary pill, sans badges, one segmented recipe, 500-weight nav/headings, edged sheets | P1 | M | 057 | DONE `a33f297`+`3b905a2` (pushed 2026-08-23; reviewed/APPROVED 2026-08-23; 30 files, class strings only; 1 new skin test; 2 leftover `bg-bg/50` scrims in player-watch/player-peek were out of scope → folded into 059) |
| 059  | Ledger·Bot mobile polish — header/thumb bar/masthead/week pill, matchup-edge caption wrap fix, dev toolbar | P2 | M | 058 | DONE `7d11914`+`ca770a1` (pushed 2026-08-23; reviewed/APPROVED 2026-08-23; caption ≤2 lines verified at 390px; 1 new skin test; week-picker kept `group`/focus classes — sanctioned) |
| 060  | Shell gestures — thumb bar hides on scroll-down, re-tap = top | P1 | S | — | DONE `e84ea66` (pushed 2026-08-23; reviewed/APPROVED 2026-08-23; executor's StrictMode fix sanctioned — closure state instead of impure functional updater; 5 reducer tests) |
| 061  | Game page — pinned segment rail + swipeable Plays·Box·Scoring panes | P1 | M | 060 | DONE `3c0bd20`+`c3f4272` (pushed 2026-08-23; reviewed/APPROVED 2026-08-23 after 1 revision — short-pane landing kept in view; items-start height-sync fix sanctioned; 1 new skin test) |
| 062  | Player sheet + watch drawer on vaul — half/full detents, drag dismiss | P2 | M | 061 | DONE `75475d2` (pushed 2026-08-23; reviewed/APPROVED 2026-08-23; reduced-motion → [1] only; deps-array deviation sanctioned; 1 new skin test) |
| 063  | Matchup page — score card swipes the week's slate, page re-anchors on settle | P2 | M | 062 | DONE `d2b1242` (pushed 2026-08-23; reviewed/APPROVED 2026-08-23; settle→navigate replace:true, no ping-pong; snap-settle helper + 6 tests; deps [matchupId, slate.length] deviation sanctioned) |
| 064  | Gate the matchup liveline until kickoff; stop the tab-switch reveal flicker | P1 | S | 063 | DONE `fdc1bed` (pushed 2026-08-23; reviewed/APPROVED 2026-08-23; 3 new matchupChartReady tests; preseason card verified chart-free; Win%↔Margin canvas identity verified stable; executor's reported slate auto-nav quirk NOT reproduced in 16 rounds — watched, guard idea recorded in memory) |
| 065  | Box score core — stacked score card, game-pill strip, quiet rows, full bench, mini-scorebar | P1 | L | — | DONE `f2998e2`+`0725a13` (not pushed; reviewed/APPROVED 2026-08-24 after 1 reviewer fix — pace ± chips removed from rows; WP meter skipped per plan bar; bench = one-sided groups, sanctioned; WATCHED: demo replay double-paint fires a 4.5s flash burst on load, decays clean) |
| 066  | Box score desktop — pinned 400px rail (V1) | P1 | M | 065 | DONE `547d467` (not pushed; reviewed/APPROVED 2026-08-24; overflow guard added after measuring; pill-strip bleed fix sanctioned; 1 canvas verified all states) |
| 067  | Board slim-down — /matchups compares (chart leaves, compact mirror) | P2 | M | 066 | DONE `b5ca8f1`+`114777d` (reviewed/APPROVED 2026-08-24 after 1 reviewer fix — pace chips trimmed from board rows; 0 canvases verified; detail page keeps its 1) |
| 068  | Context deck: shell slot + Players page (deck, control sheet, continuous list) | P1 | L | — | DONE `0b1a5e7`+`068af75` (2026-08-24, pushed) |
| 069  | My Team deck — tracking section tabs + trade cap | P1 | M | 068 | DONE `671cb31` (2026-08-24, pushed) |
| 070  | Deck hardening — audit follow-ups on 068/069 | P2 | S–M | 069 | DONE `6b9b68d` (2026-08-24, pushed) |
| 071  | Game page tabs migrate into the deck | P1 | M | 070 | DONE `7fcf4b9` (2026-08-24, pushed) |
| 072  | Box score slate + mini-score join the deck | P1 | M | 070 | DONE `7ded760` (2026-08-24, pushed) |
| 073  | Matchups week slate as deck pills | P2 | M | 070 | DONE `c9885cd` (2026-08-24, pushed) |
| 074  | League Table·Recap route deck | P2 | S | 070 | DONE `f98ccf2` (2026-08-24, pushed) |
| 075  | Extract useIsPhone to src/lib | P3 | S | — | DONE `aed1652` (2026-08-24, pushed) |
| 076  | Week pill + sheet on the deck pages | P2 | M | 075 | DONE `a5b4d7f` (2026-08-24, pushed) |
| 077  | Deck handoff at md + week pill outside the slate gate | P1 | S–M | 076 | DONE `74d6b6f` (2026-08-24, pushed) |
| 078  | "Console" — third runtime skin, tokens + registration | P1 | S–M | — | DONE `3a1674b` (2026-08-26, not pushed; reviewed/APPROVED same session; token-layer only, Ledger byte-identical verified in browser; structural signatures deferred to 079+) |
| 079  | Console voice recipes — ent links, zebra, band heads, field well, badges | P1 | M | 078 | DONE `2969bf2` (2026-08-26, not pushed; 3rd dispatch, reviewed/APPROVED same session; attempts 1–2 correctly self-stopped on a Tailwind v4 cascade-layer collision — `@layer utilities` classes on `Input`/`Badge` silently beat `@layer components` recipe overrides on the same property, fixed via unscoped `.field`/`.badge-default` base rules mirroring `.ring-card` + stripping the competing utilities (`rounded-md`/`shadow-[...]`, `bg-fg/6`/`text-muted`); every property in all 5 recipes re-verified live via `getComputedStyle` across all 3 skins × both themes before landing; Ledger/Box Score byte-identical) |
| 080  | Console voice, part 2 — ent on the two remaining score-card team names | P2 | S | 079 | DONE `7899535` (2026-08-26, not pushed; reviewed/APPROVED same session; additive-only per design decision — full side-by-side "duel" redesign deliberately deferred as it would reopen the locked Box Score stacked-row layout (065–067); `.ent` hooked on ScoreRow + SideRow team-name spans only; Ledger/Box Score verified inert) |
| 081  | Agent catalog: wire 26 safe read-only primitives onto MCP | P1 | L | — | DONE `57cd28c` (2026-08-26, not pushed; reviewed/APPROVED same session; `AGENT_CORE` now 46/76 ids; two sanctioned deviations — getScores/getLiveWire moved to membership-only tests since their args are fully optional (no rejection to assert), and two small typed array-coercion helpers (`strArray`/`playerRows`) added to dispatch.ts instead of unsafe casts) |
| 082  | Agent catalog: round out queue/waiver/trade verb completion (7 ids) | P1 | M | 081 | DONE `d165f0c` (2026-08-26, not pushed; reviewed/APPROVED same session; `AGENT_CORE` now 53/76 ids; no deviations, matched plan verbatim) |
| 083  | Agent catalog: complete migrate story — ESPN + rebuild import (4 ids) | P2 | M | 082 | DONE `b04b795` (2026-08-26, not pushed; 2nd dispatch, reviewed/APPROVED same session; 1st attempt correctly self-stopped on a real inaccuracy in the plan's importRebuild signature citation (pdfBase64 is optional on the real function, plan wrongly said it wasn't) — plan corrected, re-dispatched, landed clean; `AGENT_CORE` now 57/76 ids (75%); swid/espnS2 confirmed never logged; stale sentence in open-ff-migrate SKILL.md flagged for a follow-up docs plan) |
| 084  | Reposition README as headless operator + fix stale migrate-skill claim | P1 | M | 081, 082, 083 | DONE `a4a4915` (2026-08-26, not pushed; reviewed/APPROVED same session; new "What this is" section + Agent hosts/skills relocated up front; migrate SKILL.md's stale "not on the MCP socket" claim fixed for ESPN/rebuild; `.grok/skills/open-ff-migrate` confirmed a symlink, not a separate mirror — no drift risk there ever) |
| 085  | Add a Quickstart + turn the import table into a real migration guide | P1 | M | 084 | DONE `d2746f6` (2026-08-26, not pushed; reviewed/APPROVED same session; new Quickstart section links run/migrate/connect-an-agent; "Players and imports" reworked into "Migrating your league" — narrated per-source steps using the actual `/import` UI labels (Sleeper/ESPN/**Draft** tabs, `espn_s2` field name) confirmed by direct read of import.tsx, table kept as reference underneath) |
| 086  | Rename product identity open-ff → open-leagues (safe surface only) | P1 | L | — | DONE `68e95a2` (2026-08-26, not pushed; reviewed/APPROVED same session; package.json, `OPENFF_*`→`OPENLEAGUES_*`, MCP server identity, 4 skill dirs + symlinks + test, docker-compose volume, README/docs identity text with the real clone URL, all mechanical/verified; deliberately does not touch `ff_*` DB tables or `off_` token prefix — separate, more carefully gated plan 088; 4 residuals (a2hs keys, login copy, backup filename) correctly deferred to 087, SKILL.md body prose deferred further) |
| 087  | Rename residuals plan 086 correctly left out of scope | P3 | S | 086 | DONE `b0ebdbe` (2026-08-26, not pushed; reviewed/APPROVED same session; login page copy, 3 a2hs localStorage keys, backup filename all now say open-leagues; SKILL.md body prose + ff_*/off_ DB layer deliberately still deferred) |
Status values: TODO | IN PROGRESS | DONE | BLOCKED | REJECTED

## Dependency notes

### 001–005

- 001 and 002 can run in parallel. Prefer 001 first — it is the largest perceived win and unblocks hover-preload.
- 003 depends on 001 (`defaultPreload` only helps if tabs are `<Link>`). It also introduces `src/lib/query-client.ts`, which 004 extends.
- 004 depends on 003 so persist attaches to the *router* QueryClient, not a second client created in `__root.tsx`.
- 005 is independent of the client plans. Can ship anytime; cheapest after 003 so loaders are not amplifying expensive GETs.

### 006–014

- **006 blocks 008, 009 and 010** — they read columns it adds. It is 30 minutes
  and changes nothing user-visible, so do it first regardless of what else is
  planned.
- **007 is independent of 006.** It reads no new columns and adds no writes,
  which makes it the safest thing to ship first if you want visible progress.
- **008 → 009 → 010 is a hard chain.** 009 modifies the `stampDeadline` and
  `expireDraftPicks` that 008 creates; 010 modifies the `autopickFor` that 008
  extracts.
- **011 is parallelisable** with 008–010. It only needs 007 for the board to
  render a traded pick, and touches `ops.server.ts` rather than the draft engine.
- **012 needs 007 and 010** because it reuses `DraftBoard` and the queue panel
  unchanged. If it cannot reuse them, that is a signal 007 built the board too
  specifically — treat it as a STOP, not a fork.
- **013 and 014 are independent of the whole draft slice.** They can run at any
  time by a second executor. 014 needs 013.

### 015–021

- **015 is independent and highest leverage.** Six surfaces read through
  `projectPlayers` / `outlooksFor` — the lineup board, the matchup spread, win
  probability, the waiver dialog, and the whole trade desk — so it upgrades all
  of them at once. Everything in 016–021 is *correct* without it but works off a
  flat season average until it lands.
- **016 and 017 are independent of each other** and both independent of 015.
  Two executors can take one each.
- **018 needs 016 and 017.** It is the highest-value trade surface and the
  cheapest: no new state, no new mutation, a better rendering of data the page
  already fetches.
- **019 needs 018** only for the `?counter=` param it consumes; the rest is
  independent. It is the largest plan in the slice.
- **020 extends 019** and finishes removing `AssetCol`. 019 is explicitly told
  to leave the existing three-team code path working rather than redesign it.
- **021 needs 016** plus whichever of 018/019 exists.
- **Relationship to 011 (in-draft trading):** separate work, no dependency in
  either direction. 011 built `src/components/draft-trade-drawer.tsx` for
  trading *during a draft*; 015–021 rebuild the season-long trade desk. Both
  could share `PlayerStatRow` from 017 as a follow-up — worth doing so the two
  trade surfaces look alike, but neither blocks the other and 017 is told not to
  touch the drawer.

### 064 (liveline gate)

- **Wait for 063.** 064 does not edit `$matchupId.tsx` (MatchupEdge only), but
  063 still owns that route. Do not start 064 while 063 is IN PROGRESS.
- **Does not depend on 055's code landing again** — 055 is DONE; this is a
  correction to its `started` gate (`samples.length >= 1` was too eager).

## Known repo hazards (read before executing 006–014)

- **`src/lib/league/engine.server.ts` is `// @ts-nocheck`.** `npm run typecheck`
  will not check anything inside it, though exported signatures still bind
  consumers. The trap: add a field to a declared return type, forget it in the
  returned object, and typecheck passes while the field is `undefined` at
  runtime. Plans 007–010 each restate this; verify engine return fields in the
  browser Network tab, not with typecheck.
- **`npm test` runs `node --test 'scripts/**/*.test.mjs'`** — build scripts
  only. There is no engine, DB or component test harness, and none of these
  plans stands one up. Verification is typecheck + build + a scripted
  `npx vite-node` call + manual steps.
- **`biome.json` now exists** and pins `indentStyle: "space"`. The old
  "do not `--write`" hazard is gone. `bun run lint` is the gate.
- **`bun test` is `bun test src scripts`.** Includes scoring, odds, win%,
  mock-draft, `applyLoss`, allowlist match, catalog ids, wager testids.
  Live `spendable` / `atRisk` still skipped (PGLite cannot migrate under
  bun — no `import.meta.glob`).
- **`npm test` / vite-node notes above are stale for 022+.** Use `bun`.

## Findings considered and rejected

- **React `<Activity>` keep-alive of all five tabs (this slice):** remount + RQ cache is enough once Links exist. Hidden trees would keep 12–15s polls alive. Revisit after 001–003.
- **SSR dehydrate / HydrationBoundary (this slice):** persist covers hard refresh for returning users; hosted bundle is per-user. Do not CDN-cache league HTML.
- **Caching `myRosterId` in zustand/localStorage outside RQ:** auth-wrong after sign-out / seat claim.
- **lucide barrel / unused recharts / manualChunks:** measure `npm run build` first; not a flicker source.
- **Google font self-host:** FOUT is real but secondary; do not block 001–005.
- **Optimistic start/sit (cell edits):** high leverage, separate plan after the workbook cache exists.
- **Projections keyed by roster length:** fold into the cell-edits plan, not this slice.
- **WebSockets for the draft clock:** a whole new transport for one screen. Read-path expiry (008) reuses the polling model already in place for live scoring.
- **Client-side timers firing the pick advance:** ten browsers racing the same write, and a closed laptop stalls the draft. The client displays time; the server advances.
- **Cron-only clock enforcement:** `/api/league/tick` is hourly, so a board could sit dead for 59 minutes. Kept as the backstop, not the mechanism.
- **Pausing the draft during trade negotiation:** ten managers can negotiate indefinitely and the draft never finishes. Refusing the on-clock pick costs nothing instead.
- **Trading future-season picks:** `ff_picks` has no season column; a much larger change and only interesting for dynasty leagues. Explicitly out of scope for 011.
- **Persisting mock draft results:** ephemeral by decision. If that turns out to be wrong it is a separate plan, not a tweak to 012.
- **Recency-weighting our own season average** (instead of a real projection feed): considered for 015 and rejected once the Sleeper feed was verified to return raw components. A weighted average of past performance is still backward-looking; a projection accounts for opponent and role.
- **Using `pts_ppr` from the projections feed directly:** simpler, and wrong in every league that is not full PPR. Score the components with `applyBook()`.
- **Unifying `applyLineup` (server) and `fillLineup` (client):** would mean either exporting from a `@ts-nocheck` file or making the trade preview server-only. Duplicated deliberately, with a comment in each.
- **A trade grade or score:** the projection is a season points-per-game proxy under a book; it can compare two players, not judge a deal. Descriptive copy only.
- **Routing the trade read line through a language model:** one short sentence over numeric inputs. A model adds latency and a chance of inventing a number. The model-written voice belongs in the desk (013/014).
- **Drag-and-drop in the trade composer:** a new dependency for an interaction that click-to-add already handles.
- **Four-team trades:** `proposeTrade` permits `sides.size > 2` but nobody has asked, and the tabbed roster column in 020 does not survive it.
- **Sunday inactives sweep (90-minute pre-kickoff refresh):** the daily player
  refresh already shipped, and the locked betting rule is that a bet placed
  before news breaks is fair. That removes the requirement entirely. Not planned.
- **Event-sourcing the league from `ff_events`:** diary, not source of truth.
  024 exposes reads; it does not replay state from events.
- **In-app chat / MCP SDK in 024:** catalog + read CLI first.
- **Generic free-text wager props:** closed `WagerKind` until conservation is
  pinned (022). A `total` market is the next kind, not "anything you describe."
- **Unbranding Grok `?install=1`:** platform. 026's coach never links it
  (that URL hides `/join`).
- **Per-league home-screen icons:** one origin ≈ one PWA.
- **Service worker / Web Push in this slice:** follow-up after a friend
  actually installs. Draft 4s poll stays the in-room transport.
- **Membership-gating every GET (023):** 023 only strips invite codes and
  foreign bids. Operator later asked for invite-only / email allowlist —
  that is a new plan, not a rewrite of 023.
- **Rewriting `AGENTS.md`:** sandbox still needs it. 025 adds
  `AGENTS.project.md`.
- **Deleting `grokPwaPlugin` / `PreviewHostBridge` / `public/__grok`:**
  platform. Skin lives beside them.
- **Export/backup dump, native Google OAuth, `deleteLeague`:** real holes,
  not this slice. Backup is the next self-host gap after 025.

## Suggested first execution

**Slice 2, if you want visible progress fastest:** `006` (30 min, unblocks
everything) → `007` (the board, most noticeable) → `011` (trading, independent)
→ `008` → `009` → `010` → `012`.

**With two executors:** one runs the draft chain `006 → 008 → 009 → 010`; the
other runs `007`, then `011`, then `013 → 014`. They touch different files —
the draft chain lives in `engine.server.ts`, while 011 is in `ops.server.ts` and
013/014 are in `dispatch.ts` and a new module.

## Suggested execution — slice 3

**Single executor:** `015` → `017` → `016` → `018` → `019` → `020` → `021`.
015 first because every number downstream depends on it; 018 is the first change
anyone will actually notice.

**Two executors:** one takes `015` (server, projections); the other takes `017`
then `016` (client, pure). They meet at `018`.

## Suggested execution — slice 4 (agent-native)

**DONE.** `024` `7f5a247` · `025` `f738a3b` · `026` `b918703`.

## Suggested execution — slice 5 (purse, door, click)

**DONE.** `027` `9f512b5` · `028` `fe3d1a6` · `029` `dd9bc53`.

## Suggested execution — slice 6 (door + leftovers)

**Slice 6 leftovers are DONE** except **032** (ops; no live line).
`031` `443b8ac` · `034` `0764e94` · `035` `112f48a` · `036` `fa38680`
· `037` `07ca3c3` (install gate waived).

## Sprints to the headless engine (do these)

North star: migrate in → any client (PWA, Codex, Claude, Grok)
speaks the same verbs. PWA is client zero, not the product.

### Sprint 1 — Honest loop (in-repo, no host yet)

**DONE** (pushed 2026-08-23): `038` `e876e59` · `040` `ff3d01b` · `039`
`6a77792` · `031` `443b8ac` · `033` `262717f`.

Done when: an operator with `DATABASE_URL` can dump context and
the purse cannot mint on trade accept. Pull exists in the PWA.

### Sprint 2 — Local host (commish Codex on the box)

**DONE** (pushed 2026-08-23): `042` `337ed25` + biome `e72f4cb`.

Done when:

```
export DATABASE_URL=… OPENFF_USER=…
codex mcp add openff --command bun --args scripts/mcp.mjs
```

and “sit the injured RB” hits `sitPlayer`.

### Sprint 3 — Hosted host (a friend’s Codex)

**DONE** (pushed 2026-08-23): `041` `9537500` · `043` `9af8eff`.

Done when:

```
export OPENFF_TOKEN=off_…
codex mcp add openff --url https://HOST/api/mcp --bearer-token-env-var OPENFF_TOKEN
```

Same `dispatch`. Cookie still for the PWA.

### Sprint 4 — Playbooks (features as files)

**DONE** (pushed 2026-08-23): `044` `969cf73`.

Done when “migrate my sdiff league” is a skill over
`preview*` → `confirm: true` → `import*` (Sleeper / ESPN /
rebuild as they exist today).

### Sprint 4b — Migrate completeness (after the plug works)

`045` — one `ImportPack`, file always works, NFL.com → ESPN hop,
Sleeper prior season optional. **Yahoo OAuth only if the YDN app
is approved.** Do not block Sprints 1–4 on Yahoo.

### Sprint 5 — Self-host is the product

**DONE** except `032` (wait for a live line). `048` is install UX
and must coexist with the 037 worker (`public/sw.js`).

A commish pays **only** the host. No SportsDataIO. MCP 041–043
point at **their** origin.

### Not a sprint

Plugin marketplace, ChatGPT Actions, generative matchup UI in
*this* repo, voice host, `total` market, rename/leave/rotate
invite, `@open-ff/engine` npm extract.

## Findings considered and rejected (038 audit)

- **MCP SDK / in-app chat (038 slice):** was deferred until the
  catalog was callable. **041–044 is that later.** Still no desk
  chatbot.
- **Files as the league source of truth:** multi-manager money. Keep
  Postgres. Dump + catalog is the spirit of context.md.
- **`--user` as a hosted manager token:** operator CLI only. A hosted
  friend still uses Better Auth cookies. No PAT this slice.
- **Dispatch every catalogued read from argv:** `getAgentContext`
  covers the turn-start blob. Other reads stay HTTP / later.
- **Prompt pack / weekly-review feature:** prompts over verbs need
  verbs that run. After 038+033 have been used once.
- **Market registry / `total` / free-text props:** WagerKind stays
  `spread | moneyline` until 040's conservation is in and someone
  actually stakes.
- **Rename team / leave / rotate invite / adjust-FAAB / void-wager:**
  real CRUD holes, not this slice. They do not block sit + add +
  stake. List them; do not build them to look busy.
- **Draft / settings / FAAB-on-trade events:** diary is thin. Do not
  event-source. A later facts pass can add kinds; 038 already returns
  the last 20 rows as they are.

## Findings considered and rejected (041 audit)

- **A Codex / Claude / Grok plugin as three products:** one MCP
  server. Plugin is a later box around 042+044.
- **ChatGPT Actions / second OpenAPI surface:** MCP is the
  standard. Do not maintain two contracts.
- **Better Auth apiKey plugin:** do not rewrite `server.ts`. Own
  `ff_agent_tokens` table (041).
- **Expose all 67 tools on MCP day one:** `AGENT_CORE` only. Cora
  drowned on fat tool lists.
- **`userId` as a tool argument:** host env or `off_` token only.
- **`renderMatchupHtml` / in-repo generative UI:** a client. Not
  a verb.
- **Extract `@open-ff/engine`:** the boundary is `dispatch` +
  catalog. A package split before 043 works is a rewrite.
- **Beat League Loom at free multi-platform read-only MCP:**
  they already did that (18 tools, 2-min setup, 10 sports).
  Competing there is a trap. Optional later: a *thin* Sleeper
  read for people who have not migrated. Not a sprint.
- **Loom-style unrevokable AES credential blob:** 041 hashes
  `off_` so revoke works. ESPN cookies stay one-shot on import.

## Findings considered and rejected (022–026)

See the list above (event-sourcing, MCP SDK, free-text props, Grok install
unbrand, per-league icons, SW/push this slice).

## Open leftovers

Planned leftovers: **032**. Direction:
**047, 048**. Headless engine **038–044 DONE**. Do not re-audit as
unnamed findings.

**Console direction (078–080 DONE), 2026-08-26 scoping pass — considered and shelved:**

- **Matchup-page stat strip** (team-total × 2 cells, per the Console prototype's
  desktop `.k-stats`): rejected as scoped. The prototype's `.k-duel` (phone) and
  `.k-stats` (desktop) are mutually-exclusive responsive variants of the *same*
  head-to-head info; the app's `Scoreboard`/`ScoreRow` already serves both
  breakpoints as one component. Adding a desktop-only stat strip alongside it
  would show each team's name/score twice. Not worth doing as a small addition —
  see the duel-shell item below for the real fix.
- **Book-page stat strip** (bank/pool/closes, per the prototype's book `.k-stats`):
  rejected as scoped. "Closes" needs a lock-countdown timestamp that does not
  exist on `BookBundle` (`src/lib/league/book.server.ts`) today — real backend
  work, not a UI plan. `PurseMeter` (`src/components/book-panel.tsx`) already
  covers free/at-risk/budget on the standings page; a 2-cell partial match
  wasn't judged worth a plan on its own.
- **Nav treatment**: not rejected, just not needed — `src/components/shell.tsx`'s
  desktop header already has the switcher-pill-left / tabs-middle /
  Scores+avatar-right shape the Console mock calls for, built on the app's
  generic tokens (`bg-bg`, `border-line`, …), which already resolve per-skin.
  No plan required.
- **Book price pills + spread strip** (`LinePanel`/`WagerTicket` Console voice):
  still a live, unexplored candidate — not rejected, just not scoped yet.
- **The head-to-head "duel" shell** (avatars flanking a centered score pair +
  win-probability bar, replacing `ScoreRow`'s stacked layout): the one genuine
  buildable layout difference identified — requires restructuring `ScoreRow`/
  `Scoreboard` JSX once (shared by all 3 skins), not a CSS-only change.
  Deliberately shelved at the operator's call, 2026-08-26 — Console ships as a
  token + recipe-class skin for now. Revisit when wanted; do not silently fold
  it into a future skin plan without calling it out as the bigger lift it is.

Still unplanned, still real, still not this backlog:

- Rename team, leave/unclaim, rotate invite, update-bid, commish
  adjust-FAAB, commish void-wager.
- `/plugin` marketplace box (after someone besides us `mcp add`s).
- `total` market registry after someone has staked a spread.
- Yahoo OAuth importer until YDN review is actually approved.
- NFL.com HTML scrape (platform moving to ESPN for 2026).

- **047 — Runtime skin system** (design exploration, 2026-08-19). Goal: `data-skin`
  as a third axis beside theme and accent — Ledger untouched as default, Box Score
  (from the design canvas) as the proving skin, token contract widened so radii,
  type, label voice, and card structure swap per skin without component forks.
- **048 — Install drawer** (2026-08-19). Goal: dartwords-style Add-to-Home-Screen
  bottom sheet — engagement-triggered, glyph-step instructions, native prompt on
  Android — replacing the quiet InstallCoach card. PWA manifest/middleware stay
  as-is. **037 already shipped `/sw.js`** — 048 must not replace it.
