// Shared, gesture-unlocked AudioContext so notification sounds actually play.
// Browsers block AudioContext output until the user has interacted with the
// page. We install one-time listeners that resume a shared context on the
// first gesture, and expose getAudioContext() for callers.

let sharedCtx: AudioContext | null = null;
let unlocked = false;
let installed = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    try {
      sharedCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

function unlock() {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume().then(() => {
      unlocked = true;
    }).catch(() => {});
  } else {
    unlocked = true;
  }
  // Play a near-silent buffer to fully unlock on iOS Safari.
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore
  }
}

export function installAudioUnlock() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const handler = () => {
    unlock();
    if (unlocked) {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("click", handler);
    }
  };
  window.addEventListener("pointerdown", handler, { passive: true });
  window.addEventListener("touchstart", handler, { passive: true });
  window.addEventListener("keydown", handler);
  window.addEventListener("click", handler);
}

export function getAudioContext(): AudioContext | null {
  const ctx = ensureCtx();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isAudioUnlocked() {
  return unlocked;
}
