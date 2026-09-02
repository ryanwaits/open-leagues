import { type GradedBet, profitPerUnit } from "./bets";

/**
 * Staking, as arithmetic. Which policy to use is the person's or the agent's
 * call; what a policy does to a bankroll over two hundred bets — compounding,
 * Kelly at varying prices, drawdown in dollars, the spread of outcomes if the
 * same bets had landed in a different order — is exactly where a hand-rolled
 * estimate slips. Pure and seeded, so two agents get the same curve.
 */
export type StakingPolicy =
  | { type: "flat"; unit: number }
  | { type: "percent"; pct: number; cap?: number }
  | {
      type: "kelly";
      fraction: number;
      cap?: number;
      /** Win probability to feed Kelly. Omit to use the graded set's own hit rate (flagged). */
      winProb?: number;
    };

export type BankrollSim = {
  bankroll: number;
  final: number;
  profit: number;
  roi: number;
  bets: number;
  bust: boolean;
  maxDrawdown: { dollars: number; pct: number };
  longestLosingRun: { bets: number; dollars: number };
  /** Bankroll after each decided bet, in play order. Downsampled past 400 points. */
  curve: number[];
  policy: StakingPolicy;
  winProbUsed: number | null;
  winProbSource: "given" | "history" | null;
  /**
   * Resample the graded bets with replacement, 1,000 times, and replay each
   * sample: where the ending lands if these bets are a fair draw from the
   * process that produced them. Under proportional staking the final bankroll
   * does not depend on order, so a permutation would only vary the drawdown;
   * resampling varies both, and is the standard bootstrap.
   */
  bootstrap: {
    runs: number;
    final: { p5: number; p50: number; p95: number };
    maxDrawdownPct: { p5: number; p50: number; p95: number };
    /** Share of samples that end below the starting bankroll. */
    probLoss: number;
    /** Share of samples that bust (compounding policies only). */
    probBust: number;
  } | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** mulberry32: small, seeded, good enough for reshuffling a bet list. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A sample of the same size, drawn with replacement. */
function resampled<T>(xs: T[], next: () => number): T[] {
  const out: T[] = [];
  for (let i = 0; i < xs.length; i++) out.push(xs[Math.floor(next() * xs.length)] as T);
  return out;
}

function stakeFor(
  policy: StakingPolicy,
  bankroll: number,
  odds: number,
  winProb: number | null,
): number {
  if (bankroll <= 0) return 0;
  if (policy.type === "flat") return Math.min(policy.unit, bankroll);
  if (policy.type === "percent") {
    const pct = Math.min(policy.pct, policy.cap ?? policy.pct);
    return (pct / 100) * bankroll;
  }
  const p = winProb ?? 0;
  const b = profitPerUnit(odds);
  const f = (b * p - (1 - p)) / b;
  const raw = Math.max(0, f * policy.fraction);
  const capped = policy.cap != null ? Math.min(raw, policy.cap / 100) : raw;
  return capped * bankroll;
}

function play(
  ordered: GradedBet[],
  bankroll: number,
  policy: StakingPolicy,
  winProb: number | null,
): {
  curve: number[];
  final: number;
  bust: boolean;
  maxDd: number;
  maxDdPct: number;
  run: { bets: number; dollars: number };
} {
  let bank = bankroll;
  let peak = bankroll;
  let maxDd = 0;
  let maxDdPct = 0;
  let runBets = 0;
  let runDollars = 0;
  let worst = { bets: 0, dollars: 0 };
  const curve: number[] = [];
  let bust = false;
  for (const g of ordered) {
    if (g.grade === "void") continue;
    const stake = stakeFor(policy, bank, g.oddsUsed, winProb);
    if (g.grade === "win") {
      bank += stake * profitPerUnit(g.oddsUsed);
      runBets = 0;
      runDollars = 0;
    } else if (g.grade === "loss") {
      bank -= stake;
      runBets += 1;
      runDollars += stake;
      if (runDollars > worst.dollars) worst = { bets: runBets, dollars: runDollars };
    }
    peak = Math.max(peak, bank);
    maxDd = Math.max(maxDd, peak - bank);
    maxDdPct = Math.max(maxDdPct, peak > 0 ? (peak - bank) / peak : 0);
    curve.push(r2(bank));
    if (bank <= 0.005) {
      bust = true;
      bank = 0;
      break;
    }
  }
  return { curve, final: r2(bank), bust, maxDd, maxDdPct, run: worst };
}

function pct(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return r2(sorted[i] ?? 0);
}

export function simulateBankroll(input: {
  graded: GradedBet[];
  bankroll: number;
  policy: StakingPolicy;
  /** Bootstrap resamples to run; 0 disables. Default 1000. */
  bootstrap?: number;
  seed?: number;
}): BankrollSim {
  const ordered = [...input.graded].sort((a, b) => a.season - b.season || a.week - b.week);
  const decided = ordered.filter((g) => g.grade === "win" || g.grade === "loss");
  const wins = decided.filter((g) => g.grade === "win").length;

  let winProb: number | null = null;
  let winProbSource: BankrollSim["winProbSource"] = null;
  if (input.policy.type === "kelly") {
    if (typeof input.policy.winProb === "number") {
      winProb = input.policy.winProb;
      winProbSource = "given";
    } else {
      winProb = decided.length ? wins / decided.length : 0;
      winProbSource = "history";
    }
  }

  const base = play(ordered, input.bankroll, input.policy, winProb);
  const runs = input.bootstrap ?? 1000;
  let bootstrap: BankrollSim["bootstrap"] = null;
  if (runs > 0 && decided.length > 1) {
    const next = rng(input.seed ?? 1);
    const finals: number[] = [];
    const dds: number[] = [];
    let losses = 0;
    let busts = 0;
    for (let i = 0; i < runs; i++) {
      const r = play(resampled(decided, next), input.bankroll, input.policy, winProb);
      finals.push(r.final);
      dds.push(r.maxDdPct * 100);
      if (r.final < input.bankroll) losses += 1;
      if (r.bust) busts += 1;
    }
    finals.sort((a, b) => a - b);
    dds.sort((a, b) => a - b);
    bootstrap = {
      runs,
      final: { p5: pct(finals, 0.05), p50: pct(finals, 0.5), p95: pct(finals, 0.95) },
      maxDrawdownPct: { p5: pct(dds, 0.05), p50: pct(dds, 0.5), p95: pct(dds, 0.95) },
      probLoss: r2(losses / runs),
      probBust: r2(busts / runs),
    };
  }

  const curve =
    base.curve.length > 400
      ? base.curve.filter((_, i) => i % Math.ceil(base.curve.length / 400) === 0)
      : base.curve;

  return {
    bankroll: input.bankroll,
    final: base.final,
    profit: r2(base.final - input.bankroll),
    roi: input.bankroll > 0 ? r2((base.final - input.bankroll) / input.bankroll) : 0,
    bets: decided.length,
    bust: base.bust,
    maxDrawdown: { dollars: r2(base.maxDd), pct: r2(base.maxDdPct * 100) },
    longestLosingRun: { bets: base.run.bets, dollars: r2(base.run.dollars) },
    curve,
    policy: input.policy,
    winProbUsed: winProb === null ? null : r2(winProb),
    winProbSource,
    bootstrap,
  };
}
