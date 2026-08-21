import { subscribePush } from "@/lib/push/fns";

export type PushSubJson = {
  toJSON: () => { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
};

export type PushReg = {
  pushManager: {
    getSubscription: () => Promise<PushSubJson | null>;
    subscribe: (opts: {
      userVisibleOnly: boolean;
      applicationServerKey: BufferSource;
    }) => Promise<PushSubJson>;
  };
};

export type PushHost = {
  sandbox: boolean;
  canPush: boolean;
  permission: () => NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  register: () => Promise<PushReg | null>;
  ready: () => Promise<PushReg>;
  delay: (ms: number) => Promise<void>;
  save: (sub: {
    leagueId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }) => Promise<boolean>;
};

export function vapidBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function onSandbox(): boolean {
  if (typeof window === "undefined") return true;
  return window.location.hostname.endsWith(".grok-sandbox.com");
}

export function livePushHost(): PushHost {
  return {
    sandbox: onSandbox(),
    canPush:
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      "PushManager" in window,
    permission: () => Notification.permission,
    requestPermission: () => Notification.requestPermission(),
    register: () => navigator.serviceWorker.register("/sw.js"),
    ready: () => navigator.serviceWorker.ready,
    delay: (ms) => new Promise((r) => setTimeout(r, ms)),
    save: async (data) => {
      const res = await subscribePush({ data });
      return res.ok;
    },
  };
}

/** iOS: Allow can resolve as "default"; subscribe can AbortError before the worker is active. */
export async function enablePushForLeague(
  leagueId: string,
  publicKey: string,
  host: PushHost = livePushHost(),
): Promise<boolean> {
  if (host.sandbox || !host.canPush) return false;

  // Start the worker in this tap, but don't await it before the prompt —
  // iOS needs the user-gesture for requestPermission.
  const registering = host.register();

  if (!(await waitUntilGranted(host))) return false;

  let started: PushReg | null;
  try {
    started = await registering;
  } catch {
    return false;
  }
  if (!started) return false;
  const reg = await host.ready();
  const sub = await subscribeWhenReady(reg, publicKey, host.delay);
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;
  return host.save({ leagueId, endpoint, p256dh, auth });
}

async function waitUntilGranted(host: PushHost): Promise<boolean> {
  if (host.permission() === "granted") return true;
  if (host.permission() === "denied") return false;
  const result = await host.requestPermission();
  if (result === "granted" || host.permission() === "granted") return true;
  if (result === "denied" || host.permission() === "denied") return false;
  for (const ms of [50, 150, 400]) {
    await host.delay(ms);
    if (host.permission() === "granted") return true;
    if (host.permission() === "denied") return false;
  }
  return host.permission() === "granted";
}

async function subscribeWhenReady(
  reg: PushReg,
  publicKey: string,
  delay: (ms: number) => Promise<void>,
): Promise<PushSubJson> {
  let existing: PushSubJson | null = null;
  try {
    existing = await reg.pushManager.getSubscription();
  } catch {
    existing = null;
  }
  if (existing) return existing;
  const opts = {
    userVisibleOnly: true,
    applicationServerKey: vapidBytes(publicKey) as BufferSource,
  };
  try {
    return await reg.pushManager.subscribe(opts);
  } catch {
    await delay(200);
    return await reg.pushManager.subscribe(opts);
  }
}
