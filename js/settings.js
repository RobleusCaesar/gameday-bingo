// Player profile and device settings.
import * as store from './store.js';
import { uuid } from './rng.js';

export const EMOJIS = [
  '🏈', '🐴', '🔥', '🍺', '🌭', '🧢', '🎉', '😤', '😎', '🤠', '👑', '💀',
  '🍕', '🌮', '🥨', '🧀', '🍗', '⚡', '🌶️', '📣', '🏔️', '🐐', '🦅', '🐻',
  '🦁', '🐯', '🦬', '🐬', '🥳', '🤘', '🧊', '🍩',
];

const DEFAULTS = {
  sound: true,
  volume: 0.8,
  haptics: true,
  motion: 'auto', // auto | reduced | full
  theme: 'night', // night | day | neutral | custom
  custom: { primary: '#FB4F14', accent: '#FFC845' },
  wakeLock: true,
};

let cache = null;
const listeners = new Set();

const HEX = /^#[0-9a-f]{6}$/i;

/** Merge saved settings over defaults, dropping anything malformed (e.g. from an old backup). */
function clean(saved) {
  const s = { ...DEFAULTS };
  if (!saved || typeof saved !== 'object') return s;
  if (typeof saved.sound === 'boolean') s.sound = saved.sound;
  if (Number.isFinite(saved.volume)) s.volume = Math.max(0, Math.min(1, saved.volume));
  if (typeof saved.haptics === 'boolean') s.haptics = saved.haptics;
  if (['auto', 'reduced', 'full'].includes(saved.motion)) s.motion = saved.motion;
  if (['night', 'day', 'neutral', 'custom'].includes(saved.theme)) s.theme = saved.theme;
  if (saved.custom && HEX.test(saved.custom.primary) && HEX.test(saved.custom.accent)) {
    s.custom = { primary: saved.custom.primary, accent: saved.custom.accent };
  }
  if (typeof saved.wakeLock === 'boolean') s.wakeLock = saved.wakeLock;
  return s;
}

export function settings() {
  if (!cache) cache = clean(store.get('settings'));
  return cache;
}

export function updateSettings(patch) {
  cache = clean({ ...settings(), ...patch });
  store.set('settings', cache);
  listeners.forEach((fn) => fn(cache));
  return cache;
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reducedMotion() {
  const m = settings().motion;
  if (m === 'reduced') return true;
  if (m === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function profile() {
  let p = store.get('profile');
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id) {
    p = { name: '', emoji: '', ...(p && typeof p === 'object' ? p : {}), id: uuid() };
    store.set('profile', p);
  }
  if (typeof p.name !== 'string') p.name = '';
  if (typeof p.emoji !== 'string') p.emoji = '';
  return p;
}

export function hasProfile() {
  const p = store.get('profile');
  return !!(p && p.name && p.emoji);
}

export function saveProfile(patch) {
  const p = { ...profile(), ...patch };
  p.name = String(p.name || '').trim().slice(0, 18);
  store.set('profile', p);
  return p;
}

export function resetSettingsCache() {
  cache = null;
}
