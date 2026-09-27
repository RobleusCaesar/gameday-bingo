// Every sound is synthesized with Web Audio. No audio files.
import { settings } from './settings.js';

let ctx = null;
let master = null;
let noise = null;

function ac() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  // 2s of white noise, reused for every burst.
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** iOS requires the context to be started from a user gesture. */
export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
}

function ready() {
  const s = settings();
  if (!s.sound) return null;
  const c = ac();
  if (!c || c.state !== 'running') {
    c?.resume?.().catch(() => {});
    if (!c || c.state !== 'running') return null;
  }
  master.gain.value = Math.max(0, Math.min(1, s.volume)) * 0.9;
  return c;
}

function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noiseSrc(c) {
  const s = c.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  return s;
}

function tone(c, { type = 'sine', freq, to, t, dur, peak = 0.3, attack = 0.005, dest = master, detune = 0 }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
  o.detune.value = detune;
  env(g, t, peak, attack, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
  return o;
}

const jitter = () => 1 + (Math.random() * 0.16 - 0.08);

/** Dauber "thwack": noise slap + pitch-dropping thump. ±8% pitch. */
export function thwack() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.001;
  const p = jitter();
  const n = noiseSrc(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1700 * p;
  bp.Q.value = 0.9;
  const ng = c.createGain();
  env(ng, t, 0.7, 0.002, 0.07);
  n.connect(bp).connect(ng).connect(master);
  n.start(t, Math.random());
  n.stop(t + 0.12);
  tone(c, { freq: 200 * p, to: 58 * p, t, dur: 0.16, peak: 0.9, attack: 0.003 });
}

/** Quiet "peel" for unmarking. */
export function peel() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.001;
  const n = noiseSrc(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(2200, t);
  f.frequency.exponentialRampToValueAtTime(6500, t + 0.14);
  const g = c.createGain();
  env(g, t, 0.16, 0.03, 0.12);
  n.connect(f).connect(g).connect(master);
  n.start(t, Math.random());
  n.stop(t + 0.2);
}

/** Rising three-note arpeggio for a completed line. */
export function arpeggio() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    tone(c, { type: 'triangle', freq: f, t: t + i * 0.085, dur: 0.28, peak: 0.32 });
    tone(c, { type: 'sine', freq: f * 2, t: t + i * 0.085, dur: 0.18, peak: 0.08 });
  });
}

/** Stadium horn + crowd roar + fanfare. */
export function bingoFanfare() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.02;

  // Horn: detuned saw chord through a lowpass, with a little vibrato.
  const hornBus = c.createBiquadFilter();
  hornBus.type = 'lowpass';
  hornBus.frequency.setValueAtTime(900, t);
  hornBus.frequency.linearRampToValueAtTime(2400, t + 0.12);
  hornBus.Q.value = 3;
  const hornGain = c.createGain();
  hornGain.gain.setValueAtTime(0.0001, t);
  hornGain.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
  hornGain.gain.setValueAtTime(0.22, t + 0.85);
  hornGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
  hornBus.connect(hornGain).connect(master);
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 5.5;
  lfoGain.gain.value = 6;
  lfo.connect(lfoGain);
  for (const [f, d] of [[233.08, -7], [233.08, 7], [293.66, 0], [349.23, -4]]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = d;
    lfoGain.connect(o.detune);
    o.connect(hornBus);
    o.start(t);
    o.stop(t + 1.3);
  }
  lfo.start(t);
  lfo.stop(t + 1.3);

  // Crowd roar: filtered noise swell with a slow murmur.
  const n = noiseSrc(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 850;
  bp.Q.value = 0.55;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  const crowd = c.createGain();
  crowd.gain.setValueAtTime(0.0001, t);
  crowd.gain.exponentialRampToValueAtTime(0.32, t + 0.7);
  crowd.gain.setValueAtTime(0.32, t + 1.5);
  crowd.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
  const murmur = c.createOscillator();
  const murmurGain = c.createGain();
  murmur.frequency.value = 3.2;
  murmurGain.gain.value = 0.08;
  murmur.connect(murmurGain).connect(crowd.gain);
  n.connect(bp).connect(lp).connect(crowd).connect(master);
  n.start(t);
  n.stop(t + 3.7);
  murmur.start(t);
  murmur.stop(t + 3.7);

  // Fanfare arpeggio on top.
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const last = i === notes.length - 1;
    tone(c, { type: 'square', freq: f, t: t + 0.42 + i * 0.1, dur: last ? 0.6 : 0.16, peak: 0.07 });
    tone(c, { type: 'triangle', freq: f, t: t + 0.42 + i * 0.1, dur: last ? 0.7 : 0.2, peak: 0.2 });
  });
}

/** Little two-note chime when someone else bingos. */
export function chime() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  tone(c, { type: 'triangle', freq: 880, t, dur: 0.2, peak: 0.18 });
  tone(c, { type: 'triangle', freq: 1318.5, t: t + 0.09, dur: 0.35, peak: 0.18 });
}

/** Soft blip for toasts. */
export function blip() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.005;
  tone(c, { freq: 740, to: 1100, t, dur: 0.08, peak: 0.1 });
}
