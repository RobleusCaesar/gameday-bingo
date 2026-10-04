// Unique-per-player board generation.
// seed = hash(gameCode + playerId [+ reroll salt]) -> mulberry32 -> rarity-quota draw.

import { seeded, shuffle } from './rng.js';
import { LINES, CENTER } from './rules.js';

// Tuned with tools/simulate.mjs (Common 0.85 / Uncommon 0.45 / Rare 0.12 chance per game)
// so a player's chance of at least one bingo is about: Chill 90%, Balanced 75%, Chaos 45%.
export const MIX = {
  chill: { C: 18, U: 4, R: 2 },
  balanced: { C: 14, U: 7, R: 3 },
  chaos: { C: 12, U: 5, R: 7 },
};
export const MIX_LABELS = { chill: 'Chill', balanced: 'Balanced', chaos: 'Chaos' };
export const MIN_SQUARES = 24;
export const WARN_SQUARES = 48;

// Where a short tier borrows from, nearest first.
const BACKFILL = { C: ['U', 'R'], U: ['C', 'R'], R: ['U', 'C'] };
const TIERS = ['C', 'U', 'R'];

export function normText(t) {
  return String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Split squares into rarity tiers, dropping blanks and duplicate texts. */
export function tiersOf(squares) {
  const seen = new Set();
  const tiers = { C: [], U: [], R: [] };
  for (const sq of squares) {
    const key = normText(sq.t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tiers[TIERS.includes(sq.r) ? sq.r : 'C'].push(sq);
  }
  return tiers;
}

/** How many squares to take from each tier, after backfilling short tiers. */
export function quotas(counts, mix = 'balanced') {
  const want = { ...(MIX[mix] || MIX.balanced) };
  const take = {};
  for (const t of TIERS) take[t] = Math.min(want[t], counts[t]);
  for (const t of ['R', 'C', 'U']) {
    let deficit = want[t] - take[t];
    for (const adj of BACKFILL[t]) {
      if (deficit <= 0) break;
      const extra = Math.min(deficit, counts[adj] - take[adj]);
      take[adj] += extra;
      deficit -= extra;
    }
  }
  return take;
}

function raresPerLineOk(board) {
  return LINES.every((line) => line.filter((i) => board[i] && board[i].r === 'R').length <= 2);
}

/**
 * Build a 25-cell board (index 12 = null, the FREE square).
 * @param {{t:string,r:'C'|'U'|'R'}[]} squares the pack pool
 * @param {string} mix chill | balanced | chaos
 * @param {string} seedStr e.g. code + playerId
 */
export function generateBoard(squares, mix, seedStr) {
  const rand = seeded(seedStr);
  const tiers = tiersOf(squares);
  const counts = { C: tiers.C.length, U: tiers.U.length, R: tiers.R.length };
  const take = quotas(counts, mix);

  const picks = [];
  for (const t of TIERS) {
    const pool = shuffle(tiers[t].slice(), rand);
    picks.push(...pool.slice(0, take[t]).map((sq) => ({ t: sq.t, r: t })));
  }
  if (picks.length < 24) throw new Error(`Need at least ${MIN_SQUARES} squares`);

  // Fairness: no line may hold more than 2 Rares. Re-shuffle until it holds.
  let board;
  for (let attempt = 0; attempt < 500; attempt++) {
    board = placeCells(shuffle(picks.slice(), rand));
    if (raresPerLineOk(board)) return board;
  }
  return repairRares(board, rand);
}

function placeCells(list) {
  const board = new Array(25);
  let k = 0;
  for (let i = 0; i < 25; i++) board[i] = i === CENTER ? null : list[k++];
  return board;
}

/** Deterministic fallback: swap Rares out of overloaded lines. */
function repairRares(board, rand) {
  const cells = [...Array(25).keys()].filter((i) => i !== CENTER);
  for (let guard = 0; guard < 200 && !raresPerLineOk(board); guard++) {
    const bad = LINES.find((line) => line.filter((i) => board[i]?.r === 'R').length > 2);
    const from = bad.filter((i) => board[i]?.r === 'R')[Math.floor(rand() * 3)];
    const targets = shuffle(cells.filter((i) => board[i].r !== 'R'), rand);
    for (const to of targets) {
      [board[from], board[to]] = [board[to], board[from]];
      if (LINES.every((line) => !line.includes(to) || line.filter((i) => board[i]?.r === 'R').length <= 2)) break;
      [board[from], board[to]] = [board[to], board[from]];
    }
  }
  return board;
}

/**
 * Expected share of squares two players' boards have in common (0..1).
 * Two independent draws of k from a tier of n share k²/n squares on average.
 */
export function expectedOverlap(counts, mix = 'balanced') {
  const total = counts.C + counts.U + counts.R;
  if (total < 24) return 1;
  const take = quotas(counts, mix);
  let shared = 0;
  for (const t of TIERS) if (counts[t]) shared += (take[t] * take[t]) / counts[t];
  return shared / 24;
}

/** Pack health: can it make games, and how unique are boards? */
export function packStats(squares) {
  const tiers = tiersOf(squares);
  const counts = { C: tiers.C.length, U: tiers.U.length, R: tiers.R.length };
  const total = counts.C + counts.U + counts.R;
  const overlap = Math.max(...Object.keys(MIX).map((m) => expectedOverlap(counts, m)));
  let strength = 'great';
  if (total < WARN_SQUARES || overlap > 0.6) strength = 'low';
  else if (overlap > 0.4) strength = 'good';
  return {
    counts,
    total,
    overlap,
    strength,
    canCreate: total >= MIN_SQUARES,
    warn: total < WARN_SQUARES,
  };
}
