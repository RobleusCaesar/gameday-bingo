// Square tags: opponent-specific and broadcast-specific squares.
// Untagged squares are always eligible. Tagged squares only enter the draw
// pool when the game's opponent / broadcast matches.

export const BROADCASTS = [
  { id: 'afternoon', label: 'Sunday Afternoon (CBS/FOX)', short: 'Sun afternoon' },
  { id: 'snf', label: 'Sunday Night (NBC)', short: 'SNF' },
  { id: 'mnf', label: 'Monday Night (ESPN)', short: 'MNF' },
  { id: 'tnf', label: 'Thursday Night (Prime)', short: 'TNF' },
  { id: 'other', label: 'Other', short: 'Other' },
];
export const DEFAULT_BROADCAST = 'afternoon';

export function broadcastLabel(id) {
  return BROADCASTS.find((b) => b.id === id)?.short || id;
}

// Each list: canonical key first, then nicknames, city and common abbreviations.
const TEAMS = [
  ['49ers', 'niners', 'san francisco', 'sf', 'san francisco 49ers'],
  ['bears', 'chicago', 'chi'], ['bengals', 'cincinnati', 'cin'], ['bills', 'buffalo', 'buf'],
  ['broncos', 'denver', 'den'], ['browns', 'cleveland', 'cle'], ['buccaneers', 'bucs', 'tampa bay', 'tampa', 'tb'],
  ['cardinals', 'arizona', 'ari', 'cards'], ['chargers', 'los angeles chargers', 'lac', 'bolts'],
  ['chiefs', 'kansas city', 'kc'], ['colts', 'indianapolis', 'ind'], ['commanders', 'washington', 'was', 'wsh'],
  ['cowboys', 'dallas', 'dal'], ['dolphins', 'miami', 'mia', 'fins'], ['eagles', 'philadelphia', 'phi', 'philly'],
  ['falcons', 'atlanta', 'atl'], ['giants', 'new york giants', 'nyg', 'big blue'], ['jaguars', 'jacksonville', 'jax', 'jags'],
  ['jets', 'new york jets', 'nyj'], ['lions', 'detroit', 'det'], ['packers', 'green bay', 'gb', 'pack'],
  ['panthers', 'carolina', 'car'], ['patriots', 'new england', 'ne', 'pats'], ['raiders', 'las vegas', 'lv', 'oakland'],
  ['rams', 'los angeles rams', 'lar'], ['ravens', 'baltimore', 'bal'], ['saints', 'new orleans', 'no', 'nola'],
  ['seahawks', 'seattle', 'sea', 'hawks'], ['steelers', 'pittsburgh', 'pit'], ['texans', 'houston', 'hou'],
  ['titans', 'tennessee', 'ten'], ['vikings', 'minnesota', 'min', 'vikes'],
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const ALIAS = new Map();
for (const names of TEAMS) for (const n of names) ALIAS.set(norm(n), names[0]);

/** Canonical team key for a name, case-insensitive with aliases ("Niners" → "49ers"). */
export function teamKey(name) {
  const n = norm(name);
  if (!n) return '';
  if (ALIAS.has(n)) return ALIAS.get(n);
  // "San Francisco 49ers", "the Niners": try each word / trailing words.
  const words = n.split(' ');
  for (let i = 0; i < words.length; i++) {
    const tail = words.slice(i).join(' ');
    if (ALIAS.has(tail)) return ALIAS.get(tail);
  }
  for (const w of words) if (ALIAS.has(w) && w.length > 2) return ALIAS.get(w);
  return n;
}

/** Is this square allowed in a game with this opponent and broadcast? */
export function eligible(sq, { opp = '', broadcast = DEFAULT_BROADCAST } = {}) {
  if (Array.isArray(sq.opponents) && sq.opponents.length) {
    const key = teamKey(opp);
    if (!key || !sq.opponents.some((o) => teamKey(o) === key)) return false;
  }
  if (Array.isArray(sq.broadcasts) && sq.broadcasts.length) {
    if (!sq.broadcasts.includes(broadcast)) return false;
  }
  return true;
}

export function eligibleSquares(squares, opts) {
  return squares.filter((sq) => eligible(sq, opts));
}

/** Parse a comma-separated opponent tag field into a clean list. */
export function parseTeams(text) {
  return [...new Set(String(text || '').split(/[,/]/).map((s) => s.trim()).filter(Boolean))].slice(0, 6)
    .map((s) => s.slice(0, 30));
}
