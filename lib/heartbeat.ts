import { tick } from "@/lib/negotiation";
import { maybeEditorial } from "@/lib/editorial";
import { getStore } from "@/lib/store";

// The world heartbeat: a server-side loop that makes agents trade on their own,
// so the newsroom / climb / chains are alive even with nobody clicking. It paces
// itself (a cap on concurrent negotiations) and can be paused for a scripted
// demo moment. Lives on globalThis so it survives HMR and is a true singleton.
interface Heartbeat {
  enabled: boolean;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
  beating: boolean; // re-entrancy guard for a single beat
  ticks: number;
  lastTickAt: string | null;
}

const MAX_CONCURRENT = 2;

const g = globalThis as unknown as { __paperclip_hb?: Heartbeat };
function hb(): Heartbeat {
  if (!g.__paperclip_hb) {
    g.__paperclip_hb = {
      enabled: true, // the world is alive by default — pause it from the UI
      intervalMs: 14_000,
      timer: null,
      beating: false,
      ticks: 0,
      lastTickAt: null,
    };
  }
  return g.__paperclip_hb;
}

async function beat() {
  const h = hb();
  if (!h.enabled || h.beating) return;
  h.beating = true;
  try {
    const negs = await getStore().getNegotiations();
    const inProgress = negs.filter((n) => n.status === "in_progress").length;
    if (inProgress >= MAX_CONCURRENT) return; // let the floor clear first
    const r = await tick(); // fire-and-forget; the negotiation streams in live
    if (r.matched) {
      h.ticks += 1;
      h.lastTickAt = new Date().toISOString();
    }
    await maybeEditorial(); // self-throttles to ~one column every couple minutes
  } catch (e) {
    console.error("[heartbeat]", (e as Error).message);
  } finally {
    h.beating = false;
  }
}

/** Idempotent — starts the interval once per process. */
export function startHeartbeat() {
  const h = hb();
  if (h.timer) return;
  h.timer = setInterval(beat, h.intervalMs);
  console.log(
    `\x1b[45m\x1b[97m WORLD HEARTBEAT \x1b[0m agents auto-trade every ${
      h.intervalMs / 1000
    }s (pause/resume in the UI)`
  );
}

export function setHeartbeat(enabled: boolean) {
  hb().enabled = enabled;
  return getHeartbeat();
}

export function getHeartbeat() {
  const h = hb();
  return {
    enabled: h.enabled,
    intervalMs: h.intervalMs,
    ticks: h.ticks,
    lastTickAt: h.lastTickAt,
  };
}
