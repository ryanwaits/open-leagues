import { parseRebuildPaste, type RebuildTeamIn } from "./rebuild";
import { WIFFL_2026, wifflTeams } from "./recaps/wiffl-2026";

export type RecapFormat = "espn-recap" | "rebuild" | "csv" | "known" | "edited";

export type RecapParseResult = {
  teams: RebuildTeamIn[];
  format: RecapFormat;
  knownId: string | null;
  suggestedName: string | null;
  suggestedSeason: string | null;
  warnings: string[];
  pickCount: number;
};

export type ImportSource = {
  paste?: string;
  known?: string;
  pdfBase64?: string;
  teams?: RebuildTeamIn[];
};

const NFL = new Set([
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAC",
  "JAX",
  "KC",
  "LA",
  "LAC",
  "LAR",
  "LV",
  "LVR",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
  "WSH",
  "FA",
]);

const POS = new Set(["QB", "RB", "WR", "TE", "K", "PK", "DEF", "DST", "D/ST", "DL", "LB", "DB"]);

const TEAM_ALIASES: Record<string, string> = {
  cornhut: "Coinshot",
  coinshot: "Coinshot",
  chambaflav: "Chamba-Flav",
  bladebms: "Blade BMs",
  bladebm: "Blade BMs",
  neckedninja: "Necked Ninja",
  "6packjack": "6 Pack Jack",
  sixpackjack: "6 Pack Jack",
  babypj: "Baby PJ",
  thetruth: "The Truth",
  msdoss: "MSDoss",
  strigiformes: "Strigiformes",
  chumheads: "Chumheads",
  shardbearer: "Shardbearer",
  butterbean: "Butterbean",
  hypergonad: "Hypergonad",
};

const KNOWN: Record<string, { name: string; season: string; load: () => RebuildTeamIn[] }> = {
  "wiffl-2026": { name: WIFFL_2026.name, season: WIFFL_2026.season, load: wifflTeams },
};

function keyOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function canonTeamName(raw: string): string {
  const trimmed = raw
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim();
  if (!trimmed) return trimmed;
  return TEAM_ALIASES[keyOf(trimmed)] ?? trimmed.slice(0, 40);
}

export function detectKnownRecap(text: string): string | null {
  if (!text) return null;
  if (text.includes("907798861")) return "wiffl-2026";
  const hasWiffl = /\bWIFFL\b/i.test(text);
  const hasRecap = /draft\s+recap/i.test(text);
  if (hasWiffl && hasRecap) return "wiffl-2026";
  let hits = 0;
  for (const name of WIFFL_2026.teams.map((t) => t.teamName)) {
    if (text.includes(name)) hits++;
  }
  if (text.includes("Cornhut")) hits++;
  if (hits >= 6) return "wiffl-2026";
  return null;
}

export function extractPdfHints(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const chunks: string[] = [];
  const lit = /\((?:\\.|[^\\)]){3,160}\)/g;
  let m = lit.exec(raw);
  while (m) {
    const s = m[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[A-Za-z]{3}/.test(s)) chunks.push(s);
    m = lit.exec(raw);
  }
  const urls = raw.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
  chunks.push(...urls);
  return chunks.join("\n");
}

function decodePdfBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  return Uint8Array.from(Buffer.from(clean, "base64"));
}

type RawPick = { round: number; slot: number; player: string; team: string | null };

const PICK_RE = /^(?:(\d{1,2})\s+)?(.+?)\s+([A-Z]{2,3})\s*,\s*([A-Z]{1,3}(?:\/ST)?)\s+(.+)$/;

function isPos(raw: string): boolean {
  return POS.has(raw.toUpperCase());
}

function parsePickLine(line: string, currentRound: number): RawPick | null {
  const trimmed = line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 120) return null;
  if (/^(no\.?|player|team|round|draft|view|type)\b/i.test(trimmed)) return null;
  const m = trimmed.match(PICK_RE);
  if (!m) return null;
  const slot = m[1] ? Number(m[1]) : 0;
  const player = (m[2] ?? "").trim();
  const nfl = (m[3] ?? "").toUpperCase();
  const pos = (m[4] ?? "").toUpperCase();
  let teamRaw = (m[5] ?? "").trim();
  if (!player || player.length < 3) return null;
  if (!NFL.has(nfl) || !isPos(pos)) return null;
  if (/espn|fantasy|support|copyright|http/i.test(teamRaw)) return null;
  if (NFL.has(teamRaw.toUpperCase()) || isPos(teamRaw)) teamRaw = "";
  const team = teamRaw ? canonTeamName(teamRaw) : null;
  if (team && (NFL.has(team.toUpperCase()) || team.length < 2)) return null;
  return { round: currentRound, slot, player: player.replace(/\s+/g, " "), team };
}

export function parseEspnRecap(raw: string): RebuildTeamIn[] {
  const lines = raw.replace(/\r/g, "").split("\n");
  const picks: RawPick[] = [];
  let currentRound = 1;
  let lastSlot = 0;
  for (const line of lines) {
    const round = line.match(/^\s*round\s+(\d+)/i);
    if (round) {
      currentRound = Number(round[1]);
      lastSlot = 0;
      continue;
    }
    const pick = parsePickLine(line, currentRound);
    if (!pick) continue;
    if (pick.slot && pick.slot < lastSlot && pick.slot <= 2) currentRound += 1;
    pick.round = currentRound;
    lastSlot = pick.slot || lastSlot + 1;
    if (!pick.slot) pick.slot = lastSlot;
    picks.push(pick);
  }
  if (picks.length < 4) return [];

  const teamCounts = new Map<string, number>();
  for (const p of picks) {
    if (p.team) teamCounts.set(p.team, (teamCounts.get(p.team) ?? 0) + 1);
  }
  const named = [...teamCounts.keys()];
  const teamCount = named.length >= 4 ? named.length : guessTeamCount(picks);

  const order = deriveDraftOrder(picks, teamCount);
  if (order) {
    for (const p of picks) {
      if (p.team) continue;
      const idx = snakeOwner(p.round, p.slot, order.length);
      const name = order[idx];
      if (name) p.team = name;
    }
  }

  const byTeam = new Map<string, RebuildTeamIn>();
  const ensure = (name: string) => {
    const key = keyOf(name);
    let row = [...byTeam.values()].find((t) => keyOf(t.teamName) === key);
    if (!row) {
      row = emptyTeam(name);
      byTeam.set(key, row);
    }
    return row;
  };
  if (order) for (const name of order) ensure(name);
  for (const p of picks) {
    if (!p.team) continue;
    const row = ensure(p.team);
    if (!row.names.includes(p.player)) row.names.push(p.player);
  }
  const teams = order
    ? order.map((n) => ensure(n))
    : [...byTeam.values()].filter((t) => t.names.length);
  return teams.filter((t) => t.names.length);
}

function guessTeamCount(picks: RawPick[]): number {
  const slots = picks.filter((p) => p.round === 1 && p.slot).map((p) => p.slot);
  if (slots.length) return Math.max(...slots);
  const byRound = new Map<number, number>();
  for (const p of picks) byRound.set(p.round, (byRound.get(p.round) ?? 0) + 1);
  const counts = [...byRound.values()];
  return counts.length ? Math.max(...counts) : 0;
}

function snakeOwner(round: number, slot: number, n: number): number {
  if (n <= 0) return 0;
  const i = Math.max(0, Math.min(n, slot) - 1);
  return round % 2 === 1 ? i : n - 1 - i;
}

function deriveDraftOrder(picks: RawPick[], teamCount: number): string[] | null {
  if (teamCount < 2) return null;
  const byRound = new Map<number, RawPick[]>();
  for (const p of picks) {
    const list = byRound.get(p.round) ?? [];
    list.push(p);
    byRound.set(p.round, list);
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  for (const [round, list] of rounds) {
    const named = list.filter((p) => p.team).sort((a, b) => a.slot - b.slot);
    if (named.length < teamCount) continue;
    const names = named.slice(0, teamCount).map((p) => p.team!);
    const unique = new Set(names.map(keyOf));
    if (unique.size < teamCount) continue;
    return round % 2 === 1 ? names : [...names].reverse();
  }
  return null;
}

function emptyTeam(teamName: string): RebuildTeamIn {
  return {
    teamName: canonTeamName(teamName),
    manager: "Manager",
    wins: null,
    losses: null,
    ties: null,
    pf: null,
    pa: null,
    names: [],
  };
}

function parseCsvTeams(raw: string): RebuildTeamIn[] {
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return [];
  const commaish = lines.filter((l) => l.includes(",")).length;
  if (commaish < lines.length * 0.6) return [];
  const header = lines[0]!.toLowerCase();
  const looksHeader = /team|player|roster|manager/.test(header);
  const start = looksHeader ? 1 : 0;
  const byTeam = new Map<string, RebuildTeamIn>();
  for (const line of lines.slice(start)) {
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) continue;
    const teamName = canonTeamName(parts[0]!);
    if (teamName.length < 2) continue;
    const key = keyOf(teamName);
    let row = byTeam.get(key);
    if (!row) {
      row = emptyTeam(teamName);
      if (parts[1] && !looksLikePlayer(parts[1])) row.manager = parts[1]!.slice(0, 32);
      byTeam.set(key, row);
    }
    const playerStart = row.manager !== "Manager" && parts[1] === row.manager ? 2 : 1;
    for (const bit of parts.slice(playerStart)) {
      if (bit && looksLikePlayer(bit)) row.names.push(bit);
    }
  }
  return [...byTeam.values()].filter((t) => t.names.length >= 1);
}

function looksLikePlayer(s: string): boolean {
  if (s.length < 3 || s.length > 48) return false;
  if (/^\d+([.-]\d+)?$/.test(s)) return false;
  if (/^(manager|owner|team|player|record)$/i.test(s)) return false;
  return /[A-Za-z]/.test(s);
}

function loadKnown(id: string): RecapParseResult | null {
  const pack = KNOWN[id];
  if (!pack) return null;
  const teams = pack.load();
  return {
    teams,
    format: "known",
    knownId: id,
    suggestedName: pack.name,
    suggestedSeason: pack.season,
    warnings: [],
    pickCount: teams.reduce((n, t) => n + t.names.length, 0),
  };
}

export function parseImportSource(input: ImportSource): RecapParseResult {
  if (input.teams && input.teams.length >= 2) {
    const teams = input.teams.map((t) => ({
      ...t,
      teamName: canonTeamName(t.teamName),
      names: t.names.map((n) => n.trim()).filter(Boolean),
    }));
    return {
      teams,
      format: "edited",
      knownId: null,
      suggestedName: null,
      suggestedSeason: null,
      warnings: [],
      pickCount: teams.reduce((n, t) => n + t.names.length, 0),
    };
  }

  let text = input.paste ?? "";
  let knownId = input.known?.trim() || null;
  const warnings: string[] = [];

  if (input.pdfBase64) {
    try {
      const hints = extractPdfHints(decodePdfBase64(input.pdfBase64));
      knownId = knownId ?? detectKnownRecap(hints);
      if (!knownId) {
        const espn = parseEspnRecap(hints);
        if (espn.length >= 2) {
          return finish(espn, "espn-recap", null, warnings, hints);
        }
        text = [text, hints].filter(Boolean).join("\n");
        if (!espn.length) {
          warnings.push(
            "That PDF looks like a print image — team names weren’t in the text layer. Paste the recap or load a known draft.",
          );
        }
      }
    } catch {
      warnings.push("Couldn’t read that PDF. Try pasting the recap text.");
    }
  }

  if (!knownId) knownId = detectKnownRecap(text);
  if (knownId) {
    const hit = loadKnown(knownId);
    if (hit) {
      hit.warnings = warnings;
      return hit;
    }
  }

  const espn = parseEspnRecap(text);
  if (espn.length >= 2) return finish(espn, "espn-recap", null, warnings, text);

  const csv = parseCsvTeams(text);
  if (csv.length >= 2) return finish(csv, "csv", null, warnings, text);

  const rebuilt = parseRebuildPaste(text);
  if (rebuilt.length >= 2) return finish(rebuilt, "rebuild", null, warnings, text);

  if (warnings.length) {
    return {
      teams: [],
      format: "rebuild",
      knownId: null,
      suggestedName: null,
      suggestedSeason: null,
      warnings,
      pickCount: 0,
    };
  }
  throw new Error("Need at least two teams. Paste a recap, drop a file, or load a known draft.");
}

function finish(
  teams: RebuildTeamIn[],
  format: RecapFormat,
  knownId: string | null,
  warnings: string[],
  text: string,
): RecapParseResult {
  const suggested = detectKnownRecap(text);
  return {
    teams,
    format,
    knownId,
    suggestedName: suggested === "wiffl-2026" ? WIFFL_2026.name : null,
    suggestedSeason: suggested === "wiffl-2026" ? WIFFL_2026.season : null,
    warnings,
    pickCount: teams.reduce((n, t) => n + t.names.length, 0),
  };
}

export function listKnownRecaps(): { id: string; name: string; season: string; teams: number }[] {
  return [
    {
      id: WIFFL_2026.id,
      name: WIFFL_2026.name,
      season: WIFFL_2026.season,
      teams: WIFFL_2026.teams.length,
    },
  ];
}
