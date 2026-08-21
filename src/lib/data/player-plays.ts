import type { BoxRow, GamePlay, GameSummary, SlimPlayer } from "./types";

export function playerSearchKeys(player: SlimPlayer): string[] {
  const keys: string[] = [];
  const last = player.last_name?.trim();
  const first = player.first_name?.trim();
  const full = player.full_name?.trim();
  if (last && last.length > 2) keys.push(last);
  if (full && full.length > 3) keys.push(full);
  if (first && last && last.length > 2) keys.push(`${first} ${last}`);
  if (player.position === "DEF" && player.team) {
    keys.push(player.team);
    keys.push(`${player.team} D`);
  }
  return keys;
}

export function playMentionsPlayer(text: string, player: SlimPlayer): boolean {
  const hay = text.toLowerCase();
  return playerSearchKeys(player).some((k) => hay.includes(k.toLowerCase()));
}

export function playerPlays(g: GameSummary, player: SlimPlayer): GamePlay[] {
  const out: GamePlay[] = [];
  const seen = new Set<string>();
  for (const drive of g.drives) {
    for (const play of drive.plays) {
      if (seen.has(play.id)) continue;
      if (playMentionsPlayer(play.text, player)) {
        seen.add(play.id);
        out.push(play);
      }
    }
  }
  for (const s of g.scoring) {
    if (seen.has(s.id)) continue;
    if (playMentionsPlayer(s.text, player)) {
      seen.add(s.id);
      out.push({
        id: s.id,
        text: s.text,
        type: s.type,
        scoring: true,
        period: s.period,
        clock: s.clock,
        awayScore: s.awayScore,
        homeScore: s.homeScore,
        yardage: null,
      });
    }
  }
  return out;
}

export function playerBoxHits(
  g: GameSummary,
  player: SlimPlayer,
): Array<{ team: string; logo: string; group: string; headers: string[]; row: BoxRow }> {
  const espn = player.espn_id != null ? String(player.espn_id) : null;
  const last = (player.last_name || player.full_name.split(/\s+/).pop() || "").toLowerCase();
  const hits: Array<{ team: string; logo: string; group: string; headers: string[]; row: BoxRow }> =
    [];
  for (const team of g.box) {
    for (const group of team.groups) {
      for (const row of group.rows) {
        const idHit = espn && row.id === espn;
        const nameHit = last.length > 2 && row.name.toLowerCase().includes(last);
        if (idHit || nameHit) {
          hits.push({
            team: team.abbr,
            logo: team.logo,
            group: group.label,
            headers: group.headers,
            row,
          });
        }
      }
    }
  }
  return hits;
}

export function situationIsRedZone(situation: string | null | undefined): boolean {
  if (!situation) return false;
  if (/red\s*zone/i.test(situation)) return true;
  const m = situation.match(/\bat\s+[A-Z]{2,3}\s+(\d{1,2})\b/i);
  if (m) return Number(m[1]) <= 20;
  return false;
}
