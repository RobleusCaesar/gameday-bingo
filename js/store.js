// Tiny localStorage wrapper. Every key is namespaced "gdb:" and JSON-encoded.
// Falls back to memory when storage is blocked (private mode, quota, etc.).

const NS = 'gdb:';
const mem = new Map();
let ls = null;
try {
  const probe = NS + '__probe';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
  ls = window.localStorage;
} catch { ls = null; }

export const persistent = !!ls;

export function get(key, fallback = null) {
  // Memory first: it holds anything localStorage refused (quota full).
  const raw = mem.has(NS + key) ? mem.get(NS + key) : ls?.getItem(NS + key);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function set(key, value) {
  const raw = JSON.stringify(value);
  if (ls) {
    try {
      ls.setItem(NS + key, raw);
      mem.delete(NS + key);
      return true;
    } catch { /* quota: keep in memory */ }
  }
  mem.set(NS + key, raw);
  return false;
}

export function remove(key) {
  if (ls) ls.removeItem(NS + key);
  mem.delete(NS + key);
}

/** Keys (without the namespace) that start with `prefix`. */
export function keys(prefix = '') {
  const out = new Set();
  if (ls) {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(NS + prefix)) out.add(k.slice(NS.length));
    }
  }
  for (const k of mem.keys()) if (k.startsWith(NS + prefix)) out.add(k.slice(NS.length));
  return [...out];
}

export function exportAll() {
  const data = {};
  for (const k of keys()) data[k] = get(k);
  return { app: 'gameday-bingo', version: 1, exportedAt: new Date().toISOString(), data };
}

/**
 * Restore a backup. `valid(key, value)` decides which entries are safe to write;
 * anything it rejects is skipped.
 */
export function importAll(backup, valid = () => true) {
  if (!backup || backup.app !== 'gameday-bingo' || !backup.data || typeof backup.data !== 'object') {
    throw new Error('That file isn’t a Gameday Bingo backup.');
  }
  let n = 0;
  for (const [k, v] of Object.entries(backup.data)) {
    if (typeof k !== 'string' || k.length > 80 || !valid(k, v)) continue;
    set(k, v);
    n++;
  }
  return n;
}

export function clearAll() {
  for (const k of keys()) remove(k);
}
