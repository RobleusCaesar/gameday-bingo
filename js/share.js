// Invite links: #/join/CODE~<lz-string payload>. The payload carries the pack
// snapshot and game options, so a joiner can build a board with the host offline.
import { loadLZ } from './libs.js';
import { isCode } from './rng.js';
import { MIX } from './board.js';

const MIX_CODE = { chill: 'c', balanced: 'b', chaos: 'x' };
const MIX_FROM = { c: 'chill', b: 'balanced', x: 'chaos' };
const MAX_SQUARES = 400;

export function appUrl() {
  return location.origin + location.pathname;
}

export function shortLink(code) {
  return `${appUrl()}#/join/${code}`;
}

export async function inviteLink(config) {
  try {
    const lz = await loadLZ();
    return `${appUrl()}#/join/${config.code}~${lz.compressToEncodedURIComponent(JSON.stringify(compact(config)))}`;
  } catch {
    return shortLink(config.code);
  }
}

function compact(cfg) {
  return {
    v: 1,
    c: cfg.code,
    r: cfg.rev || 0,
    n: cfg.packName,
    s: cfg.squares.map((s) => [s.t, s.r]),
    o: cfg.opp || '',
    tm: cfg.team || '',
    w: (cfg.win.corners ? 'c' : '') + (cfg.win.x ? 'x' : '') + (cfg.win.blackout ? 'b' : ''),
    m: MIX_CODE[cfg.mix] || 'b',
    hi: cfg.hostId,
    hn: cfg.hostName,
    he: cfg.hostEmoji,
    a: cfg.createdAt,
  };
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Validate and normalize a config from an untrusted source (link or peer). */
export function sanitizeConfig(cfg) {
  if (!cfg || typeof cfg !== 'object' || !isCode(cfg.code)) return null;
  if (!Array.isArray(cfg.squares) || cfg.squares.length < 24) return null;
  const squares = cfg.squares.slice(0, MAX_SQUARES)
    .map((s) => ({ t: str(s && s.t, 80).trim(), r: ['C', 'U', 'R'].includes(s && s.r) ? s.r : 'C' }))
    .filter((s) => s.t);
  if (squares.length < 24) return null;
  const out = {
    v: 1,
    code: cfg.code,
    rev: Number.isInteger(cfg.rev) ? cfg.rev : 0,
    packName: str(cfg.packName, 40) || 'Custom pack',
    squares,
    opp: str(cfg.opp, 30),
    team: str(cfg.team, 30),
    win: { corners: !!cfg.win?.corners, x: !!cfg.win?.x, blackout: !!cfg.win?.blackout },
    mix: MIX[cfg.mix] ? cfg.mix : 'balanced',
    hostId: str(cfg.hostId, 64),
    hostName: str(cfg.hostName, 18) || 'Host',
    hostEmoji: str(cfg.hostEmoji, 8) || '🏈',
    createdAt: Number(cfg.createdAt) || Date.now(),
  };
  if (cfg.endedAt) {
    out.endedAt = Number(cfg.endedAt) || Date.now();
    out.final = sanitizeStandings(cfg.final);
  }
  return out;
}

export function sanitizeStandings(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 100).map((p) => ({
    pid: str(p?.pid, 64),
    name: str(p?.name, 18) || 'Player',
    emoji: str(p?.emoji, 8) || '🏈',
    points: Math.max(0, Math.min(99999, Number(p?.points) || 0)),
    bingos: Math.max(0, Math.min(99, Number(p?.bingos) || 0)),
    marks: Number(p?.marks) >>> 0,
  }));
}

/** Parse "#/join/CODE" or "#/join/CODE~payload" (or a pasted full URL). */
export function parseJoin(input) {
  const s = String(input || '').trim();
  const m = /(?:#\/join\/)?([A-Za-z0-9]{5})(?:~([A-Za-z0-9+\-$]+))?\s*$/.exec(s.includes('#/join/') ? s.slice(s.indexOf('#/join/')) : s);
  if (!m) return null;
  const code = m[1].toUpperCase();
  if (!isCode(code)) return null;
  return { code, payload: m[2] || null };
}

export async function decodePayload(code, payload) {
  const lz = await loadLZ();
  const json = lz.decompressFromEncodedURIComponent(payload);
  if (!json) return null;
  let o;
  try { o = JSON.parse(json); } catch { return null; }
  if (!o || o.c !== code || !Array.isArray(o.s)) return null;
  return sanitizeConfig({
    code: o.c,
    rev: o.r,
    packName: o.n,
    squares: o.s.map((x) => ({ t: x?.[0], r: x?.[1] })),
    opp: o.o,
    team: o.tm,
    win: { corners: String(o.w).includes('c'), x: String(o.w).includes('x'), blackout: String(o.w).includes('b') },
    mix: MIX_FROM[o.m] || 'balanced',
    hostId: o.hi,
    hostName: o.hn,
    hostEmoji: o.he,
    createdAt: o.a,
  });
}

/** Fill {OPP}/{TEAM} tokens. */
export function fill(text, cfg) {
  return String(text)
    .replace(/\{OPP\}/gi, cfg?.opp || 'Opponent')
    .replace(/\{TEAM\}/gi, cfg?.team || 'Home team');
}
