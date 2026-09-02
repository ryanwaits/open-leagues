import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { InviteCard, usePageOrigin } from "@/components/invite-card";
import { disablePushForLeague, enablePushForLeague } from "@/components/push-register";
import { ScheduleDesk } from "@/components/schedule-desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle } from "@/lib/data/fns";
import {
  addAllowlistEmail,
  advanceWeek,
  claimRoster,
  deleteLeague,
  exportLeague,
  getSettings,
  listAllowlist,
  processWaivers,
  removeAllowlistEmail,
  saveSettings,
} from "@/lib/league/fns";
import { invalidateAfterRosterMove } from "@/lib/league/lineup-cache";
import { defaultPlayoffByes, describeBracket } from "@/lib/league/playoffs";
import {
  countsFromSlots,
  describeSlots,
  presetIdOf,
  ROSTER_PRESETS,
  SLOT_STEPPERS,
  type SlotCounts,
  slotsFromCounts,
} from "@/lib/league/roster";
import { bookFromPreset, SCORING_FIELDS, type ScoringBook } from "@/lib/league/scoring";
import { pushStatus } from "@/lib/push/fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/settings")({
  component: SettingsPage,
});

const GROUPS = [...new Set(SCORING_FIELDS.map((f) => f.group))];

function SettingsPage() {
  const { leagueId } = Route.useParams();
  const fieldId = useId();
  const origin = usePageOrigin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings", leagueId],
    queryFn: () => getSettings({ data: { leagueId } }),
  });
  // Already cached by the league layout, so this costs nothing.
  const bundle = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const [name, setName] = useState("");
  const [book, setBook] = useState<ScoringBook>({});
  const [playoff, setPlayoff] = useState(4);
  const [week, setWeek] = useState(1);
  const [waiverType, setWaiverType] = useState("faab");
  const [faab, setFaab] = useState(100);
  const [deadline, setDeadline] = useState(11);
  const [pStart, setPStart] = useState(15);
  const [regular, setRegular] = useState(14);
  const [byes, setByes] = useState(0);
  const [counts, setCounts] = useState<SlotCounts>(countsFromSlots(ROSTER_PRESETS[0]!.slots));
  const [bettingOn, setBettingOn] = useState(false);
  const [poolSeed, setPoolSeed] = useState(200);
  const [wagerCap, setWagerCap] = useState(25);
  const [exposureCap, setExposureCap] = useState(60);

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.name);
    setBook(q.data.book);
    setPlayoff(q.data.playoffTeams);
    setWeek(q.data.currentWeek);
    setWaiverType(q.data.waiverType ?? "faab");
    setFaab(q.data.faabBudget ?? 100);
    setDeadline(q.data.tradeDeadlineWeek ?? 11);
    setPStart(q.data.playoffStartWeek ?? 15);
    setRegular(q.data.regularWeeks ?? 14);
    setByes(q.data.playoffByes ?? defaultPlayoffByes(q.data.playoffTeams));
    if (q.data.slots?.length) setCounts(countsFromSlots(q.data.slots));
    setBettingOn(q.data.bettingOn);
    setPoolSeed(q.data.poolSeed);
    setWagerCap(q.data.wagerCap);
    setExposureCap(q.data.exposureCap);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          leagueId,
          name,
          book,
          playoffTeams: playoff,
          currentWeek: week,
          waiverType,
          faabBudget: faab,
          tradeDeadlineWeek: deadline,
          playoffStartWeek: pStart,
          regularWeeks: regular,
          playoffByes: byes,
          slots: slotsFromCounts(counts),
          bettingOn,
          poolSeed,
          wagerCap,
          exposureCap,
        },
      }),
    onSuccess: async () => {
      toast("Settings saved. Scoring applies to unlocked weeks.");
      await qc.invalidateQueries({ queryKey: ["league", leagueId] });
      await qc.invalidateQueries({ queryKey: ["settings", leagueId] });
      await qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
      await qc.invalidateQueries({ queryKey: ["team"] });
      await qc.invalidateQueries({ queryKey: ["book", leagueId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not save."),
  });

  const claim = useMutation({
    mutationFn: (rosterId: number) =>
      claimRoster({
        data: {
          leagueId,
          rosterId,
          code: q.data?.inviteCode ?? null,
        },
      }),
    onSuccess: async () => {
      toast("Seat claimed.");
      await qc.invalidateQueries({ queryKey: ["league", leagueId] });
      await qc.invalidateQueries({ queryKey: ["settings", leagueId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not claim."),
  });

  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({
      group: g,
      fields: SCORING_FIELDS.filter((f) => f.group === g),
    }));
  }, []);

  if (q.data == null && q.isPending) return <Skeleton className="h-64" />;
  if (q.error || !q.data) {
    return (
      <p className="text-sm text-muted">
        Settings live on hosted Ledger leagues.{" "}
        <Link to="/import" className="text-fg underline">
          Import one
        </Link>{" "}
        or create a desk.
      </p>
    );
  }

  const locked = q.data.locked || !q.data.isCommish;

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-[-0.02em]">League setup</h1>
        <p className="mt-1.5 text-sm text-muted">
          {q.data.isCommish
            ? "You run this league. Everything here is yours to change."
            : "Read-only. Your commissioner can change these."}
        </p>
      </header>

      {/* The draft lives here rather than in the tab bar: it happens once, and
          on the night it matters it deserves the whole screen, not a tab. */}
      <Link
        to="/league/$leagueId/draft"
        params={{ leagueId }}
        className="flex items-center justify-between gap-4 rounded-xl bg-surface px-5 py-4 ring-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 ring-card-h"
      >
        <span>
          <span className="block font-display text-lg font-medium tracking-[-0.02em]">
            Draft room
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            {bundle.data?.draftStatus === "live"
              ? "Live now. Somebody is on the clock."
              : bundle.data?.draftStatus === "complete"
                ? "Complete. Open the board to review it."
                : "Not started yet."}
          </span>
        </span>
        <span className="microlabel text-accent-strong">Open</span>
      </Link>

      <PushOptIn leagueId={leagueId} hasSeat={bundle.data?.myRosterId != null} />

      <section>
        <p className="microlabel">
          {q.data.source === "sleeper" ? "Imported from Sleeper" : "Hosted on Ledger"}
          {q.data.sourceLeagueId ? ` · ${q.data.sourceLeagueId}` : ""}
        </p>
        <h2 className="mt-1 font-display text-2xl">League</h2>
        <label htmlFor={`${fieldId}-name`} className="mt-4 block max-w-md">
          <span className="microlabel">Name</span>
          <Input
            id={`${fieldId}-name`}
            className="mt-1.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={locked}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-6">
          <label htmlFor={`${fieldId}-week`} className="block">
            <span className="block microlabel">Current week</span>
            <Input
              id={`${fieldId}-week`}
              className="mt-1.5 w-24"
              type="number"
              min={1}
              max={18}
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              disabled={locked}
            />
          </label>
        </div>
        {q.data.isCommish && q.data.inviteCode ? (
          <InviteCard code={q.data.inviteCode} origin={origin} />
        ) : null}
        {q.data.isCommish ? <AllowlistPanel leagueId={leagueId} locked={q.data.locked} /> : null}
      </section>

      <section>
        <h2 className="font-display text-2xl">Roster</h2>
        <p className="mt-1 text-sm text-muted">
          Starters and bench. 3 WR with a W/R and no FLEX is a common 14-team book. Saving re-seats
          everyone into the new lineup.
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {ROSTER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={locked}
              onClick={() => setCounts(countsFromSlots(p.slots))}
              className={cn(
                "h-10 rounded-sm px-3 font-mono text-sm",
                presetIdOf(slotsFromCounts(counts)) === p.id
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-surface px-4 py-3 font-mono text-xs text-muted ring-card">
          {describeSlots(slotsFromCounts(counts))}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SLOT_STEPPERS.map((row) => {
            const n = counts[row.key];
            return (
              <div
                key={row.key}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2.5 ring-card"
              >
                <span>
                  <span className="block text-sm">{row.label}</span>
                  <span className="block microlabel-data">{row.hint}</span>
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={locked || n <= 0}
                    onClick={() => setCounts((c) => ({ ...c, [row.key]: Math.max(0, n - 1) }))}
                    className="grid size-9 place-items-center rounded-sm bg-raised text-muted disabled:opacity-30"
                    aria-label={`Fewer ${row.label}`}
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-mono text-sm tabular-nums">{n}</span>
                  <button
                    type="button"
                    disabled={locked || n >= row.max}
                    onClick={() =>
                      setCounts((c) => ({ ...c, [row.key]: Math.min(row.max, n + 1) }))
                    }
                    className="grid size-9 place-items-center rounded-sm bg-raised text-muted disabled:opacity-30"
                    aria-label={`More ${row.label}`}
                  >
                    +
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Playoffs</h2>
        <p className="mt-1 text-sm text-muted">
          How many make it, who sits the first week, and when the dance starts. A 14-team desk
          usually wants 7 in and the 1-seed on a bye. Later rounds reseed — best leftover vs worst
          leftover.
        </p>
        <div className="mt-4">
          <p className="microlabel">Teams in</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {[4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                type="button"
                disabled={locked}
                onClick={() => {
                  setPlayoff(n);
                  setByes(defaultPlayoffByes(n));
                }}
                className={cn(
                  "h-10 min-w-11 rounded-sm px-3 font-mono text-sm",
                  playoff === n ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="microlabel">First-round byes</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                disabled={locked || n > playoff - 2}
                onClick={() => setByes(n)}
                className={cn(
                  "h-10 min-w-11 rounded-sm px-3 font-mono text-sm",
                  byes === n ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                )}
              >
                {n === 0 ? "None" : n === 1 ? "1 seed" : `${n} seeds`}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label htmlFor={`${fieldId}-regular`}>
            <span className="microlabel">Regular weeks</span>
            <Input
              id={`${fieldId}-regular`}
              className="mt-1.5 w-24"
              type="number"
              min={8}
              max={17}
              value={regular}
              onChange={(e) => setRegular(Number(e.target.value))}
              disabled={locked}
            />
          </label>
          <label htmlFor={`${fieldId}-pstart`}>
            <span className="microlabel">Playoffs start</span>
            <Input
              id={`${fieldId}-pstart`}
              className="mt-1.5 w-24"
              type="number"
              min={10}
              max={18}
              value={pStart}
              onChange={(e) => setPStart(Number(e.target.value))}
              disabled={locked}
            />
          </label>
        </div>
        <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted ring-card">
          {describeBracket(playoff, byes, pStart)}
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl">Schedule</h2>
        <p className="mt-1 text-sm text-muted">
          Regular-season pairings. Ledger fills a circle-method slate when the league is created or
          imported — change any week here. Scored weeks stay put. Playoffs seed from the standings
          when that week arrives.
        </p>
        <div className="mt-4">
          <ScheduleDesk leagueId={leagueId} canEdit={q.data.isCommish && !q.data.locked} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Waivers & calendar</h2>
        <p className="mt-1 text-sm text-muted">
          FAAB default $100, or rolling priority, or straight free agency. FAAB: highest bid wins,
          equal bids go to reverse standings. Rolling: waiver order, winners go last. Claims sit
          until Wednesday. A drop sits on waivers until the next run so someone else can bid;
          leftovers from that run are free agents until the week turns.
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {(
            [
              ["faab", "FAAB"],
              ["rolling", "Rolling"],
              ["none", "Free agency"],
            ] as const
          ).map(([id, lab]) => (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setWaiverType(id)}
              className={cn(
                "h-10 rounded-sm px-3 font-mono text-sm",
                waiverType === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label htmlFor={`${fieldId}-faab`}>
            <span className="microlabel">FAAB $</span>
            <Input
              id={`${fieldId}-faab`}
              className="mt-1.5 w-24"
              type="number"
              min={0}
              max={1000}
              value={faab}
              onChange={(e) => setFaab(Number(e.target.value))}
              disabled={locked}
            />
          </label>
          <label htmlFor={`${fieldId}-deadline`}>
            <span className="microlabel">Trade deadline week</span>
            <Input
              id={`${fieldId}-deadline`}
              className="mt-1.5 w-24"
              type="number"
              min={1}
              max={18}
              value={deadline}
              onChange={(e) => setDeadline(Number(e.target.value))}
              disabled={locked}
            />
          </label>
        </div>
        {q.data.isCommish && !q.data.locked ? <CommishClock leagueId={leagueId} /> : null}
      </section>

      <section>
        <h2 className="font-display text-2xl">The book</h2>
        <p className="mt-1 text-sm text-muted">
          Managers stake FAAB on matchups against a house pool. Losing stakes go into the pool and
          winners are paid out of it, so the league&rsquo;s total FAAB never changes — the seed
          below plus every manager&rsquo;s budget is all the money that will ever exist. Nobody can
          bet against their own team.
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {(
            [
              [true, "On"],
              [false, "Off"],
            ] as const
          ).map(([id, lab]) => (
            <button
              key={String(id)}
              type="button"
              disabled={locked}
              onClick={() => setBettingOn(id)}
              className={cn(
                "h-10 rounded-sm px-4 font-mono text-sm",
                bettingOn === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label htmlFor={`${fieldId}-pool-seed`}>
            <span className="block microlabel">Pool seed $</span>
            <Input
              id={`${fieldId}-pool-seed`}
              className="mt-1.5 w-24"
              type="number"
              min={0}
              max={5000}
              value={poolSeed}
              onChange={(e) => setPoolSeed(Number(e.target.value))}
              disabled={locked}
            />
          </label>
          <label htmlFor={`${fieldId}-wager-cap`}>
            <span className="block microlabel">Max per wager $</span>
            <Input
              id={`${fieldId}-wager-cap`}
              className="mt-1.5 w-24"
              type="number"
              min={1}
              max={1000}
              value={wagerCap}
              onChange={(e) => setWagerCap(Number(e.target.value))}
              disabled={locked}
            />
          </label>
          <label htmlFor={`${fieldId}-exposure-cap`}>
            <span className="block microlabel">Max at risk $</span>
            <Input
              id={`${fieldId}-exposure-cap`}
              className="mt-1.5 w-24"
              type="number"
              min={1}
              max={2000}
              value={exposureCap}
              onChange={(e) => setExposureCap(Number(e.target.value))}
              disabled={locked}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-faint">
          A small pool against large budgets means winners get scaled payouts when a week goes
          against the house. The ratio is the dial.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl">Scoring</h2>
        <p className="mt-1 text-sm text-muted">
          Every stat Ledger can book — passing through returns. Kick and punt return yards and TDs
          are on the player, not the D/ST. Finished imported weeks keep their original scores; live
          weeks use this.
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {(["ppr", "half", "std"] as const).map((id) => (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setBook(bookFromPreset(id))}
              className={cn(
                "h-10 rounded-sm px-3 font-mono text-sm",
                q.data && book.rec === bookFromPreset(id).rec && book.pass_td === 4
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted",
              )}
            >
              {id === "ppr" ? "PPR" : id === "half" ? "Half" : "Standard"}
            </button>
          ))}
          <button
            type="button"
            disabled={locked}
            onClick={() => setBook({ ...book, pass_td: book.pass_td === 6 ? 4 : 6 })}
            className="h-10 rounded-sm bg-raised px-3 font-mono text-sm text-muted"
          >
            {book.pass_td === 6 ? "6pt pass TD" : "4pt pass TD"}
          </button>
        </div>

        {grouped.map((g) => (
          <div key={g.group} className="mt-6">
            <h3 className="microlabel">{g.group}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {g.fields.map((f) => (
                <label
                  key={f.key}
                  htmlFor={`${fieldId}-scoring-${f.key}`}
                  className="rounded-lg bg-surface p-3 ring-card"
                >
                  <span className="block text-xs text-muted">{f.label}</span>
                  <Input
                    id={`${fieldId}-scoring-${f.key}`}
                    className="mt-1.5 h-9"
                    type="number"
                    step={f.step}
                    value={book[f.key] ?? 0}
                    disabled={locked}
                    onChange={(e) =>
                      setBook((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-display text-2xl">Seats</h2>
        <ul className="mt-3 divide-y divide-line rounded-xl bg-surface ring-card">
          {q.data.teams.map((t) => (
            <li key={t.rosterId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-sm">{t.teamName}</span>
                <span className="font-mono text-[11px] text-faint">
                  {t.manager}
                  {t.faab != null ? ` · $${t.faab}` : ""}
                </span>
              </span>
              {t.open ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={claim.isPending}
                  onClick={() => claim.mutate(t.rosterId)}
                >
                  Claim
                </Button>
              ) : (
                <span className="microlabel">Taken</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {q.data.isCommish && !q.data.locked ? (
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      ) : (
        <p className="text-sm text-muted">
          {q.data.locked ? "Demo desk is locked." : "Only the commissioner can edit scoring."}
        </p>
      )}

      {q.data.isCommish ? <DownloadBackup leagueId={leagueId} /> : null}

      {q.data.isCommish && !q.data.locked ? (
        <DeleteLeague
          leagueId={leagueId}
          name={q.data.name}
          onGone={() => {
            void qc.invalidateQueries({ queryKey: ["my-leagues"] });
            void navigate({ to: "/" });
          }}
        />
      ) : null}
    </div>
  );
}

function DownloadBackup({ leagueId }: { leagueId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="border-t border-line pt-10">
      <h2 className="font-display text-2xl">Download backup</h2>
      <p className="mt-1 text-sm text-muted">
        JSON snapshot of this league&rsquo;s desks, rosters, and book. Keep a copy off-box.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void exportLeague({ data: { leagueId } })
            .then((snap) => {
              const blob = new Blob([JSON.stringify(snap, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `open-leagues-${leagueId}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast("Backup downloaded.");
            })
            .catch((err) => toast(err instanceof Error ? err.message : "Could not export."))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Preparing…" : "Download backup"}
      </Button>
    </section>
  );
}

function DeleteLeague({
  leagueId,
  name,
  onGone,
}: {
  leagueId: string;
  name: string;
  onGone: () => void;
}) {
  const [typed, setTyped] = useState("");
  const kill = useMutation({
    mutationFn: () => deleteLeague({ data: { leagueId } }),
    onSuccess: () => {
      toast("League deleted.");
      onGone();
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not delete."),
  });
  const match = typed.trim() === name;
  return (
    <section className="border-t border-line pt-10">
      <h2 className="font-display text-2xl">Delete league</h2>
      <p className="mt-1 text-sm text-muted">
        Drops the desk, rosters, and book. Type <span className="text-fg">{name}</span> to confirm.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={name}
          aria-label="Type the league name to confirm delete"
        />
        <Button
          type="button"
          variant="outline"
          className="text-loss"
          disabled={!match || kill.isPending}
          onClick={() => kill.mutate()}
        >
          {kill.isPending ? "Deleting…" : "Delete league"}
        </Button>
      </div>
    </section>
  );
}

function PushOptIn({ leagueId, hasSeat }: { leagueId: string; hasSeat: boolean }) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["push-status", leagueId],
    queryFn: () => pushStatus({ data: { leagueId } }),
    enabled: hasSeat,
  });
  const toggle = useMutation({
    mutationFn: async (on: boolean) => {
      if (!on) {
        await disablePushForLeague(leagueId);
        return;
      }
      const key = status.data?.publicKey;
      if (!key) return;
      const ok = await enablePushForLeague(leagueId, key);
      if (!ok) throw new Error("denied");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["push-status", leagueId] });
    },
    onError: () => {
      toast("Notifications need permission on this phone.");
    },
  });
  if (!hasSeat) return null;
  if (!status.data?.configured) return null;

  const on = Boolean(status.data.subscribed);
  return (
    <section>
      <p className="microlabel">On this phone</p>
      <h2 className="mt-1 font-display text-2xl">Notify me when I'm away</h2>
      <p className="mt-1 text-sm text-muted">
        You're on the clock, a trade is waiting, or a waiver claim processed. Off unless you turn it
        on — the commissioner can't force this.
      </p>
      <div className="mt-3">
        {on ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(false)}
          >
            {toggle.isPending ? "Updating…" : "Turn off notifications"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(true)}
          >
            {toggle.isPending ? "Updating…" : "Notify me on this phone"}
          </Button>
        )}
      </div>
    </section>
  );
}

function AllowlistPanel({ leagueId, locked }: { leagueId: string; locked: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const q = useQuery({
    queryKey: ["allowlist", leagueId],
    queryFn: () => listAllowlist({ data: { leagueId } }),
  });
  const add = useMutation({
    mutationFn: () => addAllowlistEmail({ data: { leagueId, email } }),
    onSuccess: async () => {
      setEmail("");
      toast("Email added.");
      await qc.invalidateQueries({ queryKey: ["allowlist", leagueId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not add."),
  });
  const remove = useMutation({
    mutationFn: (addr: string) => removeAllowlistEmail({ data: { leagueId, email: addr } }),
    onSuccess: async () => {
      toast("Email removed.");
      await qc.invalidateQueries({ queryKey: ["allowlist", leagueId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not remove."),
  });
  const emails = q.data ?? [];
  return (
    <div className="mt-6">
      <h3 className="microlabel">Invite list</h3>
      <p className="mt-1 text-sm text-muted">
        {emails.length === 0
          ? "Anyone with the code can join. Add emails to lock it."
          : "Only these emails can join or claim a seat with the code."}
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim() || locked) return;
          add.mutate();
        }}
      >
        <Input
          className="max-w-xs"
          type="email"
          placeholder="manager@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={locked || add.isPending}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={locked || add.isPending || !email.trim()}
        >
          {add.isPending ? "Adding…" : "Add"}
        </Button>
      </form>
      {emails.length > 0 ? (
        <ul className="mt-3 divide-y divide-line rounded-xl bg-surface ring-card">
          {emails.map((addr) => (
            <li key={addr} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="font-mono text-sm">{addr}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={locked || remove.isPending}
                onClick={() => remove.mutate(addr)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CommishClock({ leagueId }: { leagueId: string }) {
  const qc = useQueryClient();
  const waivers = useMutation({
    mutationFn: () => processWaivers({ data: { leagueId } }),
    onSuccess: (res) => {
      toast(`Waivers processed · ${res.awarded} awards`);
      void invalidateAfterRosterMove(qc, leagueId);
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not process"),
  });
  const next = useMutation({
    mutationFn: () => advanceWeek({ data: { leagueId } }),
    onSuccess: () => {
      toast("Week locked and advanced.");
      void qc.invalidateQueries({ queryKey: ["league", leagueId] });
      void qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
      void qc.invalidateQueries({ queryKey: ["settings", leagueId] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not advance"),
  });
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => waivers.mutate()}
        disabled={waivers.isPending}
      >
        {waivers.isPending ? "Processing…" : "Process waivers now"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => next.mutate()}
        disabled={next.isPending}
      >
        {next.isPending ? "Advancing…" : "Lock week & advance"}
      </Button>
      <p className="basis-full text-xs text-faint">
        Optional overrides. The league clock runs waivers Wednesday and advances with the NFL
        regular season — not preseason.
      </p>
    </div>
  );
}
