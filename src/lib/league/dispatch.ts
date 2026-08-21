import type { ActivityItem, MatchupPair, StandingRow } from "@/lib/data/types";
import { voicePack } from "./desk-voice";

export type DispatchVoice = {
  /** One or many names the desk may use. First is the default; call() rotates by week. */
  nicknames: Record<string, string | string[]>;
  bits: string[];
};

export type RosterCard = {
  team: string;
  manager: string;
  players: Array<{ name: string; pos: string | null }>;
};

export type DispatchContext = {
  leagueName: string;
  season: string;
  week: number;
  status: string;
  standings: Array<{
    team: string;
    manager: string;
    wins: number;
    losses: number;
    ties: number;
    pf: number;
    pa: number;
  }>;
  games: Array<{
    home: string;
    away: string;
    homePts: number;
    awayPts: number;
    homeStud: { name: string; pts: number; slot: string } | null;
    awayStud: { name: string; pts: number; slot: string } | null;
    homeNames: string[];
    awayNames: string[];
  }>;
  rosters: RosterCard[];
  moves: Array<{ type: string; teams: string[]; note: string }>;
  voice: DispatchVoice;
  teamNotes: Record<string, { note?: string }>;
  /**
   * Standing facts about the league's history, already threshold-gated by
   * loadLeagueFacts. Empty for a young league, which is correct — the desk
   * should say nothing rather than reach.
   */
  facts: Array<{ kind: string; teams: string[]; text: string }>;
};

export type ArticleKind = "lead" | "preview" | "feature" | "recap" | "brief";

export type DispatchArticle = {
  id: string;
  leagueId: string;
  week: number;
  kind: ArticleKind;
  slug: string;
  kicker: string;
  headline: string;
  dek: string;
  body: string[];
  bullets: string[];
  box: Array<{ winner: string; loser: string; score: string; margin: number }>;
  focus: string[];
  source: "rules" | "llm";
  createdAt: string;
};

export type DeskEdition = {
  week: number;
  edition: "prep" | "recap";
  kicker: string;
  articles: DispatchArticle[];
};

export const EMPTY_VOICE: DispatchVoice = { nicknames: {}, bits: [] };

export function voiceFor(leagueId: string, leagueName: string): DispatchVoice {
  return voicePack(leagueName);
}

function namesOfTeam(voice: DispatchVoice, team: string): string[] {
  const raw = voice.nicknames[team];
  if (raw == null) return [team];
  const list = (Array.isArray(raw) ? raw : [raw]).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [team];
}

/** Pick a nickname. Week rotates the list so consecutive editions do not always say the same one. */
function call(voice: DispatchVoice, team: string, week = 0): string {
  const list = namesOfTeam(voice, team);
  return list[Math.abs(week) % list.length] ?? team;
}

function studOf(side: MatchupPair["home"]): { name: string; pts: number; slot: string } | null {
  const hit = [...side.starters]
    .filter((s) => s.player && (s.points ?? 0) > 0)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
  if (!hit?.player) return null;
  return { name: hit.player.full_name, pts: hit.points ?? 0, slot: hit.slot };
}

function namesOf(side: MatchupPair["home"]): string[] {
  return side.starters
    .map((s) => s.player?.full_name)
    .filter((n): n is string => Boolean(n))
    .slice(0, 6);
}

export function buildDispatchContext(input: {
  leagueId: string;
  leagueName: string;
  season: string;
  week: number;
  status: string;
  standings: StandingRow[];
  pairs: MatchupPair[];
  activity: ActivityItem[];
  rosters: RosterCard[];
  facts?: Array<{ kind: string; teams: string[]; text: string }>;
}): DispatchContext {
  const pack = voicePack(input.leagueName);
  return {
    leagueName: input.leagueName,
    season: input.season,
    week: input.week,
    status: input.status,
    standings: input.standings.map((s) => ({
      team: s.teamName,
      manager: s.manager,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pf: s.pf,
      pa: s.pa,
    })),
    games: input.pairs
      .filter((p) => p.away)
      .map((p) => ({
        home: p.home.teamName,
        away: p.away!.teamName,
        homePts: p.home.points,
        awayPts: p.away!.points,
        homeStud: studOf(p.home),
        awayStud: studOf(p.away!),
        homeNames: namesOf(p.home).length
          ? namesOf(p.home)
          : topNames(input.rosters, p.home.teamName),
        awayNames: namesOf(p.away!).length
          ? namesOf(p.away!)
          : topNames(input.rosters, p.away!.teamName),
      })),
    rosters: input.rosters,
    moves: input.activity.slice(0, 12).map((a) => ({
      type: a.type,
      teams: a.teamNames,
      note:
        a.adds[0] != null
          ? `+${a.adds[0].name}${a.drops[0] ? ` / −${a.drops[0].name}` : ""}`
          : a.type,
    })),
    voice: { nicknames: pack.nicknames, bits: pack.bits },
    teamNotes: pack.teamNotes,
    facts: input.facts ?? [],
  };
}

function topNames(rosters: RosterCard[], team: string): string[] {
  return (rosters.find((r) => r.team === team)?.players ?? []).slice(0, 5).map((p) => p.name);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function byPos(card: RosterCard, pos: string) {
  return card.players.filter((p) => p.pos === pos);
}

function noteFor(ctx: DispatchContext, team: string): string | null {
  return ctx.teamNotes[team]?.note?.trim() || null;
}

type Draft = Omit<DispatchArticle, "id" | "leagueId" | "createdAt">;

function article(
  week: number,
  kind: ArticleKind,
  slug: string,
  kicker: string,
  headline: string,
  dek: string,
  body: string[],
  extras: Partial<Draft> = {},
): Draft {
  return {
    week,
    kind,
    slug,
    kicker,
    headline,
    dek,
    body,
    bullets: extras.bullets ?? [],
    box: extras.box ?? [],
    focus: extras.focus ?? [],
    source: "rules",
  };
}

function construct(card: RosterCard) {
  const qbs = byPos(card, "QB");
  const rbs = byPos(card, "RB");
  const wrs = byPos(card, "WR");
  const tes = byPos(card, "TE");
  return {
    card,
    qbs,
    rbs,
    wrs,
    tes,
    lead: card.players[0] ?? null,
    twoQb: qbs.length >= 2,
    rbPair: rbs.length >= 2,
    wrRoom: wrs.length >= 4,
  };
}

/**
 * Cap standing facts for one edition. Prefer facts about teams on this week's
 * slate; drop the rest as filler. At most two. Callers that already filtered
 * out last week's texts (via context_json) pass the remainder here — we do not
 * re-query history inside this sync helper.
 */
export function selectEditionFacts(
  ctx: DispatchContext,
): Array<{ kind: string; teams: string[]; text: string }> {
  const playing = new Set(ctx.games.flatMap((g) => [g.home, g.away]));
  const relevant = ctx.facts.filter((f) => f.teams.some((t) => playing.has(t)));
  if (relevant.length <= 2) return relevant;
  // Rotate by week so consecutive editions don't always lead with the same two
  // when the exclude set from last week is empty (week 1, or no prior row).
  const start = ctx.week % relevant.length;
  return [...relevant.slice(start), ...relevant.slice(0, start)].slice(0, 2);
}

function weaveFacts(body: string[], facts: Array<{ text: string }>): void {
  if (!facts.length) return;
  if (facts.length === 1) {
    body.push(`One thing the book already knows: ${facts[0]!.text}`);
    return;
  }
  body.push(`Two things the book already knows: ${facts[0]!.text} Also — ${facts[1]!.text}`);
}

export function composeDesk(ctx: DispatchContext): DeskEdition {
  const named = (t: string) => call(ctx.voice, t, ctx.week);
  const scored = ctx.games.filter((g) => g.homePts > 0 || g.awayPts > 0);
  const edition: "prep" | "recap" = scored.length ? "recap" : "prep";
  const profiles = ctx.rosters.map(construct);
  const drafts: Draft[] = [];
  const editionFacts = selectEditionFacts(ctx);

  if (edition === "recap") {
    drafts.push(composeRecapLead(ctx, named, editionFacts));
  } else {
    drafts.push(composePrepLead(ctx, named, profiles, editionFacts));
  }

  const slate = edition === "prep" ? ctx.games : ctx.games.slice(0, 3);
  for (const g of slate.slice(0, 4)) {
    drafts.push(composeMatchupStory(ctx, g, named));
  }

  const features = profiles
    .map((p) => scoreFeature(p))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  for (const f of features) {
    const story = composeFeature(ctx, f.profile, named);
    if (story) drafts.push(story);
  }

  if (ctx.games.length > 4 && edition === "prep") {
    drafts.push(composeRestOfCard(ctx, named));
  }

  return {
    week: ctx.week,
    edition,
    kicker: edition === "prep" ? `Week ${ctx.week} prep` : `Week ${ctx.week} recap`,
    articles: drafts.map((d) => ({
      ...d,
      id: "",
      leagueId: "",
      createdAt: "",
    })),
  };
}

function composePrepLead(
  ctx: DispatchContext,
  named: (t: string) => string,
  profiles: ReturnType<typeof construct>[],
  facts: Array<{ text: string }> = [],
): Draft {
  const n = ctx.games.length;
  const twoQb = profiles.filter((p) => p.twoQb);
  const first = ctx.games[0];
  const body: string[] = [
    `${ctx.leagueName} opens week ${ctx.week} with ${n || ctx.rosters.length} clubs on the card. This is the prep edition — written from the draft board and the week-${ctx.week} slate, not a national wire.`,
  ];
  if (first) {
    body.push(
      `The book opens with ${named(first.home)} against ${named(first.away)}. ${first.homeNames[0] ?? named(first.home)} on one side, ${first.awayNames[0] ?? named(first.away)} on the other.`,
    );
  }
  if (twoQb[0]) {
    body.push(
      `${named(twoQb[0].card.team)} came out of the draft with ${twoQb[0].qbs.map((q) => q.name).join(" and ")}. That is a desk story this week whether they start one or both.`,
    );
  }
  const rbClub = profiles.find((p) => p.rbPair);
  if (rbClub) {
    body.push(
      `${named(rbClub.card.team)} built a backfield of ${rbClub.rbs
        .slice(0, 2)
        .map((r) => r.name)
        .join(" and ")}. Week ${ctx.week} is the first look at how that split actually plays.`,
    );
  }
  weaveFacts(body, facts);
  body.push(
    `Kickoff has not hit the book. Lineups can still move. The rest of this edition walks the slate and a few clubs the draft already made interesting.`,
  );
  return article(
    ctx.week,
    "lead",
    `week-${ctx.week}-prep`,
    `Week ${ctx.week} prep`,
    `The first Sunday is still on the wall`,
    `${ctx.leagueName}, week ${ctx.week}. ${n} games. Nobody has scored.`,
    body,
    { focus: ctx.games.flatMap((g) => [g.home, g.away]).slice(0, 6) },
  );
}

function composeRecapLead(
  ctx: DispatchContext,
  named: (t: string) => string,
  facts: Array<{ text: string }> = [],
): Draft {
  const scored = ctx.games.filter((g) => g.homePts > 0 || g.awayPts > 0);
  const box = scored
    .map((g) => {
      const homeWins = g.homePts >= g.awayPts;
      const winner = homeWins ? g.home : g.away;
      const loser = homeWins ? g.away : g.home;
      const wPts = homeWins ? g.homePts : g.awayPts;
      const lPts = homeWins ? g.awayPts : g.homePts;
      return {
        winner,
        loser,
        score: `${wPts.toFixed(1)}–${lPts.toFixed(1)}`,
        margin: Math.abs(wPts - lPts),
      };
    })
    .sort((a, b) => b.margin - a.margin);
  const blow = box[0];
  const high = scored
    .flatMap((g) => [
      { team: g.home, pts: g.homePts, stud: g.homeStud },
      { team: g.away, pts: g.awayPts, stud: g.awayStud },
    ])
    .sort((a, b) => b.pts - a.pts)[0];
  const body: string[] = [];
  if (blow) body.push(`${named(blow.winner)} beat ${named(blow.loser)} ${blow.score}.`);
  if (high?.stud) {
    body.push(
      `${high.stud.name} led the week with ${high.stud.pts.toFixed(1)} for ${named(high.team)}.`,
    );
  }
  weaveFacts(body, facts);
  return article(
    ctx.week,
    "recap",
    `week-${ctx.week}-recap`,
    `Week ${ctx.week} recap`,
    blow
      ? `${named(blow.winner)} puts ${named(blow.loser)} in the dirt`
      : `Week ${ctx.week} is on the books`,
    high
      ? `High water ${high.pts.toFixed(1)} from ${named(high.team)}.`
      : `Week ${ctx.week} posted.`,
    body,
    { box, focus: blow ? [blow.winner, blow.loser] : [] },
  );
}

function composeMatchupStory(
  ctx: DispatchContext,
  g: DispatchContext["games"][number],
  named: (t: string) => string,
): Draft {
  const homeLead = g.homeNames[0] ?? named(g.home);
  const awayLead = g.awayNames[0] ?? named(g.away);
  const homeRest = g.homeNames.slice(1, 4);
  const awayRest = g.awayNames.slice(1, 4);
  const homeNote = noteFor(ctx, g.home);
  const awayNote = noteFor(ctx, g.away);
  const body = [
    `${named(g.home)} brings ${homeLead}${homeRest.length ? `, then ${homeRest.join(", ")}` : ""}.`,
    `${named(g.away)} answers with ${awayLead}${awayRest.length ? `, then ${awayRest.join(", ")}` : ""}.`,
  ];
  if (homeNote) body.push(homeNote);
  if (awayNote) body.push(awayNote);
  body.push(`Nothing is scored. This is the look before Sunday, from the roster as it sits.`);
  return article(
    ctx.week,
    "preview",
    slugify(`${g.home}-vs-${g.away}`),
    `Week ${ctx.week} matchup`,
    `${named(g.home)} vs ${named(g.away)}`,
    `${homeLead} against ${awayLead}.`,
    body,
    { focus: [g.home, g.away] },
  );
}

function scoreFeature(profile: ReturnType<typeof construct>) {
  let score = 0;
  if (profile.twoQb) score += 5;
  if (profile.rbPair) score += 3;
  if (profile.wrRoom) score += 3;
  if (profile.tes.length >= 2) score += 2;
  return { score, profile };
}

function composeFeature(
  ctx: DispatchContext,
  profile: ReturnType<typeof construct>,
  named: (t: string) => string,
): Draft | null {
  const team = named(profile.card.team);
  const extra = noteFor(ctx, profile.card.team);
  if (profile.twoQb) {
    const names = profile.qbs.map((q) => q.name);
    return article(
      ctx.week,
      "feature",
      slugify(`${profile.card.team}-quarterbacks`),
      "From the draft",
      `${team} drafted a quarterback room`,
      `${names.join(" and ")} both came off the board to the same seat.`,
      [
        `The recap has ${team} taking ${names.join(" and ")}. That is two starters at the one position most desks only buy once.`,
        `Week ${ctx.week} is the first time the league sees which name is actually in the lineup — or if both stay warm.`,
        extra ?? `${profile.lead?.name ?? team} is still the name at the top of that club.`,
      ],
      { focus: [profile.card.team] },
    );
  }
  if (profile.rbPair && profile.rbs[0] && profile.rbs[1]) {
    return article(
      ctx.week,
      "feature",
      slugify(`${profile.card.team}-backfield`),
      "From the draft",
      `${team} is running it back twice`,
      `${profile.rbs[0].name} and ${profile.rbs[1].name} share a backfield.`,
      [
        `The draft board sent ${profile.rbs[0].name} and ${profile.rbs[1].name} to ${team}. That is a two-headed backfield before a snap has counted.`,
        `Prep week is about the split. Who starts. Who vultures. The book will settle it; the recap only tells us they both belong to this club.`,
        extra ??
          `Around them: ${profile.card.players
            .slice(2, 6)
            .map((p) => p.name)
            .join(", ")}.`,
      ],
      { focus: [profile.card.team] },
    );
  }
  if (profile.wrRoom && profile.wrs.length >= 4) {
    return article(
      ctx.week,
      "feature",
      slugify(`${profile.card.team}-receivers`),
      "From the draft",
      `${team} went hunting on Sundays`,
      `${profile.wrs
        .slice(0, 4)
        .map((w) => w.name)
        .join(", ")}.`,
      [
        `${team} came out of the draft with a receiver room: ${profile.wrs
          .slice(0, 4)
          .map((w) => w.name)
          .join(", ")}.`,
        profile.tes[0]
          ? `${profile.tes[0].name} is the tight end next to that group.`
          : `No featured tight end jumped off the recap next to that group.`,
        extra ?? `Week ${ctx.week} is the first Sunday those names share a lineup card.`,
      ],
      { focus: [profile.card.team] },
    );
  }
  return null;
}

function composeRestOfCard(ctx: DispatchContext, named: (t: string) => string): Draft {
  const rest = ctx.games.slice(4);
  const body = rest.map((g) => {
    const a = g.homeNames[0];
    const b = g.awayNames[0];
    return `${named(g.home)} vs ${named(g.away)}${a && b ? ` — ${a} against ${b}` : ""}.`;
  });
  return article(
    ctx.week,
    "brief",
    `week-${ctx.week}-card`,
    `Week ${ctx.week} slate`,
    "The rest of the card",
    `${rest.length} more games before kickoff.`,
    body.length ? body : ["The rest of the slate is posted on Matchups."],
    { focus: rest.flatMap((g) => [g.home, g.away]) },
  );
}

/** Single-article fallback used by older recap callers. */
export function composeDispatch(
  ctx: DispatchContext,
): Omit<DispatchArticle, "id" | "leagueId" | "createdAt"> {
  return composeDesk(ctx).articles[0]!;
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
