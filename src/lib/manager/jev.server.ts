import type { LabeledMove, Motive } from "./spec";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MOTIVES: Motive[] = ["injury_fill", "bye_stream", "stash", "panic", "nothing", "other"];

export function typesafeKey(): string | null {
  const k = process.env.TYPESAFE_API_KEY?.trim();
  return k || null;
}

type JevChoice = {
  type: "choice";
  choice?: string;
  confidence?: number;
};
type JevScore = { type: "score"; score?: number; confidence?: number };
type JevNoul = { type: "noul"; noul?: number };

type JevResponse = {
  model?: string;
  answers?: {
    motive?: JevChoice;
    bid_aggression?: JevScore;
    must_move?: JevNoul;
  };
};

function asMotive(v: string | undefined): Motive | null {
  if (!v) return null;
  return MOTIVES.includes(v as Motive) ? (v as Motive) : "other";
}

export async function classifyOne(move: LabeledMove, key: string): Promise<LabeledMove> {
  const state = {
    week: move.week,
    type: move.type,
    player: move.playerName ?? move.playerId,
    pos: move.pos,
    bid: move.bid,
    remainingBefore: move.remainingBefore,
    budget: move.budget,
    sleeperProj: move.sleeperProj,
    last3: move.last3,
    seasonAvg: move.seasonAvg,
    drop: move.dropPlayerId,
  };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "jev-latest",
      state,
      questions: {
        motive: {
          type: "choice",
          instructions: "Why did this manager make this roster move?",
          criteria: {
            injury_fill: "Replacing an injured or out starter",
            bye_stream: "Streaming a bye-week hole",
            stash: "Upside stash, not needed this week",
            panic: "Chasing points after a bad week",
            nothing: "No real need; idle or trivial",
            other: "Does not fit the other labels",
          },
        },
        bid_aggression: {
          type: "score",
          instructions: "How aggressive is this FAAB bid versus remaining budget?",
          min: 0,
          max: 4,
        },
        must_move: {
          type: "noul",
          instructions: "Was this a must-move week given the roster context?",
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Jev ${res.status}`);
  const body = (await res.json()) as JevResponse;
  const motive = asMotive(body.answers?.motive?.choice);
  return {
    ...move,
    motive,
    bidAggression: body.answers?.bid_aggression?.score ?? null,
    mustMove: body.answers?.must_move?.noul ?? null,
    jevModel: body.model ?? "jev-latest",
    jevConfidence: body.answers?.motive?.confidence ?? null,
  };
}
