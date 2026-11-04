import { getAudioContext } from "@/lib/audio-unlock";

// ---------- Bausteine ----------

/** Kurzer Zupf-Ton (Mandoline/Banjo): Obertöne mit sehr schnellem Ausklang. */
function pluck(ctx: AudioContext, freq: number, at: number, peak: number, decay = 0.28) {
  const partials: [OscillatorType, number, number][] = [
    ["sawtooth", 1, 0.6],
    ["triangle", 2, 0.35],
    ["sine", 3.01, 0.15],
  ];
  for (const [type, mult, amp] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, at);
    // leichtes Anschwingen
    osc.frequency.exponentialRampToValueAtTime(freq * mult * 0.995, at + decay);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * amp, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/** Cartoon-„Boing": Ton rutscht nach unten und wippt aus. */
function boing(ctx: AudioContext, freq: number, at: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const wobble = ctx.createOscillator();
  const wobbleGain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq * 1.6, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, at + 0.32);
  wobble.type = "sine";
  wobble.frequency.setValueAtTime(16, at);
  wobbleGain.gain.setValueAtTime(freq * 0.06, at);
  wobbleGain.gain.exponentialRampToValueAtTime(1, at + 0.3);
  wobble.connect(wobbleGain);
  wobbleGain.connect(osc.frequency);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.5);
  wobble.start(at);
  wobble.stop(at + 0.5);
}

/** Glissando-Zupfer: schnelle Notenreihe auf- oder abwärts. */
function glissando(
  ctx: AudioContext,
  notes: number[],
  start: number,
  step: number,
  peak: number,
  decay = 0.14,
) {
  notes.forEach((f, i) => pluck(ctx, f, start + i * step, peak, decay));
}

/** Heller Glöckchen-Klang für Höhepunkte. */
function sparkle(ctx: AudioContext, freq: number, at: number, peak: number, decay = 0.9) {
  const partials: [number, number][] = [[1, 1], [2.7, 0.4], [5.4, 0.18]];
  for (const [mult, amp] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * mult, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * amp, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/** Rausch-Schlag (Shaker / Trillerpfeifen-Puff). */
function shaker(ctx: AudioContext, at: number, dur: number, peak: number, freq: number) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, at);
  filter.Q.setValueAtTime(1.2, at);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(at);
}

/** Blubber-Bläschen (Kurzer Pieps, der nach oben rutscht). */
function bubble(ctx: AudioContext, at: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  const f = 260 + Math.random() * 260;
  osc.frequency.setValueAtTime(f, at);
  osc.frequency.exponentialRampToValueAtTime(f * 2.6, at + 0.09);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.15);
}

// Noten-Hilfe
const N = {
  A3: 220.0, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
  A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
  G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5, E6: 1318.5,
};

/**
 * Stationston, ca. 5–6 Sekunden, stoppt von selbst.
 * Drei klar unterscheidbare, verspielte Motive:
 *  - Küche: „Fliessband-Boing" – springender Ball, der immer schneller wird, dann Fanfare.
 *  - Pizza: fröhliche Mandolen-Melodie (Tarantella-Anklang) mit Schluss-Akkord.
 *  - Bar: Sprudelnder Cocktail-Einschenk-Klang mit Shaker und Glöckchen.
 */
export function playStationBell(station: "kueche" | "pizza" | "bar") {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.05;

  if (station === "kueche") {
    // Springender Ball: 8 Bounces, Abstände schrumpfen, Tonhöhe steigt.
    let at = t0;
    let gap = 0.62;
    let freq = 180;
    for (let i = 0; i < 8; i++) {
      boing(ctx, freq, at, 0.55);
      at += gap;
      gap = Math.max(0.14, gap * 0.78);
      freq = Math.min(720, freq * 1.16);
    }
    // Schluss: aufsteigender Zupfer + Fanfare-Akkord
    glissando(ctx, [N.C5, N.E5, N.G5, N.C6], at + 0.05, 0.09, 0.5);
    const fanfare = at + 0.45;
    [N.C5, N.E5, N.G5].forEach((f, i) => pluck(ctx, f, fanfare + i * 0.12, 0.65, 0.5));
    sparkle(ctx, N.C6, fanfare + 0.4, 0.7, 1.1);
    return;
  }

  if (station === "pizza") {
    // Tarantella-Anklang: 6/8-Puls, fröhlich, zwei Durchgänge.
    const phrase: [number, number][] = [
      // [Note, Beat-Offset in 6/8-Achteln]
      [N.A4, 0], [N.A4, 0.5], [N.A4, 1], [N.C5, 1.5], [N.B4, 2], [N.A4, 2.5],
      [N.C5, 3], [N.E5, 4], [N.D5, 4.5], [N.C5, 5], [N.B4, 5.5],
      [N.A4, 6], [N.E5, 7], [N.A5, 8],
    ];
    const eighth = 0.2; // zügiges Tempo
    phrase.forEach(([f, beat]) => pluck(ctx, f, t0 + beat * eighth, 0.6, 0.24));
    // zweiter Durchgang eine Oktave-Mix höher mit Glissando-Deko
    const t2 = t0 + 9 * eighth;
    phrase.forEach(([f, beat]) => {
      const up = beat === 0 ? f : f * 1.5; // Variante: Some higher
      pluck(ctx, Math.min(up, N.C6), t2 + beat * eighth, 0.55, 0.22);
    });
    // Abschluss: schneller Lauf + Akkord
    glissando(ctx, [N.A4, N.C5, N.E5, N.A5, N.E5, N.A5], t2 + 8 * eighth + 0.1, 0.07, 0.55, 0.12);
    [N.A4, N.C5, N.E5, N.A5].forEach((f) => pluck(ctx, f, t2 + 8 * eighth + 0.62, 0.5, 0.8));
    return;
  }

  // Bar: Einschenken mit Bläschen, Shaker, dann Glöckchen.
  for (let i = 0; i < 10; i++) bubble(ctx, t0 + i * 0.22, 0.45);
  shaker(ctx, t0 + 0.1, 1.6, 0.35, 5200);
  shaker(ctx, t0 + 2.1, 0.6, 0.45, 6400);
  [N.E6, N.C6].forEach((f, i) => sparkle(ctx, f, t0 + 2.9 + i * 0.35, 0.65, 0.8));
  shaker(ctx, t0 + 3.7, 1.1, 0.3, 5200);
  sparkle(ctx, N.E6, t0 + 4.2, 0.75, 1.2);
}
