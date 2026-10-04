// Square packs: seeded from the built-ins on first run, then fully editable.
import * as store from './store.js';
import { BUILTIN_PACKS, DEFAULT_CATEGORIES, DEFAULT_PACKS_VERSION, PAST_FINGERPRINTS, isInjurySquare } from './data/default-packs.js';
import { shortId, hash } from './rng.js';
import { packStats, normText } from './board.js';
import { eligibleSquares } from './tags.js';

const KEY = 'packs';
export const MAX_TEXT = 80;
const LIVE_LOCK_MS = 12 * 60 * 60 * 1000;

function copySquare(s) {
  const out = { id: shortId(), t: s.t, r: s.r, c: s.c || '' };
  if (Array.isArray(s.opponents) && s.opponents.length) out.opponents = s.opponents.slice();
  if (Array.isArray(s.broadcasts) && s.broadcasts.length) out.broadcasts = s.broadcasts.slice();
  return out;
}

function withIds(squares) {
  return squares.map(copySquare);
}

/** Content fingerprint of a square list (ignores ids and order). */
export function fingerprint(squares) {
  return hash(squares.map((s) => [s.r, normText(s.t), s.c || '', (s.opponents || []).join(','), (s.broadcasts || []).join(',')].join('|'))
    .sort().join('\n')).toString(36);
}

function freshBuiltin(src) {
  return {
    id: src.builtin,
    builtin: src.builtin,
    name: src.name,
    squares: withIds(src.squares),
    builtinVersion: DEFAULT_PACKS_VERSION,
    baseFp: fingerprint(src.squares),
    updatedAt: Date.now(),
  };
}

function seed() {
  const packs = BUILTIN_PACKS.map(freshBuiltin);
  store.set(KEY, packs);
  return packs;
}

/**
 * Default packs are versioned. An unedited copy is replaced with the new version;
 * an edited one is kept and flagged so the app can offer a one-time merge.
 * Games already in progress are unaffected: they play from their own snapshot.
 */
export function migrate(packs) {
  let changed = false;
  packs.forEach((p, i) => {
    const src = p.builtin && BUILTIN_PACKS.find((b) => b.builtin === p.builtin);
    const have = p.builtinVersion || 1;
    if (!src || have >= DEFAULT_PACKS_VERSION || p.pendingMerge === DEFAULT_PACKS_VERSION) return;
    const base = p.baseFp || PAST_FINGERPRINTS[p.builtin]?.[have];
    if (base && fingerprint(p.squares) === base) {
      packs[i] = { ...freshBuiltin(src), id: p.id, name: p.name };
    } else {
      p.pendingMerge = DEFAULT_PACKS_VERSION;
    }
    changed = true;
  });
  return changed;
}

let migrated = false;

export function listPacks() {
  const packs = store.get(KEY);
  if (!Array.isArray(packs) || !packs.length) return seed();
  if (!migrated) {
    migrated = true;
    if (migrate(packs)) store.set(KEY, packs);
  }
  return packs;
}

/** Edited default packs that have an update waiting for the user's OK. */
export function pendingMerges() {
  return listPacks().filter((p) => p.pendingMerge);
}

/**
 * Merge the latest default squares into an edited copy: add new squares, drop
 * injury squares, and copy opponent/broadcast tags onto matching squares.
 * Rarity and text the user changed are left alone. Returns how many were added/removed.
 */
export function mergeDefaults(id) {
  const p = getPack(id);
  const src = p && BUILTIN_PACKS.find((b) => b.builtin === p.builtin);
  if (!src) return null;
  const before = p.squares.length;
  p.squares = p.squares.filter((s) => !isInjurySquare(s.t));
  const removed = before - p.squares.length;
  const mine = new Map(p.squares.map((s) => [normText(s.t), s]));
  let added = 0;
  for (const s of src.squares) {
    const have = mine.get(normText(s.t));
    if (have) {
      if (s.opponents) have.opponents = s.opponents.slice();
      if (s.broadcasts) have.broadcasts = s.broadcasts.slice();
    } else {
      p.squares.push(copySquare(s));
      added++;
    }
  }
  p.builtinVersion = DEFAULT_PACKS_VERSION;
  p.baseFp = fingerprint(src.squares);
  delete p.pendingMerge;
  savePack(p);
  return { added, removed };
}

export function dismissMerge(id) {
  const p = getPack(id);
  if (!p) return;
  p.builtinVersion = DEFAULT_PACKS_VERSION;
  delete p.pendingMerge;
  savePack(p);
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
  p.builtinVersion = DEFAULT_PACKS_VERSION;
  p.baseFp = fingerprint(src.squares);
  delete p.pendingMerge;
  return savePack(p);
}

/** Pack health; pass { opp, broadcast } to measure the pool a game would actually draw from. */
export function stats(pack, game = null) {
  return packStats(game ? eligibleSquares(pack.squares, game) : pack.squares);
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
