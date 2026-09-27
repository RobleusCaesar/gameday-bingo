// Square packs: seeded from the built-ins on first run, then fully editable.
import * as store from './store.js';
import { BUILTIN_PACKS, DEFAULT_CATEGORIES } from './data/default-packs.js';
import { shortId } from './rng.js';
import { packStats } from './board.js';

const KEY = 'packs';
export const MAX_TEXT = 80;
const LIVE_LOCK_MS = 12 * 60 * 60 * 1000;

function withIds(squares) {
  return squares.map((s) => ({ id: shortId(), t: s.t, r: s.r, c: s.c || '' }));
}

function seed() {
  const packs = BUILTIN_PACKS.map((p) => ({
    id: p.builtin,
    builtin: p.builtin,
    name: p.name,
    squares: withIds(p.squares),
    updatedAt: Date.now(),
  }));
  store.set(KEY, packs);
  return packs;
}

export function listPacks() {
  const packs = store.get(KEY);
  return Array.isArray(packs) && packs.length ? packs : seed();
}

function saveAll(packs) {
  store.set(KEY, packs);
}

export function getPack(id) {
  return listPacks().find((p) => p.id === id) || null;
}

export function savePack(pack) {
  const packs = listPacks();
  const i = packs.findIndex((p) => p.id === pack.id);
  pack.updatedAt = Date.now();
  if (i >= 0) packs[i] = pack; else packs.push(pack);
  saveAll(packs);
  return pack;
}

export function createPack(name) {
  return savePack({ id: shortId(), name: name || 'New pack', squares: [], updatedAt: Date.now() });
}

export function duplicatePack(id) {
  const src = getPack(id);
  if (!src) return null;
  return savePack({
    id: shortId(),
    name: `${src.name} copy`,
    squares: withIds(src.squares),
    updatedAt: Date.now(),
  });
}

export function renamePack(id, name) {
  const p = getPack(id);
  if (!p) return;
  p.name = name.slice(0, 40);
  savePack(p);
}

export function deletePack(id) {
  saveAll(listPacks().filter((p) => p.id !== id));
}

export function resetPack(id) {
  const p = getPack(id);
  const src = p && BUILTIN_PACKS.find((b) => b.builtin === p.builtin);
  if (!src) return null;
  p.squares = withIds(src.squares);
  p.name = src.name;
  return savePack(p);
}

export function stats(pack) {
  return packStats(pack.squares);
}

export function categories(pack) {
  const set = new Set(DEFAULT_CATEGORIES);
  for (const s of pack?.squares || []) if (s.c) set.add(s.c);
  return [...set];
}

export function usesTeamToken(pack) {
  return pack.squares.some((s) => s.t.includes('{TEAM}'));
}

/**
 * A pack is locked while a live game on this device is using it.
 * Returns the game code or null.
 */
export function lockedBy(packId) {
  const now = Date.now();
  for (const key of store.keys('game:')) {
    const g = store.get(key);
    if (!g || g.config?.packId !== packId || g.status === 'ended') continue;
    if (now - (g.config.createdAt || 0) > LIVE_LOCK_MS) continue;
    if (g.marks && g.marks.filter(Boolean).length > 1) return g.code;
    if (g.role === 'host') return g.code;
  }
  return null;
}

export function cleanText(t) {
  return String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}
