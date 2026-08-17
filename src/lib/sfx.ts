/**
 * Arena audio engine — procedural WebAudio, no assets, no network.
 * Sounds are layered from oscillator tones + filtered noise bursts so the
 * palette feels designed rather than beepy.
 */

export type SfxName =
  | "click"
  | "hover"
  | "select"
  | "correct"
  | "wrong"
  | "opponent"
  | "matched"
  | "tick"
  | "victory"
  | "defeat"
  | "scrub"
  // new palette
  | "queue"
  | "cancel"
  | "whoosh"
  | "question"
  | "streak"
  | "final"
  | "play"
  | "pause"
  | "elo_up"
  | "elo_down"
  | "error"
  | "toggle"
  // ambience / transitions
  | "transition"
  | "warn"
  | "timeup"
  | "sonar"
  | "halfway"
  | "start";

const MUTE_KEY = "jee-ranked-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 3.0;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(ac: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(ac.sampleRate * 1.2);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  window.dispatchEvent(new CustomEvent("jee-sfx-mute", { detail: muted }));
}

type Tone = {
  kind?: "tone";
  freq: number;
  to?: number;
  at?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  /** simple detuned second voice for thickness */
  detune?: number;
};

type Noise = {
  kind: "noise";
  at?: number;
  dur?: number;
  gain?: number;
  /** band-pass center, sweeps to `to` when given */
  freq: number;
  to?: number;
  q?: number;
};

type Layer = Tone | Noise;

const RECIPES: Record<SfxName, Layer[]> = {
  // --- UI ---
  hover: [{ freq: 1250, dur: 0.025, type: "sine", gain: 0.02 }],
  click: [
    { freq: 340, dur: 0.045, type: "square", gain: 0.045 },
    { kind: "noise", freq: 2600, dur: 0.035, gain: 0.02, q: 6 },
  ],
  toggle: [
    { freq: 420, to: 620, dur: 0.07, type: "triangle", gain: 0.05 },
    { kind: "noise", freq: 3200, dur: 0.05, gain: 0.015, q: 8 },
  ],
  select: [
    { freq: 520, to: 760, dur: 0.09, type: "triangle", gain: 0.07 },
    { freq: 260, dur: 0.06, type: "sine", gain: 0.04 },
  ],
  scrub: [{ freq: 900, dur: 0.028, type: "square", gain: 0.028 }],
  whoosh: [
    { kind: "noise", freq: 260, to: 2400, dur: 0.34, gain: 0.05, q: 1.2 },
    { freq: 120, to: 300, dur: 0.3, type: "sine", gain: 0.03 },
  ],
  error: [
    { freq: 200, dur: 0.09, type: "square", gain: 0.05 },
    { freq: 160, dur: 0.14, at: 0.08, type: "square", gain: 0.05 },
  ],

  // --- match flow ---
  tick: [{ freq: 1150, dur: 0.035, type: "sine", gain: 0.045 }],
  final: [
    { freq: 1400, dur: 0.05, type: "square", gain: 0.05 },
    { freq: 700, dur: 0.09, at: 0.04, type: "square", gain: 0.04 },
  ],
  question: [
    { kind: "noise", freq: 1800, to: 600, dur: 0.16, gain: 0.025, q: 2 },
    { freq: 300, to: 520, dur: 0.16, type: "triangle", gain: 0.045 },
  ],
  correct: [
    { freq: 660, dur: 0.1, type: "triangle", gain: 0.08, detune: 6 },
    { freq: 990, dur: 0.16, at: 0.08, type: "triangle", gain: 0.08, detune: 6 },
    { kind: "noise", freq: 5200, dur: 0.09, gain: 0.015, q: 10 },
  ],
  wrong: [
    { freq: 220, to: 120, dur: 0.22, type: "sawtooth", gain: 0.06 },
    { freq: 110, dur: 0.2, at: 0.04, type: "square", gain: 0.04 },
    { kind: "noise", freq: 400, to: 150, dur: 0.22, gain: 0.02, q: 1.5 },
  ],
  streak: [
    { freq: 784, dur: 0.08, type: "square", gain: 0.055 },
    { freq: 1046, dur: 0.08, at: 0.07, type: "square", gain: 0.055 },
    { freq: 1318, dur: 0.22, at: 0.14, type: "square", gain: 0.06 },
  ],
  opponent: [
    { freq: 300, to: 240, dur: 0.12, type: "sine", gain: 0.05 },
    { kind: "noise", freq: 900, dur: 0.06, gain: 0.012, q: 4 },
  ],

  // --- matchmaking ---
  queue: [
    { kind: "noise", freq: 400, to: 3000, dur: 0.5, gain: 0.035, q: 1 },
    { freq: 196, to: 392, dur: 0.5, type: "triangle", gain: 0.05 },
    { freq: 587, dur: 0.24, at: 0.4, type: "triangle", gain: 0.05 },
  ],
  cancel: [
    { freq: 440, to: 180, dur: 0.26, type: "triangle", gain: 0.05 },
    { kind: "noise", freq: 1800, to: 300, dur: 0.26, gain: 0.02, q: 2 },
  ],
  matched: [
    { kind: "noise", freq: 300, to: 4000, dur: 0.22, gain: 0.04, q: 1 },
    { freq: 440, dur: 0.12, type: "square", gain: 0.07 },
    { freq: 660, dur: 0.12, at: 0.1, type: "square", gain: 0.07 },
    { freq: 880, dur: 0.32, at: 0.2, type: "square", gain: 0.08, detune: 8 },
  ],

  // --- results ---
  victory: [
    { freq: 523, dur: 0.14, type: "triangle", gain: 0.09, detune: 7 },
    { freq: 659, dur: 0.14, at: 0.13, type: "triangle", gain: 0.09, detune: 7 },
    { freq: 784, dur: 0.14, at: 0.26, type: "triangle", gain: 0.09, detune: 7 },
    { freq: 1046, dur: 0.6, at: 0.39, type: "triangle", gain: 0.1, detune: 10 },
    { kind: "noise", freq: 6000, dur: 0.5, at: 0.39, gain: 0.015, q: 12 },
  ],
  defeat: [
    { freq: 392, dur: 0.18, type: "sawtooth", gain: 0.06 },
    { freq: 311, dur: 0.2, at: 0.16, type: "sawtooth", gain: 0.06 },
    { freq: 196, to: 130, dur: 0.7, at: 0.34, type: "sawtooth", gain: 0.07 },
    { kind: "noise", freq: 700, to: 120, dur: 0.7, at: 0.34, gain: 0.018, q: 1.5 },
  ],
  elo_up: [
    { freq: 700, to: 1200, dur: 0.22, type: "sine", gain: 0.055 },
    { kind: "noise", freq: 4200, dur: 0.12, gain: 0.012, q: 10 },
  ],
  elo_down: [{ freq: 600, to: 260, dur: 0.28, type: "sine", gain: 0.05 }],

  // --- replay transport ---
  play: [{ freq: 480, to: 720, dur: 0.1, type: "triangle", gain: 0.05 }],
  pause: [{ freq: 620, to: 380, dur: 0.1, type: "triangle", gain: 0.05 }],

  // --- ambience / transitions ---
  transition: [
    { kind: "noise", freq: 700, to: 180, dur: 0.28, gain: 0.028, q: 1.2 },
    { freq: 420, to: 210, dur: 0.22, type: "sine", gain: 0.03 },
  ],
  start: [
    { freq: 392, dur: 0.12, type: "square", gain: 0.055 },
    { freq: 523, dur: 0.12, at: 0.11, type: "square", gain: 0.055 },
    { freq: 784, dur: 0.34, at: 0.22, type: "square", gain: 0.07, detune: 8 },
    { kind: "noise", freq: 500, to: 4000, dur: 0.3, gain: 0.03, q: 1 },
  ],
  warn: [
    { freq: 880, dur: 0.09, type: "triangle", gain: 0.05 },
    { freq: 880, dur: 0.09, at: 0.14, type: "triangle", gain: 0.05 },
    { kind: "noise", freq: 3000, dur: 0.06, gain: 0.012, q: 8 },
  ],
  timeup: [
    { freq: 300, dur: 0.16, type: "sawtooth", gain: 0.07 },
    { freq: 220, dur: 0.2, at: 0.15, type: "sawtooth", gain: 0.07 },
    { freq: 150, to: 90, dur: 0.5, at: 0.32, type: "sawtooth", gain: 0.07 },
    { kind: "noise", freq: 900, to: 120, dur: 0.5, at: 0.32, gain: 0.02, q: 1.4 },
  ],
  sonar: [
    { freq: 1320, to: 990, dur: 0.18, type: "sine", gain: 0.03 },
    { kind: "noise", freq: 5000, dur: 0.05, gain: 0.008, q: 12 },
  ],
  halfway: [
    { freq: 660, dur: 0.09, type: "triangle", gain: 0.045 },
    { freq: 880, dur: 0.16, at: 0.08, type: "triangle", gain: 0.045 },
  ],
};

export function playSfx(name: SfxName) {
  if (isMuted()) return;
  const ac = audio();
  if (!ac || !master) return;
  const now = ac.currentTime;

  for (const layer of RECIPES[name]) {
    const start = now + (layer.at ?? 0);
    const dur = layer.dur ?? 0.1;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(layer.gain ?? 0.06, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    gain.connect(master);

    if ("kind" in layer && layer.kind === "noise") {
      const src = ac.createBufferSource();
      src.buffer = noise(ac);
      const filter = ac.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = layer.q ?? 3;
      filter.frequency.setValueAtTime(layer.freq, start);
      if (layer.to) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, layer.to), start + dur);
      }
      src.connect(filter).connect(gain);
      src.start(start);
      src.stop(start + dur + 0.02);
      continue;
    }

    const tone = layer as Tone;
    const voices = tone.detune ? [0, tone.detune] : [0];
    for (const cents of voices) {
      const osc = ac.createOscillator();
      osc.type = tone.type ?? "sine";
      osc.detune.value = cents;
      osc.frequency.setValueAtTime(tone.freq, start);
      if (tone.to) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone.to), start + dur);
      }
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
  }
}
