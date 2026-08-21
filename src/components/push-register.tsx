import { useEffect } from "react";
import { enablePushForLeague as enablePush } from "@/lib/push/enable";
import { pushPublicKey, unsubscribePush } from "@/lib/push/fns";

function onSandbox(): boolean {
  if (typeof window === "undefined") return true;
  return window.location.hostname.endsWith(".grok-sandbox.com");
}

/** Re-attach the worker after a prior opt-in. Does not prompt. */
export function PushRegister() {
  useEffect(() => {
    if (onSandbox()) return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    void (async () => {
      const vapid = await pushPublicKey();
      if (!vapid.configured || !vapid.publicKey) return;
      if (Notification.permission !== "granted") return;
      const existing = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!existing) return;
      await navigator.serviceWorker.register("/sw.js");
    })();
  }, []);
  return null;
}

export async function enablePushForLeague(leagueId: string, publicKey: string): Promise<boolean> {
  return enablePush(leagueId, publicKey);
}

export async function disablePushForLeague(leagueId: string): Promise<void> {
  await unsubscribePush({ data: { leagueId } });
}
