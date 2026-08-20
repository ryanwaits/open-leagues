import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { proposeTrade } from "@/lib/league/fns";
import { cn } from "@/lib/utils";

type Seat = { rosterId: number; teamName: string };

type BoardPick = {
  pickNo: number;
  round: number;
  label: string;
  rosterId: number;
  player: { playerId: string; name: string; position: string | null } | null;
};

type StockPick = {
  pickNo: number;
  label: string;
  rosterId: number;
  used: boolean;
};

type DraftAsset = {
  id: string;
  kind: "player" | "pick" | "faab";
  playerId?: string;
  playerName?: string;
  playerPos?: string | null;
  pickNo?: number;
  pickLabel?: string;
  amount?: number;
};

type AddKind = "pick" | "player" | "faab" | null;

/**
 * Mid-draft trade sheet. Picks, drafted players, and FAAB — same backend as the
 * season desk, opened from the room so you don't leave the board.
 */
export function DraftTradeDrawer({
  open,
  onOpenChange,
  leagueId,
  myRosterId,
  seats,
  board,
  stock,
  onClockPickNo,
  faabRemaining,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  myRosterId: number;
  seats: Seat[];
  board: BoardPick[];
  stock: StockPick[];
  onClockPickNo: number;
  faabRemaining: number;
}) {
  const qc = useQueryClient();
  const [them, setThem] = useState<number | null>(null);
  const [send, setSend] = useState<DraftAsset[]>([]);
  const [get, setGet] = useState<DraftAsset[]>([]);
  const [addingFor, setAddingFor] = useState<"send" | "get" | null>(null);
  const [addKind, setAddKind] = useState<AddKind>(null);
  const [faabDraft, setFaabDraft] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const counterparties = useMemo(
    () => seats.filter((s) => s.rosterId !== myRosterId),
    [seats, myRosterId],
  );

  useEffect(() => {
    if (!open) return;
    setThem(null);
    setSend([]);
    setGet([]);
    setAddingFor(null);
    setAddKind(null);
    setFaabDraft(null);
    setFailure(null);
  }, [open]);

  const themSeat = counterparties.find((s) => s.rosterId === them) ?? null;
  const mySeat = seats.find((s) => s.rosterId === myRosterId) ?? null;

  const submit = useMutation({
    mutationFn: async () => {
      if (them == null) throw new Error("Pick who you're trading with.");
      if (send.length + get.length < 1) throw new Error("Add something to the trade.");
      const assets = [
        ...send.map((a) => ({
          fromRoster: myRosterId,
          toRoster: them,
          kind: a.kind,
          playerId: a.playerId ?? null,
          pickNo: a.pickNo ?? null,
          amount: a.amount ?? null,
        })),
        ...get.map((a) => ({
          fromRoster: them,
          toRoster: myRosterId,
          kind: a.kind,
          playerId: a.playerId ?? null,
          pickNo: a.pickNo ?? null,
          amount: a.amount ?? null,
        })),
      ];
      return proposeTrade({ data: { leagueId, assets } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["draft", leagueId] });
      void qc.invalidateQueries({ queryKey: ["trades", leagueId] });
      onOpenChange(false);
    },
    onError: (e) => setFailure(e instanceof Error ? e.message : "That did not go through."),
  });

  function unusedPicks(rosterId: number) {
    return stock.filter((p) => p.rosterId === rosterId && !p.used && p.pickNo !== onClockPickNo);
  }

  function draftedPlayers(rosterId: number) {
    const seen = new Set<string>();
    const out: { playerId: string; name: string; position: string | null }[] = [];
    for (const p of board) {
      if (p.rosterId !== rosterId || !p.player) continue;
      if (seen.has(p.player.playerId)) continue;
      seen.add(p.player.playerId);
      out.push(p.player);
    }
    return out;
  }

  function alreadyListed(side: DraftAsset[], kind: DraftAsset["kind"], key: string | number) {
    return side.some((a) => {
      if (a.kind !== kind) return false;
      if (kind === "pick") return a.pickNo === key;
      if (kind === "player") return a.playerId === key;
      return false;
    });
  }

  function pushAsset(side: "send" | "get", asset: Omit<DraftAsset, "id">) {
    const setter = side === "send" ? setSend : setGet;
    setter((prev) => [...prev, { ...asset, id: `${asset.kind}-${Date.now()}-${prev.length}` }]);
    setAddKind(null);
    setAddingFor(null);
    setFaabDraft(null);
    setFailure(null);
  }

  function removeAsset(side: "send" | "get", id: string) {
    const setter = side === "send" ? setSend : setGet;
    setter((prev) => prev.filter((a) => a.id !== id));
  }

  const pickingRoster =
    addingFor === "send" ? myRosterId : addingFor === "get" && them != null ? them : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[28rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-lift)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4">
            <div className="min-w-0">
              <Dialog.Title asChild>
                <span className="block font-display text-base font-bold tracking-[-0.02em]">
                  Propose a trade
                </span>
              </Dialog.Title>
              <Dialog.Description asChild>
                <span className="mt-0.5 block text-sm text-muted">
                  Picks, drafted players, or FAAB. The pick on the clock stays put.
                </span>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                Esc
              </Button>
            </Dialog.Close>
          </header>

          {failure ? (
            <p className="flex gap-2 border-b border-line bg-loss/10 px-5 py-3 text-sm text-loss">
              <span aria-hidden>⚠</span>
              <span>{failure}</span>
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-line px-5 py-4">
              <span className="microlabel-data">With</span>
              <div className="mt-2 flex flex-col gap-0.5">
                {counterparties.map((s) => {
                  const on = them === s.rosterId;
                  return (
                    <button
                      key={s.rosterId}
                      type="button"
                      onClick={() => {
                        setThem(s.rosterId);
                        setGet([]);
                        setAddingFor(null);
                        setAddKind(null);
                      }}
                      className={cn(
                        "rounded-md border px-2.5 py-2 text-left text-sm font-medium transition-colors duration-150",
                        on ? "border-accent-deep bg-raised" : "border-transparent hover:bg-raised",
                      )}
                    >
                      {s.teamName}
                    </button>
                  );
                })}
              </div>
            </section>

            {them != null ? (
              <>
                <AssetColumn
                  title="You send"
                  subtitle={mySeat?.teamName ?? "You"}
                  assets={send}
                  onRemove={(id) => removeAsset("send", id)}
                  onAdd={(kind) => {
                    setAddingFor("send");
                    setAddKind(kind);
                    setFaabDraft(null);
                  }}
                />
                <AssetColumn
                  title="You get"
                  subtitle={themSeat?.teamName ?? "Them"}
                  assets={get}
                  onRemove={(id) => removeAsset("get", id)}
                  onAdd={(kind) => {
                    setAddingFor("get");
                    setAddKind(kind);
                    setFaabDraft(null);
                  }}
                />
              </>
            ) : null}

            {pickingRoster != null && addKind === "pick" ? (
              <section className="border-b border-line px-5 py-4">
                <span className="microlabel-data">Add a pick</span>
                <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
                  {unusedPicks(pickingRoster).map((p) => {
                    const side = addingFor === "send" ? send : get;
                    const taken = alreadyListed(side, "pick", p.pickNo);
                    return (
                      <li key={p.pickNo}>
                        <button
                          type="button"
                          disabled={taken || addingFor == null}
                          onClick={() => {
                            if (addingFor == null) return;
                            pushAsset(addingFor, {
                              kind: "pick",
                              pickNo: p.pickNo,
                              pickLabel: p.label,
                            });
                          }}
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-raised disabled:opacity-40"
                        >
                          <span className="font-mono text-xs">{p.label}</span>
                          {taken ? <span className="text-xs text-faint">Added</span> : null}
                        </button>
                      </li>
                    );
                  })}
                  {unusedPicks(pickingRoster).length === 0 ? (
                    <li className="px-2.5 py-2 text-xs text-faint">
                      No unused picks left to trade.
                    </li>
                  ) : null}
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setAddKind(null);
                    setAddingFor(null);
                  }}
                >
                  Cancel
                </Button>
              </section>
            ) : null}

            {pickingRoster != null && addKind === "player" ? (
              <section className="border-b border-line px-5 py-4">
                <span className="microlabel-data">Add a player</span>
                <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
                  {draftedPlayers(pickingRoster).map((p) => {
                    const side = addingFor === "send" ? send : get;
                    const taken = alreadyListed(side, "player", p.playerId);
                    return (
                      <li key={p.playerId}>
                        <button
                          type="button"
                          disabled={taken || addingFor == null}
                          onClick={() => {
                            if (addingFor == null) return;
                            pushAsset(addingFor, {
                              kind: "player",
                              playerId: p.playerId,
                              playerName: p.name,
                              playerPos: p.position,
                            });
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-raised disabled:opacity-40"
                        >
                          <span className="min-w-0 truncate font-medium">{p.name}</span>
                          <span className="shrink-0 microlabel-data">{p.position ?? ""}</span>
                        </button>
                      </li>
                    );
                  })}
                  {draftedPlayers(pickingRoster).length === 0 ? (
                    <li className="px-2.5 py-2 text-xs text-faint">
                      No drafted players on that roster yet.
                    </li>
                  ) : null}
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setAddKind(null);
                    setAddingFor(null);
                  }}
                >
                  Cancel
                </Button>
              </section>
            ) : null}

            {pickingRoster != null && addKind === "faab" ? (
              <section className="border-b border-line px-5 py-4">
                <span className="microlabel-data">FAAB amount</span>
                <div className="mt-2.5 flex items-center gap-3">
                  <StepButton
                    label="Lower amount"
                    disabled={!faabDraft}
                    onClick={() => setFaabDraft(Math.max(1, (faabDraft ?? 1) - 1))}
                  >
                    −
                  </StepButton>
                  <div className="flex items-baseline rounded-md bg-raised px-3.5 py-1.5 ring-card focus-within:shadow-[0_0_0_1px_var(--color-accent-deep)]">
                    <span className="font-mono text-xl font-bold text-faint">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      aria-label="FAAB dollars"
                      value={faabDraft == null ? "" : String(faabDraft)}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                        setFaabDraft(digits === "" ? null : Number(digits));
                      }}
                      className="w-[3.4ch] bg-transparent font-mono text-2xl font-bold tabular-nums tracking-[-0.03em] outline-none placeholder:text-faint/60"
                    />
                  </div>
                  <StepButton
                    label="Raise amount"
                    onClick={() => setFaabDraft((faabDraft ?? 0) + 1)}
                  >
                    +
                  </StepButton>
                </div>
                {addingFor === "send" ? (
                  <p className="mt-2 text-xs text-faint">You have ${faabRemaining} spendable.</p>
                ) : (
                  <p className="mt-2 text-xs text-faint">Server checks their balance on submit.</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    disabled={!faabDraft || faabDraft <= 0 || addingFor == null}
                    onClick={() => {
                      if (addingFor == null) return;
                      pushAsset(addingFor, { kind: "faab", amount: faabDraft ?? 0 });
                    }}
                  >
                    Add ${faabDraft ?? 0}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddKind(null);
                      setAddingFor(null);
                      setFaabDraft(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </section>
            ) : null}
          </div>

          <footer className="px-5 pt-4 pb-5">
            <Button
              className="w-full"
              disabled={them == null || submit.isPending || send.length + get.length < 1}
              onClick={() => {
                setFailure(null);
                submit.mutate();
              }}
            >
              {submit.isPending ? "Sending…" : "Send offer"}
            </Button>
            <p className="mt-2 text-center text-xs text-faint">
              They still have to accept on the trade desk.
            </p>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AssetColumn({
  title,
  subtitle,
  assets,
  onRemove,
  onAdd,
}: {
  title: string;
  subtitle: string;
  assets: DraftAsset[];
  onRemove: (id: string) => void;
  onAdd: (kind: "pick" | "player" | "faab") => void;
}) {
  return (
    <section className="border-b border-line px-5 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="microlabel-data">{title}</span>
        <span className="truncate text-xs text-muted">{subtitle}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {assets.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-md bg-raised px-2.5 py-2 text-sm"
          >
            <span className="min-w-0 truncate">
              {a.kind === "pick"
                ? a.pickLabel
                : a.kind === "player"
                  ? a.playerName
                  : `$${a.amount} FAAB`}
              {a.kind === "player" && a.playerPos ? (
                <span className="ml-1.5 microlabel-data">{a.playerPos}</span>
              ) : null}
            </span>
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onRemove(a.id)}
              className="shrink-0 font-mono text-xs text-faint hover:text-fg"
            >
              ×
            </button>
          </li>
        ))}
        {assets.length === 0 ? (
          <li className="px-1 py-1 text-xs text-faint">Nothing yet.</li>
        ) : null}
      </ul>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => onAdd("pick")}>
          + Pick
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onAdd("player")}>
          + Player
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onAdd("faab")}>
          + FAAB
        </Button>
      </div>
    </section>
  );
}

function StepButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-pill text-lg font-bold ring-card transition-colors duration-150 hover:bg-raised disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
