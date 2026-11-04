import { getAudioContext } from "@/lib/audio-unlock";

/** Glocken-Schlag mit Obertönen (klingt wie eine echte Glocke). */
function bell(ctx: AudioContext, freq: number, at: number, peak: number, decay: number) {
  const partials: [number, number][] = [[1, 1], [2.0, 0.5], [3.01, 0.28], [4.2, 0.15]];
  for (const [mult, amp] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * mult, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * amp, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay / mult ** 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/**
 * Stationston, ca. 5–6 Sekunden, stoppt von selbst.
 * Küche: helles „Ding Ding", Pizza: tiefes „Dong Dong", Bar: kurzer Beep.
 */
export function playStationBell(station: "kueche" | "pizza" | "bar") {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.05;
  if (station === "bar") {
    for (let i = 0; i < 3; i++) bell(ctx, 1320, t0 + i * 0.35, 0.5, 0.4);
    return;
  }
  const kitchen = station === "kueche";
  const [hi, lo] = kitchen ? [1568, 1319] : [523, 392];
  // 4 Paare über ~5.5 s
  for (let r = 0; r < 4; r++) {
    const base = t0 + r * 1.4;
    bell(ctx, hi, base, 0.9, kitchen ? 1.0 : 1.4);
    bell(ctx, lo, base + 0.45, 0.9, kitchen ? 1.0 : 1.4);
  }
}

