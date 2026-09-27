// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { generateBoard, packStats, quotas, MIX, tiersOf } = await import('../js/board.js');
const { LINES, evaluate, bingoKeys, marksToBits, bitsToMarks, CENTER } = await import('../js/rules.js');
const { BUILTIN_PACKS } = await import('../js/data/default-packs.js');
const { newCode, isCode } = await import('../js/rng.js');

const broncos = BUILTIN_PACKS[0].squares;
const anyGame = BUILTIN_PACKS[1].squares;

test('default packs are big enough and fully tiered', () => {
  for (const pack of BUILTIN_PACKS) {
    const s = packStats(pack.squares);
    assert.ok(s.total >= 75, `${pack.name} has ${s.total}`);
    assert.equal(s.strength, 'great', pack.name);
  }
  const broncosTiers = tiersOf(broncos);
  assert.deepEqual(
    { C: broncosTiers.C.length, U: broncosTiers.U.length, R: broncosTiers.R.length },
    { C: 36, U: 38, R: 17 },
  );
  assert.ok(!JSON.stringify(anyGame).match(/Broncos|Nix|Payton|Elway|Mahomes/));
});

test('boards are deterministic per seed and have FREE center', () => {
  const a = generateBoard(broncos, 'balanced', 'ABCDE' + 'player-1');
  const b = generateBoard(broncos, 'balanced', 'ABCDE' + 'player-1');
  assert.deepEqual(a, b);
  assert.equal(a.length, 25);
  assert.equal(a[CENTER], null);
  assert.equal(new Set(a.filter(Boolean).map((s) => s.t)).size, 24);
});

test('rarity quotas per mix', () => {
  for (const [mix, q] of Object.entries(MIX)) {
    for (let i = 0; i < 50; i++) {
      const board = generateBoard(broncos, mix, 'Q' + mix + i);
      const n = { C: 0, U: 0, R: 0 };
      board.filter(Boolean).forEach((s) => n[s.r]++);
      assert.deepEqual(n, q, mix);
    }
  }
});

test('short tiers backfill from the adjacent tier', () => {
  assert.deepEqual(quotas({ C: 30, U: 30, R: 1 }, 'chaos'), { C: 8, U: 15, R: 1 });
  assert.deepEqual(quotas({ C: 2, U: 30, R: 30 }, 'chill'), { C: 2, U: 20, R: 2 });
  assert.deepEqual(quotas({ C: 24, U: 0, R: 0 }, 'balanced'), { C: 24, U: 0, R: 0 });
  const onlyCommon = Array.from({ length: 24 }, (_, i) => ({ t: 'sq' + i, r: 'C' }));
  assert.equal(generateBoard(onlyCommon, 'chaos', 'x').filter(Boolean).length, 24);
});

test('fairness: no line has more than 2 rares (chaos, 2000 boards)', () => {
  for (let i = 0; i < 2000; i++) {
    const board = generateBoard(broncos, 'chaos', 'FAIR' + i);
    for (const line of LINES) {
      assert.ok(line.filter((c) => board[c]?.r === 'R').length <= 2, `board ${i}`);
    }
  }
});

test('uniqueness: 1000 boards, no identical pair, mean overlap <= 60%', () => {
  for (const pack of [broncos, anyGame]) {
    const code = newCode();
    const boards = [];
    for (let i = 0; i < 1000; i++) {
      boards.push(new Set(generateBoard(pack, 'balanced', code + 'p' + i).filter(Boolean).map((s) => s.t)));
    }
    let sum = 0, pairs = 0, max = 0;
    for (let i = 0; i < boards.length; i++) {
      for (let j = i + 1; j < boards.length; j += 7) {
        let shared = 0;
        for (const t of boards[i]) if (boards[j].has(t)) shared++;
        const o = shared / 24;
        sum += o; pairs++; max = Math.max(max, o);
      }
    }
    const mean = sum / pairs;
    assert.ok(mean <= 0.6, `mean overlap ${mean}`);
    assert.ok(max < 1, 'found identical boards');
    console.log(`  mean overlap ${(mean * 100).toFixed(1)}%, max ${(max * 100).toFixed(1)}%`);
  }
});

test('scoring: squares, lines, patterns', () => {
  const board = generateBoard(broncos, 'balanced', 'SCORE');
  const marks = Array(25).fill(false);
  marks[CENTER] = true;
  let ev = evaluate(board, marks, { corners: true, x: true, blackout: true });
  assert.equal(ev.points, 0);
  assert.equal(ev.bingos, 0);

  // Complete row 3 (through FREE).
  [10, 11, 13, 14].forEach((i) => (marks[i] = true));
  ev = evaluate(board, marks, {});
  const sq = [10, 11, 13, 14].reduce((s, i) => s + { C: 1, U: 2, R: 3 }[board[i].r], 0);
  assert.equal(ev.lines.length, 1);
  assert.equal(ev.bingos, 1);
  assert.equal(ev.points, sq + 10);
  assert.deepEqual(bingoKeys(ev), ['L2']);

  // Four corners only counts when enabled.
  [0, 4, 20, 24].forEach((i) => (marks[i] = true));
  assert.equal(evaluate(board, marks, {}).corners, false);
  const withCorners = evaluate(board, marks, { corners: true });
  assert.equal(withCorners.corners, true);
  assert.equal(withCorners.bingos, 2);

  // Blackout: 12 lines + corners + X + blackout = 15 bingos, bonus 120+10+20+50.
  const all = Array(25).fill(true);
  const full = evaluate(board, all, { corners: true, x: true, blackout: true });
  assert.equal(full.bingos, 15);
  assert.equal(full.bonus, 12 * 10 + 10 + 20 + 50);
});

test('near-miss detection', () => {
  const board = generateBoard(broncos, 'balanced', 'NEAR');
  const marks = Array(25).fill(false);
  marks[CENTER] = true;
  [0, 1, 2, 3].forEach((i) => (marks[i] = true));
  const ev = evaluate(board, marks, {});
  assert.ok(ev.near.some((n) => n.line === 0 && n.cell === 4));
});

test('mark bits round-trip', () => {
  const marks = Array.from({ length: 25 }, (_, i) => i % 3 === 0);
  assert.deepEqual(bitsToMarks(marksToBits(marks)), marks);
  assert.equal(marksToBits(Array(25).fill(true)), 2 ** 25 - 1);
});

test('game codes use the unambiguous alphabet', () => {
  for (let i = 0; i < 500; i++) {
    const c = newCode();
    assert.ok(isCode(c), c);
    assert.ok(!/[ILO01]/.test(c));
  }
});
