// New Order Alert Sound — a loud, unmistakable "wake up call" style alarm
// played on the admin dashboard the instant a customer's order comes in.
//
// Built with the Web Audio API (oscillators only) rather than an audio
// file: no asset to host/ship, no network round-trip before it can play,
// and it can't go stale or 404. The same technique already exists in the
// legacy Kitchen Dashboard (app/(kitchen)/kds/page.tsx) for a soft chime —
// this is a separate, deliberately louder/harsher pattern for the main
// admin dashboard, since staff need to notice it from across the counter.

let audioCtx: AudioContext | null = null;
let unlocked = false;

/** True once the browser has allowed audio to play (a user gesture has
 *  occurred). Browsers block audio.play()/AudioContext output before that,
 *  so this must be called from a real click/keydown handler — see
 *  KotAutoPrintProvider's one-time window listener. */
function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Call once, from an actual user gesture (click/keydown), to unlock
 *  playback for the rest of the session. Safe to call repeatedly. */
export function unlockOrderAlertAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  unlocked = true;
}

/** True once unlockOrderAlertAudio() has run — lets callers decide whether
 *  to also show a visual-only fallback for a browser tab that's never had
 *  a user gesture yet (audio can't play before that no matter what). */
export function isOrderAlertAudioUnlocked(): boolean {
  return unlocked;
}

function beep(ctx: AudioContext, freq: number, start: number, duration: number, gain: number, type: OscillatorType = "square") {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Quick attack/decay so each beep is a clean, sharp pulse rather than a
  // click (attack) or an abrupt cutoff (decay) — same envelope shape as
  // the KDS chime, just louder and on harsher square-wave tones instead of
  // sine, which is what makes this read as an "alarm" rather than a chime.
  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.015);
  gainNode.gain.setValueAtTime(gain, start + duration - 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gainNode).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/**
 * Plays the "new order" alert: three sharp two-tone alarm bursts (like a
 * wake-up call / reversing-truck beeper), loud enough to notice from
 * across a counter. Roughly 2.4s total. No-op until a user gesture has
 * unlocked audio, and no-op in any environment without Web Audio.
 */
export function playOrderAlertSound(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    // Still locked (no gesture yet on this page load) — nothing to play.
    // We deliberately don't queue/retry: the next new-order event will
    // simply try again, and by then a click has usually already happened.
    return;
  }

  const now = ctx.currentTime;
  const HIGH = 1046.5; // C6
  const LOW = 784; // G5
  const GAIN = 0.5; // louder than the KDS chime's 0.22 — this needs to cut through a busy counter

  let t = now;
  for (let burst = 0; burst < 3; burst++) {
    beep(ctx, HIGH, t, 0.16, GAIN);
    beep(ctx, LOW, t + 0.19, 0.16, GAIN);
    t += 0.46; // gap before the next burst
  }
}
