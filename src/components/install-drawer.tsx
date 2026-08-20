import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import {
  A2HS_DISMISS_KEY,
  A2HS_JOIN_KEY,
  checkAndRecordVisit,
  iosSafari,
  standalone,
} from "@/lib/a2hs";
import { brand } from "@/skin/brand";

type BeforeInstall = Event & { prompt: () => Promise<void> };

function ShareIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 2.5v10" />
      <path d="M6.5 6 10 2.5 13.5 6" />
      <rect x="4" y="8.5" width="12" height="9" rx="1.5" />
    </svg>
  );
}

function AddSquareIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="15" height="15" rx="3" />
      <path d="M10 6.5v7M6.5 10h7" />
    </svg>
  );
}

/** Shared sheet: rendered by both the auto-triggered drawer and the manual
 * reopen row on /account. Skin tokens only so it inherits Ledger/Box Score. */
function InstallSheet({
  open,
  onOpenChange,
  ios,
  deferred,
  onInstalled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ios: boolean;
  deferred: BeforeInstall | null;
  onInstalled: () => void;
}) {
  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    onInstalled();
    onOpenChange(false);
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[90vh] flex-col rounded-t-2xl bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 ring-card outline-none">
          <Drawer.Handle className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line" />
          <Drawer.Title className="sr-only">Add {brand.name} to your home screen</Drawer.Title>
          <Drawer.Description className="sr-only">
            Steps to install {brand.name} as an app on this device.
          </Drawer.Description>

          <div className="mt-4 flex flex-col items-center text-center">
            <img src="/favicon.svg" alt="" className="size-14 rounded-xl ring-card" />
            <h2 className="mt-4 font-display text-xl tracking-tight text-fg">
              Put the desk on your phone
            </h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted">
              One tap from your home screen, and the desk can ping you for the draft clock and
              waivers.
            </p>
          </div>

          <div className="mt-6">
            {ios ? (
              <ol className="space-y-3 text-sm text-fg">
                <li className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
                    <ShareIcon />
                  </span>
                  <span>
                    Tap <strong className="font-semibold">Share</strong> in the toolbar
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
                    <AddSquareIcon />
                  </span>
                  <span>
                    Scroll and tap <strong className="font-semibold">Add to Home Screen</strong>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised font-mono text-xs text-muted">
                    3
                  </span>
                  <span>Open {brand.name} from your home screen</span>
                </li>
              </ol>
            ) : deferred ? (
              <Button type="button" className="w-full" onClick={() => void handleInstall()}>
                Install
              </Button>
            ) : (
              <p className="text-sm text-muted">
                Use the browser menu →{" "}
                <strong className="font-semibold text-fg">Install app</strong> or{" "}
                <strong className="font-semibold text-fg">Add to Home Screen</strong>.
              </p>
            )}
          </div>

          {ios ? (
            <p className="mt-4 microlabel">Safari only — Chrome on iOS cannot pin it.</p>
          ) : null}

          <button
            type="button"
            className="mt-6 text-sm text-muted hover:text-fg"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </button>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Global, engagement-triggered mount (Shell renders it once). Silent unless
 * a join just happened or the visitor has shown up on 2+ distinct days. */
export function InstallDrawer() {
  const [desktop, setDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstall | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      setDesktop(true);
      return;
    }
    if (standalone()) return;

    setIos(iosSafari());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    let joinedFlag = false;
    try {
      joinedFlag = localStorage.getItem(A2HS_JOIN_KEY) === "1";
    } catch {
      /* ignore */
    }

    const eligible = checkAndRecordVisit();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (eligible) {
      timer = setTimeout(() => {
        setOpen(true);
        if (joinedFlag) {
          try {
            localStorage.removeItem(A2HS_JOIN_KEY);
          } catch {
            /* ignore */
          }
        }
      }, 600);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (desktop) return null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      try {
        localStorage.setItem(A2HS_DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <InstallSheet
      open={open}
      onOpenChange={handleOpenChange}
      ios={ios}
      deferred={deferred}
      onInstalled={() => setDeferred(null)}
    />
  );
}

/** Manual reopen row for /account — same sheet, but ignores dismissal and
 * day count. Still hidden once the app is already installed. */
export function InstallDrawerButton() {
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstall | null>(null);

  useEffect(() => {
    if (standalone()) return;
    setHidden(false);
    setIos(iosSafari());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      try {
        localStorage.setItem(A2HS_DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-lg items-center justify-between rounded-xl bg-surface px-4 py-3 text-left text-sm font-semibold text-fg ring-card hover:bg-raised"
      >
        Add to phone
        <span className="microlabel">Home screen</span>
      </button>
      <InstallSheet
        open={open}
        onOpenChange={handleOpenChange}
        ios={ios}
        deferred={deferred}
        onInstalled={() => setDeferred(null)}
      />
    </>
  );
}
