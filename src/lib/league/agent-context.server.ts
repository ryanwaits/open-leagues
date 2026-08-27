import { AGENT_TOOLS, type AgentScope } from "@/lib/agent/catalog";
import { getSql } from "@/lib/db";

export type AgentContext = {
  leagueId: string;
  name: string;
  week: number;
  status: string;
  you: {
    userId: string;
    rosterId: number;
    teamName: string;
    isCommish: boolean;
  } | null;
  purse: { remaining: number; atRisk: number; spendable: number } | null;
  knobs: {
    bettingOn: boolean;
    wagerCap: number;
    exposureCap: number;
    bookLocked: boolean;
  };
  facts: Array<{ kind: string; teams: string[]; text: string }>;
  recent: Array<{
    id: string;
    week: number;
    kind: string;
    amount: number | null;
    at: string;
  }>;
  tools: Array<{ id: string; scope: string; kind: string }>;
};

const SCOPE_RANK: Record<AgentScope, number> = {
  spectator: 0,
  manager: 1,
  commish: 2,
};

/**
 * One dump of seat, spendable FAAB, facts, recent events, and in-scope tools.
 * Purse is computed even when betting is off — unlike getBook.
 */
export async function loadAgentContext(
  leagueId: string,
  userId: string | null,
): Promise<AgentContext> {
  const sql = await getSql();
  const league = (
    await sql<{
      id: string;
      name: string;
      status: string;
      current_week: number;
      commish_id: string;
      betting_on: number | null;
      wager_cap: number | null;
      exposure_cap: number | null;
      wagers_locked_week: number | null;
      faab_budget: number | null;
    }>`
      select id, name, status, current_week, commish_id,
             betting_on, wager_cap, exposure_cap, wagers_locked_week, faab_budget
      from ol_leagues where id = ${leagueId}
    `
  )[0];
  if (!league) throw new Error("League not found");

  const week = league.current_week ?? 1;
  const isCommish = Boolean(userId && league.commish_id === userId);

  let seat: { rosterId: number; teamName: string; remaining: number } | null = null;
  if (userId) {
    const row = (
      await sql<{ roster_id: number; team_name: string; faab_remaining: number | null }>`
        select roster_id, team_name, faab_remaining from ol_rosters
        where league_id = ${leagueId} and owner_id = ${userId}
        limit 1
      `
    )[0];
    if (row) {
      seat = {
        rosterId: row.roster_id,
        teamName: row.team_name,
        remaining: row.faab_remaining ?? league.faab_budget ?? 100,
      };
    }
  }

  let purse: AgentContext["purse"] = null;
  if (seat) {
    const { spendable, atRisk } = await import("./wagers.server");
    const risk = await atRisk(leagueId, seat.rosterId);
    const free = await spendable(leagueId, seat.rosterId, seat.remaining);
    purse = { remaining: seat.remaining, atRisk: risk, spendable: free };
  } else {
    purse = { remaining: 0, atRisk: 0, spendable: 0 };
  }

  const factsMod = await import("./league-facts.server");
  const factsBundle = await factsMod.loadLeagueFacts(leagueId, week);

  const ev = await import("./events.server");
  const events = await ev.readEvents(leagueId, { limit: 20 });

  const yourScope: AgentScope = isCommish ? "commish" : seat ? "manager" : "spectator";
  const yourRank = SCOPE_RANK[yourScope];
  const tools = AGENT_TOOLS.filter((t) => SCOPE_RANK[t.scope] <= yourRank).map((t) => ({
    id: t.id,
    scope: t.scope,
    kind: t.kind,
  }));

  return {
    leagueId: league.id,
    name: league.name,
    week,
    status: league.status,
    you:
      userId && seat
        ? {
            userId,
            rosterId: seat.rosterId,
            teamName: seat.teamName,
            isCommish,
          }
        : null,
    purse,
    knobs: {
      bettingOn: Boolean(league.betting_on),
      wagerCap: league.wager_cap ?? 25,
      exposureCap: league.exposure_cap ?? 60,
      bookLocked: (league.wagers_locked_week ?? 0) >= week,
    },
    facts: factsBundle.facts.map((f) => ({
      kind: f.kind,
      teams: f.teams,
      text: f.text,
    })),
    recent: events.map((e) => ({
      id: e.id,
      week: e.week,
      kind: e.kind,
      amount: e.amount,
      at: e.at,
    })),
    tools,
  };
}
