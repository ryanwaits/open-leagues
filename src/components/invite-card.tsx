import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function usePageOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

export function joinUrl(origin: string, code: string) {
  const path = `/join?code=${encodeURIComponent(code.trim())}`;
  const host = origin.replace(/\/$/, "");
  return host ? `${host}${path}` : path;
}

export function InviteCard({ code, origin }: { code: string; origin: string }) {
  const url = joinUrl(origin, code);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied.");
    } catch {
      toast("Could not copy.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Join my league", url, text: code });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast("Could not share.");
    }
  }

  return (
    <div className="mt-4 max-w-md rounded-xl bg-surface px-4 py-4 ring-card">
      <p className="microlabel">Invite</p>
      <p className="mt-1 font-mono text-lg tracking-[0.18em]">{code}</p>
      <a href={url} className="mt-1 block break-all font-mono text-[11px] text-muted hover:text-fg">
        {url}
      </a>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
          Copy
        </Button>
        {canShare ? (
          <Button type="button" size="sm" variant="muted" onClick={() => void share()}>
            Share
          </Button>
        ) : null}
      </div>
    </div>
  );
}
