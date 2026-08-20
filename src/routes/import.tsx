import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, ChevronDown, FileUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { calendarOf, recentSeasons } from "@/lib/data/calendar";
import { getPulse } from "@/lib/data/fns";
import {
  importEspn,
  importLeague,
  importRebuild,
  previewEspn,
  previewImport,
  previewRebuild,
} from "@/lib/league/fns";
import { SAMPLE_REBUILD } from "@/lib/league/rebuild";
import { useLeagueStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/import")({
  component: ImportPage,
});

type Source = "rebuild" | "sleeper" | "espn";
type Scoring = "ppr" | "half" | "std";

type MatchedName = { name: string; playerId: string | null; pos: string | null };

type DraftTeam = {
  rosterId: number;
  teamName: string;
  manager: string;
  names: string[];
  wins: number | null;
  losses: number | null;
  ties: number | null;
  pf: number | null;
  pa: number | null;
  players: number;
  unmatched: string[];
  matched: MatchedName[];
  record: string | null;
};

type Preview = {
  name: string;
  season: string;
  teamCount: number;
  scoringLabel: string;
  format?: string;
  knownId?: string | null;
  warnings?: string[];
  pickCount?: number;
  playoffTeams?: number;
  playoffByes?: number;
  teams: DraftTeam[];
};

function emptyTeam(rosterId: number): DraftTeam {
  return {
    rosterId,
    teamName: `Team ${rosterId}`,
    manager: "Manager",
    names: [],
    wins: null,
    losses: null,
    ties: null,
    pf: null,
    pa: null,
    players: 0,
    unmatched: [],
    matched: [],
    record: null,
  };
}

function toPayload(t: DraftTeam) {
  return {
    teamName: t.teamName,
    manager: t.manager,
    wins: t.wins,
    losses: t.losses,
    ties: t.ties,
    pf: t.pf,
    pa: t.pa,
    names: t.names.map((n) => n.trim()).filter(Boolean),
  };
}

async function readDroppedFile(
  file: File,
): Promise<{ paste?: string; known?: string; label: string }> {
  const name = file.name;
  const isPdf = file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const buf = await file.arrayBuffer();
    const latin1 = new TextDecoder("latin1").decode(buf);
    if (
      latin1.includes("907798861") ||
      (/\bWIFFL\b/.test(latin1) && /draft\s+recap/i.test(latin1))
    ) {
      return { known: "wiffl-2026", label: name };
    }
    const strings: string[] = [];
    const re = /\((?:\\.|[^\\)]){3,140}\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(latin1))) {
      const s = m[0].slice(1, -1).replace(/\\n/g, "\n").replace(/\\\(/g, "(").replace(/\\\)/g, ")");
      if (/[A-Za-z]{3}/.test(s)) strings.push(s);
    }
    return { paste: strings.join("\n"), label: name };
  }
  return { paste: await file.text(), label: name };
}

function ImportPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const remember = useLeagueStore((s) => s.remember);
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("rebuild");
  const [step, setStep] = useState<"source" | "review">("source");
  const [leagueId, setLeagueId] = useState("");
  const [name, setName] = useState("");
  const [season, setSeason] = useState<string | null>(null);
  const pulse = useQuery({ queryKey: ["pulse"], queryFn: () => getPulse() });
  const seasonYears = pulse.data ? recentSeasons(pulse.data.state, 2) : [];
  const seasonValue = season ?? (pulse.data ? calendarOf(pulse.data.state).season : "");
  const [scoring, setScoring] = useState<Scoring>("ppr");
  const [paste, setPaste] = useState("");
  const [known, setKnown] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [swid, setSwid] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [claim, setClaim] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<DraftTeam[]>([]);
  const [openTeam, setOpenTeam] = useState<number | null>(1);
  const [dragging, setDragging] = useState(false);

  const missed = useMemo(() => draft.reduce((n, t) => n + t.unmatched.length, 0), [draft]);
  const matched = useMemo(() => draft.reduce((n, t) => n + t.players, 0), [draft]);

  function applyPreview(res: Preview) {
    const teams = res.teams.map((t, i) => ({
      rosterId: t.rosterId ?? i + 1,
      teamName: t.teamName,
      manager: t.manager ?? "Manager",
      names: t.names?.length ? t.names : [],
      wins: t.wins ?? null,
      losses: t.losses ?? null,
      ties: t.ties ?? null,
      pf: t.pf ?? null,
      pa: t.pa ?? null,
      players: t.players,
      unmatched: t.unmatched ?? [],
      matched: t.matched ?? [],
      record: t.record ?? null,
    }));
    setPreviewData(res);
    setDraft(teams);
    setClaim(teams[0]?.rosterId ?? null);
    setName((n) => n.trim() || res.name);
    if (res.season) setSeason(res.season);
    setStep("review");
    setOpenTeam(teams[0]?.rosterId ?? 1);
  }

  const preview = useMutation({
    mutationFn: async (opts?: {
      known?: string;
      paste?: string;
      teams?: ReturnType<typeof toPayload>[];
    }) => {
      if (source === "rebuild") {
        return previewRebuild({
          data: {
            paste: opts?.paste ?? (opts?.teams || opts?.known ? undefined : paste),
            known: opts?.known ?? known ?? undefined,
            teams: opts?.teams,
            name: name.trim() || "Rebuilt league",
            season: seasonValue,
            scoring,
          },
        });
      }
      if (source === "espn") {
        return previewEspn({
          data: {
            leagueId: leagueId.trim(),
            season: seasonValue,
            swid: swid.trim() || undefined,
            espnS2: espnS2.trim() || undefined,
          },
        });
      }
      return previewImport({ data: { sleeperId: leagueId.trim() } });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not read that."),
    onSuccess: (res) => applyPreview(res as unknown as Preview),
  });

  const run = useMutation({
    mutationFn: async () => {
      if (source === "rebuild") {
        return importRebuild({
          data: {
            teams: draft.map(toPayload),
            name: name.trim() || previewData?.name || "Rebuilt league",
            season: seasonValue,
            scoring,
            claimRosterId: claim,
          },
        });
      }
      if (source === "espn") {
        return importEspn({
          data: {
            leagueId: leagueId.trim(),
            season: seasonValue,
            claimRosterId: claim,
            swid: swid.trim() || undefined,
            espnS2: espnS2.trim() || undefined,
          },
        });
      }
      return importLeague({ data: { sleeperId: leagueId.trim(), claimRosterId: claim } });
    },
    onSuccess: (res) => {
      remember({
        leagueId: res.leagueId,
        name: previewData?.name ?? (name.trim() || "Imported league"),
        season: previewData?.season ?? seasonValue,
      });
      toast(`Imported · invite ${res.inviteCode}`);
      void navigate({ to: "/league/$leagueId", params: { leagueId: res.leagueId } });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Import failed.";
      if (msg === "Unauthorized") {
        void navigate({ to: "/login", search: { redirect: "/import" } });
        return;
      }
      toast(msg);
    },
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const read = await readDroppedFile(file);
      setFileLabel(read.label);
      if (read.known) {
        setKnown(read.known);
        setPaste("");
        if (read.known === "wiffl-2026") {
          setName((n) => n.trim() || "WIFFL");
          setSeason("2026");
        }
        preview.mutate({ known: read.known });
        return;
      }
      setKnown(null);
      setPaste(read.paste ?? "");
      if (!(read.paste ?? "").trim()) {
        toast("No roster text in that file. Paste the recap or load WIFFL.");
      }
    } catch {
      toast("Couldn’t read that file.");
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void onFile(e.dataTransfer.files[0]);
  }

  function updateTeam(rosterId: number, patch: Partial<DraftTeam>) {
    setDraft((rows) => rows.map((t) => (t.rosterId === rosterId ? { ...t, ...patch } : t)));
  }

  function recheck() {
    preview.mutate({ teams: draft.map(toPayload) });
  }

  if (!isPending && !user) return <Navigate to="/login" search={{ redirect: "/import" }} />;

  return (
    <Shell>
      <p className="microlabel">Bring a league over</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {step === "review" ? "Verify the board" : "Import a league"}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        {step === "review"
          ? "Names, seats, and matches — edit anything that’s off, then create the league. Nothing is saved until you confirm."
          : "Load a known draft, drop a PDF, or paste a roster list. Confirm every seat before it becomes a league."}
      </p>

      <div className="mt-8 flex flex-wrap gap-1">
        {(
          [
            ["rebuild", "Draft"],
            ["sleeper", "Sleeper"],
            ["espn", "ESPN"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSource(id);
              setPreviewData(null);
              setDraft([]);
              setStep("source");
              setKnown(null);
              setFileLabel(null);
            }}
            className={cn(
              "h-10 rounded-sm px-4 font-mono text-sm",
              source === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {source === "rebuild" && step === "review" && previewData ? (
        <section className="mt-8 max-w-3xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="microlabel">
                {previewData.season} · {previewData.teamCount} teams · {previewData.scoringLabel}
                {previewData.pickCount ? ` · ${previewData.pickCount} picks` : ""}
              </p>
              <h2 className="mt-1 font-display text-3xl">{name || previewData.name}</h2>
              <p className="mt-2 text-sm text-muted">
                Top {previewData.playoffTeams ?? 4} make the dance
                {(previewData.playoffByes ?? 0) > 0 ? ` · #1–${previewData.playoffByes} bye` : ""}.
                Friends claim the open seats.
              </p>
            </div>
            <button
              type="button"
              className="microlabel text-muted hover:text-fg"
              onClick={() => setStep("source")}
            >
              Back to source
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="block">
              <span className="microlabel">League name</span>
              <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div>
              <p className="microlabel">Season</p>
              <div className="mt-1.5 flex gap-1">
                {seasonYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSeason(y)}
                    className={cn(
                      "h-11 min-w-16 rounded-sm px-3 font-mono text-sm",
                      seasonValue === y ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="microlabel">Scoring</p>
              <div className="mt-1.5 flex gap-1">
                {(
                  [
                    ["ppr", "PPR"],
                    ["half", "Half"],
                    ["std", "Std"],
                  ] as const
                ).map(([id, lab]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setScoring(id)}
                    className={cn(
                      "h-11 rounded-sm px-3 font-mono text-sm",
                      scoring === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                    )}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {previewData.warnings?.length ? (
            <p className="mt-4 flex gap-2 text-sm text-live">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {previewData.warnings[0]}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3 microlabel">
            <span className="text-win">{matched} matched</span>
            {missed ? (
              <span className="text-loss">{missed} unmatched</span>
            ) : (
              <span>All names found</span>
            )}
            <button
              type="button"
              className="text-muted hover:text-fg"
              onClick={recheck}
              disabled={preview.isPending}
            >
              {preview.isPending ? "Checking…" : "Re-check names"}
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {draft.map((t) => {
              const open = openTeam === t.rosterId;
              const yours = claim === t.rosterId;
              return (
                <li key={t.rosterId} className="rounded-xl bg-surface ring-card">
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setOpenTeam(open ? null : t.rosterId)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{t.teamName}</span>
                        <span className="font-mono text-[11px] text-faint">
                          {t.record ? `${t.record} · ` : ""}
                          {t.players} matched
                          {t.unmatched.length ? ` · ${t.unmatched.length} missed` : ""}
                          {yours ? " · your seat" : ""}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-faint transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    <div className="flex shrink-0 items-center pr-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={yours ? "primary" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setClaim(t.rosterId);
                        }}
                      >
                        {yours ? "Your seat" : "Claim"}
                      </Button>
                    </div>
                  </div>
                  {open ? (
                    <div className="space-y-3 border-t border-line px-4 py-3">
                      <label className="block">
                        <span className="microlabel">Team</span>
                        <Input
                          className="mt-1.5"
                          value={t.teamName}
                          onChange={(e) => updateTeam(t.rosterId, { teamName: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="microlabel">Roster · one name per line</span>
                        <textarea
                          className="mt-1.5 min-h-40 w-full rounded-md border-0 bg-raised px-3 py-2 font-mono text-xs leading-relaxed text-fg outline-none ring-0 placeholder:text-faint"
                          value={t.names.join("\n")}
                          onChange={(e) =>
                            updateTeam(t.rosterId, {
                              names: e.target.value.split("\n"),
                            })
                          }
                        />
                      </label>
                      {t.unmatched.length ? (
                        <p className="text-[12px] text-loss">Unmatched: {t.unmatched.join(", ")}</p>
                      ) : (
                        <p className="flex items-center gap-1.5 text-[12px] text-win">
                          <Check className="size-3.5" /> Every name matched
                        </p>
                      )}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 microlabel text-muted hover:text-loss"
                        onClick={() =>
                          setDraft((rows) => rows.filter((r) => r.rosterId !== t.rosterId))
                        }
                      >
                        <Trash2 className="size-3.5" /> Remove team
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mt-3 inline-flex h-10 items-center gap-1.5 microlabel text-muted hover:text-fg"
            onClick={() =>
              setDraft((rows) => [...rows, emptyTeam((rows[rows.length - 1]?.rosterId ?? 0) + 1)])
            }
          >
            <Plus className="size-3.5" /> Add a team
          </button>

          <div className="sticky bottom-3 mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-bg/90 p-3 ring-card backdrop-blur-md">
            <Button
              type="button"
              onClick={() => {
                if (claim == null) {
                  toast("Claim your seat first.");
                  return;
                }
                run.mutate();
              }}
              disabled={isPending || run.isPending || draft.length < 2 || claim == null}
            >
              {run.isPending ? "Importing…" : "Confirm import"}
            </Button>
            <p className="text-xs text-muted">
              {draft.length} teams
              {claim == null
                ? " · claim a seat to continue"
                : ` · importing as ${draft.find((t) => t.rosterId === claim)?.teamName}`}
            </p>
          </div>
        </section>
      ) : null}

      {step === "source" || source !== "rebuild" ? (
        <form
          className="mt-6 max-w-2xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            preview.mutate({});
          }}
        >
          {source === "rebuild" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="microlabel">League name</span>
                  <Input
                    className="mt-1.5"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="WIFFL"
                  />
                </label>
                <div>
                  <p className="microlabel">Season</p>
                  <div className="mt-1.5 flex gap-1">
                    {seasonYears.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setSeason(y)}
                        className={cn(
                          "h-11 min-w-16 rounded-sm px-3 font-mono text-sm",
                          seasonValue === y ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                        )}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="microlabel">Scoring</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(
                    [
                      ["ppr", "PPR"],
                      ["half", "Half"],
                      ["std", "Std"],
                    ] as const
                  ).map(([id, lab]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setScoring(id)}
                      className={cn(
                        "h-10 rounded-sm px-3 font-mono text-sm",
                        scoring === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                      )}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "rounded-xl bg-surface px-4 py-6 text-center ring-card transition-[box-shadow]",
                  dragging && "ring-card-h",
                )}
              >
                <FileUp className="mx-auto size-5 text-faint" />
                <p className="mt-2 text-sm text-fg">Drop a recap PDF or txt</p>
                <p className="mt-1 text-xs text-muted">
                  ESPN draft recap, team blocks, or a CSV. Print-to-PDF is often an image — we’ll
                  still catch WIFFL.
                </p>
                {fileLabel ? (
                  <p className="mt-2 font-mono text-[11px] text-faint">{fileLabel}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  <Button
                    type="button"
                    variant="muted"
                    size="sm"
                    onClick={() => {
                      setKnown("wiffl-2026");
                      setName((n) => n.trim() || "WIFFL");
                      setSeason("2026");
                      preview.mutate({ known: "wiffl-2026" });
                    }}
                  >
                    Load WIFFL draft
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.csv,.tsv,text/plain,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>

              <label className="block">
                <span className="flex items-center justify-between gap-3">
                  <span className="microlabel">Or paste the recap</span>
                  <button
                    type="button"
                    className="microlabel text-muted hover:text-fg"
                    onClick={() => {
                      setPaste(SAMPLE_REBUILD);
                      setKnown(null);
                    }}
                  >
                    Load sample
                  </button>
                </span>
                <textarea
                  className="mt-1.5 min-h-48 w-full rounded-md border-0 bg-raised px-3 py-2 font-mono text-xs leading-relaxed text-fg outline-none ring-0 placeholder:text-faint"
                  value={paste}
                  onChange={(e) => {
                    setPaste(e.target.value);
                    setKnown(null);
                  }}
                  placeholder={`1 Bijan Robinson ATL, RB Chumheads\n2 Jahmyr Gibbs DET, RB Shardbearer\n…`}
                />
              </label>
              <p className="text-xs leading-relaxed text-muted">
                ESPN recap lines, or <span className="font-mono text-fg">Team | Manager | W-L</span>{" "}
                with players underneath. You’ll edit before anything is created.
              </p>
            </>
          ) : null}

          {source === "sleeper" ? (
            <label className="block max-w-lg">
              <span className="microlabel">Sleeper league ID</span>
              <Input
                className="mt-1.5"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                placeholder="1180228818907533312"
                required
              />
            </label>
          ) : null}

          {source === "espn" ? (
            <div className="max-w-lg space-y-4">
              <label className="block">
                <span className="microlabel">ESPN league ID or URL</span>
                <Input
                  className="mt-1.5"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  placeholder="fantasy.espn.com/football/league?leagueId=…"
                  required
                />
              </label>
              <div>
                <p className="microlabel">Season</p>
                <div className="mt-1.5 flex gap-1">
                  {seasonYears.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setSeason(y)}
                      className={cn(
                        "h-10 min-w-16 rounded-sm px-3 font-mono text-sm",
                        seasonValue === y ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted">
                Private leagues need SWID + espn_s2, or flip the league public for one minute. A
                recap paste is simpler if you just want the names.
              </p>
              <label className="block">
                <span className="microlabel">SWID</span>
                <Input
                  className="mt-1.5"
                  value={swid}
                  onChange={(e) => setSwid(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="microlabel">espn_s2</span>
                <Input
                  className="mt-1.5"
                  value={espnS2}
                  onChange={(e) => setEspnS2(e.target.value)}
                  autoComplete="off"
                />
              </label>
            </div>
          ) : null}

          <Button type="submit" variant="outline" disabled={isPending || preview.isPending}>
            {preview.isPending ? "Reading…" : "Preview & verify"}
          </Button>
        </form>
      ) : null}

      {source !== "rebuild" && previewData ? (
        <section className="mt-10 max-w-2xl">
          <p className="microlabel">
            {previewData.season} · {previewData.teamCount} teams · {previewData.scoringLabel}
          </p>
          <h2 className="mt-1 font-display text-3xl">{previewData.name}</h2>
          <p className="mt-3 text-sm text-muted">Claim your seat. Everyone else stays open.</p>
          <ul className="mt-4 divide-y divide-line rounded-xl bg-surface ring-card">
            {previewData.teams.map((t) => (
              <li key={t.rosterId}>
                <button
                  type="button"
                  onClick={() => setClaim(t.rosterId)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
                    claim === t.rosterId && "bg-raised",
                  )}
                >
                  <span>
                    <span className="block text-sm">{t.teamName}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {t.manager}
                      {t.record ? ` · ${t.record}` : ""} · {t.players} matched
                      {t.unmatched?.length ? ` · ${t.unmatched.length} missed` : ""}
                    </span>
                    {t.unmatched?.length ? (
                      <span className="mt-1 block text-[11px] text-muted">
                        Couldn’t match: {t.unmatched.join(", ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="microlabel">{claim === t.rosterId ? "Yours" : "Open"}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-3">
            <Button
              type="button"
              onClick={() => run.mutate()}
              disabled={isPending || run.isPending}
            >
              {run.isPending ? "Importing…" : "Create league"}
            </Button>
            <Link to="/" className="text-sm text-muted hover:text-fg">
              Cancel
            </Link>
          </div>
        </section>
      ) : null}
    </Shell>
  );
}
