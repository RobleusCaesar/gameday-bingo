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

export function settings() {
  if (!cache) cache = { ...DEFAULTS, ...(store.get('settings') || {}) };
  return cache;
}

export function updateSettings(patch) {
  cache = { ...settings(), ...patch };
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
  if (!p || !p.id) {
    p = { id: uuid(), name: '', emoji: '', ...(p || {}) };
    store.set('profile', p);
  }
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
