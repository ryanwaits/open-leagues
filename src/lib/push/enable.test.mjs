import { test } from "bun:test";
import assert from "node:assert/strict";
import { enablePushForLeague } from "./enable.ts";

const KEY = "BBBB";

function jsonSub() {
  return {
    toJSON: () => ({
      endpoint: "https://push.example/abc",
      keys: { p256dh: "p", auth: "a" },
    }),
  };
}

function host(overrides = {}) {
  let perm = overrides.perm ?? "default";
  const saved = [];
  const subscribeCalls = { n: 0 };
  const h = {
    sandbox: false,
    canPush: true,
    permission: () => perm,
    requestPermission: async () => {
      perm = "granted";
      return "granted";
    },
    register: async () => ({
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => {
          subscribeCalls.n++;
          return jsonSub();
        },
      },
    }),
    ready: async () => ({
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => {
          subscribeCalls.n++;
          return jsonSub();
        },
      },
    }),
    delay: async () => {},
    save: async (sub) => {
      saved.push(sub);
      return true;
    },
    ...overrides,
    setPerm(next) {
      perm = next;
    },
    saved,
    subscribeCalls,
  };
  if (!overrides.permission) h.permission = () => perm;
  return h;
}

test("one Allow tap saves the subscription", async () => {
  const h = host();
  const ok = await enablePushForLeague("lg1", KEY, h);
  assert.equal(ok, true);
  assert.equal(h.saved.length, 1);
  assert.equal(h.saved[0].leagueId, "lg1");
});

test("retries subscribe after the first AbortError", async () => {
  const h = host();
  let n = 0;
  const pm = {
    getSubscription: async () => null,
    subscribe: async () => {
      n++;
      if (n === 1) throw new Error("AbortError");
      return jsonSub();
    },
  };
  h.ready = async () => ({ pushManager: pm });
  const ok = await enablePushForLeague("lg1", KEY, h);
  assert.equal(ok, true);
  assert.equal(n, 2);
  assert.equal(h.saved.length, 1);
});

test("iOS Allow that resolves default still turns on after permission settles", async () => {
  const h = host();
  h.requestPermission = async () => "default";
  let waits = 0;
  h.delay = async () => {
    waits++;
    if (waits >= 1) h.setPerm("granted");
  };
  const ok = await enablePushForLeague("lg1", KEY, h);
  assert.equal(ok, true);
  assert.equal(h.saved.length, 1);
});

test("denied permission does not subscribe", async () => {
  const h = host();
  h.requestPermission = async () => {
    h.setPerm("denied");
    return "denied";
  };
  const ok = await enablePushForLeague("lg1", KEY, h);
  assert.equal(ok, false);
  assert.equal(h.saved.length, 0);
});

test("already granted skips the prompt", async () => {
  let prompted = 0;
  const h = host({ perm: "granted" });
  h.requestPermission = async () => {
    prompted++;
    return "granted";
  };
  const ok = await enablePushForLeague("lg1", KEY, h);
  assert.equal(ok, true);
  assert.equal(prompted, 0);
});

test("kicks off register before waiting on permission", async () => {
  const order = [];
  const h = host();
  h.register = async () => {
    order.push("register");
    return {
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => jsonSub(),
      },
    };
  };
  h.requestPermission = async () => {
    order.push("prompt");
    h.setPerm("granted");
    return "granted";
  };
  h.ready = async () => {
    order.push("ready");
    return {
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => jsonSub(),
      },
    };
  };
  await enablePushForLeague("lg1", KEY, h);
  assert.deepEqual(order, ["register", "prompt", "ready"]);
});
