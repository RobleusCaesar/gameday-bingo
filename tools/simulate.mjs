// How likely is a bingo? Simulates boards against a typical game.
//
//   node tools/simulate.mjs                 # 10,000 boards per mix, default pack, vs Niners, Sunday afternoon
//   node tools/simulate.mjs --boards 20000 --opp Chiefs --broadcast snf --pack any
//
// Each square "happens" independently with its rarity's probability:
// Common 0.85, Uncommon 0.45, Rare 0.12. The FREE center is always marked.
// A bingo here is any completed row, column or diagonal (bonus patterns off).
import { BUILTIN_PACKS } from '../js/data/default-packs.js';
import { generateBoard, MIX } from '../js/board.js';
import { LINES, CENTER } from '../js/rules.js';
import { eligibleSquares } from '../js/tags.js';
import { mulberry32 } from '../js/rng.js';

export const HAPPENS = { C: 0.85, U: 0.45, R: 0.12 };
export const TARGETS = { chill: 0.90, balanced: 0.75, chaos: 0.45 };

/** Share of players with at least one bingo, for one mix. */
export function bingoRate(pool, mix, boards = 10000, seed = 1) {
  const rand = mulberry32(seed);
  let hits = 0;
  for (let b = 0; b < boards; b++) {
    const board = generateBoard(pool, mix, `sim:${mix}:${seed}:${b}`);
    const marks = board.map((sq, i) => i === CENTER || rand() < HAPPENS[sq.r]);
    if (LINES.some((line) => line.every((i) => marks[i]))) hits++;
  }
  return hits / boards;
}

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : fallback;
}

if (process.argv[1] && process.argv[1].endsWith('simulate.mjs')) {
  const boards = Number(arg('boards', 10000));
  const packId = arg('pack', 'broncos');
  const opp = arg('opp', 'Niners');
  const broadcast = arg('broadcast', 'afternoon');
  const pack = BUILTIN_PACKS.find((p) => p.builtin === packId);
  const pool = eligibleSquares(pack.squares, { opp, broadcast });
  const n = { C: 0, U: 0, R: 0 };
  pool.forEach((s) => n[s.r]++);
  console.log(`${pack.name} vs ${opp}, ${broadcast}: ${pool.length} squares (C ${n.C} / U ${n.U} / R ${n.R}), ${boards} boards per mix`);
  for (const mix of Object.keys(MIX)) {
    const rate = bingoRate(pool, mix, boards);
    const q = MIX[mix];
    console.log(`  ${mix.padEnd(8)} quota C${q.C}/U${q.U}/R${q.R}  ≥1 bingo: ${(rate * 100).toFixed(1)}%  (target ${(TARGETS[mix] * 100).toFixed(0)}%)`);
  }
}
