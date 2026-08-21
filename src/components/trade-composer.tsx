import * as Dialog from "@radix-ui/react-dialog";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayerStatRow, type PlayerStatRowData } from "@/components/player-stat-row";
import { ScrollShade } from "@/components/scroll-shade";
import { TradeRosterAfter } from "@/components/trade-offer-card";
import { Button } from "@/components/ui/button";
import type { Projection, RosterPlayer } from "@/lib/data/types";
import { proposeTrade } from "@/lib/league/fns";
import { tradeDelta } from "@/lib/league/lineup-value";
import { readTrade } from "@/lib/league/trade-read";
import { cn, joinBits, lastName } from "@/lib/utils";

/**
 * The proposed card is the compose object.
 *
 * You get / You give (faces, picks, FAAB) sits first so the deal you are
 * building is the same object you will see in the book. Rosters underneath
 * are pickers. Three-team keeps dest pills and a tabbed picker.
 */

export type TradeComposerPick = {
  pickNo: number;
  label: string;
  via?: string | null;
};

export type TradeComposerPartner = {
  rosterId: number;
  teamName: string;
};

/** Prefill from Counter — already mapped to your send / get columns. */
export type TradeComposerInitial = {
  sendPlayerIds: string[];
  sendPickNos: number[];
  sendFaab: number | null;
  getPlayerIds: string[];
  getPickNos: number[];
  getFaab: number | null;
};

type DirectedPlayer = { id: string; to: number };
type DirectedPick = { pickNo: number; to: number };
type DirectedFaab = { amount: number; to: number };

type RosterTab = "mine" | "them" | "third";

export function TradeComposer({
  leagueId,
  myRosterId,
  theirRosterId,
  thirdRosterId = null,
  partners,
  myRoster,
  theirRoster,
  thirdRoster = [],
  myPicks,
  theirPicks,
  thirdPicks = [],
  projections,
  rosterPositions,
  myFaabFree,
  theirFaabFree,
  thirdFaabFree = null,
  onThirdChange,
  initial,
  countering = false,
  onProposed,
}: {
  leagueId: string;
  myRosterId: number;
  theirRosterId: number;
  /** When set, composer switches to the tabbed three-team layout. */
  thirdRosterId?: number | null;
  partners: TradeComposerPartner[];
  myRoster: RosterPlayer[];
  theirRoster: RosterPlayer[];
  thirdRoster?: RosterPlayer[];
  myPicks: TradeComposerPick[];
  theirPicks: TradeComposerPick[];
  thirdPicks?: TradeComposerPick[];
  projections: Record<string, Projection>;
  rosterPositions: string[];
  myFaabFree: number;
  theirFaabFree: number | null;
  thirdFaabFree?: number | null;
  /** Add / switch / clear the third seat. Required for the + Team control. */
  onThirdChange?: (id: number | null) => void;
  initial?: TradeComposerInitial | null;
  countering?: boolean;
  onProposed?: () => void;
}) {
  const three = thirdRosterId != null;
  const themName =
    partners.find((p) => p.rosterId === theirRosterId)?.teamName ?? `Team ${theirRosterId}`;
  const thirdName =
    thirdRosterId != null
      ? (partners.find((p) => p.rosterId === thirdRosterId)?.teamName ?? `Team ${thirdRosterId}`)
      : "";
  const myName = "You";

  const involvedIds = useMemo(() => {
    const ids = [myRosterId, theirRosterId];
    if (thirdRosterId != null) ids.push(thirdRosterId);
    return ids;
  }, [myRosterId, theirRosterId, thirdRosterId]);

  const availableThirds = useMemo(
    () => partners.filter((p) => p.rosterId !== theirRosterId),
    [partners, theirRosterId],
  );

  // Two-team selections (also the migration source when a third joins).
  const [sendPlayers, setSendPlayers] = useState<string[]>([]);
  const [getPlayers, setGetPlayers] = useState<string[]>([]);
  const [sendPicks, setSendPicks] = useState<number[]>([]);
  const [getPicks, setGetPicks] = useState<number[]>([]);
  const [sendFaab, setSendFaab] = useState<number | null>(null);
  const [getFaab, setGetFaab] = useState<number | null>(null);
  const [sendFaabErr, setSendFaabErr] = useState<string | null>(null);
  const [getFaabErr, setGetFaabErr] = useState<string | null>(null);

  // Three-team: per-asset destinations. Keys are player ids / pick nos.
  const [minePlayers, setMinePlayers] = useState<DirectedPlayer[]>([]);
  const [themPlayers, setThemPlayers] = useState<DirectedPlayer[]>([]);
  const [thirdPlayers, setThirdPlayers] = useState<DirectedPlayer[]>([]);
  const [minePicksSel, setMinePicksSel] = useState<DirectedPick[]>([]);
  const [themPicksSel, setThemPicksSel] = useState<DirectedPick[]>([]);
  const [thirdPicksSel, setThirdPicksSel] = useState<DirectedPick[]>([]);
  const [mineFaab, setMineFaab] = useState<DirectedFaab | null>(null);
  const [themFaab, setThemFaab] = useState<DirectedFaab | null>(null);
  const [thirdFaab, setThirdFaab] = useState<DirectedFaab | null>(null);
  const [mineFaabErr, setMineFaabErr] = useState<string | null>(null);
  const [themFaabErr, setThemFaabErr] = useState<string | null>(null);
  const [thirdFaabErr, setThirdFaabErr] = useState<string | null>(null);

  const [rosterTab, setRosterTab] = useState<RosterTab>("them");
  const [confirmOpen, setConfirmOpen] = useState(false);

  function defaultDest(from: number): number {
    const others = involvedIds.filter((id) => id !== from);
    if (others.includes(myRosterId)) return myRosterId;
    return others[0] ?? theirRosterId;
  }

  function nameOf(id: number): string {
    if (id === myRosterId) return myName;
    if (id === theirRosterId) return themName;
    if (id === thirdRosterId) return thirdName;
    return partners.find((p) => p.rosterId === id)?.teamName ?? `Team ${id}`;
  }

  function clearTwoTeam() {
    setSendPlayers([]);
    setGetPlayers([]);
    setSendPicks([]);
    setGetPicks([]);
    setSendFaab(null);
    setGetFaab(null);
    setSendFaabErr(null);
    setGetFaabErr(null);
  }

  function clearThreeTeam() {
    setMinePlayers([]);
    setThemPlayers([]);
    setThirdPlayers([]);
    setMinePicksSel([]);
    setThemPicksSel([]);
    setThirdPicksSel([]);
    setMineFaab(null);
    setThemFaab(null);
    setThirdFaab(null);
    setMineFaabErr(null);
    setThemFaabErr(null);
    setThirdFaabErr(null);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: clearThreeTeam is a plain function recreated every render — listing it would re-run this on every render instead of only when `initial` changes
  useEffect(() => {
    if (!initial) return;
    setSendPlayers(initial.sendPlayerIds);
    setGetPlayers(initial.getPlayerIds);
    setSendPicks(initial.sendPickNos);
    setGetPicks(initial.getPickNos);
    setSendFaab(initial.sendFaab);
    setGetFaab(initial.getFaab);
    setSendFaabErr(null);
    setGetFaabErr(null);
    // Counter is two-team; clear any three-way state.
    clearThreeTeam();
  }, [initial]);

  // Partner switch drops a half-built deal so chips don't point at the wrong roster.
  // biome-ignore lint/correctness/useExhaustiveDependencies: clearTwoTeam/clearThreeTeam are plain functions recreated every render (would fire every render if listed); theirRosterId is the deliberate trigger even though it's not read in the body
  useEffect(() => {
    if (initial) return;
    clearTwoTeam();
    clearThreeTeam();
  }, [theirRosterId, initial]);

  // Entering / leaving / switching third: migrate selections and scrub stale dests.
  const prevThirdRef = useRef<number | null | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: migrate on third join/leave/switch only — deliberately reads current send/get/faab state via the ref-tracked transition, not on their changes
  useEffect(() => {
    const prev = prevThirdRef.current;
    prevThirdRef.current = thirdRosterId;
    // Skip first mount — nothing to migrate.
    if (prev === undefined) return;

    if (prev == null && thirdRosterId != null) {
      // Two → three: lift two-team selections into directed legs.
      setMinePlayers(sendPlayers.map((id) => ({ id, to: theirRosterId })));
      setThemPlayers(getPlayers.map((id) => ({ id, to: myRosterId })));
      setMinePicksSel(sendPicks.map((pickNo) => ({ pickNo, to: theirRosterId })));
      setThemPicksSel(getPicks.map((pickNo) => ({ pickNo, to: myRosterId })));
      setMineFaab(
        sendFaab != null && sendFaab > 0 ? { amount: sendFaab, to: theirRosterId } : null,
      );
      setThemFaab(getFaab != null && getFaab > 0 ? { amount: getFaab, to: myRosterId } : null);
      setThirdPlayers([]);
      setThirdPicksSel([]);
      setThirdFaab(null);
      setMineFaabErr(null);
      setThemFaabErr(null);
      setThirdFaabErr(null);
      setRosterTab("them");
      return;
    }

    if (prev != null && thirdRosterId == null) {
      // Three → two: keep me↔them only; never leave a dest pointing at the gone seat.
      setMinePlayers((list) => {
        const kept = list
          .filter((a) => a.to === theirRosterId || a.to === myRosterId)
          .map((a) => ({ id: a.id, to: theirRosterId }));
        setSendPlayers(kept.map((a) => a.id));
        return [];
      });
      setThemPlayers((list) => {
        const kept = list
          .filter((a) => a.to === myRosterId || a.to === theirRosterId)
          .map((a) => ({ id: a.id, to: myRosterId }));
        setGetPlayers(kept.map((a) => a.id));
        return [];
      });
      setMinePicksSel((list) => {
        const kept = list
          .filter((a) => a.to === theirRosterId || a.to === myRosterId)
          .map((a) => ({ pickNo: a.pickNo, to: theirRosterId }));
        setSendPicks(kept.map((a) => a.pickNo));
        return [];
      });
      setThemPicksSel((list) => {
        const kept = list
          .filter((a) => a.to === myRosterId || a.to === theirRosterId)
          .map((a) => ({ pickNo: a.pickNo, to: myRosterId }));
        setGetPicks(kept.map((a) => a.pickNo));
        return [];
      });
      setMineFaab((f) => {
        const next =
          f && (f.to === theirRosterId || f.to === myRosterId)
            ? { amount: f.amount, to: theirRosterId }
            : null;
        setSendFaab(next?.amount ?? null);
        return null;
      });
      setThemFaab((f) => {
        const next =
          f && (f.to === myRosterId || f.to === theirRosterId)
            ? { amount: f.amount, to: myRosterId }
            : null;
        setGetFaab(next?.amount ?? null);
        return null;
      });
      setThirdPlayers([]);
      setThirdPicksSel([]);
      setThirdFaab(null);
      setMineFaabErr(null);
      setThemFaabErr(null);
      setThirdFaabErr(null);
      setSendFaabErr(null);
      setGetFaabErr(null);
      setRosterTab("them");
      return;
    }

    if (prev != null && thirdRosterId != null && prev !== thirdRosterId) {
      // Third seat swapped: drop that leg; retarget assets that pointed at the old third.
      setThirdPlayers([]);
      setThirdPicksSel([]);
      setThirdFaab(null);
      setThirdFaabErr(null);
      setMinePlayers((list) =>
        list.map((a) => ({ ...a, to: a.to === prev ? theirRosterId : a.to })),
      );
      setThemPlayers((list) => list.map((a) => ({ ...a, to: a.to === prev ? myRosterId : a.to })));
      setMinePicksSel((list) =>
        list.map((a) => ({ ...a, to: a.to === prev ? theirRosterId : a.to })),
      );
      setThemPicksSel((list) => list.map((a) => ({ ...a, to: a.to === prev ? myRosterId : a.to })));
      setMineFaab((f) => (f && f.to === prev ? { ...f, to: theirRosterId } : f));
      setThemFaab((f) => (f && f.to === prev ? { ...f, to: myRosterId } : f));
      setRosterTab("third");
    }
  }, [thirdRosterId]);

  // --- Balance: always your roster only ---
  const tradeSides = useMemo(() => {
    let outgoingIds: string[];
    let incoming: RosterPlayer[];
    let outgoing: RosterPlayer[];
    if (three) {
      outgoingIds = minePlayers.map((a) => a.id);
      outgoing = myRoster.filter((p) => outgoingIds.includes(p.player_id));
      incoming = [
        ...theirRoster.filter((p) =>
          themPlayers.some((a) => a.id === p.player_id && a.to === myRosterId),
        ),
        ...thirdRoster.filter((p) =>
          thirdPlayers.some((a) => a.id === p.player_id && a.to === myRosterId),
        ),
      ];
    } else {
      outgoingIds = sendPlayers;
      outgoing = myRoster.filter((p) => sendPlayers.includes(p.player_id));
      incoming = theirRoster.filter((p) => getPlayers.includes(p.player_id));
    }
    return { outgoingIds, incoming, outgoing };
  }, [
    three,
    myRoster,
    theirRoster,
    thirdRoster,
    sendPlayers,
    getPlayers,
    minePlayers,
    themPlayers,
    thirdPlayers,
    myRosterId,
  ]);

  const delta = useMemo(() => {
    if (!rosterPositions.length) return null;
    return tradeDelta({
      players: myRoster,
      rosterPositions,
      projections,
      outgoingIds: tradeSides.outgoingIds,
      incoming: tradeSides.incoming,
    });
  }, [myRoster, rosterPositions, projections, tradeSides]);

  const read = useMemo(() => {
    if (!delta) return null;
    return readTrade({
      delta,
      incoming: tradeSides.incoming,
      outgoing: tradeSides.outgoing,
    });
  }, [delta, tradeSides]);

  const faabNet = useMemo(() => {
    if (!three) return (getFaab ?? 0) - (sendFaab ?? 0);
    let net = 0;
    if (mineFaab) net -= mineFaab.amount;
    if (themFaab?.to === myRosterId) net += themFaab.amount;
    if (thirdFaab?.to === myRosterId) net += thirdFaab.amount;
    return net;
  }, [three, getFaab, sendFaab, mineFaab, themFaab, thirdFaab, myRosterId]);

  const posBefore = useMemo(() => countPositions(myRoster), [myRoster]);
  const posAfter = useMemo(() => {
    let outgoing: Set<string>;
    let incoming: RosterPlayer[];
    if (three) {
      outgoing = new Set(minePlayers.map((a) => a.id));
      incoming = [
        ...theirRoster.filter((p) =>
          themPlayers.some((a) => a.id === p.player_id && a.to === myRosterId),
        ),
        ...thirdRoster.filter((p) =>
          thirdPlayers.some((a) => a.id === p.player_id && a.to === myRosterId),
        ),
      ];
    } else {
      outgoing = new Set(sendPlayers);
      incoming = theirRoster.filter((p) => getPlayers.includes(p.player_id));
    }
    return countPositions([...myRoster.filter((p) => !outgoing.has(p.player_id)), ...incoming]);
  }, [
    three,
    myRoster,
    theirRoster,
    thirdRoster,
    sendPlayers,
    getPlayers,
    minePlayers,
    themPlayers,
    thirdPlayers,
    myRosterId,
  ]);

  const hasAsset = three
    ? minePlayers.length > 0 ||
      themPlayers.length > 0 ||
      thirdPlayers.length > 0 ||
      minePicksSel.length > 0 ||
      themPicksSel.length > 0 ||
      thirdPicksSel.length > 0 ||
      (mineFaab != null && mineFaab.amount > 0) ||
      (themFaab != null && themFaab.amount > 0) ||
      (thirdFaab != null && thirdFaab.amount > 0)
    : sendPlayers.length > 0 ||
      getPlayers.length > 0 ||
      sendPicks.length > 0 ||
      getPicks.length > 0 ||
      (sendFaab != null && sendFaab > 0) ||
      (getFaab != null && getFaab > 0);

  const faabBlocked = three
    ? Boolean(mineFaabErr || themFaabErr || thirdFaabErr)
    : Boolean(sendFaabErr || getFaabErr);

  const send = useMutation({
    mutationFn: async () => {
      if (theirRosterId === myRosterId) throw new Error("Pick a partner.");
      if (!hasAsset) throw new Error("Add a player, pick, or FAAB.");

      const assets: Array<{
        fromRoster: number;
        toRoster: number;
        kind: "player" | "pick" | "faab";
        playerId?: string | null;
        pickNo?: number | null;
        amount?: number | null;
      }> = [];

      if (three && thirdRosterId != null) {
        const alive = new Set(involvedIds);
        const pushDirected = (
          from: number,
          players: DirectedPlayer[],
          picks: DirectedPick[],
          faab: DirectedFaab | null,
          faabCap: number | null,
          label: string,
        ) => {
          for (const a of players) {
            if (!alive.has(a.to) || a.to === from) {
              throw new Error("An asset points at a team no longer in the deal.");
            }
            assets.push({
              fromRoster: from,
              toRoster: a.to,
              kind: "player",
              playerId: a.id,
            });
          }
          for (const a of picks) {
            if (!alive.has(a.to) || a.to === from) {
              throw new Error("An asset points at a team no longer in the deal.");
            }
            assets.push({
              fromRoster: from,
              toRoster: a.to,
              kind: "pick",
              pickNo: a.pickNo,
            });
          }
          if (faab != null && faab.amount > 0) {
            if (!alive.has(faab.to) || faab.to === from) {
              throw new Error("An asset points at a team no longer in the deal.");
            }
            if (faabCap != null && faab.amount > faabCap) {
              throw new Error(`${label} only has $${faabCap} to trade.`);
            }
            assets.push({
              fromRoster: from,
              toRoster: faab.to,
              kind: "faab",
              amount: faab.amount,
            });
          }
        };
        if (mineFaab != null && mineFaab.amount > myFaabFree) {
          throw new Error(`You only have $${myFaabFree} unstaked.`);
        }
        pushDirected(myRosterId, minePlayers, minePicksSel, mineFaab, myFaabFree, "You");
        pushDirected(theirRosterId, themPlayers, themPicksSel, themFaab, theirFaabFree, themName);
        pushDirected(
          thirdRosterId,
          thirdPlayers,
          thirdPicksSel,
          thirdFaab,
          thirdFaabFree,
          thirdName,
        );
      } else {
        if (sendFaab != null && sendFaab > myFaabFree) {
          throw new Error(`You only have $${myFaabFree} unstaked.`);
        }
        if (theirFaabFree != null && getFaab != null && getFaab > theirFaabFree) {
          throw new Error(`They only have $${theirFaabFree} to trade.`);
        }
        for (const id of sendPlayers) {
          assets.push({
            fromRoster: myRosterId,
            toRoster: theirRosterId,
            kind: "player",
            playerId: id,
          });
        }
        for (const n of sendPicks) {
          assets.push({
            fromRoster: myRosterId,
            toRoster: theirRosterId,
            kind: "pick",
            pickNo: n,
          });
        }
        if (sendFaab != null && sendFaab > 0) {
          assets.push({
            fromRoster: myRosterId,
            toRoster: theirRosterId,
            kind: "faab",
            amount: sendFaab,
          });
        }
        for (const id of getPlayers) {
          assets.push({
            fromRoster: theirRosterId,
            toRoster: myRosterId,
            kind: "player",
            playerId: id,
          });
        }
        for (const n of getPicks) {
          assets.push({
            fromRoster: theirRosterId,
            toRoster: myRosterId,
            kind: "pick",
            pickNo: n,
          });
        }
        if (getFaab != null && getFaab > 0) {
          assets.push({
            fromRoster: theirRosterId,
            toRoster: myRosterId,
            kind: "faab",
            amount: getFaab,
          });
        }
      }
      return proposeTrade({ data: { leagueId, assets } });
    },
    onSuccess: () => {
      toast("Trade proposed.");
      setConfirmOpen(false);
      clearTwoTeam();
      clearThreeTeam();
      onProposed?.();
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not propose"),
  });

  function toggleTwoPlayer(side: "send" | "get", id: string) {
    if (side === "send") {
      setSendPlayers((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    } else {
      setGetPlayers((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    }
  }

  function toggleTwoPick(side: "send" | "get", n: number) {
    if (side === "send") {
      setSendPicks((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]));
    } else {
      setGetPicks((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]));
    }
  }

  function setTwoFaab(side: "send" | "get", raw: string) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    const n = digits === "" ? null : Number(digits);
    if (side === "send") {
      if (n != null && n > myFaabFree) {
        setSendFaab(n);
        setSendFaabErr(`You only have $${myFaabFree} unstaked.`);
      } else {
        setSendFaab(n);
        setSendFaabErr(null);
      }
    } else {
      if (theirFaabFree != null && n != null && n > theirFaabFree) {
        setGetFaab(n);
        setGetFaabErr(`They only have $${theirFaabFree} to trade.`);
      } else {
        setGetFaab(n);
        setGetFaabErr(null);
      }
    }
  }

  function toggleDirectedPlayer(
    list: DirectedPlayer[],
    set: (n: DirectedPlayer[]) => void,
    from: number,
    id: string,
  ) {
    if (list.some((a) => a.id === id)) {
      set(list.filter((a) => a.id !== id));
    } else {
      set([...list, { id, to: defaultDest(from) }]);
    }
  }

  function toggleDirectedPick(
    list: DirectedPick[],
    set: (n: DirectedPick[]) => void,
    from: number,
    pickNo: number,
  ) {
    if (list.some((a) => a.pickNo === pickNo)) {
      set(list.filter((a) => a.pickNo !== pickNo));
    } else {
      set([...list, { pickNo, to: defaultDest(from) }]);
    }
  }

  function cycleDest(from: number, current: number): number {
    const others = involvedIds.filter((id) => id !== from);
    const i = others.indexOf(current);
    return others[(i + 1) % others.length] ?? others[0] ?? current;
  }

  function setDirectedFaab(
    from: number,
    cap: number | null,
    capLabel: string,
    current: DirectedFaab | null,
    setFaab: (n: DirectedFaab | null) => void,
    setErr: (n: string | null) => void,
    raw: string,
  ) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    if (digits === "") {
      setFaab(null);
      setErr(null);
      return;
    }
    const amount = Number(digits);
    const to = current?.to ?? defaultDest(from);
    setFaab({ amount, to });
    if (cap != null && amount > cap) {
      setErr(`${capLabel} $${cap}`);
    } else {
      setErr(null);
    }
  }

  const sendPlayerRows = sendPlayers
    .map((id) => myRoster.find((p) => p.player_id === id))
    .filter((p): p is RosterPlayer => p != null);
  const getPlayerRows = getPlayers
    .map((id) => theirRoster.find((p) => p.player_id === id))
    .filter((p): p is RosterPlayer => p != null);
  const sendPickRows = sendPicks
    .map((n) => myPicks.find((p) => p.pickNo === n))
    .filter((p): p is TradeComposerPick => p != null);
  const getPickRows = getPicks
    .map((n) => theirPicks.find((p) => p.pickNo === n))
    .filter((p): p is TradeComposerPick => p != null);

  function resolvePlayers(
    sel: DirectedPlayer[],
    roster: RosterPlayer[],
  ): Array<RosterPlayer & { to: number }> {
    return sel
      .map((a) => {
        const p = roster.find((r) => r.player_id === a.id);
        return p ? { ...p, to: a.to } : null;
      })
      .filter((p): p is RosterPlayer & { to: number } => p != null);
  }

  function resolvePicks(
    sel: DirectedPick[],
    picks: TradeComposerPick[],
  ): Array<TradeComposerPick & { to: number }> {
    return sel
      .map((a) => {
        const p = picks.find((r) => r.pickNo === a.pickNo);
        return p ? { ...p, to: a.to } : null;
      })
      .filter((p): p is TradeComposerPick & { to: number } => p != null);
  }

  const minePlayerRows = resolvePlayers(minePlayers, myRoster);
  const themPlayerRows = resolvePlayers(themPlayers, theirRoster);
  const thirdPlayerRows = resolvePlayers(thirdPlayers, thirdRoster);
  const minePickRows = resolvePicks(minePicksSel, myPicks);
  const themPickRows = resolvePicks(themPicksSel, theirPicks);
  const thirdPickRows = resolvePicks(thirdPicksSel, thirdPicks);

  const youGetPlayers = three
    ? [
        ...themPlayerRows.filter((p) => p.to === myRosterId),
        ...thirdPlayerRows.filter((p) => p.to === myRosterId),
      ]
    : getPlayerRows;
  const youGivePlayers = three ? minePlayerRows : sendPlayerRows;
  const youGetPicks = three
    ? [
        ...themPickRows.filter((p) => p.to === myRosterId),
        ...thirdPickRows.filter((p) => p.to === myRosterId),
      ]
    : getPickRows;
  const youGivePicks = three ? minePickRows : sendPickRows;
  const youGetFaab = three
    ? themFaab?.to === myRosterId
      ? themFaab
      : thirdFaab?.to === myRosterId
        ? thirdFaab
        : null
    : getFaab != null && getFaab > 0
      ? { amount: getFaab }
      : null;
  const youGiveFaab = three
    ? mineFaab
    : sendFaab != null && sendFaab > 0
      ? { amount: sendFaab }
      : null;

  const alsoPlayers = three
    ? [
        ...themPlayerRows.filter((p) => p.to !== myRosterId),
        ...thirdPlayerRows.filter((p) => p.to !== myRosterId),
      ]
    : [];
  const alsoPicks = three
    ? [
        ...themPickRows.filter((p) => p.to !== myRosterId),
        ...thirdPickRows.filter((p) => p.to !== myRosterId),
      ]
    : [];
  const alsoFaab = three
    ? [themFaab, thirdFaab].filter(
        (f): f is DirectedFaab => f != null && f.amount > 0 && f.to !== myRosterId,
      )
    : [];
  const hasAlso = alsoPlayers.length > 0 || alsoPicks.length > 0 || alsoFaab.length > 0;

  const activeRoster =
    rosterTab === "mine"
      ? {
          title: "Your roster",
          players: myRoster,
          picks: myPicks,
          selectedPlayers: minePlayers.map((a) => a.id),
          selectedPicks: minePicksSel.map((a) => a.pickNo),
          onPlayer: (id: string) =>
            toggleDirectedPlayer(minePlayers, setMinePlayers, myRosterId, id),
          onPick: (n: number) => toggleDirectedPick(minePicksSel, setMinePicksSel, myRosterId, n),
          faab: mineFaab?.amount ?? null,
          faabErr: mineFaabErr,
          faabFree: myFaabFree,
          faabLabel: "Your unstaked",
          faabDest: mineFaab ? nameOf(mineFaab.to) : null,
          onFaab: (raw: string) =>
            setDirectedFaab(
              myRosterId,
              myFaabFree,
              "You only have",
              mineFaab,
              setMineFaab,
              setMineFaabErr,
              raw,
            ),
          onCycleFaab: () =>
            setMineFaab((f) => (f ? { ...f, to: cycleDest(myRosterId, f.to) } : f)),
        }
      : rosterTab === "them"
        ? {
            title: themName,
            players: theirRoster,
            picks: theirPicks,
            selectedPlayers: themPlayers.map((a) => a.id),
            selectedPicks: themPicksSel.map((a) => a.pickNo),
            onPlayer: (id: string) =>
              toggleDirectedPlayer(themPlayers, setThemPlayers, theirRosterId, id),
            onPick: (n: number) =>
              toggleDirectedPick(themPicksSel, setThemPicksSel, theirRosterId, n),
            faab: themFaab?.amount ?? null,
            faabErr: themFaabErr,
            faabFree: theirFaabFree,
            faabLabel: "Their FAAB",
            faabDest: themFaab ? nameOf(themFaab.to) : null,
            onFaab: (raw: string) =>
              setDirectedFaab(
                theirRosterId,
                theirFaabFree,
                "They only have",
                themFaab,
                setThemFaab,
                setThemFaabErr,
                raw,
              ),
            onCycleFaab: () =>
              setThemFaab((f) => (f ? { ...f, to: cycleDest(theirRosterId, f.to) } : f)),
          }
        : {
            title: thirdName,
            players: thirdRoster,
            picks: thirdPicks,
            selectedPlayers: thirdPlayers.map((a) => a.id),
            selectedPicks: thirdPicksSel.map((a) => a.pickNo),
            onPlayer: (id: string) =>
              toggleDirectedPlayer(thirdPlayers, setThirdPlayers, thirdRosterId!, id),
            onPick: (n: number) =>
              toggleDirectedPick(thirdPicksSel, setThirdPicksSel, thirdRosterId!, n),
            faab: thirdFaab?.amount ?? null,
            faabErr: thirdFaabErr,
            faabFree: thirdFaabFree,
            faabLabel: "Their FAAB",
            faabDest: thirdFaab ? nameOf(thirdFaab.to) : null,
            onFaab: (raw: string) =>
              setDirectedFaab(
                thirdRosterId!,
                thirdFaabFree,
                "They only have",
                thirdFaab,
                setThirdFaab,
                setThirdFaabErr,
                raw,
              ),
            onCycleFaab: () =>
              setThirdFaab((f) => (f ? { ...f, to: cycleDest(thirdRosterId!, f.to) } : f)),
          };

  function removeIncomingPlayer(id: string) {
    if (!three) {
      setGetPlayers((l) => l.filter((x) => x !== id));
      return;
    }
    setThemPlayers((l) => l.filter((a) => a.id !== id));
    setThirdPlayers((l) => l.filter((a) => a.id !== id));
  }
  function removeOutgoingPlayer(id: string) {
    if (!three) {
      setSendPlayers((l) => l.filter((x) => x !== id));
      return;
    }
    setMinePlayers((l) => l.filter((a) => a.id !== id));
  }
  function removeIncomingPick(n: number) {
    if (!three) {
      setGetPicks((l) => l.filter((x) => x !== n));
      return;
    }
    setThemPicksSel((l) => l.filter((a) => a.pickNo !== n));
    setThirdPicksSel((l) => l.filter((a) => a.pickNo !== n));
  }
  function removeOutgoingPick(n: number) {
    if (!three) {
      setSendPicks((l) => l.filter((x) => x !== n));
      return;
    }
    setMinePicksSel((l) => l.filter((a) => a.pickNo !== n));
  }
  function removeIncomingFaab() {
    if (!three) {
      setGetFaab(null);
      setGetFaabErr(null);
      return;
    }
    if (themFaab?.to === myRosterId) {
      setThemFaab(null);
      setThemFaabErr(null);
    }
    if (thirdFaab?.to === myRosterId) {
      setThirdFaab(null);
      setThirdFaabErr(null);
    }
  }
  function removeOutgoingFaab() {
    if (!three) {
      setSendFaab(null);
      setSendFaabErr(null);
      return;
    }
    setMineFaab(null);
    setMineFaabErr(null);
  }
  function cycleIncomingPlayer(id: string) {
    const fromThem = themPlayers.some((a) => a.id === id);
    if (fromThem) {
      setThemPlayers((l) =>
        l.map((a) => (a.id === id ? { ...a, to: cycleDest(theirRosterId, a.to) } : a)),
      );
    } else {
      setThirdPlayers((l) =>
        l.map((a) => (a.id === id ? { ...a, to: cycleDest(thirdRosterId!, a.to) } : a)),
      );
    }
  }
  function cycleIncomingPick(n: number) {
    const fromThem = themPicksSel.some((a) => a.pickNo === n);
    if (fromThem) {
      setThemPicksSel((l) =>
        l.map((a) => (a.pickNo === n ? { ...a, to: cycleDest(theirRosterId, a.to) } : a)),
      );
    } else {
      setThirdPicksSel((l) =>
        l.map((a) => (a.pickNo === n ? { ...a, to: cycleDest(thirdRosterId!, a.to) } : a)),
      );
    }
  }
  function cycleIncomingFaab() {
    if (themFaab?.to === myRosterId) {
      setThemFaab((f) => (f ? { ...f, to: cycleDest(theirRosterId, f.to) } : f));
    } else if (thirdFaab?.to === myRosterId) {
      setThirdFaab((f) => (f ? { ...f, to: cycleDest(thirdRosterId!, f.to) } : f));
    }
  }

  const dealCard = (
    <div className="rounded-xl bg-surface px-4 py-3 ring-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <ComposeColumn
          title="You get"
          empty={`Tap someone on ${themName}`}
          players={youGetPlayers}
          picks={youGetPicks}
          faab={youGetFaab}
          projections={projections}
          destName={three ? nameOf : undefined}
          onRemovePlayer={removeIncomingPlayer}
          onRemovePick={removeIncomingPick}
          onRemoveFaab={removeIncomingFaab}
          onCyclePlayer={three ? cycleIncomingPlayer : undefined}
          onCyclePick={three ? cycleIncomingPick : undefined}
          onCycleFaab={three ? cycleIncomingFaab : undefined}
        />
        <ComposeColumn
          title="You give"
          empty="Tap someone on your roster"
          players={youGivePlayers}
          picks={youGivePicks}
          faab={youGiveFaab}
          projections={projections}
          destName={three ? nameOf : undefined}
          onRemovePlayer={removeOutgoingPlayer}
          onRemovePick={removeOutgoingPick}
          onRemoveFaab={removeOutgoingFaab}
          onCyclePlayer={
            three
              ? (id) =>
                  setMinePlayers((l) =>
                    l.map((a) => (a.id === id ? { ...a, to: cycleDest(myRosterId, a.to) } : a)),
                  )
              : undefined
          }
          onCyclePick={
            three
              ? (n) =>
                  setMinePicksSel((l) =>
                    l.map((a) => (a.pickNo === n ? { ...a, to: cycleDest(myRosterId, a.to) } : a)),
                  )
              : undefined
          }
          onCycleFaab={
            three
              ? () => setMineFaab((f) => (f ? { ...f, to: cycleDest(myRosterId, f.to) } : f))
              : undefined
          }
        />
      </div>

      {hasAlso ? (
        <div className="mt-4">
          <p className="microlabel">Also moving</p>
          <ul className="mt-1.5 space-y-1">
            {alsoPlayers.map((p) => (
              <li key={p.player_id}>
                <Removable
                  label={`Remove ${p.full_name}`}
                  onRemove={() => removeIncomingPlayer(p.player_id)}
                  extra={
                    <DestPill
                      label={nameOf(p.to)}
                      onCycle={() => cycleIncomingPlayer(p.player_id)}
                    />
                  }
                >
                  <PlayerStatRow
                    data={{
                      player: p,
                      projection: projections[p.player_id]?.points ?? null,
                      projectionIsAverage: projections[p.player_id]?.reason === "season-avg",
                    }}
                    dense
                  />
                </Removable>
              </li>
            ))}
            {alsoPicks.map((p) => (
              <li key={p.pickNo}>
                <Chip onRemove={() => removeIncomingPick(p.pickNo)}>
                  Pick {p.label}
                  <DestPill label={nameOf(p.to)} onCycle={() => cycleIncomingPick(p.pickNo)} />
                </Chip>
              </li>
            ))}
            {alsoFaab.map((f) => (
              <li key={themFaab === f ? "also-faab-them" : "also-faab-third"}>
                <Chip
                  onRemove={() => {
                    if (themFaab === f) {
                      setThemFaab(null);
                      setThemFaabErr(null);
                    } else {
                      setThirdFaab(null);
                      setThirdFaabErr(null);
                    }
                  }}
                >
                  ${f.amount} FAAB
                  <DestPill
                    label={nameOf(f.to)}
                    onCycle={() => {
                      if (themFaab === f) {
                        setThemFaab((cur) =>
                          cur ? { ...cur, to: cycleDest(theirRosterId, cur.to) } : cur,
                        );
                      } else {
                        setThirdFaab((cur) =>
                          cur ? { ...cur, to: cycleDest(thirdRosterId!, cur.to) } : cur,
                        );
                      }
                    }}
                  />
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasAsset ? (
        <>
          <TradeRosterAfter before={posBefore} after={posAfter} read={read} />
          {faabNet !== 0 ? (
            <p className="mt-2 font-mono text-[11px] text-faint">
              FAAB {faabNet > 0 ? "+" : "−"}${Math.abs(faabNet)}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );

  const giveBits = [
    ...youGivePlayers.map(lastName),
    ...youGivePicks.map((p) => `Pick ${p.label}`),
    ...(youGiveFaab != null && youGiveFaab.amount > 0 ? [`$${youGiveFaab.amount} FAAB`] : []),
  ];
  const getBits = [
    ...youGetPlayers.map(lastName),
    ...youGetPicks.map((p) => `Pick ${p.label}`),
    ...(youGetFaab != null && youGetFaab.amount > 0 ? [`$${youGetFaab.amount} FAAB`] : []),
  ];
  const railLine = !hasAsset
    ? "Tap a player to add."
    : getBits.length && giveBits.length
      ? `${joinBits(giveBits)} for ${joinBits(getBits)}`
      : getBits.length
        ? `Getting ${joinBits(getBits)}`
        : `Sending ${joinBits(giveBits)}`;
  const railDelta =
    hasAsset && delta && delta.change !== 0
      ? ` · ${delta.change > 0 ? "+" : ""}${delta.change.toFixed(1)} starters`
      : "";

  const rail = (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-20 md:bottom-0">
      <div className="pointer-events-auto border-t border-line bg-bg/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <p className="min-w-0 truncate text-sm text-muted">
            <span className="text-fg">{railLine}</span>
            {railDelta}
            {three ? <span className="hidden sm:inline"> · All three must accept.</span> : null}
          </p>
          <Button
            type="button"
            disabled={!hasAsset || faabBlocked || send.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            Propose trade
          </Button>
        </div>
      </div>
    </div>
  );

  const confirm = (
    <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-lift)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4">
            <div className="min-w-0">
              <Dialog.Title asChild>
                <span className="block font-display text-base font-bold tracking-[-0.02em]">
                  Send this to {themName}?
                </span>
              </Dialog.Title>
              <Dialog.Description asChild>
                <span className="mt-0.5 block text-sm text-muted">
                  {three
                    ? "All three teams have to accept. Nothing moves if one declines."
                    : "They have to accept before anything moves."}
                </span>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                Esc
              </Button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ComposeColumn
                title="You get"
                empty="Nothing coming in"
                players={youGetPlayers}
                picks={youGetPicks}
                faab={youGetFaab}
                projections={projections}
                destName={three ? nameOf : undefined}
                readOnly
              />
              <ComposeColumn
                title="You give"
                empty="Nothing going out"
                players={youGivePlayers}
                picks={youGivePicks}
                faab={youGiveFaab}
                projections={projections}
                destName={three ? nameOf : undefined}
                readOnly
              />
            </div>
            {hasAlso ? (
              <p className="mt-3 text-xs text-muted">
                Also moving:{" "}
                {[
                  ...alsoPlayers.map((p) => `${lastName(p)} → ${nameOf(p.to)}`),
                  ...alsoPicks.map((p) => `Pick ${p.label} → ${nameOf(p.to)}`),
                  ...alsoFaab.map((f) => `$${f.amount} FAAB → ${nameOf(f.to)}`),
                ].join(" · ")}
              </p>
            ) : null}
            {hasAsset ? (
              <>
                <TradeRosterAfter before={posBefore} after={posAfter} read={read} />
                {faabNet !== 0 ? (
                  <p className="mt-2 font-mono text-[11px] text-faint">
                    FAAB {faabNet > 0 ? "+" : "−"}${Math.abs(faabNet)}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 pt-4 pb-5">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!hasAsset || faabBlocked || send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? "Sending…" : "Propose trade"}
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  if (!three) {
    return (
      <div className="mt-5 space-y-5">
        {countering ? <p className="text-xs text-muted">Countering an existing offer.</p> : null}

        {dealCard}

        <div className="grid gap-6 sm:grid-cols-2">
          <RosterPanel
            title="Your roster"
            players={myRoster}
            picks={myPicks}
            selectedPlayers={sendPlayers}
            selectedPicks={sendPicks}
            projections={projections}
            onPlayer={(id) => toggleTwoPlayer("send", id)}
            onPick={(n) => toggleTwoPick("send", n)}
            faab={sendFaab}
            faabErr={sendFaabErr}
            faabFree={myFaabFree}
            faabLabel="Your unstaked"
            onFaab={(raw) => setTwoFaab("send", raw)}
          />
          <RosterPanel
            title={themName}
            players={theirRoster}
            picks={theirPicks}
            selectedPlayers={getPlayers}
            selectedPicks={getPicks}
            projections={projections}
            onPlayer={(id) => toggleTwoPlayer("get", id)}
            onPick={(n) => toggleTwoPick("get", n)}
            faab={getFaab}
            faabErr={getFaabErr}
            faabFree={theirFaabFree}
            faabLabel="Their FAAB"
            onFaab={(raw) => setTwoFaab("get", raw)}
          />
        </div>
        {rail}
        {confirm}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      {countering ? <p className="text-xs text-muted">Countering an existing offer.</p> : null}

      {dealCard}

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: "mine" as const, label: "You" },
              { id: "them" as const, label: themName },
              { id: "third" as const, label: thirdName },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setRosterTab(t.id)}
              className={cn(
                "h-9 rounded-sm px-3 text-sm",
                rosterTab === t.id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {t.label}
            </button>
          ))}
          {onThirdChange && availableThirds.length > 0 ? (
            <div className="relative ml-1">
              <label className="sr-only" htmlFor="third-team-pick">
                Third team
              </label>
              <select
                id="third-team-pick"
                className="h-9 max-w-[9rem] rounded-sm bg-raised px-2 text-sm text-muted"
                value={thirdRosterId ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) onThirdChange(v);
                }}
              >
                {availableThirds.map((p) => (
                  <option key={p.rosterId} value={p.rosterId}>
                    {p.teamName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {onThirdChange ? (
            <button
              type="button"
              className="ml-1 microlabel text-muted hover:text-fg"
              onClick={() => onThirdChange(null)}
            >
              Remove
            </button>
          ) : null}
        </div>
        <div className="mt-2">
          <RosterPanel
            title={activeRoster.title}
            players={activeRoster.players}
            picks={activeRoster.picks}
            selectedPlayers={activeRoster.selectedPlayers}
            selectedPicks={activeRoster.selectedPicks}
            projections={projections}
            onPlayer={activeRoster.onPlayer}
            onPick={activeRoster.onPick}
            faab={activeRoster.faab}
            faabErr={activeRoster.faabErr}
            faabFree={activeRoster.faabFree}
            faabLabel={activeRoster.faabLabel}
            faabDest={activeRoster.faabDest}
            onFaab={activeRoster.onFaab}
            onCycleFaab={activeRoster.onCycleFaab}
          />
        </div>
      </div>
      {rail}
      {confirm}
    </div>
  );
}

function RosterPanel({
  title,
  players,
  picks,
  selectedPlayers,
  selectedPicks,
  projections,
  onPlayer,
  onPick,
  faab = null,
  faabErr = null,
  faabFree = null,
  faabLabel,
  faabDest,
  onFaab,
  onCycleFaab,
}: {
  title: string;
  players: RosterPlayer[];
  picks: TradeComposerPick[];
  selectedPlayers: string[];
  selectedPicks: number[];
  projections: Record<string, Projection>;
  onPlayer: (id: string) => void;
  onPick: (n: number) => void;
  faab?: number | null;
  faabErr?: string | null;
  faabFree?: number | null;
  faabLabel?: string;
  faabDest?: string | null;
  onFaab?: (raw: string) => void;
  onCycleFaab?: () => void;
}) {
  const count = players.length + picks.length;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
        <p className="text-sm font-medium">{title}</p>
        {count > 0 ? (
          <p className="microlabel-data">
            {count} {count === 1 ? "asset" : "assets"}
          </p>
        ) : null}
      </div>
      {/* Height is deliberately off a whole number of rows: the list has to cut
          one in half, or the sixth player looks like the last player. */}
      <ScrollShade className="mt-2 max-h-[21rem] pr-1" data-testid="roster-picker">
        <ul className="space-y-1">
          {players.map((p) => {
            const proj = projections[p.player_id];
            const data: PlayerStatRowData = {
              player: p,
              projection: proj?.points ?? null,
              projectionIsAverage: proj?.reason === "season-avg",
            };
            return (
              <li key={p.player_id}>
                <PlayerStatRow
                  data={data}
                  dense
                  selected={selectedPlayers.includes(p.player_id)}
                  onSelect={() => onPlayer(p.player_id)}
                />
              </li>
            );
          })}
          {picks.map((p) => (
            <li key={p.pickNo}>
              <button
                type="button"
                onClick={() => onPick(p.pickNo)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
                  selectedPicks.includes(p.pickNo) ? "bg-accent text-accent-fg" : "hover:bg-raised",
                )}
              >
                <span>Pick {p.label}</span>
                {p.via ? (
                  <span className="font-mono text-[11px] opacity-70">via {p.via}</span>
                ) : null}
              </button>
            </li>
          ))}
          {!players.length && !picks.length ? (
            <li className="px-2 py-2 text-xs text-faint">
              No assets yet. Unused picks appear after the board is built.
            </li>
          ) : null}
        </ul>
      </ScrollShade>
      {onFaab ? (
        <FaabPicker
          title={title}
          faab={faab}
          faabErr={faabErr}
          faabFree={faabFree}
          faabLabel={faabLabel}
          faabDest={faabDest}
          onFaab={onFaab}
          onCycleFaab={onCycleFaab}
        />
      ) : null}
    </div>
  );
}

function ComposeColumn({
  title,
  empty,
  players,
  picks,
  faab,
  projections,
  destName,
  readOnly = false,
  onRemovePlayer,
  onRemovePick,
  onRemoveFaab,
  onCyclePlayer,
  onCyclePick,
  onCycleFaab,
}: {
  title: string;
  empty: string;
  players: Array<RosterPlayer & { to?: number }>;
  picks: Array<TradeComposerPick & { to?: number }>;
  faab: { amount: number; to?: number } | null;
  projections: Record<string, Projection>;
  destName?: (id: number) => string;
  readOnly?: boolean;
  onRemovePlayer?: (id: string) => void;
  onRemovePick?: (n: number) => void;
  onRemoveFaab?: () => void;
  onCyclePlayer?: (id: string) => void;
  onCyclePick?: (n: number) => void;
  onCycleFaab?: () => void;
}) {
  const has = players.length > 0 || picks.length > 0 || (faab != null && faab.amount > 0);
  return (
    <div className="min-w-0">
      <p className="microlabel">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {!has ? (
          <li className="px-2 py-1.5 text-xs text-faint">{empty}</li>
        ) : (
          <>
            {players.map((p) => {
              const proj = projections[p.player_id];
              const row = (
                <PlayerStatRow
                  data={{
                    player: p,
                    projection: proj?.points ?? null,
                    projectionIsAverage: proj?.reason === "season-avg",
                  }}
                  dense
                />
              );
              const dest =
                destName && p.to != null ? (
                  onCyclePlayer && !readOnly ? (
                    <DestPill label={destName(p.to)} onCycle={() => onCyclePlayer(p.player_id)} />
                  ) : (
                    <span className="font-mono text-[10px] text-faint">→ {destName(p.to)}</span>
                  )
                ) : null;
              return (
                <li key={p.player_id}>
                  {readOnly || !onRemovePlayer ? (
                    <div className="flex items-center gap-0.5">
                      <div className="min-w-0 flex-1">{row}</div>
                      {dest}
                    </div>
                  ) : (
                    <Removable
                      label={`Remove ${p.full_name}`}
                      onRemove={() => onRemovePlayer(p.player_id)}
                      extra={dest}
                    >
                      {row}
                    </Removable>
                  )}
                </li>
              );
            })}
            {picks.map((p) => (
              <li key={p.pickNo}>
                {readOnly || !onRemovePick ? (
                  <span className="inline-flex min-h-9 items-center gap-1.5 rounded-sm bg-raised px-2 py-1 font-mono text-xs text-fg">
                    Pick {p.label}
                    {destName && p.to != null ? (
                      <span className="text-faint">→ {destName(p.to)}</span>
                    ) : null}
                  </span>
                ) : (
                  <Chip onRemove={() => onRemovePick(p.pickNo)}>
                    Pick {p.label}
                    {destName && p.to != null && onCyclePick ? (
                      <DestPill label={destName(p.to)} onCycle={() => onCyclePick(p.pickNo)} />
                    ) : null}
                  </Chip>
                )}
              </li>
            ))}
            {faab != null && faab.amount > 0 ? (
              <li>
                {readOnly || !onRemoveFaab ? (
                  <span className="inline-flex min-h-9 items-center gap-1.5 rounded-sm bg-raised px-2 py-1 font-mono text-xs text-fg">
                    ${faab.amount} FAAB
                    {destName && faab.to != null ? (
                      <span className="text-faint">→ {destName(faab.to)}</span>
                    ) : null}
                  </span>
                ) : (
                  <Chip onRemove={onRemoveFaab}>
                    ${faab.amount} FAAB
                    {destName && faab.to != null && onCycleFaab ? (
                      <DestPill label={destName(faab.to)} onCycle={onCycleFaab} />
                    ) : null}
                  </Chip>
                )}
              </li>
            ) : null}
          </>
        )}
      </ul>
    </div>
  );
}

function Removable({
  children,
  onRemove,
  label,
  extra,
}: {
  children: ReactNode;
  onRemove: () => void;
  label: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <div className="min-w-0 flex-1">{children}</div>
      {extra}
      <button
        type="button"
        aria-label={label}
        onClick={onRemove}
        className="shrink-0 rounded-pill p-1 text-faint hover:bg-raised hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function FaabPicker({
  title,
  faab,
  faabErr,
  faabFree,
  faabLabel,
  faabDest,
  onFaab,
  onCycleFaab,
}: {
  title: string;
  faab: number | null;
  faabErr: string | null;
  faabFree: number | null;
  faabLabel?: string;
  faabDest?: string | null;
  onFaab: (raw: string) => void;
  onCycleFaab?: () => void;
}) {
  if (faab == null) {
    return (
      <button
        type="button"
        className="mt-2 microlabel text-muted hover:text-fg"
        onClick={() => onFaab("0")}
      >
        + FAAB
      </button>
    );
  }
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-faint">FAAB</span>
        <div
          className={cn(
            "flex items-baseline rounded-md bg-surface px-2.5 py-1 ring-card focus-within:shadow-[0_0_0_1px_var(--color-accent-deep)]",
            faabErr && "shadow-[0_0_0_1px_var(--color-loss)]",
          )}
        >
          <span className="font-mono text-sm font-bold text-faint">$</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            aria-label={`${title} FAAB`}
            value={String(faab)}
            onChange={(e) => onFaab(e.target.value)}
            className={cn(
              "w-[3.4ch] bg-transparent font-mono text-base font-bold tabular-nums outline-none placeholder:text-faint/60",
              faabErr && "text-loss",
            )}
          />
        </div>
        {faabDest && onCycleFaab && faab > 0 ? (
          <DestPill label={faabDest} onCycle={onCycleFaab} />
        ) : null}
        {faabFree != null ? (
          <span className="font-mono text-[11px] text-faint">
            {faabLabel} ${faabFree}
          </span>
        ) : null}
      </div>
      {faabErr ? <p className="mt-1 text-xs text-loss">{faabErr}</p> : null}
    </div>
  );
}

function DestPill({ label, onCycle }: { label: string; onCycle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCycle();
      }}
      className="rounded-pill bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent-fg hover:bg-accent/25"
      title="Change destination"
    >
      → {label}
    </button>
  );
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-sm bg-raised px-2 py-1 font-mono text-xs text-fg">
      {children}
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="rounded-pill p-0.5 text-faint hover:bg-raised hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function countPositions(players: Array<{ position: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    const pos = p.position?.trim() || "?";
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return counts;
}
