import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { findSleeperUser } from "@/lib/data/fns";

/**
 * The one input on the landing. A Sleeper league id goes straight to its
 * receipts; a username lists that person's leagues, because most managers do
 * not know their league id and should not have to.
 */
type Found = Awaited<ReturnType<typeof findSleeperUser>>;

export function ReceiptFinder() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    setError(null);
    if (/^\d{8,}$/.test(q)) {
      await navigate({ to: "/r/$leagueId", params: { leagueId: q } });
      return;
    }
    setBusy(true);
    try {
      const res = await findSleeperUser({ data: { query: q } });
      if (!res || res.leagues.length === 0) {
        setFound(null);
        setError(`No Sleeper leagues found for "${q}".`);
      } else {
        setFound(res);
      }
    } catch {
      setError("Sleeper didn't answer. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[520px]">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="receipt-q" className="sr-only">
          Sleeper league id or username
        </label>
        <input
          id="receipt-q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Sleeper league id or username"
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3.5 font-mono text-[13.5px] text-fg placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center rounded-md bg-fg px-4 text-[14px] font-medium text-bg disabled:opacity-60"
        >
          {busy ? "Looking…" : "Receipts"}
        </button>
      </form>
      {error ? <p className="mt-2 text-[13px] text-muted">{error}</p> : null}
      {found ? (
        <ul className="mt-3 divide-y divide-line rounded-md border border-line-strong bg-surface">
          {found.leagues.map((l) => (
            <li key={l.league_id}>
              <Link
                to="/r/$leagueId"
                params={{ leagueId: l.league_id }}
                className="flex items-baseline justify-between gap-3 px-3.5 py-2.5 text-[14px] hover:bg-band"
              >
                <span className="min-w-0 truncate">{l.name}</span>
                <span className="font-mono text-[11px] text-faint">
                  {l.season} · {l.total_rosters} teams
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
