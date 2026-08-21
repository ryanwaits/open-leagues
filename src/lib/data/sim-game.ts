import { demoStatBag, REPLAY_PHASES, replayStats } from "@/lib/replay";
import { playerHeadshot, playerTeam, teamLogo } from "./teams";
import type { BoxGroup, GameDrive, GamePlay, GameSummary, ScoringPlay, SlimPlayer } from "./types";

const QB_NAMES = ["Geno", "Darnold", "Prescott", "Allen", "Williams", "Maye"];

function n(bag: Record<string, number>, key: string): number {
  const v = bag[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lastName(player: SlimPlayer): string {
  if (player.last_name?.trim()) return player.last_name.trim();
  const parts = player.full_name.split(/\s+/);
  return parts[parts.length - 1] ?? player.full_name;
}

function shortName(player: SlimPlayer): string {
  const first = (player.first_name ?? player.full_name).trim()[0] ?? "X";
  return `${first}.${lastName(player)}`;
}

function splitYards(total: number, count: number, seed: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [total];
  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const w = 0.45 + ((seed + i * 17) % 80) / 100;
    weights.push(w);
    sum += w;
  }
  const raw = weights.map((w) => Math.max(1, Math.round((total * w) / (sum || 1))));
  const drift = total - raw.reduce((a, b) => a + b, 0);
  raw[raw.length - 1] = Math.max(1, (raw[raw.length - 1] ?? 1) + drift);
  return raw;
}

type BuiltPlay = GamePlay & { phase: number; drive: number };

function clockFor(phase: number, i: number): { period: number; clock: string } {
  const table = [
    { period: 1, clock: "12:41" },
    { period: 1, clock: "4:18" },
    { period: 2, clock: "9:02" },
    { period: 2, clock: "1:14" },
    { period: 3, clock: "8:33" },
    { period: 3, clock: "2:07" },
    { period: 4, clock: "6:51" },
    { period: 4, clock: "0:48" },
  ];
  return table[(phase + i) % table.length] ?? { period: 2, clock: "5:00" };
}

export function buildPlayerScript(
  player: SlimPlayer,
  bag: Record<string, number>,
  homeAbbr: string,
  awayAbbr: string,
): BuiltPlay[] {
  const who = shortName(player);
  const team = (player.team ?? homeAbbr).toUpperCase();
  const opp = team === homeAbbr.toUpperCase() ? awayAbbr : homeAbbr;
  const pos = (player.position ?? "").toUpperCase();
  const seed = hash(`${player.player_id}:${team}`);
  const qb = QB_NAMES[seed % QB_NAMES.length]!;
  const plays: BuiltPlay[] = [];
  let drive = 0;
  let seq = 0;

  const push = (
    text: string,
    opts: { scoring?: boolean; yards?: number; type?: string; phase: number; newDrive?: boolean },
  ) => {
    if (opts.newDrive) drive += 1;
    const t = clockFor(opts.phase, seq);
    plays.push({
      id: `sim-${player.player_id}-${seq}`,
      text,
      type: opts.type ?? "Play",
      scoring: Boolean(opts.scoring),
      period: t.period,
      clock: t.clock,
      awayScore: 0,
      homeScore: 0,
      yardage: opts.yards ?? null,
      phase: opts.phase,
      drive,
    });
    seq += 1;
  };

  if (pos === "QB") {
    const cmp = Math.max(n(bag, "pass_cmp"), 1);
    const yds = n(bag, "pass_yd");
    const tds = n(bag, "pass_td");
    const ints = n(bag, "pass_int");
    const chunks = splitYards(yds || cmp * 11, cmp, seed);
    chunks.forEach((yd, i) => {
      const td = i < tds;
      const phase = 1 + Math.floor((i / Math.max(1, chunks.length)) * 7);
      push(
        `(Shotgun) ${who} pass ${yd >= 20 ? "deep" : "short"} ${i % 2 ? "right" : "left"} to ${i % 3 === 0 ? "K.Walker" : "J.Smith-Njigba"} ${td ? `for ${yd} yards, TOUCHDOWN.` : `to ${opp} ${18 + (i % 20)} for ${yd} yards.`}`,
        {
          yards: yd,
          scoring: td,
          type: td ? "Passing Touchdown" : "Pass",
          phase,
          newDrive: i === 0 || i % 3 === 0,
        },
      );
    });
    for (let i = 0; i < ints; i++) {
      push(`${who} pass short middle intercepted at ${opp} 34.`, {
        type: "Interception",
        phase: 3 + i,
        newDrive: true,
      });
    }
    if (n(bag, "rush_yd")) {
      const yd = n(bag, "rush_yd");
      const td = n(bag, "rush_td") > 0;
      push(
        `${who} scrambles up the middle ${td ? `for ${yd} yards, TOUCHDOWN.` : `to ${team} ${30 + (yd % 15)} for ${yd} yards.`}`,
        { yards: yd, scoring: td, type: td ? "Rushing Touchdown" : "Rush", phase: 5 },
      );
    }
  } else if (pos === "K") {
    const fg = n(bag, "fgm") || n(bag, "fgm_30_39") + n(bag, "fgm_40_49") + n(bag, "fgm_50p");
    const xp = n(bag, "xpm");
    for (let i = 0; i < fg; i++) {
      const yds = 33 + ((seed + i * 7) % 22);
      push(`${who} ${yds} yard field goal is GOOD.`, {
        scoring: true,
        type: "Field Goal",
        phase: 1 + i,
        newDrive: true,
      });
    }
    for (let i = 0; i < xp; i++) {
      push(`${who} extra point is GOOD.`, { scoring: true, type: "Extra Point", phase: 1 + i });
    }
  } else if (pos === "DEF" || pos === "DST") {
    const sacks = n(bag, "sack");
    const ints = n(bag, "int");
    const tds = n(bag, "def_td");
    for (let i = 0; i < sacks; i++) {
      push(`${team} sacked ${qb} at ${opp} ${12 + i * 3} for -${6 + i} yards.`, {
        type: "Sack",
        phase: 1 + i,
        newDrive: i === 0,
      });
    }
    for (let i = 0; i < ints; i++) {
      push(`${team} intercepted ${qb} at ${team} 22.`, {
        type: "Interception",
        phase: 3,
        newDrive: true,
      });
    }
    if (tds) {
      push(`${team} fumble recovery, returned for a TOUCHDOWN.`, {
        scoring: true,
        type: "Defensive Touchdown",
        phase: 6,
        newDrive: true,
      });
    }
  } else {
    const rec = n(bag, "rec");
    const recYd = n(bag, "rec_yd");
    const recTd = n(bag, "rec_td");
    const rushAtt = n(bag, "rush_att");
    const rushYd = n(bag, "rush_yd");
    const rushTd = n(bag, "rush_td");
    if (rec || recYd) {
      const count = Math.max(rec, recYd ? 1 : 0);
      const chunks = splitYards(recYd || count * 9, count, seed);
      chunks.forEach((yd, i) => {
        const td = i < recTd;
        const phase = 1 + Math.floor((i / Math.max(1, chunks.length)) * 7);
        const spot = td ? 0 : 12 + ((seed + i * 5) % 28);
        push(
          `(Shotgun) ${qb} pass ${yd >= 18 ? "deep" : "short"} ${i % 2 ? "left" : "right"} to ${who} ${
            td ? `for ${yd} yards, TOUCHDOWN.` : `to ${opp} ${spot} for ${yd} yards.`
          }`,
          {
            yards: yd,
            scoring: td,
            type: td ? "Passing Touchdown" : "Pass Reception",
            phase,
            newDrive: i === 0 || i === 2,
          },
        );
      });
    }
    if (rushAtt || rushYd) {
      const count = Math.max(rushAtt || 1, rushYd ? 1 : 0);
      const chunks = splitYards(rushYd || count * 4, Math.min(count, 8), seed + 3);
      chunks.forEach((yd, i) => {
        const td = i < rushTd;
        const phase = 1 + Math.floor((i / Math.max(1, chunks.length)) * 7);
        push(
          `${who} ${td ? `up the middle for ${yd} yards, TOUCHDOWN.` : `left guard to ${team} ${20 + (i % 18)} for ${yd} yards.`}`,
          {
            yards: yd,
            scoring: td,
            type: td ? "Rushing Touchdown" : "Rush",
            phase,
            newDrive: rec === 0 && i === 0,
          },
        );
      });
    }
  }

  if (!plays.length) {
    push(`${who} lined up. Waiting on a target.`, { phase: 2, type: "No Play" });
  }

  // Fill scores after the fact — each scoring play +7 for the player's team.
  let home = 0;
  let away = 7;
  const playerIsHome = team === homeAbbr.toUpperCase();
  for (const p of plays) {
    if (p.scoring) {
      if (playerIsHome) home += p.type.includes("Field") ? 3 : p.type.includes("Extra") ? 1 : 7;
      else away += p.type.includes("Field") ? 3 : p.type.includes("Extra") ? 1 : 7;
    } else if (p.phase >= 3 && home === 0 && playerIsHome) {
      away = Math.max(away, 10);
    }
    p.homeScore = home;
    p.awayScore = away;
  }
  return plays;
}

export function simulatePlayerGame(opts: {
  player: SlimPlayer;
  bag: Record<string, number>;
  phase: number;
  base?: GameSummary | null;
}): GameSummary {
  const player = opts.player;
  const team = (player.team ?? "SEA").toUpperCase();
  const realHome = (opts.base?.home.abbr ?? team).toUpperCase();
  const realAway = (opts.base?.away.abbr ?? (realHome === team ? "NE" : team)).toUpperCase();

  const script = buildPlayerScript(player, opts.bag, realHome, realAway);
  const last = REPLAY_PHASES.length - 1;
  const phase = Math.max(0, Math.min(opts.phase, last));
  const shown = phase <= 0 ? [] : script.filter((p) => p.phase <= phase);
  const state = phase <= 0 ? "pre" : phase >= last ? "post" : "in";
  const clock = REPLAY_PHASES[phase] ?? REPLAY_PHASES[0]!;
  const lastPlay = shown[shown.length - 1] ?? null;
  const homeScore = lastPlay?.homeScore ?? 0;
  const awayScore = lastPlay?.awayScore ?? (state === "pre" ? 0 : 3);

  const drives = new Map<number, GameDrive>();
  for (const p of shown) {
    let d = drives.get(p.drive);
    if (!d) {
      d = {
        id: `sim-d-${p.drive}`,
        team: player.team ?? realHome,
        logo: teamLogo(player.team) ?? opts.base?.home.logo ?? null,
        result: p.scoring ? (p.type.includes("Field") ? "Field Goal" : "Touchdown") : "Punt",
        description: "",
        start: `Q${p.period} ${p.clock}`,
        plays: [],
      };
      drives.set(p.drive, d);
    }
    d.plays.push(p);
    if (p.scoring) d.result = p.type.includes("Field") ? "Field Goal" : "Touchdown";
  }

  const red =
    state === "in" &&
    lastPlay &&
    !lastPlay.scoring &&
    typeof lastPlay.yardage === "number" &&
    lastPlay.yardage >= 12;
  const situation =
    state === "pre"
      ? null
      : state === "post"
        ? null
        : red
          ? `1st & 8 at ${realAway} 9`
          : lastPlay
            ? `2nd & 6 at ${realHome} 41`
            : "Kickoff";

  const slicedBag = replayStats(player.player_id, opts.bag, phase, 1);
  const groups = boxGroupsFor(player, slicedBag, phase >= last ? opts.bag : slicedBag);

  return {
    id: opts.base?.id ?? `sim-${player.player_id}`,
    name: opts.base?.name ?? `${realAway} at ${realHome}`,
    shortName: opts.base?.shortName ?? `${realAway} @ ${realHome}`,
    date: opts.base?.date ?? "",
    state,
    detail: clock.detail,
    week: opts.base?.week ?? 1,
    season: opts.base?.season ?? new Date().getUTCFullYear(),
    seasonType: opts.base?.seasonType ?? "regular",
    home: {
      abbr: realHome,
      name: opts.base?.home.name ?? realHome,
      logo: opts.base?.home.logo ?? teamLogo(realHome) ?? "",
      score: String(homeScore),
      winner: state === "post" ? homeScore >= awayScore : null,
      record: opts.base?.home.record ?? null,
    },
    away: {
      abbr: realAway,
      name: opts.base?.away.name ?? realAway,
      logo: opts.base?.away.logo ?? teamLogo(realAway) ?? "",
      score: String(awayScore),
      winner: state === "post" ? awayScore > homeScore : null,
      record: opts.base?.away.record ?? null,
    },
    situation,
    possession: state === "in" ? (playerTeam(player) ?? null) : null,
    lastPlay: lastPlay?.text ?? null,
    scoring: shown
      .filter((p) => p.scoring)
      .map(
        (p): ScoringPlay => ({
          id: p.id,
          team: player.team ?? realHome,
          logo: teamLogo(player.team),
          text: p.text,
          type: p.type,
          period: p.period,
          clock: p.clock,
          awayScore: p.awayScore,
          homeScore: p.homeScore,
        }),
      ),
    drives: [...drives.values()],
    box: [
      {
        abbr: player.team ?? realHome,
        name: player.team ?? realHome,
        logo: teamLogo(player.team) ?? "",
        groups,
        teamStats: [],
      },
    ],
  };
}

function boxGroupsFor(
  player: SlimPlayer,
  bag: Record<string, number>,
  shown: Record<string, number>,
): BoxGroup[] {
  const pos = (player.position ?? "").toUpperCase();
  const id = player.espn_id != null ? String(player.espn_id) : player.player_id;
  const row = {
    id,
    name: player.full_name,
    jersey: player.number != null ? String(player.number) : null,
    headshot: playerHeadshot(player.player_id, player.espn_id),
    stats: [] as string[],
  };
  if (pos === "QB") {
    const cmp = n(shown, "pass_cmp");
    const inc = n(shown, "pass_inc");
    return [
      {
        name: "passing",
        label: "Passing",
        headers: ["C/ATT", "YDS", "TD", "INT"],
        rows: [
          {
            ...row,
            stats: [
              `${cmp}/${cmp + inc}`,
              String(Math.round(n(shown, "pass_yd"))),
              String(n(shown, "pass_td")),
              String(n(shown, "pass_int")),
            ],
          },
        ],
      },
    ];
  }
  if (pos === "K") {
    return [
      {
        name: "kicking",
        label: "Kicking",
        headers: ["FG", "XP"],
        rows: [
          {
            ...row,
            stats: [
              String(n(shown, "fgm") || n(shown, "fgm_30_39") + n(shown, "fgm_40_49")),
              String(n(shown, "xpm")),
            ],
          },
        ],
      },
    ];
  }
  if (pos === "DEF" || pos === "DST") {
    return [
      {
        name: "defensive",
        label: "Defense",
        headers: ["SACK", "INT", "TD", "PA"],
        rows: [
          {
            ...row,
            stats: [
              String(n(shown, "sack")),
              String(n(shown, "int")),
              String(n(shown, "def_td")),
              String(n(shown, "pts_allow")),
            ],
          },
        ],
      },
    ];
  }
  const groups: BoxGroup[] = [];
  if (n(bag, "rush_yd") || n(bag, "rush_att")) {
    groups.push({
      name: "rushing",
      label: "Rushing",
      headers: ["CAR", "YDS", "TD"],
      rows: [
        {
          ...row,
          stats: [
            String(n(shown, "rush_att")),
            String(Math.round(n(shown, "rush_yd"))),
            String(n(shown, "rush_td")),
          ],
        },
      ],
    });
  }
  if (n(bag, "rec") || n(bag, "rec_yd")) {
    const rec = n(shown, "rec");
    const yds = Math.round(n(shown, "rec_yd"));
    groups.push({
      name: "receiving",
      label: "Receiving",
      headers: ["REC", "YDS", "AVG", "TD"],
      rows: [
        {
          ...row,
          stats: [
            String(rec),
            String(yds),
            rec ? (yds / rec).toFixed(1) : "0",
            String(n(shown, "rec_td")),
          ],
        },
      ],
    });
  }
  return groups;
}

export function bagForPlayer(
  player: SlimPlayer,
  incoming: Record<string, number> | null | undefined,
  week = 1,
): Record<string, number> {
  if (incoming && Object.keys(incoming).length) return incoming;
  return demoStatBag(player.player_id, player.position, week);
}

export { REPLAY_PHASES };
