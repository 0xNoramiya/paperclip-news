import { formatMoney } from "@/lib/money";

// Ringside color commentary for a live negotiation — deterministic from the
// move + the value at stake, so it works with zero API key and streams live.
export const COMMENTATOR = "Pip Sterling, ringside";

export interface MoveContext {
  id: string;
  speakerName: string;
  oppName: string;
  turn: number;
  accepted: boolean;
  walked: boolean;
  givenName: string;
  givenPrice: number; // what the speaker would give up
  recvName: string;
  recvPrice: number; // what the speaker would receive
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function commentaryFor(m: MoveContext): string {
  const gap = m.recvPrice - m.givenPrice; // speaker's would-be gain

  if (m.accepted) {
    if (gap >= 50) return `🔨 SOLD! ${m.speakerName} takes it — a ${formatMoney(gap)} heist.`;
    if (gap <= -50) return `🔨 SOLD! ${m.speakerName} accepts… and overpays wildly. Bold.`;
    return `🔨 SOLD! ${m.speakerName} shakes on it.`;
  }
  if (m.walked) return `💨 ${m.speakerName} WALKS. No deal — back to the floor.`;

  if (m.turn <= 1) {
    return gap > 0
      ? `And we're off — ${m.speakerName} opens, eyeing a ${formatMoney(m.recvPrice)} ${m.recvName} for a ${formatMoney(m.givenPrice)} ${m.givenName}.`
      : `And we're off — ${m.speakerName} opens the bidding.`;
  }

  const pool = [
    `${m.speakerName} isn't budging.`,
    `Pressure mounting — turn ${m.turn} of 10.`,
    `${m.oppName} won't love that.`,
    `Classic ${m.speakerName}, working the angle.`,
    `Tense exchange — neither one blinks.`,
    gap >= 80
      ? `If this lands, ${m.speakerName} fleeces ${m.oppName} for ${formatMoney(gap)}.`
      : `Still daylight between them.`,
    m.turn >= 8 ? `Clock's almost out — somebody has to move.` : `${m.speakerName} circles back.`,
  ];
  return pool[(hash(m.id) + m.turn) % pool.length];
}
